// TIC 第五章「全速恐惧 horrorInHighGear」逐章验收测试（八章 12 项验收中 6 个行为项的机械证据）。
//
// 口径：tools/audit-tic-scenarios.mjs 的 chapterTestFor —— 本文件是本章唯一验收测试文件
// （tests/tic-scenario-horrorInHighGear.test.mjs），引用 chapterFixture('horrorInHighGear')，
// 实跑通过，且通过用例标题必须分别命中 setupAndZones / actsAndAgendas / locationsAndConnections /
// encounterBehaviors / chaosEffects / resolutionsAndRecords / saveReplay 的断言关键词。
//
// 夹具与事务写法复用 tests/tic-car-faces、tic-chase-vehicles、tic-middle-remaining、tic-road-hazards。
// 运行：node --test tests/tic-scenario-horrorInHighGear.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { enemy, legalMoves, move, settle } from './core-fixture.mjs'
import { drawEncounter, reactionWindow, scenarioRuntime } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { registeredEntry } from '../src/engine/ability.js'
import { resolveTransaction } from '../src/engine/resolution.js'

const json = value => JSON.parse(JSON.stringify(value))
const codeOf = card => card?.originalCode || card?.code

function transaction(state, execute, select = () => null) {
  const run = draft => {
    try { return execute(draft) } catch (error) { if (error.constructor?.name !== 'ScenarioEnded') throw error }
  }
  resolveTransaction(state, 0, { action: 'ticHorrorInHighGearAcceptance' }, run)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 120, `choice loop ${state.pendingChoice.source}`)
    const choice = state.pendingChoice
    const id = select(choice, state)
      ?? ['done', 'skip', 'self'].find(candidate => choice.options.some(option => option.id === candidate))
      ?? choice.options[0]?.id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, run)
  }
}
const draw = (s, code) => {
  s.encounterDeck = [code]
  transaction(s, draft => drawEncounter(draft, draft.investigators[0], []))
}
const road = s => s.scenarioFlags.mechanics.road
const columns = s => road(s).columns
const columnOf = (s, id) => Number(columns(s)[id])
const rankedRoad = s => Object.entries(columns(s)).map(([id, column]) => ({ id, column: Number(column) }))
  .sort((left, right) => left.column - right.column)
const rearmostColumn = s => rankedRoad(s)[0].column
const carOf = s => (s.storyAssets || []).find(asset => ['07211a', '07211b', '07212a', '07212b'].includes(codeOf(asset)))
const vehicleOfCar = (s, car = carOf(s)) => s.scenarioFlags.mechanics.vehicles[car.id]
const carAbilities = (s, carId) => legalMoves(s).filter(command => command.action === 'entityAbility' && command.entityId === carId)
const driveAtPhaseEnd = (s, select = () => null) => transaction(s, draft => {
  reactionWindow(draft, 'investigationPhaseEnds',
    { when: 'investigationPhaseEnds', phase: 'investigation', round: draft.round }, [])
}, select)

test('horrorInHighGear 开局布置与区域守恒：道路牌堆/三张初始道路/绕路池/按人数生成的初始遭遇载具/汽车与司机上座', () => {
  const s = chapterFixture('horrorInHighGear', 2)
  const initial = s.scenarioFlags.initialRoad
  assert.equal(initial.initial.length, 3, '三张初始道路')
  assert.equal(initial.deck.length + initial.initial.length, initial.deck.length + 3)
  const front = s.scenario.startLocation
  assert.equal(rankedRoad(s).find(item => item.id === front).column, 3, '第三张为已揭示的前方道路')
  assert.equal(s.locations.find(loc => loc.id === front).revealed, true)
  // 前方道路 07207b 揭示时扩展道路：第 4 列多出 3 张（绕路/牌库各消耗）。
  assert.equal(Object.keys(columns(s)).length, 6, '初始 3 + 前方道路触发扩展 3')
  assert.equal(rankedRoad(s).filter(item => item.column === 4).length, 3)
  assert.equal(road(s).deck.length, 11, '道路牌堆剩余 11 张')
  assert.equal(road(s).detours.length, 4, '绕路池剩余 4 张')
  // 按人数生成 1 名初始遭遇载具敌人，位于最前方列 1。
  assert.equal(s.enemies.length, 1, '2 人局生成 1 名初始遭遇载具敌人')
  const spawned = s.enemies[0]
  assert.ok(['07213', '07214', '07215'].includes(codeOf(spawned)))
  assert.equal(columnOf(s, spawned.location), rearmostColumn(s), '生成在最后方的道路地点（列 1）')
  assert.equal(spawned.engagedSeat ?? null, null)
  // 汽车：一辆载具带两名乘客与司机，另一辆空车移出游戏。
  const car = carOf(s)
  assert.ok(car, '汽车剧情支援在场')
  assert.deepEqual(vehicleOfCar(s, car).passengers, [0, 1], '全员上同一辆车')
  assert.equal(vehicleOfCar(s, car).driver, 0, '司机由领队从乘客中指定')
  assert.equal(s.scenarioZones.removed.includes('07212a'), true, '空车移出游戏')
  // 区域守恒：遭遇牌库 27 张、旁置 0。
  assert.equal(s.encounterDeck.length, 27, '遭遇牌库数量守恒')
  assert.equal(s.scenarioZones.setAside.length, 0)
})

