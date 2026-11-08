// 七循环《地球边缘》investigator.deckTop 原语（P2-F）。
//
// 印刷规则（08004 诺曼·威瑟斯 / 08005 伊波恩之书 / 08006 预示者）：
//   · 「Play with the top card of your deck revealed.」——牌库顶常驻揭示（默认只对本人可见，
//     内容层可声明 public）；
//   · 「Once per round, you may play the top card of your deck as if it were in your hand,
//     at -1 resource cost.」——每轮一次，把牌库顶牌当作手牌以折扣打出（具体折扣由调用方传入，
//     本模块不写死卡号或数值）；
//   · 「Forced - After a weakness is revealed while on top of your deck: Draw it.」——顶牌是弱点时
//     强制抽取（本模块只做「移入手中」这一步，显现/结算由调用方后续走既有弱点管线）；
//   · 旧印交换手牌与牌库顶：由卡条目用 revealDeckTop/clearDeckTop 组合表达，不在本原语内写死。
//
// 状态形状（场景级可选扩展，见 eote-state.js；纯 JSON，随存档往返，读点从不初始化）：
//   state.scenarioFlags.mechanics.eote.deckTop = {
//     seats: { "<seat>": { code: string, public: boolean, discount: number } },
//     played: { "<seat>": number },   // 最近一次「牌库顶打出机会」被使用的回合号
//   }
//
// 所有函数都只改上面这块状态；牌库/手牌的物理移动由 play-channels 的 deckTop 通道执行
//（consumeDeckTop/restoreDeckTop 是给通道用的内部辅助，不进入内容层 API 表）。
import { cardDef, isWeaknessCard } from './card-lookup.js'
import { eoteScenarioState } from './eote-state.js'

const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

function assertSeat(state, seat) {
  if (!Number.isSafeInteger(seat) || !state?.investigators?.[seat]) throw new RangeError('无效调查员座位')
  return state.investigators[seat]
}

function currentRound(state) {
  return Number.isSafeInteger(state?.round) ? state.round : 0
}

function integer(value, min, label) {
  if (!Number.isSafeInteger(value) || value < min) throw new TypeError(`${label} 必须是不小于 ${min} 的整数`)
  return value
}

/** 读取牌库顶状态容器；create=true 时才初始化。读点绝不创建。 */
function deckTopStore(state, create = false) {
  const scenario = eoteScenarioState(state, create)
  if (!scenario) return null
  if (create) scenario.deckTop ||= { seats: {}, played: {} }
  return scenario.deckTop || null
}

function assertSeatKey(state, key, label) {
  const seat = Number(key)
  if (!Number.isSafeInteger(seat) || String(seat) !== key || !state?.investigators?.[seat]) throw new TypeError(`${label} 座位无效`)
  return seat
}

export function validateEoteDeckTop(state, value = deckTopStore(state)) {
  if (value == null) return true // 旧存档没有该扩展时保持原状。
  if (!isPlainObject(value)) throw new TypeError('牌库顶状态必须是对象')
  for (const key of Object.keys(value)) if (!['seats', 'played'].includes(key)) throw new TypeError(`牌库顶状态未知字段 ${key}`)
  if (!isPlainObject(value.seats || {})) throw new TypeError('牌库顶揭示记录无效')
  for (const [key, record] of Object.entries(value.seats || {})) {
    assertSeatKey(state, key, '牌库顶揭示')
    if (!isPlainObject(record)) throw new TypeError('牌库顶揭示记录无效')
    for (const field of Object.keys(record)) if (!['code', 'public', 'discount'].includes(field)) throw new TypeError(`牌库顶揭示记录未知字段 ${field}`)
    if (typeof record.code !== 'string' || !record.code || !cardDef(record.code)) throw new TypeError('牌库顶揭示卡号无效')
    if (typeof record.public !== 'boolean') throw new TypeError('牌库顶揭示可见性必须是布尔值')
    integer(record.discount, 0, '牌库顶折扣')
  }
  if (value.played != null && !isPlainObject(value.played)) throw new TypeError('牌库顶使用记录无效')
  for (const [key, round] of Object.entries(value.played || {})) {
    assertSeatKey(state, key, '牌库顶使用')
    integer(round, 0, '牌库顶使用回合')
  }
  return true
}

/** 揭示牌库顶（常驻，不移动卡牌）；牌库为空返回 false。 */
export function revealDeckTop(state, seat, { public: isPublic = false, discount = 0 } = {}) {
  const inv = assertSeat(state, seat)
  if (typeof isPublic !== 'boolean') throw new TypeError('牌库顶可见性必须是布尔值')
  integer(discount, 0, '牌库顶折扣')
  if (!Array.isArray(inv.deck)) throw new TypeError('调查员牌库无效')
  if (!inv.deck.length) return false
  const code = inv.deck.at(-1)
  if (typeof code !== 'string' || !code) return false
  const store = deckTopStore(state, true)
  store.seats[seat] = { code, public: isPublic, discount }
  // 揭示新一张时清掉上一轮的旧使用记录，避免长期存档里堆积过期回合号。
  if (store.played?.[seat] != null && store.played[seat] !== currentRound(state)) delete store.played[seat]
  return { seat, code, public: isPublic, discount }
}

