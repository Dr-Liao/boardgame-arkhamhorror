// Playwright 报告器：九循环《铁杉谷盛宴》（The Feast of Hemlock Vale）P8 发布浏览器证据的唯一写者。
//
// 账本：audit/fhv-release-browser.json（schemaVersion 1，确定性：无时间戳/无耗时/无本机绝对路径）
//   · 唯一 spec：tests/fhv-release.browser.mjs（3 个 phase × desktop/mobile = 6 行）：
//       phase=release      真实大厅启动《铁杉谷盛宴》→ 调查准备（选人/自动构筑/确认）→ 出发准备 →
//                          首章《欢迎来到铁杉谷》牌桌 → 关卡设置指南（中英标题/特别规则/剧透折叠）→
//                          真实法典动作（地点 [codex] 面板）→ 序曲整备（保留 1 张支援）→
//                          下一章开局带支援入场（整备包裹消费）
//       phase=progression  真实关末结算 → 幕间 → 勘察选择 → 首夜 → 第二日黎明 → 升级窗（购买/跳过）
//                          → 逐日推进（Day 2/Day 3）→ 尾声/终章 → campaignResult；中途刷新页面断线恢复
//       phase=online       中转服务 + 两个真实大厅实例、两名真人各自准备/开局；隐私（对方手牌/牌库
//                          顺序不进入席位投影）、权限边界（非房主不能 debug/hubBeginScenario/替他人
//                          行动）、断线恢复（客人重开页面回到同一战役会话并可继续）
//   · checks（本循环约定字段名，嵌套）：
//       release / progression / online 各自 { desktop, mobile }；
//       privacy { desktop, mobile }；permissionBoundary；disconnectRecovery
//   · screenshots[]：{ path(repo 根相对), base:'repo-root', viewport, phase, bytes, sha256 }；
//     逐张 stat + sha256（只信磁盘），phase × 视口 ≥4 张、全局 ≥24 张。
//   · sourceFiles[]：本链交付文件 + 大厅/引擎/内容读点的 sha256 快照；运行中变化
//     → sourceStableDuringRun=false、status=failed（附 sourceDrift 诊断）。
//   · status=passed 仅当：Playwright 整体 passed + 6/6 用例 passed + complete + checks 全真
//     + 截图 ≥24 张且逐张哈希一致 + sourceStableDuringRun + 无缺失截图。
//
// 证据命令（在 games/arkhamhorror 下）：
//   node tools/run-fhv-release-browser.mjs
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
const MOD = fileURLToPath(new URL('../', import.meta.url))
const TARGET = join(MOD, 'audit/fhv-release-browser.json')
const EVIDENCE_COMMAND = 'node tools/run-fhv-release-browser.mjs'

// 显式声明（不读 config 正则）：本链只有一个 spec 文件，3 个 phase 用例 × 2 视口 = 6 行。
const SPEC = 'tests/fhv-release.browser.mjs'
export const EXPECTED_SPECS = Object.freeze([SPEC])
const EXPECTED_TESTS = 6
const VIEWPORTS = Object.freeze(['desktop', 'mobile'])
const PHASES = Object.freeze(['release', 'progression', 'online'])
const SHOTS_PER_PHASE_VIEWPORT = 4
const SHOTS_TOTAL_MIN = 24

// 本链交付文件 + 发布门禁读点源码（sourceStableDuringRun 的哈希对象；运行期间不得被并发修改）。
// 引擎/内容读点在清单里：发布门禁要证明「同一个应用源码版本」产出了这 6 行证据。
const SOURCE_FILES = Object.freeze([
  'tests/fhv-release.browser.mjs',
  'tests/playwright/playwright.fhv-release.config.mjs',
  'tools/playwright-fhv-release-reporter.mjs',
  'tools/run-fhv-release-browser.mjs',
  'src/engine/hub.js',
  'src/engine/dispatch.js',
  'src/engine/campaign-flow.js',
  'src/engine/survey-preparation.js',
  'src/engine/mechanic-choices.js',
  'src/integration/observation.js',
  'src/integration/mechanic-view.js',
  'web/hub.js',
  'web/game-ui.js',
  'web/mechanic-ui.js',
  'web/scenario-setup-view.js',
  'content/campaigns/theFeastOfHemlockVale/flow.js',
  'content/campaigns/theFeastOfHemlockVale/parts.js',
  'content/campaigns/theFeastOfHemlockVale/interludes.js',
  'content/campaigns/theFeastOfHemlockVale/epilogue.js',
  'content/registered.js',
])

