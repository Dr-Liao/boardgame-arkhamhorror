import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { getAvailability } from '../src/deck/availability.js'
import { contentRegistry } from '../content/registered.js'
import { campaignListForUi } from '../content/registry.js'
import { SCENARIO_MIGRATION_CHECKS, assertMigrationConfirmations } from '../content/migration-confirmation.js'
import { mod, sha, sorted, writeOrCheck } from './scan-tdc-scope.mjs'
import { browserSources, hallRoot, sha256 } from './tdc-p8-evidence.mjs'

const read = name => JSON.parse(readFileSync(join(mod, `audit/tdc-${name}.json`), 'utf8'))
const scope = read('scope')
const scan = read('mechanism-scan')
const baseline = read('baseline')
const rules = read('rules')
const interactions = read('interactions')
const investigators = read('investigators')
const player = read('player')
const p7 = read('p7')
const auditPath = name => `audit/tdc-${name}.json`
const readOptional = name => existsSync(join(mod, auditPath(name))) ? read(name) : null
const browserReport = readOptional('release-browser')
const regression = readOptional('p8-regression')
const viewports = ['desktop', 'mobile']
const evidenceMatches = ({ report, file, sha256: expected }) => {
  const path = file ?? report
  return typeof path === 'string' && path.startsWith('artifacts/migration/tdc/p8/')
    && existsSync(join(hallRoot, path)) && sha256(readFileSync(join(hallRoot, path))) === expected
}
const validBrowser = browserReport?.schemaVersion === 1 && browserReport.campaignId === scope.campaignId
  && browserReport.candidate === false && Array.isArray(browserReport.rows)
  && Object.keys(browserReport.sources || {}).length > 0
  && sha256(JSON.stringify(browserReport.sources)) === sha256(JSON.stringify(browserSources(scope.scenarios)))
  && browserReport.rows.every(row => row.screenshot && evidenceMatches(row.screenshot))
const browserRows = validBrowser ? browserReport.rows : []
const browserPassed = (kind, viewport, predicate = () => true) =>
  browserRows.filter(row => row.kind === kind && row.viewport === viewport && predicate(row)).length === 1
const validRegression = regression?.schemaVersion === 1 && regression.status === 'passed'
  && regression.newFailures?.length === 0 && regression.results?.full?.counts?.cancelled === 0
  && evidenceMatches(regression.before)
  && ['playerIndex', 'encounterIndex', 'compliance', 'story', 'guides', 'guideCoverage', 'presentation', 'docs', 'replay', 'campaign', 'full']
    .every(key => regression.results[key] && (key === 'full' || regression.results[key].exitCode === 0)
      && evidenceMatches(regression.results[key]))
  && regression.results.full.counts.failures.every(title => regression.before.failures.includes(title))
// P7 内容批次：逐章验收账本（tools/audit-tdc-scenarios.mjs 生成）。缺失时按「未交付」处理，
// 确认项保持 false，不会因为账本缺失而放宽门禁。
const p7ScenarioLedgerPath = join(mod, 'audit/tdc-p7-scenarios.json')
const p7Scenarios = existsSync(p7ScenarioLedgerPath)
  ? JSON.parse(readFileSync(p7ScenarioLedgerPath, 'utf8'))
  : null
const p7Chapter = id => p7Scenarios?.scenarios?.find(row => row.id === id) || null
// 第二轮（2026-11-20）：逐卡 literal 账本由各 worker 生成到
// artifacts/migration/tdc/p7/literal/<chapterId>.json；approximation/notImplemented/evidenceMissing
// 全为 0 且条目覆盖本章 cardCount 才算 literalCardBehavior 完成（严格口径，不靠 note 美化）。
const p7LiteralPath = id => join(mod, '../../artifacts/migration/tdc/p7/literal', `${id}.json`)
let p7LiteralCache = null
const p7Literal = id => {
  p7LiteralCache ||= new Map()
  if (!p7LiteralCache.has(id)) {
    const path = p7LiteralPath(id)
    try {
      p7LiteralCache.set(id, existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null)
    } catch { p7LiteralCache.set(id, null) }
  }
  return p7LiteralCache.get(id)
}
const tdcStoryText = 'content/campaigns/theDrownedCity/story-text.js'
const tdcStoryReady = existsSync(join(mod, tdcStoryText))
const tdcStoryComplete = tdcStoryReady && p7.counts.bilingualGuides === p7.counts.scenarios
const tdcWorkerReport = id => `artifacts/migration/tdc/p7/workers/scenario-${
  { oneLastJob: 'alpha', theWesternWall: 'alpha', theDrownedQuarter: 'beta', theApiary: 'beta',
    theGrandVault: 'gamma', courtOfTheAncients: 'gamma', obsidianCanyons: 'delta',
    sepulchreOfTheSleeper: 'delta', theDoomOfArkhamPartI: 'epsilon', theDoomOfArkhamPartII: 'epsilon' }[id] || 'unknown'}.md`
