// P0 content contract. Manifests are plain data; executable handlers are registered separately.
// This module does not turn catalog entries into playable cards or scenarios.
import { missingMechanics } from './mechanics.js'
export const CONTENT_SCHEMA_VERSION = 1
export const CONTENT_STATUSES = Object.freeze(['catalog-only', 'development', 'playable', 'verified'])
export const UI_STATES = Object.freeze([
  'campaignHub', 'scenarioSetup', 'inScenario', 'scenarioResult', 'interlude', 'campaignResult',
])

const LAUNCHABLE = new Set(['playable', 'verified'])
const ID = /^[a-z][A-Za-z0-9-]*$/
const VERSION = /^\d+\.\d+\.\d+$/
const RULES_VERSION = /^n(\d+)\.(\d+)$/

function fail(path, message) { throw new TypeError(`${path}: ${message}`) }
function object(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(path, '必须是对象')
  return value
}
function string(value, path) {
  if (typeof value !== 'string' || !value.trim()) fail(path, '必须是非空字符串')
  return value
}
function id(value, path) {
  string(value, path)
  if (!ID.test(value)) fail(path, '必须是稳定的 ASCII ID')
  return value
}
function list(value, path, read = string) {
  if (!Array.isArray(value)) fail(path, '必须是数组')
  const seen = new Set()
  for (let i = 0; i < value.length; i++) {
    const item = read(value[i], `${path}[${i}]`)
    if (seen.has(item)) fail(path, `重复项 ${item}`)
    seen.add(item)
  }
  return value
}
function manifest(value, path) {
  object(value, path)
  if (value.schemaVersion !== CONTENT_SCHEMA_VERSION) fail(`${path}.schemaVersion`, `仅支持 ${CONTENT_SCHEMA_VERSION}`)
  id(value.id, `${path}.id`)
  if (!VERSION.test(string(value.contentVersion, `${path}.contentVersion`))) fail(`${path}.contentVersion`, '必须是 major.minor.patch')
  if (!RULES_VERSION.test(string(value.minRulesVersion, `${path}.minRulesVersion`))) fail(`${path}.minRulesVersion`, '必须是 n<major>.<minor>')
  if (!CONTENT_STATUSES.includes(value.status)) fail(`${path}.status`, '未知内容状态')
  return value
}
function refs(value, path) { return list(value, path, id) }
function items(value, path) {
  if (!Array.isArray(value) || value.length === 0) fail(path, '必须是非空数组')
  const seen = new Set()
  for (let i = 0; i < value.length; i++) {
    const item = object(value[i], `${path}[${i}]`)
    id(item.id, `${path}[${i}].id`)
    if (seen.has(item.id)) fail(path, `重复 ID ${item.id}`)
    seen.add(item.id)
  }
  return seen
}
function ruleVersion(value, path) {
  const match = RULES_VERSION.exec(string(value, path))
  if (!match) fail(path, '必须是 n<major>.<minor>')
  return [Number(match[1]), Number(match[2])]
}
function assertSupported(manifestValue, currentRulesVersion, path) {
  const required = ruleVersion(manifestValue.minRulesVersion, `${path}.minRulesVersion`)
  const current = ruleVersion(currentRulesVersion, 'rulesVersion')
  if (required[0] > current[0] || (required[0] === current[0] && required[1] > current[1])) {
    fail(path, `需要规则版本 ${manifestValue.minRulesVersion}，当前为 ${currentRulesVersion}`)
  }
}

