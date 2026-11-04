// P7 A1 批（07062a / 07105 / 07178 / 07293 / 07297 / 07320 / 07321）与两个引擎读点：
//   · 地点「入场即部分/完全淹没」：locationRule.entersPlayFlooded（locations.js#placeLocation）；
//   · 地点线索发现限制：locationRule.cluesOnlyByInvestigation / cannotDiscoverWhileFlooded。
// 另外验证 07178 载具移动、07105 谈判、07293 入场钥匙与受伤诅咒、07297 显现失败分支。
//
// 事务约定：applyMove 会用草稿整体替换 state，move() 之后必须按 id 重新取对象；
// 需要多次同步写状态时用 resolveTransaction 包一层（同 tic-maelstrom-bosses）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { asset, enemy, move, settle, legalMoves } from './core-fixture.mjs'
import { discoverClueAt, reactionWindow, scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { entityModifierTotal } from '../src/engine/modifiers.js'
import { keysAt } from '../src/engine/scenario-keys.js'
import { effectiveFloodLevel, floodLevel } from '../src/engine/flood.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'

function transaction(s, execute, select = () => null) {
  resolveTransaction(s, 0, { action: 'testTicA1' }, execute)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 80, 'choice loop')
    const choice = s.pendingChoice
    const id = select(choice, s) ?? ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId))
      ?? choice.options[0].id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}
const spawnAt = (s, code, locationId) => scenarioRuntime(s, []).spawn(code, locationId)
const byId = (s, id) => s.enemies.find(item => item.id === id)
const placeDefinition = (s, code) => {
  const key = Object.entries(s.scenario.locations)
    .find(([, definition]) => (definition.code || definition.originalCode) === code)?.[0]
  assert.ok(key, `scenario has no location ${code}`)
  transaction(s, draft => { scenarioRuntime(draft, []).place(key) })
  return s.locations.find(location => (location.originalCode || location.code) === code)
}

// 用真实行动入口抽一张指定遭遇卡（helper 自带 discardSelf，付完费即离场）。
const drawHelper = {
  code: 'testTicA1DrawEncounter',
  abilities: [{ kind: 'action', label: '实际抽取遭遇卡', cost: { discardSelf: true },
    resolve: ({ inv, api }) => api.scenario.drawEncounter(inv.seat) }],
}
if (!registeredEntry(drawHelper.code)) registerCardAbilities([drawHelper])
function drawEncounterCard(s, code, seat = 0) {
  s.currentSeat = seat
  s.encounterDeck = [code]
  const helper = asset(s, drawHelper.code)
  move(s, { action: 'ability', assetId: helper.id, abilityIndex: 0 })
}

test('07062a：哈珀失踪案 setup 把剧情参考卡作为全局剧情资产放进场', () => {
  const s = chapterFixture('theVanishingOfElinaHarper', 2)
  const reference = (s.storyAssets || []).find(card => (card.originalCode || card.code) === '07062a')
  assert.ok(reference, '07062a 不在 state.storyAssets 里')
  assert.equal(reference.global, true)
  assert.equal(reference.location, null)
  assert.equal(registeredEntry('07062a').abilities.length, 0, '纯清单参考卡没有需要结算的能力')
})

test('07105：谈判把 1 个线索放到你所在地点，横置且下个补给阶段不重整', () => {
  const s = chapterFixture('theVanishingOfElinaHarper', 1)
  const here = s.investigators[0].location
  const enemy = spawnAt(s, '07105', here)
  s.investigators[0].clues = 1
  const clueBefore = s.locations.find(location => location.id === here).clues
  const command = legalMoves(s).find(entry => entry.action === 'entityAbility' && entry.entityId === enemy.id)
  assert.ok(command, '同地点的谈判行动应可见')
  assert.equal(command.actionKind, 'parley')
  move(s, command)
  const current = byId(s, enemy.id)
  assert.equal(s.investigators[0].clues, 0)
  assert.equal(s.locations.find(location => location.id === here).clues, clueBefore + 1)
  assert.equal(current.exhausted, true)
  // 2026-11-04 合并：main 侧 07105 用 api.scenario.preventEnemyReady（写 enemy.preventReady），
  // backup 侧旧实现写 skipNextUpkeepReady；两条读点都让它在下一个补给阶段不重整。
  assert.ok(current.preventReady != null || current.skipNextUpkeepReady === true, '下个补给阶段不重整')
})