const sha256 = buffer => createHash('sha256').update(buffer).digest('hex')
const toRepoPath = absolute => relative(WORKSPACE, absolute).replace(/\\/g, '/')
const toModPath = absolute => relative(MOD, absolute).replace(/\\/g, '/')
const byText = (left, right) => (left < right ? -1 : left > right ? 1 : 0)
const annotationValues = (annotations, type) => (annotations || [])
  .filter(annotation => annotation.type === type && annotation.description)
  .map(annotation => String(annotation.description))
const annotationValue = (annotations, type) => annotationValues(annotations, type)[0] || null

function sourceSnapshot() {
  const files = []
  const missing = []
  for (const path of SOURCE_FILES) {
    const absolute = join(MOD, path)
    if (!existsSync(absolute)) { missing.push(path); continue }
    const buffer = readFileSync(absolute)
    files.push({ path, sha256: sha256(buffer), bytes: statSync(absolute).size })
  }
  files.sort((left, right) => byText(left.path, right.path))
  return { files, missing }
}

export default class FhvReleaseBrowserReporter {
  onBegin() {
    this.tests = []
    this.screenshots = []
    this.before = sourceSnapshot()
  }

  onTestEnd(test, result) {
    const spec = toModPath(String(test.location?.file || ''))
    if (!EXPECTED_SPECS.includes(spec)) return
    const viewport = annotationValue(test.annotations, 'viewport')
      || (/mobile/.test(test.title) ? 'mobile' : 'desktop')
    const phase = annotationValue(test.annotations, 'phase') || 'unknown'
    const shotAnnotations = annotationValues(test.annotations, 'screenshot')
    this.tests.push({
      file: spec,
      title: test.title,
      status: result.status,
      viewport,
      // 完整 annotation（phase / scenario / claim / debugJump / evidence / screenshot …）原样进账本；
      // 截图描述统一转成 repo 根相对路径，账本里不出现本机绝对路径。
      annotations: (test.annotations || []).map(annotation => {
        const description = annotation.description === undefined ? undefined : String(annotation.description)
        const normalized = annotation.type === 'screenshot' && description ? toRepoPath(description) : description
        return { type: annotation.type, ...(normalized === undefined ? {} : { description: normalized }) }
      }),
      phase,
      claims: annotationValues(test.annotations, 'claim'),
    })
    for (const absolute of shotAnnotations) {
      this.screenshots.push({
        path: toRepoPath(absolute),
        base: 'repo-root',
        viewport,
        phase,
      })
    }
  }

