// P7 岩间密语（writtenInRock · 提示卡 10501）章节测试。
//
// 覆盖：章节结构/22 张单卡条目、gather 组与放一边、两段式布置（洞穴行 → 塌方后轨道段）、
// 轨道图标的连接、矿车移动/脱轨/道岔反应、幕 1/2 与议程 1/2 的正背面、混乱标记、
// 地下野兽/深掘混种/发狂矿工/塌方/急速狂飙/沉没隧道/扭曲隧道/碱性轨道/轨道岔路/轨道桥梁/
// 控制站、结局 1–5 + 结局 6 记录、无结局分支与 JSON 存档往返。
//
// 本文件不 import engine.js：章节 behavior 只走内容层函数（真实引擎钩子由 P7 主进程合并后
// 用 contentRegistry 注册），因此单测可在并行 worker 尚未重建索引时独立运行。
import test from 'node:test'
import assert from 'node:assert/strict'
import { addMarker, markerCountOf } from '../src/engine/marker-count.js'
import { mechanicState } from '../src/engine/mechanic-state.js'
import { gridPosition } from '../src/engine/grid-map.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
// 章节的载具写入口改走运行时原语 `api.mechanics.vehicles.*`（不再静态 import vehicles.js，
// 否则会形成 index → behavior → vehicles → card-lookup → content/registered.js 的求值环）。
// 单测的假件把真实引擎函数接进同一个 api 形状，deps 与章节原来的口径一致。
import { enterVehicle, moveVehicle, registerVehicle } from '../src/engine/vehicles.js'
import * as chapter from '../content/campaigns/theFeastOfHemlockVale/scenarios/writtenInRock/index.js'
import {
  scenario, LOCATIONS, CAVE_LOCATION_IDS, RAIL_LOCATION_IDS, ENCOUNTER_DECK,
  GATHER_GROUPS, DAY_GATHER_GROUPS, SET_ASIDE_CARDS, ACT_CODES, AGENDA_CODES,
  ACT_STAGES, AGENDA_STAGES, SCENARIO_TEXT, THE_CAVE_IN, RESOLUTION_KEYS,
  MINE_CART_CODE, PRISMATIC_SHARD_CODE, SUBTERRANEAN_BEAST_CODE, CAVE_IN_CODE,
  WILD_RIDE_CODE, RESIDENT_ASSETS, encounterDeckForDay, dayGroupCards,
} from '../content/campaigns/theFeastOfHemlockVale/scenarios/writtenInRock/definition.js'
import {
  writtenInRockChaosToken, writtenInRockChaosTokenValue, currentActStep, columnOf,
  WRITTEN_IN_ROCK_TOKEN_MEANINGS,
} from '../content/campaigns/theFeastOfHemlockVale/scenarios/writtenInRock/chaos.js'
import entry10503 from '../src/cards/encounter-entries/theFeastOfHemlockVale/writtenInRock/10503.js'
import entry10504 from '../src/cards/encounter-entries/theFeastOfHemlockVale/writtenInRock/10504.js'
import entry10505 from '../src/cards/encounter-entries/theFeastOfHemlockVale/writtenInRock/10505.js'
import entry10506 from '../src/cards/encounter-entries/theFeastOfHemlockVale/writtenInRock/10506.js'
import entry10507 from '../src/cards/encounter-entries/theFeastOfHemlockVale/writtenInRock/10507.js'
import entry10508 from '../src/cards/encounter-entries/theFeastOfHemlockVale/writtenInRock/10508.js'
import entry10509 from '../src/cards/encounter-entries/theFeastOfHemlockVale/writtenInRock/10509.js'
import entry10510a from '../src/cards/encounter-entries/theFeastOfHemlockVale/writtenInRock/10510a.js'
import entry10510b from '../src/cards/encounter-entries/theFeastOfHemlockVale/writtenInRock/10510b.js'
import entry10511a from '../src/cards/encounter-entries/theFeastOfHemlockVale/writtenInRock/10511a.js'
import entry10511b from '../src/cards/encounter-entries/theFeastOfHemlockVale/writtenInRock/10511b.js'
import entry10512 from '../src/cards/encounter-entries/theFeastOfHemlockVale/writtenInRock/10512.js'
import entry10513 from '../src/cards/encounter-entries/theFeastOfHemlockVale/writtenInRock/10513.js'
import entry10514 from '../src/cards/encounter-entries/theFeastOfHemlockVale/writtenInRock/10514.js'
import entry10515 from '../src/cards/encounter-entries/theFeastOfHemlockVale/writtenInRock/10515.js'
import entry10516 from '../src/cards/encounter-entries/theFeastOfHemlockVale/writtenInRock/10516.js'
import entry10517 from '../src/cards/encounter-entries/theFeastOfHemlockVale/writtenInRock/10517.js'
import entry10518 from '../src/cards/encounter-entries/theFeastOfHemlockVale/writtenInRock/10518.js'
import entry10519 from '../src/cards/encounter-entries/theFeastOfHemlockVale/writtenInRock/10519.js'
import entry10520 from '../src/cards/encounter-entries/theFeastOfHemlockVale/writtenInRock/10520.js'
import entry10521 from '../src/cards/encounter-entries/theFeastOfHemlockVale/writtenInRock/10521.js'
import entry10522 from '../src/cards/encounter-entries/theFeastOfHemlockVale/writtenInRock/10522.js'

const ENTRIES = [
  entry10503, entry10504, entry10505, entry10506, entry10507, entry10508, entry10509,
  entry10510a, entry10510b, entry10511a, entry10511b, entry10512, entry10513, entry10514,
  entry10515, entry10516, entry10517, entry10518, entry10519, entry10520, entry10521, entry10522,
]
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

const ENTRY_CODES = ENTRIES.map(entry => entry.code)

// 14 个轨道隧道格（7 固定 + 7 个 "?"）；轨道出口单独在 (5,5)。
const TUNNEL_CELLS = [
  [2, 4], [2, 2], [3, 3], [4, 2], [4, 4], [5, 1], [5, 3],
  [1, 2], [1, 3], [1, 4], [2, 1], [3, 4], [4, 1], [5, 2],
]
const TUNNEL_IDS = RAIL_LOCATION_IDS.filter(id => id !== 'controlStation' && id !== 'railExit')

// 稳定摆位：控制站(1,1)、出口(5,5)，其余 14 张。
const FULL_ASSIGN = {
  '2,4': 'sunkenRailA', '2,2': 'forkedRailA', '3,3': 'forkedRailB', '4,2': 'alkalineRailA',
  '4,4': 'rightTurnA', '5,1': 'leftTurnA', '5,3': 'railBridge',
  '1,2': 'sunkenRailB', '1,3': 'warpedRailA', '1,4': 'warpedRailB',
  '2,1': 'leftTurnB', '3,4': 'rightTurnB', '4,1': 'forkedRailC', '5,2': 'alkalineRailB',
}

