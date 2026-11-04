// 「大海的秘密」三张版本议程（07164/07165/07166）与步行额外行动费用。
//
// 印刷：
//   「你不在载具上时，作为在[[海洋]]地点间移动的额外费用，你必须花费2行动。
//     强制 - 在你回合开始时，如果你位于完全淹没的地点，你奋力挣扎，求取空气：在你回合结束时，
//            如果你在自己回合期间没有进入过载具、未淹没或部分淹没的地点，受到5点直接伤害。」
//
// 读点：
//   · 步行费用 = turn-flow.js 的 movementActionSurcharge（只加在基础 move 行动上，
//     起止地点都要带 [[海洋]] 特性，载具上的调查员不付）；
//   · 求取空气 = flood.js 的 beginAirTurn / checkAirAfterMove / endAirTurn，由
//     `scenario.mechanics.water.air` 驱动（恶魔礁与达贡巢穴都是 air:true、伤害 5）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { legalMoves } from '../src/engine/engine.js'
import { move, settle } from './core-fixture.mjs'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { registerCardAbilities } from '../src/engine/ability.js'

function scene(agendaCode = '07165') {
  const s = chapterFixture('inTooDeep', 1)
  s.enemies = []
  for (const inv of s.investigators) { inv.engaged = []; inv.assets = [] }
  if (agendaCode) s.agendas[s.agendaIndex] = { ...s.agendas[s.agendaIndex], code: agendaCode, originalCode: agendaCode }
  // 两个相连的[[海洋]]地点 + 一个内陆地点：验证「起止都要带该特性」。
  const oceanA = { id: 'oceanA', code: '07143', originalCode: '07143', name: '海洋 A', revealed: true,
    clues: 0, shroud: 1, traits: ['Ocean'], connections: ['oceanB', 'landC'] }
  const oceanB = { id: 'oceanB', code: '07143', originalCode: '07143', name: '海洋 B', revealed: true,
    clues: 0, shroud: 1, traits: ['Ocean'], connections: ['oceanA'] }
  const landC = { id: 'landC', code: '07143', originalCode: '07143', name: '内陆 C', revealed: true,
    clues: 0, shroud: 1, traits: ['Innsmouth'], connections: ['oceanA'] }
  s.locations = [oceanA, oceanB, landC]
  s.investigators[0].location = 'oceanA'
  s.investigators[0].actionsLeft = 20
  return s
}
const walk = (s, locationId) => {
  const command = legalMoves(s).find(item => item.action === 'move' && item.locationId === locationId)
  assert.ok(command, `应当可以走到 ${locationId}`)
  const before = s.investigators[0].actionsLeft
  move(s, command)
  settle(s)
  return before - s.investigators[0].actionsLeft
}

test('07164/07165/07166：不在载具上时，[[海洋]]地点之间移动额外花费 2 行动', () => {
  for (const code of ['07164', '07165', '07166']) {
    const s = scene(code)
    assert.equal(walk(s, 'oceanB'), 3, `${code}：海洋→海洋 = 1 + 2 行动`)
  }
})

test('海洋→内陆不付步行费用；没有这类议程时海洋→海洋也只花 1 行动', () => {
  const toLand = scene('07165')
  assert.equal(walk(toLand, 'landC'), 1, '只有起止都带[[海洋]]才加费')

  const plain = scene(null)
  plain.agendas[plain.agendaIndex] = { ...plain.agendas[plain.agendaIndex], code: '07124', originalCode: '07124' }
  assert.equal(walk(plain, 'oceanB'), 1, '压迫议程没有步行费用')
})

test('步行费用声明在注册期校验形状', () => {
  assert.throws(() => registerCardAbilities([{ code: 'ticBadSurcharge', scope: 'agenda',
    agendaRule: { movementActionSurcharge: { amount: 0 } }, abilities: [] }]), /Surcharge/i)
  assert.throws(() => registerCardAbilities([{ code: 'ticBadSurcharge2', scope: 'agenda',
    agendaRule: { movementActionSurcharge: { amount: 2, betweenTraits: [] } }, abilities: [] }]), /Surcharge/i)
  assert.throws(() => registerCardAbilities([{ code: 'ticBadSurcharge3', scope: 'agenda',
    agendaRule: { movementActionSurcharge: { amount: 2, extra: true } }, abilities: [] }]), /Surcharge/i)
})

test('求取空气：回合开始时位于完全淹没的地点，回合结束受到 5 点直接伤害', () => {
  const s = chapterFixture('theLairOfDagon', 2)
  const api = createMechanicsApi(s)
  const second = s.investigators[1]
  api.water.set(second.location, 2)
  assert.equal(api.water.effectiveLevel(1), 2)
  const endTurn = () => {
    for (const inv of s.investigators) inv.actionsLeft = 0
    move(s, legalMoves(s).find(item => item.action === 'endTurn'))
    settle(s)
  }
  endTurn() // 第 0 席结束 → 第 1 席在完全淹没地点开始回合（记录空气风险）
  assert.equal(s.scenarioFlags.mechanics.air[1].damage, 5)
  endTurn() // 第 1 席结束 → 结算直接伤害
  assert.equal(s.investigators[1].damage, 5)
})

test('载具上的调查员不会被淹没：恶魔礁开局在渔船上，没有空气风险', () => {
  const s = chapterFixture('devilReef', 2)
  const api = createMechanicsApi(s)
  assert.equal(api.water.effectiveLevel(1), 0, 'protectsFromFlood 的载具把有效淹没等级压到 0')
  assert.equal(s.scenarioFlags?.mechanics?.air ?? null, null, '开局不记录空气风险')
})
