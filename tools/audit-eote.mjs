// 《地球边缘》（Edge of the Earth）P8 总迁移账本：把「生产内容注册表 + P0 范围账本 + P3 原语/
// P4 关键词与规则书 / P5 调查员 / P6 玩家卡 / P7 八章与剧情 / P8 全卡与发布浏览器」的真实事实
// 合成一份可复算的发布审计；docs/README/verify-eote 引用本账本。
//
//   node tools/audit-eote.mjs --write    重写 audit/eote-migration.json
//   node tools/audit-eote.mjs --check    复算并逐字节比对（内容、判据或证据变化即失败）
//   node tools/audit-eote.mjs            打印账本 JSON（不落盘）
//
// 证据规则（与 TIC/TDE P8 账本同口径）：
// - **一个事实源**：卡数/分区来自 src/cards/cards-data.js + content/packs/eote*/manifest.js，
//   关键词来自 content/campaigns/edgeOfTheEarth/keywords.js，章节来自 shared.js——本工具逐项重算，
//   不读「已冻结的结论」再复制；范围账本只用来交叉核对并记录 sha256。
// - **证据账本只读**：逐章/全卡/调查员/玩家/规则/Node/回归/浏览器账本由各自工具生成；文件缺失或
//   不自洽时对应 gate 一律 false，不手工补数字。
// - **remaining 由计算得出**：从 checks=false 的项、缺失输入、显式近似/原语请求汇总；不把未完成
//   写成完成。pending 原语请求逐条进入 releaseAcceptance.deferred（「已披露近似」）。
// - **输出确定性**：不写时间戳、耗时、git head、本机路径；同一干净检出复跑应逐字节一致。
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { MOD, WORKSPACE, RUN, json, sha, writeJson } from './eote-migration-lib.mjs'
import { contentRegistry } from '../content/registered.js'
import { campaignListForUi } from '../content/registry.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import {
  CARD_PARTITIONS, CHAPTER_ENCOUNTER_GROUPS, CYCLE_CODES, DISCIPLINE_CODES, ENCOUNTER_GROUPS,
  INVESTIGATOR_CODES, SHARED_ENCOUNTER_GROUPS, chapters,
} from '../content/campaigns/edgeOfTheEarth/shared.js'
import { EOTE_KEYWORDS } from '../content/campaigns/edgeOfTheEarth/keywords.js'
import { EOTE_STORY_META, EOTE_STORY_TEXT } from '../content/campaigns/edgeOfTheEarth/story-text.js'
import {
  KEYWORD_MIGRATION_CHECKS, RULEBOOK_MIGRATION_CHECKS, SCENARIO_MIGRATION_CHECKS,
} from '../content/migration-confirmation.js'

const CAMPAIGN_ID = 'edgeOfTheEarth'
const CYCLE = 'eote'
const PACK_IDS = Object.freeze(['eoteCampaign', 'eoteInvestigators', 'eotePlayer'])
const SELF = fileURLToPath(import.meta.url)
const TARGET = join(MOD, 'audit/eote-migration.json')
const LAUNCHABLE = new Set(['playable', 'verified'])
const PATHS = Object.freeze({
  scope: 'audit/eote-scope.json',
  baseline: 'audit/eote-baseline.json',
  scenario: 'audit/eote-scenario-acceptance.json',
  allCards: 'audit/eote-all-card-acceptance.json',
  investigators: 'audit/eote-investigators.json',
  player: 'audit/eote-player-acceptance.json',
  rules: 'audit/eote-rules.json',
  interactions: 'audit/eote-interactions.json',
  node: 'audit/eote-node-acceptance.json',
  regression: 'audit/eote-regression.json',
  playerQueue: 'audit/eote-player-queue.json',
  primitivePlan: 'audit/eote-primitive-plan.json',
  primitiveRequests: 'artifacts/migration/eote/primitive-requests',
  p7Browser: 'audit/eote-scenarios-browser.json',
  releaseBrowser: 'audit/eote-release-browser.json',
  releaseAcceptance: 'audit/eote-release-acceptance.json',
  keywords: 'content/campaigns/edgeOfTheEarth/keywords.js',
  storyText: 'content/campaigns/edgeOfTheEarth/story-text.js',
  campaignManifest: 'content/campaigns/edgeOfTheEarth/manifest.js',
  shared: 'content/campaigns/edgeOfTheEarth/shared.js',
  registered: 'content/registered.js',
  registry: 'content/registry.js',
  migrationConfirmation: 'content/migration-confirmation.js',
  docs: 'docs/arkham-content-migration.md',
})
const EXPECTED = Object.freeze({
  records: 403, main: 367, faces: 36,
  campaign: 266, investigators: 22, player: 115,
  chapters: 8, sections: 469, keywords: 38, rulebookEntries: 23,
  encounterGroups: 24, sharedGroups: 16, chapterGroups: 8,
  recordsWithRemoteImage: 375, recordsWithBackRemoteImage: 102,
})
const GUIDES = Object.freeze(chapters.map(chapter => `web/scenario-guides/${chapter.id}.json`))

// ---------------------------------------------------------------- 通用只读 IO（确定性）
const resolvePath = path => {
  const inMod = join(MOD, path)
  if (existsSync(inMod)) return inMod
  const inWork = join(WORKSPACE, path)
  return existsSync(inWork) ? inWork : null
}
const readBytes = path => {
  const absolute = resolvePath(path)
  return absolute ? readFileSync(absolute) : null
}
const readJson = path => {
  const bytes = readBytes(path)
  if (!bytes) return null
  try {
    return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''))
  } catch {
    return null
  }
}
const fileHash = path => {
  const bytes = readBytes(path)
  return bytes ? sha(bytes) : null
}
const fileExists = path => Boolean(resolvePath(path))
const num = value => (Number.isFinite(value) ? value : 0)
const bool = value => value === true
const sorted = list => [...list].sort((left, right) => String(left).localeCompare(String(right)))
const listDir = path => {
  const absolute = resolvePath(path)
  if (!absolute) return []
  return sorted(readdirSync(absolute).filter(name => !name.startsWith('.')))
}
const fileShaEntry = path => ({ path, sha256: fileHash(path) })

function walk(dir) {
  const absolute = resolvePath(dir)
  if (!absolute) return []
  return readdirSync(absolute, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]).sort()
}