test('horrorInHighGear 幕/议程：07202 声明每个敌人获得猎手与调查阶段末载具移动；推进 07199 背面在最后方生成 07199b', () => {
  const s = chapterFixture('horrorInHighGear', 2)
  const act = registeredEntry('07202')
  assert.equal(act.implemented, true)
  assert.equal(act.actRule.enemiesGainHunter, true, '每个敌人获得猎手的读点声明')
  assert.equal(act.abilities.length, 1)
  assert.equal(act.abilities[0].trigger.includes('investigationPhaseEnds'), true, '调查阶段末载具移动窗口')
  assert.equal(typeof act.actRule.onReveal, 'function', '背面 (→结局1)')
  const agenda = registeredEntry('07199')
  assert.equal(agenda.agendaRule.movementActionSurcharge.amount, 2, '步行额外费用')
  assert.equal(typeof agenda.agendaRule.onRoundEnd, 'function', '轮末道路清理读点')
  // 推进第 1 张议程（07199）：背面把「魔鬼礁石的骇物」07199b 生成到最后方的道路地点。
  transaction(s, draft => scenarioRuntime(draft, []).advanceAgenda())
  assert.equal(s.agendaIndex, 1)
  assert.equal(codeOf(s.agendas[1]), '07201')
  const terror = s.enemies.find(item => codeOf(item) === '07199b')
  assert.ok(terror, '07199 背面生成「魔鬼礁石的骇物」')
  assert.equal(columnOf(s, terror.location), rearmostColumn(s), '生成在最后方的地点')
})

test('horrorInHighGear 幕 07202：调查阶段结束时每辆运行中的载具由司机选择移动到连接的[[道路]]地点', () => {
  const s = chapterFixture('horrorInHighGear', 2)
  const cars = Object.entries(s.scenarioFlags.mechanics.vehicles)
    .filter(([, vehicle]) => vehicle.running && vehicle.driver != null)
  assert.ok(cars.length > 0, '开局有运行中的汽车与司机')
  const before = new Map(cars.map(([id, vehicle]) => [id, vehicle.location]))
  const driverOf = new Map(cars.map(([id, vehicle]) => [id, vehicle.driver]))
  const choices = []
  driveAtPhaseEnd(s, choice => {
    if (choice.kind !== 'location') return null
    choices.push({ seat: choice.seat, options: choice.options.map(option => option.id) })
    return choice.options[0].id
  })
  assert.equal(choices.length, cars.length, '每辆运行中的载具各问一次')
  for (const [id] of cars) {
    assert.equal(choices.some(choice => choice.seat === driverOf.get(id)), true, '由司机选择')
    const after = s.scenarioFlags.mechanics.vehicles[id]
    assert.notEqual(after.location, before.get(id), '载具移动了')
    const origin = s.locations.find(location => location.id === before.get(id))
    assert.ok(origin.connections.includes(after.location), '目标是与出发地连接的地点')
    assert.equal(s.locations.find(location => location.id === after.location).traits.includes('Road'), true, '目标是[[道路]]地点')
    for (const seat of after.passengers) assert.equal(s.investigators[seat].location, after.location, '乘客随载具移动')
  }
})