// 每章的 Node、存档、逐卡行为与双端浏览器证据独立判定。
function contentCheck(id, check) {
  const row = p7Chapter(id)
  const contentReady = Boolean(row?.checks?.moduleLoaded && row?.checks?.manifestComplete && row?.checks?.registered)
  switch (check) {
    case 'sourceLocked': return true
    case 'identityRegistered': return registeredOwners.get(id) === scope.campaignId
      && p7.scenarios.some(candidate => candidate.id === id && candidate.definition === 'registered')
    case 'setupAndZones': return Boolean(row?.checks?.cardEntries && row?.checks?.tests)
    case 'actsAndAgendas': return contentReady && Boolean(row?.checks?.tests)
    case 'locationsAndConnections': return contentReady && Boolean(row?.checks?.tests)
    case 'encounterBehaviors': return Boolean(row?.checks?.cardEntries && row?.checks?.behaviorFile)
    case 'chaosEffects': return Boolean(row?.checks?.chaosFile && row?.checks?.tests)
    case 'resolutionsAndRecords': return contentReady && Boolean(row?.checks?.tests)
    case 'storyText': return tdcStoryComplete && Boolean(row?.checks?.guide)
    // 真实 saveSnapshot/readSnapshot 存档重放：章节测试里必须有该用例（标题可核对）。
    case 'saveReplay': {
      const titles = row?.tests?.titles || []
      return Boolean(row?.checks?.tests)
        && titles.some(title => /saveSnapshot|存档重放|存档\/重放/.test(title))
    }
    // 逐卡印刷行为：literal 账本必须存在且严格零近似/零未实现/零缺证据。
    case 'literalCardBehavior': {
      const literal = p7Literal(id)
      const summary = literal?.summary || null
      if (!summary) return false
      const covered = Number(summary.total) >= Number(row?.cardCount || 0)
      return Boolean(row?.checks?.cardEntries) && covered
        && summary.approximation === 0 && summary.notImplemented === 0 && summary.evidenceMissing === 0
    }
    case 'browserAcceptance': return viewports.every(viewport => browserPassed('chapter', viewport,
      row => row.id === id && row.code === scope.scenarios.find(chapter => chapter.id === id)?.code))
    default: return false
  }
}
const docs = 'docs/campaign/theDrownedCity/primitives.md'
const test = 'tests/tdc-primitives.test.mjs'

const reuseContracts = {
  flood: ['mechanics.flood', '地点三级淹没、增减、上限和翻开时应用', 'tests/tic-primitives.test.mjs'],
  chaosSeal: ['sealChaosToken / releaseChaosTokens', '按实物来源密封与归还', 'tests/tic-primitives.test.mjs'],
  attachments: ['attachCardTo / playChannels', '按宿主承载、以合法通道打出或投入', 'tests/play-channels.test.mjs'],
  campaignRecords: ['campaignRecord / setCampaignRecord / recordSets', '跨章值、集合、奖励领取', 'tests/tcu-primitives-campaign-records.test.mjs'],
  glyphs: ['mechanics.recordSets', '按标识保存去重集合；字形组由内容声明', 'tests/tic-primitives.test.mjs'],
  skillTests: ['performTest / descriptor windows', '行动、技能、成功与失败分支', 'tests/tic-primitives.test.mjs'],
  cardZones: ['deckOps / playChannels', '牌库、弃牌区及受限卡牌来源', 'tests/play-channels.test.mjs'],
  enemyActions: ['enemy functions', '单体敌人的生成、交战、攻击与移动', 'tests/fhv-primitives.test.mjs'],
  economy: ['cost / use-transfer', '逐来源的费用及用途', 'tests/tic-primitives.test.mjs'],
  harmAndClues: ['assignHarm / clue API', '来源、承伤区和线索归属', 'tests/fhv-primitives.test.mjs'],
  modifiers: ['modifiers / effectState', '实体、目标与时间约束', 'tests/fhv-primitives.test.mjs'],
  timedEffects: ['ability registration / effectState', '声明式窗口、持续期与限次', 'tests/tic-primitives.test.mjs'],
  slots: ['canEquip / asset rules', '装备槽位和合法替换', 'tests/fhv-primitives.test.mjs'],
  physicalFace: ['flipAsset / flipEnemy', '同实体的同类换面；跨类型调查员转换单列', 'tests/tic-physical-faces.test.mjs'],
}

