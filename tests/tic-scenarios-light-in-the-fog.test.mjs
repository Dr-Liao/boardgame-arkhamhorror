// P7 A2 批「雾中之光 aLightInTheFog」八张单卡（07234/07236/07237/07238/07239/07247/07249/07250）：
//   · 幕/议程：07236 灯塔线索目标与 1b、07237 进入地下室目标与 2b、07238 调查阶段末强制与全员撤退结局、
//     07234 浪潮汹涌背面（搬走猎鹰岬/马什到场/最底下 4 处水位）；
//   · 地点：07239 门房淹没上限与放钥匙撤退、07247 祭坛帷幕/红钥匙/只能靠调查发现、
//     07249 月之室揭示涨水与撤退记录、07250 档案库揭示全淹没/放黑钥匙/淹没时不能发现。
//
// 07236b/07237b 的「直接推进到下一密谋正面（不结算背面）」由 P7 新读点
// api.scenario.advanceAgendaTo(index) 实现（act-agenda.js：不 runAgendaReveal、不清场上的毁灭）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { legalMoves, move, settle, validateMove } from './core-fixture.mjs'
import { reactionWindow, revealLocation, scenarioRuntime } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { registeredEntry } from '../src/engine/ability.js'
import { keysAt } from '../src/engine/scenario-keys.js'
import { floodLevel } from '../src/engine/flood.js'
import { resolveTransaction } from '../src/engine/resolution.js'

const EXPECTED = {
  '07234': 'agenda', '07236': 'act', '07237': 'act', '07238': 'act',
  '07239': 'location', '07247': 'location', '07249': 'location', '07250': 'location',
}

function transaction(s, execute, select = () => null) {
  const run = draft => {
    try { return execute(draft) } catch (error) { if (error.constructor?.name !== 'ScenarioEnded') throw error }
  }
  resolveTransaction(s, 0, { action: 'ticLightInTheFog' }, run)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 80, `choice loop ${s.pendingChoice.source}`)
    const choice = s.pendingChoice
    const id = select(choice, s)
      ?? ['done', 'skip', 'self'].find(candidate => choice.options.some(option => option.id === candidate))
      ?? choice.options[0]?.id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, run)
  }
}

const locationOf = (s, code) => s.locations.find(location => String(location.originalCode || location.code) === code) || null
const entityAction = (s, entityId, actionKind) => legalMoves(s).find(command =>
  command.action === 'entityAbility' && command.entityId === entityId && command.actionKind === actionKind)
// map.place 需要 scenarioRuntime 的 placeLocation 管线，测试里必须走事务内的 runtime。
const placeAt = (s, id, x, y) => transaction(s, draft => scenarioRuntime(draft, []).mechanics.map.place(id, x, y))

test('P7 A2：雾中之光八张条目注册且 code/scope/implemented 正确', () => {
  for (const code of Object.keys(EXPECTED)) {
    const registered = registeredEntry(code)
    assert.ok(registered, `${code} 未注册`)
    assert.equal(registered.code, code)
    assert.equal(registered.scope, EXPECTED[code], `${code} scope`)
    assert.equal(registered.implemented, true, `${code} implemented`)
  }
})

test('07239 猎鹰岬门房：淹没上限为部分淹没；撤退前把黑/红钥匙放到当前场景', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  const mechanics = createMechanicsApi(s)
  const gatehouse = locationOf(s, '07239')
  assert.ok(gatehouse)
  mechanics.water.set(gatehouse.id, 2)
  assert.equal(floodLevel(s, gatehouse.id), 1, '不能被完全淹没')
  assert.equal(mechanics.keys.transfer('black', 'setAside', 'investigator:0', { reveal: true }), true)
  assert.equal(mechanics.keys.transfer('red', 'setAside', 'investigator:0', { reveal: true }), true)
  const command = entityAction(s, gatehouse.id, 'resign')
  assert.ok(command, '门房的撤退行动应出现在合法列表')
  move(s, command)
  settle(s)
  assert.equal(s.investigators[0].resigned, true, '撤退者退场')
  assert.equal(s.investigators[1].resigned, false, '只影响行动者')
  const act = s.acts[s.actIndex]
  assert.deepEqual(keysAt(s, `act:${act.id}`).sort(), ['black', 'red'], '黑/红钥匙放到当前场景')
  assert.equal(keysAt(s, 'investigator:0').length, 0)
})

test('07247 海德拉祭坛：揭示放红钥匙；绿钥匙使帷幕 -3；线索只能靠调查发现', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  const mechanics = createMechanicsApi(s)
  placeAt(s, 'location07247', 0, -1)
  const shrine = locationOf(s, '07247')
  assert.ok(shrine)
  transaction(s, draft => revealLocation(draft, shrine.id, [], 0))
  assert.equal(keysAt(s, `location:${shrine.id}`).includes('red'), true, '揭示后放置红钥匙')
  assert.equal(scenarioRuntime(s, []).locationShroud(shrine.id, 0), 5)
  s.investigators[0].location = shrine.id
  assert.equal(mechanics.keys.transfer('green', 'setAside', 'investigator:0', { reveal: true }), true)
  assert.equal(scenarioRuntime(s, []).locationShroud(shrine.id, 0), 2, '绿钥匙控制者在本地点 → -3 帷幕')
  assert.equal(scenarioRuntime(s, []).canDiscoverClueAt(0, shrine.id), true, '调查仍可发现')
  let discovered
  transaction(s, draft => { discovered = scenarioRuntime(draft, []).discoverClue(0, 1, shrine.id) })
  assert.equal(discovered, false, '非调查来源的发现被拒绝')
})

