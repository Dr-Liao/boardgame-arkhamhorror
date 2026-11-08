#!/usr/bin/env node
// 七循环《地球边缘》（Edge of the Earth）P4 交互与界面审计账本。
//
//   node tools/audit-eote-interactions.mjs --write   生成 audit/eote-interactions.json（镜像 artifacts/migration/eote/interactions.json）
//   node tools/audit-eote-interactions.mjs --check   复算并与磁盘逐字节比对（证据漂移即失败，且要求 status=verified）
//   node tools/audit-eote-interactions.mjs           打印 JSON（report 模式，不写盘；门禁失败时抛错）
//
// 口径：本工具只**现场复算**证据，不复制任何冻结结论——
//   · 覆盖矩阵 = audit/eote-interactions-browser.json 的用例标题（`P4 desktop|mobile` 前缀 + 中文标记），
//     桌面与移动两个视口各自独立判定，任一缺项即 pending；
//   · 门禁 = Node 验收账本、浏览器账本来源稳定（逐文件 SHA-256）、脚本归属（script-actions-tfa）、
//     指南入口/失败重试与键盘（scenario-guides）、基线 replay 夹具 SHA-256、
//     fast 无新增失败（P0 冻结的既有失败不计入 P4，只要求 additionsSinceInitialBaseline 为空）、
//     replay 精确一致，全部读自 audit/ 账本，不手填状态；
//   · 交付原语 = 5 个 interaction.*，只有两视口覆盖全真才声明（供 tools/audit-eote-primitives.mjs 回填 done）；
//     crossSeat / discipline / supply 是 P4 界面层复用 P2 原语，登记在 extensions，不重复算作交互原语；
//   · 确定性：无时间戳、无绝对路径、sources 按路径排序；`--check` 逐字节复算。
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { MOD, emit, readJson, sha } from './eote-migration-lib.mjs'

const CYCLE = 'eote'
const DOCS = 'docs/edgeOfTheEarth/interactions.md'

// 覆盖矩阵：8 组交互 × 2 视口。浏览器用例标题固定为 `P4 ${viewport} ${中文标记}…`。
const INTERACTION_GROUPS = Object.freeze([
  ['frost', '寒霜连续揭示'],
  ['partners', '伙伴选派'],
  ['seals', '封印放置'],
  ['tekeli', '忒咳哩-哩洗入'],
  ['deckTop', '牌库顶揭示'],
  ['crossSeat', '跨座位代打'],
  ['supply', '物资指派'],
  ['discipline', '演武选择'],
])
// 由 P4 浏览器交互用例交付的 interaction.* 原语；覆盖全真才进入 deliveredPrimitives。
const DELIVERED_PRIMITIVES = Object.freeze([
  ['frost', 'interaction.frostReveal'],
  ['partners', 'interaction.partnerSetup'],
  ['seals', 'interaction.sealPlacement'],
  ['tekeli', 'interaction.tekeliShuffle'],
  ['deckTop', 'interaction.deckTopReveal'],
])
// 界面层复用 P2 原语：P4 只新增交互与投影，不重复实现引擎原语。
const EXTERNAL_PRIMITIVES = Object.freeze({
  crossSeat: 'investigator.crossSeatPlay',
  discipline: 'investigator.discipline',
  supply: 'campaign.supplies',
})
// sourceStable：证据账本 + 引擎事务/投影/UI + 浏览器用例与夹具，逐文件锁 SHA-256。
const SOURCE_PATHS = Object.freeze([
  'audit/eote-interactions-browser.json',
  'audit/eote-node-acceptance.json',
  'audit/eote-regression.json',
  'src/engine/eote-interactions.js',
  'src/integration/mechanic-view.js',
  'tests/eote-interaction-fixture.mjs',
  'tests/eote-interactions.browser.mjs',
  'web/mechanic-ui.js',
])
const EVIDENCE = Object.freeze([
  'audit/eote-baseline.json',
  'audit/eote-interactions-browser.json',
  'audit/eote-node-acceptance.json',
  'audit/eote-regression.json',
  'src/engine/eote-interactions.js',
  'src/integration/mechanic-view.js',
  'tests/eote-interaction-fixture.mjs',
  'tests/eote-interactions.browser.mjs',
  'web/mechanic-ui.js',
])

// 纯代码点比较，避免 ICU 差异影响账本排序。
const byCodePoint = (left, right) => (left < right ? -1 : left > right ? 1 : 0)
const readOptional = path => (existsSync(join(MOD, path)) ? readJson(join(MOD, path)) : null)
const fileSha = path => (existsSync(join(MOD, path)) ? sha(readFileSync(join(MOD, path))) : null)

