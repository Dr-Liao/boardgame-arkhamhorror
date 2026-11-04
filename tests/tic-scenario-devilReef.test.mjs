// TIC 第四章「魔鬼礁石 devilReef」逐章验收测试（八章 12 项验收中 6 个行为项的机械证据）。
//
// 口径：tools/audit-tic-scenarios.mjs 的 chapterTestFor —— 本文件是本章唯一验收测试文件
// （tests/tic-scenario-devilReef.test.mjs），引用 chapterFixture('devilReef')，实跑通过，
// 且通过用例标题必须分别命中 setupAndZones / actsAndAgendas / locationsAndConnections /
// encounterBehaviors / chaosEffects / resolutionsAndRecords / saveReplay 的断言关键词。
// 因此下面每个用例标题都显式带上对应检查项的关键词（开局布置/幕/议程/地点/连接/载具/移动/
// 敌人/诡计/遭遇/混乱/标记/结局/结算/记录/存档/往返）。
//
// 夹具与事务写法复用 tests/tic-vortex-resign、tic-fishing-vessel、tic-chase-vehicles、tic-late-b-cards。
// 运行：node --test tests/tic-scenario-devilReef.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { legalMoves, move, settle } from './core-fixture.mjs'
import { drawEncounter, scenarioRuntime } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { registeredEntry } from '../src/engine/ability.js'
import { resolveTransaction } from '../src/engine/resolution.js'

const json = value => JSON.parse(JSON.stringify(value))

// 章节测试统一事务：所有状态写入口都经 resolveTransaction；ScenarioEnded 视为正常结束。
function transaction(state, execute, select = () => null) {
  const run = draft => {
    try { return execute(draft) } catch (error) { if (error.constructor?.name !== 'ScenarioEnded') throw error }
  }
  resolveTransaction(state, 0, { action: 'ticDevilReefAcceptance' }, run)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 120, `choice loop ${state.pendingChoice.source}`)
    const choice = state.pendingChoice
    const id = select(choice, state)
      ?? ['done', 'skip', 'self'].find(candidate => choice.options.some(option => option.id === candidate))
      ?? choice.options[0]?.id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, run)
  }
}
const boatOf = s => (s.storyAssets || []).find(asset => (asset.originalCode || asset.code) === '07178')
const boatVehicle = s => s.scenarioFlags.mechanics.vehicles[boatOf(s).id]
const codeOf = card => card?.originalCode || card?.code
const draw = (s, code) => {
  s.encounterDeck = [code]
  transaction(s, draft => drawEncounter(draft, draft.investigators[0], []))
}

