// 验收 07-a · 印斯茅斯暗潮 · 分片 5（hhg，07189–07219）的逐卡证据测试。
//
// 覆盖本分片「既有证据文件级/标题不含卡号」的 13 张卡：
//   07204a / 07205b / 07208b / 07208c / 07209b（道路危害：载具驶离时共同线索支付 + 差额后果）
//   07206a / 07206b / 07207a / 07207b（道路 2/3：团队线索查看前方已揭示面）
//   07212a / 07212b（艾莲娜·哈珀的车：运行面锁定 + 司机行驶/停车、熄火面启动）
//   07216 / 07217（颠簸前行 / “我看不见了！”：不在车上自检，车上由司机检定并伤害/恐惧全车）
//
// 口径：真实条目 + 与引擎同语义的 api 替身（道路危害/载具状态走真实 api 形状：
// api.roadHazardOnce / api.payGroupClues / api.mechanics.vehicles.*）。
// 不改既有 tests/src/content；登记进 suites 由主进程完成。
import test from 'node:test'
import assert from 'node:assert/strict'

import '../src/engine/engine.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import road07204a from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07204a.js'
import road07205b from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07205b.js'
import road07206a from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07206a.js'
import road07206b from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07206b.js'
import road07207a from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07207a.js'
import road07207b from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07207b.js'
import road07208b from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07208b.js'
import road07208c from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07208c.js'
import road07209b from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07209b.js'
import car07212a from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07212a.js'
import car07212b from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07212b.js'
import treachery07216 from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07216.js'
import treachery07217 from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07217.js'

function createState (overrides = {}) {
  const state = {
    scenario: {},
    investigators: [
      { seat: 0, name: '司机', location: 'road1', damage: 0, horror: 0, clues: 2, resources: 2, defeated: false, resigned: false, assets: [], hand: [] },
      { seat: 1, name: '乘客', location: 'road1', damage: 0, horror: 0, clues: 2, resources: 2, defeated: false, resigned: false, assets: [], hand: [] },
    ],
    locations: [
      { id: 'road1', originalCode: '07204a', name: '昏暗道路', traits: ['Road'], clues: 2, revealed: true },
      { id: 'road2', originalCode: '07210', name: '蜿蜒长路', traits: ['Road'], clues: 0, revealed: false },
    ],
    enemies: [],
    storyAssets: [],
    campaign: { leadSeat: 0, records: {} },
    scenarioFlags: { mechanics: { vehicles: { car1: { driver: 0, passengers: [0, 1], location: 'road1', running: true } }, road: { columns: { road1: 1, road2: 2 } } } },
    encounterDeck: ['01159'],
    encounterDiscard: [],
    numInvestigators: 2,
    round: 1,
    difficulty: 'standard',
    status: 'playing',
  }
  return Object.assign(state, overrides)
}

function createApi (state, overrides = {}) {
  const calls = []
  const once = new Set()
  const api = {
    __calls: calls,
    info: () => {},
    choice: request => request?.options?.[0]?.id ?? null,
    roadHazardOnce: (locationId, vehicleId) => {
      const key = `${locationId}:${vehicleId}`
      if (once.has(key)) return false
      once.add(key)
      calls.push(['roadHazardOnce', key])
      return true
    },
    payGroupClues: (amount, options) => {
      calls.push(['payGroupClues', amount, options?.allowShort === true])
      const shortfall = Number(api.__shortfall ?? 0)
      return { paid: Math.max(0, amount - shortfall), shortfall, allowShort: true }
    },
    horror: (seat, amount) => { calls.push(['horror', seat, amount]); state.investigators[seat].horror += amount },
    damage: (seat, amount) => { calls.push(['damage', seat, amount]); state.investigators[seat].damage += amount },
    test: (seat, skill, difficulty, resolve) => {
      calls.push(['test', seat, skill, difficulty])
      resolve(api.__testResult || { success: true, value: difficulty, difficulty })
    },
    removeVehicleFromGame: id => { calls.push(['removeVehicleFromGame', id]); delete state.scenarioFlags.mechanics.vehicles[id] },
    discardEncounterUntilSpawn: options => { calls.push(['discardEncounterUntilSpawn', options]); return '07213' },
    scenario: { peekLocation: (seat, id) => { calls.push(['peekLocation', seat, id]) } },
    canDiscardAsset: () => true,
    discardChosen: () => {},
    flipAsset: (card, nextCode) => { calls.push(['flipAsset', card.id, nextCode]) },
    mechanics: {
      vehicles: {
        of: seat => Object.entries(state.scenarioFlags.mechanics.vehicles)
          .find(([, vehicle]) => vehicle.passengers.includes(seat))?.[0] || null,
        record: id => state.scenarioFlags.mechanics.vehicles[id] || null,
        passengers: id => [...(state.scenarioFlags.mechanics.vehicles[id]?.passengers || [])],
        move: (id, destination) => { calls.push(['move', id, destination]); const vehicle = state.scenarioFlags.mechanics.vehicles[id]; if (vehicle) vehicle.location = destination },
        running: (id, value) => { const vehicle = state.scenarioFlags.mechanics.vehicles[id]; if (vehicle) vehicle.running = value },
        lockUntil: (id, round) => { calls.push(['lockUntil', id, round]) },
      },
      map: { extendRoad: (id, count) => { calls.push(['extendRoad', id, count]) } },
    },
  }
  return Object.assign(api, overrides)
}