test('07249 月之室：揭示提升淹没等级；未淹没时撤退并记录来自月之室', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  const mechanics = createMechanicsApi(s)
  placeAt(s, 'location07249', 0, -1)
  const moon = locationOf(s, '07249')
  assert.ok(moon)
  transaction(s, draft => revealLocation(draft, moon.id, [], 0))
  assert.equal(floodLevel(s, moon.id), 1, '揭示后提升一级淹没')
  mechanics.water.set(moon.id, 0)
  s.investigators[0].location = moon.id
  mechanics.keys.transfer('red', 'setAside', 'investigator:0', { reveal: true })
  const command = entityAction(s, moon.id, 'resign')
  assert.ok(command, '未淹没时撤退行动可用')
  move(s, command)
  settle(s)
  assert.equal(s.investigators[0].resigned, true)
  assert.deepEqual(s.scenarioFlags.resignedInMoonRoom, [0], '记录从月之室撤退（07238b 与内容结算读点）')
  assert.equal(keysAt(s, `act:${s.acts[s.actIndex].id}`).includes('red'), true)
})

test('07250 沉没档案库：揭示即完全淹没并放黑钥匙；淹没时不能发现线索', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  const mechanics = createMechanicsApi(s)
  placeAt(s, 'location07250', 0, -1)
  const archives = locationOf(s, '07250')
  assert.ok(archives)
  transaction(s, draft => revealLocation(draft, archives.id, [], 0))
  assert.equal(floodLevel(s, archives.id), 2, '完全淹没')
  assert.equal(keysAt(s, `location:${archives.id}`).includes('black'), true, '放黑钥匙')
  assert.ok(locationOf(s, '07250').clues > 0)
  assert.equal(scenarioRuntime(s, []).canDiscoverClueAt(0, archives.id), false, '完全淹没时不能发现线索')
  mechanics.water.set(archives.id, 1)
  assert.equal(scenarioRuntime(s, []).canDiscoverClueAt(0, archives.id), false, '部分淹没也按「淹没」限制发现')
})

test('07234 浪潮汹涌：场外找马什、搬走猎鹰岬占位者并移除地点、提升最底下4处淹没', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  const mechanics = createMechanicsApi(s)
  placeAt(s, 'location07244', 2, -1)
  placeAt(s, 'location07245', 2, -2)
  placeAt(s, 'location07246', 2, -3)
  placeAt(s, 'location07247', 0, -1)
  transaction(s, draft => revealLocation(draft, locationOf(draft, '07244').id, [], 0))
  const upper = locationOf(s, '07244')
  const lower = locationOf(s, '07245')
  const final = locationOf(s, '07246')
  const shrine = locationOf(s, '07247')
  assert.equal(s.scenarioZones.setAside.includes('07253'), true, '马什开始时放在一边')
  s.agendaIndex = 2
  transaction(s, draft => scenarioRuntime(draft, []).advanceAgenda())
  assert.equal(s.agendaIndex, 3, '推进到下一张密谋')
  const marsh = s.enemies.find(enemy => String(enemy.originalCode || enemy.code) === '07253')
  assert.ok(marsh, '马什从场外生成')
  assert.equal(marsh.location, upper.id, '马什生成在沉没岩洞（浅层）')
  assert.equal(s.locations.some(location => (location.traits || []).includes('Falcon Point')), false, '猎鹰岬地点被移出游戏')
  for (const inv of s.investigators) assert.equal(inv.location, upper.id, '占位调查员被搬到浅层')
  assert.equal(floodLevel(s, final.id), 1, '最底层地点提升淹没')
  assert.equal(floodLevel(s, lower.id), 1)
  assert.equal(floodLevel(s, upper.id), 1)
  assert.equal(floodLevel(s, shrine.id), 1, '同一行剩余名额也提升')
  assert.equal(mechanics.map.locations({ row: 0 }).length, 0, '猎鹰岬行被清空')
})

