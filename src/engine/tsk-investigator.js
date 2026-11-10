// 八循环《绯红密钥》P2 原语：调查员特殊能力所需的通用接口。
//
// 覆盖 P1 原语目录：
//   · new.crossSeatAction        —— 跨座位即时行动授权（卡森：同地点另一调查员立即执行一次行动）
//   · new.crossSeatActionWindow  —— 授权后的时机窗口（P1 blocked 项的 P2 裁决，见下）
//   · new.healTrigger            —— 「伤害被治愈后」窗口（文森特：治愈伤害后触发术后恢复）
//   · new.evadeDiscard           —— 躲避已横置非精英敌人后的直接弃置判定（基玛尼）
//   · new.doomDiscount           —— 每轮一次「减费并带 1 毁灭入场」的折算（阿米娜）
//   · new.evidence               —— 证据标记的放置/花费/检定上限（达雷尔；卡实例计数器扩展）
//   · reuse: new.allySlotBonus / new.allyReadyBonus —— 既有 add:slot 修正与技能图标修正已足够（见计划分类差异）
//
// 状态：
//   · 场景级 `mechanicState.tsk.crossSeat = { version:1, grants: { [seat]: [{ from, round, used }] } }`
//   · 场景级 `mechanicState.tsk.doomDiscount = { version:1, used: { [seat]: round } }`
//   · 场景级 `mechanicState.tsk.evidence = { version:1, spent: { [seat]: string } }`（每次检定限一次）
//
// 裁决（P1 标记 blocked 的 new.crossSeatActionWindow）：授权本身是「立即执行一次行动」，不是额外行动额度；
// 因此窗口触发在收到授权时（grant 完成、目标座位行动前），每轮每目标座位最多一次；结算顺序为
// 「授权者效果完全结算 → 窗口 → 目标执行一次行动 → 回到原时序」。本模块按此实现并提供窗口读点。
import { registerWindow } from './windows.js'
import { assertTskFields, assertTskObject, tskScenarioState } from './tsk-state.js'
import { addCardCounter, cardCounterOf, totalCardCounters } from './card-counters.js'

export const INVESTIGATOR_STATE_VERSION = 1
export const CROSS_SEAT_WINDOW = 'tskCrossSeatAction'
export const DAMAGE_HEALED_WINDOW = 'damageHealed'
// 窗口注册：跨座位即时行动授权、伤害治疗完成。
registerWindow(CROSS_SEAT_WINDOW, { label: '跨座位即时行动授权后', kind: 'reaction', order: 420 })
registerWindow(DAMAGE_HEALED_WINDOW, { label: '伤害被治愈后', kind: 'reaction', order: 430 })

function scenarioContainer(state, key, create, initial) {
  const data = tskScenarioState(state, create)
  if (!data) return null
  if (create) return data[key] ||= { version: INVESTIGATOR_STATE_VERSION, ...initial }
  return data[key] || null
}

// ---------------------------------------------------------------------------
// 跨座位即时行动
// ---------------------------------------------------------------------------
function crossSeatState(state, create = false) {
  return scenarioContainer(state, 'crossSeat', create, { grants: {} })
}

/**
 * 授权一次跨座位即时行动：`fromSeat` 的同地点队友 `targetSeat` 立即执行一次行动。
 * 规则限制由调用方（卡面条件）保证：本函数强制「每轮每目标座位最多 1 次」与「不同座位/合法座位」。
 * 返回授权记录；非法/重复授权在写入前拒绝。
 */