test('devilReef 开局布置与区域守恒：5 座随机岛成对入位、7 色钥匙、渔船与全员上船于完全淹没的急涡水域', () => {
  const s = chapterFixture('devilReef', 2)
  const mech = s.scenarioFlags.mechanics
  // 初始区域：急涡水域 07168 + 5 座岛；岛未揭示、按随机锚点入位。
  assert.equal(s.locations.length, 6)
  const islands = s.scenarioFlags.initialIslandPositions
  assert.equal(islands.length, 5, '5 座岛按随机槽位放置')
  assert.equal(new Set(islands.map(item => item.id)).size, 5)
  for (const item of islands) {
    const location = s.locations.find(loc => loc.id === item.id)
    assert.ok(location, '岛已出场')
    assert.equal(location.revealed, false, '岛初始未揭示')
    assert.deepEqual([mech.grid[item.id].x, mech.grid[item.id].y], item.point, '按随机锚点坐标入位')
  }
  // 深窟随机池成对守恒：3 张选中入场、3 张移出游戏，两侧不重复。
  assert.equal(s.scenarioFlags.selectedDepths.length, 3)
  assert.equal(s.scenarioZones.removed.length, 3)
  assert.equal(new Set([...s.scenarioFlags.selectedDepths, ...s.scenarioZones.removed]).size, 6)
  assert.equal(Object.keys(mech.scenarioDecks || {}).length >= 2, true, '潮水通道/深窟两个场景牌堆已建立')
  // 7 色钥匙：紫/白/黑正面朝上放在一边，其余扣置。
  const keys = mech.keys
  assert.equal(Object.keys(keys).length, 7)
  for (const color of ['purple', 'white', 'black']) {
    assert.equal(keys[color].holder, 'setAside')
    assert.equal(keys[color].revealed, true, `${color} 钥匙开局正面朝上`)
  }
  for (const color of ['yellow', 'green', 'red', 'blue']) assert.equal(keys[color].revealed, false)
  // 渔船 07178：剧情资产 + 载具登记，全员上船；开局地点完全淹没且已揭示。
  const boat = boatOf(s)
  assert.ok(boat, '渔船剧情支援在场')
  assert.equal(boatVehicle(s).protectsFromFlood, true, '渔船上视为未淹没')
  assert.deepEqual(boatVehicle(s).passengers, [0, 1], '开局全员在渔船上')
  const start = s.locations.find(loc => loc.id === s.scenario.startLocation)
  assert.equal(codeOf(start), '07168')
  assert.equal(start.revealed, true)
  assert.equal(createMechanicsApi(s).water.level(start.id), 2, '急涡水域开局完全淹没')
  // 区域守恒：遭遇牌库 33 张、旁置 3 张剧情支援。
  assert.equal(s.encounterDeck.length, 33, '遭遇牌库数量守恒')
  assert.equal(s.scenarioZones.setAside.length, 3, '旁置剧情支援守恒')
})

test('devilReef 幕/议程：07167 目标=集齐紫/白/黑钥匙；推进 07165 背面在渔船所在地生成魔鬼礁石骇物', () => {
  const s = chapterFixture('devilReef', 2)
  const act = registeredEntry('07167')
  assert.equal(act.scope, 'act')
  assert.equal(typeof act.actRule.objective, 'function', '07167 声明的目标函数')
  assert.equal(act.actRule.objective(s), false, '未集齐钥匙时目标未达成')
  const api = createMechanicsApi(s)
  for (const color of ['purple', 'white', 'black']) api.keys.transfer(color, 'setAside', 'investigator:0', { reveal: true })
  assert.equal(act.actRule.objective(s), true, '集齐紫/白/黑钥匙后目标达成')
  assert.deepEqual(registeredEntry('07165').agendaRule.movementActionSurcharge, { amount: 2, betweenTraits: ['Ocean'] }, '步行额外费用在议程上声明')
  // 推进第 1 张议程（版本二 07165）：背面生成对应 07165b 到渔船所在地点。
  const boat = boatOf(s)
  transaction(s, draft => scenarioRuntime(draft, []).advanceAgenda())
  assert.equal(s.agendaIndex, 1, '议程推进一格')
  assert.equal(codeOf(s.agendas[1]), '07166')
  const terror = s.enemies.find(item => codeOf(item) === '07165b')
  assert.ok(terror, '07165 背面生成「魔鬼礁石的骇物」')
  assert.equal(terror.location, boat.location, '生成在渔船所在地点')
})