/** 显式轨道摆位：assign 以 "x,y" 指定地点，其余格按目录顺序补满。 */
function planWith(assign = {}) {
  const merged = { ...FULL_ASSIGN, ...assign }
  const used = new Set(Object.values(merged))
  assert.equal(used.size, TUNNEL_IDS.length, '轨道摆位必须覆盖 14 张隧道各一次')
  const slots = TUNNEL_CELLS.map(([x, y]) => ({ x, y, id: merged[`${x},${y}`] }))
  return { slots }
}

const clone = value => JSON.parse(JSON.stringify(value))
const stateFor = (investigatorCount = 1, { records = {}, flags = {} } = {}) => ({
  investigators: Array.from({ length: investigatorCount }, (_, seat) => ({
    seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
    assets: [], engaged: [], deck: [], discard: [], hand: [], threat: [],
  })),
  locations: [], enemies: [], storyAssets: [], encounterDeck: [], encounterDiscard: [],
  scenarioFlags: { ...flags }, scenarioZones: {}, markerCounts: {},
  campaign: { leadSeat: 0, records: { ...records }, completedSteps: [], trauma: {}, investigators: {} },
  victoryDisplay: [], doom: 0, difficulty: 'standard', numInvestigators: investigatorCount,
  phase: 'investigation', round: 1, status: 'playing', rngState: 20261117,
})
const stateWithScenario = (count = 1, options = {}) => {
  const state = stateFor(count, options)
  state.scenario = structuredClone(scenario)
  return state
}

const engineishApi = () => {
  const api = { info: () => {}, finished: null, trauma: [], damages: [], choices: [] }
  // 引擎运行时形状：api.mechanics.vehicles.{register,enter,move}。
  api.mechanics = {
    vehicles: {
      register: (id, spec) => registerVehicle(api.state, id, spec),
      enter: (seat, id, options) => enterVehicle(api.state, seat, id, options),
      move: (id, destination) => moveVehicle(api.state, id, destination, {
        moveInvestigator: (seat, destinationId) => {
          if (typeof api.moveInvestigator === 'function') api.moveInvestigator(seat, destinationId)
          else api.state.investigators[seat].location = destinationId
        },
      }),
    },
  }
  api.choose = options => {
    api.choices.push(options)
    return null
  }
  api.advanceAct = () => {
    const state = api.state
    const act = state.acts[state.actIndex]
    chapter.behavior.actReveal(state, act, api)
    if (api.finished) return
    state.actIndex += 1
  }
  api.advanceAgenda = () => {
    const state = api.state
    const agenda = state.agendas[state.agendaIndex]
    chapter.behavior.agendaReveal(state, agenda, api)
    state.agendaIndex += 1
  }
  api.finish = key => { api.finished = key }
  api.addTrauma = (seat, kind, amount) => api.trauma.push({ seat, kind, amount })
  api.damage = (seat, amount) => {
    api.state.investigators[seat].damage += amount
    api.damages.push({ seat, amount, kind: 'damage' })
  }
  api.horror = (seat, amount) => {
    api.state.investigators[seat].horror += amount
    api.damages.push({ seat, amount, kind: 'horror' })
  }
  api.test = (seat, skill, difficulty, resolve) => resolve({ success: false, difficulty, value: 0 })
  api.drawEncounter = () => null
  return api
}

const setup = (count = 1, options = {}) => {
  const state = stateWithScenario(count, options)
  const api = engineishApi()
  api.state = state
  const report = chapter.behavior.setupScenario(state, api)
  return { state, api, report }
}

/** 布置 + 幕 1 背面（塌方）：轨道段地图。引擎在 actReveal 之后把幕指针推进到 2。 */
const caveIn = (count = 1, { plan = planWith(), ...options } = {}) => {
  const { state, api } = setup(count, options)
  state.scenarioFlags.writtenInRockRailPlan = plan
  api.state = state
  chapter.behavior.actReveal(state, state.acts[0], api)
  state.actIndex = Math.min(1, (state.acts || []).length - 1)
  return { state, api }
}

const locationAt = (state, id) => state.locations.find(location => location.id === id)
const cellOf = (state, id) => {
  const cell = gridPosition(state, id)
  return cell ? { x: cell.x, y: cell.y } : null
}
const residentAsset = (state, code) => state.storyAssets.find(asset => asset.code === code)
const setCartLocation = (state, id) => {
  const asset = chapter.behavior.mineCartAsset(state)
  mechanicState(state).vehicles[asset.id].location = id
  for (const inv of state.investigators) {
    if (!inv.defeated) inv.location = id
  }
}

// ---------------------------------------------------------------------------
// 1. 章节结构 / 单卡条目 / gather
// ---------------------------------------------------------------------------
test('P7 writtenInRock 章节结构：22 张单卡条目、5+3 个 gather 组、6 洞穴 + 16 轨道地点', () => {
  assert.equal(chapter.scenario.id, 'writtenInRock')
  assert.equal(chapter.scenario.originalCode, '10501')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.campaignId, 'theFeastOfHemlockVale')
  assert.deepEqual([...chapter.manifest.requiredEncounterGroupIds], ['writtenInRock'])
  assert.equal(chapter.implementedEncounterCodes.length, 22)
  assert.deepEqual([...chapter.implementedEncounterCodes].sort(), [...ENTRY_CODES].sort())
  assert.equal(CAVE_LOCATION_IDS.length, 6)
  assert.equal(RAIL_LOCATION_IDS.length, 16)
  assert.equal(Object.keys(LOCATIONS).length, 22)
  assert.deepEqual([...GATHER_GROUPS].sort(),
    ['chillingCold', 'ghouls', 'horrorsInTheRock', 'refractions', 'writtenInRock'].sort())
  assert.deepEqual(Object.keys(DAY_GATHER_GROUPS).map(Number), [1, 2, 3])
  assert.deepEqual([...ACT_CODES], ['10505', '10506'])
  assert.deepEqual([...AGENDA_CODES], ['10503', '10504'])
  assert.equal(ACT_STAGES[1].stage, '1a')
  assert.equal(AGENDA_STAGES[1].doomThreshold, 5)
  assert.equal(AGENDA_STAGES[2].doomThreshold, 14)
  assert.equal(RESOLUTION_KEYS.length, 8)
  assert.equal(SCENARIO_TEXT.intro.length > 100, true)
  assert.equal(SCENARIO_TEXT.setup.length > 100, true)
  assert.equal(SCENARIO_TEXT.specialRules.length, 3)
  assert.equal(SCENARIO_TEXT.specialRules.every(rule => rule.title && rule.body), true)
  assert.equal(THE_CAVE_IN.theCaveIn4.length > 100, true)
  assert.equal(THE_CAVE_IN.theCaveIn2.length > 50, true)
  assert.equal(THE_CAVE_IN.theCaveIn3.length > 50, true)
  assert.equal(THE_CAVE_IN.proceedToTheCaveIn2.length > 10, true)
  assert.equal(THE_CAVE_IN.skipToTheCaveIn3.length > 10, true)
  assert.equal(THE_CAVE_IN.slidingAndSwappingLocations.body.length > 100, true)
  assert.equal(THE_CAVE_IN.theMineCart.body.length > 100, true)
  assert.equal(SCENARIO_TEXT.tooltips.theUndergroundMaze.slide.length > 10, true)
  assert.equal(SCENARIO_TEXT.tooltips.theUndergroundMaze.prismaticShard.length > 10, true)
  assert.equal(SCENARIO_TEXT.mineCartLabels.facing.length > 0, true)
  assert.equal(Object.keys(SCENARIO_TEXT.codex).length, 4)
  assert.equal(Object.keys(SCENARIO_TEXT.resolutions).length, 8)
  assert.equal(chapter.manifest.recordWrites.includes('simeonSurvived'), true)
})