export function grantCrossSeatAction(state, { fromSeat, targetSeat, round = null } = {}) {
  if (!Number.isSafeInteger(fromSeat) || !state.investigators?.[fromSeat]) throw new TypeError('授权者座位无效')
  if (!Number.isSafeInteger(targetSeat) || !state.investigators?.[targetSeat]) throw new TypeError('被授权者座位无效')
  if (fromSeat === targetSeat) throw new TypeError('不能授权自己跨座位行动')
  const currentRound = Number.isSafeInteger(round) ? round : Number.isSafeInteger(state.round) ? state.round : 0
  const container = crossSeatState(state, true)
  container.grants[targetSeat] ||= []
  if (container.grants[targetSeat].some(grant => grant.round === currentRound)) {
    throw new Error('该调查员本轮已经获得过跨座位即时行动')
  }
  const grant = { from: fromSeat, round: currentRound, used: false }
  container.grants[targetSeat].push(grant)
  return { targetSeat, ...grant }
}

/** 目标座位当前待用的跨座位授权（只读副本）；没有返回 null。 */
export function crossSeatActionPending(state, targetSeat) {
  const grants = crossSeatState(state)?.grants?.[targetSeat] || []
  const grant = grants.find(entry => !entry.used)
  return grant ? { targetSeat, ...grant } : null
}

/** 消耗目标座位的授权（开始执行行动时调用）；返回被消耗的授权，没有则 null。 */
export function takeCrossSeatAction(state, targetSeat) {
  const container = crossSeatState(state, true)
  const grants = container.grants[targetSeat] || []
  const grant = grants.find(entry => !entry.used)
  if (!grant) return null
  grant.used = true
  return { targetSeat, ...grant }
}

/** 跨座位授权的合法动作载荷（extend.choices）。 */
export function crossSeatChoices(state) {
  const grants = crossSeatState(state)?.grants || {}
  return {
    pending: Object.entries(grants).flatMap(([seat, entries]) => entries
      .filter(entry => !entry.used)
      .map(entry => ({ targetSeat: Number(seat), fromSeat: entry.from, round: entry.round }))),
  }
}

// ---------------------------------------------------------------------------
// 治愈伤害触发（damageHealed 窗口由 harm-threat.js#healDamageFrom 实际触发）
// ---------------------------------------------------------------------------
/**
 * 构造 damageHealed 窗口上下文（供内容层/测试使用）：治疗者、被治疗者、治疗量。
 * 引擎侧的真实触发点在 harm-threat.js#healDamageFrom；本函数只做形状与合法性校验。
 */
export function damageHealedContext(state, { healerSeat, healedSeat, amount, cardCode = null } = {}) {
  if (!Number.isSafeInteger(healerSeat) || !state.investigators?.[healerSeat]) throw new TypeError('治疗者座位无效')
  if (!Number.isSafeInteger(healedSeat) || !state.investigators?.[healedSeat]) throw new TypeError('被治疗者座位无效')
  if (!Number.isSafeInteger(amount) || amount < 1) throw new TypeError('治疗量必须是正整数')
  return { when: DAMAGE_HEALED_WINDOW, seat: healerSeat, cardSeat: healerSeat, healedSeat, amount, cardCode }
}

// ---------------------------------------------------------------------------
// 躲避后弃置（基玛尼）
// ---------------------------------------------------------------------------
/**
 * 判定一次「躲避已横置非精英敌人后直接弃置」是否成立。
 * 返回 { allowed, reason? }；规则口径：目标必须是敌人、已横置、非 Elite、且未被其他效果阻止。
 */
export function evadeDiscardPlan(enemy) {
  if (!enemy || typeof enemy !== 'object') throw new TypeError('躲避弃置需要敌人实例')
  if (enemy.elite === true) return { allowed: false, reason: '精英敌人不能直接弃置' }
  if (!enemy.exhausted) return { allowed: false, reason: '只能弃置已横置的敌人' }
  return { allowed: true }
}

// ---------------------------------------------------------------------------
// 毁灭减费（阿米娜）
// ---------------------------------------------------------------------------
function doomDiscountState(state, create = false) {
  return scenarioContainer(state, 'doomDiscount', create, { used: {} })
}