// ---------------------------------------------------------------- 逐卡事实（重算，不用冻结结论）
function liveCardFacts() {
  const dependents = new Set([
    ...INVESTIGATOR_CODES.flatMap(code => [code, ...(ALL_CARDS[code]?.deckRequirements?.signatureCards || [])]),
    ...DISCIPLINE_CODES,
  ])
  const campaign = CYCLE_CODES.filter(code => ALL_CARDS[code]?.pack === 'eoec')
  const investigators = CYCLE_CODES.filter(code => ALL_CARDS[code]?.pack === 'eoep' && dependents.has(code))
  const player = CYCLE_CODES.filter(code => ALL_CARDS[code]?.pack === 'eoep' && !dependents.has(code))
  // 关联面：卡号以 a/b 等字母结尾的印刷记录（含调查员/玩家双面卡）；主卡 = 其余记录。
  const faces = CYCLE_CODES.filter(code => /[a-z]$/.test(code))
  const all = [...campaign, ...investigators, ...player]
  return {
    records: all.length,
    main: all.length - faces.length,
    faces: faces.length,
    partitions: { eoteCampaign: campaign.length, eoteInvestigators: investigators.length, eotePlayer: player.length },
    codes: { campaign: sorted(campaign), investigators: sorted(investigators), player: sorted(player) },
    sharedPartitions: {
      eoteCampaign: CARD_PARTITIONS.eoteCampaign.length,
      eoteInvestigators: CARD_PARTITIONS.eoteInvestigators.length,
      eotePlayer: CARD_PARTITIONS.eotePlayer.length,
    },
  }
}

// ---------------------------------------------------------------- 生产注册表事实
function registryFacts() {
  const missingInputs = []
  let launch = { launchable: false, id: null, status: null, error: null }
  try {
    const campaign = contentRegistry.assertLaunchable(CAMPAIGN_ID)
    launch = { launchable: campaign?.id === CAMPAIGN_ID, id: campaign?.id || null,
      status: campaign?.status || null, error: null }
  } catch (error) {
    launch.error = String(error?.message || error)
  }
  let lobby = { visible: false }
  try {
    const row = campaignListForUi(contentRegistry).find(campaign => campaign.id === CAMPAIGN_ID)
    if (row) lobby = { visible: true, status: row.status, earlyAccess: row.earlyAccess,
      scenarios: (row.scenarios || []).map(scenario => scenario.id) }
  } catch (error) {
    lobby = { visible: false, error: String(error?.message || error) }
  }
  const packs = Object.fromEntries(PACK_IDS.map(id => {
    const pack = contentRegistry.getPack(id)
    if (!pack) missingInputs.push(`content/packs/${id}/manifest.js`)
    return [id, pack ? {
      id: pack.id, status: pack.status, cards: Array.isArray(pack.cards) ? pack.cards.length : 0,
      encounterGroups: Array.isArray(pack.encounterGroupIds) ? pack.encounterGroupIds.length : 0,
      buildable: Array.isArray(pack.cards) ? pack.cards.filter(card => card.deckbuilding === true).length : 0,
    } : null]
  }))
  const scenarios = contentRegistry.listScenarios(CAMPAIGN_ID).map(scenario => ({
    id: scenario.id, status: scenario.status, referenceCode: scenario.referenceCode ?? null,
    campaignId: scenario.campaignId ?? null,
  }))
  return { launch, lobby, packs, scenarios, missingInputs }
}

// ---------------------------------------------------------------- 各证据账本读取
function normalizedAllCards(ledger) {
  if (!ledger) return { ledger: null, summary: null, pass: false }
  const summary = ledger.summary || {}
  const partitions = summary.partitions || summary.packs || {}
  const pick = (...keys) => {
    for (const key of keys) {
      const value = partitions?.[key]
      if (Number.isFinite(value)) return value
      if (value && typeof value === 'object' && Number.isFinite(value.total)) return value.total
    }
    return null
  }
  const campaign = pick('eoteCampaign', 'campaign', 'campaignCards')
  const investigators = pick('eoteInvestigators', 'investigator', 'investigators', 'investigatorCards')
  const player = pick('eotePlayer', 'player', 'playerCards')
  const missing = num(summary.missing)
  const blocked = num(summary.blocked)
  const gateComplete = summary.gateComplete === true || ledger?.gate?.pass === true
    || ['verified', 'complete', 'passed'].includes(String(ledger?.status))
  const pass = missing === 0 && blocked === 0 && gateComplete
    && campaign === EXPECTED.campaign && investigators === EXPECTED.investigators
    && player === EXPECTED.player && campaign + investigators + player === EXPECTED.records
  return {
    ledger,
    summary: {
      total: num(summary.total), verified: num(summary.verified), missing, blocked,
      simplified: num(summary.simplified), campaign, investigators, player,
    },
    pass,
  }
}

function requestStats() {
  const files = listDir(PATHS.primitiveRequests).filter(name => name.endsWith('.json'))
  const items = files.map(file => {
    const request = readJson(`${PATHS.primitiveRequests}/${file}`) || {}
    return {
      file,
      path: `${PATHS.primitiveRequests}/${file}`,
      id: request.id ?? file.replace(/\.json$/, ''),
      status: request.status ?? 'pending',
      primitive: request.primitive ?? null,
      need: request.need ?? null,
      reason: request.approximation ?? request.reason ?? request.notes ?? null,
    }
  })
  const byStatus = {}
  for (const item of items) byStatus[item.status] = (byStatus[item.status] || 0) + 1
  return { files, items, byStatus, pending: items.filter(item => item.status === 'pending') }
}

// ---------------------------------------------------------------- 关键词 / 规则书确认
function keywordConfirmation(rulesLedger, rulesGates) {
  const rulesItems = Array.isArray(rulesLedger?.confirmations?.keywords?.items)
    ? rulesLedger.confirmations.keywords.items : []
  const items = EOTE_KEYWORDS.map(keyword => {
    const ledgerItem = rulesItems.find(item => item.id === keyword.id) || null
    const checks = Object.fromEntries(KEYWORD_MIGRATION_CHECKS.map(check => [check, bool(ledgerItem?.checks?.[check])]))
    const complete = KEYWORD_MIGRATION_CHECKS.every(check => checks[check])
    return {
      id: keyword.id,
      ruleId: keyword.ruleId ?? keyword.id,
      zh: keyword.zh ?? null,
      kind: keyword.kind ?? null,
      checks,
      status: complete ? 'verified' : 'pending',
      evidence: Array.isArray(ledgerItem?.evidence) && ledgerItem.evidence.length
        ? [...ledgerItem.evidence]
        : [PATHS.keywords, PATHS.rules],
    }
  })
  const verified = items.filter(item => item.status === 'verified').length
  const status = items.length === EXPECTED.keywords && verified === items.length
    && rulesGates.allKeywordsVerified === true ? 'verified' : 'pending'
  return {
    status,
    total: items.length,
    verified,
    checks: Object.fromEntries(KEYWORD_MIGRATION_CHECKS.map(check =>
      [check, items.every(item => item.checks[check] === true)])),
    items,
    ledger: fileShaEntry(PATHS.rules),
    evidence: [PATHS.keywords, PATHS.rules, 'tests/eote-rules.test.mjs', 'audit/eote-mechanism-scan.json'],
  }
}