test('P7 writtenInRock 单卡条目：22 个 scope/实现标记与关键 flags', () => {
  assert.equal(ENTRIES.length, 22)
  for (const entry of ENTRIES) {
    assert.equal(entry.implemented, true, `${entry.code} implemented`)
    assert.ok(['enemy', 'treachery', 'storyAsset', 'location', 'act', 'agenda'].includes(entry.scope), entry.code)
  }
  assert.equal(entry10505.scope, 'act')
  assert.equal(entry10503.scope, 'agenda')
  assert.equal(entry10509.scope, 'location')
  assert.equal(entry10507.scope, 'storyAsset')
  assert.equal(entry10520.scope, 'treachery')
  assert.equal(chapter.implementedEntryFlags('10507').mineCart, true)
  assert.equal(chapter.implementedEntryFlags('10509').cannotBeSlidOrSwapped, true)
  assert.equal(chapter.implementedEntryFlags('10517').healthPerInvestigatorBonus, 3)
  assert.equal(chapter.implementedEntryFlags('10516').shroudByColumn, true)
  assert.equal(entry10512.flags.railIconFaces.length, 2)
  assert.equal(entry10503.abilities.length, 0)
  assert.equal(typeof entry10520.encounterResolve, 'function')
})

// ---------------------------------------------------------------------------
// 2. 遭遇牌库 / 放一边
// ---------------------------------------------------------------------------
test('P7 writtenInRock 遭遇牌库：固定 20 张 + 当日组 3 张，Written in Rock 敌人先放一边', () => {
  assert.equal(ENCOUNTER_DECK.length, 20)
  assert.equal(ENCOUNTER_DECK.filter(code => code === '01160').length, 3, '食尸鬼爪牙 ×3')
  assert.equal(ENCOUNTER_DECK.filter(code => code === '10731').length, 3, '摄魂微光 ×3')
  assert.equal(ENCOUNTER_DECK.includes('10721'), false, '水晶寄生虫放一边')
  assert.equal(ENCOUNTER_DECK.includes('10518'), false, '深掘混种先放一边（塌方后才洗入）')
  for (const day of [1, 2, 3]) {
    const deck = encounterDeckForDay(day)
    assert.equal(deck.length, 23)
    assert.equal(deck.filter(code => dayGroupCards(day).includes(code)).length, 3)
  }
  assert.deepEqual([...new Set(dayGroupCards(1))], ['10676'])
  assert.deepEqual([...new Set(dayGroupCards(2))], ['10678'])
  assert.deepEqual([...new Set(dayGroupCards(3))], ['10680'])
  assert.equal(SET_ASIDE_CARDS.length, 16)
  assert.equal(SET_ASIDE_CARDS.filter(code => code === '10518').length, 3)
  assert.equal(SET_ASIDE_CARDS.filter(code => code === '10521').length, 3)
  assert.equal(SET_ASIDE_CARDS.filter(code => code === '10721').length, 2)
  assert.equal(SET_ASIDE_CARDS.includes(MINE_CART_CODE), true)
  assert.equal(SET_ASIDE_CARDS.includes(PRISMATIC_SHARD_CODE), true)
  const setAside = chapter.manifest.zones.setAside
  const countOf = code => setAside.find(entry => entry.cardCode === code)?.count || 0
  assert.equal(countOf('10512'), 2)
  assert.equal(countOf('10515'), 3)
  assert.equal(countOf('10509'), 1)
  assert.equal(countOf('10518'), 3)
  assert.equal(countOf('10721'), 2)
  assert.equal(countOf(MINE_CART_CODE), 1)
})

test('P7 writtenInRock 布置分区：白天移出地下野兽，夜晚保留放一边', () => {
  const day = setup(2, { records: { day: 1 } })
  assert.equal(day.state.scenarioZones.removedEnemies.includes(SUBTERRANEAN_BEAST_CODE), true)
  assert.equal(day.state.scenarioZones.setAside.includes(SUBTERRANEAN_BEAST_CODE), false)
  const night = setup(2, { records: { day: 1, time: 'night' } })
  assert.equal(night.state.scenarioZones.removedEnemies.includes(SUBTERRANEAN_BEAST_CODE), false)
  assert.equal(night.state.scenarioZones.setAside.includes(SUBTERRANEAN_BEAST_CODE), true)
})

// ---------------------------------------------------------------------------
// 3. 幕 1 布置（洞穴行）
// ---------------------------------------------------------------------------
test('P7 writtenInRock 幕 1 布置：4 张洞穴占列 1–4、控制站在 (5,1)、每处 1 个碎片', () => {
  const { state } = setup(2, { records: { day: 1 } })
  assert.equal(state.locations.length, 5)
  const caves = state.locations.filter(location => location.cave)
  assert.equal(caves.length, 4)
  assert.deepEqual(caves.map(cave => cellOf(state, cave.id).x), [1, 2, 3, 4])
  assert.equal(caves.every(cave => cellOf(state, cave.id).y === 1), true)
  assert.equal(caves.every(cave => cave.revealed === true), true)
  assert.deepEqual(cellOf(state, 'controlStation'), { x: 5, y: 1 })
  assert.equal(state.locations.every(location => location.resources === 1), true)
  const start = chapter.behavior.startLocation(state)
  assert.equal(cellOf(state, start).x, 1)
  assert.equal(state.investigators.every(inv => inv.location === start), true)
  assert.equal(state.encounterDeck.length, 23)
  assert.equal(caves[0].connections.includes(caves[1].id), true)
  assert.equal(caves[3].connections.includes('controlStation'), true)
  assert.deepEqual(locationAt(state, 'controlStation').connections, [caves[3].id])
})

test('P7 writtenInRock 居民：第 1 日瑞玟在列 3，席米恩放一边；第 3 日莉亚放一边；夜晚不收集', () => {
  const day1 = setup(1, { records: { day: 1 } })
  const river = residentAsset(day1.state, RESIDENT_ASSETS.river)
  assert.ok(river)
  assert.deepEqual(cellOf(day1.state, river.location), { x: 3, y: 1 })
  assert.deepEqual(day1.state.scenarioZones.setAsideResidents, [RESIDENT_ASSETS.simeon])
  const day3 = setup(1, { records: { day: 3 } })
  assert.deepEqual(day3.state.scenarioZones.setAsideResidents, [RESIDENT_ASSETS.leah])
  assert.equal(day3.state.storyAssets.some(asset => asset.code === RESIDENT_ASSETS.river), false)
  const night = setup(1, { records: { day: 2, time: 'night' } })
  assert.deepEqual(night.state.scenarioZones.setAsideResidents, [])
  assert.equal(night.state.storyAssets.some(asset => asset.code === RESIDENT_ASSETS.river), false)
})