export function assertPackManifest(pack) {
  manifest(pack, 'pack')
  refs(pack.dependencies, 'pack.dependencies')
  if (!Array.isArray(pack.cardRanges)) fail('pack.cardRanges', '必须是数组')
  for (const [i, rangeValue] of pack.cardRanges.entries()) {
    const range = object(rangeValue, `pack.cardRanges[${i}]`)
    const from = string(range.from, `pack.cardRanges[${i}].from`)
    const to = string(range.to, `pack.cardRanges[${i}].to`)
    if (!/^\d+[a-z]?$/.test(from) || !/^\d+[a-z]?$/.test(to) || from.length !== to.length || from > to) {
      fail(`pack.cardRanges[${i}]`, '卡号范围必须是等长原卡号且起点不大于终点')
    }
  }
  if (!Array.isArray(pack.cards)) fail('pack.cards', '必须是数组')
  const codes = new Set()
  for (const [i, cardValue] of pack.cards.entries()) {
    const card = object(cardValue, `pack.cards[${i}]`)
    const code = string(card.code, `pack.cards[${i}].code`)
    if (codes.has(code)) fail('pack.cards', `重复卡号 ${code}`)
    codes.add(code)
    if (!pack.cardRanges.some(range => code.length === range.from.length && code >= range.from && code <= range.to)) {
      fail(`pack.cards[${i}].code`, `卡号 ${code} 不在声明范围内`)
    }
    if (!['player', 'encounter', 'other'].includes(card.type)) fail(`pack.cards[${i}].type`, '未知卡牌类型')
    for (const key of ['cataloged', 'imageAvailable', 'rulesImplemented', 'deckbuilding']) {
      if (typeof card[key] !== 'boolean') fail(`pack.cards[${i}].${key}`, '必须是布尔值')
    }
    if (card.requiredMechanicIds !== undefined) refs(card.requiredMechanicIds, `pack.cards[${i}].requiredMechanicIds`)
    if (card.blockedReason && card.deckbuilding) fail(`pack.cards[${i}]`, '依赖阻断的卡不能开放构筑')
    if (card.deckbuilding && (card.type !== 'player' || !card.cataloged || !card.rulesImplemented)) {
      fail(`pack.cards[${i}].deckbuilding`, '构筑开放需要玩家卡、目录收录和规则实现')
    }
  }
  refs(pack.encounterGroupIds, 'pack.encounterGroupIds')
  refs(pack.behaviorIds, 'pack.behaviorIds')
  return pack
}

export function assertCampaignManifest(campaign) {
  manifest(campaign, 'campaign')
  string(campaign.name, 'campaign.name')
  refs(campaign.requiredPackIds, 'campaign.requiredPackIds')
  const order = refs(campaign.scenarioIds, 'campaign.scenarioIds')
  if (!order.length) fail('campaign.scenarioIds', '至少需要一个关卡')
  object(campaign.unlock, 'campaign.unlock')
  for (const scenarioId of order) {
    const preceding = refs(campaign.unlock[scenarioId], `campaign.unlock.${scenarioId}`)
    if (preceding.some(prior => !order.slice(0, order.indexOf(scenarioId)).includes(prior))) {
      fail(`campaign.unlock.${scenarioId}`, '前置关卡必须已在顺序中出现')
    }
  }
  for (const scenarioId of Object.keys(campaign.unlock)) {
    if (!order.includes(scenarioId)) fail('campaign.unlock', `未知关卡 ${scenarioId}`)
  }
  const bags = object(campaign.chaosBags, 'campaign.chaosBags')
  if (!Object.keys(bags).length) fail('campaign.chaosBags', '至少需要一个难度')
  for (const [difficulty, tokens] of Object.entries(bags)) {
    id(difficulty, `campaign.chaosBags.${difficulty}`)
    if (!Array.isArray(tokens) || !tokens.length) fail(`campaign.chaosBags.${difficulty}`, '必须有混乱标记')
    tokens.forEach((token, i) => string(token, `campaign.chaosBags.${difficulty}[${i}]`))
  }
  const records = object(campaign.recordSchema, 'campaign.recordSchema')
  for (const [key, type] of Object.entries(records)) {
    id(key, `campaign.recordSchema.${key}`)
    if (!['boolean', 'number', 'string', 'string[]'].includes(type)) {
      fail(`campaign.recordSchema.${key}`, '未知战役记录字段类型')
    }
  }
  id(campaign.interludeHandlerId, 'campaign.interludeHandlerId')
  refs(campaign.resolutionIds, 'campaign.resolutionIds')
  if (!campaign.resolutionIds.length) fail('campaign.resolutionIds', '至少需要一个战役结局')
  return campaign
}

export function assertUiLayout(layout, locationIds, connections = new Set()) {
  object(layout, 'scenario.layout')
  const coordinates = object(layout.locations, 'scenario.layout.locations')
  for (const [locationId, point] of Object.entries(coordinates)) {
    if (!locationIds.has(locationId)) fail('scenario.layout.locations', `未知地点 ${locationId}`)
    object(point, `scenario.layout.locations.${locationId}`)
    for (const axis of ['x', 'y']) {
      if (typeof point[axis] !== 'number' || !Number.isFinite(point[axis])) {
        fail(`scenario.layout.locations.${locationId}.${axis}`, '必须是有限数字')
      }
    }
  }
  if (!Array.isArray(layout.edges)) fail('scenario.layout.edges', '必须是数组')
  for (const [i, edgeValue] of layout.edges.entries()) {
    const edge = object(edgeValue, `scenario.layout.edges[${i}]`)
    const from = id(edge.from, `scenario.layout.edges[${i}].from`)
    const to = id(edge.to, `scenario.layout.edges[${i}].to`)
    if (!locationIds.has(from) || !locationIds.has(to)) fail(`scenario.layout.edges[${i}]`, '端点不是关卡地点')
    if (!connections.has(`${from}>${to}`)) fail(`scenario.layout.edges[${i}]`, '展示连线不得创建规则连接')
    if (edge.curve !== undefined && (typeof edge.curve !== 'number' || !Number.isFinite(edge.curve))) {
      fail(`scenario.layout.edges[${i}].curve`, '必须是有限数字')
    }
  }
  return layout
}

