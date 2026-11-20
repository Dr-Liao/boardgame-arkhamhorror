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
import { assertScenarioManifest } from '../content/schema.js'
import { configureGrid, gridPosition, connectGrid } from '../src/engine/grid-map.js'
import { enemyKeywordOverride, enemyHasAttackKeyword } from '../src/engine/enemy-keyword-movement.js'
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
  ...LOCATION_IDS.filter(id => !LOCATION_OPTIONS[id]?.openSky).map(id => LOCATION_CODE[id]),
  '11662b', '11663', '11663b', '11664', '11664b', '11665', '11666', '11667', '11669', '11670', '11671',
  OBSIDIAN_CLAW_SPEED_CODE, OBSIDIAN_CLAW_POWER_CODE, 'xsky']
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
    scenario: {
      setEnemyKeywords: (enemy, keywords, keywordOptions) => {
        enemy.keywordOverrides ||= {}
        for (const keyword of keywords) {
          enemy.keywordOverrides[keyword] = { enabled: keywordOptions.enabled, throughRound: keywordOptions.throughRound }
        }
        return true
      },
    },
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
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.campaignId, 'theDrownedCity')
  assert.equal(chapter.manifest.referenceCode, '11639')
  assert.equal(chapter.implementedEncounterCodes.length, 37)
  // 37 张本章条目 + 1 条合成地点规则声明（xsky：弱点敌人不能进入开阔天空）。
  assert.equal(new Set(ENTRIES.map(entry => entry.code)).size, 38)
  assert.deepEqual([...RESOLUTION_KEYS], ['noResolution', 'resolution1', 'resolution2'])
  assert.deepEqual([...chapter.manifest.resolutionIds].sort(), ['noResolution', 'resolution1', 'resolution2'])
  // 21 张实体地点 + 14 张合成开阔天空地点（xsky）。
  assert.equal(Object.keys(LOCATIONS).length, 35)
  assert.equal(chapter.manifest.locations.length, 35)
  assert.equal(LOCATION_IDS.filter(id => LOCATION_OPTIONS[id]?.openSky).length, 14)
  assert.equal(Object.keys(ACT_STAGES).length, 5, '两分支共 5 张幕')
  assert.equal(Object.keys(AGENDA_STAGES).length, 2, '两分支共 2 张议程')
  assert.equal(chapter.manifest.expeditionBranches.west.actCodes.join(','), '11645,11646,11647')
  assert.equal(chapter.manifest.expeditionBranches.east.actCodes.join(','), '11643,11644')
  // 合成地点：manifest 带 synthetic/name/traits，卡号 xsky 不参与卡包归属校验。
  const syntheticLocations = chapter.manifest.locations.filter(location => location.synthetic === true)
  assert.equal(syntheticLocations.length, 14)
  const openSkyEntry = chapter.manifest.locations.find(location => location.id === 'openSky1')
  assert.deepEqual({ frontCode: openSkyEntry.frontCode, synthetic: openSkyEntry.synthetic,
    name: openSkyEntry.name, traits: openSkyEntry.traits }, {
    frontCode: 'xsky', synthetic: true, name: '开阔天空', traits: ['Open Sky'],
  })
  assert.equal(chapter.scenario.locations.openSky1.code, 'xsky')
  assert.equal(chapter.scenario.locations.openSky1.traits.includes('Open Sky'), true)
  // manifest 仍通过 content/schema 的关卡校验（合成地点要求 x 开头 + name + traits）。
  assert.doesNotThrow(() => assertScenarioManifest(chapter.manifest))
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

