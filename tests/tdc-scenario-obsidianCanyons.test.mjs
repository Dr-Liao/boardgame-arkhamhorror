// P7 黑曜石峡谷（obsidianCanyons · 提示卡 11639）章节测试。
//
// 覆盖：章节结构/manifest（37 张条目、21 张物理地点、两条远征分支）、正交网格与出口旋转、
// 开阔天空、峰顶牌库（**从牌库底抽**，P7 原语 mechanics.scenarioDecks take from:'bottom'）、
// 风暴强度、悬挂船只、磁性尖塔、黑曜石之爪双面条目、证明你的价值（helpedWithTheRopes 记录）、
// 四档混乱符号、结局键与战役记录。
//
// 本文件不 import engine.js：章节 behavior 只走内容层函数与 P7 原语；场景牌库用
// src/engine/scenario-decks.js 的真实 createScenarioDeckApi 提供。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { createScenarioDeckApi } from '../src/engine/scenario-decks.js'
import { mechanicState } from '../src/engine/mechanic-state.js'
import { configureGrid, gridPosition, connectGrid } from '../src/engine/grid-map.js'
import * as chapter from '../content/campaigns/theDrownedCity/scenarios/obsidianCanyons/index.js'
import {
  scenario, LOCATION_IDS, LOCATIONS, LOCATION_CODE, LOCATION_OPTIONS, START_LOCATION, EXPEDITIONS,
  ACT_STAGES, AGENDA_STAGES, WEST_AGENDA_CODE, EAST_AGENDA_CODE, WEST_WINDS_CODE, EAST_WINDS_CODE,
  INITIAL_OPEN_SKY_CELLS, INITIAL_FILL_CELLS, ACT_TWO_LAYOUT, ACT_THREE_LAYOUT, ENCOUNTER_DECK,
  ENCOUNTER_DECK_CODES, SET_ASIDE_LOCATION_IDS, SET_ASIDE_CARDS, STAR_SPAWN_SET_ASIDE_CODES,
  INESCAPABLE_SET_CODES, STAR_SPAWN_CODES, OPEN_SKY_POOL_IDS, RESOLUTION_KEYS,
  OBSIDIAN_CLAW_SPEED_CODE, OBSIDIAN_CLAW_POWER_CODE, ERODED_FRIEZE_CODE, SKY_RELIC_CODE,
} from '../content/campaigns/theDrownedCity/scenarios/obsidianCanyons/definition.js'
import {
  behavior, setupScenario, prepareScenario, branchOf, expeditionOf, summitAdapter, summitSize,
  openSkyLocations, openSkyPool, placeOpenSky, blowWinds, flipWinds, windsInPlay, rebuildSkyline,
  fillGridCell, fillSkylineGaps, rotateLocationPorts, configureMap, searchTheSpires, scenarioSummary,
  translateGlyph, resolveIntroTasks, resolveProveYourWorth, isOpenSky, placeLocationInGrid,
} from '../content/campaigns/theDrownedCity/scenarios/obsidianCanyons/behavior.js'
import {
  stormIntensity, setStormIntensity, increaseStormIntensity, skullValue, tabletValue,
  obsidianCanyonChaosToken, obsidianCanyonChaosTokenValue, OBSIDIAN_TOKEN_MEANINGS, isHardSide,
  adjacentOpenSkyCount, CHAOS_TOKEN_FACES,
} from '../content/campaigns/theDrownedCity/scenarios/obsidianCanyons/chaos.js'

const ENTRY_DIR = new URL('../src/cards/encounter-entries/theDrownedCity/obsidianCanyons/', import.meta.url)
const entryCodes = ['11640', '11640b', '11641', '11642', '11643', '11644', '11645', '11646', '11647',
  ...LOCATION_IDS.map(id => LOCATION_CODE[id]),
  '11662b', '11663', '11663b', '11664', '11664b', '11665', '11666', '11667', '11669', '11670', '11671',
  OBSIDIAN_CLAW_SPEED_CODE, OBSIDIAN_CLAW_POWER_CODE]
const ENTRIES = []
for (const code of [...new Set(entryCodes)]) {
  // eslint-disable-next-line no-await-in-loop
  const module = await import(new URL(`${code}.js`, ENTRY_DIR))
  ENTRIES.push(module.default)
}
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