export function assertScenarioManifest(scenario) {
  manifest(scenario, 'scenario')
  id(scenario.campaignId, 'scenario.campaignId')
  string(scenario.name, 'scenario.name')
  refs(scenario.requiredPackIds, 'scenario.requiredPackIds')
  refs(scenario.requiredEncounterGroupIds, 'scenario.requiredEncounterGroupIds')
  refs(scenario.requiredInvestigatorIds, 'scenario.requiredInvestigatorIds')
  refs(scenario.requiredMechanicIds, 'scenario.requiredMechanicIds')
  // A future chapter can reserve its real reference-card identity without
  // inventing a playable map, setup, acts or resolutions. Promotion must remove
  // this marker and satisfy the complete scenario contract below.
  if (scenario.catalogReferenceOnly) {
    if (scenario.status !== 'catalog-only') fail('scenario.catalogReferenceOnly', '仅图鉴关卡不能开放游玩')
    string(scenario.referenceCode, 'scenario.referenceCode')
    for (const key of ['locations', 'acts', 'agendas', 'resolutionIds', 'recordReads', 'recordWrites']) {
      if (!Array.isArray(scenario[key]) || scenario[key].length) fail(`scenario.${key}`, '仅图鉴占位必须为空数组')
    }
    refs(scenario.behaviorIds, 'scenario.behaviorIds')
    for (const zone of ['encounterDeck', 'setAside', 'removed', 'victory']) {
      if (!Array.isArray(scenario.zones?.[zone]) || scenario.zones[zone].length) fail(`scenario.zones.${zone}`, '仅图鉴占位不得声明布置')
    }
    return scenario
  }
  const locations = items(scenario.locations, 'scenario.locations')
  const connections = new Set()
  for (const [i, location] of scenario.locations.entries()) {
    string(location.frontCode, `scenario.locations[${i}].frontCode`)
    string(location.backCode, `scenario.locations[${i}].backCode`)
    refs(location.connections, `scenario.locations[${i}].connections`)
    for (const target of location.connections) {
      if (!locations.has(target) || target === location.id) fail(`scenario.locations[${i}].connections`, `无效地点 ${target}`)
      connections.add(`${location.id}>${target}`)
    }
  }
  if (!locations.has(scenario.startLocationId)) fail('scenario.startLocationId', '必须指向已声明地点')
  const zones = object(scenario.zones, 'scenario.zones')
  for (const zone of ['encounterDeck', 'setAside', 'removed', 'victory', ...(Object.hasOwn(zones, 'inPlay') ? ['inPlay'] : [])]) {
    const entries = zones[zone]
    if (!Array.isArray(entries)) fail(`scenario.zones.${zone}`, '必须是数组')
    const codes = new Set()
    for (const [i, entryValue] of entries.entries()) {
      const entry = object(entryValue, `scenario.zones.${zone}[${i}]`)
      const code = string(entry.cardCode, `scenario.zones.${zone}[${i}].cardCode`)
      if (codes.has(code)) fail(`scenario.zones.${zone}`, `重复卡号 ${code}`)
      codes.add(code)
      if (!Number.isSafeInteger(entry.count) || entry.count < 1) {
        fail(`scenario.zones.${zone}[${i}].count`, '必须是正整数')
      }
    }
  }
  items(scenario.acts, 'scenario.acts')
  items(scenario.agendas, 'scenario.agendas')
  refs(scenario.resolutionIds, 'scenario.resolutionIds')
  if (!scenario.resolutionIds.length) fail('scenario.resolutionIds', '至少需要一个结局')
  refs(scenario.recordReads, 'scenario.recordReads')
  refs(scenario.recordWrites, 'scenario.recordWrites')
  refs(scenario.behaviorIds, 'scenario.behaviorIds')
  assertUiLayout(scenario.layout, locations, connections)
  return scenario
}

