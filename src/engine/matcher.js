// 诡镇奇谈：卡牌版 · 声明式目标查询（Matcher）
//
// P0-A 的一部分。目的只有一件事：把「哪些敌人/地点/调查员符合条件」写成可组合
// 的表达式，而不是散落在 engine.js 与各战役 behavior 里的 filter 链。
//
// 约定：
//   · 查询函数返回 predicate：(ctx) => boolean
//   · ctx = { state, inv, source, windowId, context }
//       state    权威状态
//       inv      能力持有者（调查员）
//       source   能力来源（资产实例 / 手牌 code / 调查员座席）
//       windowId 当前窗口 id（见 windows.js）
//       context  窗口上下文（敌人、地点、token、失败差值……）
//   · 所有 predicate 都是纯函数，不修改状态；异常一律视为 false，
//     这样一条写错的条件只会让能力不出现，而不是炸掉结算。
//
// 组合子：all / any / none。裸函数、数组、undefined 都会被规范化，
// 所以内容层可以写 criteria: [here(), engagedWithMe()] 或单个函数。

const isPredicate = value => typeof value === 'function'

function flatten(criteria) {
  if (criteria == null) return []
  if (Array.isArray(criteria)) return criteria.flatMap(flatten)
  if (isPredicate(criteria)) return [criteria]
  if (typeof criteria === 'object' && typeof criteria.when === 'function') return [criteria.when]
  return []
}

const safe = predicate => ctx => {
  try { return predicate(ctx) === true } catch { return false }
}

export function all(...criteria) {
  const predicates = flatten(criteria)
  if (!predicates.length) return () => true
  if (predicates.length === 1) return safe(predicates[0])
  return ctx => predicates.every(predicate => safe(predicate)(ctx))
}

export function any(...criteria) {
  const predicates = flatten(criteria)
  if (!predicates.length) return () => false
  if (predicates.length === 1) return safe(predicates[0])
  return ctx => predicates.some(predicate => safe(predicate)(ctx))
}

export function none(...criteria) {
  const inner = any(...criteria)
  return ctx => !inner(ctx)
}

export function not(predicate) {
  return ctx => !(predicate?.(ctx) === true)
}

// 显式「永远可用/永远不可用」，给内容层做占位与测试用。
export const always = () => true
export const never = () => false

// ---------------------------------------------------------------------------
// 基础查询
// ---------------------------------------------------------------------------

export const investigatorOf = ctx => ctx?.inv || null
export const seatOf = ctx => (Number.isInteger(ctx?.inv?.seat) ? ctx.inv.seat : null)
export const contextOf = ctx => ctx?.context || {}

export function atLocation(locationId) {
  return ctx => {
    const here = ctx?.inv?.location
    const target = isPredicate(locationId) ? locationId(ctx) : locationId
    return target != null && here === target
  }
}

export function atTrait(trait) {
  return ctx => {
    const state = ctx?.state, inv = ctx?.inv
    const location = state?.locations?.find(entry => entry.id === inv?.location)
    return traitList(location).includes(String(trait).toLowerCase())
  }
}

export function locationTrait(trait) {
  return atTrait(trait)
}

// 「这次事件是不是发生在能力持有者身上」。
// triggerReaction 这类窗口本身就是按座位触发的，context 可能不带 seat；
// 此时视为「就是持有者本人」，否则按 context.seat 比对。
export function ownSeat() {
  return ctx => {
    const seat = ctx?.context?.seat
    if (!Number.isInteger(seat)) return true
    return seat === ctx?.inv?.seat
  }
}

export function otherSeat() {
  return ctx => Number.isInteger(ctx?.context?.seat) && ctx.context.seat !== ctx?.inv?.seat
}

// 窗口上下文里带敌人时：敌人是否仍与持有者交战/同地点。
export function contextEnemy({ engagedWithMe = false, here = false, elite, trait, code } = {}) {
  return ctx => {
    const enemy = ctx?.context?.enemy
    if (!enemy) return false
    if (engagedWithMe && enemy.engagedSeat !== ctx?.inv?.seat) return false
    if (here && enemy.location !== ctx?.inv?.location) return false
    if (elite != null && Boolean(enemy.elite) !== Boolean(elite)) return false
    if (code != null && enemy.code !== code && enemy.originalCode !== code) return false
    if (trait != null && !traitList(enemy).includes(String(trait).toLowerCase())) return false
    return true
  }
}

export function attackKind(...kinds) {
  return ctx => kinds.includes(ctx?.context?.attackKind)
}

export function tokenRevealed(...symbols) {
  return ctx => symbols.includes(ctx?.context?.token)
}

export function failedByAtMost(limit) {
  return ctx => (ctx?.context?.failedBy || 0) <= limit
}

