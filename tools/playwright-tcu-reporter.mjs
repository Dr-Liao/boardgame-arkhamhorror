// Playwright 报告器：把《万象无终》浏览器用例的结果写成 audit/tcu-browser-acceptance.json。
//
// 为什么要有它（路线图 §8.3 第 4 条）：TFA 的 audit/tfa-browser-acceptance.json 是手工提交的
// JSON，无法复现；TCU 要求浏览器证据**由 runner 生成**。审计工具（tools/audit-tcu.mjs、
// tools/audit-tcu-scenarios.mjs）只读本文件，缺失即 browserAcceptance 为 false，不允许手写补上。
//
// 用法（只挂在 playwright.tcu.config.mjs 上，不影响其他循环的浏览器回归）：
//   npx playwright test --config playwright.tcu.config.mjs tcu-rules.browser.mjs tcu-interactions.browser.mjs \
//     tcu-scenarios.browser.mjs tcu-release.browser.mjs tcu-media.browser.mjs
// 一次命令跑齐五个 spec：本报告器在 onEnd 一次性写文件，分 spec 跑会互相覆盖（证据命令固定为全量）。
//
// P10 新增：
// - milestone 升 'P10'；
// - `release` 汇总：tests/tcu-release.browser.mjs 的桌面 / 移动用例通过且各有实机截图
//   （大厅→序章→章节路径，截图路径见 release.screenshots）；
// - `media` 汇总：tests/tcu-media.browser.mjs 的桌面 / 移动用例通过，以及该 spec 声明的资源条数
//   （annotation type: 'media'，由 spec 动态派生的图片 + BGM 数量，不是手写清单）。
//
// 约定：
// - 用例把截图路径写进 annotation（type: 'screenshot'），路径相对**仓库根目录**（artifacts/tcu-migration/…）；
// - 剧本实机路径用例额外写 annotation（type: 'scenario'，description = 章节 id），供逐章审计归集；
// - 输出刻意不含耗时、时间戳与宿主信息：同一个干净检出跑同一命令应当得到逐字节相同的结论；
// - 只有「该视口有用例通过 + 有截图存在」才把 desktopBrowser / mobileBrowser 记为 true。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// tools/ → games/arkhamhorror/；再上两层是仓库根目录（artifacts/ 在这里）。
const PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url))
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const TARGET = fileURLToPath(new URL('../audit/tcu-browser-acceptance.json', import.meta.url))

const TCU_SPEC = /tcu-.*\.browser\.mjs$/
const RELEASE_SPEC = /tcu-release\.browser\.mjs$/
const MEDIA_SPEC = /tcu-media\.browser\.mjs$/
const EVIDENCE_COMMAND = 'npx playwright test --config playwright.tcu.config.mjs tcu-rules.browser.mjs '
  + 'tcu-interactions.browser.mjs tcu-scenarios.browser.mjs tcu-release.browser.mjs tcu-media.browser.mjs'

const toPackagePath = absolute => relative(PACKAGE_ROOT, absolute).replace(/\\/g, '/')
const toRepoPath = absolute => relative(REPO_ROOT, absolute).replace(/\\/g, '/')
const viewportOf = title => (/mobile/.test(title) ? 'mobile' : 'desktop')
const scenarioOf = annotations =>
  (annotations || []).filter(annotation => annotation.type === 'scenario' && annotation.description)
    .map(annotation => annotation.description)[0] || null
const specOf = test => toPackagePath(test.location.file)
const sorted = (items, key) => [...items].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))

// media spec 的 annotation description 形如 "images=10,tracks=27"（数量由 spec 从 web/ 模块派生）。
function mediaResourceCount(annotations) {
  for (const annotation of annotations || []) {
    if (annotation.type !== 'media') continue
    const match = /images=(\d+),tracks=(\d+)/.exec(String(annotation.description || ''))
    if (match) return Number(match[1]) + Number(match[2])
  }
  return 0
}

export default class TcuBrowserReporter {
  constructor() {
    this.tests = []
    this.screenshots = []
    this.media = []
  }

