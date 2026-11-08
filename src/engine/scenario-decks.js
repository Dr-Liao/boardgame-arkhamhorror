import { mechanicState, integer, investigatorAt } from './mechanic-state.js'
import { randomValue } from './rules-state.js'
function pile(state, id) {
  if (typeof id !== 'string' || !/^[a-z][A-Za-z0-9]{0,63}$/.test(id) || ['constructor', 'prototype'].includes(id)) throw new TypeError('Invalid scenario deck id')
  const decks = mechanicState(state)?.scenarioDecks
  if (!decks || !Object.hasOwn(decks, id)) throw new RangeError('Scenario deck is not initialized')
  return decks[id]
}
function shuffled(state, cards) {
  const list = [...cards]
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(randomValue(state) * (i + 1)); [list[i], list[j]] = [list[j], list[i]] }
  return list
}
export function createScenarioDeckApi(state, deps = {}) {
  return {
    initialize(id, cards, { shuffle = true } = {}) {
      if (typeof id !== 'string' || !/^[a-z][A-Za-z0-9]{0,63}$/.test(id) || ['constructor', 'prototype'].includes(id)
        || !Array.isArray(cards) || cards.some(code => typeof code !== 'string' || !code)) throw new TypeError('Invalid scenario deck')
      const data = mechanicState(state, true); data.scenarioDecks ||= {}
      if (Object.hasOwn(data.scenarioDecks, id)) throw new Error('Scenario deck already initialized')
      data.scenarioDecks[id] = { deck: shuffle ? shuffled(state, cards) : [...cards], discard: [], removed: [] }
      return cards.length
    },
    size: id => pile(state, id).deck.length,
    cards: id => [...pile(state, id).deck],
    take(id, count = 1) { integer(count); const deck = pile(state, id).deck; return deck.splice(Math.max(0, deck.length - count), count).reverse() },
    put(id, cards, { shuffle = false, top = true } = {}) {
      if (!Array.isArray(cards) || cards.some(code => typeof code !== 'string' || !code)) throw new TypeError('Invalid scenario cards')
      const target = pile(state, id)
      if (top) target.deck.push(...[...cards].reverse())
      else target.deck.unshift(...cards)
      if (shuffle) target.deck = shuffled(state, target.deck)
      return cards.length
    },
    addEncounterTop(id) {
      const target = pile(state, id), card = state.encounterDeck.pop()
      if (card == null) return false
      target.deck.push(card); target.deck = shuffled(state, target.deck)
      return true
    },
    discardTop(id, count = 1) {
      integer(count); const target = pile(state, id)
      const cards = target.deck.splice(Math.max(0, target.deck.length - count), count).reverse()
      state.encounterDiscard.push(...cards)
      return [...cards]
    },
    removeTop(id, count = 1) {
      integer(count); const target = pile(state, id)
      const cards = target.deck.splice(Math.max(0, target.deck.length - count), count)
      target.removed.push(...cards)
      return cards.length // The removed identities stay hidden from callers and observers.
    },
    peek(id, seat, count = 1) {
      investigatorAt(state, seat); integer(count)
      const cards = pile(state, id).deck.slice(-count).reverse()
      if (!cards.length) return false
      deps.cardsSeen?.(id, seat, [...cards])
      deps.choice({ kind: 'card', seat, source: id, prompt: '查看这些牌，然后继续。',
        options: cards.map((code, index) => ({ id: String(index), cardCode: code, label: deps.cardName?.(code) || code })) })
      return true
    },
    revealChooseDraw(id, seat, count = 1, { mixEncounterTop = false } = {}) {
      investigatorAt(state, seat); integer(count, 1)
      const target = pile(state, id), revealed = target.deck.splice(Math.max(0, target.deck.length - count), count).reverse()
      if (!revealed.length) return null
      deps.cardsSeen?.(id, seat, [...revealed])
      const answer = deps.choice({ kind: 'card', seat, source: id, prompt: '选择一张揭示的牌并抽取。',
        options: revealed.map((code, index) => ({ id: String(index), cardCode: code, label: deps.cardName?.(code) || code })) })
      const index = Number(answer)
      if (!Number.isInteger(index) || index < 0 || index >= revealed.length) throw new Error('Invalid scenario draw selection')
      const [card] = revealed.splice(index, 1)
      if (mixEncounterTop && state.encounterDeck.length) revealed.push(state.encounterDeck.pop())
      target.deck = shuffled(state, [...target.deck, ...revealed])
      if (typeof deps.drawCard !== 'function') throw new Error('Scenario draw needs the real encounter pipeline')
      deps.drawCard(seat, card)
      return card
    },
  }
}

