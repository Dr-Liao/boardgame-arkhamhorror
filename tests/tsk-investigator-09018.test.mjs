// P5 查理·凯恩（09018）及专属依赖 Node 验收。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset } from './core-fixture.mjs'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import '../src/engine/engine.js'
import { registeredEntry } from '../src/engine/ability.js'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { validateDeckRules } from '../src/deck/deck-rules.js'
import { canEquip, elderSignEffect } from '../src/engine/engine.js'
import { investigatorRule } from '../src/cards/card-rules.js'

const CODE = '09018'

test(`P5 ${CODE} 条目/旧印/构筑：3 个额外盟友槽、双副职阶、专属依赖`, () => {
  assert.deepEqual(investigatorRule(CODE).extraSlots, { ally: 3 })
  const state = fixture(CODE)
  const inv = state.investigators[0]
  const buddies = [asset(state, '09019'), asset(state, '09019')]
  inv.assets.push({ id: 'ally3', code: '09019', exhausted: false }, { id: 'ally4', code: '09019', exhausted: false })
  assert.equal(canEquip(inv, ALL_CARDS['09019']), false, '4 名盟友已占满 4 个盟友槽，不能再装备盟友')
  void buddies
  const effect = elderSignEffect(state, inv)
  // 卡面「[elder_sign] 效果：+3」（cards-data/中文卡面/参考文本一致），旧断言 +1 是错误实现。
  assert.equal(effect.delta, 3)
})

test(`P5 ${CODE} 双职阶选择与构筑合法性`, () => {
  const deck = buildDeck(INVESTIGATORS[CODE], { seed: 'p5-09018', xp: 0 })
  assert.equal(deck.playerCards.length, 30)
  assert.equal(deck.classChoices['guardian|mystic|rogue|seeker|survivor'].length, 2)
  assert.deepEqual(deck.signatureCards, ['09019'])
  assert.deepEqual(deck.signatureWeaknesses, ['09020'])
  assert.deepEqual(validateDeckRules(INVESTIGATORS[CODE], deck.playerCards, ALL_CARDS).errors, [])
  // fast 横置盟友的加成能力（P1-6：检定期 [fast] 改走 abilities free 描述子才可达）& 邦妮重整反应。
  const free = registeredEntry(CODE).abilities.find(descriptor => descriptor.kind === 'free')
  assert.ok(free, '必须声明检定期 [fast] 的 free 描述子（playerWindow 只枚举 abilities）')
  assert.deepEqual(free.trigger, ['test.beforeCommit', 'test.afterCommit'])
  assert.equal(free.duringOwnSkillTest, true)
  assert.ok(registeredEntry('09019').abilities.some(descriptor => [].concat(descriptor.trigger).includes('assetExhausted')))
  assert.ok(registeredEntry('09020').abilities.some(descriptor => descriptor.kind === 'weakness'))
})