test('07105：可以从连接地点发起谈判，线索放到行动者所在地点', () => {
  const s = chapterFixture('theVanishingOfElinaHarper', 1)
  const here = s.investigators[0].location
  const enemy = spawnAt(s, '07105', here)
  const connecting = s.locations.find(location => location.id !== here
    && (location.connections || []).includes(here))
  assert.ok(connecting, '本关没有连接地点可用于本用例')
  s.investigators[0].location = connecting.id
  s.investigators[0].clues = 1
  const command = legalMoves(s).find(entry => entry.action === 'entityAbility' && entry.entityId === enemy.id)
  assert.ok(command, '连接地点的谈判行动应可见（range connecting）')
  move(s, command)
  assert.equal(s.investigators[0].clues, 0)
  assert.equal(s.locations.find(location => location.id === connecting.id).clues, 1)
})

test('07178：渔船移动带全部乘客到连接的海洋地点，乘客视为未淹没', () => {
  const s = chapterFixture('devilReef', 2)
  const vessel = (s.storyAssets || []).find(card => (card.originalCode || card.code) === '07178')
  assert.ok(vessel, '渔船不在 state.storyAssets 里')
  const vehicle = s.scenarioFlags.mechanics.vehicles[vessel.id]
  assert.ok(vehicle, '渔船没有注册为载具')
  assert.equal(vehicle.protectsFromFlood, true)
  s.currentSeat = 0
  const command = legalMoves(s).find(entry => entry.action === 'entityAbility' && entry.entityId === vessel.id)
  assert.ok(command, `没有渔船移动行动：${JSON.stringify(legalMoves(s).map(entry => entry.label))}`)
  const destination = command.targetId
  assert.ok(destination, '渔船移动行动没有目标地点')
  move(s, command)
  assert.equal(s.scenarioFlags.mechanics.vehicles[vessel.id].location, destination)
  for (const inv of s.investigators) assert.equal(inv.location, destination)
  createMechanicsApi(s).water.set(destination, 2)
  assert.equal(effectiveFloodLevel(s, 0), 0, '载具中的乘客视为未淹没')
})

test('07293：+1 生命/调查员，入场放黑钥匙，调查员造成伤害后加诅咒标记', () => {
  const s = chapterFixture('theLairOfDagon', 2)
  const here = s.investigators[0].location
  const enemy = spawnAt(s, '07293', here)
  assert.equal(entityModifierTotal(s, byId(s, enemy.id), 'enemyHealth'), 2)
  assert.equal(keysAt(s, `enemy:${enemy.id}`, { reveal: true }).includes('black'), true, '黑色钥匙在宣教士上')
  const before = s.chaosBag.filter(token => token === 'curse').length
  transaction(s, draft => { scenarioRuntime(draft, []).damageEnemy(enemy.id, 1, 0, 'testA1') })
  assert.equal(s.chaosBag.filter(token => token === 'curse').length, before + 1)
})

test('07297：显现检定失败但未揭示诅咒 → 二选一（弃 2 张手牌或弃支援）', () => {
  const s = chapterFixture('theLairOfDagon', 1)
  s.chaosBag = ['autofail', '0', '0']
  s.investigators[0].hand = ['01088', '01088']
  asset(s, '01020')
  drawEncounterCard(s, '07297')
  settle(s, choice => (choice.kind === 'effect' ? 'hand' : null))
  const inv = s.investigators[0]
  assert.equal(inv.hand.length, 0, '选择手牌分支后弃掉 2 张手牌')
  assert.deepEqual(inv.assets.map(item => item.code), ['01020'], '不该同时弃支援')
})

test('07297：失败且揭示了诅咒标记 → 两个分支都执行', () => {
  const s = chapterFixture('theLairOfDagon', 1)
  s.chaosBag = ['curse', 'autofail', '0']
  s.investigators[0].hand = ['01088', '01088']
  asset(s, '01020')
  drawEncounterCard(s, '07297')
  settle(s)
  const inv = s.investigators[0]
  assert.equal(inv.hand.length, 0, '诅咒标记迫使弃 2 张手牌')
  assert.equal(inv.assets.length, 0, '诅咒标记迫使弃支援')
})

test('07320/07321 与 07322–07327：地点入场即部分/完全淹没（即使未揭示）', () => {
  const s = chapterFixture('intoTheMaelstrom', 1)
  // 07320 是本章起始地点，setup 已把它放进场并揭示；其余伊哈·恩斯雷地点以 setAside 状态入场。
  const start = s.locations.find(location => (location.originalCode || location.code) === '07320')
  assert.ok(start, '本章起始地点是 07320')
  assert.equal(floodLevel(s, start.id), 1, '07320 开场部分淹没')
  for (const [code, expected] of [['07321', 1], ['07322', 1], ['07323', 1],
    ['07324', 2], ['07325', 2], ['07326', 2], ['07327', 2]]) {
    const location = placeDefinition(s, code)
    assert.equal(location.revealed, false, `${code} 未揭示入场`)
    assert.equal(floodLevel(s, location.id), expected, `${code} 入场水位`)
  }
})