  onTestEnd(test, result) {
    const file = String(test.location?.file || '').replace(/\\/g, '/')
    if (!TCU_SPEC.test(file)) return
    const viewport = viewportOf(test.title)
    const scenario = scenarioOf(test.annotations)
    const spec = specOf(test)
    this.tests.push({
      title: test.title,
      spec,
      file: spec,
      viewport,
      scenario,
      expectedStatus: test.expectedStatus,
      status: result.status,
      retry: result.retry,
    })
    if (MEDIA_SPEC.test(file)) {
      this.media.push({ spec, viewport, resources: mediaResourceCount(test.annotations), status: result.status })
    }
    for (const annotation of test.annotations || []) {
      if (annotation.type !== 'screenshot' || !annotation.description) continue
      const path = toRepoPath(annotation.description)
      this.screenshots.push({
        // 截图 name 用文件名（含章节/视口，天然唯一），避免同 spec 不同章节重名。
        name: basename(path).replace(/\.png$/, ''),
        path,
        base: 'repo-root',
        viewport,
        scenario,
        spec,
      })
    }
  }

  onEnd(result) {
    const tests = sorted(this.tests, item => item.title)
    const screenshots = sorted(this.screenshots, item => item.path)
    const specs = [...new Set(tests.map(item => item.spec))].sort()
    const ofViewport = viewport => tests.filter(item => item.viewport === viewport)
    const shotsOf = viewport => screenshots.filter(item => item.viewport === viewport)
    const passed = tests.length > 0 && tests.every(item => item.status === 'passed')
    const passedFor = (specsPattern, viewport) =>
      tests.some(item => specsPattern.test(item.spec) && item.viewport === viewport && item.status === 'passed')
    const shotsFor = (specsPattern, viewport) =>
      screenshots.filter(item => specsPattern.test(item.spec) && item.viewport === viewport)
    // 逐章实机路径证据：每个出现的 scenario 分别汇总 desktop/mobile 用例与截图。
    const scenarios = [...new Set(tests.map(item => item.scenario).filter(Boolean))].sort().map(scenario => ({
      scenario,
      desktop: ofViewport('desktop').some(item => item.scenario === scenario && item.status === 'passed')
        && screenshots.some(item => item.scenario === scenario && item.viewport === 'desktop'),
      mobile: ofViewport('mobile').some(item => item.scenario === scenario && item.status === 'passed')
        && screenshots.some(item => item.scenario === scenario && item.viewport === 'mobile'),
    }))
    // P10 发布级证据：大厅→序章→章节实机路径（release，另需实机截图）与真实 HTTP 素材（media）。
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
      desktop: passed && passedFor(MEDIA_SPEC, 'desktop'),
      mobile: passed && passedFor(MEDIA_SPEC, 'mobile'),
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
      generatedBy: 'playwright + tools/playwright-tcu-reporter.mjs',
      spec: specs[0] || null,
      specs,
      milestone: 'P10',
      campaignId: 'theCircleUndone',
      status: passed && result.status === 'passed' ? 'passed' : 'failed',
      screenshotBase: 'repo-root',
      checks: {
        // 每个视口至少一条用例通过、且留下截图，才算该视口有证据。
        desktopBrowser: passed && ofViewport('desktop').length > 0 && shotsOf('desktop').length > 0,
        mobileBrowser: passed && ofViewport('mobile').length > 0 && shotsOf('mobile').length > 0,
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
    console.log(`tcu browser acceptance: audit/tcu-browser-acceptance.json · ${report.status} · `
      + `${tests.length} 条用例 / ${specs.length} 个 spec / 剧本实机 ${scenarios.length} 章 · 截图 ${screenshots.length} 张 · `
      + `release ${release.desktop && release.mobile ? 'desktop+mobile' : '未齐'} · media ${media.desktop && media.mobile ? `${media.resources} 项` : '未齐'}`)
    if (clobbered.length) {
      console.log(`⚠ 本次命令没有覆盖这些历史 spec，其证据已从报告移除：${clobbered.join(', ')}`)
      console.log(`  证据命令固定为：${EVIDENCE_COMMAND}`)
    }
  }
}