const contracts = {
  tasks: {
    api: ['mechanics.progress.claim(track, seat, option)', 'mechanics.progress.forSeat(track, seat)', 'mechanics.progress.change(track, seat, amount, receipt?)'],
    state: 'campaign.progressTracks', window: '内容调用的分配或结算窗口', target: '有效调查员座位及未被领取的选项',
    readPoints: ['src/campaign/progress-tracks.js', 'src/engine/api-mechanics.js', 'src/campaign/campaign.js'],
    validation: ['src/campaign/progress-tracks.js#validateProgressTracks', 'src/engine/save-migration.js#migrateState'],
    tests: [test], status: 'implemented',
  },
  handoff: {
    api: ["transferOnControllerDefeat: 'nearest'"], state: 'investigators[].assets',
    window: '调查员败退处理', target: '离败退地点最近且尚在场的调查员',
    validation: ['src/engine/ability.js#registerCardAbilities', 'src/engine/harm-threat.js#eliminateInvestigator'],
    tests: [test], status: 'implemented',
  },
  topology: {
    api: ["mechanics.map.configure({ adjacency: 'rows' })", 'mechanics.map.relocate(cells)'],
    state: 'scenarioFlags.mechanics.gridAdjacency / grid / locations[].connections', window: '设置及带位置变化的场景效果',
    target: '现有格子与相邻整行', validation: ['src/engine/grid-map.js#configureGrid', 'src/engine/mechanic-state.js#validateMechanicState'],
    tests: [test], status: 'implemented',
  },
  separateDeck: {
    api: ["mechanics.scenarioDecks.take(id, count, { from: 'bottom' })", 'mechanics.scenarioDecks.discard(id, code, { recycleWhenEmpty: true })'],
    state: 'scenarioFlags.mechanics.scenarioDecks', window: '设置、定向取牌及独立结算后',
    target: '已初始化的剧本牌库', validation: ['src/engine/scenario-decks.js#createScenarioDeckApi', 'src/engine/mechanic-state.js#validateMechanicState'],
    tests: [test], status: 'implemented',
  },
  multipartEnemy: {
    api: ['scenarioRuntime.linkEnemyParts(bodyId, partIds)'],
    state: 'enemies[].hasParts / enemies[].partOf', window: '设置、战斗与躲避、敌人阶段攻击、翻面和离场',
    target: '在场主体与其部位。战斗和躲避直接选部位，移步与交战按主体统一结算。',
    readPoints: ['src/engine/enemy-parts.js', 'src/engine/targets.js', 'src/engine/moves.js', 'src/engine/combat.js', 'src/engine/enemies.js'],
    validation: ['src/engine/enemy-parts.js#linkEnemyParts', 'src/engine/enemy-parts.js#validateEnemyParts', 'src/engine/save-migration.js#migrateState'],
    tests: [test], status: 'implemented',
  },
}

const ownerCodes = Object.values(scope.partitions).flat()
assert.deepEqual(sorted(ownerCodes), scope.codes, '范围分区遗漏或重叠')
assert.deepEqual(scan.cardRows.map(card => card.code), scope.codes, '机制扫描有卡号遗漏或重复')
assert.equal(scan.scopeSha256, sha(JSON.stringify(scope)), '范围与机制扫描的 SHA-256 漂移')
assert.equal(scan.coverage.unclassified.length, 0)
const launchEnabled = campaignListForUi(contentRegistry).some(campaign => campaign.id === scope.campaignId)
const releasedInvestigatorCards = new Set([...scope.partitions.investigators, ...scope.partitions.signatures])
const releasedPlayerCards = new Set(player.cards.filter(card => card.status === 'verified').map(card => card.code))
assert(scope.codes.every(code => ALL_CARDS[code]?.availability === 'catalog-only'
  && getAvailability(code).availability === (releasedPlayerCards.has(code)
    || (releasedInvestigatorCards.has(code) && investigators.status === 'verified') ? 'strict' : 'catalog-only')))
const registeredOwners = new Map(contentRegistry.listScenarios().map(entry => [entry.id, entry.campaignId]))
assert(scope.scenarios.every(({ id }) => (registeredOwners.get(id) ?? scope.campaignId) === scope.campaignId),
  'TDC 剧本 ID 已被其他战役占用')

