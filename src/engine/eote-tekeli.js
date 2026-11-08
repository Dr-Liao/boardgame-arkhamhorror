// 七循环《地球边缘》的忒咳哩-哩（Tekeli-li!）弱点牌库原语（P2 `scenario.tekeliDeck`）。
//
// 存储复用 scenario-decks.js 的既有 `mechanicState.scenarioDecks`（牌库 id 固定为
// `tekeli`），本模块只补 EotE 专属语义与元数据，不复制牌堆存储：
//   · `scenarioFlags.mechanics.eote.tekeli = { version: 1, deckId: 'tekeli',
//     faces: [...], copies: [...], total }`；
//   · 七个卡面 × 印刷份数（参考 CardDefs/Tekelili.hs 的 cdEncounterSetQuantity：
//     3+3+2+2+2+2+2 = 16 张）由参数传入；卡面 id 不写死在本模块。
//
// 规则口径（参考 `Campaigns/EdgeOfTheEarth/Helpers.hs` 的 gatherTekelili /
// resolveTekelili / addTekelili）：
//   · 洗入调查员牌库时**不查看内容**：不发 cardsSeen / 不开选择 / 不写日志，只返回
//     受信任的 code 数组；观察者只能看到牌库张数。
//   · 抽到后按弱点结算（由弱点管线负责）；结算后默认「放回忒咳哩-哩牌库底」，
//     持续修正可改为：放回自己牌库底、洗入自己/任一调查员牌库、弃掉。`tekeliReturn`
//     只执行去向登记，不猜牌当前在哪个区域——移出原区域由弱点结算调用方完成。
//   · 物理副本按 code 记账，同一 face 的多张副本共用 code（引擎既有牌堆口径），
//     因此本模块不按 code 去重；副本守恒由抽/放调用方保证。
import { mechanicState, integer, investigatorAt } from './mechanic-state.js'
import { randomValue } from './rules-state.js'
import { eoteScenarioState } from './eote-state.js'
import {
  createScenarioDeckApi, drawFromScenarioDeck, returnToScenarioDeckBottom,
  shuffleTopIntoInvestigatorDeck,
} from './scenario-decks.js'

export const TEKELI_DECK_ID = 'tekeli'
// 参考实现的印刷份数（7 个卡面：3+3+2+2+2+2+2）；只在未显式传 copies 时使用。
export const TEKELI_PRINT_COPIES = Object.freeze([3, 3, 2, 2, 2, 2, 2])
export const TEKELI_CARD_COUNT = 16
export const EOTE_TEKELI_VERSION = 1
const TEKELI_FIELDS = Object.freeze(['version', 'deckId', 'faces', 'copies', 'total'])
const RETURN_DESTINATIONS = Object.freeze(['bottom', 'deck', 'anyDeck', 'discard'])

function requireState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new TypeError('状态必须是对象')
  return state
}

function tekeliMeta(state) {
  return eoteScenarioState(state)?.tekeli ?? null
}

function scenarioDeckOf(state) {
  const decks = mechanicState(state)?.scenarioDecks
  return decks && Object.hasOwn(decks, TEKELI_DECK_ID) ? decks[TEKELI_DECK_ID] : null
}

function validateShuffled(original, result) {
  if (!Array.isArray(result) || result.length !== original.length) throw new TypeError('shuffle 回调必须返回同一数量的卡牌')
  if (result.some(code => typeof code !== 'string' || !code)) throw new TypeError('shuffle 回调必须返回卡牌 code')
  const left = [...original].sort()
  const right = [...result].sort()
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) throw new TypeError('shuffle 回调不得增删或改写卡牌')
  return result
}

/**
 * 建立忒咳哩-哩牌库：`cards` 是 7 个卡面 id，`copies` 可选（缺省用参考印刷份数
 * 3+3+2+2+2+2+2，此时要求恰好 7 个卡面）。牌库实体写进 scenarioDecks（乱序），
 * 本模块只写元数据；重复初始化抛错，非法参数抛错且不写状态。返回总张数。
 */