test('horrorInHighGear 地点与连接/清理：道路列邻接、载具移动带走乘客、轮末清理空的后方道路地点', () => {
  const s = chapterFixture('horrorInHighGear', 2)
  const carId = carOf(s).id
  const originId = vehicleOfCar(s, carOf(s)).location
  const originColumn = columnOf(s, originId)
  // 邻接：列号相邻的道路地点互为连接。
  const neighbor = s.locations.find(location => columnOf(s, location.id) === originColumn - 1 && location.traits.includes('Road'))
  assert.ok(neighbor, '存在前一列的相邻道路地点')
  assert.equal(s.locations.find(location => location.id === originId).connections.includes(neighbor.id), true, '道路列邻接生效')
  transaction(s, draft => scenarioRuntime(draft, []).mechanics.vehicles.move(carId, neighbor.id))
  assert.equal(vehicleOfCar(s, { id: carId }).location, neighbor.id, '载具移动到相邻道路地点')
  for (const seat of vehicleOfCar(s, { id: carId }).passengers) assert.equal(s.investigators[seat].location, neighbor.id, '乘客随载具移动')
  // 轮末清理：清空敌人后从最后方开始移除空地点，停在最后方调查员后方一列。
  const cleanupState = chapterFixture('horrorInHighGear', 2)
  cleanupState.enemies = []
  const rear = rankedRoad(cleanupState)[0]
  const rearLocationId = rear.id
  const before = cleanupState.locations.length
  // 议程工厂的 onRoundEnd 不返回移除清单（只写状态），因此按状态断言。
  transaction(cleanupState, draft => {
    registeredEntry('07199').agendaRule.onRoundEnd(draft, draft.agendas[draft.agendaIndex], scenarioRuntime(draft, []))
  })
  assert.equal(cleanupState.locations.some(location => location.id === rearLocationId), false, '最后方的空地点被移出游戏')
  assert.equal(cleanupState.locations.length < before, true, '空的后方道路地点被清理')
  assert.equal(cleanupState.locations.length >= 3, true, '最后方调查员后方的地点保留')
})

test('horrorInHighGear 载具正反面与司机：07211a 运行面禁止进出、翻到 07211b 熄火面解除、司机再启动', () => {
  const s = chapterFixture('horrorInHighGear', 2)
  const car = carOf(s)
  const api = createMechanicsApi(s)
  s.currentSeat = vehicleOfCar(s, car).driver
  assert.match(String(api.vehicles.accessError(1, car.id, true)), /不能进入或离开/, '运行面禁止进出')
  const stop = carAbilities(s, car.id).find(command => /把车停下/.test(command.label))
  assert.ok(stop, '司机有停车行动')
  move(s, stop)
  settle(s)
  assert.equal(codeOf(s.storyAssets.find(asset => asset.id === car.id)), '07211b', '翻到熄火面')
  assert.equal(api.vehicles.record(car.id).running, false, '载具状态同步为熄火')
  assert.equal(/不能进入或离开/.test(String(api.vehicles.accessError(1, car.id, true))), false, '熄火面解除锁定')
  const start = carAbilities(s, car.id).find(command => /启动车子/.test(command.label))
  assert.ok(start, '熄火面有司机启动行动')
  move(s, start)
  settle(s)
  assert.equal(codeOf(s.storyAssets.find(asset => asset.id === car.id)), '07211a', '启动后翻回运行面')
  assert.equal(api.vehicles.record(car.id).running, true)
})

test('horrorInHighGear 敌人/遭遇：07213/07214 从最后方道路地点生成且不自动交战，不在载具上时攻击 +2 伤害', () => {
  const s = chapterFixture('horrorInHighGear', 2)
  s.enemies = []
  draw(s, '07214')
  const spawned = s.enemies.find(item => codeOf(item) === '07214')
  assert.ok(spawned, '抽到 07214 后生成敌人')
  assert.equal(columnOf(s, spawned.location), rearmostColumn(s), '生成在最后方的地点')
  assert.equal(spawned.engagedSeat ?? null, null, '印刷没有「与你交战」，因此不自动交战')
  // 攻击伤害加成：在载具上只受 3 点，不在载具上受 3 + 2 点（1 人局，避免同车连带攻击的额外选择）。
  const aboard = chapterFixture('horrorInHighGear', 1)
  aboard.enemies = []
  const aboardInv = aboard.investigators[0]
  assert.ok(createMechanicsApi(aboard).vehicles.of(0), '开局在载具上')
  const enemyAboard = { id: 'acceptHitVanAboard', code: '07213', name: '追击快车', location: aboardInv.location,
    damage: 3, horror: 0, engagedSeat: 0, exhausted: false, traits: ['Vehicle'] }
  aboard.enemies = [enemyAboard]
  aboardInv.engaged = [enemyAboard.id]
  const beforeAboard = aboardInv.damage
  scenarioRuntime(aboard, []).attack(enemyAboard, aboardInv)
  assert.equal(aboardInv.damage - beforeAboard, 3, '在载具上只受印刷的 3 点伤害')
  const onFoot = chapterFixture('horrorInHighGear', 1)
  onFoot.enemies = []
  const onFootInv = onFoot.investigators[0]
  createMechanicsApi(onFoot).vehicles.leave(0, carOf(onFoot).id, { forced: true })
  const enemyOnFoot = { id: 'acceptHitVanFoot', code: '07213', name: '追击快车', location: onFootInv.location,
    damage: 3, horror: 0, engagedSeat: 0, exhausted: false, traits: ['Vehicle'] }
  onFoot.enemies = [enemyOnFoot]
  onFootInv.engaged = [enemyOnFoot.id]
  const beforeOnFoot = onFootInv.damage
  scenarioRuntime(onFoot, []).attack(enemyOnFoot, onFootInv)
  assert.equal(onFootInv.damage - beforeOnFoot, 5, '不在载具上时 +2 伤害')
})

