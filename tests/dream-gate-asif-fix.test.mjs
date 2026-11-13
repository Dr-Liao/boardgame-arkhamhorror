// 卢克·罗宾逊「如同位于」+ 梦境之门（06015a/b）交战回归（2026-11-13 实机 bug）。
//
// 实机复现（TFA《时间倒流》）：卢克在梦境之门，用「如同位于」打出「飞蛾扑火」（01064），
// 抽到没有生成指令的敌人。敌人按「如同位于」的地点结算——生成在连接地点并与卢克交战；
// 事件结束后卢克回到梦境之门，旧实现只解除 beginAsIf 接管的那批敌人，这只新敌人仍留着
// engagedSeat，敌方阶段会隔着地点攻击（「无论去哪都被敌人攻击」）。
//
// 官方 FAQ（ArkhamDB › Luke Robinson）：「如同位于」只在事件结算期间改变游戏状态；事件结束后
// 敌人不能继续与梦境之门里的卢克交战，留在那个连接地点。存档迁移按同一口径修复旧存档。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, move as fixtureMove } from './core-fixture.mjs'
import {
  applyMove, enemyPhase, legalMoves, placeLocation,
} from '../src/engine/engine.js'
import { placeDreamGate } from '../src/engine/dream-gate.js'
import { migrateState } from '../src/engine/save-migration.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const me = state => state.investigators[0]

// 用真实调查员卡面替换核心对局里的调查员（能力测试不依赖具体牌组）。
function investigatorFixture(code) {
  const state = fixture('01001')
  const inv = me(state)
  const card = ALL_CARDS[code]
  Object.assign(inv, {
    code, name: card.nameZh, nameEn: card.name, klass: card.klass,
    willpower: card.willpower, intellect: card.intellect, combat: card.combat, agility: card.agility,
    baseHealth: card.health, baseSanity: card.sanity, health: card.health, sanity: card.sanity,
    maxHealth: card.health, maxSanity: card.sanity,
    beneath: [], assets: [], threat: [], damage: 0, horror: 0,
  })
  return state
}

// 最小地图：卢克所在地点 ↔ 走廊（已在场）。梦境之门放置后与所有已揭示地点相连。
function lukeMapFixture() {
  const state = investigatorFixture('06004')
  const inv = me(state)
  placeLocation(state, 'hallway', [])
  const here = state.locations.find(location => location.id === inv.location)
  here.connections = ['hallway', 'attic']
  const there = state.locations.find(location => location.id === 'hallway')
  there.revealed = true
  return { state, inv, here, there }
}

test('梦境之门：如同位于打出「飞蛾扑火」抽到的敌人留在连接地点并解除交战（官方 FAQ）', () => {
  const { state, inv, there } = lukeMapFixture()
  const gate = placeDreamGate(state, '06015a', { connectToRevealed: true, ownerCode: '06004', ownerSeat: 0 })
  inv.location = gate.id
  inv.hand = ['01064']
  inv.resources = 10
  inv.actionsLeft = 3
  state.encounterDeck = ['01177']
  state.encounterDiscard = []
  const asIf = legalMoves(state, 0).find(item =>
    item.action === 'play' && item.cardId === '01064' && item.asIfLocation === there.id)
  assert.ok(asIf, '连接地点应出现在「如同位于」打出选项里')
  applyMove(state, 0, { action: 'play', cardId: '01064', asIfLocation: there.id })

  assert.equal(me(state).location, gate.id, '事件结算结束后回到梦境之门')
  const enemy = state.enemies.find(item => item.code === '01177')
  assert.ok(enemy, '「飞蛾扑火」抽到的敌人已生成')
  assert.equal(enemy.location, there.id, '敌人留在卢克发现线索的连接地点')
  assert.equal(enemy.engagedSeat, null, '事件结束后敌人不能隔着地点继续交战')
  assert.deepEqual(me(state).engaged, [], '临时交战也要从调查员的交战列表里移除')

  // 敌方阶段：解除交战后不能隔着地点攻击。
  const before = { damage: me(state).damage || 0, horror: me(state).horror || 0 }
  enemyPhase(state)
  assert.equal(me(state).damage || 0, before.damage, '敌方阶段不造成伤害')
  assert.equal(me(state).horror || 0, before.horror, '敌方阶段不造成恐惧')
})

// 旧存档修复：实机里已经留下的「敌人不在调查员所在地点却仍交战」状态，读档时按官方 FAQ
// 解除交战（敌人留在原地、不移动），否则敌方阶段仍会隔着地点攻击。
test('旧存档里敌人与调查员不在同一地点却仍交战：解除交战、敌人留在原地', () => {
  const old = JSON.parse(JSON.stringify(fixture('01001')))
  const inv = old.investigators[0]
  placeLocation(old, 'attic', [])
  old.enemies.push({
    id: 'e-cross-location', code: '01177', originalCode: '01177', name: '伊斯观测者',
    location: 'attic', engagedSeat: inv.seat, aloof: false, hunter: false, exhausted: false, damageTaken: 0,
  })
  inv.engaged.push('e-cross-location')
  const snapshot = JSON.stringify(old)
  const { state, changes } = migrateState(old)
  assert.equal(JSON.stringify(old), snapshot, '迁移不得修改入参')
  const enemy = state.enemies.find(item => item.id === 'e-cross-location')
  assert.equal(enemy.location, 'attic', '修复不移动敌人')
  assert.equal(enemy.engagedSeat, null, '解除跨地点交战')
  assert.deepEqual(state.investigators[0].engaged, [], '调查员的交战列表一并清理')
  assert.ok(changes.some(line => line.includes('跨地点交战')), changes.join(' / '))
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))).changes, [], '修复幂等')
})