// ---------------------------------------------------------------------------
// 4. 幕间「塌方」：轨道段地图与矿车
// ---------------------------------------------------------------------------
test('P7 writtenInRock 塌方：幕 1 背面移除洞穴、留 2 线索、跳议程 2a、碎片转道岔、15 轨道地点入场', () => {
  const { state, api } = setup(2, { records: { day: 1 } })
  state.scenarioFlags.writtenInRockRailPlan = planWith()
  api.state = state
  for (const inv of state.investigators) inv.clues = 5
  addMarker(state, 'scrap', 2)
  assert.equal(chapter.behavior.actReveal(state, state.acts[0], api), true)
  assert.equal(state.locations.some(location => location.cave), false, '洞穴全部移除')
  assert.equal(state.investigators.every(inv => inv.clues === 2), true)
  assert.equal(state.agendaIndex, 1, '幕 1 背面直接把议程推进到 2a')
  assert.equal(markerCountOf(state, 'scrap'), 0)
  assert.equal(markerCountOf(state, 'switch'), 3, '2 个碎片 + 塌方第 4 步的 1 个道岔')
  assert.equal(state.locations.filter(location => location.rail).length, 16)
  assert.deepEqual(cellOf(state, 'controlStation'), { x: 1, y: 1 })
  assert.deepEqual(cellOf(state, 'railExit'), { x: 5, y: 5 })
  const cart = chapter.behavior.mineCartVehicle(state)
  assert.ok(cart)
  assert.equal(cart.location, 'controlStation')
  assert.deepEqual(cart.passengers, [0, 1])
  assert.equal(state.investigators.every(inv => inv.location === 'controlStation'), true)
  const simeon = residentAsset(state, RESIDENT_ASSETS.simeon)
  assert.equal(cellOf(state, simeon.location).x, 2)
  assert.equal(cellOf(state, simeon.location).y, 4, '席米恩在列 2 最上方')
  const shard = residentAsset(state, PRISMATIC_SHARD_CODE)
  assert.equal(cellOf(state, shard.location).x, 4)
  assert.equal(cellOf(state, shard.location).y, 1, '棱柱碎片在列 4 最下方')
  assert.equal(state.encounterDeck.length, 23 + 11, '11 张 Written in Rock 遭遇卡洗回')
  assert.equal(state.encounterDeck.filter(code => code === '10518').length, 3)
  assert.equal(state.encounterDeck.includes('10520'), true)
  assert.equal(locationAt(state, 'sunkenRailB').revealed, false, '轨道隧道入场时未揭示')
  // 轨道连接：只连对齐的轨道图标。
  const controlLinks = [...locationAt(state, 'controlStation').connections]
  assert.deepEqual(controlLinks.sort(), ['leftTurnB', 'sunkenRailB'].sort())
  assert.equal(locationAt(state, 'sunkenRailB').connections.includes('controlStation'), true)
  assert.deepEqual(locationAt(state, 'railExit').connections, [])
  assert.deepEqual(locationAt(state, 'warpedRailA').connections, [])
})

test('P7 writtenInRock 塌方（夜晚）：地下野兽在控制站横置，其余 Written in Rock 卡洗入', () => {
  const { state } = caveIn(1, { records: { day: 2, time: 'night' } })
  const beast = state.enemies.find(enemy => enemy.code === SUBTERRANEAN_BEAST_CODE)
  assert.ok(beast, '夜晚地下野兽在控制站生成')
  assert.equal(beast.location, 'controlStation')
  assert.equal(beast.exhausted, true)
  assert.equal(state.encounterDeck.includes(SUBTERRANEAN_BEAST_CODE), false, '野兽不进遭遇牌库')
  assert.equal(state.encounterDeck.filter(code => code === '10521').length, 3)
})

// ---------------------------------------------------------------------------
// 5. 矿车移动 / 脱轨 / 道岔
// ---------------------------------------------------------------------------
test('P7 writtenInRock 矿车：沿对齐轨道移动、全员随车、进入后揭示；脱轨击败全员并给肉体创伤', () => {
  const { state, api } = caveIn(2)
  api.state = state
  assert.equal(chapter.behavior.mineCartFacing(state), 'north')
  const exits = chapter.behavior.cartExits(state)
  assert.deepEqual(exits.map(entry => entry.id), ['sunkenRailB'])
  const moved = chapter.behavior.moveMineCartOnce(state, api)
  assert.equal(moved.moved, true)
  assert.equal(moved.location, 'sunkenRailB')
  assert.equal(chapter.behavior.mineCartLocation(state), 'sunkenRailB')
  assert.equal(state.investigators.every(inv => inv.location === 'sunkenRailB'), true, '全员随车移动')
  assert.equal(locationAt(state, 'sunkenRailB').revealed, true, '进入后揭示')
  // 脱轨：北面换成缺南口的左转弯B（与 (2,1) 的沉没隧道B 互换）。
  const derail = caveIn(2, { plan: planWith({ '1,2': 'leftTurnB', '2,1': 'sunkenRailB' }) })
  derail.api.state = derail.state
  assert.deepEqual(chapter.behavior.cartExits(derail.state), [])
  const result = chapter.behavior.moveMineCartOnce(derail.state, derail.api)
  assert.equal(result.derailed, true)
  assert.equal(derail.state.investigators.every(inv => inv.defeated === true), true)
  assert.deepEqual(derail.api.trauma.map(row => [row.seat, row.kind, row.amount]),
    [[0, 'physical', 1], [1, 'physical', 1]])
})

test('P7 writtenInRock 道岔：花费 1 个道岔取消移动 / 再移动一次（团队每阶段最多 2 次）', () => {
  // 北面 (1,3) 放轨道桥梁（北/南），两次移动都不会脱轨。
  const { state } = caveIn(1, { plan: planWith({ '1,3': 'railBridge', '5,3': 'warpedRailA' }) })
  // 塌方第 4 步给 1 个道岔；再加 2 个（共 3）。
  addMarker(state, 'switch', 2)
  const api = engineishApi()
  api.state = state
  let asked = 0
  api.choose = () => { asked += 1; return 'cancel' }
  const results = chapter.behavior.moveMineCart(state, api, { times: 1 })
  assert.equal(asked, 1)
  assert.deepEqual(results, [{ cancelled: true }])
  assert.equal(markerCountOf(state, 'switch'), 2)
  assert.equal(chapter.behavior.mineCartLocation(state), 'controlStation', '取消后矿车未移动')
  // 「再移动一次」= 触发移动照常 + 额外一次。
  const api2 = engineishApi()
  api2.state = state
  api2.choose = () => 'again'
  chapter.behavior.moveMineCart(state, api2, { times: 1 })
  assert.equal(markerCountOf(state, 'switch'), 1)
  assert.equal(chapter.behavior.mineCartLocation(state), 'railBridge')
})

