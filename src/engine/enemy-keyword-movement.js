import { enemyCanEnterLocation, enemyHasLocationKeyword } from './enemy-entry.js'
import { shortestPaths } from './map-graph.js'
import { canChangeFloodLevel, floodLevel } from './flood.js'
import { enemyIsPart } from './enemy-parts.js'

const active = investigator => !investigator.defeated && !investigator.resigned
const editableKeywords = ['alert', 'aloof', 'elusive', 'retaliate', 'relentless']
const phaseAttacks = new WeakMap()

export function trackEnemyPhaseAttacks(state, resolve) {
  const previous = phaseAttacks.get(state)
  const attempted = new Set()
  phaseAttacks.set(state, attempted)
  try {
    return resolve(attempted)
  } finally {
    if (previous) phaseAttacks.set(state, previous)
    else phaseAttacks.delete(state)
  }
}

export function recordEnemyPhaseAttack(state, enemy) {
  if (state.phase === 'enemy') phaseAttacks.get(state)?.add(enemy.id)
}

export function setEnemyKeywords(state, enemy, keywords, { enabled, throughRound = state.round } = {}) {
  if (!Array.isArray(keywords) || !keywords.length || new Set(keywords).size !== keywords.length
    || keywords.some(keyword => !editableKeywords.includes(keyword)) || typeof enabled !== 'boolean'
    || !Number.isSafeInteger(throughRound) || throughRound < state.round) throw new TypeError('无效敌人关键词调整')
  if (!state.enemies.includes(enemy)) return false
  enemy.keywordOverrides ||= {}
  for (const keyword of keywords) enemy.keywordOverrides[keyword] = { enabled, throughRound }
  return true
}

export function enemyKeywordOverride(state, enemy, keyword) {
  const value = enemy?.keywordOverrides?.[keyword]
  return value && value.throughRound >= state.round ? value.enabled : null
}

export function validateEnemyKeywords(state) {
  for (const enemy of state.enemies || []) {
    const overrides = enemy.keywordOverrides
    if (!overrides) continue
    if (typeof overrides !== 'object' || Array.isArray(overrides)) throw new TypeError('无效敌人关键词存档')
    for (const [keyword, value] of Object.entries(overrides)) {
      if (!editableKeywords.includes(keyword) || typeof value?.enabled !== 'boolean'
        || !Number.isSafeInteger(value?.throughRound) || value.throughRound < 0) throw new TypeError('无效敌人关键词存档')
    }
  }
}

export function enemyHasAttackKeyword(state, enemy, keyword, printed, entryOf) {
  const overridden = enemyKeywordOverride(state, enemy, keyword)
  if (overridden != null) return overridden
  return printed || enemyHasLocationKeyword(state, enemy, keyword) || (enemy.attachments || []).some(card =>
    entryOf(card.originalCode || card.code)?.treacheryRule?.enemyKeywordAura?.keywords?.includes(keyword))
}

export function normalizePatrolTarget(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new TypeError('巡逻目标需要对象')
  const fields = { named: ['locationId'], trait: ['trait', 'minClues'], nearestEmpty: ['trait'], resident: ['assetCode'],
    flood: ['below', 'canIncrease'], enemy: ['maxDoom'] }
  if (!Object.hasOwn(fields, spec.kind) || Object.keys(spec).some(key => !['kind', ...fields[spec.kind]].includes(key))) {
    throw new TypeError('未知巡逻目标')
  }
  const required = { named: ['locationId'], trait: ['trait'], resident: ['assetCode'] }
  for (const key of required[spec.kind] || []) {
    if (typeof spec[key] !== 'string' || !spec[key].trim()) throw new TypeError(`巡逻目标缺少 ${key}`)
  }
  if (spec.minClues != null && (!Number.isSafeInteger(spec.minClues) || spec.minClues < 0)) throw new TypeError('巡逻线索门槛无效')
  if (spec.trait != null && (typeof spec.trait !== 'string' || !spec.trait.trim())) throw new TypeError('巡逻特性无效')
  if (spec.below != null && ![1, 2].includes(spec.below)) throw new TypeError('巡逻淹没门槛无效')
  if (spec.canIncrease != null && typeof spec.canIncrease !== 'boolean') throw new TypeError('巡逻淹没条件无效')
  if (spec.maxDoom != null && (!Number.isSafeInteger(spec.maxDoom) || spec.maxDoom < 0)) throw new TypeError('巡逻毁灭门槛无效')
  return { ...spec }
}

const canEnterLocation = (state, enemy, id) => enemyCanEnterLocation(state, enemy, id)
  && (enemy.elite || !state.locations.find(location => location.id === id)?.barricade)