export function successByAtLeast(limit) {
  return ctx => (ctx?.context?.successBy || 0) >= limit
}

export function drewCardType(type) {
  return ctx => {
    const card = ctx?.context?.cardCode ? ctx?.state?.cards?.[ctx.context.cardCode] : null
    return card?.type === type
  }
}

export function drewNonWeakness() {
  return ctx => {
    const code = ctx?.context?.cardCode
    if (!code) return false
    const card = ctx?.state?.cards?.[code]
    return Boolean(card) && !card.weakness && !card.subtype
  }
}

// ---------------------------------------------------------------------------
// 打出条件（Phase 1 的 playCondition 收敛）
//
// 这组 predicate 取代旧 DSL 里 deprecated 的 ownTurnOnly / duringOwnTurn /
// firstActionOnly / requiresClue / requiresClueAtLocation / requiresNoEnemies /
// requiresRemainingSanity / requiresResign。读点统一在 play-condition.js；
// 内容层写 playCondition: [ownTurn(), noEnemiesHere()] 即可，不再新增散字段。
// ---------------------------------------------------------------------------

// 自己的回合 = 调查阶段且轮到本人行动。
export function ownTurn() {
  return ctx => {
    const { state, inv } = ctx || {}
    return state?.phase === 'investigation' && state?.currentSeat === inv?.seat
  }
}

// 本回合还没有执行过行动（「作为本回合的第一个行动打出」）。
export function ownFirstAction() {
  return ctx => ((ctx?.inv?.actionsTakenThisTurn || 0) === 0)
}

export function investigatorClues(amount) {
  return ctx => (ctx?.inv?.clues || 0) >= amount
}

// 所在地点有线索（旧字段 requiresClueAtLocation）。
export function clueAtLocation() {
  return ctx => {
    const { state, inv } = ctx || {}
    const here = (state?.locations || []).find(location => location.id === inv?.location)
    return (here?.clues || 0) > 0
  }
}

// 所在地点没有敌人（旧字段 requiresNoEnemies）。
export function noEnemiesHere() {
  return ctx => {
    const { state, inv } = ctx || {}
    return !(state?.enemies || []).some(enemy => enemy.location === inv?.location)
  }
}

// 剩余神志至少 N（旧字段 requiresRemainingSanity，读点由 helpers.maxSanity 注入）。
export function remainingSanityAtLeast(amount) {
  return ctx => {
    const maxSanity = ctx?.helpers?.maxSanity?.(ctx.inv) ?? (ctx?.inv?.maxSanity || 0)
    return maxSanity - (ctx?.inv?.horror || 0) >= amount
  }
}

// 场上有带「撤退」能力的剧本卡（旧字段 requiresResign）。
export function resignAvailable() {
  return ctx => ctx?.helpers?.resignAvailable?.() === true
}

// 「你不能获得资源」类剧本规则（敦威治：与守财奴/资源封锁敌人交战）。读点由引擎注入，
// 内容层只写条件，不再逐卡判断敌人特性。
export function canGainResources() {
  return ctx => ctx?.helpers?.canGainResources?.() !== false
}


// ---------------------------------------------------------------------------
// 实体查询（返回数组，供 resolve() 内部使用）
// ---------------------------------------------------------------------------

export function aliveInvestigators(state) {
  return (state?.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
}

export function investigatorsAt(state, locationId) {
  return aliveInvestigators(state).filter(inv => inv.location === locationId)
}

export function otherInvestigatorsAt(state, inv) {
  return investigatorsAt(state, inv?.location).filter(other => other.seat !== inv?.seat)
}

export function enemiesAt(state, locationId) {
  return (state?.enemies || []).filter(enemy => enemy.location === locationId)
}

export function enemiesEngagedWith(state, inv) {
  return (state?.enemies || []).filter(enemy => enemy.engagedSeat === inv?.seat)
}

export function exhaustedEnemies(state) {
  return (state?.enemies || []).filter(enemy => enemy.exhausted)
}

export function locationsHere(state, inv) {
  const location = (state?.locations || []).find(entry => entry.id === inv?.location)
  if (!location) return []
  const connected = new Set(location.connections || [])
  return (state?.locations || []).filter(entry => entry.id === location.id || connected.has(entry.id))
}

export function traitList(card) {
  return (card?.traits || []).map(trait => String(trait).toLowerCase())
}

export function hasTrait(card, trait) {
  return traitList(card).includes(String(trait).toLowerCase())
}

// 资产/威胁区的「可用能力卡」清单，与 engine 的 controlledAbilityCards 对齐。
export function controlledCards(inv) {
  return [...(inv?.assets || []), ...(inv?.threat || [])]
}
