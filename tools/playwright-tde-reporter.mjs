// Playwright 报告器：把《食梦者》（TDE）浏览器用例的结果写成 audit/tde-browser-acceptance.json。
//
// 为什么要有它：账本里的 desktopBrowser / mobileBrowser / release / media 必须是**跑出来的**，
// 不能手写；审计工具（tools/audit-tde-rules.mjs、tools/audit-tde-scenarios.mjs）只读本文件，
// 缺失或没通过即把对应项记 false。
//
// P9 升级（与 TCU P10 的 tools/playwright-tcu-reporter.mjs 同构）：
// - schemaVersion 升 3，milestone 'P9'（P10 发布起改为 'P10'，账本随发布门禁重写）；
// - `specs[]`：本次命令覆盖的 spec（证据命令必须一次跑齐 7 个 spec，分 spec 跑会互相覆盖）；
// - `scenarios[]`：按用例 annotation（type: 'scenario'，description = 章节 id）归集每章的
//   桌面/移动通过 + 该视口截图存在（截图 annotation type: 'screenshot'，路径相对仓库根目录）；
// - `release`：tests/tde-release.browser.mjs 的桌面 / 移动用例通过且各有实机截图；
// - `media`：tests/tde-media.browser.mjs 的桌面 / 移动用例通过，以及该 spec 声明的资源条数
//   （annotation type: 'media'，description 形如 "images=388,tracks=76"，由 spec 从真实模块派生）；
// - `screenshots[]` 每条做 exists 实检；只有「该视口有用例通过 + 有截图存在」才把
//   checks.desktopBrowser / checks.mobileBrowser 记为 true；
// - annotation 还接受 type: 'interaction'（交互 id）与 type: 'viewport'，不参与通过判定，只随
//   tests[] / screenshots[] 记账，便于后续逐交互审计。
//
// 用法（只挂在 playwright.tde.config.mjs 上，不影响其他循环的浏览器回归）：
//   node ../../node_modules/@playwright/test/cli.js test --config playwright.tde.config.mjs
// 单跑某个 spec 调试可以，但写账本的证据命令固定为 6 个 spec 一次跑齐：
//   node ../../node_modules/@playwright/test/cli.js test --config playwright.tde.config.mjs \
//     tde-rules.browser.mjs tde-interactions.browser.mjs tde-scenarios.browser.mjs \
//     tde-dual.browser.mjs tde-release.browser.mjs tde-media.browser.mjs
//
// 约定：
// - 输出刻意不含耗时、时间戳与宿主信息：同一个干净检出跑同一命令应当得到逐字节相同的结论；
// - 截图路径以仓库根目录为基准（artifacts/tde-migration/…），spec 用绝对路径写 annotation。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// tools/ → games/arkhamhorror/；再上两层是仓库根目录（artifacts/ 在这里）。
const PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url))
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const TARGET = fileURLToPath(new URL('../audit/tde-browser-acceptance.json', import.meta.url))

const TDE_SPEC = /tde-.*\.browser\.mjs$/
const RELEASE_SPEC = /tde-release\.browser\.mjs$/
const MEDIA_SPEC = /tde-media\.browser\.mjs$/
const EVIDENCE_COMMAND = 'node ../../node_modules/@playwright/test/cli.js test '
  + '--config playwright.tde.config.mjs tde-rules.browser.mjs tde-interactions.browser.mjs '
  + 'tde-scenarios.browser.mjs tde-dual.browser.mjs tde-release.browser.mjs tde-media.browser.mjs'

const toPackagePath = absolute => relative(PACKAGE_ROOT, absolute).replace(/\\/g, '/')
const toRepoPath = absolute => relative(REPO_ROOT, absolute).replace(/\\/g, '/')
const viewportOf = title => (/mobile/.test(title) ? 'mobile' : 'desktop')
const annotationValue = (annotations, type) =>
  (annotations || []).find(annotation => annotation.type === type && annotation.description)?.description || null
const specOf = test => toPackagePath(test.location.file)
const sorted = (items, key) => [...items].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))

// media spec 的 annotation description 形如 "images=388,tracks=76"（数量由 spec 从真实模块派生）。
function mediaResourceCount(annotations) {
  for (const annotation of annotations || []) {
    if (annotation.type !== 'media') continue
    const match = /images=(\d+),tracks=(\d+)/.exec(String(annotation.description || ''))
    if (match) return Number(match[1]) + Number(match[2])
  }
  return 0
}

export default class TdeBrowserReporter {
  constructor() {
    this.tests = []
    this.screenshots = []
    this.media = []
  }

  onTestEnd(test, result) {
    const file = String(test.location?.file || '').replace(/\\/g, '/')
    if (!TDE_SPEC.test(file)) return
    const viewport = viewportOf(test.title)
    const scenario = annotationValue(test.annotations, 'scenario')
    const interaction = annotationValue(test.annotations, 'interaction')
    const spec = specOf(test)
    this.tests.push({
      title: test.title,
      spec,
      file: spec,
      viewport,
      scenario,
      interaction,
      expectedStatus: test.expectedStatus,
      status: result.status,
      retry: result.retry,
    })
    if (MEDIA_SPEC.test(file)) {
      this.media.push({ spec, viewport, resources: mediaResourceCount(test.annotations), status: result.status })
    }
    for (const annotation of test.annotations || []) {
      if (annotation.type !== 'screenshot' || !annotation.description) continue
      const absolute = String(annotation.description)
      const path = toRepoPath(absolute)
      this.screenshots.push({
        // 截图 name 用文件名（含章节/视口，天然唯一），避免同 spec 不同章节重名。
        name: basename(path).replace(/\.png$/, ''),
        path,
        base: 'repo-root',
        viewport,
        scenario,
        interaction,
        spec,
        exists: existsSync(absolute),
      })
    }
  }