const hazardEvent = (seats = [0, 1]) => ({ vehicleId: 'car1', seats, origin: 'road1', destination: 'road2' })

// ---------------------------------------------------------------------------
// 07204a 昏暗道路：付不出线索 → 每差 1 点让一位乘客受 2 点恐惧；每载具每场一次
// ---------------------------------------------------------------------------
test('07-a5 07204a 昏暗道路：每差 1 线索一位乘客受 2 点恐惧，且每载具每场一次', () => {
  const state = createState()
  const api = createApi(state, { __shortfall: 1 })
  const location = state.locations[0]
  assert.equal(road07204a.locationRule.vehicleLeft(state, location, hazardEvent(), api), true)
  assert.equal(state.investigators[0].horror + state.investigators[1].horror, 2, '差额 1 → 载具上一位调查员承受 2 点恐惧')
  assert.ok(api.__calls.some(call => call[0] === 'payGroupClues' && call[1] === 2 && call[2] === true), '共同线索 = 乘客数 × 1（allowShort）')
  const horrorBefore = state.investigators.reduce((sum, inv) => sum + inv.horror, 0)
  assert.equal(road07204a.locationRule.vehicleLeft(state, location, hazardEvent(), api), false, '每载具每场一次：第二次不再结算（返回 false）')
  assert.equal(state.investigators.reduce((sum, inv) => sum + inv.horror, 0), horrorBefore, '第二次不造成额外恐惧')
})

// ---------------------------------------------------------------------------
// 07205b 崖边道路：付不出 → 司机检定失败 → 载具移出游戏 + 每位乘客 10 点伤害
// ---------------------------------------------------------------------------
test('07-a5 07205b 崖边道路：司机检定失败则移除载具、每位乘客 10 点伤害', () => {
  const state = createState()
  const api = createApi(state, { __shortfall: 2, __testResult: { success: false, value: 0, difficulty: 2 } })
  const handled = road07205b.locationRule.vehicleLeft(state, state.locations[0], hazardEvent(), api)
  assert.equal(handled, true)
  assert.ok(api.__calls.some(call => call[0] === 'test' && call[1] === 0 && call[2] === 'willpower' && call[3] === 2),
    '司机（seat 0）检定意志(2)，难度 = 不能支付的线索数')
  assert.ok(api.__calls.some(call => call[0] === 'removeVehicleFromGame' && call[1] === 'car1'), '载具被移出游戏')
  assert.equal(state.investigators[0].damage, 10, '司机受到 10 点伤害')
  assert.equal(state.investigators[1].damage, 10, '同车另一位调查员受到 10 点伤害')
})

// ---------------------------------------------------------------------------
// 07206a / 07206b 歧路（道路 2）：团队每人 1 线索，查看任意前方已揭示面
// ---------------------------------------------------------------------------
for (const entry of [road07206a, road07206b]) {
  test(`07-a5 ${entry.code} 歧路：团队每人 1 线索查看前方已揭示面（道路 2 数据）`, () => {
    const state = createState()
    const ability = entry.abilities[0]
    assert.equal(entry.scope, 'location')
    assert.equal(ability.kind, 'free')
    assert.equal(ability.cost.groupClues({ state }), state.numInvestigators, '团队线索 = 每人 1（2 人 = 2）')
    const ahead = { id: 'road2', originalCode: '07210', name: '蜿蜒长路', traits: ['Road'] }
    const behind = { id: 'road0', originalCode: '07203', name: '猎鹰岬通路', traits: ['Road'] }
    state.locations.push({ ...ahead, revealed: true, connections: [] })
    state.locations.push({ ...behind, revealed: true, connections: [] })
    const source = { ...state.locations[0], location: 'road1' }
    const query = ability.target.query
    assert.equal(query({ state, source, candidate: ahead }), true, '前方地点可作为查看目标')
    assert.equal(query({ state, source, candidate: behind }), false, '后方地点不可作为查看目标')
    const api = createApi(state)
    ability.resolve({ inv: state.investigators[0], source, target: { entity: ahead, id: ahead.id }, api })
    assert.ok(api.__calls.some(call => call[0] === 'peekLocation' && call[1] === 0 && call[2] === 'road2'),
      '查看的是前方地点的已揭示面（不改变揭示状态）')
    assert.equal(ALL_CARDS[entry.code].text.includes('Look at the revealed side'), true)
  })
}