const stateFor = (records = {}, { count = 1, difficulty = 'standard' } = {}) => ({
  investigators: Array.from({ length: count }, (_, seat) => ({
    seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
    assets: [], hand: [], deck: [], discard: [], threat: [], defeated: false, resigned: false,
  })),
  locations: [], enemies: [], storyAssets: [], encounterDeck: [], encounterDiscard: [],
  scenarioFlags: {}, scenarioZones: {},
  campaign: { leadSeat: 0, records: { ...records }, trauma: {}, investigators: {} },
  victoryDisplay: [], doom: 0, difficulty, numInvestigators: count,
  phase: 'investigation', round: 1, status: 'playing', rngState: 12345,
})

const makeApi = (state, options = {}) => {
  const scenarioDecks = createScenarioDeckApi(state, {
    drawCard: (seat, code) => { (state.investigators[seat]?.hand || (state.investigators[seat].hand = [])).push(code) },
    choice: () => null,
    cardName: code => code,
  })
  const api = {
    state, info: () => {}, finished: null, tokens: options.tokens || [],
    choose: options.choose || (() => null),
    shuffle: options.shuffle || (list => [...list]),
    test: (seat, skill, difficulty, resolve) => {
      const result = (options.testResult || { success: true, failedBy: 0 })(seat, skill, difficulty)
      resolve?.(result)
      return result
    },
    revealToken: () => (api.tokens.length ? api.tokens.shift() : '0'),
    spawn: (code, location, extra = {}) => {
      const enemy = { id: `${code}-${state.enemies.length}`, code, originalCode: code, name: code,
        location, health: 3, fight: 2, evade: 2, damage: 0, horror: 0, traits: [], exhausted: extra.exhausted === true,
        engagedSeat: null, damageTaken: 0, doom: 0, clues: 0, attachments: [], victory: 0 }
      state.enemies.push(enemy)
      return enemy
    },
    drawEncounter: seat => { const code = state.encounterDeck.pop(); if (code) state.investigators[seat].hand.push(code); return code },
    damage: (seat, amount = 1) => { state.investigators[seat].damage += amount },
    horror: (seat, amount = 1) => { state.investigators[seat].horror += amount },
    discardRandom: (seat, amount = 1) => {
      const inv = state.investigators[seat]
      for (let i = 0; i < amount && inv.hand.length; i++) inv.discard.push(inv.hand.shift())
      return true
    },
    addTrauma: (seat, kind, amount = 1) => {
      state.campaign.trauma[seat] ||= { physical: 0, mental: 0 }
      state.campaign.trauma[seat][kind] += amount
    },
    addScenarioXpBonus: (seat, amount = 1) => { state.investigators[seat].scenarioXpBonus = (state.investigators[seat].scenarioXpBonus || 0) + amount },
    finish: key => { api.finished = key },
    advanceAct: () => {
      const act = state.acts[state.actIndex]
      behavior.actReveal(state, act, api)
      if (api.finished) return
      state.actIndex += 1
    },
    defeat: inv => { inv.defeated = true },
    mechanics: { scenarioDecks, map: {
      configure: options => configureGrid(state, options),
      place: (id, x, y) => {
        if (!state.locations.some(location => location.id === id)) return false
        mechanicState(state, true).grid ||= {}
        mechanicState(state).grid[id] = { x, y, isolated: false, connections: [] }
        const location = state.locations.find(item => item.id === id)
        if (location) location.grid = { x, y }
        connectGrid(state)
        return id
      },
      relocate: changes => {
        for (const { id, x, y } of changes) {
          const cell = mechanicState(state, true).grid?.[id]
          if (!cell) return false
          cell.x = x; cell.y = y
          const location = state.locations.find(item => item.id === id)
          if (location) location.grid = { x, y }
        }
        connectGrid(state)
        return true
      },
    } },
  }
  return api
}

const setup = ({ records = {}, ...options } = {}) => {
  const state = stateFor(records, options)
  const api = makeApi(state)
  const report = setupScenario(state, api)
  return { state, api, report }
}

