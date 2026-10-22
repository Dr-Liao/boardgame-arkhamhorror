// 非玩家条目的归属算法（扫描器 / scaffold / 守卫共用）。
//
// 归属不是永久标签：新关卡或新遭遇组开始使用某张卡后，它可能从「关卡专用」变成
// 「战役共用 / 跨战役通用」。改内容时重跑本算法并移动文件；守卫按当前 content/ 校验路径。
//
// 规则（docs/encounter-entry-split-plan.md §3）：
//   1. 用条目 code、cards-data.originalCode、scenarioReferences[].ruleId 在全部已注册关卡的
//      definition 与 manifest zones 里匹配；
//   2. 命中 1 个关卡 → <campaign>/<scenario>/；同一战役多个关卡 → <campaign>/_shared/；
//      跨战役 → shared/；
//   3. 组目录 = cards-data.encounterCode（snake_case，已统一）；没有组的放 story/；
//   4. 运行时别名条目跟随「同名印刷卡条目」（要求唯一），不合并内容。
//
// 纯函数部分（collectScenarioTokens / resolvePlacement / resolvePlacements）不读文件系统，
// 输入由 loadPlacementIndex() 从 content/registered.js 与 cards-data.js 组装。

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import { contentRegistry } from '../content/registered.js'

const SCOPES = Object.freeze(['enemy', 'location', 'act', 'agenda', 'treachery', 'storyAsset', 'threat'])
export const ENTRY_SCOPES = SCOPES

export const canonical = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

function addToken(tokens, value) {
  if (value == null) return
  const text = String(value).trim()
  if (text) tokens.add(text)
}

// 一个关卡的全部匹配 token：definition 的卡号 / 运行时 id，以及 manifest 的区域卡号。
export function collectScenarioTokens(scenario = {}, manifest = {}) {
  const tokens = new Set()
  for (const category of ['locations', 'locationVariants']) {
    const value = scenario[category]
    const groups = category === 'locationVariants' ? Object.values(value || {}) : [Object.values(value || {})]
    for (const group of groups) {
      for (const definition of Object.values(group || {})) {
        addToken(tokens, definition?.id)
        addToken(tokens, definition?.code)
        addToken(tokens, definition?.originalCode)
      }
    }
  }
  for (const category of ['acts', 'agendas']) {
    for (const definition of scenario[category] || []) {
      addToken(tokens, definition?.id)
      addToken(tokens, definition?.code)
      addToken(tokens, definition?.originalCode)
    }
  }
  for (const category of ['enemies', 'treacheries', 'storyAssets']) {
    for (const [key, definition] of Object.entries(scenario[category] || {})) {
      addToken(tokens, key)
      addToken(tokens, definition?.id)
      addToken(tokens, definition?.code)
      addToken(tokens, definition?.originalCode)
    }
  }
  for (const zone of Object.values(manifest.zones || {})) {
    for (const entry of zone || []) addToken(tokens, entry?.cardCode)
  }
  for (const location of manifest.locations || []) {
    addToken(tokens, location?.frontCode)
    addToken(tokens, location?.backCode)
  }
  addToken(tokens, manifest.startLocationId)
  return tokens
}

// Node 侧组装：29 个已注册关卡（content/registered.js 是唯一真值来源）。
let cached = null
export function loadPlacementIndex({ registry = contentRegistry, cards = ALL_CARDS } = {}) {
  if (cached && registry === contentRegistry && cards === ALL_CARDS) return cached
  const campaigns = new Map()
  for (const campaign of registry.listCampaigns()) campaigns.set(campaign.id, campaign)
  const scenarios = registry.listScenarios().map(manifest => {
    const data = registry.getScenarioData(manifest.id)
    const campaign = campaigns.get(manifest.campaignId) || {}
    return {
      id: manifest.id,
      campaignId: manifest.campaignId,
      campaignName: campaign.name || manifest.campaignId,
      name: manifest.name || manifest.id,
      tokens: collectScenarioTokens(data, manifest),
      groupIds: new Set((manifest.requiredEncounterGroupIds || []).map(canonical)),
    }
  })
  const index = { cards, scenarios, campaigns }
  if (registry === contentRegistry && cards === ALL_CARDS) cached = index
  return index
}

function entryTokens(entry, card) {
  const tokens = new Set()
  addToken(tokens, entry.code)
  addToken(tokens, card?.originalCode)
  for (const reference of card?.scenarioReferences || []) addToken(tokens, reference?.ruleId)
  return tokens
}

function bucketOf(hits) {
  if (!hits.length) return null
  if (hits.length === 1) return 'scenario'
  const campaigns = new Set(hits.map(hit => hit.campaignId))
  return campaigns.size === 1 ? 'campaign' : 'shared'
}

function targetPathFor({ bucket, campaignId, scenarioId, group, code }) {
  const directory = group || 'story'
  if (bucket === 'scenario') return `${campaignId}/${scenarioId}/${code}.js`
  if (bucket === 'campaign') return `${campaignId}/_shared/${directory}/${code}.js`
  return `shared/${directory}/${code}.js`
}

