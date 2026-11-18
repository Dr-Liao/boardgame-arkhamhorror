#!/usr/bin/env node
// 九循环《铁杉谷盛宴》（The Feast of Hemlock Vale）P4 交互与界面审计账本。
//
//   node tools/audit-fhv-interactions.mjs --write   生成 audit/fhv-interactions.json（镜像 artifacts/migration/fhv/interactions.json）
//   node tools/audit-fhv-interactions.mjs --check   复算并与磁盘逐字节比对（证据漂移即失败；status 必须 verified）
//   node tools/audit-fhv-interactions.mjs           打印 JSON（report 模式，不写盘；门禁失败时抛错）
//
// 口径：本工具只**现场复算**证据，不复制冻结结论——
//   · 覆盖矩阵 = audit/fhv-interactions-browser.json 的用例标题（`P4 desktop|mobile` 前缀 + 中文标记），
//     桌面与移动两个视口各自独立判定，任一缺项即 pending；
//   · 门禁 = Node 验收账本（含交互事务与 replay）、浏览器账本来源稳定（逐文件 SHA-256）、
//     脚本归属（script-actions-tfa）、指南入口/失败重试与键盘（scenario-guides）、
//     replay 基线 fixture SHA-256、fast 无新增失败（P4 基线 = P3 收口的既有失败清单，只要求不新增）、
//     replay 精确一致；全部读自 audit/ 账本，不手填状态；
//   · 交付原语 = 交互组对应的 P2 已交付原语，只有两视口覆盖全真才声明（P4 复用 P2 原语，不重复实现）；
//   · 确定性：无时间戳、无绝对路径、sources 按路径排序；`--check` 逐字节复算。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const RUN = join(MOD, '../../artifacts/migration/fhv')
const DOCS = 'docs/campaign/theFeastOfHemlockVale/interactions.md'

// 覆盖矩阵：7 组交互 × 2 视口。浏览器用例标题固定为 `P4 ${viewport} ${中文标记}…`。
const INTERACTION_GROUPS = Object.freeze([
  ['codex', '法典'],
  ['evolution', '演进'],
  ['survey', '序曲整备'],
  ['grid', '网格'],
  ['rail', '矿车'],
  ['enemyLocation', '敌人-地点'],
  ['investigatorState', '坚毅形态'],
])
// 由 P4 交互层交付的「P2 原语 × 交互」；覆盖全真才进入 deliveredPrimitives。
const DELIVERED_PRIMITIVES = Object.freeze([
  ['codex', ['campaign.codex', 'campaign.residents']],
  ['evolution', ['campaign.time', 'campaign.residents']],
  ['survey', ['campaign.persist', 'campaign.deckProgression']],
  ['grid', ['locations.grid']],
  ['rail', ['scenario.rail']],
  ['enemyLocation', ['locations.enemyLocation', 'chaos.predationBag']],
  ['investigatorState', ['investigators.harmAndForm', 'assets.clueTransfer']],
])
const SOURCE_PATHS = Object.freeze([
  'audit/fhv-interactions-browser.json',
  'audit/fhv-node-acceptance.json',
  'audit/fhv-regression.json',
  'src/engine/fhv-interactions.js',
  'src/engine/campaign-flow.js',
  'src/engine/mechanic-choices.js',
  'src/integration/mechanic-view.js',
  'tests/fhv-interaction-fixture.mjs',
  'tests/fhv-interactions.browser.mjs',
  'tests/fhv-interactions.test.mjs',
  'web/mechanic-ui.js',
])
const EVIDENCE = Object.freeze([
  'audit/fhv-interactions-browser.json',
  'audit/fhv-node-acceptance.json',
  'audit/fhv-regression.json',
  'src/engine/fhv-interactions.js',
  'src/integration/mechanic-view.js',
  'tests/fhv-interaction-fixture.mjs',
  'tests/fhv-interactions.browser.mjs',
  'tests/fhv-interactions.test.mjs',
  'web/mechanic-ui.js',
  'web/locales/zh-CN.misc.js',
  'web/locales/en.misc.js',
])

const byCodePoint = (left, right) => (left < right ? -1 : left > right ? 1 : 0)
const readText = path => readFileSync(join(MOD, path), 'utf8').replace(/^\uFEFF/, '')
const readOptional = path => (existsSync(join(MOD, path)) ? JSON.parse(readText(path)) : null)
const fileSha = path => (existsSync(join(MOD, path))
  ? createHash('sha256').update(readFileSync(join(MOD, path))).digest('hex') : null)