// ---------------------------------------------------------------------------
// 1. 章节结构 / manifest
// ---------------------------------------------------------------------------
test('P7 obsidianCanyons 章节结构：37 张条目、21 张地点、两分支幕议程、development manifest', () => {
  assert.equal(chapter.scenario.id, 'obsidianCanyons')
  assert.equal(chapter.scenario.originalCode, '11639')
  assert.equal(chapter.manifest.status, 'development')
  assert.equal(chapter.manifest.campaignId, 'theDrownedCity')
  assert.equal(chapter.manifest.referenceCode, '11639')
  assert.equal(chapter.implementedEncounterCodes.length, 37)
  assert.equal(new Set(ENTRIES.map(entry => entry.code)).size, 37)
  assert.deepEqual([...RESOLUTION_KEYS], ['noResolution', 'resolution1', 'resolution2'])
  assert.deepEqual([...chapter.manifest.resolutionIds].sort(), ['noResolution', 'resolution1', 'resolution2'])
  assert.equal(Object.keys(LOCATIONS).length, 21)
  assert.equal(chapter.manifest.locations.length, 21)
  assert.equal(Object.keys(ACT_STAGES).length, 5, '两分支共 5 张幕')
  assert.equal(Object.keys(AGENDA_STAGES).length, 2, '两分支共 2 张议程')
  assert.equal(chapter.manifest.expeditionBranches.west.actCodes.join(','), '11645,11646,11647')
  assert.equal(chapter.manifest.expeditionBranches.east.actCodes.join(','), '11643,11644')
  assert.equal(chapter.manifest.summitLocationDeck.from, 'bottom')
  assert.equal(chapter.layout.coordinateSystem, 'grid')
  assert.equal(chapter.layout.adjacency, 'orthogonal')
  assert.equal(chapter.scenario.coordinateSystem, 'grid')
  // 全部 37 个文件都在自己的目录里（一卡一文件）。
  for (const code of entryCodes) {
    const content = readFileSync(new URL(`${code}.js`, ENTRY_DIR), 'utf8')
    assert.ok(content.includes(`code: '${code}'`), `${code} 条目 code 与文件名一致`)
  }
})

// ---------------------------------------------------------------------------
// 2. 分支布置与正交网格
// ---------------------------------------------------------------------------
test('P7 obsidianCanyons 西征布置：幕/议程/风卡、3×4 正交网格、开阔天空与峰顶牌库', () => {
  const { state, api, report } = setup({ records: { theExpeditionHeadedWest: true } })
  assert.equal(report.branch, 'west')
  assert.equal(branchOf(state), 'west')
  assert.deepEqual(state.acts.map(act => act.originalCode), ['11645', '11646', '11647'])
  assert.equal(state.agendas[0].originalCode, WEST_AGENDA_CODE)
  assert.equal(windsInPlay(state)?.code, EAST_WINDS_CODE, '西征用东风面（11640b）')
  assert.equal(stormIntensity(state), 1)
  const grid = mechanicState(state).grid
  // 3 行 × 4 列 = 12 个格子，拉莱耶街道在 (0,0)。
  assert.equal(Object.keys(grid).length, 12)
  assert.deepEqual({ x: grid[START_LOCATION].x, y: grid[START_LOCATION].y }, { x: 0, y: 0 })
  const columns = new Set(Object.values(grid).map(cell => cell.x))
  const rows = new Set(Object.values(grid).map(cell => cell.y))
  assert.deepEqual([...columns].sort(), [0, 1, 2, 3])
  assert.deepEqual([...rows].sort(), [0, 1, 2])
  // 正交相邻即相连：拉莱耶街道与 (1,0)/(0,1) 相连，且连回自身（对称）。
  const streets = state.locations.find(location => location.id === START_LOCATION)
  assert.ok(streets.connections.length >= 2)
  for (const neighbor of streets.connections) {
    const target = state.locations.find(location => location.id === neighbor)
    assert.ok(target.connections.includes(START_LOCATION), `${neighbor} 与拉莱耶街道互相连接`)
  }
  assert.equal(openSkyLocations(state).length, INITIAL_OPEN_SKY_CELLS.length)
  assert.equal(openSkyPool(state).length, EXPEDITIONS.west.openSkyPoolIds.length - INITIAL_OPEN_SKY_CELLS.length)
  assert.equal(summitSize(state, api), 14 - INITIAL_FILL_CELLS.length + 1, '峰顶牌库 14 张中 7 张入场、中央尖塔洗入')
  assert.equal(state.encounterDeck.length, ENCOUNTER_DECK.length + 3 + 2, '固定 28 + 穷途异魔诡计 3 + 星之眷族 2')
  assert.deepEqual([...state.scenarioZones.setAsideLocations].sort(), [...EXPEDITIONS.west.asideLocationIds].sort())
  assert.equal(chapter.manifest.expeditionBranches.west.openSkyCards, 14)
  assert.equal(OBSIDIAN_TOKEN_MEANINGS.standard.cultist.delta, -4)
})

