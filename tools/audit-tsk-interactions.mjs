#!/usr/bin/env node
// 八循环《绯红密钥》（TSK）P4 交互与界面审计账本。
//
//   node tools/audit-tsk-interactions.mjs --write   生成 audit/tsk-interactions.json（镜像 artifacts/migration/tsk/interactions.json）
//   node tools/audit-tsk-interactions.mjs --check   复算并与磁盘逐字节比对（证据漂移即失败，且要求 status=verified）
//   node tools/audit-tsk-interactions.mjs           打印 JSON（report 模式，不写盘；门禁失败时抛错）
//
// 口径：本工具只**现场复算**证据，不复制冻结结论——
//   · 覆盖矩阵 = audit/tsk-interactions-browser.json 的用例标题（`P4 desktop|mobile` 前缀 + 中文标记），
//     桌面与移动两个视口各自独立判定，任一缺项即 pending；
//   · 门禁 = Node 验收账本、浏览器账本来源稳定（逐文件 SHA-256）、脚本归属（script-actions-tfa）、
//     指南入口/失败重试与键盘（scenario-guides）、基线 replay 夹具 SHA-256、
//     fast 无新增失败（P0 冻结的既有失败不计入 P4，只要求 additionsSinceInitialBaseline 为空）、
//     replay 精确一致；全部读自 audit/ 账本，不手填状态；
//   · 交付原语 = 6 个交互相关原语，只有两视口覆盖全真才声明（P4 复用 P2 已交付原语，不重复实现）；
//   · 确定性：无时间戳、无绝对路径、sources 按路径排序；`--check` 逐字节复算。
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { MOD, emit, readJson, sha } from './tsk-migration-lib.mjs'

const DOCS = 'docs/campaign/theScarletKeys/interactions.md'

// 覆盖矩阵：6 组交互 × 2 视口。浏览器用例标题固定为 `P4 ${viewport} ${中文标记}…`。
const INTERACTION_GROUPS = Object.freeze([
  ['concealed', '隐匿迷你卡'],
  ['keys', '绯红密钥'],
  ['hollow', '空洞回收'],
  ['map', '世界地图'],
  ['customizable', '定制升级'],
  ['crossSeat', '跨座位即时行动'],
])
// 由 P4 浏览器交互用例交付的「P2 原语 × 交互层」；覆盖全真才进入 deliveredPrimitives。
const DELIVERED_PRIMITIVES = Object.freeze([
  ['concealed', 'new.concealedExpose'],
  ['keys', 'new.keyShift'],
  ['hollow', 'new.hollowRecall'],
  ['map', 'new.embarkChoice'],
  ['customizable', 'new.customizationUpgrade'],
  ['crossSeat', 'new.crossSeatAction'],
])
// 界面层复用 P2 原语与投影：P4 只新增交互事务/投影/面板，不重复实现引擎原语。
const EXTERNAL_PRIMITIVES = Object.freeze({
  projection: 'new.concealedIdentityProjection',
  hiddenInfo: 'extend.hiddenInfo',
  choices: 'extend.choices',
})
const SOURCE_PATHS = Object.freeze([
  'audit/tsk-interactions-browser.json',
  'audit/tsk-node-acceptance.json',
  'audit/tsk-regression.json',
  'src/engine/tsk-interactions.js',
  'src/integration/mechanic-view.js',
  'tests/tsk-interaction-fixture.mjs',
  'tests/tsk-interactions.browser.mjs',
  'tests/tsk-interactions.test.mjs',
  'web/mechanic-ui.js',
])
const EVIDENCE = Object.freeze([
  'audit/tsk-baseline.json',
  'audit/tsk-interactions-browser.json',
  'audit/tsk-node-acceptance.json',
  'audit/tsk-regression.json',
  'src/engine/tsk-interactions.js',
  'src/integration/mechanic-view.js',
  'tests/tsk-interaction-fixture.mjs',
  'tests/tsk-interactions.browser.mjs',
  'web/mechanic-ui.js',
])

const byCodePoint = (left, right) => (left < right ? -1 : left > right ? 1 : 0)
const readOptional = path => (existsSync(join(MOD, path)) ? readJson(join(MOD, path)) : null)
const fileSha = path => (existsSync(join(MOD, path)) ? sha(readFileSync(join(MOD, path))) : null)

