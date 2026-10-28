// 卡牌保真度 P3 · 核心包批次回归。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, asset, enemy, move, answer, settle, use, validateMove } from './core-fixture.mjs'
import {
  blankEnemy, newPlayerAssetInstance, removeThreat, startScenario,
} from '../src/engine/engine.js'
import { playConditionError } from '../src/engine/play-condition.js'
import { SCENARIOS } from '../src/cards/scenarios-data.js'

const me = state => state.investigators[0]

test('01009 死灵之书：还有恐惧时不能离场，清空后才能弃掉', () => {
  const state = fixture('01002')
  const inv = me(state)
  const threat = { id: 'necronomicon', code: '01009', counters: 3 }
  inv.threat.push(threat)
  assert.equal(removeThreat(state, inv, threat, []), false)
  assert.ok(inv.threat.includes(threat), '有恐惧时留在威胁区')
  threat.counters = 0
  assert.equal(removeThreat(state, inv, threat, []), true)
  assert.ok(!inv.threat.includes(threat))
})

test('01019 急救：由控制者选择治疗伤害还是恐惧', () => {
  const state = fixture('01001', 2)
  const firstAid = asset(state, '01019')
  state.investigators[1].damage = 1
  state.investigators[1].horror = 1
  use(state, firstAid)
  if (state.pendingChoice?.kind === 'investigator') answer(state, '1') // 目标：同一地点的另一位调查员
  assert.equal(state.pendingChoice.kind, 'effect')
  assert.equal(state.pendingChoice.seat, 0, '选择权属于急救的控制者，而不是被治疗者')
  answer(state, '1') // 治疗 1 点恐惧
  settle(state)
  assert.equal(state.investigators[1].horror, 0)
  assert.equal(state.investigators[1].damage, 1, '只治疗所选的那一项')
})

test('01031 智慧古书：找到的牌走抽牌管线（弱点会结算而不是进手牌）', () => {
  const state = fixture('01002')
  const book = asset(state, '01031')
  me(state).deck = ['01009']
  use(state, book)
  if (state.pendingChoice?.kind === 'investigator') answer(state, '0') // 目标：自己
  assert.equal(state.pendingChoice.source, 'search-top')
  answer(state, '0') // 选择唯一的牌
  settle(state)
  assert.ok(!me(state).hand.includes('01009'), '弱点不应直接加入手牌')
  assert.ok(me(state).threat.some(card => card.code === '01009'), '弱点按抽到弱点结算')
})

test('01063 新晋术士：任何入场路径都在其上放 1 个毁灭', () => {
  const state = fixture('01005')
  const assetInstance = newPlayerAssetInstance(state, me(state), '01063')
  assert.equal(assetInstance.doom, 1)
  me(state).hand = ['01063']
  move(state, { action: 'play', cardId: '01063' })
  settle(state)
  assert.equal(me(state).assets.find(card => card.code === '01063').doom, 1)
})

test('01003 奥图尔：限额按「本回合」而不是「本轮」', () => {
  const state = fixture('01003')
  const inv = me(state)
  inv.resources = 30
  inv.actionsLeft = 3
  move(state, { action: 'freeAction' })
  assert.match(validateMove(state, 0, { action: 'freeAction' }), /已使用/)
  // 同一轮内的新回合：卡面允许再用一次。
  state.turnSerial += 1
  assert.equal(validateMove(state, 0, { action: 'freeAction' }), null)
})

test('01010 在逃中：非精英敌人的反击同样不能攻击你', () => {
  const state = fixture('01001')
  me(state).onTheLam = true
  me(state).combat = 0
  const target = enemy(state, { fight: 10, evade: 1, health: 10, retaliate: true, damage: 3, horror: 2 })
  move(state, { action: 'fight', enemyId: target.id })
  settle(state)
  assert.equal(me(state).damage, 0)
  assert.equal(me(state).horror, 0)
})

test('01068 记忆抹消：只抹消文本，不额外自动交战', () => {
  const state = fixture('01001')
  const target = enemy(state, { engagedSeat: null, exhausted: false, damage: 1 })
  blankEnemy(state, 0, { source: '01068' }, [])
  assert.equal(target.textBlanked.phase, state.phase)
  assert.equal(target.engagedSeat, null, '卡面没有「立刻交战」')
})

test('01134 北区：进入新关卡时重置团队「每场游戏一次」标记', () => {
  const state = fixture('01001')
  state.locationAbilityTeamUsed = { northside: true }
  startScenario(state, 0, [])
  assert.deepEqual(state.locationAbilityTeamUsed, {})
})

test('01150–01156 地底噬魔地图：连接与特性按印张', () => {
  const map = SCENARIOS.theDevourerBelow.locations
  assert.deepEqual(map.unhallowedGround.connections, ['mainPath', 'cliffside', 'oldHouse'])
  assert.deepEqual(map.twistingPaths.connections, ['mainPath', 'oldHouse', 'tangledThicket'])
  assert.deepEqual(map.oldHouse.connections, ['mainPath', 'unhallowedGround', 'twistingPaths'])
  assert.deepEqual(map.cliffside.connections, ['mainPath', 'quietGlade', 'unhallowedGround'])
  assert.deepEqual(map.tangledThicket.connections, ['mainPath', 'twistingPaths', 'quietGlade'])
  assert.deepEqual(map.quietGlade.connections, ['mainPath', 'tangledThicket', 'cliffside'])
  assert.deepEqual(map.ritualSite.connections, ['mainPath'])
  for (const id of ['unhallowedGround', 'twistingPaths', 'oldHouse', 'cliffside', 'tangledThicket', 'quietGlade']) {
    assert.deepEqual(map[id].traits, ['Woods'])
  }
  assert.deepEqual(map.ritualSite.traits, ['Cave'])
})

// 2026-10-28 合规审计 R3：5 张核心包的「快速。只能在你回合期间打出」过去没有 playCondition，
// 对手回合也能打出。这里同时守住「对手回合被拒绝」和「自己回合仍可打出」两端。
test('01036 / 01037 / 01043 / 01050 / 01085：只能在自己回合打出', () => {
  for (const code of ['01036', '01037', '01043', '01050', '01085']) {
    const state = fixture('01001', 2)
    state.currentSeat = 1
    me(state).hand = [code]
    me(state).resources = 30
    assert.match(playConditionError(state, me(state), code, {}) || '', /只能在你回合期间打出/,
      `${code} 在对手回合必须被拒绝`)

    const own = fixture('01001')
    me(own).hand = [code]
    me(own).resources = 30
    assert.equal(playConditionError(own, me(own), code, {}), null, `${code} 在自己回合通过打出条件`)
    assert.equal(validateMove(own, 0, { action: 'play', cardId: code }), null, `${code} 在自己回合可打出`)
  }
})
