import { ALL_CARDS } from '../src/cards/cards-data.js'
import { CONTENT_SCHEMA_VERSION } from './schema.js'

function originalCode(scenario, alias, sharedIdentities = {}) {
  const definitions = [scenario.enemies?.[alias], scenario.treacheries?.[alias], scenario.storyAssets?.[alias]]
    .filter(Boolean)
  const originals = new Set(definitions.map(definition => definition.originalCode || definition.code || alias))
  if (sharedIdentities[alias]) originals.add(sharedIdentities[alias])
  if (originals.size > 1) throw new Error(`${scenario.id}: 身份别名 ${alias} 不唯一`)
  const code = [...originals][0] || (Object.hasOwn(ALL_CARDS, alias) ? alias : null)
  if (!code || !Object.hasOwn(ALL_CARDS, code)) throw new Error(`${scenario.id}: 身份别名 ${alias} 缺少目录原卡`)
  return code
}

export function countZone(scenario, aliases, sharedIdentities = {}) {
  const byCode = new Map()
  for (const alias of aliases) {
    const code = originalCode(scenario, alias, sharedIdentities)
    byCode.set(code, (byCode.get(code) || 0) + 1)
  }
  return [...byCode].sort(([a], [b]) => a.localeCompare(b))
    .map(([cardCode, count]) => ({ cardCode, count }))
}

export function layoutFor(scenario, coordinates) {
  const locations = Object.fromEntries(Object.entries(coordinates).map(([id, point]) => [id, { ...point }]))
  const edges = Object.values(scenario.locations).flatMap(location =>
    location.connections.map(to => ({ from: location.id, to })))
  return { locations, edges }
}

export function scenarioManifest(scenario, identities, {
  requiredPackIds = ['core', 'notz'], requiredEncounterGroupIds = [],
  requiredInvestigatorIds = [], requiredMechanicIds = [], recordReads = [], recordWrites = [],
  behaviorIds = [], layout, status = 'playable', sharedIdentities = {},
  setAsideAliases = [], inPlayAliases = [],
  campaignId = 'nightOfTheZealot',
} = {}) {
  const locations = Object.values(scenario.locations).map(location => {
    const identity = identities.locations?.[location.id]
    if (!identity?.originalCode) throw new Error(`${scenario.id}: 地点 ${location.id} 缺少原卡身份`)
    return { id: location.id, frontCode: identity.originalCode,
      backCode: identity.linkedOriginalCode || identity.originalCode,
      connections: [...location.connections] }
  })
  const sideAliases = [...(scenario.cultistDeck || []),
    ...Object.values(scenario.agentSets || {}).flat()]
  const setAsideLocations = (scenario.setAsideLocations || []).map(id => {
    const code = identities.locations?.[id]?.originalCode
    if (!code) throw new Error(`${scenario.id}: 放在一边的地点 ${id} 缺少身份`)
    return code
  })
  const zones = {
    encounterDeck: countZone(scenario, scenario.encounterDeck, sharedIdentities),
    setAside: countZone(scenario, sideAliases.concat(setAsideLocations, setAsideAliases), sharedIdentities),
    removed: [], victory: [],
    ...(inPlayAliases.length ? { inPlay: countZone(scenario, inPlayAliases, sharedIdentities) } : {}),
  }
  return {
    schemaVersion: CONTENT_SCHEMA_VERSION, id: scenario.id, campaignId,
    name: scenario.name, contentVersion: '1.0.0', minRulesVersion: 'n4.2', status,
    requiredPackIds, requiredEncounterGroupIds, requiredInvestigatorIds, requiredMechanicIds,
    locations, startLocationId: scenario.startLocation, zones,
    acts: scenario.acts.map(act => ({ id: act.id })),
    agendas: scenario.agendas.map(agenda => ({ id: agenda.id })),
    resolutionIds: Object.keys(scenario.resolutions), recordReads, recordWrites, behaviorIds,
    layout,
  }
}

export function scenarioZoneReport(scenario, manifest, sharedIdentities = {}) {
  const optionalSets = Object.fromEntries(Object.entries(scenario.agentSets || {}).map(([id, aliases]) =>
    [id, countZone(scenario, aliases, sharedIdentities)]))
  const encounterCards = manifest.zones.encounterDeck.reduce((sum, entry) => sum + entry.count, 0)
  const sideCards = manifest.zones.setAside.reduce((sum, entry) => sum + entry.count, 0)
  const baseDeck = new Map(manifest.zones.encounterDeck.map(entry => [entry.cardCode, entry.count]))
  for (const entry of manifest.zones.inPlay || []) {
    if (baseDeck.has(entry.cardCode)) throw new Error(`${scenario.id}: 多个初始区域重复入牌 ${entry.cardCode}`)
    baseDeck.set(entry.cardCode, entry.count)
  }
  const allAside = new Map(manifest.zones.setAside.map(entry => [entry.cardCode, entry.count]))
  const optionalTotals = new Map()
  for (const entries of Object.values(optionalSets)) for (const entry of entries) {
    optionalTotals.set(entry.cardCode, (optionalTotals.get(entry.cardCode) || 0) + entry.count)
  }
  const fixedAside = new Map([...allAside].map(([code, count]) => [code, count - (optionalTotals.get(code) || 0)]))
  if ([...fixedAside.values()].some(count => count < 0)) throw new Error(`${scenario.id}: 可选遭遇组超出放在一边区域`)
  const collision = [...baseDeck.keys()].filter(code => (fixedAside.get(code) || 0) > 0)
  if (collision.length) throw new Error(`${scenario.id}: 多个初始区域重复入牌 ${collision.join(', ')}`)
  const optionalCollisions = []
  for (const [setId, entries] of Object.entries(optionalSets)) {
    for (const entry of entries) {
      if (baseDeck.has(entry.cardCode) || (fixedAside.get(entry.cardCode) || 0) > 0) {
        optionalCollisions.push(`${setId}:${entry.cardCode}`)
      }
    }
  }
  if (optionalCollisions.length) throw new Error(`${scenario.id}: 可选遭遇组重复入牌 ${optionalCollisions.join(', ')}`)
  const allCodes = new Set([...baseDeck.keys(), ...allAside.keys(),
    ...Object.values(optionalSets).flat().map(entry => entry.cardCode)])
  for (const code of allCodes) {
    const card = ALL_CARDS[code]
    if (!card) throw new Error(`${scenario.id}: 缺少目录原卡 ${code}`)
    const count = (baseDeck.get(code) || 0) + (fixedAside.get(code) || 0)
      + Math.max(0, ...Object.values(optionalSets).map(entries => entries.find(entry => entry.cardCode === code)?.count || 0))
    if (count > (card.quantity || 1)) throw new Error(`${scenario.id}: ${code} 需要 ${count} 张，目录只有 ${card.quantity || 1} 张`)
  }
  return { scenarioId: scenario.id, encounterCards, declaredSetAsideCards: sideCards,
    ...(manifest.zones.inPlay ? { inPlayCards: manifest.zones.inPlay.reduce((sum, entry) => sum + entry.count, 0) } : {}),
    cultistDeckCards: (scenario.cultistDeck || []).length, optionalSets,
    locationCount: Object.keys(scenario.locations).length,
    identityCount: Object.values(manifest.zones).flat().length,
    unresolvedAliases: [], duplicateActiveZoneCodes: collision, optionalZoneCollisions: optionalCollisions,
    checkedCatalogCodes: allCodes.size }
}