test('devilReef 地点与连接/载具移动：急涡水域经符号连接 5 座岛，渔船移动带走乘客与卡面；07168 撤退入口在船上出现', () => {
  const s = chapterFixture('devilReef', 1)
  const start = s.locations.find(loc => loc.id === s.scenario.startLocation)
  assert.equal(codeOf(start), '07168')
  assert.ok(start.traits.includes('Ocean'), '急涡水域是[[海洋]]地点')
  assert.equal(start.connections.length, 5, '符号连接 5 座岛')
  for (const id of start.connections) {
    const island = s.locations.find(loc => loc.id === id)
    assert.ok(island, `连接地点 ${id} 在场`)
    assert.ok(island.traits.includes('Island'), '连接对象是[[岛屿]]地点')
    assert.equal(island.connections.includes(start.id), true, '符号连接是双向的')
  }
  // 在渔船上时 07168 提供撤退行动（actionKind resign）；不在船上时不出现。
  const resignAction = legalMoves(s).find(command => command.action === 'entityAbility'
    && command.entityId === start.id && command.actionKind === 'resign')
  assert.ok(resignAction, '在渔船上时急涡水域提供撤退行动')
  const boat = boatOf(s)
  const commands = legalMoves(s).filter(command => command.action === 'entityAbility' && command.entityId === boat.id)
  assert.ok(commands.length > 0, '在船上时出现渔船移动行动')
  const destination = commands[0].targetId
  const target = s.locations.find(loc => loc.id === destination)
  assert.equal(start.connections.includes(destination), true, '移动目标与当前地点连接')
  assert.ok(target.traits.includes('Ocean'), '渔船只能移动到[[海洋]]地点')
  move(s, commands[0])
  settle(s)
  assert.equal(boatVehicle(s).location, destination, '载具登记位置更新')
  assert.equal(boatOf(s).location, destination, '载具卡面位置随同更新')
  assert.equal(s.investigators[0].location, destination, '乘客随渔船移动')
})

test('devilReef 遭遇/诡计：07099 机械故障附属最近[[载具]]剧情支援并封锁宿主的[action]，不进入遭遇弃牌堆', () => {
  const s = chapterFixture('devilReef', 2)
  const boatId = boatOf(s).id
  assert.ok(legalMoves(s).some(command => command.action === 'entityAbility' && command.entityId === boatId), '附属前渔船行动可用')
  draw(s, '07099')
  assert.equal(s.encounterDiscard.includes('07099'), false, '附属型诡计不进入遭遇弃牌堆')
  // 事务提交后 state 内的对象会替换，因此按 id 重新取宿主实例。
  const host = s.storyAssets.find(asset => asset.id === boatId)
  assert.ok((host.attachments || []).some(card => codeOf(card) === '07099'), '附属到最近的[[载具]]剧情支援（渔船）')
  assert.equal(legalMoves(s).some(command => command.action === 'entityAbility' && command.entityId === boatId), false, '宿主[action]能力被封锁')
  assert.ok(registeredEntry('07099').treacheryRule.attachmentAbilities.length > 0, '机械故障自身保留行动描述子')
})

test('devilReef 混乱标记：07163 提示卡 skull 随团队持钥数变化，cultist/tablet/elderthing 按难度结算且 tablet 只伤不在载具上者', () => {
  const s = chapterFixture('devilReef', 2)
  const rule = registeredEntry('07163').scenarioRule
  // 提示卡的 resolveChaosToken 走场景运行时面（api.mechanics.keys 等）。
  const runtime = scenarioRuntime(s, [])
  const transfer = createMechanicsApi(s)
  assert.equal(0 + rule.resolveChaosToken(s, s.investigators[0], 'skull', runtime).delta, 0, '无钥匙时 skull 不加难度')
  transfer.keys.transfer('purple', 'setAside', 'investigator:0', { reveal: true })
  transfer.keys.transfer('white', 'setAside', 'investigator:0', { reveal: true })
  assert.equal(rule.resolveChaosToken(s, s.investigators[0], 'skull', runtime).delta, -2, '每个团队持钥 -1 难度')
  s.difficulty = 'hard'
  assert.equal(rule.resolveChaosToken(s, s.investigators[0], 'skull', runtime).delta, -3, '困难难度再 -1')
  assert.equal(rule.resolveChaosToken(s, s.investigators[0], 'cultist', runtime).delta, -3)
  assert.equal(rule.resolveChaosToken(s, s.investigators[0], 'tablet', runtime).delta, -4)
  assert.equal(rule.resolveChaosToken(s, s.investigators[0], 'elderthing', runtime).delta, -5)
  // tablet 失败效果：不在载具上的调查员受到 1 点伤害。
  s.difficulty = 'standard'
  const before = s.investigators[0].damage
  rule.applyTokenEffect(s, s.investigators[0], { event: 'tablet' }, runtime)
  assert.equal(s.investigators[0].damage, before, '在载具上的调查员不受 tablet 伤害')
  createMechanicsApi(s).vehicles.leave(0, boatOf(s).id, { forced: true })
  rule.applyTokenEffect(s, s.investigators[0], { event: 'tablet' }, runtime)
  assert.equal(s.investigators[0].damage, before + 1, '不在载具上时受 1 点伤害')
})