function rulebookConfirmation(rulesLedger, rulesGates) {
  const source = rulesLedger?.confirmations?.rulebook || {}
  const checks = Object.fromEntries(RULEBOOK_MIGRATION_CHECKS.map(check => [check, bool(source.checks?.[check])]))
  const items = Array.isArray(source.items) ? source.items : []
  const allItemsVerified = items.length > 0 && items.every(item => item.status === 'verified')
  const complete = RULEBOOK_MIGRATION_CHECKS.every(check => checks[check]) && allItemsVerified
    && rulesGates.allRulesVerified === true
  return {
    status: complete ? 'verified' : 'pending',
    entries: items.length,
    requiredRuleIds: Array.isArray(source.requiredRuleIds) ? [...source.requiredRuleIds] : [],
    checks,
    details: {
      itemsVerified: items.filter(item => item.status === 'verified').length,
      cardLinksComplete: rulesGates.cardLinksComplete === true,
      noImplementationProse: rulesGates.noImplementationProse === true,
      browser: {
        desktop: source.checks?.desktopBrowser === true,
        mobile: source.checks?.mobileBrowser === true,
      },
    },
    evidence: [PATHS.rules, 'web/eote-rules.js', 'web/rulebook-data.js', 'tests/eote-rules.test.mjs',
      'audit/eote-browser-acceptance.json'],
  }
}

// ---------------------------------------------------------------- 逐章确认（12 项）
function scenarioConfirmationItems(scenarioLedger, registry, p7Browser, regression) {
  const scenarioItems = Array.isArray(scenarioLedger?.chapters) ? scenarioLedger.chapters : []
  const production = new Map(registry.scenarios.map(scenario => [scenario.id, scenario]))
  const browserScenarios = p7Browser?.checks?.scenarios || {}
  return chapters.map(chapter => {
    const item = scenarioItems.find(entry => entry.id === chapter.id) || null
    const ledgerChecks = item?.checks || {}
    const sources = Array.isArray(item?.sources) ? item.sources : []
    const modulePath = item?.modulePath ?? `content/campaigns/edgeOfTheEarth/scenarios/${chapter.id}/index.js`
    const moduleFile = resolvePath(modulePath)
    const moduleSha256 = moduleFile ? sha(readFileSync(moduleFile)) : null
    const ledgerSource = Array.isArray(scenarioLedger?.sources)
      ? scenarioLedger.sources.find(entry => entry.path === modulePath) || null
      : null
    const browserChapter = browserScenarios[chapter.id] || null
    const productionScenario = production.get(chapter.id) || null
    const browserLedger = p7Browser
    const checks = {
      sourceLocked: sources.length === 2
        && sources.every(entry => typeof entry.sha256 === 'string' && /^[0-9a-f]{64}$/.test(entry.sha256))
        && Boolean(moduleSha256) && (!ledgerSource || ledgerSource.sha256 === moduleSha256),
      identityRegistered: item?.moduleError == null && ledgerChecks.moduleLoaded === true
        && ledgerChecks.manifestComplete === true && LAUNCHABLE.has(productionScenario?.status)
        && productionScenario?.campaignId === CAMPAIGN_ID,
      setupAndZones: ledgerChecks.manifestComplete === true && ledgerChecks.encounterGroups === true,
      actsAndAgendas: ledgerChecks.behavior === true && ledgerChecks.manifestComplete === true,
      locationsAndConnections: ledgerChecks.layout === true,
      encounterBehaviors: ledgerChecks.encounterGroups === true,
      literalCardBehavior: ledgerChecks.cardEntries === true,
      chaosEffects: ledgerChecks.tests === true && ledgerChecks.behavior === true,
      resolutionsAndRecords: ledgerChecks.tests === true && ledgerChecks.guide === true,
      storyText: ledgerChecks.guide === true && ledgerChecks.guideGapsDeclared === true,
      saveReplay: regression?.replay?.matches === true && regression?.replay?.exitCode === 0,
      browserAcceptance: browserChapter?.desktop === true && browserChapter?.mobile === true,
    }
    const complete = SCENARIO_MIGRATION_CHECKS.every(check => checks[check] === true)
    const evidence = [
      modulePath,
      PATHS.scenario,
      PATHS.p7Browser,
      `tests/eote-scenario-${chapter.id}.test.mjs`,
      PATHS.regression,
    ].filter(path => path === modulePath || fileExists(path))
    return {
      id: chapter.id,
      code: chapter.code,
      name: chapter.name,
      part: chapter.part,
      status: complete && item?.status === 'verified' ? 'verified' : 'pending',
      checks,
      moduleSha256,
      sources: sources.map(entry => ({ lang: entry.lang ?? null, path: entry.path ?? null, sha256: entry.sha256 ?? null })),
      evidence,
    }
  })
}

// ---------------------------------------------------------------- remaining / deferred 计算
function buildRemaining({ featureChecks, missingInputs, confirmations }) {
  const remaining = []
  for (const [key, pass] of Object.entries(featureChecks)) {
    if (pass === true) continue
    remaining.push({
      id: `gate:${key}`,
      reason: `发布门禁未通过：${key}`,
      evidence: ['tools/audit-eote.mjs', ...(missingInputs || [])],
    })
  }
  for (const id of missingInputs || []) {
    remaining.push({
      id: `missing:${id}`,
      reason: `缺少证据账本 ${id}（由对应 runner/worker 生成后重跑 --write）`,
      evidence: ['tools/audit-eote.mjs', id],
    })
  }
  for (const [name, section] of Object.entries(confirmations)) {
    if (section.status === 'verified') continue
    const failed = Array.isArray(section.items)
      ? section.items.filter(item => item.status !== 'verified').map(item => item.id)
      : Object.entries(section.checks || {}).filter(([, value]) => value !== true).map(([check]) => check)
    remaining.push({
      id: `confirmation:${name}`,
      reason: `迁移确认未 verified：${failed.join('、') || name}`,
      evidence: [PATHS.migrationConfirmation, ...(section.evidence || [])],
    })
  }
  return remaining
}