test('P7 writtenInRock 地下野兽：准备中与矿车同处时矿车不能移动；+3/人生命；耗线索横置', () => {
  const { state } = caveIn(2, { records: { day: 1, time: 'night' } })
  const beast = state.enemies.find(enemy => enemy.code === SUBTERRANEAN_BEAST_CODE)
  assert.equal(chapter.behavior.enemyStatModifier(state, beast, 'health'), 6, '2 人局 +6 生命')
  beast.exhausted = false
  assert.equal(chapter.behavior.mineCartBlocked(state), true)
  const api = engineishApi()
  api.state = state
  const before = chapter.behavior.mineCartLocation(state)
  const result = chapter.behavior.moveMineCartOnce(state, api)
  assert.equal(result.blocked, true)
  assert.equal(chapter.behavior.mineCartLocation(state), before)
  const inv = state.investigators[0]
  inv.location = 'controlStation'
  inv.clues = 4
  const move = chapter.behavior.actions(state, inv).find(item => item.rule === 'writtenInRockExhaustBeast')
  assert.ok(move)
  assert.equal(chapter.behavior.performAction(state, inv, move, api), true)
  assert.equal(beast.exhausted, true)
  assert.equal(inv.clues, 2)
  assert.equal(mechanicState(state).defenses.cannotReady[beast.id], state.round)
})

// ---------------------------------------------------------------------------
// 6. 地点连接 / 滑动交换 / 地点行动
// ---------------------------------------------------------------------------
test('P7 writtenInRock 轨道连接：只连「互为对方方向」的相邻地点，未对齐不连', () => {
  const { state } = caveIn(1)
  // 控制站 (1,1) 北/东：北 → 沉没隧道B(南)，东 → 左转弯B(西)。
  assert.deepEqual([...locationAt(state, 'controlStation').connections].sort(), ['leftTurnB', 'sunkenRailB'].sort())
  // 沉没隧道B (1,2) 北/东/南：南 → 控制站(北)，东 → 岔路(西)，北 → 扭曲轨道A(无南)。
  const railB = locationAt(state, 'sunkenRailB')
  assert.equal(railB.connections.includes('controlStation'), true)
  assert.equal(railB.connections.includes('forkedRailA'), true)
  assert.equal(railB.connections.includes('warpedRailA'), false)
  // 轨道出口 (5,5) 南：南面 (5,4) 是空格 → 未连接（需要滑动接轨）。
  assert.deepEqual(locationAt(state, 'railExit').connections, [])
})

test('P7 writtenInRock 滑动/交换：空格限定 5×4、轨道出口不可动、带剧情资产的地点不可动', () => {
  const { state } = caveIn(1)
  assert.equal(chapter.behavior.canBeSlidOrSwapped(state, 'railExit'), false)
  assert.deepEqual(chapter.behavior.emptyAdjacentSpaces(state, 'railExit'), [{ x: 5, y: 4 }])
  // 控制站上有矿车（剧情资产）→ 不能被交换；换成两张普通轨道隧道。
  assert.equal(chapter.behavior.swapAdjacentLocations(state, 'controlStation', 'sunkenRailB'), false)
  assert.equal(chapter.behavior.swapAdjacentLocations(state, 'sunkenRailB', 'forkedRailA'), true)
  assert.deepEqual(cellOf(state, 'sunkenRailB'), { x: 2, y: 2 })
  assert.deepEqual(cellOf(state, 'forkedRailA'), { x: 1, y: 2 })
  const shard = residentAsset(state, PRISMATIC_SHARD_CODE)
  assert.equal(chapter.behavior.canBeSlidOrSwapped(state, shard.location), false)
  assert.equal(chapter.behavior.slideLocation(state, shard.location, 4, 2), false)
})

test('P7 writtenInRock 幕 2 行动：快滑/快换、付费滑动、取棱柱碎片、控制站交换', () => {
  const { state } = caveIn(2)
  const inv = state.investigators[0]
  inv.location = 'controlStation'
  inv.clues = 4
  inv.resources = 6
  const api = engineishApi()
  api.state = state
  const moves = chapter.behavior.actions(state, inv)
  assert.equal(moves.some(move => move.rule === 'writtenInRockFastSlideSwap'), true)
  assert.equal(moves.some(move => move.rule === 'writtenInRockPaidSlide'), true)
  assert.equal(moves.some(move => move.rule === 'writtenInRockStationSwap'), true)
  const stationSwap = moves.find(move => move.rule === 'writtenInRockStationSwap')
  assert.equal(chapter.behavior.performAction(state, inv, stationSwap, api), true)
  assert.equal(chapter.behavior.actions(state, inv).some(move => move.rule === 'writtenInRockStationSwap'), false)
  const shard = residentAsset(state, PRISMATIC_SHARD_CODE)
  inv.location = shard.location
  const take = chapter.behavior.actions(state, inv).find(move => move.rule === 'writtenInRockTakeShard')
  assert.ok(take)
  assert.equal(chapter.behavior.performAction(state, inv, take, api), true)
  assert.equal(shard.controllerSeat, 0)
})

test('P7 writtenInRock 幕 1 议程行动：勘察把所在地点的碎片移到参考卡', () => {
  const { state } = setup(1, { records: { day: 1 } })
  const inv = state.investigators[0]
  const api = engineishApi()
  api.state = state
  assert.equal(chapter.behavior.currentActCode(state), '10505')
  const move = chapter.behavior.actions(state, inv).find(item => item.rule === 'writtenInRockSurvey')
  assert.ok(move)
  const before = locationAt(state, inv.location).resources
  assert.equal(chapter.behavior.performAction(state, inv, move, api), true)
  assert.equal(locationAt(state, inv.location).resources, before - 1)
  assert.equal(markerCountOf(state, 'scrap'), 1)
})

test('P7 writtenInRock 左/右转弯：A 面 [action][action] 交换、B 面 [action] 花 2 资源滑动（各每局一次）', () => {
  const { state } = caveIn(1)
  const api = engineishApi()
  api.state = state
  // 10510a 左转弯A：两个行动交换 2 个相邻[[轨道]]地点。
  const swapInv = state.investigators[0]
  swapInv.location = 'leftTurnA'
  const swapMove = chapter.behavior.actions(state, swapInv)
    .find(move => move.rule.startsWith('writtenInRockTurnSwap:leftTurnA:'))
  assert.ok(swapMove, '左转弯A 的交换行动')
  assert.equal(swapMove.actions, 2)
  assert.equal(chapter.behavior.performAction(state, swapInv, swapMove, api), true)
  assert.equal(chapter.behavior.actions(state, swapInv)
    .some(move => move.rule.startsWith('writtenInRockTurnSwap:leftTurnA:')), false, '每局一次')
  // 10510b 左转弯B：花 2 资源把已揭示地点滑入相邻空格。
  chapter.behavior.revealRailLocation(state, 'warpedRailA', api)
  const slideInv = state.investigators[1] || swapInv
  slideInv.location = 'leftTurnB'
  slideInv.resources = 5
  const slideMove = chapter.behavior.actions(state, slideInv)
    .find(move => move.rule.startsWith('writtenInRockTurnSlide:leftTurnB:'))
  assert.ok(slideMove, '左转弯B 的滑动行动')
  assert.equal(chapter.behavior.performAction(state, slideInv, slideMove, api), true)
  assert.equal(slideInv.resources, 3)
  assert.equal(chapter.behavior.actions(state, slideInv)
    .some(move => move.rule.startsWith('writtenInRockTurnSlide:leftTurnB:')), false, '每局一次')
})