/** 当前揭示的牌库顶；没有揭示返回 null。 */
export function deckTopCard(state, seat) {
  assertSeat(state, seat)
  const record = deckTopStore(state)?.seats?.[seat]
  if (!record) return null
  return { seat, code: record.code, public: record.public, discount: record.discount }
}

/** 清理揭示（不移动卡牌）。 */
export function clearDeckTop(state, seat) {
  assertSeat(state, seat)
  const store = deckTopStore(state)
  if (!store?.seats?.[seat]) return false
  delete store.seats[seat]
  return true
}

/** 把「本轮牌库顶打出机会」记为已使用并清掉揭示；没有揭示返回 false。 */
export function markDeckTopPlayed(state, seat) {
  assertSeat(state, seat)
  const store = deckTopStore(state)
  const record = store?.seats?.[seat]
  if (!record) return false
  store.played ||= {}
  store.played[seat] = currentRound(state)
  delete store.seats[seat]
  return { seat, code: record.code, round: store.played[seat] }
}

/** 本轮是否已经用过牌库顶打出机会（round 缺省取当前回合）。 */
export function deckTopDiscountUsed(state, seat, round = currentRound(state)) {
  assertSeat(state, seat)
  integer(round, 0, '回合号')
  return deckTopStore(state)?.played?.[seat] === round
}

/** 读出「若现在打出牌库顶」的卡号与折后费用（不改状态、不移动卡牌）。 */
export function playDeckTop(state, seat, { discount = 0, cost = 0 } = {}) {
  assertSeat(state, seat)
  integer(discount, 0, '折扣')
  integer(cost, 0, '费用')
  const record = deckTopStore(state)?.seats?.[seat]
  if (!record) return false
  if (discount > 0 && deckTopDiscountUsed(state, seat)) return false
  return { seat, code: record.code, public: record.public, discount, cost, effectiveCost: Math.max(0, cost - discount) }
}

/** 顶牌是弱点时的强制抽取：从牌库顶移入手中并清掉揭示；非弱点返回 false。 */
export function deckTopWeaknessDraw(state, seat) {
  const inv = assertSeat(state, seat)
  const record = deckTopStore(state)?.seats?.[seat]
  if (!record) return false
  const def = cardDef(record.code)
  if (!def || !isWeaknessCard(def)) return false
  if (!Array.isArray(inv.deck)) throw new TypeError('调查员牌库无效')
  const at = inv.deck.lastIndexOf(record.code)
  if (at < 0) return false
  if (!Array.isArray(inv.hand)) throw new TypeError('调查员手牌无效')
  inv.deck.splice(at, 1)
  inv.hand.push(record.code)
  clearDeckTop(state, seat)
  return { seat, code: record.code, drawn: true }
}

// ---------------------------------------------------------------------------
// 给 play-channels 的 deckTop 通道使用的内部辅助（内容层不直接调用）：
// 通道把顶牌移入手中后调用 consumeDeckTop 结算使用记录；打出失败回滚时 restoreDeckTop 还原。
// ---------------------------------------------------------------------------
export function consumeDeckTop(state, seat) {
  const inv = assertSeat(state, seat)
  const record = deckTopStore(state)?.seats?.[seat]
  if (!record) return false
  if (!Array.isArray(inv.deck)) throw new TypeError('调查员牌库无效')
  const at = inv.deck.lastIndexOf(record.code)
  if (at < 0) return false
  inv.deck.splice(at, 1)
  if (!Array.isArray(inv.hand)) throw new TypeError('调查员手牌无效')
  inv.hand.push(record.code)
  markDeckTopPlayed(state, seat)
  return { code: record.code, public: record.public, discount: record.discount, round: currentRound(state) }
}

export function restoreDeckTop(state, seat, { code, public: isPublic = false, discount = 0 } = {}) {
  const inv = assertSeat(state, seat)
  if (typeof code !== 'string' || !code) throw new TypeError('牌库顶卡号无效')
  if (typeof isPublic !== 'boolean') throw new TypeError('牌库顶可见性必须是布尔值')
  integer(discount, 0, '牌库顶折扣')
  inv.deck ||= []
  inv.deck.push(code)
  const store = deckTopStore(state, true)
  store.seats[seat] = { code, public: isPublic, discount }
  if (store.played) delete store.played[seat]
  return true
}