function buildDeferred(requests, playerQueue, allCards) {
  const deferred = requests.pending.map(item => ({
    id: `primitiveRequest:${item.id}`,
    file: item.path,
    status: item.status,
    primitive: item.primitive,
    // P7 修复期 worker 写的请求用 need 描述缺口（无 primitive 字段）；原样披露，不编造原语名。
    need: item.need,
    reason: '已披露近似：原语未实现，相关卡片以现有原语/近似实现（见请求 JSON 的 need/approximation 与对应卡条目头注释）；不宣称规则等价，P8 不阻塞发布但登记为后续硬化候选。',
    evidence: [item.path, 'audit/eote-player-queue.json'],
  }))
  const rejected = Array.isArray(playerQueue?.items)
    ? playerQueue.items.filter(item => item.status === 'rejected') : []
  if (num(allCards?.summary?.simplified) > 0) {
    deferred.push({
      id: 'allCardSimplified',
      count: num(allCards.summary.simplified),
      status: 'simplified',
      reason: '已披露近似：全卡账本有 ' + num(allCards.summary.simplified) + ' 条 simplified（行为按现有原语近似实现，逐条见全卡账本 entries），不宣称规则等价。',
      evidence: [PATHS.allCards],
    })
  }
  const pendingBehavior = Array.isArray(allCards?.ledger?.summary?.pendingBehaviorRequests)
    ? allCards.ledger.summary.pendingBehaviorRequests : []
  if (pendingBehavior.length) {
    deferred.push({
      id: 'pendingBehaviorRequests',
      count: pendingBehavior.length,
      status: 'pending',
      reason: '已披露近似：全卡账本登记 ' + pendingBehavior.length + ' 张卡等待行为原语（' + pendingBehavior.join('、') + '）——对应请求逐条列在本 deferred 的 primitiveRequest:* 中。',
      evidence: [PATHS.allCards],
    })
  }
  if (rejected.length) {
    deferred.push({
      id: 'playerQueueRejected',
      count: rejected.length,
      status: 'rejected',
      reason: `已披露近似：P6 玩家卡原语队列有 ${rejected.length} 条 rejected（每张卡在条目头注释与 P6 报告写明近似口径），不计入 P7/P8 新增原语欠账。`,
      evidence: [PATHS.playerQueue],
    })
  }
  return deferred
}