// ---------------------------------------------------------------------------
// 07207a / 07207b 交岔路（道路 3）：同样的团队查看能力
// ---------------------------------------------------------------------------
for (const entry of [road07207a, road07207b]) {
  test(`07-a5 ${entry.code} 交岔路：团队每人 1 线索查看前方已揭示面（道路 3 数据）`, () => {
    const state = createState()
    const ability = entry.abilities[0]
    assert.equal(ability.cost.groupClues({ state }), 2, '团队线索 = 每人 1')
    const ahead = { id: 'road2', originalCode: '07210', name: '蜿蜒长路', traits: ['Road'] }
    state.locations.push({ ...ahead, revealed: false })
    const source = { ...state.locations[0], location: 'road1' }
    const query = ability.target.query
    assert.equal(query({ state, source, candidate: ahead }), true, '未揭示的前方地点也可以查看已揭示面')
    const api = createApi(state)
    ability.resolve({ inv: state.investigators[0], source, target: { entity: ahead, id: ahead.id }, api })
    assert.ok(api.__calls.some(call => call[0] === 'peekLocation' && call[2] === 'road2'))
    assert.equal(ALL_CARDS[entry.code].text.includes('Road 3'), true, '印刷为道路 3')
  })
}

// ---------------------------------------------------------------------------
// 07208b / 07208c 急转弯：共同线索 2/人；差额 1 线索 = 1 点 / 2 点伤害
// ---------------------------------------------------------------------------
for (const [entry, expectedDamage, note] of [[road07208b, 1, '差额 1 → 1 点伤害'], [road07208c, 2, '差额 1 → 2 点伤害']]) {
  test(`07-a5 ${entry.code} 急转弯：每差 1 线索一位乘客受 ${expectedDamage} 点伤害`, () => {
    const state = createState()
    const api = createApi(state, { __shortfall: 1 })
    assert.equal(entry.locationRule.vehicleLeft(state, state.locations[0], hazardEvent(), api), true)
    assert.equal(state.investigators[0].damage + state.investigators[1].damage, expectedDamage, note)
    assert.ok(api.__calls.some(call => call[0] === 'payGroupClues' && call[1] === 4), '共同线索 = 乘客数 2 × 每人 2 = 4')
  })
}

// ---------------------------------------------------------------------------
// 07209b 荒凉道路：付不出 → 从遭遇牌库弃到[[载具]]敌人生成在此
// ---------------------------------------------------------------------------
test('07-a5 07209b 荒凉道路：付不齐时弃遭遇牌直到[[载具]]敌人并生成在此', () => {
  const state = createState()
  const api = createApi(state, { __shortfall: 1 })
  assert.equal(road07209b.locationRule.vehicleLeft(state, state.locations[0], hazardEvent(), api), true)
  assert.ok(api.__calls.some(call => call[0] === 'discardEncounterUntilSpawn'
    && call[1].trait === 'Vehicle' && call[1].location === 'road1'), '按 [[载具]] 特性弃牌并在本地点生成')
  assert.ok(api.__calls.some(call => call[0] === 'payGroupClues' && call[1] === 2), '共同线索 = 2（每人 1）')
})