function destinationChoice(state, enemy, destinations, deps, prompt) {
  if (destinations.length < 2) return destinations[0]
  const chosen = deps.choice({ kind: 'location', source: enemy.id, seat: state.campaign?.leadSeat ?? 0, prompt,
    options: destinations.map(id => ({ id, label: state.locations.find(location => location.id === id)?.name || id })) })
  if (!destinations.includes(chosen)) throw new RangeError('非法敌人移动目标')
  return chosen
}

function qualifyingTargets(state, enemy, spec) {
  if (spec.kind === 'named') return [spec.locationId]
  if (spec.kind === 'resident') {
    const codeOf = asset => asset.originalCode || asset.code
    return [...(state.storyAssets || []).filter(asset => codeOf(asset) === spec.assetCode).map(asset => asset.location),
      ...state.investigators.filter(inv => active(inv) && inv.assets?.some(asset => codeOf(asset) === spec.assetCode)).map(inv => inv.location)]
  }
  if (spec.kind === 'flood') {
    return state.locations.filter(location => floodLevel(state, location.id) < (spec.below ?? 2)
      && (!spec.canIncrease || canChangeFloodLevel(state, location.id, 1))).map(location => location.id)
  }
  if (spec.kind === 'enemy') {
    return state.enemies.filter(other => other !== enemy && !enemyIsPart(other)
      && !other.defeated && other.location != null && (other.doom || 0) <= (spec.maxDoom ?? Infinity)).map(other => other.location)
  }
  const matchesTrait = location => !spec.trait || location.traits?.some(trait => trait.toLowerCase() === spec.trait.toLowerCase())
  return state.locations.filter(location => spec.kind === 'nearestEmpty'
    ? location.id !== enemy.location && !state.investigators.some(inv => active(inv) && inv.location === location.id)
      && !state.enemies.some(other => other.location === location.id) && matchesTrait(location)
    : matchesTrait(location) && (location.clues || 0) >= (spec.minClues || 0))
    .map(location => location.id)
}

export function resolvePatrol(state, enemy, spec, deps) {
  if (!state.enemies.includes(enemy) || enemy.exhausted || enemy.engagedSeat != null || enemy.immobile || enemy.hostId || deps.blanked(enemy)) return false
  const targetSpec = normalizePatrolTarget(spec)
  const targetIds = [...new Set(qualifyingTargets(state, enemy, targetSpec))]
  const reachable = targetIds.map(id => ({ id, paths: shortestPaths(state.locations, enemy.location, id, to => canEnterLocation(state, enemy, to)) }))
    .filter(row => row.paths.length)
  const closest = Math.min(...reachable.map(row => row.paths[0].length))
  const nearest = ['nearestEmpty', 'flood', 'enemy'].includes(targetSpec.kind)
  const available = nearest ? reachable.filter(row => row.paths[0].length === closest) : reachable
  const selected = destinationChoice(state, enemy, available.map(row => row.id), deps, '选择巡逻的目标地点。')
  if (!selected || selected === enemy.location) return false
  const steps = [...new Set(available.find(row => row.id === selected).paths.map(path => path[1]))]
  const next = destinationChoice(state, enemy, steps, deps, '选择巡逻的最短路径。')
  return deps.move(enemy, next, { cause: 'patrol', routeSelected: true }) || false
}

const resolving = new WeakSet()
export function resolveElusive(state, enemy, enabled, deps) {
  if (!enabled || !state.enemies.includes(enemy) || enemy.exhausted || resolving.has(enemy) || deps.blanked(enemy)) return false
  const origin = state.locations.find(location => location.id === enemy.location)
  const candidates = enemy.immobile ? [] : [...new Set(origin?.connections || [])].filter(id => id !== origin.id && canEnterLocation(state, enemy, id))
  const unoccupied = candidates.filter(id => !state.investigators.some(inv => active(inv) && inv.location === id))
  const destination = destinationChoice(state, enemy, unoccupied.length ? unoccupied : candidates, deps, '选择逃逸的连接地点。')
  resolving.add(enemy)
  try {
    deps.disengage(enemy)
    if (destination) deps.move(enemy, destination, { cause: 'elusive', routeSelected: true, skipAutoEngage: true })
    if (state.enemies.includes(enemy)) deps.exhaust(enemy)
  } finally {
    resolving.delete(enemy)
  }
  return true
}

export function resolveElusiveAfterAttack(state, enemy, entryOf, runtime, blanked) {
  if (!enemy || enemy.exhausted || !state.enemies.includes(enemy) || blanked(enemy)) return false
  const printed = entryOf(enemy.originalCode || enemy.code)?.enemyRule?.elusive === true
  if (!enemyHasAttackKeyword(state, enemy, 'elusive', printed, entryOf)) return false
  const api = runtime()
  return resolveElusive(state, enemy, true, { blanked, choice: api.choose, move: api.moveEnemy,
    disengage: api.disengage, exhaust: api.exhaustEnemy })
}