// ---------------------------------------------------------------- 总账本构建
export function buildMigrationLedger() {
  const missingInputs = []
  const live = liveCardFacts()
  const scope = readJson(PATHS.scope)
  if (!scope) missingInputs.push(PATHS.scope)
  const snapshot = readJson(PATHS.scenario)
  if (!snapshot) missingInputs.push(PATHS.scenario)
  const allCardLedger = readJson(PATHS.allCards)
  if (!allCardLedger) missingInputs.push(PATHS.allCards)
  const investigatorLedger = readJson(PATHS.investigators)
  if (!investigatorLedger) missingInputs.push(PATHS.investigators)
  const playerLedger = readJson(PATHS.player)
  if (!playerLedger) missingInputs.push(PATHS.player)
  const rulesLedger = readJson(PATHS.rules)
  if (!rulesLedger) missingInputs.push(PATHS.rules)
  const interactionsLedger = readJson(PATHS.interactions)
  if (!interactionsLedger) missingInputs.push(PATHS.interactions)
  const nodeLedger = readJson(PATHS.node)
  if (!nodeLedger) missingInputs.push(PATHS.node)
  const regressionLedger = readJson(PATHS.regression)
  if (!regressionLedger) missingInputs.push(PATHS.regression)
  const playerQueue = readJson(PATHS.playerQueue) || { items: [] }
  const primitivePlan = readJson(PATHS.primitivePlan)
  if (!primitivePlan) missingInputs.push(PATHS.primitivePlan)
  const p7Browser = readJson(PATHS.p7Browser)
  if (!p7Browser) missingInputs.push(PATHS.p7Browser)
  const releaseBrowser = readJson(PATHS.releaseBrowser)
  if (!releaseBrowser) missingInputs.push(PATHS.releaseBrowser)
  const releaseAcceptanceLedger = readJson(PATHS.releaseAcceptance)
  if (!releaseAcceptanceLedger) missingInputs.push(PATHS.releaseAcceptance)
  const baseline = readJson(PATHS.baseline)
  const registry = registryFacts()
  const requests = requestStats()
  const allCards = normalizedAllCards(allCardLedger)
  const nodes = nodeLedger || {}
  const regression = regressionLedger || {}
  const rulesGates = rulesLedger?.gates || {}

  // ---- scope / 分区一致性（重算比对账本）
  const scopeCounts = scope?.counts || {}
  const scopePartitions = scope?.counts?.packs || {}
  const scopeChecks = {
    ledger: Boolean(scope),
    milestones: scope?.cycle === CYCLE && scope?.campaignId === CAMPAIGN_ID,
    records: num(scopeCounts.records) === EXPECTED.records && live.records === EXPECTED.records,
    mainFaces: num(scopeCounts.main) === EXPECTED.main && num(scopeCounts.faces) === EXPECTED.faces
      && live.main === EXPECTED.main && live.faces === EXPECTED.faces,
    partitions: scopePartitions.eoteCampaign === live.partitions.eoteCampaign
      && scopePartitions.eoteInvestigators === live.partitions.eoteInvestigators
      && scopePartitions.eotePlayer === live.partitions.eotePlayer
      && live.partitions.eoteCampaign === EXPECTED.campaign
      && live.partitions.eoteInvestigators === EXPECTED.investigators
      && live.partitions.eotePlayer === EXPECTED.player,
    sharedPartitions: live.sharedPartitions.eoteCampaign === EXPECTED.campaign
      && live.sharedPartitions.eoteInvestigators === EXPECTED.investigators
      && live.sharedPartitions.eotePlayer === EXPECTED.player,
    gates: Boolean(scope?.gates) && Object.values(scope.gates).every(value => value === true),
    cardImages: scope?.cardImages?.cycleCopies === false
      && scope?.cardImages?.recordsWithRemoteImage === EXPECTED.recordsWithRemoteImage
      && scope?.cardImages?.recordsWithBackRemoteImage === EXPECTED.recordsWithBackRemoteImage
      && String(scope?.cardImages?.note || '').includes('不依赖参考资源'),
  }

  // ---- 三包（生产注册表 + manifest 卡数重算）
  const packChecks = Object.fromEntries(PACK_IDS.map(id => {
    const pack = registry.packs[id]
    const expected = id === 'eoteCampaign' ? EXPECTED.campaign
      : id === 'eoteInvestigators' ? EXPECTED.investigators : EXPECTED.player
    return [id, Boolean(pack) && pack.status === 'playable' && pack.cards === expected]
  }))

  // ---- 战役启动 / 大厅
  const chapterIds = chapters.map(chapter => chapter.id)
  const lobbyScenarios = Array.isArray(registry.lobby.scenarios) ? registry.lobby.scenarios : []
  const campaignChecks = {
    playable: LAUNCHABLE.has(registry.launch.status) && registry.launch.launchable,
    lobbyVisible: registry.lobby.visible === true,
    earlyAccessFalse: registry.lobby.earlyAccess === false,
    eightChapters: lobbyScenarios.length === EXPECTED.chapters
      && chapterIds.every(id => lobbyScenarios.includes(id))
      && registry.scenarios.length === EXPECTED.chapters
      && registry.scenarios.every(scenario => LAUNCHABLE.has(scenario.status)),
  }

  // ---- 8 章逐章账本 + 发布浏览器逐章
  const scenarioItems = Array.isArray(snapshot?.chapters) ? snapshot.chapters : []
  const p7BrowserScenarios = p7Browser?.checks?.scenarios || {}
  const chapterRows = chapters.map(chapter => {
    const item = scenarioItems.find(entry => entry.id === chapter.id) || null
    const browser = p7BrowserScenarios[chapter.id] || null
    return {
      id: chapter.id,
      code: chapter.code,
      name: chapter.name,
      status: item?.status ?? null,
      verified: item?.status === 'verified' && (item?.gaps || []).length === 0,
      gaps: (item?.gaps || []).length,
      approximations: (item?.approximations || []).length,
      guideSections: item?.package?.guideSections ?? null,
      encounterCards: item?.package?.encounters ?? null,
      browserDesktop: browser?.desktop === true,
      browserMobile: browser?.mobile === true,
      checks: item?.checks ?? null,
    }
  })
  const scenarioChecks = {
    ledger: Boolean(snapshot) && snapshot.status === 'verified',
    chapters: chapterRows.length === EXPECTED.chapters && chapterRows.every(row => row.verified),
    gates: Boolean(snapshot?.gates) && Object.values(snapshot.gates).every(value => value === true),
    remaining: !Array.isArray(snapshot?.remaining) || snapshot.remaining.length === 0,
    story: num(snapshot?.summary?.guideSections) >= EXPECTED.sections
      && num(snapshot?.summary?.missingCardEntries) === 0,
    browser: p7Browser?.status === 'passed' && p7Browser?.checks?.desktop === true
      && p7Browser?.checks?.mobile === true
      && chapterIds.every(id => p7BrowserScenarios[id]?.desktop === true && p7BrowserScenarios[id]?.mobile === true),
  }

  // ---- 关键词 / 规则书
  const confirmationsKeywords = keywordConfirmation(rulesLedger, rulesGates)
  const confirmationsRulebook = rulebookConfirmation(rulesLedger, rulesGates)

  // ---- 剧情 / 指南
  const storyChapters = Object.keys(EOTE_STORY_TEXT.chapters || {})
  const storySections = Object.values(EOTE_STORY_TEXT.chapters || {})
    .reduce((sum, chapter) => sum + num(chapter.sectionCount), 0)
  const chinese = EOTE_STORY_META?.chinese || {}
  const guideFiles = GUIDES.map(path => ({ path, exists: fileExists(path) }))
  const storyChecks = {
    generated: EOTE_STORY_META?.status === 'generated',
    eightChapters: storyChapters.length === EXPECTED.chapters
      && chapterIds.every(id => storyChapters.includes(id)),
    sections: storySections === EXPECTED.sections,
    chineseMarked: num(chinese.total) === EXPECTED.sections
      && num(chinese.presentNeedsReview ?? chinese.present) + num(chinese.untranslated) + num(chinese.missing)
        === EXPECTED.sections,
    guides: guideFiles.every(entry => entry.exists),
  }

  // ---- 全卡 / 调查员 / 玩家卡
  const investigatorItems = Array.isArray(investigatorLedger?.items) ? investigatorLedger.items : []
  const investigatorChecks = {
    ledger: investigatorLedger?.status === 'verified',
    items: investigatorItems.length === INVESTIGATOR_CODES.length
      && investigatorItems.every(item => item.status === 'verified'),
    checks: Boolean(investigatorLedger?.checks)
      && Object.values(investigatorLedger.checks).every(value => value === true),
    delivered: JSON.stringify(sorted(investigatorLedger?.deliveredInvestigators || []))
      === JSON.stringify(sorted(INVESTIGATOR_CODES)),
  }
  const playerSummary = playerLedger?.summary || {}
  const playerChecks = {
    ledger: playerLedger?.status === 'verified',
    // 口径（P0-11 修复）：不再要求 simplified=0（那是只看 flag 的空门禁）；改为要求
    // 115 张全部有逐卡测试证据，且所有自述近似都已逐条披露（gates.simplificationDisclosed）。
    summary: num(playerSummary.total) === EXPECTED.player && num(playerSummary.verified) === EXPECTED.player
      && num(playerSummary.missing) === 0
      && num(playerSummary.simplified) === num(playerSummary.simplifiedDisclosed),
    gates: Boolean(playerLedger?.gates) && Object.values(playerLedger.gates).every(value => value === true),
    buildable: num(playerSummary.buildable) > 0,
  }
  const allCardChecks = {
    ledger: allCards.pass,
    missing: num(allCards.summary?.missing) === 0,
    blocked: num(allCards.summary?.blocked) === 0,
    partitions: allCards.summary?.campaign === EXPECTED.campaign
      && allCards.summary?.investigators === EXPECTED.investigators
      && allCards.summary?.player === EXPECTED.player,
  }

  // ---- Node / 回归 / 交互 / 浏览器
  const nodeChecks = {
    ledger: Boolean(nodeLedger),
    status: nodeLedger?.status === 'passed',
    sourceStable: nodeLedger?.sourceStableDuringRun === true,
    failures: num(nodeLedger?.summary?.fail) === 0 && num(nodeLedger?.summary?.tests) > 0,
  }
  const knownFastFailures = Array.isArray(baseline?.fastFailures) ? baseline.fastFailures : []
  const fastFailures = Array.isArray(regression?.fast?.failures) ? regression.fast.failures : []
  const regressionChecks = {
    ledger: Boolean(regressionLedger),
    status: regressionLedger?.status === 'passed',
    sourceStable: regressionLedger?.sourceStableDuringRun === true,
    replay: regression?.replay?.matches === true && regression.replay.exitCode === 0,
    fastKnownOnly: fastFailures.every(failure => knownFastFailures.includes(failure)),
  }
  const interactionsChecks = {
    ledger: interactionsLedger?.status === 'verified',
    gates: Boolean(interactionsLedger?.gates) && Object.values(interactionsLedger.gates).every(value => value === true),
  }

  // ---- 原语计划 / 队列 / 披露
  const planGates = primitivePlan?.gates || {}
  const planNew = Array.isArray(primitivePlan?.new) ? primitivePlan.new : []
  const primitiveChecks = {
    plan: Boolean(primitivePlan) && Object.values(planGates).every(value => value === true),
    newDone: planNew.length > 0 && planNew.every(item => item.status === 'done'),
    requestsAccounted: requests.items.length > 0,
    playerQueueAccounted: Array.isArray(playerQueue.items) && playerQueue.items.length > 0,
    pendingDisclosed: requests.pending.every(item => item.status === 'pending'),
  }
  const deferred = buildDeferred(requests, playerQueue, allCards)

  // ---- 迁移确认（三组）
  const scenarioConfirmations = scenarioConfirmationItems(snapshot, registry, p7Browser, regression)
  const scenariosAllVerified = scenarioConfirmations.length === EXPECTED.chapters
    && scenarioConfirmations.every(item => item.status === 'verified')
  const confirmations = {
    scenarios: {
      status: scenariosAllVerified ? 'verified' : 'pending',
      milestone: 'M3',
      chapters: scenarioConfirmations.length,
      checks: Object.fromEntries(SCENARIO_MIGRATION_CHECKS.map(check =>
        [check, scenarioConfirmations.every(item => item.checks[check] === true)])),
      items: scenarioConfirmations,
      ledger: fileShaEntry(PATHS.scenario),
      browser: fileShaEntry(PATHS.p7Browser),
      evidence: [PATHS.scenario, PATHS.p7Browser, ...chapterRows.map(row => `tests/eote-scenario-${row.id}.test.mjs`)],
    },
    keywords: confirmationsKeywords,
    rulebook: confirmationsRulebook,
  }
  const confirmationsVerified = Object.values(confirmations).every(section => section.status === 'verified')

  // ---- 发布浏览器 / 发布验收账本
  const releaseChecks = {
    browserLedger: Boolean(releaseBrowser),
    browserStatus: releaseBrowser?.status === 'passed',
    browserComplete: releaseBrowser?.complete === true,
    browserSourceStable: releaseBrowser?.sourceStableDuringRun === true,
    acceptanceLedger: Boolean(releaseAcceptanceLedger),
    acceptanceStatus: releaseAcceptanceLedger?.status === 'passed',
    acceptanceGate: releaseAcceptanceLedger?.gate?.pass === true,
  }

  // ---- 汇总门禁（全部 boolean）
  const featureChecks = {
    scope: Object.values(scopeChecks).every(Boolean),
    records: scopeChecks.records && scopeChecks.mainFaces && live.records === EXPECTED.records,
    packs: Object.values(packChecks).every(Boolean),
    campaignLaunch: Object.values(campaignChecks).every(Boolean),
    chapters: Object.values(scenarioChecks).every(Boolean),
    allCards: Object.values(allCardChecks).every(Boolean),
    investigators: Object.values(investigatorChecks).every(Boolean),
    playerCards: Object.values(playerChecks).every(Boolean),
    interactions: Object.values(interactionsChecks).every(Boolean),
    keywords: confirmationsKeywords.status === 'verified',
    rulebook: confirmationsRulebook.status === 'verified',
    storyGuides: Object.values(storyChecks).every(Boolean),
    primitivesDisclosed: Object.values(primitiveChecks).every(Boolean),
    nodeAcceptance: Object.values(nodeChecks).every(Boolean),
    regression: Object.values(regressionChecks).every(Boolean),
    p7ScenarioBrowser: scenarioChecks.browser,
    p8ReleaseBrowser: releaseChecks.browserLedger && releaseChecks.browserStatus
      && releaseChecks.browserComplete && releaseChecks.browserSourceStable,
    releaseAcceptance: releaseChecks.acceptanceLedger && releaseChecks.acceptanceStatus
      && releaseChecks.acceptanceGate,
    confirmations: confirmationsVerified,
  }
  const remaining = buildRemaining({ featureChecks, missingInputs, confirmations })
  const releaseRequired = {
    launch: featureChecks.campaignLaunch,
    chapters: featureChecks.chapters,
    scenarios: confirmations.scenarios.status === 'verified',
    allCards: featureChecks.allCards,
    investigators: featureChecks.investigators,
    playerCards: featureChecks.playerCards,
    keywords: featureChecks.keywords,
    rulebook: featureChecks.rulebook,
    storyGuides: featureChecks.storyGuides,
    node: featureChecks.nodeAcceptance,
    regression: featureChecks.regression,
    p7Browser: featureChecks.p7ScenarioBrowser,
    p8Browser: featureChecks.p8ReleaseBrowser,
    releaseLedger: featureChecks.releaseAcceptance,
    primitivesDisclosed: featureChecks.primitivesDisclosed,
  }
  const releaseStatus = remaining.length === 0
    && Object.values(releaseRequired).every(Boolean) && confirmationsVerified ? 'passed' : 'pending'
  const status = releaseStatus === 'passed' && Object.values(featureChecks).every(Boolean)
    && confirmationsVerified ? 'verified' : 'pending'

  const sources = [
    PATHS.registered, PATHS.registry, PATHS.shared, PATHS.campaignManifest, PATHS.keywords,
    PATHS.storyText, PATHS.migrationConfirmation, PATHS.scope, PATHS.scenario, PATHS.allCards,
    PATHS.investigators, PATHS.player, PATHS.rules, PATHS.interactions, PATHS.node, PATHS.regression,
    PATHS.playerQueue, PATHS.primitivePlan, PATHS.p7Browser, PATHS.releaseBrowser, PATHS.releaseAcceptance,
    'content/packs/eoteCampaign/manifest.js', 'content/packs/eoteInvestigators/manifest.js',
    'content/packs/eotePlayer/manifest.js', 'src/cards/cards-data.js', 'tools/audit-eote.mjs',
    'tools/audit-eote-release.mjs', 'tests/eote-migration-ledger.test.mjs',
    ...requests.files.map(file => `${PATHS.primitiveRequests}/${file}`),
  ].map(path => ({ path, sha256: fileHash(path) }))

  const ledger = {
    schemaVersion: 2,
    cycle: CYCLE,
    cycleName: 'The Edge of the Earth',
    cycleNameZh: '地球边缘',
    campaignId: CAMPAIGN_ID,
    milestone: 'P8',
    stage: 'P8',
    generatedBy: 'node tools/audit-eote.mjs --write',
    docs: PATHS.docs,
    scope: fileShaEntry(PATHS.scope),
    baseline: {
      path: PATHS.baseline,
      fastFailures: knownFastFailures,
      note: 'P0 基线既有失败（TIC P8 replay、TDE P10 账本两条）；本账本只允许这些既有失败，不新增。',
    },
    campaign: {
      id: CAMPAIGN_ID,
      status: registry.launch.status,
      launchable: registry.launch.launchable,
      launchError: registry.launch.error,
      lobbyVisible: registry.lobby.visible === true,
      earlyAccess: registry.lobby.earlyAccess ?? null,
      scenarioIds: chapterIds,
      productionScenarios: registry.scenarios,
      requiredPackIds: PACK_IDS,
    },
    status,
    playable: LAUNCHABLE.has(registry.launch.status) && registry.launch.launchable,
    launchEnabled: registry.launch.launchable,
    earlyAccess: false,
    counts: {
      records: live.records,
      main: live.main,
      faces: live.faces,
      packs: live.partitions,
      chapters: chapters.length,
      encounterGroups: ENCOUNTER_GROUPS.length,
      sharedGroups: SHARED_ENCOUNTER_GROUPS.length,
      chapterGroups: Object.keys(CHAPTER_ENCOUNTER_GROUPS).length,
      keywords: EOTE_KEYWORDS.length,
      storySections: storySections,
      guideFiles: guideFiles.length,
    },
    partitions: live.partitions,
    sharedPartitions: live.sharedPartitions,
    scopeChecks,
    packs: registry.packs,
    packChecks,
    campaignChecks,
    chapters: chapterRows,
    scenarioLedger: {
      path: PATHS.scenario,
      status: snapshot?.status ?? null,
      summary: snapshot?.summary ?? null,
      gates: snapshot?.gates ?? null,
      remaining: Array.isArray(snapshot?.remaining) ? snapshot.remaining.length : null,
      checks: scenarioChecks,
    },
    allCardLedger: {
      path: PATHS.allCards,
      status: allCardLedger?.status ?? null,
      summary: allCards.summary,
      checks: allCardChecks,
    },
    investigatorLedger: {
      path: PATHS.investigators,
      status: investigatorLedger?.status ?? null,
      delivered: investigatorLedger?.deliveredInvestigators ?? [],
      items: investigatorItems.length,
      checks: investigatorChecks,
    },
    playerLedger: {
      path: PATHS.player,
      status: playerLedger?.status ?? null,
      summary: playerSummary,
      checks: playerChecks,
    },
    rulesLedger: {
      path: PATHS.rules,
      status: rulesLedger?.status ?? null,
      gates: rulesGates,
      deliveredPrimitives: rulesLedger?.deliveredPrimitives ?? [],
      deferredPrimitives: rulesLedger?.deferredPrimitives ?? null,
    },
    keywords: {
      total: EOTE_KEYWORDS.length,
      verified: confirmationsKeywords.verified,
      status: confirmationsKeywords.status,
      items: confirmationsKeywords.items.map(item => ({
        id: item.id, ruleId: item.ruleId, zh: item.zh, kind: item.kind,
        checks: item.checks, status: item.status, evidence: item.evidence,
      })),
    },
    rulebook: {
      entries: confirmationsRulebook.entries,
      requiredRuleIds: confirmationsRulebook.requiredRuleIds,
      status: confirmationsRulebook.status,
      checks: confirmationsRulebook.checks,
      details: confirmationsRulebook.details,
    },
    story: {
      path: PATHS.storyText,
      meta: {
        status: EOTE_STORY_META?.status ?? null,
        sourceKind: EOTE_STORY_META?.sourceKind ?? null,
        officialChinese: EOTE_STORY_META?.officialChinese === true,
      },
      chapters: storyChapters.length,
      sections: storySections,
      chinese: {
        total: num(chinese.total),
        presentNeedsReview: num(chinese.presentNeedsReview ?? chinese.present),
        untranslated: num(chinese.untranslated),
        missing: num(chinese.missing),
        note: '中文缺译逐路径标记在 story.chineseGaps；展示层回退 sectionsEn 并标注「中文待补」，不冒充官方中文。',
      },
      guideFiles: guideFiles.map(entry => ({ path: entry.path, exists: entry.exists })),
      checks: storyChecks,
    },
    primitives: {
      plan: fileShaEntry(PATHS.primitivePlan),
      gates: planGates,
      counts: primitivePlan?.counts ?? null,
      new: planNew.length,
      newDone: planNew.filter(item => item.status === 'done').length,
      deferred: (primitivePlan?.deferred || []).length,
      escape: (primitivePlan?.escape || []).length,
      requests: {
        total: requests.items.length,
        pending: requests.pending.length,
        done: requests.items.filter(item => item.status === 'done').length,
        rejected: requests.items.filter(item => item.status === 'rejected').length,
        byStatus: requests.byStatus,
        pendingItems: requests.pending.map(item => ({ id: item.id, file: item.path, primitive: item.primitive })),
      },
      playerQueue: {
        total: Array.isArray(playerQueue.items) ? playerQueue.items.length : 0,
        pending: (playerQueue.items || []).filter(item => item.status === 'pending').length,
        done: (playerQueue.items || []).filter(item => item.status === 'done').length,
        rejected: (playerQueue.items || []).filter(item => item.status === 'rejected').length,
      },
      checks: primitiveChecks,
    },
    node: {
      path: PATHS.node,
      status: nodeLedger?.status ?? null,
      sourceStableDuringRun: nodeLedger?.sourceStableDuringRun ?? null,
      command: nodeLedger?.command ?? null,
      summary: nodeLedger?.summary ?? null,
      testFiles: Array.isArray(nodeLedger?.testFiles) ? nodeLedger.testFiles.length : 0,
      sourceFiles: Array.isArray(nodeLedger?.sourceFiles) ? nodeLedger.sourceFiles.length : 0,
      checks: nodeChecks,
    },
    regression: {
      path: PATHS.regression,
      status: regressionLedger?.status ?? null,
      sourceStableDuringRun: regressionLedger?.sourceStableDuringRun ?? null,
      replay: regression?.replay ?? null,
      fast: regression?.fast ?? null,
      checks: regressionChecks,
    },
    interactions: {
      path: PATHS.interactions,
      status: interactionsLedger?.status ?? null,
      checks: interactionsChecks,
    },
    browsers: {
      p7Scenarios: {
        path: PATHS.p7Browser,
        status: p7Browser?.status ?? null,
        specs: p7Browser?.specs ?? [],
        tests: Array.isArray(p7Browser?.tests) ? p7Browser.tests.length : 0,
        screenshots: Array.isArray(p7Browser?.screenshots) ? p7Browser.screenshots.length : 0,
        byChapter: Object.fromEntries(chapterIds.map(id => [id, {
          desktop: p7BrowserScenarios[id]?.desktop === true,
          mobile: p7BrowserScenarios[id]?.mobile === true,
        }])),
      },
      p8Release: {
        path: PATHS.releaseBrowser,
        status: releaseBrowser?.status ?? null,
        complete: releaseBrowser?.complete ?? null,
        sourceStableDuringRun: releaseBrowser?.sourceStableDuringRun ?? null,
        checks: releaseBrowser?.checks ?? null,
        tests: Array.isArray(releaseBrowser?.tests) ? releaseBrowser.tests.length : 0,
        screenshots: Array.isArray(releaseBrowser?.screenshots) ? releaseBrowser.screenshots.length : 0,
      },
      releaseAcceptance: {
        path: PATHS.releaseAcceptance,
        status: releaseAcceptanceLedger?.status ?? null,
        gate: releaseAcceptanceLedger?.gate ?? null,
        checks: releaseAcceptanceLedger?.checks ?? null,
        missing: releaseAcceptanceLedger?.missing ?? null,
        screenshots: releaseAcceptanceLedger?.screenshots
          ? { total: releaseAcceptanceLedger.screenshots.total ?? null,
              verified: releaseAcceptanceLedger.screenshots.verified ?? null }
          : null,
      },
      checks: releaseChecks,
    },
    confirmations,
    releaseAcceptance: {
      status: releaseStatus,
      // P0-11 诚实降级：行为等价只在全卡账本逐卡证据完整时成立；simplified 只是已披露近似。
      equivalenceCertified: allCards.pass,
      equivalenceNote: allCards.pass
        ? '全卡账本逐卡证据可追溯（missing/blocked=0）：按本仓 P8 口径，行为等价认证成立；simplified 仍只表示已披露近似。'
        : `行为等价未认证：全卡账本 ${num(allCards.summary?.verified)} verified / ${num(allCards.summary?.simplified)} simplified / `
          + `${num(allCards.summary?.missing)} missing / ${num(allCards.summary?.blocked)} blocked；`
          + '存在无逐卡可追溯证据的卡，P8 旧账本声称 verified 的结论已被独立复核（docs/edgeOfTheEarth/eote-scan/verify/player-b-verify.md §3）推翻，'
          + '修复后如实登记为 pending。',
      independentAudit: {
        report: 'docs/edgeOfTheEarth/eote-scan/全量扫描报告.md',
        sections: ['§3 P0-11', '§5', '§5.1'],
        priorLedgerClaim: '修复前本仓 P8 账本（audit/eote-migration.json / eote-release-acceptance.json / eote-all-card-acceptance.json）均为 verified/passed，声称全卡逐卡验收完成、115 玩家卡 noSimplified。',
        independentVerdict: '独立复核推翻：all-cards 135/403 字面不可追溯（129 条 scenario-ledger 系统性错配、110 条卡号任何测试都不出现）；player-acceptance 的 noSimplified 只看 flag（55/115 条目自述 approximation）。修复后的账本按可追溯证据重建，不宣称等价。',
      },
      earlyAccess: false,
      required: releaseRequired,
      deferred,
      remaining,
    },
    gates: {
      ...featureChecks,
      pass: status === 'verified',
    },
    remaining,
    evidence: {
      files: Object.fromEntries(sorted([
        PATHS.scope, PATHS.scenario, PATHS.allCards, PATHS.investigators, PATHS.player, PATHS.rules,
        PATHS.interactions, PATHS.node, PATHS.regression, PATHS.playerQueue, PATHS.primitivePlan,
        PATHS.p7Browser, PATHS.releaseBrowser, PATHS.releaseAcceptance, PATHS.storyText,
        ...requests.files.map(file => `${PATHS.primitiveRequests}/${file}`),
        ...GUIDES,
      ].map(path => [path, fileHash(path)]))),
      missingInputs: sorted([...new Set([...missingInputs, ...registry.missingInputs])]),
    },
    sources,
    testFiles: Array.isArray(nodeLedger?.testFiles) ? [...nodeLedger.testFiles] : [],
  }
  return ledger
}

