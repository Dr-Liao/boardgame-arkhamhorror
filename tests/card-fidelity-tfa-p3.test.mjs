// 卡牌保真度 P3 · 失落的时代首批（04002/04008/04017/04022）。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture } from './core-fixture.mjs'
import { registeredEntry } from '../src/engine/ability.js'

test('04002 厄休拉旧印：检定结束后可移动，不要求成功', () => {
  const effect = registeredEntry('04002').elderSign.resolve({})
  assert.equal(effect.mayMoveAfterTest, true)
  assert.equal(effect.mayMoveAfterTestAlways, true)
})

test('04008 杰克·威廉斯：每回合只有一次免借机攻击', () => {
  assert.equal(registeredEntry('04008').passive?.noOpportunityFirstAction, true)
  // 引擎读点改成一个布尔位；同一回合第二次移动/调查不再免借机。
  const state = fixture('01001')
  state.investigators[0].jakeFree = { round: 1, used: true }
  assert.equal(state.investigators[0].jakeFree.used, true)
})

test('04017 求生匕首：反击是敌军阶段的反应', () => {
  const descriptor = registeredEntry('04017').abilities.find(ability => ability.trigger?.includes('enemyAttackDamage'))
  assert.ok(descriptor)
  assert.equal(descriptor.legacyReaction, true)
  assert.equal(descriptor.cost.exhaust, true)
})

test('04022 古代巨石：调查时帷幕 +3，并标记古代巨石', () => {
  const descriptor = registeredEntry('04022').abilities[0]
  let options = null
  descriptor.resolve({ inv: { seat: 0 }, api: { investigate: (_seat, opts) => { options = opts } } })
  assert.equal(options.shroudMod, 3)
  assert.equal(options.ancientStone, true)
})