export function buildInteractionAudit() {
  const browser = readOptional('audit/eote-interactions-browser.json')
  const node = readOptional('audit/eote-node-acceptance.json')
  const regression = readOptional('audit/eote-regression.json')
  const baseline = readOptional('audit/eote-baseline.json')
  const tests = Array.isArray(browser?.tests) ? browser.tests : []

  // 用例判定只认「passed + 指定文件 + 标题判据」；缺失账本时全部为 false（不伪造完成）。
  const passedTest = (fileSuffix, predicate) => tests.some(row =>
    row?.status === 'passed' && String(row.file || '').endsWith(fileSuffix) && predicate(row))
  const interactionPassed = (viewport, marker) => passedTest('eote-interactions.browser.mjs', row => {
    const title = String(row.title || '')
    return title.startsWith(`P4 ${viewport} `) && title.includes(marker)
  })

  const coverage = Object.fromEntries(['desktop', 'mobile'].map(viewport => [viewport,
    Object.fromEntries(INTERACTION_GROUPS.map(([id, marker]) => [id, interactionPassed(viewport, marker)]))]))
  const allCoverage = Object.values(coverage).every(groups => Object.values(groups).every(Boolean))

  const sources = SOURCE_PATHS
    .map(path => ({ path, sha256: fileSha(path) }))
    .sort((left, right) => byCodePoint(left.path, right.path))
  const replayFile = baseline?.replayFile || null
  const replayFixtureSha = replayFile ? fileSha(replayFile) : null

  const checks = {
    nodeAcceptance: node?.status === 'passed',
    sourceStable: sources.every(source => /^[0-9a-f]{64}$/.test(String(source.sha256))),
    desktopAndMobile: allCoverage,
    scriptOwnership: ['desktop', 'mobile'].every(viewport => passedTest('script-actions-tfa.browser.mjs',
      row => String(row.title || '').toLowerCase().includes(viewport))),
    guidePlacementAndPrivacy: passedTest('scenario-guides.browser.mjs',
      row => String(row.title || '').includes('完整指南按需加载')),
    guideFailureRetryAndKeyboard: passedTest('scenario-guides.browser.mjs',
      row => String(row.title || '').includes('指南加载失败')),
    baselineUnchanged: Boolean(baseline?.replaySha256) && baseline.replaySha256 === replayFixtureSha,
    // P0 已把 3 条既有失败冻结进 audit/eote-baseline.json#fastFailures；P4 只要求「无新增失败」，
    // 不要求 test:fast 真零失败（失败数必须恰好等于冻结清单数量，发现新增或替换即失败）。
    fastNoNewFailures: Boolean(regression?.fast) && regression.status === 'passed'
      && regression.fast.exitCode !== undefined
      && Array.isArray(regression.fast.additionsSinceInitialBaseline)
      && regression.fast.additionsSinceInitialBaseline.length === 0
      && Array.isArray(regression.fast.failures)
      && regression.fast.failures.length === (baseline?.fastFailures || []).length,
    replayExact: Boolean(regression?.replay) && regression.replay.exitCode === 0
      && regression.replay.matches === true,
  }
  const status = Object.values(checks).every(Boolean) && allCoverage ? 'verified' : 'pending'
  // 5 个交互原语是整体声明：两视口 5 组覆盖全真才交付，否则为空（不按组零散交付）。
  const deliveredPrimitives = DELIVERED_PRIMITIVES
    .every(([group]) => coverage.desktop[group] && coverage.mobile[group])
    ? DELIVERED_PRIMITIVES.map(([, id]) => id) : []

  return {
    schemaVersion: 1,
    cycle: CYCLE,
    campaignId: 'edgeOfTheEarth',
    milestone: 'P4',
    step: 'P4 新增交互与界面',
    generatedBy: 'tools/audit-eote-interactions.mjs',
    docs: DOCS,
    status,
    coverage,
    checks,
    gates: checks,
    // 透明列出 P0 冻结的既有失败：它们不进入 P4 新增失败口径，也不由本账本认证修复。
    frozenFailures: Array.isArray(baseline?.fastFailures) ? [...baseline.fastFailures] : [],
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
      privacy: 'Deck-top cards are projected to the owner only; cross-seat play only to the grantee; Tekeli-li is projected as a count only; unrevealed cityscape sites are omitted; camp missing-partner draws are not projected.',
      cancellation: 'Optional choices can be cancelled before any mechanics write; mandatory choices have no cancel. Printed action/card costs remain governed by their descriptor.',
      guide: 'The fixed setup/reference entry is reused. Full eight-chapter EotE scenario guides remain P7.',
      release: 'The seed/fixture is test-only and confined to tools/tests. P4 opens no content: the campaign, investigators and player cards remain catalog-only.',
      fast: 'The three pre-existing failures frozen in audit/eote-baseline.json#fastFailures are excluded from the P4 ledger; P4 only requires no new failures (additionsSinceInitialBaseline is empty and the failure count equals the frozen baseline).',
    },
    evidence: [...EVIDENCE],
    sources,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = buildInteractionAudit()
  // --check 的口径是「复算一致 + 状态 verified」；emit() 会做逐字节比对与门禁抛错，这里先显式说明状态。
  if (process.argv.includes('--check') && report.status !== 'verified') {
    console.error(`eote interactions: 复算状态为 ${report.status}，未达 verified（浏览器/Node/回归证据未齐）`)
  }
  emit('interactions', report)
}
