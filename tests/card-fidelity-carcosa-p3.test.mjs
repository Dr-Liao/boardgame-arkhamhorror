// 卡牌保真度 P3 · 卡尔克萨批次（机制类）回归。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, asset, enemy, move, settle, validateMove, legalMoves } from './core-fixture.mjs'
import { registeredEntry } from '../src/engine/ability.js'
import { nonPlayerEntryFor } from '../src/cards/encounter-abilities.js'
import { behavior as blackStarsRise } from '../content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js'

const me = state => state.investigators[0]

test('03107/03109/03111/03113/03115：沉稳（Composure）卡牌场上仅限 1 张', () => {
  const state = fixture('01001')
  asset(state, '03107')
  me(state).hand.push('03109')
  me(state).resources = 30
  assert.match(validatePlay(state, '03109'), /沉稳/)
  // 场上没有沉稳卡时可以打出。
  const fresh = fixture('01001')
  fresh.investigators[0].hand.push('03109')
  fresh.investigators[0].resources = 30
  assert.equal(validatePlay(fresh, '03109'), null)
})

function validatePlay(state, code) {
  return validateMove(state, 0, { action: 'play', cardId: code })
}

test('03147 双刃短刀：交战行动不引发借机攻击', () => {
  const state = fixture('01001')
  asset(state, '03147')
  const target = enemy(state, { engagedSeat: null, damage: 2, horror: 1 })
  move(state, { action: 'engage', enemyId: target.id })
  settle(state)
  assert.equal(state.investigators[0].damage, 0)
  assert.equal(state.investigators[0].horror, 0)
  assert.equal(state.enemies.find(item => item.id === target.id).engagedSeat, 0)
})

test('03288 北部塔楼：a 密谋毁灭多于 c 时所有技能检定 -1', () => {
  const state = fixture('01001')
  state.scenarioFlags.agendaDecks = { a: { doom: 2 }, c: { doom: 1 } }
  state.locations[0].originalCode = '03288'
  state.locations[0].code = '03288'
  me(state).location = state.locations[0].id
  assert.equal(blackStarsRise.testDifficultyModifier(state, me(state)), -1)
  state.scenarioFlags.agendaDecks.a.doom = 1
  assert.equal(blackStarsRise.testDifficultyModifier(state, me(state)), 0)
})

test('03291 修道院教堂：双密谋 +2 帷幕；进入需在垮塌的台阶共同支付 3×人数线索', () => {
  const state = fixture('01001', 2)
  state.scenarioFlags.agendaDecks = { a: { index: 0 }, c: { index: 1 } }
  const church = { id: 'abbeyChurch', originalCode: '03291', code: '03291' }
  state.locations.push(church)
  assert.equal(blackStarsRise.locationShroudModifier(state, church), 2)
  const stairs = { id: 'brokenSteps', originalCode: '03289', code: '03289' }
  state.locations.push(stairs)
  for (const inv of state.investigators) inv.location = 'brokenSteps'
  assert.match(blackStarsRise.investigatorEntryError(state, church), /共同支付/)
  state.investigators[0].clues = 6
  assert.equal(blackStarsRise.investigatorEntryError(state, church), null)
  let paid = 0
  blackStarsRise.beforeMove(state, state.investigators[0], church, { payClues: amount => { paid = amount } })
  assert.equal(paid, 6)
})

test('03124/03125：每个已揭示历史协会地点 +每人 1 线索，上限为线索值', () => {
  for (const code of ['03124', '03125']) {
    const state = fixture('01001', 2)
    state.scenario = { ...state.scenario, passagewayLocations: [] }
    state.campaign = { ...state.campaign, leadSeat: 0 }
    state.locations = [
      { id: 'museum', originalCode: '03134', code: '03134', revealed: true, clues: 0, cluesPerInvestigator: 2, maxClues: 4 },
      { id: 'reading', originalCode: '03137', code: '03137', revealed: true, clues: 3, cluesPerInvestigator: 1, maxClues: 3 },
    ]
    nonPlayerEntryFor(code).actRule.onReveal(state, {}, {
      choose: () => '0', giveAsset() {}, place() {},
    })
    assert.equal(state.locations[0].clues, 2, `${code} 加 2 个线索`)
    assert.equal(state.locations[1].clues, 3, `${code} 不超过地点线索值`)
  }
})

test('03306 遗觉记忆没有 Fast（卡面未印快速）；03266 奥术洞察为每回合；03029 补自己的回合条件', () => {
  assert.equal(registeredEntry('03306').abilities.some(ability => ability.fast === true), false)
  assert.equal(registeredEntry('03266').abilities[0].limit.scope, 'perTurn')
  assert.equal(registeredEntry('03029').playCondition.length, 1)
  assert.equal(registeredEntry('03029').abilities[0].fast, true)
})

test('03012 彩绘世界可以复制只有 resolve 的非快速事件', () => {
  const state = fixture('03003')
  state.investigators[0].hand = ['03012']
  state.investigators[0].beneath = ['03026']
  state.investigators[0].resources = 10
  const copy = legalMoves(state).find(command => command.cardId === '03012' && command.copyCode === '03026')
  assert.ok(copy, '只有 resolve 的事件也出现在彩绘世界的复制选项里')
  assert.equal(validateMove(state, 0, { action: 'play', cardId: '03012', copyCode: '03026' }), null)
})