// ---------------------------------------------------------------------------
// 7. 幕 / 议程
// ---------------------------------------------------------------------------
test('P7 writtenInRock 幕 1 目标：轮末全员在控制站 → 推进幕 1 并进入塌方', () => {
  const { state, api } = setup(2, { records: { day: 1 } })
  state.scenarioFlags.writtenInRockRailPlan = planWith()
  api.state = state
  for (const inv of state.investigators) inv.location = 'controlStation'
  assert.equal(chapter.behavior.roundEnded(state, api), true)
  assert.equal(state.actIndex, 1)
  assert.equal(state.scenarioFlags.writtenInRockCaveInDone, true)
  assert.equal(state.locations.filter(location => location.rail).length, 16)
})

test('P7 writtenInRock 议程 1 背面（塌方）：2 伤害、失去全部线索、存活者到控制站、推进幕 1', () => {
  const { state, api } = setup(2, { records: { day: 1 } })
  state.scenarioFlags.writtenInRockRailPlan = planWith()
  api.state = state
  const [inv0, inv1] = state.investigators
  inv0.clues = 3
  inv0.assets = [{ id: 'ally-1', code: '01001', traits: ['Ally'], damage: 0, horror: 0 }]
  assert.equal(chapter.behavior.agendaReveal(state, state.agendas[0], api), true)
  assert.equal(inv0.damage, 2)
  assert.equal(inv0.assets[0].damage, 1, '盟友支援 1 点直接伤害')
  assert.equal(inv0.clues, 0)
  assert.equal(inv0.location, 'controlStation')
  assert.equal(inv1.location, 'controlStation')
  assert.equal(state.actIndex, 1, '议程背面推进幕 1（幕 1 背面随即进入塌方）')
  assert.equal(state.scenarioFlags.writtenInRockCaveInDone, true)
})

test('P7 writtenInRock 议程 2 背面（彻底崩塌）：每位存活调查员被击败并承受 1 点肉体创伤', () => {
  const { state, api } = setup(2, { records: { day: 1 } })
  api.state = state
  state.agendas = [structuredClone(scenario.agendas[1])]
  state.agendaIndex = 0
  chapter.behavior.agendaReveal(state, state.agendas[0], api)
  assert.equal(state.investigators.every(inv => inv.defeated === true), true)
  assert.deepEqual(api.trauma.map(row => row.kind), ['physical', 'physical'])
})

test('P7 writtenInRock 幕 2 背面：按席米恩/莉亚的控制权进入结局 1–5', () => {
  const cases = [
    [{ day: 1 }, state => { residentAsset(state, RESIDENT_ASSETS.simeon).controllerSeat = 0 }, 'resolution1'],
    [{ day: 3 }, state => { residentAsset(state, RESIDENT_ASSETS.leah).controllerSeat = 1 }, 'resolution2'],
    [{ day: 1 }, () => {}, 'resolution3'],
    [{ day: 3 }, () => {}, 'resolution4'],
    [{ day: 1 }, state => {
      state.storyAssets = state.storyAssets.filter(asset => ![
        RESIDENT_ASSETS.simeon, RESIDENT_ASSETS.leah,
      ].includes(asset.code))
      state.scenarioZones.setAsideResidents = []
    }, 'resolution5'],
  ]
  for (const [records, prepare, expected] of cases) {
    const { state, api } = setup(2, { records })
    api.state = state
    state.acts = [structuredClone(scenario.acts[1])]
    state.actIndex = 0
    prepare(state)
    chapter.behavior.actReveal(state, state.acts[0], api)
    assert.equal(api.finished, expected, `结局分支 ${expected}`)
  }
})

// ---------------------------------------------------------------------------
// 8. 混乱标记
// ---------------------------------------------------------------------------
test('P7 writtenInRock 混乱标记：[skull] 取列号（困难 ×2），幕 1/2 的其余符号数值', () => {
  const { state } = setup(2, { records: { day: 1 } })
  const inv = state.investigators[0]
  const cave = state.locations.find(location => location.cave)
  inv.location = cave.id
  assert.equal(columnOf(state, cave.id), 1)
  assert.equal(writtenInRockChaosTokenValue(state, 'skull', inv), -1)
  assert.equal(writtenInRockChaosTokenValue(state, 'cultist', inv), -1)
  assert.equal(writtenInRockChaosTokenValue(state, 'tablet', inv), -2)
  assert.equal(writtenInRockChaosTokenValue(state, 'elderthing', inv), -3)
  state.difficulty = 'hard'
  assert.equal(writtenInRockChaosTokenValue(state, 'skull', inv), -2)
  assert.equal(writtenInRockChaosTokenValue(state, 'cultist', inv), -3)
  assert.equal(writtenInRockChaosTokenValue(state, 'tablet', inv), -4)
  assert.equal(writtenInRockChaosTokenValue(state, 'elderthing', inv), -5)
  assert.equal(writtenInRockChaosTokenValue(state, 'frost', inv), null, '未知标记交回默认表')
  state.difficulty = 'standard'
  state.acts = [structuredClone(scenario.acts[1])]
  state.actIndex = 0
  assert.equal(currentActStep(state), 2)
  const token = writtenInRockChaosToken(state, inv, 'tablet')
  assert.equal(token.delta, -3)
  assert.deepEqual(token.onFail, [{ type: 'scenarioToken', token: 'tablet', mode: 'fail', marker: 'switch' }])
  assert.equal(WRITTEN_IN_ROCK_TOKEN_MEANINGS.standard.cultist.delta, -1)
  assert.equal(WRITTEN_IN_ROCK_TOKEN_MEANINGS.hard.skull.hard, true)
})

test('P7 writtenInRock 混乱标记效果：cultist 放碎片/道岔、tablet 移除碎片/移动矿车、elderthing 伤害/移除道岔', () => {
  const { state } = setup(1, { records: { day: 1 } })
  const inv = state.investigators[0]
  const api = engineishApi()
  api.state = state
  chapter.behavior.applyTokenEffect(state, inv, { token: 'cultist', marker: 'scrap' }, api)
  assert.equal(markerCountOf(state, 'scrap'), 1)
  chapter.behavior.applyTokenEffect(state, inv, { token: 'tablet', marker: 'scrap' }, api)
  assert.equal(markerCountOf(state, 'scrap'), 0)
  chapter.behavior.applyTokenEffect(state, inv, { token: 'elderthing', marker: 'scrap' }, api)
  assert.equal(inv.damage, 1)
  const { state: rail, api: railApi } = caveIn(1)
  railApi.state = rail
  addMarker(rail, 'switch', 2)
  const railInv = rail.investigators[0]
  chapter.behavior.applyTokenEffect(rail, railInv, { token: 'cultist', marker: 'switch' }, railApi)
  assert.equal(markerCountOf(rail, 'switch'), 4)
  chapter.behavior.applyTokenEffect(rail, railInv, { token: 'elderthing', marker: 'switch' }, railApi)
  assert.equal(markerCountOf(rail, 'switch'), 3)
  chapter.behavior.applyTokenEffect(rail, railInv, { token: 'tablet', marker: 'switch' }, railApi)
  assert.equal(chapter.behavior.mineCartLocation(rail), 'sunkenRailB')
})