  onEnd(result) {
    const tests = sorted(this.tests, item => item.title)
    const screenshots = sorted(this.screenshots, item => item.path)
    const specs = [...new Set(tests.map(item => item.spec))].sort()
    const ofViewport = viewport => tests.filter(item => item.viewport === viewport)
    const shotsOf = viewport => screenshots.filter(item => item.viewport === viewport)
    const liveShots = screenshots.filter(item => item.exists)
    const passed = tests.length > 0 && tests.every(item => item.status === 'passed')
    const passedFor = (specsPattern, viewport) =>
      tests.some(item => specsPattern.test(item.spec) && item.viewport === viewport && item.status === 'passed')
    const shotsFor = (specsPattern, viewport) => liveShots
      .filter(item => specsPattern.test(item.spec) && item.viewport === viewport)

    // 逐章实机路径证据：每个出现的 scenario 分别汇总 desktop/mobile 用例与截图（截图必须真实存在）。
    const scenarios = [...new Set(tests.map(item => item.scenario).filter(Boolean))].sort().map(scenario => ({
      scenario,
      desktop: ofViewport('desktop').some(item => item.scenario === scenario && item.status === 'passed')
        && screenshots.some(item => item.scenario === scenario && item.viewport === 'desktop' && item.exists),
      mobile: ofViewport('mobile').some(item => item.scenario === scenario && item.status === 'passed')
        && screenshots.some(item => item.scenario === scenario && item.viewport === 'mobile' && item.exists),
    }))

    // P9 发布门禁：大厅→战役 shell 实机路径（release，另需实机截图）与真实 HTTP 素材（media）。
    const releaseShots = sorted([
      ...shotsFor(RELEASE_SPEC, 'desktop'),
      ...shotsFor(RELEASE_SPEC, 'mobile'),
    ], item => item.path)
    const release = {
      desktop: passed && passedFor(RELEASE_SPEC, 'desktop') && releaseShots.some(item => item.viewport === 'desktop'),
      mobile: passed && passedFor(RELEASE_SPEC, 'mobile') && releaseShots.some(item => item.viewport === 'mobile'),
      screenshots: releaseShots.map(item => item.path),
    }
    const mediaResources = this.media.length ? Math.max(...this.media.map(item => item.resources)) : 0
    const media = {
      desktop: passed && passedFor(MEDIA_SPEC, 'desktop')
        && shotsFor(MEDIA_SPEC, 'desktop').length > 0,
      mobile: passed && passedFor(MEDIA_SPEC, 'mobile')
        && shotsFor(MEDIA_SPEC, 'mobile').length > 0,
      resources: mediaResources,
    }

    // 复用已有文件里的历史 spec 结果会破坏可复现性：只写本次命令的结果，因此证据命令必须一次跑齐。
    let previousSpecs = []
    try {
      previousSpecs = JSON.parse(readFileSync(TARGET, 'utf8')).specs || []
    } catch {
      previousSpecs = []
    }
    const clobbered = previousSpecs.filter(spec => !specs.includes(spec))
    const report = {
      schemaVersion: 3,
      generatedBy: 'playwright + tools/playwright-tde-reporter.mjs',
      spec: specs[0] || null,
      specs,
      milestone: 'P10',
      campaignId: 'theDreamEaters',
      status: passed && result.status === 'passed' ? 'passed' : 'failed',
      screenshotBase: 'repo-root',
      checks: {
        // 每个视口至少一条用例通过、且留下真实存在的截图，才算该视口有证据。
        desktopBrowser: passed && ofViewport('desktop').length > 0 && shotsOf('desktop').some(item => item.exists),
        mobileBrowser: passed && ofViewport('mobile').length > 0 && shotsOf('mobile').some(item => item.exists),
        release: { desktop: release.desktop, mobile: release.mobile },
        media: { desktop: media.desktop, mobile: media.mobile },
      },
      release,
      media,
      scenarios,
      tests,
      screenshots,
    }
    mkdirSync(new URL('../audit/', import.meta.url), { recursive: true })
    writeFileSync(TARGET, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    console.log(`tde browser acceptance: audit/tde-browser-acceptance.json · ${report.status} · `
      + `${tests.length} 条用例 / ${specs.length} 个 spec / 剧本实机 ${scenarios.length} 章 · `
      + `截图 ${screenshots.length} 张（存在 ${liveShots.length}） · `
      + `release ${release.desktop && release.mobile ? 'desktop+mobile' : '未齐'} · `
      + `media ${media.desktop && media.mobile ? `${media.resources} 项` : '未齐'}`)
    if (clobbered.length) {
      console.log(`⚠ 本次命令没有覆盖这些历史 spec，其证据已从报告移除：${clobbered.join(', ')}`)
      console.log(`  证据命令固定为：${EVIDENCE_COMMAND}`)
    }
  }
}