// ---------------------------------------------------------------------------
// 07212a 艾莲娜·哈珀的车：运行面锁定 + 司机行动；停车翻到熄火面
// ---------------------------------------------------------------------------
test('07-a5 07212a 艾莲娜·哈珀的车：运行面禁止进出，司机行驶/停车', () => {
  const state = createState()
  const car = { id: 'elinaCar', code: '07212a', name: '艾莲娜·哈珀的车' }
  state.storyAssets.push(car)
  state.scenarioFlags.mechanics.vehicles.elinaCar = { driver: 0, passengers: [0], location: 'road1', running: true }
  assert.equal(car07212a.assetRule.vehicleAccessLocked, true, '运行面：调查员不能进入或离开')
  assert.equal(car07212a.abilities.length, 2, '运行面有「行驶」与「停车」两条司机行动')
  const [drive, stop] = car07212a.abilities
  assert.equal(drive.limit.scope, 'perRound', '行驶每轮最多一次')
  assert.equal(drive.criteria({ state, inv: state.investigators[0], source: car }), true, '司机可行驶')
  assert.equal(drive.criteria({ state, inv: state.investigators[1], source: car }), false, '非司机不可行驶')
  const api = createApi(state, { drawEncounter: seat => api.__calls.push(['drawEncounter', seat]) })
  drive.resolve({ inv: state.investigators[0], source: car, target: { entity: state.locations[1], id: 'road2' }, api })
  assert.ok(api.__calls.some(call => call[0] === 'drawEncounter' && call[1] === 0), '先抽遭遇牌')
  assert.ok(api.__calls.some(call => call[0] === 'move' && call[1] === 'elinaCar' && call[2] === 'road2'), '再移动到连接的[[道路]]地点')
  stop.resolve({ state, source: car, api })
  assert.ok(api.__calls.some(call => call[0] === 'flipAsset' && call[2] === '07212b'), '停车：翻到熄火面 07212b')
})

// ---------------------------------------------------------------------------
// 07212b 艾莲娜·哈珀的车：熄火面不锁定进出，司机启动后翻回运行面
// ---------------------------------------------------------------------------
test('07-a5 07212b 艾莲娜·哈珀的车：熄火面不锁定进出，司机启动后翻回运行面', () => {
  const state = createState()
  const stoppedCar = { id: 'elinaCar', code: '07212b', name: '艾莲娜·哈珀的车' }
  state.storyAssets.push(stoppedCar)
  state.scenarioFlags.mechanics.vehicles.elinaCar = { driver: 1, passengers: [1], location: 'road1', running: false }
  assert.equal(car07212b.assetRule?.vehicleAccessLocked, undefined, '熄火面不声明载具进出锁定')
  const ability = car07212b.abilities[0]
  assert.equal(ability.criteria({ state, inv: state.investigators[1], source: stoppedCar }), true, '司机可启动')
  assert.equal(ability.criteria({ state, inv: state.investigators[0], source: stoppedCar }), false, '非司机不可启动')
  const api = createApi(state)
  ability.resolve({ state, source: stoppedCar, api })
  assert.ok(api.__calls.some(call => call[0] === 'flipAsset' && call[2] === '07212a'), '启动：翻回运行面 07212a')
  assert.equal(state.scenarioFlags.mechanics.vehicles.elinaCar.running, true, '运行状态同步为 true')
  assert.equal(ALL_CARDS['07212b'].text.includes('is stopped'), true, '卡面为熄火面')
})

// ---------------------------------------------------------------------------
// 07216 颠簸前行 / 07217 “我看不见了！”：不在车上自检，车上由司机检定并伤害/恐惧全车
// ---------------------------------------------------------------------------
for (const [entry, skill, harmKey, name] of [
  [treachery07216, 'agility', 'damage', '颠簸前行'],
  [treachery07217, 'willpower', 'horror', '“我看不见了！”'],
]) {
  test(`07-a5 ${entry.code} ${name}：不在车上自检，车上司机检定失败后全车承受 2 点`, () => {
    const state = createState()
    state.scenarioFlags.mechanics.vehicles = {}
    const outsideApi = createApi(state, { __testResult: { success: false, value: 1, difficulty: 5 } })
    assert.equal(entry.encounterResolve(state, state.investigators[1], { code: entry.code }, outsideApi), false, '显现后进入遭遇弃牌堆')
    assert.ok(outsideApi.__calls.some(call => call[0] === 'test' && call[1] === 1 && call[2] === skill && call[3] === 5),
      '不在载具上：抽屉者检定难度 5')
    assert.equal(state.investigators[1][harmKey], 3, '失败受到 3 点固定伤害/恐惧')

    const rideState = createState()
    const insideApi = createApi(rideState, { __testResult: { success: false, value: 0, difficulty: 3 } })
    entry.encounterResolve(rideState, rideState.investigators[1], { code: entry.code }, insideApi)
    assert.ok(insideApi.__calls.some(call => call[0] === 'test' && call[1] === 0 && call[2] === skill && call[3] === 3),
      '在载具上：由司机（seat 0）检定难度 3')
    assert.equal(rideState.investigators[0][harmKey], 2, '司机也受到 2 点')
    assert.equal(rideState.investigators[1][harmKey], 2, '同车抽屉者也受到 2 点')
  })
}