export function buildInteractionAudit() {
  const browser = readOptional('audit/tsk-interactions-browser.json')
  const node = readOptional('audit/tsk-node-acceptance.json')
  const regression = readOptional('audit/tsk-regression.json')
  const baseline = readOptional('audit/tsk-baseline.json')
  const tests = Array.isArray(browser?.tests) ? browser.tests : []

  // 用例判定只认「passed + 指定文件 + 标题判据」；缺失账本时全部为 false（不伪造完成）。
  const passedTest = (fileSuffix, predicate) => tests.some(row =>
    row?.status === 'passed' && String(row.file || '').endsWith(fileSuffix) && predicate(row))
  const interactionPassed = (viewport, marker) => passedTest('tsk-interactions.browser.mjs', row => {
    const title = String(row.title || '')
    return title.startsWith(`P4 ${viewport} `) && title.includes(marker)
  })

  const coverage = Object.fromEntries(['desktop', 'mobile'].map(viewport => [viewport,
    Object.fromEntries(INTERACTION_GROUPS.map(([id, marker]) => [id, interactionPassed(viewport, marker)]))]))
  const allCoverage = Object.values(coverage).every(groups => Object.values(groups).every(Boolean))

  const sources = SOURCE_PATHS
    .map(path => ({ path, sha256: fileSha(path) }))
    .sort((left, right) => byCodePoint(left.path, right.path))
  // audit/tsk-baseline.json#fastFailures 是冻结的失败标题；P4 只要求标题集合不新增。
  const frozenFailures = [...(baseline?.fastFailures || [])].sort()
  const fastAdditions = Array.isArray(regression?.fast?.additionsSinceInitialBaseline)
    ? regression.fast.additionsSinceInitialBaseline : null
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
    baselineUnchanged: Boolean(baseline?.replaySha256) && baseline.replaySha256 === (baseline?.replayFile ? fileSha(baseline.replayFile) : null),
    // P0 已把既有失败冻结进 audit/tsk-baseline.json#fastFailures；P4 只要求「无新增失败」。
    fastNoNewFailures: Boolean(regression?.fast) && regression.status === 'passed'
      && Array.isArray(fastAdditions) && fastAdditions.length === 0
      && Array.isArray(regression.fast.titles)
      && regression.fast.titles.length === frozenFailures.length,
    replayExact: Boolean(regression?.replay) && regression.replay.exitCode === 0 && regression.replay.matches === true,
  }
  const status = Object.values(checks).every(Boolean) && allCoverage ? 'verified' : 'pending'
  // 6 个交互原语是整体声明：两视口 6 组覆盖全真才交付，否则为空（不按组零散交付）。
  const deliveredPrimitives = DELIVERED_PRIMITIVES
    .every(([group]) => coverage.desktop[group] && coverage.mobile[group])
    ? DELIVERED_PRIMITIVES.map(([, id]) => id) : []

  return {
    schemaVersion: 1,
    cycle: 'tsk',
    campaignId: 'theScarletKeys',
    milestone: 'P4',
    step: 'P4 新增交互与界面',
    generatedBy: 'tools/audit-tsk-interactions.mjs',
    docs: DOCS,
    status,
    coverage,
    checks,
    gates: checks,
    // 透明列出 P0 冻结的既有失败：它们不进入 P4 新增失败口径，也不由本账本认证修复。
    frozenFailures,
    deliveredPrimitives,
    extensions: { ...EXTERNAL_PRIMITIVES },
    browser: {
      present: Boolean(browser),
      status: browser?.status || null,
      specs: Array.isArray(browser?.specs) ? [...browser.specs].sort(byCodePoint) : [],
      tests: tests.length,
      passed: tests.filter(row => row?.status === 'passed').length,
      screenshots: Array.isArray(browser?.screenshots) ? browser.screenshots.length : 0,
    },
    contract: {
      actions: 'Only server legalMoves and requestChoice/selectMechanic; no browser-side rule checks or arbitrary client mechanics commands.',
      privacy: 'Concealed mini-card identities are projected only after a legal reveal (position/count only otherwise); dossiers are projected as unlocked/read keys without contents; otherworld deck order is never projected; cross-seat grants and customization checks are visible to the owning seat only; snapshots are masked again per observer.',
      cancellation: 'Optional choices can be cancelled before any mechanics write; mandatory choices have no cancel. Printed action/card costs remain governed by their descriptor.',
      guide: 'The fixed setup/reference entry is reused. Full ten-chapter TSK scenario guides remain P7.',
      release: 'The seed/fixture is test-only and confined to tools/tests. P4 opens no content: the campaign, investigators and player cards remain catalog-only.',
      fast: 'The pre-existing failures frozen in audit/tsk-baseline.json#fastFailures are excluded from the P4 ledger; P4 only requires no new failures.',
    },
    evidence: [...EVIDENCE],
    sources,
  }
}

const isCli = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isCli) {
  const report = buildInteractionAudit()
  const failed = Object.entries(report.gates).filter(([, value]) => value !== true).map(([key]) => key)
  if (process.argv.includes('--check') && report.status !== 'verified') {
    console.error(`tsk interactions: 复算状态为 ${report.status}，未达 verified（浏览器/Node/回归证据未齐）：${failed.join('、')}`)
  }
  if (process.argv.includes('--write') || process.argv.includes('--check')) {
    emit('interactions', report)
    const path = join(MOD, 'audit/tsk-interactions.json')
    const disk = existsSync(path) ? readJson(path) : null
    if (process.argv.includes('--check') && JSON.stringify(disk) !== JSON.stringify(report)) {
      throw new Error('audit/tsk-interactions.json 与复算结果不一致；审阅证据后显式 --write')
    }
    console.log(`tsk interactions: ${report.status}（覆盖 ${Object.keys(report.coverage.desktop).length} 组 × 2 视口：${JSON.stringify(report.coverage)}）`)
  } else {
    console.log(JSON.stringify(report, null, 2))
  }
  if (failed.length) throw new Error(`tsk interactions 门禁失败：${failed.join('、')}`)
}