const reuse = []
const newPrimitives = []
for (const mechanism of scan.mechanisms.filter(entry => entry.type === 'primitive')) {
  const { id, cards, disposition, readPoints, source } = mechanism
  const shared = { id, cards, readPoints, source, docs }
  if (disposition === 'reuse') {
    assert(reuseContracts[id], `复用原语缺合同 ${id}`)
    const [api, contract, evidence] = reuseContracts[id]
    reuse.push({ ...shared, api, contract, tests: [evidence] })
  } else {
    assert.equal(disposition, 'new')
    assert(contracts[id], `新增原语缺合同 ${id}`)
    newPrimitives.push({ ...shared, ...contracts[id] })
  }
}
for (const primitive of [...reuse, ...newPrimitives]) {
  for (const file of [...primitive.tests, ...primitive.readPoints]) assert(existsSync(join(mod, file)), file)
}
const plan = { schemaVersion: 1, scope: 'audit/tdc-scope.json', scan: 'audit/tdc-mechanism-scan.json', reuse,
  new: newPrimitives, escape: [] }
const catalog = { schemaVersion: 1, plan: 'audit/tdc-primitive-plan.json', primitives: [...reuse, ...newPrimitives.filter(entry => entry.status === 'implemented')]
  .map(({ id, api, readPoints, tests, docs: evidence }) => ({ id, api, readPoints, tests, docs: evidence })) }
const pending = newPrimitives.filter(entry => entry.status === 'pending').map(entry => entry.id)
const strictReplay = baseline.replay.metadataRecovery?.verified === true || baseline.replay.strictControlPass === true
const pendingDecisions = scan.decisions.filter(entry => entry.status).map(entry => entry.id)
const closureFast = baseline.p2Closure?.fast
const fastNoNewFailures = closureFast
  ? closureFast.newFailures.length === 0 && closureFast.cancelled <= baseline.fast.cancelled
  : null
const rulesEvidence = ['audit/tdc-rules.json', rules.web, rules.tests.node, rules.tests.browser]
const keywordItems = rules.keywords.map(keyword => {
  const checks = { sourceInventoried: keyword.printedCards.length > 0, engineBehavior: keyword.engine.every(file => existsSync(join(mod, file))),
    nodeAcceptance: rules.acceptance.nodePassed > 0, rulebookEntry: rules.topics.some(topic => topic.id === keyword.id),
    cardLinks: rules.topics.some(topic => topic.id === keyword.id && topic.linkedCards >= keyword.printedCards.length) }
  return { id: keyword.id, status: Object.values(checks).every(Boolean) ? 'verified' : 'pending',
    checks, evidence: [...rulesEvidence, ...keyword.sources, ...keyword.engine] }
})
const rulebookChecks = {
  campaignOverview: rules.topics.some(topic => topic.id === 'tdcCampaign'),
  scenarioMechanics: ['tdcFlood', 'tdcTasks', 'tdcArtifacts', 'tdcGlyphs', 'tdcConnections', 'tdcEnemyParts', 'tdcSideDecks']
    .every(id => rules.topics.some(topic => topic.id === id)),
  keywordEntries: keywordItems.every(item => item.checks.rulebookEntry),
  cardLinks: rules.topics.every(topic => topic.linkedCards > 0),
  desktopBrowser: rules.acceptance.browserCases.filter(name => name.startsWith('P3 desktop ')).length === 3,
  mobileBrowser: rules.acceptance.browserCases.filter(name => name.startsWith('P3 mobile ')).length === 3,
}
const keywordsVerified = keywordItems.every(item => item.status === 'verified')
const rulebookVerified = Object.values(rulebookChecks).every(Boolean)
const rulesFastPassed = rules.acceptance.fast?.failed === 0 && rules.acceptance.fast.cancelled === 0
const scenarioItems = scope.scenarios.map(({ id }) => {
  const checks = Object.fromEntries(SCENARIO_MIGRATION_CHECKS.map(check => [check, contentCheck(id, check)]))
  return { id, checks, status: Object.values(checks).every(Boolean) ? 'verified' : 'pending',
    evidence: [`tests/tdc-scenario-${id}.test.mjs`, 'audit/tdc-p7-scenarios.json', `content/scenario-guide-sources/${id}.json`,
      tdcWorkerReport(id), 'audit/tdc-p7.json', 'audit/tdc-scope.json',
      ...(checks.browserAcceptance ? [auditPath('release-browser'), ...browserRows.filter(row => row.id === id)
        .map(row => row.screenshot.file)] : [])] }
})
const scenariosVerified = scenarioItems.every(item => item.status === 'verified')
const remaining = ['shared', 'campaign'].flatMap(id => (p7Literal(id)?.entries || []).filter(row => row.approximation)
  .map(row => ({ id: row.code || row.id, scope: id, status: 'disclosed',
    detail: row.judgement || row.note, evidence: [row.file, `artifacts/migration/tdc/p7/literal/${id}.json`] })))
