// P5 基玛尼·琼斯（09008）及专属依赖 Node 验收。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, settle, enemy } from './core-fixture.mjs'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import '../src/engine/engine.js'
import { registeredEntry } from '../src/engine/ability.js'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { validateDeckRules } from '../src/deck/deck-rules.js'
import { elderSignEffect, legalMoves } from '../src/engine/engine.js'
import { TSK_BONUS_XP } from '../content/campaigns/theScarletKeys/investigator-data.js'

const CODE = '09008'

test(`P5 ${CODE} 条目/旧印/构筑：额外 5 经验、旧印自动成功、专属依赖`, () => {
  const entry = registeredEntry(CODE)
  assert.ok(entry?.elderSign)
  assert.equal(TSK_BONUS_XP[CODE], 5)
  const state = fixture(CODE)
  const inv = state.investigators[0]
  const target = enemy(state, { exhausted: true, engagedSeat: null, location: inv.location })
  const effect = elderSignEffect(state, inv)
  assert.equal(effect.delta, 1)
  assert.equal(effect.autoSuccess, true)
  void target
  const deck = buildDeck(INVESTIGATORS[CODE], { seed: 'p5-09008', xp: 0 })
  assert.equal(deck.playerCards.length, 30)
  assert.ok(deck.signatureCards.includes('09009'))
  assert.ok(deck.signatureWeaknesses.includes('09010'))
  assert.deepEqual(validateDeckRules(INVESTIGATORS[CODE], deck.playerCards, ALL_CARDS).errors, [])
})

test(`P5 ${CODE} 快速交战已横置敌人`, () => {
  const state = fixture(CODE)
  const target = enemy(state, { exhausted: true, engagedSeat: null })
  const fast = legalMoves(state).find(moveItem => moveItem.action === 'freeAction')
  assert.ok(fast, '应枚举「快速交战已横置敌人」')
  move(state, fast)
  settle(state, choice => choice.options.find(option => option.id === target.id)?.id)
  assert.equal(state.enemies.find(item => item.id === target.id)?.engagedSeat, 0)
})

test(`P5 ${CODE} 躲避已横置非精英敌人时加入智识；成功超额弃敌接线`, () => {
  const reaction = registeredEntry(CODE).abilities.find(descriptor => [].concat(descriptor.trigger).includes('testBegins'))
  assert.ok(reaction, '必须声明躲避加成反应')
  const forced = registeredEntry(CODE).abilities.find(descriptor => [].concat(descriptor.trigger).includes('evadeSuccess'))
  assert.ok(forced, '必须声明成功超额弃敌的强制能力')
  assert.ok(registeredEntry('09010').enemyWeakness?.prey === true)
})