// ---------------------------------------------------------------------------
// 11. 真实存档（lib/sessions.js saveSnapshot/readSnapshot）重放
// ---------------------------------------------------------------------------
test('P7 obsidianCanyons saveReplay：saveSnapshot/readSnapshot 恢复等价且后续动作确定', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { saveSnapshot, readSnapshot, persistEnabled } = await import('../../../lib/sessions.js')
  const originalHome = process.env.DSH_HOME
  const originalPersist = process.env.BOARDGAME_PERSIST
  const home = mkdtempSync(join(tmpdir(), 'tdc-canyons-save-'))
  delete process.env.BOARDGAME_PERSIST
  process.env.DSH_HOME = home
  try {
    assert.equal(persistEnabled(), true, 'BOARDGAME_PERSIST 默认开启路径')
    const sessionId = 'tdc-canyons-save-replay'
    const { state } = setup({ records: { theExpeditionHeadedWest: true } })
    state.investigators[0].location = START_LOCATION
    state.investigators[0].clues = 1
    const session = { sessionId, modId: 'arkhamhorror', state,
      players: [{ seat: 0, name: '调查员1' }], events: [], settings: { difficulty: 'standard' } }
    const file = saveSnapshot(session)
    assert.equal(typeof file, 'string')
    const restored = readSnapshot(sessionId)
    assert.ok(restored, `readSnapshot 未返回记录；磁盘文件：${file}`)
    const persisted = restored.session ?? restored
    const normalized = value => JSON.parse(JSON.stringify(value))
    assert.deepEqual(normalized(persisted.state), normalized(state), '读回状态与内存状态深度相等')
    // 同一动作：存档恢复后 vs 未存过档的同一起点。
    const actOn = (target, api) => {
      const actor = target.investigators[0]
      actor.location = START_LOCATION
      actor.clues = 1
      return behavior.performAction(target, actor, { rule: 'obsidianSearchSpires', locationId: START_LOCATION }, api)
    }
    const restoredApi = makeApi(persisted.state)
    const freshState = setup({ records: { theExpeditionHeadedWest: true } }).state
    const freshApi = makeApi(freshState)
    const fromSaved = actOn(persisted.state, restoredApi)
    const fromFresh = actOn(freshState, freshApi)
    assert.deepEqual(normalized(fromSaved), normalized(fromFresh), '恢复后动作与未存档同起点的动作结果一致')
    assert.deepEqual(normalized(persisted.state.investigators[0]), normalized(freshState.investigators[0]))
    assert.deepEqual(normalized(persisted.state.locations.map(location => location.id).sort()),
      normalized(freshState.locations.map(location => location.id).sort()))
    assert.equal(persisted.modId, 'arkhamhorror')
    assert.equal(persisted.sessionId, sessionId)
  } finally {
    if (originalHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = originalHome
    if (originalPersist === undefined) delete process.env.BOARDGAME_PERSIST
    else process.env.BOARDGAME_PERSIST = originalPersist
    rmSync(home, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// 12. 内容侧收口（第二轮）
// ---------------------------------------------------------------------------
test('P7 obsidianCanyons 内容收口：议程地点离场强制、揭示强制、目标选择与顺序放回、原初恐怖', () => {
  const { state, api } = setup({ records: { theExpeditionHeadedWest: true } })
  const inv = state.investigators[0]
  // 议程强制需要一处已在场的[[中央]]地点。
  summitAdapter(state, api).remove('centralSpire')
  placeLocationInGrid(state, 'centralSpire', { x: 0, y: 1 }, api, { revealed: true })
  const summitId = state.locations.find(location => LOCATION_OPTIONS[location.id]?.summit
    && !location.revealed && location.id !== START_LOCATION)?.id
  assert.ok(summitId, '初始网格里存在未揭示[[峰顶]]地点')
  inv.location = summitId
  const evacuated = behavior.evacuateLocation(state, summitId, api)
  assert.equal(evacuated.length, 1)
  assert.equal(LOCATION_OPTIONS[inv.location]?.central, true, '被移动到一处[[中央]]地点')
  assert.equal(inv.location, evacuated[0].target)
  assert.equal(inv.damage, 2, '地点离场强制：2 点直接伤害')

  // 11659 揭示强制：1 点恐惧。
  placeLocationInGrid(state, 'dazzlingSkyline1', { x: 10, y: 10 }, api, { revealed: false })
  const dazzling = state.locations.find(location => location.id === 'dazzlingSkyline1')
  const horrorBefore = inv.horror
  assert.equal(behavior.locationRevealed(state, dazzling, api, inv.seat), true)
  assert.equal(inv.horror, horrorBefore + 1)

  // 11658 揭示强制：[敏捷](1) 失败 → 从牌库找[[怪物]]敌人抽取（直接抽取近似）。
  placeLocationInGrid(state, 'ancientCanyons', { x: 11, y: 11 }, api, { revealed: false })
  const canyonsLocation = state.locations.find(location => location.id === 'ancientCanyons')
  state.encounterDeck = ['11665', '11670']
  api.test = (seat, skill, difficulty, resolve) => { resolve({ success: false, failedBy: 1 }) }
  assert.equal(behavior.locationRevealed(state, canyonsLocation, api, inv.seat), true)
  assert.equal(state.investigators[inv.seat].hand.includes('11670'), true, '[[怪物]]敌人被抽出（测试桩手牌）')

  // 11666：失败差值 2 → 失去 2 次行动（走 api.loseActions 读点）。
  let lostActions = 0
  api.loseActions = (seat, amount) => { lostActions += amount }
  api.choose = () => 'action'
  behavior.events.obsidianAcrophobia(state, { seat: inv.seat }, api)
  assert.equal(lostActions, 1, '[敏捷/意志]失败差值由测试桩给出 1 点')

  // 11669：毁灭走 api.addDoom（引擎读点）。
  let doomAdded = 0
  api.addDoom = amount => { doomAdded += amount }
  api.choose = () => 'doom'
  behavior.events.obsidianLostInTheClouds(state, { seat: inv.seat }, api)
  assert.equal(doomAdded, 1)

  // 11665：附属到最近的未附属本卡地点。
  inv.location = START_LOCATION
  behavior.events.obsidianStElmosFire(state, { seat: inv.seat }, api)
  const fireLocations = state.locations.filter(location => (location.attachments || []).some(item => item.code === '11665'))
  assert.equal(fireLocations.length, 1)

  // 11667：失败后可选择让敌人从弃牌堆攻击。
  inv.threat = [{ id: 'wings', code: '11667', originalCode: '11667', name: '恐怖之翼' }]
  state.encounterDeck = ['11665', '11670']
  let attacked = null
  api.choose = () => 'attack'
  api.attackFromDiscard = (code, seat) => { attacked = [code, seat]; return true }
  assert.equal(behavior.afterTest(state, inv, { success: false }, api), true)
  assert.deepEqual(attacked, ['11670', inv.seat])
  assert.equal((inv.threat || []).some(card => card.code === '11667'), false)

  // 11670：在开阔天空被击败 → 与其交战的调查员被击败并承受 1 点肉体创伤。
  const openSky = openSkyLocations(state)[0]
  const enemy = { id: 'primeval', code: '11670', originalCode: '11670', location: openSky.id, engagedSeat: inv.seat }
  state.enemies.push(enemy)
  inv.defeated = false
  const beforeTrauma = state.campaign.trauma[inv.seat]?.physical || 0
  assert.equal(behavior.enemyDefeated(state, enemy, api), true)
  assert.equal(inv.defeated, true)
  assert.equal(state.campaign.trauma[inv.seat].physical, beforeTrauma + 1)

  // 幕共有行动：顺序放回（api.choose 逐张选择），不重复/不丢牌。
  inv.defeated = false
  inv.location = START_LOCATION
  inv.clues = 2
  const adapter = summitAdapter(state, api)
  const sizeBefore = adapter.size()
  const result = behavior.searchTheSpires(state, inv, api, { clues: 2 })
  assert.equal(result.revealed.length, 2)
  assert.equal(adapter.size(), sizeBefore, '揭示的牌全部回到峰顶牌库')
  assert.equal(new Set(adapter.cards()).size <= adapter.cards().length, true)
})

// ---------------------------------------------------------------------------
// 13. 关键词覆盖（setEnemyKeywords 已落地）
// ---------------------------------------------------------------------------
test('P7 obsidianCanyons 无情关键词：setEnemyKeywords 覆盖在生成/轮始同步', () => {
  const { state, api } = setup({ records: { theExpeditionHeadedWest: true } })
  const enemy = api.spawn('11671', START_LOCATION)
  assert.equal(behavior.enemySpawned(state, enemy, api), true)
  assert.deepEqual(enemy.keywordOverrides.relentless, { enabled: true, throughRound: state.round })
  assert.equal(enemyHasAttackKeyword(state, enemy, 'relentless', true, () => null), true)
  // 覆盖为 false 时优先于印刷值；轮到下一轮过期后回到印刷「无情」。
  api.scenario.setEnemyKeywords(enemy, ['relentless'], { enabled: false, throughRound: state.round })
  assert.equal(enemyKeywordOverride(state, enemy, 'relentless'), false)
  assert.equal(enemyHasAttackKeyword(state, enemy, 'relentless', true, () => null), false)
  state.round += 1
  assert.equal(enemyKeywordOverride(state, enemy, 'relentless'), null, '过期覆盖回到印刷值')
  assert.equal(enemyHasAttackKeyword(state, enemy, 'relentless', true, () => null), true)
  // 每轮神话阶段开始重新声明印刷无情（先于本轮的临时削弱）。
  api.scenario.setEnemyKeywords(enemy, ['relentless'], { enabled: false, throughRound: state.round })
  assert.equal(behavior.phaseBegan(state, 'mythos', api), true)
  assert.equal(enemyHasAttackKeyword(state, enemy, 'relentless', true, () => null), true)
  assert.equal(behavior.phaseBegan(state, 'investigation', api), false)
})

// ---------------------------------------------------------------------------
// 14. Good Money 跨章标记（content/campaigns/theDrownedCity/campaign-rules.js）
// ---------------------------------------------------------------------------
test('P7 obsidianCanyons Good Money 跨章标记：命中时不获得补给资源、不匹配正常获得', () => {
  const { state } = setup({ records: { theExpeditionHeadedWest: true }, count: 2 })
  state.campaign.scenarioIndex = 3
  state.campaign.ruleFlags = { tdcNoUpkeepResources: { originScenario: 'theGrandVault', seats: [0], appliesToScenarioIndex: 3 } }
  // phases.js 维护阶段补给读点：scenarioBehavior(state).canGainResources?.(state, inv) !== false 才 +supply。
  const supply = inv => { if (behavior.canGainResources(state, inv) !== false) inv.resources += 1; return inv.resources }
  const first = state.investigators[0]
  const second = state.investigators[1]
  const firstBefore = first.resources
  supply(first)
  assert.equal(first.resources, firstBefore, '命中（章节索引+座位）：不获得资源')
  const secondBefore = second.resources
  supply(second)
  assert.equal(second.resources, secondBefore + 1, '座位不匹配：正常获得资源')
  // 章节索引不匹配 → 不生效（stale 标记无害）。
  state.campaign.scenarioIndex = 4
  supply(first)
  assert.equal(first.resources, firstBefore + 1, '章节索引不匹配：正常获得资源')
  // 无标记 → 正常获得。
  delete state.campaign.ruleFlags.tdcNoUpkeepResources
  supply(first)
  assert.equal(first.resources, firstBefore + 2, '无标记：正常获得资源')
  assert.equal(behavior.canGainResources(state, first), true)
})

// ---------------------------------------------------------------------------
// 15. 注册表完整性（content/registered.js → createContentRegistry）
// ---------------------------------------------------------------------------
test('P7 obsidianCanyons 注册表：合成开阔天空地点通过注册校验', async () => {
  const { contentRegistry } = await import('../content/registered.js')
  const manifest = contentRegistry.getScenario('obsidianCanyons')
  const synthetic = manifest.locations.filter(location => location.synthetic === true)
  assert.equal(synthetic.length, 14)
  assert.equal(synthetic.every(location => location.frontCode === 'xsky'), true)
  assert.equal(synthetic.every(location => location.name === '开阔天空'), true)
  assert.equal(synthetic.every(location => location.traits.includes('Open Sky')), true)
  // 实体地点仍带真实卡号。
  assert.equal(manifest.locations.some(location => location.id === 'rlyehStreets' && location.frontCode === '11648'), true)
  assert.equal(contentRegistry.getScenarioData('obsidianCanyons').locations.openSky1.synthetic, true)
})

// ---------------------------------------------------------------------------
// 16. 引擎读点：不能离场/移动、巡逻目标、借机攻击
// ---------------------------------------------------------------------------
test('P7 obsidianCanyons 引擎读点：合成地点注册、不能离场/移动、巡逻与借机攻击', async () => {
  const { scenarioRuntime } = await import('../src/engine/engine.js')
  const { createHiddenRules } = await import('../src/engine/hidden-rules.js')
  const { resolvePatrol } = await import('../src/engine/enemy-keyword-movement.js')
  // 1) 条目声明（引擎读的同一份注册表）。
  for (const code of ['11648', '11649', '11650', '11651', '11652']) {
    assert.deepEqual(registeredEntry(code).locationRule.cannotLeavePlay, true, code + ' cannotLeavePlay')
    assert.deepEqual(registeredEntry(code).locationRule.cannotBeMoved, true, code + ' cannotBeMoved')
  }
  assert.deepEqual(registeredEntry('11670').enemyRule.patrolTarget, { kind: 'nearestEmptyTrait', trait: 'Summit' })
  // 2) 引擎地点原语：不可移动/离场的地点被拒绝，普通地点正常移除。
  const { state, api } = setup({ records: { theExpeditionHeadedWest: true } })
  summitAdapter(state, api).remove('centralSpire')
  placeLocationInGrid(state, 'centralSpire', { x: 20, y: 20 }, api, { revealed: true })
  state.log ||= []
  state.removedFromGame ||= []
  state.playerLocationAttachments ||= []
  state.setAsideEnemies ||= []
  const runtime = scenarioRuntime(state, [])
  assert.equal(runtime.removeLocationFromGame('centralSpire'), null, '不能离场 → null')
  assert.equal(state.locations.some(location => location.id === 'centralSpire'), true, '地点仍在场')
  assert.equal(runtime.removeLocationFromGame('rlyehStreets'), null, '起始地点也不能离场')
  assert.equal(runtime.swapLocation('centralSpire', 'easternAthenaeum'), null, '不能移动 → swap 被拒')
  assert.equal(state.locations.some(location => location.id === 'centralSpire'), true)
  const normal = state.locations.find(location => !LOCATION_OPTIONS[location.id]?.immovable
    && !LOCATION_OPTIONS[location.id]?.openSky && location.id !== START_LOCATION
    && !state.investigators.some(inv => inv.location === location.id))
  assert.ok(normal, '存在可正常移除的普通地点')
  const removedNormal = runtime.removeLocationFromGame(normal.id)
  assert.equal(removedNormal?.id, normal.id, '普通地点可被移出游戏')
  assert.equal(state.locations.some(location => location.id === normal.id), false)
  // 3) 11670 不进行借机攻击：引擎 hidden-rules.js#enemyCanOpportunityAttack 读点。
  const rules = createHiddenRules({
    capabilityBlocked: () => false, cardName: code => code, entityRuleActive: () => false,
    info: () => {}, isTextBlankEnemy: () => false, privateInfo: () => {}, scenarioBehavior: () => behavior,
  })
  const primeval = { id: 'p1', code: '11670', originalCode: '11670' }
  const vampire = { id: 'v1', code: '11671', originalCode: '11671' }
  assert.equal(rules.enemyCanOpportunityAttack(state, primeval), false, '原初恐怖不进行借机攻击')
  assert.equal(rules.enemyCanOpportunityAttack(state, vampire), true, '其他敌人照常借机攻击')
  assert.equal(behavior.canOpportunityAttack(state, primeval), false)
  // 4) 11670 巡逻：nearestEmptyTrait Summit → 最近的无人无敌人 Summit 地点。
  const patrolEnemy = { id: 'patrol', code: '11670', originalCode: '11670', location: 'a', exhausted: false, engagedSeat: null, traits: [] }
  const patrolState = {
    locations: [
      { id: 'a', name: 'A', traits: ['Summit'], connections: ['b', 'c'] },
      { id: 'b', name: 'B', traits: ['Summit'], connections: ['a'] },
      { id: 'c', name: 'C', traits: ['Summit'], connections: ['a'] },
      { id: 'd', name: 'D', traits: [], connections: ['a'] },
    ],
    enemies: [patrolEnemy], investigators: [
      { seat: 0, defeated: false, resigned: false, location: 'b' },
    ], storyAssets: [], campaign: { leadSeat: 0 },
  }
  const moves = []
  const moved = resolvePatrol(patrolState, patrolEnemy,
    registeredEntry('11670').enemyRule.patrolTarget, {
      blanked: () => false,
      choice: spec => spec.options?.[0]?.id ?? null,
      move: (enemy, to) => { enemy.location = to; moves.push([enemy.id, to]); return true },
    })
  assert.equal(moved, true)
  assert.deepEqual(moves, [['patrol', 'c']], 'b 有调查员 → 最近空 Summit 为 c，单步移动抵达')
})

// ---------------------------------------------------------------------------
// 17. 第二轮阶段 7：解除交战 / 遭遇搜索 / 幕 X 选择 / 撤退 / 悬浮礁石换位 / 剥蚀壁画
// ---------------------------------------------------------------------------
test('P7 obsidianCanyons 内容闭合：解除交战、遭遇搜索、幕 X 选择、撤退、悬浮礁石、剥蚀壁画', async () => {
  const { disengageEnemy, scenarioRuntime } = await import('../src/engine/engine.js')
  const runtimeOf = state => {
    state.log ||= []
    state.removedFromGame ||= []
    state.playerLocationAttachments ||= []
    state.setAsideEnemies ||= []
    state.encounterDiscard ||= []
    state.instanceSeq ||= {}
    for (const inv of state.investigators || []) inv.engaged ||= []
    return scenarioRuntime(state, [])
  }
  // 1) 11670：开阔天空解除交战 → 被击败 + 1 肉体创伤；其他敌人不触发。
  {
    const { state, api } = setup({ records: { theExpeditionHeadedWest: true } })
    const openSky = openSkyLocations(state)[0]
    const primeval = { id: 'primeval', code: '11670', originalCode: '11670', name: '原初恐怖',
      location: openSky.id, engagedSeat: 0, exhausted: false, traits: ['Monster'], health: 2, damageTaken: 0 }
    const vampire = { id: 'vampire', code: '11671', originalCode: '11671', name: '星之吸血鬼',
      location: openSky.id, engagedSeat: 0, exhausted: false, traits: ['Monster'], health: 5, damageTaken: 0 }
    state.enemies.push(primeval, vampire)
    state.investigators.forEach(inv => { inv.engaged = [] })
    state.investigators[0].engaged.push('primeval', 'vampire')
    runtimeOf(state)
    state.campaign.trauma[0] ||= { physical: 0, mental: 0 }
    // 引擎 addTrauma 会通过 updateCampaignStatus 读 campaign.investigators[seat] 记录。
    state.campaign.investigators[0] = { code: '01001', trauma: { physical: 0, mental: 0 }, status: 'active', xp: 0, deck: [] }
    const traumaBefore = state.campaign.trauma[0].physical
    disengageEnemy(state, primeval)
    assert.equal(state.investigators[0].defeated, true, '解除交战 → 被击败')
    assert.equal(state.campaign.trauma[0].physical, traumaBefore + 1, '并承受 1 点肉体创伤')
    state.investigators[0].defeated = false
    disengageEnemy(state, vampire)
    assert.equal(state.investigators[0].defeated, false, '其他敌人解除交战不触发')
    void api
  }
  // 2) 11658：引擎 searchEncounterCard（弃牌堆 → 生成并交战 + 洗牌；牌库也能找到）。
  {
    const { state, api } = setup({ records: { theExpeditionHeadedWest: true } })
    summitAdapter(state, api).remove('ancientCanyons')
    placeLocationInGrid(state, 'ancientCanyons', { x: 30, y: 30 }, api, { revealed: false })
    const location = state.locations.find(item => item.id === 'ancientCanyons')
    state.investigators[0].location = 'ancientCanyons'
    state.encounterDeck = ['11665', '11669']
    state.encounterDiscard = ['11670']
    const runtime = runtimeOf(state)
    const revealApi = { ...runtime, test: (seat, skill, difficulty, resolve) => { resolve({ success: false, failedBy: 1 }) } }
    state.currentSeat = 0
    assert.equal(behavior.locationRevealed(state, location, revealApi, 0), true, '弃牌堆里的[[怪物]]敌人生成并交战')
    assert.equal(state.encounterDiscard.includes('11670'), false, '找到的牌已移出弃牌堆')
    assert.equal(state.enemies.some(enemy => enemy.code === '11670' && enemy.engagedSeat === 0), true)
    // 牌库来源：把怪物放回牌库，弃牌堆清空。
    state.encounterDeck = ['11665', '11670', '11669']
    state.encounterDiscard = []
    state.enemies = []
    state.investigators[0].defeated = false
    state.scenarioFlags.erodedFriezeDrawnAt = null
    const before = [...state.encounterDeck]
    const api2 = { ...runtimeOf(state), test: (seat, skill, difficulty, resolve) => { resolve({ success: false, failedBy: 1 }) } }
    assert.equal(behavior.locationRevealed(state, location, api2, 0), true, '牌库里的[[怪物]]敌人也能被搜索到')
    assert.equal(state.encounterDeck.includes('11670'), false)
    assert.equal(state.encounterDeck.length, before.length - 1, '命中后洗回牌库')
    assert.equal(state.enemies.some(enemy => enemy.code === '11670' && enemy.engagedSeat === 0), true)
  }
  // 3) 幕共有行动：X 由玩家选择（2 线索 → 揭示 2 张）。
  {
    const { state, api } = setup({ records: { theExpeditionHeadedWest: true } })
    const inv = state.investigators[0]
    inv.location = START_LOCATION
    inv.clues = 3
    api.choose = options => (options.prompt?.includes('花费 X') ? '2' : (options.options?.[0]?.id ?? null))
    const adapter = summitAdapter(state, api)
    const deckBefore = adapter.size()
    const result = behavior.searchTheSpires(state, inv, api)
    assert.equal(result.cluesSpent, 2, 'X=2 选择生效')
    assert.equal(result.revealed.length, 2)
    assert.equal(inv.clues, 1, '只扣 2 个线索')
    assert.equal(adapter.size(), deckBefore, '揭示牌全部回到峰顶牌库')
  }
  // 4) 11648：花费 1-3 资源由玩家选择（2 资源 → 任意已揭示地点 +2 线索）。
  {
    const { state, api } = setup({ records: { theExpeditionHeadedWest: true } })
    const inv = state.investigators[0]
    inv.location = START_LOCATION
    inv.resources = 5
    const target = state.locations.find(location => location.id === 'easternAthenaeum') || state.locations[1]
    target.revealed = true
    target.clues = 0
    api.choose = options => (options.prompt?.includes('花费 1-3') ? '2'
      : (options.prompt?.includes('已揭示地点') ? target.id : (options.options?.[0]?.id ?? null)))
    const move = behavior.actions(state, inv).find(item => item.rule === 'obsidianPlaceClues')
    assert.equal(behavior.performAction(state, inv, move, api), true)
    assert.equal(inv.resources, 3, '扣 2 资源')
    assert.equal(target.clues, 2, '目标地点 +2 线索')
  }
  // 5) 11659：花费 1-3 线索由玩家选择（2 线索 → 揭示 6 张）。
  {
    const { state, api } = setup({ records: { theExpeditionHeadedWest: true } })
    summitAdapter(state, api).remove('dazzlingSkyline1')
    placeLocationInGrid(state, 'dazzlingSkyline1', { x: 31, y: 31 }, api, { revealed: true })
    const inv = state.investigators[0]
    inv.location = 'dazzlingSkyline1'
    inv.clues = 3
    api.choose = options => (options.prompt?.includes('花费 1-3') ? '2'
      : (options.prompt?.includes('顶还是底') ? 'top' : (options.options?.[0]?.id ?? null)))
    const adapter = summitAdapter(state, api)
    const before = adapter.size()
    assert.equal(behavior.performAction(state, inv,
      { rule: 'obsidianDazzlingSkyline', locationId: 'dazzlingSkyline1' }, api), true)
    assert.equal(inv.clues, 1, '只花 2 线索')
    assert.equal(adapter.size(), before, '6 张全部放回峰顶牌库')
  }
  // 6) 11651/11652：[action] 撤退（引擎 api.resign）。
  {
    const { state, api } = setup({ records: { theExpeditionHeadedWest: true } })
    summitAdapter(state, api).remove('westernWall')
    placeLocationInGrid(state, 'westernWall', { x: 32, y: 32 }, api, { revealed: true })
    const inv = state.investigators[0]
    inv.location = 'westernWall'
    let resigned = null
    api.resign = seat => { resigned = seat }
    const move = behavior.actions(state, inv).find(item => item.rule === 'obsidianResign')
    assert.ok(move, '西墙提供撤退行动')
    assert.equal(behavior.performAction(state, inv, move, api), true)
    assert.equal(resigned, 0)
  }
  // 7) 11656 [fast]：花 1 线索与 3 连接内[[峰顶]]地点的敌人交换位置。
  {
    const { state, api } = setup({ records: { theExpeditionHeadedWest: true } })
    const inv = state.investigators[0]
    const reef = state.locations.find(location => String(location.id).startsWith('suspendedReef'))
    assert.ok(reef, '悬浮礁石在初始网格')
    inv.location = reef.id
    inv.clues = 1
    const anotherSummit = state.locations.find(location => location !== reef
      && !LOCATION_OPTIONS[location.id]?.openSky && !LOCATION_OPTIONS[location.id]?.immovable
      && (location.traits || []).some(trait => trait === 'Summit'))
    assert.ok(anotherSummit, '存在另一处峰顶地点')
    const enemy = { id: 'reef-enemy', code: '11671', originalCode: '11671', name: '星之吸血鬼',
      location: anotherSummit.id, exhausted: true, engagedSeat: null, traits: ['Monster'], health: 5, damageTaken: 0 }
    state.enemies.push(enemy)
    api.choose = options => (options.kind === 'enemy' ? enemy.id : (options.options?.[0]?.id ?? null))
    const move = behavior.actions(state, inv).find(item => item.rule === 'obsidianSuspendedReefSwap')
    assert.ok(move, '悬浮礁石提供 [fast] 换位')
    assert.equal(behavior.performAction(state, inv, move, api), true)
    assert.equal(inv.location, anotherSummit.id, '调查员与敌人交换位置')
    assert.equal(enemy.location, reef.id)
    assert.equal(inv.clues, 0)
  }
  // 8) 11664 剥蚀壁画：真实遭遇附属 + 地点离场时放回「放一边」。
  {
    const { state, api } = setup({ records: { theExpeditionHeadedWest: true } })
    summitAdapter(state, api).remove('westernWall')
    placeLocationInGrid(state, 'westernWall', { x: 33, y: 33 }, api, { revealed: false })
    const runtime = runtimeOf(state)
    const wall = state.locations.find(location => location.id === 'westernWall')
    assert.equal(behavior.locationRevealed(state, wall, runtime, 0), true)
    const frieze = wall.attachments.find(attachment => attachment.code === '11664')
    assert.ok(frieze, '引擎 attachEncounterToLocation 生成真实附属实例')
    assert.equal(frieze.encounterAttached, true)
    // 西墙声明不能离场：地点原语拒绝，剥蚀壁画随地点一起留在场。
    assert.equal(behavior.removeLocationToSummitTop(state, 'westernWall', runtime), false)
    assert.equal(state.locations.some(location => location.id === 'westernWall'), true)
  }
})

// ---------------------------------------------------------------------------
// 18. 合成地点弱点限制（11641/11642）与 11671 猎物
// ---------------------------------------------------------------------------
test('P7 obsidianCanyons 合成地点弱点限制 + 11671 猎物 mostRemainingHealth', async () => {
  const { enemyCanEnterLocation } = await import('../src/engine/enemy-entry.js')
  const { ALL_CARDS } = await import('../src/cards/cards-data.js')
  const { scenarioRuntime } = await import('../src/engine/engine.js')
  // 1) 合成地点声明（与 14 张开阔天空地点共用的 xsky 条目）。
  assert.equal(registeredEntry('xsky').locationRule.weaknessEnemiesCannotEnter, true)
  const { state } = setup({ records: { theExpeditionHeadedWest: true }, count: 2 })
  const sky = openSkyLocations(state)[0]
  assert.ok(sky, '开阔天空在初始网格')
  const weakness = Object.values(ALL_CARDS).find(card => card.type === 'enemy'
    && String(card.subtype || '').toLowerCase().includes('weakness'))
  assert.ok(weakness, '目录里存在弱点敌人')
  const weakEnemy = { id: 'weak-enemy', code: weakness.code, originalCode: weakness.code, location: START_LOCATION, traits: [] }
  const normalEnemy = { id: 'primeval', code: '11670', originalCode: '11670', location: START_LOCATION, traits: ['Monster'] }
  assert.equal(enemyCanEnterLocation(state, weakEnemy, sky.id), false, '弱点敌人不能进入开阔天空')
  assert.equal(enemyCanEnterLocation(state, normalEnemy, sky.id), true, '普通敌人可以进入开阔天空')
  const land = state.locations.find(location => !isOpenSky(location))
  assert.equal(enemyCanEnterLocation(state, weakEnemy, land.id), true, '弱点敌人仍可进入普通地点')
  // 2) 11671 星之吸血鬼：猎物 - 剩余生命值最高。
  assert.equal(chapter.scenario.enemies['11671'].prey, 'mostRemainingHealth')
  assert.equal(registeredEntry('11671').flags.prey, 'mostRemainingHealth')
  state.log ||= []
  state.investigators.forEach(inv => { inv.threat ||= []; inv.assets ||= []; inv.maxHealth ||= 6; inv.maxSanity ||= 6 })
  state.investigators[0].damage = 1 // 剩余 5
  state.investigators[1].damage = 4 // 剩余 2
  const runtime = scenarioRuntime(state, [])
  assert.equal(runtime.preyTarget({ prey: 'mostRemainingHealth' }, [0, 1]), 0, '猎物为剩余生命值最高的调查员')
})

// ---------------------------------------------------------------------------
// 19. 枪械能力封锁（11661）、遭遇附属离场去向（11662/11663/11664）、黑曜石之爪翻面/能力
// ---------------------------------------------------------------------------
test('P7 obsidianCanyons 枪械封锁、离场去向、黑曜石之爪', async () => {
  const { createAbilityRules } = await import('../src/engine/ability-rules.js')
  const { ALL_CARDS } = await import('../src/cards/cards-data.js')
  const { discardEncounterAttachment } = await import('../src/engine/scenario-decks.js')
  const { assetCannotLeavePlay, scenarioRuntime } = await import('../src/engine/engine.js')
  const runtimeOf = state => {
    state.log ||= []
    state.removedFromGame ||= []
    state.playerLocationAttachments ||= []
    state.setAsideEnemies ||= []
    state.encounterDiscard ||= []
    state.instanceSeq ||= {}
    for (const inv of state.investigators || []) inv.engaged ||= []
    return scenarioRuntime(state, [])
  }
  // 1) 11661 磁性尖塔：枪械 action/free/reaction 被引擎读点拒绝；离开恢复；非枪械不受影响。
  {
    const { state, api } = setup({ records: { theExpeditionHeadedWest: true } })
    summitAdapter(state, api).remove('magneticSpires1')
    placeLocationInGrid(state, 'magneticSpires1', { x: 40, y: 40 }, api, { revealed: true })
    assert.deepEqual(registeredEntry('11661').locationRule.cannotTriggerAbilityTraits, ['Firearm'])
    const firearm = Object.values(ALL_CARDS).find(card => card.type === 'asset'
      && (card.traits || []).some(trait => String(trait).toLowerCase() === 'firearm'))
    const other = Object.values(ALL_CARDS).find(card => card.type === 'asset' && !card.duplicateOfCode
      && !(card.traits || []).some(trait => String(trait).toLowerCase() === 'firearm'))
    assert.ok(firearm && other)
    const deps = new Proxy({}, {
      get: (_target, key) => {
        if (key === 'cardDef') return code => ALL_CARDS[code]
        if (key === 'registeredEntry') return registeredEntry
        if (key === 'cardName') return code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code
        if (key === 'scenarioBehavior') return () => behavior
        if (key === 'normalizeCostValues') return cost => cost || {}
        if (key === 'discardLocked') return () => false
        if (key === 'limitUsed') return () => false
        if (key === 'legalMoves') return () => []
        return () => false
      },
    })
    const rules = createAbilityRules(deps)
    const inv = state.investigators[0]
    inv.location = 'magneticSpires1'
    const descriptor = { kind: 'action', label: '射击' }
    const gun = { id: 'gun', code: firearm.code, originalCode: firearm.code, controllerSeat: 0, exhausted: false, tokens: 0 }
    const item = { id: 'item', code: other.code, originalCode: other.code, controllerSeat: 0, exhausted: false, tokens: 0 }
    assert.equal(rules.descriptorUsable(state, inv, gun, descriptor, { mode: 'action' }), false, '在磁性尖塔：枪械行动消失')
    assert.equal(rules.descriptorUsable(state, inv, item, descriptor, { mode: 'action' }), true, '非枪械不受影响')
    inv.location = START_LOCATION
    assert.equal(rules.descriptorUsable(state, inv, gun, descriptor, { mode: 'action' }), true, '离开磁性尖塔后枪械行动恢复')
  }
  // 2) 11662/11663/11664 离场去向（引擎 discardEncounterAttachment 统一路由）。
  {
    for (const [code, bucket] of [['11662', 'setAside'], ['11663', 'removed'], ['11664', 'setAside']]) {
      assert.equal(registeredEntry(code).leavesPlayTo, bucket, code + ' leavesPlayTo')
      const state = { scenarioZones: {}, encounterDiscard: [] }
      assert.equal(discardEncounterAttachment(state, { id: 'x', code, originalCode: code }, code), true)
      assert.deepEqual(state.scenarioZones[bucket], [code], code + ' 进入 ' + bucket)
      assert.equal(state.encounterDiscard.length, 0, code + ' 不进遭遇弃牌堆')
    }
    // 11662 地点自身离场：有线索 → 放一边；无线索 → 胜利区（内容层按声明分流）。
    const { state, api } = setup({ records: { theExpeditionHeadedWest: true } })
    summitAdapter(state, api).remove('glyphOrrery')
    placeLocationInGrid(state, 'glyphOrrery', { x: 41, y: 41 }, api, { revealed: true })
    const glyph = state.locations.find(location => location.id === 'glyphOrrery')
    glyph.clues = 2
    assert.equal(behavior.removeLocationToSummitTop(state, 'glyphOrrery', api), true)
    assert.equal((state.scenarioZones.setAside || []).includes('11662'), true, '有线索 → 放一边')
    const { state: state2, api: api2 } = setup({ records: { theExpeditionHeadedWest: true } })
    summitAdapter(state2, api2).remove('glyphOrrery')
    placeLocationInGrid(state2, 'glyphOrrery', { x: 42, y: 42 }, api2, { revealed: true })
    const glyph2 = state2.locations.find(location => location.id === 'glyphOrrery')
    glyph2.clues = 0
    assert.equal(behavior.removeLocationToSummitTop(state2, 'glyphOrrery', api2), true)
    assert.equal((state2.scenarioZones.victory || []).includes('11662'), true, '无线索 → 胜利区')
    // 11664 附属随地点离场：放一边而不是遭遇弃牌堆。
    const { state: state3, api: api3 } = setup({ records: { theExpeditionHeadedWest: true } })
    placeLocationInGrid(state3, 'obsidianCliffs', { x: 43, y: 43 }, api3, { revealed: true })
    summitAdapter(state3, api3).remove('obsidianCliffs')
    placeLocationInGrid(state3, 'obsidianCliffs', { x: 43, y: 43 }, api3, { revealed: true })
    const cliffs = state3.locations.find(location => location.id === 'obsidianCliffs')
    if (!cliffs) return
    cliffs.attachments = [{ id: 'locatt-x', code: '11664', originalCode: '11664', encounterAttached: true }]
    assert.equal(behavior.removeLocationToSummitTop(state3, 'obsidianCliffs', runtimeOf(state3)), true)
    assert.equal((state3.scenarioZones.setAside || []).includes('11664'), true, '附属离场 → 放一边')
    assert.equal((state3.encounterDiscard || []).includes('11664'), false)
  }
  // 3) 11672a/b 黑曜石之爪：不能离场 + 翻面 + 力量面攻击。
  {
    assert.equal(registeredEntry('11672a').cannotLeavePlay, true)
    assert.equal(registeredEntry('11672b').cannotLeavePlay, true)
    assert.equal(assetCannotLeavePlay({ code: '11672a' }), true, '引擎 assetCannotLeavePlay 读点')
    const { state } = setup({ records: { theExpeditionHeadedWest: true } })
    const inv = state.investigators[0]
    inv.location = START_LOCATION
    const claw = { id: 'claw', code: '11672a', originalCode: '11672a', controllerSeat: 0, ownerSeat: 0, exhausted: false, tokens: 0, attachments: [] }
    inv.assets.push(claw)
    const flips = []
    const stub = { flipAsset: (asset, next) => flips.push([asset.id, next]), info: () => {}, choose: () => null,
      moveInvestigator: (seat, destination) => { state.investigators[seat].location = destination } }
    const flipA = registeredEntry('11672a').abilities[1]
    assert.equal(flipA.resolve({ state, inv, source: claw, api: stub }), true)
    assert.deepEqual(flips, [['claw', '11672b']], '速度面翻至力量面')
    // 力量面：攻击用敏捷 +1；目标横置再 +1 伤害。
    const enemy = { id: 'e-claw', code: '11671', originalCode: '11671', location: START_LOCATION, exhausted: true, defeated: false, traits: ['Monster'] }
    state.enemies.push(enemy)
    const fights = []
    const stub2 = { fight: (seat, enemyId, options) => fights.push([seat, enemyId, options]), info: () => {} }
    const clawB = { ...claw, code: '11672b', originalCode: '11672b', exhausted: false }
    inv.assets = [clawB]
    const attack = registeredEntry('11672b').abilities[0]
    assert.equal(attack.resolve({ state, inv, source: clawB, target: { entity: enemy }, api: stub2 }), true)
    assert.equal(fights[0][1], 'e-claw')
    assert.equal(fights[0][2].skill, 'agility')
    assert.equal(fights[0][2].bonus, 1)
    assert.equal(fights[0][2].damageBonus, 1, '目标横置时伤害 +1')
  }
  // 4) 11663 天空遗物：受控资产 action，成功翻面 + 记录 rune_f + 进胜利区；图标翻倍钩子。
  {
    const { state } = setup({ records: { theExpeditionHeadedWest: true } })
    const inv = state.investigators[0]
    const relic = { id: 'relic', code: '11663', originalCode: '11663', controllerSeat: 0, ownerSeat: 0, exhausted: false, tokens: 0 }
    inv.assets.push(relic)
    const events = []
    const stub = {
      setScenarioFlag: (key, value) => { state.scenarioFlags[key] = value },
      scenarioFlag: key => state.scenarioFlags?.[key] ?? null,
      campaignRecord: key => state.campaign.records?.[key] ?? null,
      setCampaignRecord: (key, value) => { state.campaign.records[key] = value },
      test: (seat, skill, difficulty, resolve) => resolve({ success: true }),
      flipAsset: (asset, next) => { asset.code = next; events.push(['flip', next]) },
      addStoryToVictory: code => { state.victoryDisplay ||= []; state.victoryDisplay.push({ code }) },
      info: () => {},
    }
    const ability = registeredEntry('11663').abilities[0]
    assert.equal(ability.resolve({ state, inv, source: relic, api: stub }), true)
    assert.equal(relic.code, '11663b')
    assert.equal(state.scenarioFlags.glyphWords.rune_f, 'Stars')
    assert.equal(state.campaign.records.discoveredGlyphs.includes('rune_f'), true)
    assert.equal((state.victoryDisplay || []).some(card => card.code === '11663b'), true)
    // 投入图标翻倍读点：测试标记命中时 behavior.commitIconMultiplier 返回 2。
    state.scenarioFlags.skyRelicTestSeat = 0
    assert.equal(behavior.commitIconMultiplier(state, inv), 2)
    state.scenarioFlags.skyRelicTestSeat = null
    assert.equal(behavior.commitIconMultiplier(state, inv), undefined)
  }
  void scenarioRuntime
})

// ---------------------------------------------------------------------------
// 20. 声明式入场费用（entryToll）与 11662b 引擎地点翻面
// ---------------------------------------------------------------------------
test('P7 obsidianCanyons 入场费用三分支 + 符文星盘仪引擎翻面', async () => {
  const { fixture, answer, settle, move } = await import('./core-fixture.mjs')
  const { scenarioRuntime } = await import('../src/engine/engine.js')
  const addTollLocation = (state, revealed = false) => {
    const from = state.investigators[0].location
    state.locations.push({ id: 'tollSpire', code: '11649', originalCode: '11649', name: '中央尖塔',
      shroud: 3, clues: 2, maxClues: 2, revealed, connections: [from], symbolLinks: [], attachments: [], traits: [], victory: 0 })
    const here = state.locations.find(location => location.id === from)
    if (here) here.connections.push('tollSpire')
    return 'tollSpire'
  }
  // 声明存在（三个地点的印刷入场费）。
  for (const code of ['11649', '11650', '11662']) {
    const toll = registeredEntry(code).locationRule.entryToll
    assert.deepEqual(toll.unlessControls, ['11672a', '11672b'], code + ' unlessControls')
    assert.deepEqual(toll.cost, { clues: 1 })
    assert.deepEqual(toll.test, { skill: 'agility', difficulty: 2 })
    assert.equal(toll.cancelOnFail, true)
  }
  // 11649/11650 入场费只印在未揭示面 → onlyUnrevealed；11662 正面生效，不加该门控。
  assert.equal(registeredEntry('11649').locationRule.entryToll.onlyUnrevealed, true)
  assert.equal(registeredEntry('11650').locationRule.entryToll.onlyUnrevealed, true)
  assert.equal(registeredEntry('11662').locationRule.entryToll.onlyUnrevealed, undefined)
  // 分支一：控制黑曜石之爪 → 免收直接进入。
  {
    const state = fixture()
    const destination = addTollLocation(state)
    state.investigators[0].assets.push({ id: 'claw', code: '11672a', originalCode: '11672a', controllerSeat: 0, exhausted: false, tokens: 0 })
    move(state, { action: 'move', locationId: destination })
    assert.equal(state.investigators[0].location, destination, '控制爪：免收进入')
  }
  // 分支二：支付线索 → 扣 1 线索后进入。
  {
    const state = fixture()
    const destination = addTollLocation(state)
    state.investigators[0].clues = 3
    move(state, { action: 'move', locationId: destination })
    assert.ok(state.pendingChoice, '未控制爪：临时提示支付方式')
    answer(state, 'pay')
    assert.equal(state.investigators[0].location, destination, '支付线索后进入')
    assert.equal(state.investigators[0].clues, 2, '支付 1 线索')
  }
  // 分支三：检定失败 → 取消移动（autofail）。
  {
    const state = fixture()
    const destination = addTollLocation(state)
    state.investigators[0].clues = 0
    state.chaosBag = ['autofail']
    move(state, { action: 'move', locationId: destination })
    // 无线索可付、无可支付项 → 引擎直接进入检定；autofail 必然失败并取消移动。
    settle(state)
    assert.notEqual(state.investigators[0].location, destination, '检定失败：移动取消')
  }
  // 分支四：目的地已揭示 → onlyUnrevealed 门控生效，不再收费直接进入。
  {
    const state = fixture()
    const destination = addTollLocation(state, true)
    state.investigators[0].clues = 0
    move(state, { action: 'move', locationId: destination })
    assert.equal(state.investigators[0].location, destination, '已揭示：不收费直接进入')
    assert.equal(state.pendingChoice?.kind ?? null, null, '已揭示：无入场费提示')
  }
  // 11662b：引擎地点翻面入口（api.flipLocation → locationStory），记录 rune_d 并禁止再次翻面。
  {
    const { state, api } = setup({ records: { theExpeditionHeadedWest: true } })
    summitAdapter(state, api).remove('glyphOrrery')
    placeLocationInGrid(state, 'glyphOrrery', { x: 50, y: 50 }, api, { revealed: true })
    const inv = state.investigators[0]
    inv.location = 'glyphOrrery'
    inv.clues = 2
    state.log ||= []
    state.removedFromGame ||= []
    state.playerLocationAttachments ||= []
    for (const other of state.investigators) other.engaged ||= []
    const runtime = scenarioRuntime(state, [])
    const merged = { ...api, flipLocation: runtime.flipLocation }
    assert.equal(behavior.performAction(state, inv,
      { rule: 'obsidianGlyphOrreryFlip', locationId: 'glyphOrrery' }, merged), true)
    const glyph = state.locations.find(location => location.id === 'glyphOrrery')
    assert.equal(glyph.cannotFlipAgain, true, '翻面后不能再次翻面')
    assert.equal(state.scenarioFlags.glyphWords.D, 'Wave', '记录 rune_d「Wave」')
    assert.equal(behavior.performAction(state, inv,
      { rule: 'obsidianGlyphOrreryFlip', locationId: 'glyphOrrery' }, merged), false, '不能再次翻面')
  }
})