// ---------------------------------------------------------------------------
// 9. 敌人 / 诡计 / 地点
// ---------------------------------------------------------------------------
test('P7 writtenInRock 发狂矿工：战斗/躲避 = 列号；攻击后同地点其他调查员与居民各 1 伤害', () => {
  const { state, api } = setup(2, { records: { day: 1 } })
  api.state = state
  const location = state.locations.find(item => item.cave && gridPosition(state, item.id)?.x === 3)
  const enemy = {
    id: 'miner-1', code: '10519', originalCode: '10519', name: '发狂矿工', location: location.id,
    fight: -2, evade: -2, health: 4, damage: 1, horror: 0, traits: ['Humanoid'], exhausted: false,
  }
  assert.equal(chapter.behavior.enemyStatModifier(state, enemy, 'fight'), 5)
  assert.equal(enemy.fight + chapter.behavior.enemyStatModifier(state, enemy, 'fight'), 3)
  state.investigators[0].location = location.id
  state.investigators[1].location = location.id
  state.storyAssets.push({ id: 'resident-x', code: '10699', originalCode: '10699', traits: ['Resident'], location: location.id })
  chapter.behavior.enemyAttackResolved(state, enemy, state.investigators[0], api)
  assert.equal(state.investigators[1].damage, 1)
  assert.equal(state.storyAssets.find(asset => asset.id === 'resident-x').damage, 1)
})

test('P7 writtenInRock 深掘混种：入场后滑动矿车朝向的地点；无空格时与其相邻地点交换', () => {
  const { state, api } = caveIn(1)
  api.state = state
  const hybrid = { id: 'hybrid-1', code: '10518', originalCode: '10518', name: '深掘混种', location: 'railExit', traits: ['Creature', 'Mutated'] }
  chapter.behavior.enemySpawned(state, hybrid, api)
  // (1,2) 四周都被占；控制站上有矿车（剧情资产）不能动 → 与（可动的）岔路交换。
  assert.deepEqual(cellOf(state, 'sunkenRailB'), { x: 2, y: 2 })
  assert.deepEqual(cellOf(state, 'forkedRailA'), { x: 1, y: 2 })
  assert.deepEqual(cellOf(state, 'controlStation'), { x: 1, y: 1 })
})

test('P7 writtenInRock 塌方诡计：附属到矿车朝向地点；矿车将进入时取消移动并造成 2 伤害', () => {
  const { state, api } = caveIn(2)
  api.state = state
  const card = { code: CAVE_IN_CODE, originalCode: CAVE_IN_CODE, name: '塌方' }
  const bridge = { resolveScenarioEvent: (id, payload) => chapter.behavior.events[id](state, payload, api) }
  assert.equal(entry10520.encounterResolve(state, state.investigators[0], card, bridge), true)
  const attached = locationAt(state, 'sunkenRailB')
  assert.equal((attached.attachments || []).some(item => item.code === CAVE_IN_CODE), true)
  const result = chapter.behavior.moveMineCartOnce(state, api)
  assert.equal(result.cancelled, true)
  assert.equal(state.investigators.every(inv => inv.damage === 2), true)
  assert.equal(chapter.behavior.mineCartLocation(state), 'controlStation')
  // 丢弃检定：相邻地点的调查员可触发；成功后弃掉塌方。
  const inv = state.investigators[0]
  inv.location = 'controlStation'
  const move = chapter.behavior.actions(state, inv).find(item => item.rule === 'writtenInRockCaveInTest:sunkenRailB')
  assert.ok(move)
  const successApi = engineishApi()
  successApi.state = state
  successApi.test = (seat, skill, difficulty, resolve) => resolve({ success: true, difficulty, value: 5 })
  assert.equal(chapter.behavior.performAction(state, inv, move, successApi), true)
  assert.equal(locationAt(state, 'sunkenRailB').attachments.some(item => item.code === CAVE_IN_CODE), false)
  assert.equal(state.encounterDiscard.includes(CAVE_IN_CODE), true)
})

test('P7 writtenInRock 急速狂飙：敏捷（5）失败进入威胁区；矿车移动时结算并弃掉', () => {
  const { state, api } = caveIn(1)
  api.state = state
  const inv = state.investigators[0]
  const card = { code: WILD_RIDE_CODE, originalCode: WILD_RIDE_CODE, name: '急速狂飙' }
  const bridge = { resolveScenarioEvent: (id, payload) => chapter.behavior.events[id](state, payload, api) }
  assert.equal(entry10521.encounterResolve(state, inv, card, bridge), true)
  assert.equal(inv.threat.some(item => item.code === WILD_RIDE_CODE), true)
  chapter.behavior.moveMineCartOnce(state, api)
  assert.equal(inv.threat.some(item => item.code === WILD_RIDE_CODE), false)
  assert.equal(inv.discard.includes(WILD_RIDE_CODE), true)
})

test('P7 writtenInRock 沉没隧道/扭曲隧道：揭示时弃牌到敌人；矿车进入扭曲隧道后再移动一次', () => {
  const { state, api } = caveIn(1, {
    plan: planWith({ '1,3': 'warpedRailB', '1,4': 'railBridge', '5,3': 'warpedRailA' }),
  })
  api.state = state
  state.encounterDeck = ['10722', '10721', '10723']
  assert.equal(chapter.behavior.revealRailLocation(state, 'sunkenRailA', api), true)
  assert.equal(state.encounterDeck.length, 1, '弃到敌人为止')
  assert.equal(state.encounterDiscard.includes('10723'), true, '引擎从牌库顶（数组末尾）弃牌')
  assert.equal(state.enemies.length, 1, '队长抽取弃出的敌人')
  // 扭曲隧道：进入后再移动一次（沉没隧道B → 扭曲隧道B → 轨道桥梁）。
  mechanicState(state).rail.facing = 'south'
  setCartLocation(state, 'sunkenRailB')
  state.enemies = []
  const result = chapter.behavior.moveMineCartOnce(state, api)
  assert.equal(result.moved, true)
  assert.equal(chapter.behavior.mineCartLocation(state), 'railBridge', '扭曲隧道追加一次移动')
})