export function buildInteractionAudit() {
  const browser = readOptional('audit/fhv-interactions-browser.json')
  const node = readOptional('audit/fhv-node-acceptance.json')
  const regression = readOptional('audit/fhv-regression.json')
  const tests = Array.isArray(browser?.tests) ? browser.tests : []

  // 用例判定只认「passed + 指定文件 + 标题判据」；缺失账本时全部为 false（不伪造完成）。
  const passedTest = (fileSuffix, predicate) => tests.some(row =>
    row?.status === 'passed' && String(row.file || '').endsWith(fileSuffix) && predicate(row))
  const interactionPassed = (viewport, marker) => passedTest('fhv-interactions.browser.mjs', row => {
    const title = String(row.title || '')
    return title.startsWith(`P4 ${viewport} `) && title.includes(marker)
  })

  const coverage = Object.fromEntries(['desktop', 'mobile'].map(viewport => [viewport,
    Object.fromEntries(INTERACTION_GROUPS.map(([id, marker]) => [id, interactionPassed(viewport, marker)]))]))
  const allCoverage = Object.values(coverage).every(groups => Object.values(groups).every(Boolean))

  const sources = SOURCE_PATHS
    .map(path => ({ path, sha256: fileSha(path) }))
    .sort((left, right) => byCodePoint(left.path, right.path))
  const replayFixture = regression?.replay?.baseline || null
  const fast = regression?.fast || null
  const checks = {
    nodeAcceptance: node?.tests?.pass === true && node?.gates?.testsPassed === true && node?.gates?.replayNoDrift === true,
    sourceStable: sources.every(source => /^[0-9a-f]{64}$/.test(String(source.sha256))),
    desktopAndMobile: allCoverage,
    scriptOwnership: ['desktop', 'mobile'].every(viewport => passedTest('script-actions-tfa.browser.mjs',
      row => String(row.title || '').toLowerCase().includes(viewport))),
    guidePlacementAndPrivacy: passedTest('scenario-guides.browser.mjs',
      row => String(row.title || '').includes('完整指南按需加载')),
    guideFailureRetryAndKeyboard: passedTest('scenario-guides.browser.mjs',
      row => String(row.title || '').includes('指南加载失败')),
    // P4 回归基线 = P3 收口时的既有失败清单；P4 只要求「无新增失败 + 失败标题都被登记」。
    fastNoNewFailures: Boolean(fast) && regression.status === 'passed'
      && Array.isArray(fast.newFailures) && fast.newFailures.length === 0
      && Array.isArray(regression.knownFailures)
      && regression.knownFailures.every(row => typeof row?.title === 'string' && row.title.trim()
        && typeof row?.reason === 'string' && row.reason.trim())
      && Array.isArray(fast.titles) && fast.titles.every(title => regression.knownFailures.some(row => row.title === title)),
    replayBaselineStable: Boolean(regression?.replay) && Boolean(replayFixture)
      && regression.replay.baselineSha256 === fileSha(replayFixture),
    replayExact: Boolean(regression?.replay) && regression.replay.exitCode === 0 && regression.replay.matches === true,
  }
  const status = Object.values(checks).every(Boolean) && allCoverage ? 'verified' : 'pending'
  // 交互原语整体声明：两视口 7 组覆盖全真才交付，否则为空（不按组零散交付）。
  const deliveredPrimitives = DELIVERED_PRIMITIVES
    .every(([group]) => coverage.desktop[group] && coverage.mobile[group])
    ? [...new Set(DELIVERED_PRIMITIVES.flatMap(([, ids]) => ids))].sort(byCodePoint) : []

  const report = {
    schemaVersion: 1,
    cycle: 'fhv',
    campaignId: 'theFeastOfHemlockVale',
    milestone: 'P4',
    step: 'P4 新增交互与界面',
    generatedBy: 'tools/audit-fhv-interactions.mjs',
    docs: DOCS,
    status,
    coverage,
    checks,
    gates: checks,
    knownFailures: (regression?.knownFailures || []).map(row => ({ title: row.title, reason: row.reason })),
    deliveredPrimitives,
    browser: {
      present: Boolean(browser),
      status: browser?.status || null,
      specs: Array.isArray(browser?.specs) ? [...browser.specs].sort(byCodePoint) : [],
      tests: tests.length,
      passed: tests.filter(row => row?.status === 'passed').length,
      screenshots: Array.isArray(browser?.screenshots) ? browser.screenshots.length : 0,
    },
    contract: {
      actions: 'Only server legalMoves and requestChoice/selectMechanic; the browser submits opaque pick/confirm/cancel moves and never computes rules.',
      privacy: 'Codex entries expose id/available/used only (no branch conditions or text for untriggered entries); the time marker exposes the current day/period only; the predation bag exposes a remaining count and never its tokens; survey preparation exposes hand counts, kept assets and controlled clues but never hand card codes; grid/rail/enemy-location/form data are table-public.',
      cancellation: 'Optional choices can be cancelled before any write; mandatory choices have no cancel. Empty mandatory candidate sets return false before requestChoice, so no soft lock is left.',
      realEntry: 'campaign-flow.js already routes survey-preparation choices through the fhvSurvey mechanic operation; card/scenario abilities in P5–P7 call api.interactions.fhv.* instead of hand-built panels.',
      guide: 'The fixed setup/reference entry and scriptCard ownership are reused; full FHV scenario guides remain P7.',
      release: 'The seed/fixture is test-only and confined to tools/tests. P4 opens no content: the campaign, investigators and player cards remain catalog-only.',
      fast: 'The P4 regression baseline is the failure list recorded at the end of P3; P4 only requires no new failures and every known failure to be disclosed with a reason.',
    },
    evidence: [...EVIDENCE],
    sources,
  }
  return report
}

const isCli = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isCli) {
  const report = buildInteractionAudit()
  const failed = Object.entries(report.gates).filter(([, value]) => value !== true).map(([key]) => key)
  const write = () => {
    const content = JSON.stringify(report, null, 2) + '\n'
    mkdirSync(RUN, { recursive: true })
    writeFileSync(join(MOD, 'audit/fhv-interactions.json'), content)
    writeFileSync(join(RUN, 'interactions.json'), content)
  }
  if (process.argv.includes('--write') || process.argv.includes('--check')) {
    if (process.argv.includes('--check')) {
      const disk = readOptional('audit/fhv-interactions.json')
      if (!disk) throw new Error('audit/fhv-interactions.json 不存在：先 --write')
      if (JSON.stringify(disk) !== JSON.stringify(report)) throw new Error('audit/fhv-interactions.json 与复算结果不一致；审阅证据后显式 --write')
    } else {
      write()
    }
    console.log(`fhv interactions: ${report.status}（覆盖 ${Object.keys(report.coverage.desktop).length} 组 × 2 视口：${JSON.stringify(report.coverage)}）`)
  } else {
    console.log(JSON.stringify(report, null, 2))
  }
  if (failed.length) throw new Error(`fhv interactions 门禁失败：${failed.join('、')}`)
}