test('07236 灯塔：线索目标推进后生成横置马什/蓝钥匙、洗入尽腥尽力、地下室放到梯井正下方', () => {
  const s = chapterFixture('aLightInTheFog')
  s.investigators[0].clues = 3
  s.clues = 3
  const act = s.acts[s.actIndex]
  const command = entityAction(s, act.id, 'activate')
  assert.ok(command, '线索目标支付能力应出现在合法列表')
  move(s, command)
  settle(s)
  assert.equal(s.actIndex, 1, '推进到场景 2a')
  assert.equal(s.investigators[0].clues, 0, '团队支付 3 线索')
  const cottage = locationOf(s, '07243')
  const marsh = s.enemies.find(enemy => String(enemy.originalCode || enemy.code) === '07253')
  assert.ok(marsh, '马什生成')
  assert.equal(marsh.location, cottage.id, '生成在灯塔看门人小屋')
  assert.equal(marsh.exhausted, true, '横置生成')
  assert.equal(keysAt(s, `enemy:${marsh.id}`).includes('blue'), true, '蓝钥匙放在马什上')
  assert.equal(s.scenarioZones.setAside.includes('07259'), false, '尽腥尽力洗入遭遇牌库')
  assert.equal(s.encounterDeck.filter(code => code === '07259').length, 2)
  const basement = locationOf(s, '07244')
  assert.ok(basement, '灯塔地下室入场')
  assert.equal(basement.revealed, false, '入场时不揭示')
  assert.deepEqual(createMechanicsApi(s).map.position(basement.id), { x: 2, y: -1, isolated: false }, '放在灯塔梯井正下方')
  // P7：advanceAgendaTo 读点已接线 → 直接推进到 2a（不结算 1b）。
  assert.equal(s.agendas[s.agendaIndex].originalCode, '07233', '直接推进到议程 2a')
})

test('07237 寻找前路：进入灯塔地下室即推进；2b 放深层/底层与9张潮水通道、马什进胜利区', () => {
  const s = chapterFixture('aLightInTheFog')
  const mechanics = createMechanicsApi(s)
  s.actIndex = 1
  placeAt(s, 'location07244', 2, -1)
  const basement = locationOf(s, '07244')
  assert.ok(basement)
  mechanics.keys.transfer('blue', 'setAside', 'investigator:0', { reveal: true })
  transaction(s, draft => { scenarioRuntime(draft, []).spawn('07253', locationOf(draft, '07243').id) })
  const marsh = s.enemies.find(enemy => String(enemy.originalCode || enemy.code) === '07253')
  assert.ok(marsh)
  // 地下室与灯塔梯井由印刷符号相连；先站在梯井，再从梯井进入地下室。
  s.investigators[0].location = locationOf(s, '07240').id
  const command = { action: 'move', locationId: basement.id }
  assert.equal(validateMove(s, 0, command), null)
  move(s, command)
  settle(s)
  assert.equal(s.actIndex, 2, '进入地下室后 2b 推进到场景 3a')
  assert.equal(locationOf(s, '07244').revealed, true, '2b 揭示灯塔地下室')
  assert.deepEqual(createMechanicsApi(s).map.position(locationOf(s, '07245').id), { x: 2, y: -2, isolated: false })
  assert.deepEqual(createMechanicsApi(s).map.position(locationOf(s, '07246').id), { x: 2, y: -3, isolated: false })
  for (const row of [-1, -2, -3]) assert.equal(mechanics.map.locations({ row }).length, 4, `第 ${row} 行正好 4 个地点`)
  assert.equal(s.scenarioZones.setAside.includes('07260'), false, '惨遭俘虏洗入遭遇牌库')
  assert.equal(s.encounterDeck.filter(code => code === '07260').length, 2)
  assert.equal(s.victoryDisplay.some(card => String(card.originalCode || card.code) === '07253'), true, '马什加入胜利区')
  assert.equal(s.agendas[s.agendaIndex].originalCode, '07234', '直接推进到议程 3a（不结算 2b）')
})

test('07238 深海信徒：调查阶段结束时全淹没者受伤/下移；全员撤退推进并按月之室记录选 R1/R2', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  const mechanics = createMechanicsApi(s)
  s.actIndex = 2
  placeAt(s, 'location07249', 0, -1)
  placeAt(s, 'location07245', 0, -2)
  placeAt(s, 'location07250', 1, -1)
  const moon = locationOf(s, '07249')
  const lower = locationOf(s, '07245')
  const archives = locationOf(s, '07250')
  mechanics.water.set(moon.id, 2)
  mechanics.water.set(archives.id, 2)
  s.investigators[0].location = moon.id
  s.investigators[1].location = archives.id
  transaction(s, draft => reactionWindow(draft, 'investigationPhaseEnds',
    { when: 'investigationPhaseEnds', phase: 'investigation', round: draft.round }, []),
  choice => (choice.options.some(option => option.id === 'move') ? 'move' : null))
  assert.equal(s.investigators[0].location, lower.id, '有正下方地点时选择下移')
  assert.equal(s.investigators[1].damage, 3, '没有正下方地点时受到 3 点伤害')

  const r2 = chapterFixture('aLightInTheFog')
  r2.actIndex = 2
  transaction(r2, draft => scenarioRuntime(draft, []).resign(0))
  assert.ok(r2.campaign.scenarioResults.length >= 1, '最后一名调查员撤退触发结算')
  assert.equal(r2.campaign.scenarioResults.at(-1).resolution, 'resolution2', '未从月之室撤退 → R2')

  const r1 = chapterFixture('aLightInTheFog')
  r1.actIndex = 2
  r1.scenarioFlags.resignedInMoonRoom = [0]
  transaction(r1, draft => scenarioRuntime(draft, []).resign(0))
  assert.equal(r1.campaign.scenarioResults.at(-1).resolution, 'resolution1', '至少一人从月之室撤退 → R1')
})