function emptyPlacement(entry, reason) {
  return {
    code: entry.code, scope: entry.scope || null, name: entry.name || null,
    bucket: null, campaignId: null, scenarioId: null, scenarios: [], group: null,
    targetPath: null, unresolved: true, reason,
  }
}

// 单条目归属（不处理别名）。
export function resolvePlacement(entry, index = loadPlacementIndex()) {
  const card = index.cards[entry.code] || null
  const tokens = entryTokens(entry, card)
  let hits = index.scenarios.filter(scenario => [...tokens].some(token => scenario.tokens.has(token)))
  let matchedBy = 'tokens'
  if (!hits.length && card?.encounterCode) {
    const group = canonical(card.encounterCode)
    hits = index.scenarios.filter(scenario => scenario.groupIds.has(group))
    matchedBy = 'group'
  }
  if (!hits.length) return emptyPlacement(entry, 'no-scenario')
  const bucket = bucketOf(hits)
  const group = card?.encounterCode || null
  const scenarioId = bucket === 'scenario' ? hits[0].id : null
  const campaignId = bucket === 'scenario' ? hits[0].campaignId
    : bucket === 'campaign' ? hits[0].campaignId : null
  return {
    code: entry.code, scope: entry.scope || null, name: entry.name || null,
    bucket, campaignId, scenarioId, scenarios: hits.map(hit => hit.id), group,
    campaignName: hits[0].campaignName || null,
    scenarioName: bucket === 'scenario' ? hits[0].name : null,
    targetPath: targetPathFor({ bucket, campaignId, scenarioId, group, code: entry.code }),
    unresolved: false, matchedBy,
  }
}

// 全量归属：先逐条解析，再让运行时别名继承「同名印刷卡条目」。
export function resolvePlacements(entries, index = loadPlacementIndex()) {
  const placements = new Map(entries.map(entry => [entry.code, resolvePlacement(entry, index)]))
  const byName = new Map()
  for (const entry of entries) {
    if (!index.cards[entry.code]) continue
    const name = entry.name || index.cards[entry.code].nameZh || index.cards[entry.code].name
    if (!name) continue
    if (!byName.has(name)) byName.set(name, [])
    byName.get(name).push(entry.code)
  }
  for (const entry of entries) {
    if (index.cards[entry.code]) continue
    const name = entry.name || null
    const candidates = name ? byName.get(name) || [] : []
    if (candidates.length !== 1) continue
    const inherited = placements.get(candidates[0])
    if (!inherited || inherited.unresolved) continue
    const placement = placements.get(entry.code)
    placements.set(entry.code, {
      ...placement,
      bucket: inherited.bucket,
      campaignId: inherited.campaignId,
      scenarioId: inherited.scenarioId,
      scenarios: [...inherited.scenarios],
      group: inherited.group,
      campaignName: inherited.campaignName,
      scenarioName: inherited.scenarioName,
      targetPath: targetPathFor({ ...inherited, code: entry.code }),
      unresolved: false,
      matchedBy: 'alias',
      aliasOf: candidates[0],
    })
  }
  return [...placements.values()]
}

// 目录 → 归属档位，供注释/报告使用。
export function describePlacement(placement) {
  if (placement.unresolved) return '未归属'
  if (placement.bucket === 'scenario') return `关卡专用 · ${placement.scenarioId}`
  if (placement.bucket === 'campaign') return `战役共用 · ${placement.campaignId}`
  return '跨战役通用'
}

async function main() {
  const { NON_PLAYER_ABILITY_ENTRIES } = await import('../src/cards/encounter-abilities.js')
  const index = loadPlacementIndex()
  const placements = resolvePlacements(NON_PLAYER_ABILITY_ENTRIES, index)
  const unresolved = placements.filter(placement => placement.unresolved)
  const directories = new Map()
  for (const placement of placements) {
    const directory = placement.targetPath ? placement.targetPath.slice(0, placement.targetPath.lastIndexOf('/')) : '(unresolved)'
    directories.set(directory, (directories.get(directory) || 0) + 1)
  }
  const payload = {
    generatedAt: new Date().toISOString(),
    scenarios: index.scenarios.length,
    entries: placements.length,
    buckets: Object.fromEntries(['shared', 'campaign', 'scenario'].map(bucket =>
      [bucket, placements.filter(placement => placement.bucket === bucket).length])),
    directories: Object.fromEntries([...directories].sort(([a], [b]) => a.localeCompare(b))),
    unresolved: unresolved.map(placement => ({ code: placement.code, name: placement.name, reason: placement.reason })),
    placements,
  }
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(payload, null, 2))
    return
  }
  console.log(JSON.stringify({
    scenarios: payload.scenarios,
    entries: payload.entries,
    buckets: payload.buckets,
    directories: Object.keys(payload.directories).length,
    unresolved: payload.unresolved,
  }, null, 2))
  if (unresolved.length) process.exit(1)
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (invokedDirectly) {
  await main().catch(error => {
    console.error(error?.stack || String(error))
    process.exit(1)
  })
}