test('horrorInHighGear 混乱标记：07198 skull 按道路牌堆剩余张数、cultist/tablet 按失败差值丢失乘客资源/线索', () => {
  const s = chapterFixture('horrorInHighGear', 2)
  const rule = registeredEntry('07198').scenarioRule
  assert.equal(rule.resolveChaosToken(s, s.investigators[0], 'skull').delta, -1, '道路牌堆 >6 时 skull -1')
  road(s).deck = road(s).deck.slice(0, 6)
  assert.equal(rule.resolveChaosToken(s, s.investigators[0], 'skull').delta, -3, '道路牌库 ≤6 时 skull -3')
  s.difficulty = 'hard'
  assert.equal(rule.resolveChaosToken(s, s.investigators[0], 'skull').delta, -4, '困难难度再 -1')
  assert.equal(rule.resolveChaosToken(s, s.investigators[0], 'cultist').delta, -2)
  assert.equal(rule.resolveChaosToken(s, s.investigators[0], 'tablet').delta, -3)
  const elderthing = rule.resolveChaosToken(s, s.investigators[0], 'elderthing')
  assert.equal(elderthing.delta, -4)
  assert.deepEqual(elderthing.onDraw, [{ type: 'scenarioToken', event: 'hunters' }], '困难难度 eldersign 抽出猎手行动')
  // cultist 失败：按失败差值从同车有线索的乘客身上把线索放到当前地点。
  s.difficulty = 'standard'
  const inv = s.investigators[0]
  inv.clues = 2
  s.investigators[1].clues = 0
  const location = s.locations.find(item => item.id === inv.location)
  const cluesBefore = location.clues
  rule.applyTokenEffect(s, inv, { event: 'cultist', test: { failedBy: 1 } }, scenarioRuntime(s, []))
  assert.equal(inv.clues, 1, '失去 1 个线索')
  assert.equal(location.clues, cluesBefore + 1, '线索放到当前地点')
})

test('horrorInHighGear 结局与战役记录：resolution1 记录日出前抵达猎鹰岬，noResolution 记录日落后抵达', () => {
  const before = chapterFixture('horrorInHighGear', 2)
  transaction(before, draft => scenarioRuntime(draft, []).finish('resolution1'))
  const beforeResult = before.campaign.scenarioResults.at(-1)
  assert.ok(beforeResult, '剧本结算写入战役结果')
  assert.equal(beforeResult.resolution, 'resolution1')
  assert.equal(beforeResult.recordsAfter.TheInvestigatorsReachedFalconPointBeforeSunrise, true, '记录「日出前抵达」')
  assert.ok(beforeResult.story, '结局剧情已生成')
  const after = chapterFixture('horrorInHighGear', 2)
  transaction(after, draft => scenarioRuntime(draft, []).finish('noResolution'))
  const afterResult = after.campaign.scenarioResults.at(-1)
  assert.equal(afterResult.recordsAfter.TheInvestigatorsReachedFalconPointAfterSunrise, true, '记录「日落后抵达」')
  // 幕背面 (→结局1)：推进幕 07202 直接进入 resolution1。
  const actBack = chapterFixture('horrorInHighGear', 2)
  transaction(actBack, draft => scenarioRuntime(draft, []).advanceAct())
  assert.equal(actBack.campaign.scenarioResults.at(-1).resolution, 'resolution1', '幕背面 (→结局1) 结算')
})

test('horrorInHighGear 存档与恢复往返：道路牌堆/汽车乘客/敌人/混乱袋在 JSON 往返后一致且载具行动仍合法', () => {
  const s = chapterFixture('horrorInHighGear', 2)
  draw(s, '07213')
  const restored = json(s)
  assert.deepEqual(restored.scenarioFlags.initialRoad, s.scenarioFlags.initialRoad, '初始道路/牌堆一致')
  assert.deepEqual(restored.scenarioFlags.mechanics.road, s.scenarioFlags.mechanics.road, '道路列与牌堆一致')
  assert.deepEqual(restored.scenarioFlags.mechanics.vehicles, s.scenarioFlags.mechanics.vehicles, '载具/司机/乘客一致')
  assert.deepEqual(restored.enemies.map(item => ({ id: item.id, location: item.location })),
    s.enemies.map(item => ({ id: item.id, location: item.location })), '敌人位置一致')
  assert.deepEqual(restored.chaosBag, s.chaosBag)
  const car = carOf(restored)
  restored.currentSeat = vehicleOfCar(restored, car).driver
  assert.ok(legalMoves(restored).some(command => command.action === 'entityAbility' && command.entityId === car.id),
    '恢复后司机的载具行动仍合法')
})