  onEnd(result) {
    const tests = [...this.tests].sort((left, right) => byText(left.file, right.file)
      || byText(left.viewport, right.viewport) || byText(left.title, right.title))
    // 统一在 onEnd 读磁盘：所有页面/截图已经结束，sha256/bytes 必须与最终文件一致。
    const claimed = [...this.screenshots]
      .sort((left, right) => byText(left.path, right.path))
      .filter((item, index, list) => index === 0 || item.path !== list[index - 1].path)
    const missingScreenshots = []
    const screenshots = []
    for (const item of claimed) {
      const absolute = join(WORKSPACE, item.path)
      if (!existsSync(absolute)) { missingScreenshots.push(item.path); continue }
      screenshots.push({
        path: item.path,
        base: 'repo-root',
        viewport: item.viewport,
        phase: item.phase,
        bytes: statSync(absolute).size,
        sha256: sha256(readFileSync(absolute)),
      })
    }
    const after = sourceSnapshot()
    const sourceStableDuringRun = JSON.stringify(after.files) === JSON.stringify(this.before.files)
      && JSON.stringify(after.missing) === JSON.stringify(this.before.missing)
    const beforeByPath = new Map(this.before.files.map(file => [file.path, file]))
    const sourceDrift = after.files
      .filter(file => beforeByPath.get(file.path)?.sha256 !== file.sha256)
      .map(file => file.path)

    const specs = [...new Set(tests.map(item => item.file))].sort(byText)
    const complete = EXPECTED_SPECS.every(spec => specs.includes(spec))
      && specs.length === 1 && tests.length === EXPECTED_TESTS

    // 真实缺陷（内容/UI/引擎）不在本链修：用例把失败证据写成 blocked annotation，
    // 账本原样收录（status 仍由「用例是否通过 + 截图/checks/源码稳定」决定，不因 blocked 自动放宽）。
    const blocked = tests.flatMap(item => (item.annotations || [])
      .filter(annotation => annotation.type === 'blocked' && annotation.description)
      .map(annotation => ({
        phase: item.phase, viewport: item.viewport, title: item.title,
        description: String(annotation.description),
      })))

    const passed = tests.filter(item => item.status === 'passed')
    const liveShots = (phase, viewport) => screenshots.filter(item =>
      item.phase === phase && item.viewport === viewport)
    const passedPhase = (phase, viewport) => passed.some(item => item.phase === phase && item.viewport === viewport)
    const phaseViewportEvidence = (phase, viewport) => passedPhase(phase, viewport)
      && liveShots(phase, viewport).length >= SHOTS_PER_PHASE_VIEWPORT
    const claimEvidence = (claim, viewport) => passed.some(item => item.phase === 'online'
      && item.claims.includes(claim) && item.viewport === viewport) && liveShots('online', viewport).length > 0
    const claimEvidenceAny = claim => passed.some(item => item.claims.includes(claim))

    const checks = {
      release: {
        desktop: phaseViewportEvidence('release', 'desktop'),
        mobile: phaseViewportEvidence('release', 'mobile'),
      },
      progression: {
        desktop: phaseViewportEvidence('progression', 'desktop'),
        mobile: phaseViewportEvidence('progression', 'mobile'),
      },
      online: {
        desktop: phaseViewportEvidence('online', 'desktop'),
        mobile: phaseViewportEvidence('online', 'mobile'),
      },
      privacy: {
        desktop: claimEvidence('privacy', 'desktop'),
        mobile: claimEvidence('privacy', 'mobile'),
      },
      permissionBoundary: claimEvidenceAny('permission'),
      disconnectRecovery: claimEvidenceAny('disconnect'),
    }
    const flatten = value => Object.values(value).flatMap(item =>
      (item && typeof item === 'object' ? Object.values(item) : [item]))
    const checksPassed = flatten(checks).every(value => value === true)
    const shotsOk = screenshots.length >= SHOTS_TOTAL_MIN
      && PHASES.every(phase => VIEWPORTS.every(viewport =>
        liveShots(phase, viewport).length >= SHOTS_PER_PHASE_VIEWPORT))
      && missingScreenshots.length === 0
    const allPassed = tests.length === EXPECTED_TESTS && passed.length === EXPECTED_TESTS
    const status = result.status === 'passed' && complete && allPassed && checksPassed
      && shotsOk && sourceStableDuringRun ? 'passed' : 'failed'

    const report = {
      schemaVersion: 1,
      generatedBy: 'tools/playwright-fhv-release-reporter.mjs',
      evidenceCommand: EVIDENCE_COMMAND,
      milestone: 'P8',
      campaignId: 'theFeastOfHemlockVale',
      status,
      complete,
      sourceStable: sourceStableDuringRun,
      sourceStableDuringRun,
      sourceDrift,
      expectedSpecs: [...EXPECTED_SPECS],
      expectedTests: EXPECTED_TESTS,
      specs,
      tests,
      blocked,
      checks,
      screenshots,
      screenshotsMissing: missingScreenshots,
      sourceFiles: after.files,
      sourceFilesMissing: after.missing,
    }
    mkdirSync(join(MOD, 'audit'), { recursive: true })
    writeFileSync(TARGET, JSON.stringify(report, null, 2) + '\n')

    const shotCounts = Object.fromEntries(PHASES.map(phase => [phase,
      Object.fromEntries(VIEWPORTS.map(viewport => [viewport, liveShots(phase, viewport).length]))]))
    console.log(`fhv P8 release browser evidence: ${status} · ${tests.length}/${EXPECTED_TESTS} tests / `
      + `${specs.length} spec · screenshots ${screenshots.length}`
      + `${missingScreenshots.length ? `（缺失 ${missingScreenshots.length}）` : ''}`)
    console.log(`  checks=${JSON.stringify(checks)}`)
    console.log(`  phase×viewport shots=${JSON.stringify(shotCounts)} complete=${complete} `
      + `sourceStable=${sourceStableDuringRun} missing=${JSON.stringify(after.missing)}`)
    if (blocked.length) {
      console.log(`  blocked=${JSON.stringify(blocked.map(item => `${item.phase}/${item.viewport}:${item.description.slice(0, 160)}`))}`)
    }
    if (!sourceStableDuringRun) {
      console.log(`  ⚠ 运行期间证据源被并发写入（${sourceDrift.length} 个文件），账本 status=failed；`
        + `请静默窗口后重跑：${sourceDrift.slice(0, 8).join(', ')}${sourceDrift.length > 8 ? ' …' : ''}`)
    }
    if (status !== 'passed') {
      const failures = tests.filter(item => item.status !== 'passed')
        .map(item => `${item.phase}/${item.viewport}:${item.title}:${item.status}`)
      console.log(`  failures=${JSON.stringify(failures)} shotsOk=${shotsOk}`)
    }
  }
}