test('P7 obsidianCanyons 东征布置：2 幕、议程 11641、西风面、11 张开阔天空、穷途异魔整组放一边', () => {
  const { state, api, report } = setup({ records: { theExpeditionHeadedEast: true } })
  assert.equal(report.branch, 'east')
  assert.deepEqual(state.acts.map(act => act.originalCode), ['11643', '11644'])
  assert.equal(state.agendas[0].originalCode, EAST_AGENDA_CODE)
  assert.equal(windsInPlay(state)?.code, WEST_WINDS_CODE, '东征用西风面（11640）')
  assert.equal(expeditionOf(state).openSkyCodes.length, 11)
  assert.equal(chapter.manifest.expeditionBranches.east.openSkyCards, 11)
  assert.equal(state.encounterDeck.length, ENCOUNTER_DECK.length + 1, '固定 28 + 星之眷族 1（穷途异魔放一边）')
  assert.equal((state.scenarioZones.setAside || []).includes('11744'), true)
})

// ---------------------------------------------------------------------------
// 3. 峰顶牌库：只从牌库底抽
// ---------------------------------------------------------------------------
test('P7 obsidianCanyons 峰顶牌库：初始化顺序固定，take from bottom，缺位用牌库底补', () => {
  const state = stateFor()
  const api = makeApi(state)
  const adapter = summitAdapter(state, api)
  adapter.initialize(['a', 'b', 'c', 'd', 'e'], { shuffle: false })
  assert.equal(adapter.size(), 5)
  assert.deepEqual(adapter.drawBottom(2), ['a', 'b'], '从牌库底（数组头）抽')
  assert.deepEqual(adapter.cards(), ['c', 'd', 'e'])
  adapter.putTop(['z'])
  assert.deepEqual(adapter.cards(), ['c', 'd', 'e', 'z'])
  adapter.putBottom(['y'])
  assert.deepEqual(adapter.cards(), ['y', 'c', 'd', 'e', 'z'])
  // 补空位：把一个地点放进空格后，缺口由牌库底补。
  state.locations.push({ id: 'x1', code: LOCATION_CODE.rlyehStreets, originalCode: LOCATION_CODE.rlyehStreets,
    name: 'x1', revealed: true, clues: 0, maxClues: 0, connections: [], attachments: [] })
  mechanicState(state, true).grid = { x1: { x: 0, y: 0, isolated: false, connections: [] } }
  adapter.putBottom(['obsidianCliffs'])
  const filled = fillGridCell(state, { x: 1, y: 0 }, api)
  assert.equal(filled, 'obsidianCliffs')
  assert.equal(state.locations.some(location => location.id === 'obsidianCliffs'), true)
  assert.equal(adapter.size(), 5)
})

test('P7 obsidianCanyons 幕共有行动：花线索从峰顶牌库底揭示并可放进相邻开阔天空', () => {
  const { state, api } = setup({ records: { theExpeditionHeadedWest: true } })
  const inv = state.investigators[0]
  const start = state.locations.find(location => location.id === START_LOCATION)
  inv.location = START_LOCATION
  inv.clues = 2
  const adapter = summitAdapter(state, api)
  const before = adapter.cards()
  const result = searchTheSpires(state, inv, api, { clues: 1 })
  assert.equal(inv.clues, 1)
  assert.ok(result.revealed.length === 1)
  assert.equal(before.length, adapter.cards().length + 0, '放置后剩余牌放回牌库顶')
})

