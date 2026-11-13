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
  // P1-6：检定期 [free] 改走 abilities 描述子（playerWindow 只枚举 abilities，不读 investigator.freeAction）。
  const free = entry.abilities.find(descriptor => descriptor.kind === 'free')
  assert.ok(free, '必须声明检定期 [free] 能力的 free 描述子')
  assert.deepEqual(free.trigger, ['test.beforeCommit', 'test.afterCommit'])
  assert.equal(free.limit?.scope, 'perTest', '卡面「每次检定限一次」走 generic perTest 上限')
  assert.ok(registeredEntry('09017').abilities.some(descriptor => descriptor.kind === 'weakness'))
})