test('P7 writtenInRock 轮末地点：碱性轨道恐惧、轨道岔路移除道岔、轨道桥梁帷幕与道岔行动', () => {
  const { state } = caveIn(1)
  const api = engineishApi()
  api.state = state
  chapter.behavior.revealRailLocation(state, 'alkalineRailA', api)
  chapter.behavior.revealRailLocation(state, 'railBridge', api)
  const inv = state.investigators[0]
  addMarker(state, 'switch', 2)
  setCartLocation(state, 'forkedRailA')
  inv.location = 'alkalineRailA'
  chapter.behavior.roundEnded(state, api)
  assert.equal(inv.horror, 1, '碱性轨道：1 点恐惧')
  assert.equal(markerCountOf(state, 'switch'), 2, '轨道岔路：轮末移除 1 个道岔')
  const bridge = locationAt(state, 'railBridge')
  assert.equal(chapter.behavior.locationShroudModifier(state, bridge), 5)
  inv.location = 'railBridge'
  inv.resources = 5
  const move = chapter.behavior.actions(state, inv).find(item => item.rule === 'writtenInRockRailBridgeSwitch')
  assert.ok(move)
  const before = markerCountOf(state, 'switch')
  assert.equal(chapter.behavior.performAction(state, inv, move, api), true)
  assert.equal(markerCountOf(state, 'switch'), before + 1)
  assert.equal(inv.resources, 4)
})

test('P7 writtenInRock 法典：莉亚/席米恩控制权与道岔、罗莎·马奎兹（幕 2 交换）', () => {
  const { state } = caveIn(1)
  const api = engineishApi()
  api.state = state
  const simeon = residentAsset(state, RESIDENT_ASSETS.simeon)
  assert.ok(simeon)
  assert.equal(chapter.behavior.codexRead(state, { id: 'simeonAtwood', seat: 0 }, api), true)
  assert.equal(simeon.controllerSeat, 0)
  const switches = markerCountOf(state, 'switch')
  chapter.behavior.codexRead(state, { id: 'simeonAtwood', seat: 0 }, api)
  assert.equal(markerCountOf(state, 'switch'), switches + 2, '已有控制者 → 2 个道岔')
  const before = JSON.stringify(Object.fromEntries(state.locations.map(location => [location.id, cellOf(state, location.id)])))
  assert.equal(chapter.behavior.codexRead(state, { id: 'drRosaMarquez', seat: 0 }, api), true)
  const after = JSON.stringify(Object.fromEntries(state.locations.map(location => [location.id, cellOf(state, location.id)])))
  assert.notEqual(before, after, '法典 Θ（幕 2）：交换 2 个相邻地点')
})

// ---------------------------------------------------------------------------
// 10. 结局与战役记录
// ---------------------------------------------------------------------------
test('P7 writtenInRock 结局 1–5：剧本日志、关系等级、奖励经验与结局 6 结算', () => {
  const expectations = [
    ['resolution1', { record: 'simeonSurvived', relationship: ['simeonAtwoodRelationship', 2], bonus: 2 }],
    ['resolution2', { record: 'leahSawSomethingInTheMine', relationship: ['leahAtwoodRelationship', 1], bonus: 2 }],
    ['resolution3', { record: 'simeonDisappeared', crossed: 'simeonCrossedOut', bonus: 0 }],
    ['resolution4', { record: 'leahAndSimeonWereReunited', crossed: 'leahCrossedOut', bonus: 0 }],
    ['resolution5', { record: 'theInvestigatorsSurvivedTheHorrorsInTheRock', bonus: 0 }],
  ]
  for (const [key, expected] of expectations) {
    const api = engineishApi()
    const { state } = setup(2, { records: { day: 1 } })
    api.state = state
    const result = chapter.behavior.resolution(state, key, [], api)
    const records = state.campaign.records
    assert.equal(result.resolution, key)
    assert.equal(records.writtenInRockResolution, key)
    assert.equal(records.writtenInRockTimes, 1)
    assert.equal(records[expected.record], true, `${key} 记录 ${expected.record}`)
    if (expected.relationship) assert.equal(records[expected.relationship[0]], expected.relationship[1])
    if (expected.crossed) assert.equal(records[expected.crossed], true)
    assert.equal(records.areaNorthPointMineSurveyed, true, '结局 6：北角矿坑记入已勘察区域')
    assert.equal(result.bonus, expected.bonus)
  }
})

test('P7 writtenInRock 结局 6：帮助瑞玟（控制 + 至少 2/人线索）、棱柱碎片入牌库', () => {
  const api = engineishApi()
  const { state } = setup(2, { records: { day: 1 } })
  api.state = state
  residentAsset(state, RESIDENT_ASSETS.river).controllerSeat = 0
  state.storyAssets.push({ id: 'shard-x', code: PRISMATIC_SHARD_CODE, originalCode: PRISMATIC_SHARD_CODE, controllerSeat: 0, location: null })
  for (const inv of state.investigators) inv.clues = 2
  const result = chapter.behavior.resolution(state, 'resolution5', [], api)
  assert.equal(state.campaign.records.riverHawthorneHelped, true)
  assert.equal(state.campaign.records.riverHawthorneRelationship, 1)
  assert.equal(state.campaign.records.prismaticShardToDeck, true)
  assert.equal(result.bonus, 1, '帮助瑞玟 +1 奖励经验')
  const second = setup(2, { records: { day: 1 } })
  residentAsset(second.state, RESIDENT_ASSETS.river).controllerSeat = 1
  const secondApi = engineishApi()
  secondApi.state = second.state
  chapter.behavior.resolution(second.state, 'resolution5', [], secondApi)
  assert.equal(second.state.campaign.records.riverHawthorneRelationship, -1)
})

test('P7 writtenInRock 无结局：白天 1/2 → 结局 3，白天 3 → 结局 4，夜晚 → 结局 6 并划掉席米恩', () => {
  const cases = [
    [{ day: 1 }, 'resolution3'],
    [{ day: 2, time: 'day' }, 'resolution3'],
    [{ day: 3 }, 'resolution4'],
    [{ day: 1, time: 'night' }, 'resolution6'],
  ]
  for (const [records, expected] of cases) {
    const api = engineishApi()
    const { state } = setup(1, { records })
    api.state = state
    const result = chapter.behavior.resolution(state, 'noResolution', [], api)
    assert.equal(result.resolution, expected, `无结局 ${JSON.stringify(records)} → ${expected}`)
    if (expected === 'resolution6') assert.equal(state.campaign.records.simeonCrossedOut, true)
    if (expected === 'resolution4') assert.equal(state.campaign.records.leahCrossedOut, true)
  }
})

test('P7 writtenInRock JSON 往返：塌方后存储，恢复后继续移动矿车与结算', () => {
  const { state } = caveIn(2)
  const restored = clone(state)
  assert.equal(restored.scenario.id, 'writtenInRock')
  assert.equal(chapter.behavior.mineCartLocation(restored), 'controlStation')
  assert.equal(markerCountOf(restored, 'switch'), 1)
  const api = engineishApi()
  api.state = restored
  chapter.behavior.moveMineCartOnce(restored, api)
  assert.equal(chapter.behavior.mineCartLocation(restored), 'sunkenRailB')
  chapter.behavior.resolution(restored, 'resolution1', [], api)
  assert.equal(restored.campaign.records.simeonSurvived, true)
  assert.equal(restored.campaign.records.writtenInRockTimes, 1)
})