const required = {
  chapters: scenariosVerified,
  routes: browserPassed('route', 'desktop', row => row.direction === 'west' && row.outcome === 'victory')
    && browserPassed('route', 'mobile', row => row.direction === 'east' && row.outcome === 'defeat'),
  multiplayerAiAndSave: viewports.every(viewport => ['online', 'ai', 'save'].every(kind => browserPassed(kind, viewport))),
  regression: Boolean(validRegression),
  disclosed: ['shared', 'campaign'].every(id => {
    const summary = p7Literal(id)?.summary
    return summary?.notImplemented === 0 && summary.evidenceMissing === 0
      && remaining.filter(row => row.scope === id && row.id && row.detail && row.evidence.every(Boolean)).length === summary.approximation
  }),
  keywordsAndRulebook: keywordsVerified && rulebookVerified,
}
const releaseComplete = Object.values(required).every(Boolean)
assert.equal(launchEnabled, releaseComplete, `TDC 大厅状态与 P8 门禁不一致：${JSON.stringify(required)}`)
const migration = {
  schemaVersion: 1, campaignId: scope.campaignId, status: releaseComplete ? 'verified' : 'development',
  playable: launchEnabled, earlyAccess: false, equivalenceCertified: releaseComplete && remaining.length === 0,
  releaseAcceptance: { status: releaseComplete ? 'complete' : 'pending', required, deferred: [],
    browser: auditPath('release-browser'), regression: auditPath('p8-regression') },
  remaining,
  stages: {
    P0: { status: strictReplay ? 'verified' : 'baseline-recorded', scope: 'audit/tdc-scope.json', baseline: 'audit/tdc-baseline.json',
      replayBaselineVerified: strictReplay },
    P1: { status: pendingDecisions.length ? 'review-in-progress' : 'verified', scan: 'audit/tdc-mechanism-scan.json',
      coverage: scan.coverage, pendingDecisions },
    P2: { status: strictReplay && !pending.length && fastNoNewFailures ? 'verified' : 'implementation-in-progress',
      plan: 'audit/tdc-primitive-plan.json', catalog: 'audit/tdc-primitive-catalog.json',
      implemented: newPrimitives.filter(entry => entry.status === 'implemented').map(entry => entry.id), pending, fastNoNewFailures },
    P3: { status: keywordsVerified && rulebookVerified && rules.acceptance.replayMatches && rulesFastPassed
      ? 'verified' : 'implementation-in-progress',
      rules: 'audit/tdc-rules.json', replayMatches: rules.acceptance.replayMatches, fastPassed: rulesFastPassed },
    P4: { status: interactions.status, interactions: 'audit/tdc-interactions.json',
      desktop: interactions.acceptance.screenshots.filter(row => row.size[0] === 1440).length,
      mobile: interactions.acceptance.screenshots.filter(row => row.size[0] === 390).length,
      replayCases: interactions.acceptance.replayCases },
    P5: { status: investigators.status, investigators: 'audit/tdc-investigators.json', pending: investigators.pending },
    P6: { status: player.status, player: 'audit/tdc-player.json', counts: player.counts },
    P7: { status: scenariosVerified ? 'verified' : p7.status, p7: 'audit/tdc-p7.json', counts: p7.counts },
    P8: { status: releaseComplete ? 'verified' : 'pending' },
  },
  confirmations: {
    scenarios: { status: scenariosVerified ? 'verified' : 'pending', items: scenarioItems },
    keywords: { status: keywordsVerified ? 'verified' : 'pending', items: keywordItems },
    rulebook: { status: rulebookVerified ? 'verified' : 'pending', checks: rulebookChecks, evidence: rulesEvidence },
  },
}
assertMigrationConfirmations(migration, scope.scenarios.map(scenario => scenario.id))
for (const [name, value] of Object.entries({ 'primitive-plan': plan, 'primitive-catalog': catalog, migration })) {
  writeOrCheck(`audit/tdc-${name}.json`, value, process.argv[2])
}
console.log(`TDC ${process.argv[2]} · ${scope.codes.length} 条记录 · ${newPrimitives.length - pending.length} 组新增原语已接线 · ${pending.length} 组待完成`)