/** 该座位本轮是否已用毁灭减费。 */
export function doomDiscountUsed(state, seat, round = null) {
  const currentRound = Number.isSafeInteger(round) ? round : Number.isSafeInteger(state.round) ? state.round : 0
  return doomDiscountState(state)?.used?.[seat] === currentRound
}

/**
 * 折算一次「减费并带 1 毁灭入场」：每轮每座位一次；返回 { baseCost, cost, doom }。
 * 真正的费用支付与毁灭放置在内容层用既有 api 完成（本原语只做额度与折算）。
 */
export function doomDiscountPlan(state, { seat, baseCost, amount = 3, round = null } = {}) {
  if (!Number.isSafeInteger(seat) || !state.investigators?.[seat]) throw new TypeError('毁灭减费座位无效')
  if (!Number.isSafeInteger(baseCost) || baseCost < 0) throw new TypeError('基础费用必须是非负整数')
  if (!Number.isSafeInteger(amount) || amount < 1) throw new TypeError('减费量必须是正整数')
  const currentRound = Number.isSafeInteger(round) ? round : Number.isSafeInteger(state.round) ? state.round : 0
  if (doomDiscountUsed(state, seat, currentRound)) return { allowed: false, reason: '本轮已使用过毁灭减费' }
  return { allowed: true, baseCost, cost: Math.max(0, baseCost - amount), doom: 1, round: currentRound }
}

/** 登记该座位本轮已使用毁灭减费（内容层在支付后调用）。 */
export function markDoomDiscountUsed(state, seat, round = null) {
  if (!Number.isSafeInteger(seat) || !state.investigators?.[seat]) throw new TypeError('毁灭减费座位无效')
  const currentRound = Number.isSafeInteger(round) ? round : Number.isSafeInteger(state.round) ? state.round : 0
  const container = doomDiscountState(state, true)
  container.used[seat] = currentRound
  return currentRound
}

// ---------------------------------------------------------------------------
// 证据（达雷尔）：卡实例计数器 evidence 的读写 + 每次检定限一次的花费账本
// ---------------------------------------------------------------------------
function evidenceState(state, create = false) {
  return scenarioContainer(state, 'evidence', create, { spent: {} })
}

/** 给一张卡放证据标记（地点/敌人/诡计等任意卡实例）；返回当前数量。 */
export function addEvidence(card, amount = 1) {
  return addCardCounter(card, 'evidence', amount)
}

/** 一张卡上的证据数量。 */
export function evidenceOf(card) {
  return cardCounterOf(card, 'evidence')
}

/** 花费证据标记（不足返回 0 且不写入）；返回实际花费数。 */
export function spendEvidence(card, amount = 1) {
  const available = evidenceOf(card)
  if (available <= 0) return 0
  return available - addCardCounter(card, 'evidence', -Math.min(available, Math.abs(Math.trunc(Number(amount) || 0))))
}

/** 全场证据总数（规则读数）。证据可放在地点/敌人/调查员卡上，因此这里显式遍历全部卡实例。 */
export function totalEvidence(state) {
  let total = totalCardCounters(state, 'evidence')
  for (const location of state?.locations || []) total += cardCounterOf(location, 'evidence')
  for (const card of state?.storyAssets || []) total += cardCounterOf(card, 'evidence')
  for (const card of state?.agendaAside || []) total += cardCounterOf(card, 'evidence')
  return total
}

/**
 * 证据降低检定的计划：每次检定每个座位最多 1 次（testKey 标识本次检定，内容层传稳定字符串）。
 * 返回 { allowed, amount, testKey }；未传 testKey 视为非法（不允许跨检定期静默复用）。
 */
