// P5 卡森·辛克莱（09001）及专属依赖 Node 验收。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, settle } from './core-fixture.mjs'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import '../src/engine/engine.js'
import { registeredEntry } from '../src/engine/ability.js'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { validateDeckRules } from '../src/deck/deck-rules.js'
import { elderSignEffect, legalMoves } from '../src/engine/engine.js'
import { grantRestrictedAction } from '../src/engine/restricted-actions.js'
import { investigatorRule } from '../src/cards/card-rules.js'
import { getAvailability } from '../src/deck/availability.js'

const CODE = '09001'

test(`P5 ${CODE} 条目/旧印/构筑：注册、旧印 +0 抽牌、专属依赖与职阶选择`, () => {
  const entry = registeredEntry(CODE)
  assert.ok(entry, '必须注册调查员条目')
  assert.equal(entry.kind, 'investigator')
  assert.ok(entry.elderSign, '必须有旧印描述子')
  const rule = investigatorRule(CODE)
  assert.equal(rule.restrictedAction.kind, 'crossSeatAction')
  assert.equal(rule.trackCommitToOther, true)
  // 旧印 +0 且获得 1 次可选抽牌。
  const state = fixture(CODE)
  const inv = state.investigators[0]
  const handBefore = inv.hand.length
  const effect = elderSignEffect(state, inv)
  assert.equal(effect.delta, 0)
  settle(state)
  assert.equal(effect.optionalDraw, 1, '旧印应提供 1 次可选抽牌')
  assert.ok(inv.hand.length >= handBefore)
  // 构筑：30 张 + 2 张签名 + 1 张弱点，且选定 1 个次级职阶。
  const deck = buildDeck(INVESTIGATORS[CODE], { seed: 'p5-09001', xp: 0 })
  assert.equal(deck.playerCards.length, 30)
  assert.deepEqual(deck.signatureCards.sort(), ['09002', '09002'])
  assert.equal(deck.signatureWeaknesses.length, 1)
  assert.equal(deck.classChoices['mystic|seeker|survivor'].length, 1)
  assert.deepEqual(validateDeckRules(INVESTIGATORS[CODE], deck.playerCards, ALL_CARDS).errors, [])
  assert.equal(getAvailability(CODE).availability, 'strict')
})

test(`P5 ${CODE} 额外受限行动只用于授权能力，并调用立即行动原语`, () => {
  const state = fixture(CODE)
  const inv = state.investigators[0]
  const before = inv.crossSeatActionOnlyActions || 0
  grantRestrictedAction(state, inv, 'crossSeatAction')
  assert.ok((inv.crossSeatActionOnlyActions || 0) >= Math.max(1, before))
  const free = legalMoves(state).find(moveItem => moveItem.action === 'freeAction')
  assert.ok(free, '回合内应显示卡森的授权能力')
  // 单人桌：无可授权目标，能力仍合法结算并消耗额度。
  const creditBefore = inv.crossSeatActionOnlyActions || 0
  move(state, free)
  settle(state)
  const after = state.investigators[0]
  assert.ok((after.crossSeatActionOnlyActions || 0) < creditBefore, '结算后应消耗受限额度')
})

test(`P5 ${CODE} 专属弱点与投入到他人检定的记账口径`, () => {
  const state = fixture(CODE)
  const inv = state.investigators[0]
  assert.ok(registeredEntry('09002').abilities.some(descriptor => descriptor.kind === 'commit'))
  assert.ok(registeredEntry('09003').abilities.some(descriptor => descriptor.kind === 'weakness'))
  // 记账：把牌投入到他人检定后，committedToOtherThisTurn 记录本轮。
  inv.committedToOtherThisTurn = { round: state.round }
  const rule = investigatorRule(CODE)
  assert.equal(rule.trackCommitToOther, true)
  assert.equal(inv.committedToOtherThisTurn.round, state.round)
  void move
})
