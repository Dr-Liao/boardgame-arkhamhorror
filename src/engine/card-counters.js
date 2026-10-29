// 卡牌实例上的具名计数器（P6 原语 `counter.card`）。
//
// 印刷场景：托尼·摩尔根的「赏金」——赏金放在敌人上（`[reaction] 敌人入场后：将赏金合约上的
// 1-3 赏金放到该敌人上，最多放到等于该敌人生命值`），以及「赏金合约」这张支援上的 6 点赏金。
// 这类标记既不是「使用次数」（不可补充、按名计数），也不是威胁区的 `counters`（那是恐惧/线索
// 计数，单数字段），因此单列一个通用具名计数器。
//
// 状态形状（纯 JSON，随存档往返）：`card.markers = { [counterId]: number }`。
// 只写 `markers` 这一个键，未使用本原语的卡不会新增字段（replay 指纹不变）。
//
// 引擎不认卡号：所有计数按 id 读写，条目层用 `api.addCardCounter` / `api.moveCardCounters`。

export const CARD_COUNTER_IDS = Object.freeze(['bounty'])

export function assertCardCounterId(id) {
  if (!CARD_COUNTER_IDS.includes(id)) {
    throw new Error(`未知卡牌计数器 ${JSON.stringify(id)}（可选：${CARD_COUNTER_IDS.join(' / ')}）`)
  }
  return id
}

/** 读取一张卡实例上的某个计数器。 */
export function cardCounterOf(card, id) {
  const value = card?.markers?.[id]
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

/** 该实例上所有计数器（只读副本）。 */
export function cardCountersOf(card) {
  const out = {}
  for (const id of CARD_COUNTER_IDS) {
    const value = cardCounterOf(card, id)
    if (value) out[id] = value
  }
  return out
}

/**
 * 增加/减少计数。`max` 给出上限（敌人赏金不得超过其生命值一类的规则由调用方传入）。
 * 返回变化后的数值。
 */
export function addCardCounter(card, id, amount = 1, { max = null } = {}) {
  assertCardCounterId(id)
  if (!card) return 0
  const current = cardCounterOf(card, id)
  let next = current + Math.trunc(Number(amount) || 0)
  next = Math.max(0, next)
  if (Number.isFinite(max)) next = Math.min(next, Math.max(0, max))
  card.markers ||= {}
  if (next > 0) card.markers[id] = next
  else delete card.markers[id]
  if (!Object.keys(card.markers).length) delete card.markers
  return next
}

/** 直接设为某个值（0 时删除该键）。 */
export function setCardCounter(card, id, value = 0, { max = null } = {}) {
  assertCardCounterId(id)
  if (!card) return 0
  const current = cardCounterOf(card, id)
  return addCardCounter(card, id, Math.trunc(Number(value) || 0) - current, { max })
}

/**
 * 把计数从一张卡移到另一张（赏金结算的唯一入口）。
 * 返回实际移动量；`max` 是目标上限（例如敌人生命值）。
 */
export function moveCardCounters(from, to, id, amount = 1, { max = null } = {}) {
  assertCardCounterId(id)
  const wanted = Math.max(0, Math.trunc(Number(amount) || 0))
  if (!from || !to || !wanted) return 0
  const available = cardCounterOf(from, id)
  let moved = Math.min(wanted, available)
  if (Number.isFinite(max)) moved = Math.min(moved, Math.max(0, max - cardCounterOf(to, id)))
  if (moved <= 0) return 0
  addCardCounter(from, id, -moved)
  addCardCounter(to, id, moved, { max })
  return moved
}

/** 全部卡牌上的某个计数器总数（规则读数用，如「赏金合约上还剩几点」）。 */
export function totalCardCounters(state, id) {
  assertCardCounterId(id)
  let total = 0
  for (const inv of state?.investigators || []) {
    for (const asset of inv.assets || []) total += cardCounterOf(asset, id)
    for (const threat of inv.threat || []) total += cardCounterOf(threat, id)
  }
  for (const enemy of state?.enemies || []) total += cardCounterOf(enemy, id)
  return total
}