export function initializeTekeliDeck(state, spec = {}) {
  requireState(state)
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new TypeError('忒咳哩-哩初始化声明必须是对象')
  const cards = spec.cards
  if (!Array.isArray(cards) || !cards.length || cards.some(code => typeof code !== 'string' || !code)) {
    throw new TypeError('cards 必须是非空卡面 id 数组')
  }
  if (new Set(cards).size !== cards.length) throw new TypeError('cards 不能重复')
  let copies
  if (spec.copies == null) {
    if (cards.length !== TEKELI_PRINT_COPIES.length) throw new TypeError(`未提供 copies 时必须恰好 ${TEKELI_PRINT_COPIES.length} 个卡面`)
    copies = [...TEKELI_PRINT_COPIES]
  } else {
    if (!Array.isArray(spec.copies) || spec.copies.length !== cards.length) throw new TypeError('copies 必须与 cards 一一对应')
    copies = spec.copies.map(count => integer(count, 1))
  }
  const total = copies.reduce((sum, count) => sum + count, 0)
  if (!Number.isSafeInteger(total) || total < 1) throw new TypeError('忒咳哩-哩牌库总张数无效')
  if (tekeliMeta(state) || scenarioDeckOf(state)) throw new Error('忒咳哩-哩牌库已经初始化')

  const expanded = []
  for (let index = 0; index < cards.length; index += 1) {
    for (let copy = 0; copy < copies[index]; copy += 1) expanded.push(cards[index])
  }
  const data = eoteScenarioState(state, true)
  createScenarioDeckApi(state).initialize(TEKELI_DECK_ID, expanded)
  data.tekeli = { version: EOTE_TEKELI_VERSION, deckId: TEKELI_DECK_ID, faces: [...cards], copies: [...copies], total }
  return total
}

/** 忒咳哩-哩牌库当前张数；未初始化或牌堆缺失返回 0（只读，不暴露牌序）。 */
export function tekeliDeckSize(state) {
  requireState(state)
  const deck = scenarioDeckOf(state)
  return deck ? deck.deck.length : 0
}

/**
 * 不看内容地把牌库顶 `count` 张洗入 `seat` 的牌库（08604 洛基岩壁等）。
 * 返回被洗入的 code 数组（受信任读点）；张数不足返回 false 且两张牌库都不变。
 */
export function tekeliShuffleIn(state, seat, count = 1, { shuffle } = {}) {
  requireState(state)
  investigatorAt(state, seat)
  integer(count, 1)
  if (shuffle != null && typeof shuffle !== 'function') throw new TypeError('shuffle 必须是函数')
  if (!tekeliMeta(state)) return false
  return shuffleTopIntoInvestigatorDeck(state, { deckId: TEKELI_DECK_ID, seat, count, shuffle })
}

/** 从忒咳哩-哩牌库顶抽 1 张交给受信任的调用方（弱点管线）；牌库空返回 false。 */
export function tekeliDraw(state) {
  requireState(state)
  if (!tekeliMeta(state) || tekeliDeckSize(state) === 0) return false
  const drawn = drawFromScenarioDeck(state, TEKELI_DECK_ID, 1)
  return drawn ? drawn[0] : false
}

/**
 * 忒咳哩-哩结算后的去向：
 *   · 'bottom'（默认）：放回忒咳哩-哩牌库底（参考 resolveTekelili 的默认去向）；
 *   · 'deck'：放回 `seat` 的牌库底（PlaceOnBottomOfDeckInsteadOfDiscard）；
 *   · 'anyDeck'：洗入 `seat` 的牌库（ShuffleIntoDeck / ShuffleIntoAnyDeck，座位由调用方选定）；
 *   · 'discard'：放入 `seat` 的弃牌堆（弃置兜底）。
 * 返回 `{ code, destination, seat }`；牌库未初始化返回 false。是否已从原区域移出
 * 由弱点结算调用方负责（本原语不做来源猜测、不重复检查副本）。
 */