// ---------------------------------------------------------------------------
// EotE `scenario.tekeliDeck` 需要的通用隐藏洗牌原语（P2）。
//
// 这些函数只操作既有 `mechanicState.scenarioDecks` 存储（不另建牌堆），并沿用
// 「deck 数组尾部 = 牌库顶、头部 = 牌库底」的既有约定；初始化的洗牌仍由
// createScenarioDeckApi 走 randomValue(state)。
//
// 隐藏信息口径：
//   · 不发 cardsSeen / 不开 choice / 不写日志，抽到/洗入的卡号只作为**受信任返回值**
//     交给引擎内部（测试可以断言），不得直接下发观察者；观察者只应看到牌库张数。
//   · 牌库顺序本身是隐藏信息：返回的 code 顺序不是洗入后牌库里的顺序，也不代表顶牌。
//   · `shuffle` 允许注入确定性回调（可重放/测试用），返回值必须保留同一组卡牌；
//     无法保留时抛错且不写任何状态（不做部分洗入）。
const DECK_ID_PATTERN = /^[a-z][A-Za-z0-9]{0,63}$/
const RESERVED_DECK_IDS = ['constructor', 'prototype']

function validateCodes(codes, label) {
  if (!Array.isArray(codes) || codes.some(code => typeof code !== 'string' || !code)) {
    throw new TypeError(`${label}必须是非空字符串数组`)
  }
  return codes
}

// 洗牌回调的 fail-closed 校验：必须返回同一组卡牌（不增、不减、不变字符串），
// 否则抛错——否则一次坏回调会凭空吞牌/复制牌。
function validateShuffled(original, result) {
  if (!Array.isArray(result) || result.length !== original.length) throw new TypeError('shuffle 回调必须返回同一数量的卡牌')
  if (result.some(code => typeof code !== 'string' || !code)) throw new TypeError('shuffle 回调必须返回卡牌 code')
  const left = [...original].sort()
  const right = [...result].sort()
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) throw new TypeError('shuffle 回调不得增删或改写卡牌')
  return result
}

/** 剧本牌库张数（未初始化抛 RangeError；只读，不暴露牌序）。 */
export function scenarioDeckSize(state, deckId) {
  return pile(state, deckId).deck.length
}

/**
 * 不看内容地把剧本牌库顶 `count` 张洗入 `seat` 的牌库（08604 洛基岩壁等）。
 * 先做完全部校验（牌库张数、注入洗牌结果）再一次性写入：失败时两张牌库都不变。
 * 返回被洗入的 code 数组（受信任读点），不返回洗入后的牌库顺序/顶牌。
 */
export function shuffleTopIntoInvestigatorDeck(state, { deckId, seat, count = 1, shuffle } = {}) {
  const inv = investigatorAt(state, seat)
  integer(count, 1)
  if (shuffle != null && typeof shuffle !== 'function') throw new TypeError('shuffle 必须是函数')
  if (inv.deck != null && !Array.isArray(inv.deck)) throw new TypeError('调查员牌库必须是数组')
  const target = pile(state, deckId)
  if (target.deck.length < count) return false
  const taken = target.deck.slice(target.deck.length - count).reverse()
  const base = [...(inv.deck || [])]
  const mixed = validateShuffled([...base, ...taken], (shuffle || (cards => shuffled(state, cards)))([...base, ...taken]))
  target.deck.splice(target.deck.length - count, count)
  inv.deck = mixed
  return taken
}

/**
 * 从剧本牌库顶抽 N 张交给受信任的调用方（不写日志/不发私密投影）。
 * 张数不足时返回 false 且不抽（fail closed，避免「抽到一半」的部分结算）。
 * 返回从顶到底的 code 数组。
 */
export function drawFromScenarioDeck(state, deckId, count = 1) {
  integer(count, 1)
  const target = pile(state, deckId)
  if (target.deck.length < count) return false
  return target.deck.splice(target.deck.length - count, count).reverse()
}

/**
 * 把 code 放回剧本牌库底（按传入顺序：codes[0] 成为新的最底牌）。
 * 返回放回张数；非法 code 抛错。是否已从原区域移除由调用方负责（本原语不猜来源区域）。
 */
export function returnToScenarioDeckBottom(state, deckId, codes) {
  validateCodes(codes, '剧本牌库 code')
  const target = pile(state, deckId)
  if (!codes.length) return 0
  target.deck.unshift(...codes)
  return codes.length
}

/** 读档校验：既有 `scenarioDecks` 扩展的形状。Lead 在 save-migration 里调用。 */
export function validateEoteDecks(state, value = mechanicState(state)?.scenarioDecks) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new TypeError('状态必须是对象')
  if (value == null) return true
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError('剧本书牌库扩展必须是对象')
  for (const [id, deck] of Object.entries(value)) {
    if (!DECK_ID_PATTERN.test(id) || RESERVED_DECK_IDS.includes(id)) throw new TypeError('剧本书牌库名称无效')
    if (!deck || typeof deck !== 'object' || Array.isArray(deck)) throw new TypeError('剧本书牌库记录必须是对象')
    for (const key of Object.keys(deck)) if (!['deck', 'discard', 'removed'].includes(key)) throw new TypeError(`剧本书牌库记录未知字段 ${key}`)
    for (const zone of ['deck', 'discard', 'removed']) {
      if (!Array.isArray(deck[zone]) || deck[zone].some(code => typeof code !== 'string' || !code)) throw new TypeError('剧本书牌库卡牌无效')
    }
  }
  return true
}