test('devilReef 结局与战役记录：resolution1 结算记录骇物存活/死亡、追回钥匙 flowData 与结局记录', () => {
  const s = chapterFixture('devilReef', 2)
  const api = createMechanicsApi(s)
  for (const color of ['purple', 'white', 'black']) api.keys.transfer(color, 'setAside', 'investigator:0', { reveal: true })
  api.keys.transfer('red', 'setAside', 'investigator:0', { reveal: true })
  // 一名骇物在场（存活），一名加入胜利区（死亡）；议程未推进（agendaIndex 0）。
  transaction(s, draft => {
    const runtime = scenarioRuntime(draft, [])
    runtime.spawn('07164b', boatOf(draft).location)
    const defeated = runtime.spawn('07165b', boatOf(draft).location)
    runtime.addEnemyToVictory(defeated)
  })
  transaction(s, draft => scenarioRuntime(draft, []).finish('resolution1'))
  const result = s.campaign.scenarioResults.at(-1)
  assert.ok(result, '剧本已结算并写入战役结果')
  assert.equal(result.resolution, 'resolution1')
  assert.equal(result.recordsAfter.TheTerrorOfDevilReefIsStillAlive, true, '记录骇物仍存活')
  assert.equal(result.recordsAfter.TheTerrorOfDevilReefIsDead, true, '记录骇物已死亡（胜利区）')
  assert.deepEqual([...s.campaign.flowPayload.recoveredKeys].sort(), ['black', 'purple', 'white'], '追回钥匙掩码进入 flowData')
  assert.ok(result.story, '结局剧情已生成')
})

test('devilReef 存档与恢复往返：随机岛/深窟布局、钥匙、渔船与乘客在 JSON 往返后一致且行动仍合法', () => {
  const s = chapterFixture('devilReef', 2)
  transaction(s, draft => scenarioRuntime(draft, []).advanceAgenda()) // 让场上有背面生成物一起往返
  const restored = json(s)
  assert.deepEqual(restored.scenarioFlags.initialIslandPositions, s.scenarioFlags.initialIslandPositions, '随机岛布局一致')
  assert.deepEqual(restored.scenarioFlags.selectedDepths, s.scenarioFlags.selectedDepths, '深窟配对一致')
  assert.deepEqual(restored.scenarioZones.removed, s.scenarioZones.removed)
  assert.deepEqual(restored.scenarioFlags.mechanics.keys, s.scenarioFlags.mechanics.keys, '钥匙持有者一致')
  assert.deepEqual(restored.scenarioFlags.mechanics.vehicles, s.scenarioFlags.mechanics.vehicles, '载具与乘客一致')
  assert.deepEqual(restored.locations.map(loc => ({ id: loc.id, revealed: loc.revealed, connections: loc.connections })),
    s.locations.map(loc => ({ id: loc.id, revealed: loc.revealed, connections: loc.connections })), '地点连接一致')
  assert.deepEqual(restored.enemies.map(item => ({ id: item.id, location: item.location })),
    s.enemies.map(item => ({ id: item.id, location: item.location })))
  restored.currentSeat = 0
  const boat = (restored.storyAssets || []).find(asset => codeOf(asset) === '07178')
  assert.ok(legalMoves(restored).some(command => command.action === 'entityAbility' && command.entityId === boat.id),
    '恢复后渔船移动行动仍合法')
})