export function evidenceSpendPlan(state, { seat, testKey, amount = 2 } = {}) {
  if (!Number.isSafeInteger(seat) || !state.investigators?.[seat]) throw new TypeError('证据花费座位无效')
  if (typeof testKey !== 'string' || !testKey) throw new TypeError('证据花费需要本次检定的稳定 testKey')
  if (!Number.isSafeInteger(amount) || amount < 1) throw new TypeError('证据降低难度必须是正整数')
  const container = evidenceState(state, true)
  if (container.spent[seat] === testKey) return { allowed: false, reason: '本次检定已经花过证据' }
  return { allowed: true, amount, testKey }
}

/** 登记本次检定已花费证据（随后由内容层降低难度）。 */
export function markEvidenceSpent(state, seat, testKey) {
  if (!Number.isSafeInteger(seat) || !state.investigators?.[seat]) throw new TypeError('证据花费座位无效')
  if (typeof testKey !== 'string' || !testKey) throw new TypeError('证据花费需要 testKey')
  const container = evidenceState(state, true)
  container.spent[seat] = testKey
  return testKey
}

// ---------------------------------------------------------------------------
// 读档校验
// ---------------------------------------------------------------------------
export function validateTskCrossSeat(state, value = crossSeatState(state)) {
  if (value == null) return true
  assertTskFields(value, ['version', 'grants'], '跨座位即时行动状态')
  if (value.version !== INVESTIGATOR_STATE_VERSION) throw new TypeError(`不支持的跨座位即时行动版本 ${value.version}`)
  assertTskObject(value.grants, '跨座位授权表')
  for (const [seatKey, grants] of Object.entries(value.grants)) {
    const seat = Number(seatKey)
    if (!Number.isSafeInteger(seat) || String(seat) !== seatKey || !state.investigators?.[seat]) throw new TypeError('跨座位授权座位无效')
    if (!Array.isArray(grants)) throw new TypeError('跨座位授权列表无效')
    const rounds = new Set()
    for (const grant of grants) {
      assertTskFields(grant, ['from', 'round', 'used'], '跨座位授权记录')
      if (!Number.isSafeInteger(grant.from) || grant.from === seat || !state.investigators?.[grant.from]) throw new TypeError('跨座位授权来源座位无效')
      if (!Number.isSafeInteger(grant.round) || grant.round < 0) throw new TypeError('跨座位授权轮次无效')
      if (typeof grant.used !== 'boolean') throw new TypeError('跨座位授权使用标记无效')
      if (rounds.has(grant.round)) throw new TypeError('同一轮重复跨座位授权')
      rounds.add(grant.round)
    }
  }
  return true
}

export function validateTskDoomDiscount(state, value = doomDiscountState(state)) {
  if (value == null) return true
  assertTskFields(value, ['version', 'used'], '毁灭减费状态')
  if (value.version !== INVESTIGATOR_STATE_VERSION) throw new TypeError(`不支持的毁灭减费版本 ${value.version}`)
  assertTskObject(value.used, '毁灭减费记录')
  for (const [seatKey, round] of Object.entries(value.used)) {
    const seat = Number(seatKey)
    if (!Number.isSafeInteger(seat) || String(seat) !== seatKey || !state.investigators?.[seat]) throw new TypeError('毁灭减费座位无效')
    if (!Number.isSafeInteger(round) || round < 0) throw new TypeError('毁灭减费轮次无效')
  }
  return true
}

export function validateTskEvidence(state, value = evidenceState(state)) {
  if (value == null) return true
  assertTskFields(value, ['version', 'spent'], '证据花费状态')
  if (value.version !== INVESTIGATOR_STATE_VERSION) throw new TypeError(`不支持证据花费版本 ${value.version}`)
  assertTskObject(value.spent, '证据花费记录')
  for (const [seatKey, testKey] of Object.entries(value.spent)) {
    const seat = Number(seatKey)
    if (!Number.isSafeInteger(seat) || String(seat) !== seatKey || !state.investigators?.[seat]) throw new TypeError('证据花费座位无效')
    if (typeof testKey !== 'string' || !testKey) throw new TypeError('证据花费 testKey 无效')
  }
  return true
}
