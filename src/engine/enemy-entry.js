import { playerLocationRuleActive } from './location-attachments.js'
import { registeredEntry } from './ability.js'
import { enemyBody } from './enemy-parts.js'
import { floodLevel } from './flood.js'
import { ALL_CARDS } from '../cards/cards-data.js'

const movementEngagementPrevention = new WeakMap()

export function duringMovementWithoutEngagement(state, seat, resolve) {
  const previous = movementEngagementPrevention.get(state)
  movementEngagementPrevention.set(state, new Set([...(previous || []), seat]))
  try {
    return resolve()
  } finally {
    if (previous) movementEngagementPrevention.set(state, previous)
    else movementEngagementPrevention.delete(state)
  }
}

export function movementPreventsEngagement(state, seat) {
  return movementEngagementPrevention.get(state)?.has(seat) === true
}

export function enemyProtectionBlocks(state, inv, enemy, kind) {
  if (!inv || !enemy) return false
  if (kind === 'engage' && movementPreventsEngagement(state, inv.seat)) return true
  const record = inv.enemyProtection
  if (!record || record.round !== state.round) return false
  const ids = kind === 'engage' ? record.engage : kind === 'damage' ? record.damage : []
  const bodyId = enemyBody(state, enemy)?.id
  return Array.isArray(ids) && (ids.includes(enemy.id) || (bodyId != null && ids.includes(bodyId)))
}

export function protectFromEnemies(state, seat, ids, { duration = 'endOfRound', cannotDamage = false } = {}) {
  const inv = state.investigators[seat]
  if (!inv || duration !== 'endOfRound' || !Array.isArray(ids)) return 0
  const wanted = new Set(ids)
  const known = state.enemies.filter(enemy => wanted.has(enemy.id) && !enemy.elite)
  if (!known.length) return 0
  const record = inv.enemyProtection?.round === state.round ? inv.enemyProtection
    : (inv.enemyProtection = { round: state.round, engage: [], damage: [] })
  for (const enemy of known) {
    if (!record.engage.includes(enemy.id)) record.engage.push(enemy.id)
    if (cannotDamage && !record.damage.includes(enemy.id)) record.damage.push(enemy.id)
  }
  return known.length
}

export function enemyOnlyPreyAllows(state, enemy, inv, isBlanked) {
  const eligible = registeredEntry(enemy.originalCode || enemy.code)?.enemyRule?.onlyPrey
  return typeof eligible !== 'function' || isBlanked(state, enemy) || eligible(state, inv)
}

export function enemyCanEnterLocation(state, enemy, destination) {
  if (enemy?.shadowMiniKind || (enemy?.enemyLocation && destination !== enemy.id)) return false
  if (enemy?.location && enemy.location !== destination && playerLocationRuleActive(state, enemy, 'blocksEnemyMove')) return false
  const origin = state.locations.find(location => location.id === enemy?.location)
  const originRule = origin && !origin.revealed && registeredEntry(origin.originalCode || origin.code)?.locationRule
  if (origin?.id !== destination && originRule?.unrevealedRestrictions?.enemyCodesCannotLeave
    ?.includes(enemy.originalCode || enemy.code)) return false
  const rule = registeredEntry(enemy?.originalCode || enemy?.code)?.enemyRule
  const location = state.locations.find(item => item.id === destination)
  // 梦境之门（06015a/b）：「敌人和除卢克·罗宾逊以外的调查员不能进入梦境之门」。
  // FAQ v2.1（2023-08）：敌人不能在梦境之门生成；若有敌人会在卢克位于梦境之门时生成在
  // 他的地点，改为弃掉该敌人。移动/猎人/追逐/生成校验共用本函数，所以这一处同时覆盖
  // 「进入」与「生成」两条路径（生成失败由 enemies.js#spawnEnemy 的 spawnFailed 分支弃牌）。
  if (location?.dreamGate === true) return false
  // 「敌人不能进入本地点」（TIC 07252b 拘禁室）：地点侧的声明。移动/猎人/追逐/生成校验
  // 共用本函数，所以一处声明覆盖「进入」与「生成」两条路径；生成落点的改换由
  // enemies.js#spawnEnemy 读取 locationRule.enemySpawnRedirect 处理。
  const locationRule = registeredEntry(location?.originalCode || location?.code)?.locationRule
  const cannotEnter = locationRule?.enemiesCannotEnter
  if (cannotEnter === true
      || (typeof cannotEnter === 'function' && cannotEnter(state, location, enemy))
      || (!location?.revealed && locationRule?.unrevealedRestrictions?.enemiesCannotEnter === true)) return false
  // P7 TDC obsidianCanyons 11641/11642：「非弱点敌人可进出开阔天空」——弱点敌人不能进入/生成在开阔天空。
  if (locationRule?.weaknessEnemiesCannotEnter === true
    && String(ALL_CARDS[enemy?.originalCode || enemy?.code]?.subtype || '').toLowerCase().includes('weakness')) return false
  // 「不能进入[[洞穴]]地点」（07164b/07165b 魔鬼礁石的骇物）：禁止类特性。
  const banned = rule?.cannotEnterTraits
  if (banned?.length && location && banned.some(trait => location.traits?.some(value =>
    String(value).toLowerCase() === String(trait).toLowerCase()))) return false
  // 「不能进入/生成在未淹没地点」（P7 TDC 11605 深潜者）：进入/生成/猎人移动共用本函数。
  if (rule?.enterOnlyFlooded === true && location && floodLevel(state, location.id) <= 0) return false
  const required = rule?.enterOnlyTraits
  if (!required?.length) return true
  return !!location && required.some(trait => location.traits?.some(value =>
    value.toLowerCase() === trait.toLowerCase()))
}

export function enemyHasLocationKeyword(state, enemy, keyword) {
  const location = state.locations.find(item => item.id === enemy.location)
  return (location?.attachments || []).some(source => {
    const aura = registeredEntry(source.originalCode || source.code)?.treacheryRule?.enemyKeywordAura
    return aura?.keywords?.includes(keyword) && (!aura.trait || enemy.traits?.some(trait =>
      trait.toLowerCase() === aura.trait.toLowerCase()))
  })
}

// 「与你交战期间你不能做 X」的敌方持续限制（07183「追猎的深潜者与你交战时，你不能进入载具
// 或获得资源」）。声明：`enemyRule.engagedRestrictions: ['enterVehicle', 'gainResources']`。
// 读点：vehicles.js 的 vehicleAccessError（进入载具）与 resource-bank.js 的 gainResource（获得资源）。
export const ENGAGED_RESTRICTIONS = Object.freeze(['enterVehicle', 'gainResources'])

export function enemyEngagedRestricts(state, inv, restriction) {
  if (!inv || !restriction) return false
  return (state?.enemies || []).some(enemy => !enemy.defeated && !enemy.removedFromGame
    && enemy.engagedSeat === inv.seat
    && registeredEntry(enemy.originalCode || enemy.code)?.enemyRule?.engagedRestrictions?.includes(restriction))
}
