import { enemyCanEnterLocation, enemyHasLocationKeyword } from './enemy-entry.js'
import { shortestPaths } from './map-graph.js'
import { canChangeFloodLevel, floodLevel } from './flood.js'
import { enemyIsPart } from './enemy-parts.js'
import { registeredEntry } from './ability.js'
import { normalizePatrolTarget } from './patrol-target.js'
import { enemyTextBlanked } from './card-text.js'
import { vehicleOf } from './vehicles.js'

export { normalizePatrolTarget }

const active = investigator => !investigator.defeated && !investigator.resigned
// 可编辑关键词白名单：内容层通过 api.scenario.setEnemyKeywords 授予/取消。
// hunter 于 P7 TDC（11724 朝圣者领袖）加入：重整状态时其他异教徒获得猎手；
// turn.js#enemyHasHunter 先读 keywordOverrides.hunter 再读印刷/幕规则。
// immobile 供 11635 等「该敌人不能移动」的声明式改写（P7 TDC 第三轮）。
const editableKeywords = ['alert', 'aloof', 'elusive', 'hunter', 'immobile', 'retaliate', 'relentless']
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

// P7 TDC 11635：敌人「不能移动」可由条目 enemyRule.immobile 声明，也可由内容层
// api.scenario.setEnemyKeywords(enemy, ['immobile'], ...) 动态改写；读点：relocateEnemy / 巡逻 / 猎手移动。
export function enemyAttachmentRules(enemy) {
  return (enemy?.attachments || []).flatMap(card =>
    registeredEntry(card.originalCode || card.code)?.assetRule?.enemyAttachmentRule || [])
}

export function enemyIsMassive(state, enemy) {
  return (!!enemy?.massive && !enemyTextBlanked(state, enemy)) || enemyAttachmentRules(enemy).some(rule => rule.massive)
}

export function enemyIsImmobile(state, enemy) {
  if (enemy?.attachedToAssetId || enemyAttachmentRules(enemy).some(rule => rule.cannotMove)) return true
  const overridden = enemyKeywordOverride(state, enemy, 'immobile')
  if (overridden != null) return overridden
  if (enemy?.immobile) return true
  const rule = registeredEntry(enemy?.originalCode || enemy?.code)?.enemyRule
  return rule?.immobile === true || (!enemyTextBlanked(state, enemy) && rule?.immobileWhile?.(state, enemy) === true)
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

export function enemyAttackingDamageBonus(state, enemy, inv) {
  if (enemyTextBlanked(state, enemy)) return 0
  const bonus = registeredEntry(enemy.originalCode || enemy.code)?.enemyRule?.attackDamageBonus
  if (typeof bonus === 'function') return Number(bonus(state, enemy, inv)) || 0
  if (bonus?.unlessTargetInVehicle && vehicleOf(state, inv.seat)) return 0
  return Number(bonus?.amount) || 0
}

export function enemyHasAttackKeyword(state, enemy, keyword, printed, entryOf = registeredEntry) {
  const here = state.locations.find(location => location.id === enemy.location)
  if (!enemy.elite && entryOf(here?.originalCode || here?.code)?.locationRule?.enemyKeywordDisabled?.nonElite?.includes(keyword)) return false
  const overridden = enemyKeywordOverride(state, enemy, keyword)
  if (overridden != null) return overridden
  const entry = entryOf(enemy.originalCode || enemy.code)
  const conditional = enemyTextBlanked(state, enemy) ? undefined : entry?.enemyRule?.keywordWhile?.(state, enemy, keyword)
  if ((conditional ?? printed) || enemyHasLocationKeyword(state, enemy, keyword)) return true
  // P7 TDC 11727：「其上有伤害时获得警戒和反击」——条目级条件关键词（伤害清零即失效）。
  if (Array.isArray(entry?.enemyRule?.whileDamagedKeywords)
    && entry.enemyRule.whileDamagedKeywords.includes(keyword) && Number(enemy.damageTaken) > 0) return true
  // P7 TDC 11747：「其他深潜者获得无情」——在场敌人条目级关键词光环（按特性匹配，不含自身）。
  const traits = (entry?.flags?.traits || []).map(trait => String(trait).toLowerCase())
  const aura = (state.enemies || []).some(other => {
    if (!other || other === enemy || other.id === enemy.id) return false
    const rule = entryOf(other.originalCode || other.code)?.enemyRule?.grantsKeywordsToTraits
    if (!rule || !Array.isArray(rule.keywords) || !rule.keywords.includes(keyword)) return false
    const wanted = (rule.traits || []).map(trait => String(trait).toLowerCase())
    return !wanted.length || traits.some(trait => wanted.includes(trait))
  })
  if (aura) return true
  return (enemy.attachments || []).some(card =>
    entryOf(card.originalCode || card.code)?.treacheryRule?.enemyKeywordAura?.keywords?.includes(keyword))
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
  return state.locations.filter(location => ['nearestEmpty', 'nearestEmptyTrait'].includes(spec.kind)
    ? location.id !== enemy.location && !state.investigators.some(inv => active(inv) && inv.location === location.id)
      && !state.enemies.some(other => other.location === location.id) && matchesTrait(location)
    : matchesTrait(location) && (location.clues || 0) >= (spec.minClues || 0))
    .map(location => location.id)
}

export function resolvePatrol(state, enemy, spec, deps) {
  if (!state.enemies.includes(enemy) || enemy.exhausted || enemy.engagedSeat != null || enemyIsImmobile(state, enemy) || enemy.hostId || deps.blanked(enemy)) return false
  const targetSpec = normalizePatrolTarget(spec)
  const targetIds = [...new Set(qualifyingTargets(state, enemy, targetSpec))]
  const reachable = targetIds.map(id => ({ id, paths: shortestPaths(state.locations, enemy.location, id, to => canEnterLocation(state, enemy, to)) }))
    .filter(row => row.paths.length)
  const closest = Math.min(...reachable.map(row => row.paths[0].length))
  const nearest = ['nearestEmpty', 'nearestEmptyTrait', 'flood', 'enemy'].includes(targetSpec.kind)
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
  const candidates = enemyIsImmobile(state, enemy) ? [] : [...new Set(origin?.connections || [])].filter(id => id !== origin.id && canEnterLocation(state, enemy, id))
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

export function resolveElusiveAfterAttack(state, enemy, entryOf, runtime, blanked, ignore = () => false) {
  if (!enemy || enemy.exhausted || !state.enemies.includes(enemy) || blanked(enemy)) return false
  const printed = entryOf(enemy.originalCode || enemy.code)?.enemyRule?.elusive === true
  if (!enemyHasAttackKeyword(state, enemy, 'elusive', printed, entryOf) || ignore()) return false
  const api = runtime()
  return resolveElusive(state, enemy, true, { blanked, choice: api.choose, move: api.moveEnemy,
    disengage: api.disengage, exhaust: api.exhaustEnemy })
}