// ---------------------------------------------------------------- CLI
function main() {
  const ledger = buildMigrationLedger()
  const args = process.argv.slice(2)
  const text = json(ledger)
  if (args.includes('--write')) {
    writeJson(TARGET, ledger)
    writeJson(join(RUN, 'migration.json'), ledger)
    const gates = Object.entries(ledger.gates).filter(([key]) => key !== 'pass')
    const passed = gates.filter(([, value]) => value === true).length
    console.log(`eote migration: 已写入 audit/eote-migration.json · ${ledger.milestone} · ${ledger.status}`)
    console.log(`  范围 ${ledger.counts.records} = ${ledger.counts.main} 主卡 + ${ledger.counts.faces} 面；`
      + `三包 ${ledger.partitions.eoteCampaign}/${ledger.partitions.eoteInvestigators}/${ledger.partitions.eotePlayer}；`
      + `8 章 ${ledger.chapters.filter(row => row.verified).length}/8；大厅 ${ledger.campaign.lobbyVisible}；`
      + `assertLaunchable ${ledger.campaign.launchable}`)
    console.log(`  关键词 ${ledger.keywords.verified}/${ledger.keywords.total} · 规则书 ${ledger.rulebook.status}`
      + `（${ledger.rulebook.entries} 条 / ${Object.keys(ledger.rulebook.checks).length} 项）`
      + ` · 关键词账本 ${ledger.keywords.status} · 规则书 ${ledger.rulebook.status}`)
    console.log(`  剧本 ${ledger.chapters.filter(row => row.verified).length}/8 verified · 全卡`
      + ` ${ledger.allCardLedger.summary?.verified ?? 0}/${ledger.allCardLedger.summary?.total ?? 0}`
      + ` · 确认 ${Object.values(ledger.confirmations).every(section => section.status === 'verified') ? 'verified' : 'pending'}`)
    console.log(`  gates ${passed}/${gates.length} · releaseAcceptance ${ledger.releaseAcceptance.status}`
      + ` · deferred ${ledger.releaseAcceptance.deferred.length} · remaining ${ledger.releaseAcceptance.remaining.length}`)
    if (ledger.evidence.missingInputs.length) {
      console.log(`  缺失输入：${ledger.evidence.missingInputs.join(', ')}`)
    }
  } else if (args.includes('--check')) {
    if (!existsSync(TARGET)) {
      console.error('audit/eote-migration.json 不存在：先运行 node tools/audit-eote.mjs --write')
      process.exit(1)
    }
    const disk = readFileSync(TARGET, 'utf8')
    if (disk !== text) {
      let changed = []
      try {
        const previous = JSON.parse(disk)
        changed = Object.keys(ledger).filter(key => JSON.stringify(previous[key]) !== JSON.stringify(ledger[key]))
      } catch {
        changed = ['(JSON 无法解析)']
      }
      console.error(`audit/eote-migration.json 与内容不一致（重新 --write 并审阅 diff）：${changed.join(', ') || '格式/换行'}`)
      process.exit(1)
    }
    console.log(`eote migration: 复算一致 · ${ledger.status}`
      + ` · 范围 ${ledger.counts.records} 条 · 章节 ${ledger.chapters.filter(row => row.verified).length}/8`
      + ` · 关键词 ${ledger.keywords.verified}/${ledger.keywords.total} · 规则书 ${ledger.rulebook.status}`)
  } else {
    console.log(text)
  }
  if (ledger.status !== 'verified') {
    console.error(`eote migration 账本状态 ${ledger.status}：releaseAcceptance ${ledger.releaseAcceptance.status}`
      + ` · remaining ${ledger.releaseAcceptance.remaining.length} 条`
      + (ledger.evidence.missingInputs.length ? ` · 缺失输入 ${ledger.evidence.missingInputs.join(', ')}` : ''))
    process.exitCode = 1
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main()
void SELF
void relative