export function assertContentBundle(bundle, currentRulesVersion) {
  object(bundle, 'bundle')
  if (!Array.isArray(bundle.packs) || !Array.isArray(bundle.campaigns) || !Array.isArray(bundle.scenarios)) {
    fail('bundle', 'packs、campaigns 和 scenarios 必须是数组')
  }
  const unique = (values, path, validate) => {
    const result = new Map()
    for (const value of values) {
      validate(value)
      if (result.has(value.id)) fail(path, `重复 ID ${value.id}`)
      result.set(value.id, value)
    }
    return result
  }
  const packs = unique(bundle.packs, 'bundle.packs', assertPackManifest)
  const campaigns = unique(bundle.campaigns, 'bundle.campaigns', assertCampaignManifest)
  const scenarios = unique(bundle.scenarios, 'bundle.scenarios', assertScenarioManifest)
  for (const pack of packs.values()) {
    for (const dependency of pack.dependencies) {
      if (!packs.has(dependency) || dependency === pack.id) fail(`pack.${pack.id}`, `缺少或循环依赖 ${dependency}`)
    }
  }
  const visited = new Set()
  const visiting = new Set()
  const visit = packId => {
    if (visiting.has(packId)) fail(`pack.${packId}`, '卡包依赖存在环')
    if (visited.has(packId)) return
    visiting.add(packId)
    for (const dependency of packs.get(packId).dependencies) visit(dependency)
    visiting.delete(packId)
    visited.add(packId)
  }
  for (const packId of packs.keys()) visit(packId)
  for (const campaign of campaigns.values()) {
    for (const packId of campaign.requiredPackIds) if (!packs.has(packId)) fail(`campaign.${campaign.id}`, `缺少卡包 ${packId}`)
    for (const scenarioId of campaign.scenarioIds) {
      const scenario = scenarios.get(scenarioId)
      if (!scenario || scenario.campaignId !== campaign.id) fail(`campaign.${campaign.id}`, `缺少所属关卡 ${scenarioId}`)
    }
  }
  for (const scenario of scenarios.values()) {
    const campaign = campaigns.get(scenario.campaignId)
    if (!campaign || !campaign.scenarioIds.includes(scenario.id)) fail(`scenario.${scenario.id}`, '战役未登记此关卡')
    for (const packId of scenario.requiredPackIds) if (!packs.has(packId)) fail(`scenario.${scenario.id}`, `缺少卡包 ${packId}`)
    const groups = new Set([...campaign.requiredPackIds, ...scenario.requiredPackIds]
      .flatMap(packId => packs.get(packId).encounterGroupIds))
    for (const groupId of scenario.requiredEncounterGroupIds) {
      if (!groups.has(groupId)) fail(`scenario.${scenario.id}`, `缺少遭遇组 ${groupId}`)
    }
    for (const key of [...scenario.recordReads, ...scenario.recordWrites]) {
      if (!Object.hasOwn(campaign.recordSchema, key)) fail(`scenario.${scenario.id}`, `未声明战役记录 ${key}`)
    }
  }
  ruleVersion(currentRulesVersion, 'rulesVersion')
  return { packs, campaigns, scenarios }
}

export function assertLaunchableCampaign(bundle, campaignId, currentRulesVersion) {
  const { packs, campaigns, scenarios } = assertContentBundle(bundle, currentRulesVersion)
  const campaign = campaigns.get(campaignId)
  if (!campaign) fail('campaignId', `未知战役 ${campaignId}`)
  const requireReady = (entry, path) => {
    if (!LAUNCHABLE.has(entry.status)) fail(path, `发布状态 ${entry.status} 不可启动`)
    assertSupported(entry, currentRulesVersion, path)
  }
  const checkedPacks = new Set()
  const requirePack = packId => {
    if (checkedPacks.has(packId)) return
    const pack = packs.get(packId)
    requireReady(pack, `pack.${packId}`)
    checkedPacks.add(packId)
    for (const dependency of pack.dependencies) requirePack(dependency)
  }
  requireReady(campaign, `campaign.${campaignId}`)
  campaign.requiredPackIds.forEach(requirePack)
  for (const scenarioId of campaign.scenarioIds) {
    const scenario = scenarios.get(scenarioId)
    requireReady(scenario, `scenario.${scenarioId}`)
    const missing = missingMechanics(scenario.requiredMechanicIds)
    if (missing.length) fail(`scenario.${scenarioId}`, `缺少机制 ${missing.join('、')}`)
    scenario.requiredPackIds.forEach(requirePack)
  }
  return campaign
}
