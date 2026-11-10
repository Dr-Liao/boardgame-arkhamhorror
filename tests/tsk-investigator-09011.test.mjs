// P5 阿米娜·齐达内（09011）及专属依赖 Node 验收。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './core-fixture.mjs'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import '../src/engine/engine.js'
import { registeredEntry } from '../src/engine/ability.js'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { validateDeckRules } from '../src/deck/deck-rules.js'
import { elderSignEffect } from '../src/engine/engine.js'

const CODE = '09011'

test(`P5 ${CODE} 条目/旧印/构筑：减费反应、旧印 +2、专属依赖`, () => {
  const entry = registeredEntry(CODE)
  assert.ok(entry?.elderSign)
  assert.ok(entry.abilities.some(descriptor => [].concat(descriptor.trigger).includes('beforePlayCost')))
  assert.ok(entry.abilities.some(descriptor => [].concat(descriptor.trigger).includes('assetEnteredPlay')))
  const state = fixture(CODE)
  const inv = state.investigators[0]
  const effect = elderSignEffect(state, inv)
  assert.equal(effect.delta, 2)
  const deck = buildDeck(INVESTIGATORS[CODE], { seed: 'p5-09011', xp: 0 })
  assert.equal(deck.playerCards.length, 30)
  assert.deepEqual([...deck.signatureCards].sort(), ['09012', '09013'])
  assert.deepEqual(deck.signatureWeaknesses, ['09014'])
  assert.deepEqual(validateDeckRules(INVESTIGATORS[CODE], deck.playerCards, ALL_CARDS).errors, [])
})

test(`P5 ${CODE} 打支援减费 3 且带 1 毁灭入场（接线与词典）`, () => {
  const entry = registeredEntry(CODE)
  const cost = entry.abilities.find(descriptor => [].concat(descriptor.trigger).includes('beforePlayCost'))
  assert.equal(cost.limit.label, 'oncePerRound')
  const doom = entry.abilities.find(descriptor => [].concat(descriptor.trigger).includes('assetEnteredPlay'))
  assert.ok(doom)
  assert.ok(registeredEntry('09012').abilities[0].kind === 'played')
  assert.ok(registeredEntry('09013').abilities[0].kind === 'played')
  assert.ok(registeredEntry('09014').abilities.some(descriptor => descriptor.kind === 'weakness'))
})
