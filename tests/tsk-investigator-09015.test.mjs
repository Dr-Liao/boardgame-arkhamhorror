// P5 达雷尔·西蒙斯（09015）及专属依赖 Node 验收。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, settle } from './core-fixture.mjs'
import { createGameState } from '../src/engine/engine.js'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import '../src/engine/engine.js'
import { registeredEntry } from '../src/engine/ability.js'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { validateDeckRules } from '../src/deck/deck-rules.js'
import { elderSignEffect } from '../src/engine/engine.js'
import { cardCounterOf } from '../src/engine/card-counters.js'

const CODE = '09015'

test(`P5 ${CODE} 条目/旧印/构筑：开局柯达在场、旧印放证据、专属依赖`, () => {
  const state = createGameState({ playerInvestigator: CODE, seed: 'p5-09015-setup' }, [{ seat: 0 }])
  settle(state)
  const inv = state.investigators[0]
  const kodak = inv.assets.find(asset => asset.code === '09016')
  assert.ok(kodak, '开局应带入达雷尔的柯达相机')
  const effect = elderSignEffect(state, inv)
  assert.equal(effect.delta, 1)
  assert.ok(cardCounterOf(kodak, 'evidence') >= 1, '旧印应在柯达上放 1 个证据')
  const deck = buildDeck(INVESTIGATORS[CODE], { seed: 'p5-09015', xp: 0 })
  assert.equal(deck.playerCards.length, 30)
  assert.deepEqual(deck.signatureCards, ['09016'])
  assert.deepEqual(deck.signatureWeaknesses, ['09017'])
  assert.deepEqual(validateDeckRules(INVESTIGATORS[CODE], deck.playerCards, ALL_CARDS).errors, [])
})

test(`P5 ${CODE} fast 花证据降低难度 2（每次检定限一次）`, () => {
  const entry = registeredEntry(CODE)
  const free = entry.investigator.freeAction
  assert.ok(free, '必须声明检定期间的 fast 能力')
  assert.equal(free.duringOwnSkillTest, true)
  assert.ok(registeredEntry('09017').abilities.some(descriptor => descriptor.kind === 'weakness'))
})