export function tekeliReturn(state, code, { destination = 'bottom', seat = null, shuffle = null } = {}) {
  requireState(state)
  if (typeof code !== 'string' || !code) throw new TypeError('忒咳哩-哩 code 必须是非空字符串')
  if (!RETURN_DESTINATIONS.includes(destination)) throw new TypeError('未知的忒咳哩-哩去向')
  if (shuffle != null && typeof shuffle !== 'function') throw new TypeError('shuffle 必须是函数')
  if (!tekeliMeta(state)) return false
  if (destination === 'bottom') {
    returnToScenarioDeckBottom(state, TEKELI_DECK_ID, [code])
    return { code, destination, seat: null }
  }
  if (seat == null) throw new TypeError('该去向需要指定调查员座位')
  const inv = investigatorAt(state, seat)
  if (destination === 'deck') {
    if (inv.deck != null && !Array.isArray(inv.deck)) return false
    inv.deck ||= []
    inv.deck.unshift(code)
    return { code, destination, seat }
  }
  if (destination === 'anyDeck') {
    if (inv.deck != null && !Array.isArray(inv.deck)) return false
    const base = [...(inv.deck || []), code]
    inv.deck = typeof shuffle === 'function' ? validateShuffled(base, shuffle([...base])) : shuffleWithRandom(state, base)
    return { code, destination, seat }
  }
  if (!Array.isArray(inv.discard)) return false
  inv.discard.push(code)
  return { code, destination, seat }
}

function shuffleWithRandom(state, cards) {
  const list = [...cards]
  for (let index = list.length - 1; index > 0; index -= 1) {
    const target = Math.floor(randomValue(state) * (index + 1))
    ;[list[index], list[target]] = [list[target], list[index]]
  }
  return list
}

/** 读档校验：忒咳哩-哩元数据 + 底层 scenarioDecks 存储的一致性。 */
export function validateEoteTekeli(state, value = tekeliMeta(state)) {
  requireState(state)
  if (value == null) return true
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError('忒咳哩-哩状态必须是对象')
  for (const key of Object.keys(value)) if (!TEKELI_FIELDS.includes(key)) throw new TypeError(`忒咳哩-哩状态未知字段 ${key}`)
  if (value.version !== EOTE_TEKELI_VERSION) throw new TypeError('不支持的忒咳哩-哩状态版本')
  if (value.deckId !== TEKELI_DECK_ID) throw new TypeError('忒咳哩-哩牌库 id 无效')
  if (!Array.isArray(value.faces) || !value.faces.length) throw new TypeError('忒咳哩-哩卡面列表无效')
  if (value.faces.some(code => typeof code !== 'string' || !code)) throw new TypeError('忒咳哩-哩卡面 id 无效')
  if (new Set(value.faces).size !== value.faces.length) throw new TypeError('忒咳哩-哩卡面 id 重复')
  if (!Array.isArray(value.copies) || value.copies.length !== value.faces.length) throw new TypeError('忒咳哩-哩印刷份数无效')
  if (value.copies.some(count => !Number.isSafeInteger(count) || count < 1)) throw new TypeError('忒咳哩-哩印刷份数无效')
  const total = value.copies.reduce((sum, count) => sum + count, 0)
  if (value.total !== total) throw new TypeError('忒咳哩-哩总张数与印刷份数不一致')
  const deck = scenarioDeckOf(state)
  if (!deck) throw new TypeError('忒咳哩-哩牌库存储缺失')
  const faces = new Set(value.faces)
  for (const zone of ['deck', 'discard', 'removed']) {
    if (!Array.isArray(deck[zone]) || deck[zone].some(code => !faces.has(code))) throw new TypeError('忒咳哩-哩牌库存储含未知卡面')
  }
  return true
}