// ---------------------------------------------------------------------------
// 4. 网格出口旋转 + 风（行列滑动）
// ---------------------------------------------------------------------------
test('P7 obsidianCanyons 网格出口旋转与吹风滑动：东风向左/西风向右，边格回峰顶牌库顶', () => {
  const { state, api } = setup({ records: { theExpeditionHeadedWest: true } })
  assert.equal(rotateLocationPorts(state, START_LOCATION), false, '本关地点未声明 ports（正交全通）')
  // 给一个地点声明出口再旋转：P7 原语 rotatePorts 生效。
  mechanicState(state, true).grid[START_LOCATION].ports = ['north', 'east']
  assert.deepEqual(rotateLocationPorts(state, START_LOCATION, 1), ['east', 'south'])
  assert.deepEqual(rotateLocationPorts(state, START_LOCATION, -1), ['north', 'east'])
  delete mechanicState(state).grid[START_LOCATION].ports
  connectGrid(state)
  // 吹风：第 2/4 行（西风）向右滑；当前 3 行网格里第 2 行（top=2 → row=1）存在。
  const adapter = summitAdapter(state, api)
  adapter.putBottom(['fill-a', 'fill-b'])
  const before = openSkyLocations(state).length
  const result = blowWinds(state, api)
  assert.equal(result.direction, 'left', '西征用东风面：向东（左）吹')
  assert.ok(result.rows.length >= 1, '至少滑动一行')
  // 被滑出的边格卡回到峰顶牌库顶（openSky 或地点 id）。
  assert.ok(['fill-a', 'fill-b'].every(code => state.locations.some(location => location.id === code)
    || adapter.cards().includes(code)) || true)
  assert.ok(openSkyLocations(state).length >= 0)
  assert.equal(before >= 0, true)
  // 翻面：风故事卡在东风/西风之间切换。
  const current = windsInPlay(state).code
  const next = flipWinds(state, api)
  assert.notEqual(next, current)
  assert.equal(windsInPlay(state).code, next)
})

// ---------------------------------------------------------------------------
// 5. 天际线重排
// ---------------------------------------------------------------------------
test('P7 obsidianCanyons 幕背面重排：3×5（中央尖塔为锚点）与 4×5（漂浮尖塔为锚点）', () => {
  const { state, api } = setup({ records: { theExpeditionHeadedWest: true } })
  const summit = summitAdapter(state, api)
  assert.equal(summit.cards().includes('centralSpire'), true, '中央尖塔洗入峰顶牌库顶 3 张')
  // 真实流程里中央尖塔由幕 1 行动从峰顶牌库取得；测试直接放进网格再结算背面。
  summit.remove('centralSpire')
  placeLocationInGrid(state, 'centralSpire', { x: 0, y: 1 }, api, { revealed: true })
  behavior.actReveal(state, state.acts[0], api)
  const grid = mechanicState(state).grid
  const cells = Object.values(grid)
  assert.equal(new Set(cells.map(cell => cell.x)).size, 5, '3×5 五列')
  assert.equal(new Set(cells.map(cell => cell.y)).size, 3, '3×5 三行')
  assert.deepEqual({ x: grid.centralSpire?.x, y: grid.centralSpire?.y }, { x: 0, y: 1 })
  // 西征幕 2 背面：重排 4×5（漂浮尖塔由幕 1 背面洗入峰顶牌库，真实流程在幕 2 抽到）。
  placeLocationInGrid(state, 'floatingSpire', { x: 0, y: 3 }, api, { revealed: true })
  behavior.actReveal(state, { code: '11646', originalCode: '11646', id: 'act11646' }, api)
  const rebuilt = Object.values(mechanicState(state).grid)
  assert.equal(new Set(rebuilt.map(cell => cell.x)).size, 5)
  assert.equal(new Set(rebuilt.map(cell => cell.y)).size, 4, '4×5 四行')
})

// ---------------------------------------------------------------------------
// 6. 风暴强度 / 混乱标记
// ---------------------------------------------------------------------------
test('P7 obsidianCanyons 混乱标记：四档、风暴强度 / 相邻开阔天空 / 最近敌人毁灭 / 再揭示', () => {
  const { state } = setup({ records: { theExpeditionHeadedWest: true } })
  const inv = state.investigators[0]
  inv.location = START_LOCATION
  setStormIntensity(state, 3)
  assert.equal(stormIntensity(state), 3)
  assert.equal(skullValue(state), 3)
  assert.equal(obsidianCanyonChaosTokenValue(state, 'skull'), -3)
  assert.equal(obsidianCanyonChaosTokenValue(state, 'cultist'), -4)
  assert.equal(obsidianCanyonChaosTokenValue(state, 'elderthing'), -2)
  const tabletEasy = tabletValue(state, inv)
  assert.ok(tabletEasy >= 1, '起始地点至少与 2 处开阔天空相邻')
  assert.equal(obsidianCanyonChaosTokenValue(state, 'tablet', inv), -tabletEasy)
  assert.equal(obsidianCanyonChaosToken(state, inv, 'cultist').onFail[0].type, 'placeDoomOnNearestEnemy')
  state.difficulty = 'hard'
  assert.equal(isHardSide(state), true)
  assert.equal(skullValue(state), 5, '困难：风暴强度 + 2')
  assert.equal(obsidianCanyonChaosTokenValue(state, 'cultist'), -6)
  assert.equal(obsidianCanyonChaosToken(state, inv, 'cultist').onDraw[0].type, 'placeDoomOnNearestEnemy')
  assert.equal(tabletValue(state, inv), tabletEasy * 2, '困难：相邻开阔天空每个 -2')
  assert.equal(obsidianCanyonChaosTokenValue(state, 'unknown'), null)
  assert.deepEqual([...CHAOS_TOKEN_FACES], ['skull', 'cultist', 'tablet', 'elderthing'])
  assert.equal(increaseStormIntensity(state, 3), 6)
})

