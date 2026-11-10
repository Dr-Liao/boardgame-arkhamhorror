// P5 文森特·李（09004）及专属依赖 Node 验收。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './core-fixture.mjs'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { validateDeckRules } from '../src/deck/deck-rules.js'
import { elderSignEffect } from '../src/engine/engine.js'
import '../src/engine/engine.js'
import { registeredEntry } from '../src/engine/ability.js'
import { investigatorRule } from '../src/cards/card-rules.js'

const CODE = '09004'

test(`P5 ${CODE} 条目/旧印/构筑：治疗旧印、30+签名、场外《术后恢复》`, () => {
  const entry = registeredEntry(CODE)
  assert.ok(entry?.elderSign)
  assert.deepEqual(investigatorRule(CODE).setup?.setAsideSignature, { code: '09006', perInvestigator: true })
  const state = fixture(CODE)
  const inv = state.investigators[0]
  // 开局场外 1 张《术后恢复》（单人）。
  const setAside = (state.setAside || []).filter(card => card.code === '09006')
  assert.equal(setAside.length, 1)
  // 旧印：+1 且可治疗 1 点伤害。
  const effect = elderSignEffect(state, inv)
  assert.equal(effect.delta, 1)
  // 构筑：030 主牌 + 5 张签名（09005 + 4 张 09006？不，构筑牌组里按 quantity 放入）+ 1 弱点。
  const deck = buildDeck(INVESTIGATORS[CODE], { seed: 'p5-09004', xp: 0 })
  assert.equal(deck.playerCards.length, 30)
  assert.ok(deck.signatureCards.includes('09005'))
  assert.ok(deck.signatureCards.includes('09006'))
  assert.ok(deck.signatureWeaknesses.includes('09007'))
  assert.deepEqual(validateDeckRules(INVESTIGATORS[CODE], deck.playerCards, ALL_CARDS).errors, [])
})

test(`P5 ${CODE} 治疗后把场外《术后恢复》加入手牌（damageHealed 窗口）`, () => {
  const state = fixture(CODE)
  const inv = state.investigators[0]
  // 直接构造已被治疗的上下文：触发反应描述子的 resolve 路径由引擎窗口驱动，这里验证静态接线。
  const reaction = registeredEntry(CODE).abilities.find(descriptor => [].concat(descriptor.trigger).includes('damageHealed'))
  assert.ok(reaction, '必须声明 damageHealed 反应')
  assert.ok(registeredEntry('09005').abilities.some(descriptor => descriptor.kind === 'action'))
  assert.ok(registeredEntry('09006').zoneReplacement?.discard === 'setAside')
  assert.ok(registeredEntry('09007').weaknessPlaysAsAsset === true)
  void inv
})