test('07321：行动放黑钥匙；敌人进入后若黑钥匙在此，受到 2 点伤害', () => {
  const s = chapterFixture('intoTheMaelstrom', 1)
  const api = createMechanicsApi(s)
  const hall = placeDefinition(s, '07321')
  transaction(s, draft => { scenarioRuntime(draft, []).reveal(hall.id) })
  const black = Object.entries(s.scenarioFlags.mechanics.keys).find(([color]) => color === 'black')
  assert.ok(black, '本章没有初始化黑色钥匙')
  api.keys.transfer('black', black[1].holder, 'investigator:0', { reveal: true })
  s.investigators[0].location = hall.id
  s.currentSeat = 0
  const keyMove = legalMoves(s).find(entry => entry.action === 'entityAbility' && entry.entityId === hall.id)
  assert.ok(keyMove, `没有放置黑钥匙的行动：${JSON.stringify(legalMoves(s).map(entry => entry.label))}`)
  move(s, keyMove)
  assert.deepEqual(keysAt(s, `location:${hall.id}`, { reveal: true }), ['black'])
  const start = s.locations.find(location => (location.originalCode || location.code) === '07320')
  const victim = enemy(s, { code: 'ghoulMinion', location: start.id, health: 6, fight: 1, evade: 1, engagedSeat: null })
  transaction(s, draft => { scenarioRuntime(draft, []).moveEnemy(draft.enemies.find(item => item.id === victim.id), hall.id) })
  assert.equal(byId(s, victim.id).damageTaken, 2, '进入沉没厅堂的敌人受到 2 点伤害')
})

test('引擎读点：07247 除调查外不能发现线索；07250 淹没时不能发现线索', () => {
  const s = chapterFixture('aLightInTheFog', 1)
  const shrine = placeDefinition(s, '07247')
  const archives = placeDefinition(s, '07250')
  transaction(s, draft => {
    scenarioRuntime(draft, []).reveal(shrine.id)
    scenarioRuntime(draft, []).reveal(archives.id)
  })
  s.locations.find(location => location.id === shrine.id).clues = 2
  s.locations.find(location => location.id === archives.id).clues = 2
  const inv = s.investigators[0]
  // 07247：调查发现照常；非调查来源被拒绝。
  transaction(s, draft => {
    const owner = draft.investigators[0]
    draft.locations.find(location => location.id === shrine.id).clues = 2
    discoverClueAt(draft, owner, 1, [], { locationId: shrine.id, investigation: true })
  })
  assert.equal(s.locations.find(location => location.id === shrine.id).clues, 1, '调查发现照常')
  transaction(s, draft => {
    draft.locations.find(location => location.id === shrine.id).clues = 2
    scenarioRuntime(draft, []).discoverClue(0, 1, shrine.id)
  })
  assert.equal(s.locations.find(location => location.id === shrine.id).clues, 2, '非调查来源被拒绝')
  // 07250：揭示后完全淹没，调查发现也被拒绝。
  assert.equal(floodLevel(s, archives.id), 2)
  transaction(s, draft => {
    draft.locations.find(location => location.id === archives.id).clues = 2
    discoverClueAt(draft, draft.investigators[0], 1, [], { locationId: archives.id, investigation: true })
  })
  assert.equal(s.locations.find(location => location.id === archives.id).clues, 2, '淹没时不能发现线索')
})

test('引擎读点：07239 猎鹰岬门房不能被完全淹没（floodBounds max=1）', () => {
  const s = chapterFixture('aLightInTheFog', 1)
  const gatehouse = placeDefinition(s, '07239')
  createMechanicsApi(s).water.set(gatehouse.id, 2, { ignoreRestrictions: true })
  createMechanicsApi(s).water.change(gatehouse.id, 1)
  assert.equal(floodLevel(s, gatehouse.id), 1, '水位封顶在部分淹没')
})

test('investigationPhaseEnds 窗口对非当前幕不误触发（07238 只在当前幕结算）', () => {
  const s = chapterFixture('aLightInTheFog', 1)
  s.enemies = []
  s.actIndex = 0
  transaction(s, draft => reactionWindow(draft, 'investigationPhaseEnds',
    { when: 'investigationPhaseEnds', phase: 'investigation', round: draft.round }, []))
  assert.equal(s.investigators[0].damage, 0, '当前幕不是 07238 时不因该窗口受伤')
})