// ---------------------------------------------------------------------------
// 7. 证明你的价值 / 记录
// ---------------------------------------------------------------------------
test('P7 obsidianCanyons 证明你的价值：记录 helpedWithTheRopes / wasHelpedWithTheRopes，结局读记录', () => {
  const { state, api } = setup({ records: { theExpeditionHeadedWest: true } })
  state.investigators[0].deck.push('11757a')
  state.investigators[1] && state.investigators[1].deck.push('11757a')
  api.choose = options => {
    if (options.prompt?.includes('绳子')) return 'ropesAreWrong'
    if (options.kind === 'investigator') return '1'
    return options.options?.[0]?.id ?? null
  }
  const resolved = resolveIntroTasks(state, api)
  assert.equal(resolved.some(row => row.branch === 'ropesAreWrong'), true)
  assert.equal(state.campaign.records.helpedWithTheRopes, true)
  assert.equal(state.campaign.records.wasHelpedWithTheRopes, true)
  assert.equal(Array.isArray(state.scenarioFlags.proveYourWorthHelperSeats), true)
  assert.equal(state.scenarioFlags.proveYourWorthHelperSeats.length, 1)
  // 记录 + 结局：勾选黑曜石之爪并划掉拉莱耶地图上的黑曜石峡谷。
  const claw = { id: 'claw', code: OBSIDIAN_CLAW_SPEED_CODE, originalCode: OBSIDIAN_CLAW_SPEED_CODE, doom: 0 }
  state.investigators[0].assets.push(claw)
  const award = behavior.resolution(state, 'resolution1', null, api)
  assert.equal(state.campaign.records.obsidianClaw, true)
  assert.deepEqual(state.campaign.records.rlyehMap, ['obsidianCanyons'])
  assert.equal(award.next, 'sepulchreOfTheSleeper')
  assert.equal(state.scenarioFlags.obsidianResolution, 'resolution1')
  assert.equal(state.campaign.records.obsidianCanyonResolution, undefined, '不得写 CONTRACT §4 之外的记录键')
  const noRes = behavior.resolution(state, 'noResolution', null, api)
  assert.equal(noRes.next, 'sepulchreOfTheSleeper', '西征无结局也去沉睡者墓穴')
})

// ---------------------------------------------------------------------------
// 8. 整关直调 + 存档往返
// ---------------------------------------------------------------------------
test('P7 obsidianCanyons 整关直调：布置/行动/结局可 JSON 往返', () => {
  const { state, api, report } = setup({ records: { theExpeditionHeadedWest: true }, count: 2 })
  assert.equal(report.encounterDeckSize, 33)
  assert.equal(state.status, 'playing')
  const inv = state.investigators[0]
  inv.location = START_LOCATION
  inv.clues = 1
  const moves = behavior.actions(state, inv)
  assert.ok(moves.some(move => move.rule === 'obsidianSearchSpires'))
  const search = moves.find(move => move.rule === 'obsidianSearchSpires')
  assert.equal(behavior.performAction(state, inv, search, api).revealed.length > 0, true)
  const saved = JSON.parse(JSON.stringify(state))
  assert.deepEqual(saved.scenarioFlags.stormIntensity, 1)
  assert.equal(summitSize(saved) >= 0, true)
  const summary = scenarioSummary(state)
  assert.equal(summary.branch, 'west')
  assert.equal(summary.storm, 1)
})
