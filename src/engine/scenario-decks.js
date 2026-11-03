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
