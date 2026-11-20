// TDC P7 西墙（theWesternWall · 提示卡 11517）章节测试。
//
// 覆盖：模块 import / manifest（20 张非玩家条目、13 张地点实例、2 幕、1 议程、4 结局键）、
// 5 层地点（相邻整层全互通、同层不连通）、东西两向起点与淹没差异、沉没阶梯 / 水下秘库、
// 混乱标记四档与淹没追加效果、Do No Harm 结算、结局 1/2/3 与无结局的跳章、单卡条目注册。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { assertScenarioManifest, assertUiLayout } from '../content/schema.js'
import { scenarioZoneReport } from '../content/scenario-manifest.js'
import * as chapter from '../content/campaigns/theDrownedCity/scenarios/theWesternWall/index.js'
import {
  scenario, ACT_WEST_CODE, ACT_EAST_CODE, ACT_CODES, AGENDA_CODE, AGENDA_CODES,
  ACT_STAGES, AGENDA_STAGES, STAGE_CARDS, ACTS, AGENDAS, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES,
  LOCATIONS, LOCATION_TABLE, LOCATION_CODES, LOCATION_COORDINATES, LEVEL_BY_LOCATION,
  LEVEL_UPPER_SLOTS, LEVEL_BOTTOM_SLOTS, PATH_LOCATION_IDS, SPECIAL_LOCATION_IDS,
  REMOVED_PATH_COUNT, REMOVED_STAR_SPAWN_CODES, SET_ASIDE_ALIASES, SET_ASIDE_LOCATION_IDS,
  START_LOCATION_WEST, START_LOCATION_EAST, RESOLUTION_KEYS, RESOLUTION3_CHAPTERS,
  NEXT_CHAPTER_EAST, FLOOD_SETUP, SCENARIO_TEXT, DO_NO_HARM_TASK_CODES, HUNTING_PARASITE_CODE,
} from '../content/campaigns/theDrownedCity/scenarios/theWesternWall/definition.js'
import { behavior, scenarioSummary, implementedEntryFlags } from '../content/campaigns/theDrownedCity/scenarios/theWesternWall/behavior.js'
import {
  theWesternWallChaosToken, theWesternWallTokenValue, THE_WESTERN_WALL_TOKEN_MEANINGS,
  locationLevel, floodLevelOf, isFullyFlooded, isFlooded, isHardSide, testAutoFail,
  CHAOS_TOKEN_FACES, FLOOD_LEVELS,
} from '../content/campaigns/theDrownedCity/scenarios/theWesternWall/chaos.js'

const ENTRY_CODES = Object.freeze([
  '11518', '11519', '11520',
  '11521', '11522', '11523', '11524', '11525', '11526', '11527', '11528', '11529', '11530',
  '11531', '11531b', '11532', '11532b', '11533', '11534', '11535',
])
const ENTRIES = []
for (const code of ENTRY_CODES) {
  const module = await import(`../src/cards/encounter-entries/theDrownedCity/theWesternWall/${code}.js`)
  ENTRIES.push(module.default)
}
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

const clone = value => JSON.parse(JSON.stringify(value))
const stateFor = (count = 1, records = {}) => ({
  investigators: Array.from({ length: count }, (_, seat) => ({
    seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
    assets: [], hand: [], deck: [], discard: [], threat: [], defeated: false, resigned: false,
  })),
  locations: [], enemies: [], storyAssets: [], encounterDeck: [], encounterDiscard: [],
  scenarioFlags: {}, scenarioZones: {},
  campaign: { leadSeat: 0, records: { ...records }, trauma: {}, investigators: {} },
  victoryDisplay: [], doom: 0, difficulty: 'standard', numInvestigators: count,
  phase: 'investigation', round: 1, status: 'playing', acts: [], agendas: [],
})
const stateWithScenario = (count = 1, records = {}) => {
  const state = stateFor(count, records)
  state.scenario = clone(scenario)
  return state
}
const makeApi = (state, options = {}) => {
  const progressChanges = []
  const api = {
    state,
    info: () => {},
    finished: null,
    advanced: 0,
    progressChanges,
    topOfDeck: [],
    choose: options.choose || (() => null),
    random: options.random || (() => 0.1),
    shuffle: options.shuffle || (list => [...list]),
    test(seat, skill, difficulty, resolve) {
      const result = typeof api.testResult === 'function' ? api.testResult(seat, skill, difficulty)
        : (api.testResult || { success: true, value: difficulty + 2 })
      api.lastTest = { seat, skill, difficulty, result }
      resolve?.(result)
      return result
    },
    damage(seat, amount = 1) { state.investigators[seat].damage += amount },
    horror(seat, amount = 1) { state.investigators[seat].horror += amount },
    addTrauma(seat, kind, amount = 1) {
      state.campaign.trauma[seat] ||= { physical: 0, mental: 0 }
      state.campaign.trauma[seat][kind] += amount
    },
    defeat(inv) { inv.defeated = true },
    advanceAct() { api.advanced += 1 },
    finish(key) { api.finished = key },
    setCampaignRecord(key, value) { state.campaign.records[key] = value },
    addDoom(amount = 1) { state.doom += amount },
    putOnTopOfDeck(seat, code) { api.topOfDeck.push([seat, code]) },
    drawCards(seat, amount = 1) {
      for (let index = 0; index < amount; index += 1) state.investigators[seat].hand.push(`card-${index}`)
      return amount
    },
    giveAsset(seat, code) { (state.investigators[seat].assets ||= []).push({ code, originalCode: code }) },
    takeEncounterDeckCard(code) {
      const index = state.encounterDeck.lastIndexOf(code)
      if (index < 0) return null
      return state.encounterDeck.splice(index, 1)[0]
    },
    takeEncounterDiscard(code) {
      const index = state.encounterDiscard.lastIndexOf(code)
      if (index < 0) return false
      state.encounterDiscard.splice(index, 1)
      return true
    },
    spawn(code, locationId, extra = {}) {
      const definition = (state.scenario?.enemies || scenario.enemies)[code] || {}
      const enemy = {
        id: `${code}-${state.enemies.length + 1}`, code, originalCode: code,
        name: definition.name, location: locationId, fight: definition.fight ?? 2,
        evade: definition.evade ?? 2, health: definition.health ?? 2,
        damage: definition.damage || 0, horror: definition.horror || 0,
        traits: [...(definition.traits || [])], exhausted: extra.exhausted === true,
        engagedSeat: extra.engagedSeat ?? null, damageTaken: 0, doom: 0, clues: 0,
        attachments: [], victory: definition.victory || 0,
      }
      state.enemies.push(enemy)
      return enemy
    },
    mechanics: {
      progress: {
        forSeat(track, seat) {
          const option = options.taskOptions?.[seat]
          return track === 'tdcTask' && option ? { option, value: 0 } : null
        },
        change(track, seat, amount, receipt) {
          progressChanges.push({ track, seat, amount, receipt })
          return amount
        },
      },
    },
  }
  return api
}
const setup = (count = 1, options = {}) => {
  const state = stateWithScenario(count, options.records || {})
  const api = makeApi(state, options)
  const report = behavior.setupScenario(state, api)
  return { state, api, report }
}
const locationOf = (state, id) => state.locations.find(location => location.id === id) || null

// ---------------------------------------------------------------------------
// 1. 章节结构 / manifest
// ---------------------------------------------------------------------------
test('P7 theWesternWall 章节结构：20 张条目、13 地点实例、2 幕、1 议程、4 结局键', () => {
  assert.equal(chapter.scenario.id, 'theWesternWall')
  assert.equal(chapter.scenario.originalCode, '11517')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.campaignId, 'theDrownedCity')
  assert.equal(chapter.manifest.referenceCode, '11517')
  assert.equal(chapter.manifest.contentVersion, '0.1.0')
  assert.deepEqual(chapter.manifest.resolutionIds, ['noResolution', 'resolution1', 'resolution2', 'resolution3'])
  assert.deepEqual([...chapter.implementedEncounterCodes].sort(), [...ENTRY_CODES].sort())
  assert.equal(Object.keys(LOCATIONS).length, 13)
  assert.equal(LOCATION_TABLE.length, 13)
  assert.equal(LOCATION_CODES.length, 13)
  assert.equal(PATH_LOCATION_IDS.length, 7)
  assert.equal(SPECIAL_LOCATION_IDS.length, 3)
  assert.equal(REMOVED_PATH_COUNT, 2)
  assert.equal(LEVEL_UPPER_SLOTS.length, 6)
  assert.equal(LEVEL_BOTTOM_SLOTS.length, 3)
  assert.equal(chapter.manifest.fiveLevelMap.levelCounts[4], 3)
  assert.equal(chapter.manifest.fiveLevelMap.sameRowConnected, false)
  assert.equal(ACT_CODES.length, 2)
  assert.equal(ACT_STAGES.west.direction, 'west')
  assert.equal(ACT_STAGES.east.direction, 'east')
  assert.equal(AGENDA_STAGES[1].doomThreshold, 13)
  assert.equal(Object.keys(STAGE_CARDS).length, 3)
  assert.equal(ACTS.length, 1)
  assert.equal(AGENDAS.length, 1)
  assert.equal(SCENARIO_TEXT.specialRules.length, 2)
  assert.equal(SCENARIO_TEXT.setupSteps.west.length, 12)
  assert.equal(SCENARIO_TEXT.setupSteps.east.length, 12)
  assert.equal(RESOLUTION3_CHAPTERS.length, 2)
  assert.equal(NEXT_CHAPTER_EAST, 'sepulchreOfTheSleeper')
  assert.equal(RESOLUTION_KEYS.length, 4)
})

test('P7 theWesternWall manifest 通过 schema 校验，5 层静态连接与布局边合法', () => {
  const manifest = clone(chapter.manifest)
  assert.deepEqual(assertScenarioManifest(manifest), manifest)
  assert.ok(assertUiLayout(clone(chapter.layout), new Set(Object.keys(LOCATIONS)),
    new Set(Object.entries(chapter.CONNECTIONS).flatMap(([from, tos]) => tos.map(to => `${from}>${to}`)))))
  assert.equal(manifest.startLocationId, START_LOCATION_WEST)
  for (const location of Object.values(LOCATIONS)) {
    for (const target of location.connections) {
      assert.equal(LOCATIONS[target].connections.includes(location.id), true, `${location.id} ↔ ${target}`)
    }
  }
  // 规范（西线）排布：层 1–5 数量 1/1/2/3/3；相邻整层全互通、同层不连通。
  const byLevel = {}
  for (const [id, level] of Object.entries(LEVEL_BY_LOCATION)) if (level) (byLevel[level] ||= []).push(id)
  assert.deepEqual(Object.fromEntries(Object.entries(byLevel).map(([level, ids]) => [level, ids.length])),
    { 1: 1, 2: 1, 3: 2, 4: 3, 5: 3 })
  for (const [level, ids] of Object.entries(byLevel)) {
    for (const id of ids) {
      for (const other of ids) {
        if (other !== id) assert.equal(LOCATIONS[id].connections.includes(other), false, `同层不连通：${id}/${other}`)
      }
      const adjacent = [...(byLevel[Number(level) - 1] || []), ...(byLevel[Number(level) + 1] || [])]
      for (const other of adjacent) assert.equal(LOCATIONS[id].connections.includes(other), true, `相邻层互通：${id}/${other}`)
    }
  }
  assert.equal(chapter.layout.edges.length, 36)
  assert.equal(manifest.zones.removed.length, REMOVED_STAR_SPAWN_CODES.length)
  assert.equal(manifest.zones.setAside.find(entry => entry.cardCode === '11532')?.count, 1)
  assert.equal(manifest.zones.setAside.find(entry => entry.cardCode === '11727')?.count, 1)
  assert.equal(LOCATION_COORDINATES.westernWall.y, 0)
  assert.equal(LOCATION_COORDINATES.shatteredRuins.y, -4)
})

// ---------------------------------------------------------------------------
// 2. 遭遇牌库守恒
// ---------------------------------------------------------------------------
test('P7 theWesternWall 遭遇牌库守恒：35 张固定牌库，放一边/移出固定卡', () => {
  assert.equal(ENCOUNTER_DECK.length, 35)
  assert.equal(ENCOUNTER_DECK.filter(code => code === '11534').length, 3)
  assert.equal(ENCOUNTER_DECK.filter(code => code === '11745').length, 3)
  for (const kept of SET_ASIDE_ALIASES) assert.equal(ENCOUNTER_DECK.includes(kept), false, `${kept} 放一边`)
  for (const removed of REMOVED_STAR_SPAWN_CODES) assert.equal(ENCOUNTER_DECK.includes(removed), false, `${removed} 移出游戏`)
  const report = scenarioZoneReport(scenario, chapter.manifest)
  assert.equal(report.encounterCards, 35)
  assert.equal(report.declaredSetAsideCards, SET_ASIDE_ALIASES.length + SET_ASIDE_LOCATION_IDS.length)
  assert.equal(report.locationCount, 13)
  assert.equal(report.duplicateActiveZoneCodes.length, 0)
  assert.equal(report.optionalZoneCollisions.length, 0)
  const { state } = setup(1)
  assert.equal(state.encounterDeck.length, 35)
  assert.equal(ENCOUNTER_DECK_CODES.length, 18)
})

// ---------------------------------------------------------------------------
// 3. 东西两向布置与淹没差异
// ---------------------------------------------------------------------------
test('P7 theWesternWall 西线：起点西墙、10 地点入场、行走路线移出 2、层 2–5 淹没 1/1/2/2', () => {
  const { state, report } = setup(2, { records: { theExpeditionHeadedWest: true } })
  assert.equal(report.direction, 'west')
  assert.equal(report.startLocationId, START_LOCATION_WEST)
  assert.equal(state.investigators.every(inv => inv.location === 'westernWall'), true)
  assert.equal(state.locations.length, 10)
  assert.equal(report.removedPaths.length, REMOVED_PATH_COUNT)
  assert.equal(new Set([...report.placedIds]).size, 10)
  assert.deepEqual(report.levelCounts, { 1: 1, 2: 1, 3: 2, 4: 3, 5: 3 })
  assert.equal(report.floodByLevel[1].westernWall, 0)
  assert.deepEqual(Object.values(report.floodByLevel[2]), [1])
  assert.deepEqual(Object.values(report.floodByLevel[3]).sort(), [1, 1])
  assert.deepEqual(Object.values(report.floodByLevel[4]).sort(), [2, 2, 2])
  assert.deepEqual(Object.values(report.floodByLevel[5]).sort(), [2, 2, 2])
  assert.equal(locationOf(state, 'underseaVault'), null, '水下秘库开局放一边')
  assert.deepEqual([...state.scenarioZones.setAsideLocations], [...SET_ASIDE_LOCATION_IDS])
  assert.equal(state.scenarioZones.removed.length, REMOVED_STAR_SPAWN_CODES.length + REMOVED_PATH_COUNT)
})

test('P7 theWesternWall 东线：起点黑曜石地基、层 1–2 完全淹没、方向相反', () => {
  const { state, report } = setup(1, { records: { theExpeditionHeadedEast: true } })
  assert.equal(report.direction, 'east')
  assert.equal(report.startLocationId, START_LOCATION_EAST)
  assert.equal(report.actCode, ACT_EAST_CODE)
  assert.equal(state.investigators[0].location, 'obsidianFoundations')
  assert.equal(behavior.headedWestOf(state), false)
  assert.equal(report.floodByLevel[1].obsidianFoundations, 2)
  assert.deepEqual(Object.values(report.floodByLevel[2]), [2])
  assert.deepEqual(Object.values(report.floodByLevel[3]).sort(), [1, 1])
  assert.deepEqual(Object.values(report.floodByLevel[4]).sort(), [1, 1, 1])
  assert.deepEqual(Object.values(report.floodByLevel[5]).sort(), [0, 0, 0])
  // 西墙在东线里位于第 5 层的三选一。
  const westernWall = locationOf(state, 'westernWall')
  assert.equal(westernWall.level, 5)
})

test('P7 theWesternWall 按行连通：相邻整层全互通、同层不连通（运行期）', () => {
  for (const records of [{ theExpeditionHeadedWest: true }, { theExpeditionHeadedEast: true }]) {
    const { state } = setup(2, { records })
    const byLevel = {}
    for (const location of state.locations) (byLevel[location.level] ||= []).push(location.id)
    for (const [level, ids] of Object.entries(byLevel)) {
      for (const id of ids) {
        const location = locationOf(state, id)
        for (const other of ids) {
          if (other === id) continue
          assert.equal(location.connections.includes(other), false, `同层不得相连：${id}/${other}（level ${level}）`)
        }
        const adjacent = [...(byLevel[Number(level) - 1] || []), ...(byLevel[Number(level) + 1] || [])]
        for (const other of adjacent) {
          assert.equal(location.connections.includes(other), true, `必须相连：${id}/${other}（level ${level}）`)
        }
      }
    }
  }
})

// ---------------------------------------------------------------------------
// 4. 地点机制
// ---------------------------------------------------------------------------
test('P7 theWesternWall 沉没阶梯：揭示后把水下秘库放到上一行或下一行', () => {
  const { state, api } = setup(1, { records: { theExpeditionHeadedWest: true } })
  const stairway = locationOf(state, 'sunkenStairway')
  assert.ok(stairway)
  api.choose = () => '0'
  assert.equal(behavior.locationRevealed(state, stairway, api), true)
  const vault = locationOf(state, 'underseaVault')
  assert.ok(vault, '水下秘库入场')
  assert.equal(Math.abs(vault.grid.y - stairway.grid.y), 1, '放在相邻行')
  assert.equal(vault.shroud, 5)
  assert.equal(vault.clues, 1)
})

test('P7 theWesternWall 险恶道路：不能从有线索的地点进入；进入效果按上下方向结算', () => {
  const { state, api } = setup(1, { records: { theExpeditionHeadedWest: true } })
  const level2 = state.locations.find(location => location.level === 2)
  const level1 = state.locations.find(location => location.level === 1)
  assert.ok(level2 && level1)
  level2.revealed = true
  state.investigators[0].location = level1.id
  // 起点无线索：可以从上方进入（level1 → level2）。
  level1.clues = 0
  assert.equal(behavior.beforeMove(state, state.investigators[0], level2, api), true)
  // 有线索时不能进入险恶道路。
  level1.clues = 1
  assert.equal(behavior.beforeMove(state, state.investigators[0], level2, api), false)
  level1.clues = 0
  // 从上方进入 → 受 1 伤害（Slick Steps）。
  state.investigators[0].location = level2.id
  if (registeredEntry(level2.code)?.flags?.enterFromAbove) {
    behavior.locationEntered(state, state.investigators[0], level2, api)
    assert.equal(state.investigators[0].damage, 1)
  }
})

test('P7 theWesternWall 深潜者主母进场：从遭遇牌库找出深潜者敌人并生成', () => {
  const { state, api } = setup(1, { records: { theExpeditionHeadedWest: true } })
  state.encounterDeck = ['11746', '11729']
  const matron = api.spawn('11533', 'westernWall')
  assert.equal(behavior.enemySpawned(state, matron, api), true)
  assert.ok(state.enemies.some(enemy => enemy.originalCode === '11746' && enemy.location === 'westernWall'))
})

// ---------------------------------------------------------------------------
// 5. 混乱标记
// ---------------------------------------------------------------------------
test('P7 theWesternWall 混乱标记：四档符号、层级/淹没相关修正与自动失败', () => {
  const { state, api } = setup(1, { records: { theExpeditionHeadedWest: true } })
  const inv = state.investigators[0]
  inv.location = 'westernWall'
  assert.equal(CHAOS_TOKEN_FACES.length, 4)
  assert.equal(FLOOD_LEVELS.full, 2)
  assert.equal(locationLevel(state, inv), 1)
  assert.equal(theWesternWallTokenValue(state, inv, 'skull'), -1)
  assert.equal(theWesternWallTokenValue(state, inv, 'cultist'), -3)
  assert.equal(theWesternWallTokenValue(state, inv, 'tablet'), -3)
  assert.equal(theWesternWallTokenValue(state, inv, 'elderthing'), -3)
  state.difficulty = 'hard'
  assert.equal(isHardSide(state), true)
  assert.equal(theWesternWallTokenValue(state, inv, 'skull'), -3, '层级 + 2')
  assert.equal(theWesternWallTokenValue(state, inv, 'cultist'), -5)
  assert.equal(theWesternWallTokenValue(state, inv, 'tablet'), -5)
  const hardCultist = theWesternWallChaosToken(state, inv, 'cultist')
  assert.deepEqual(hardCultist.onDraw, [{ type: 'scenarioToken', token: 'cultist', mode: 'floodedDamage' }])
  const hardTablet = theWesternWallChaosToken(state, inv, 'tablet')
  assert.equal(hardTablet.onDraw[0].mode, 'increaseFloodLevel')
  // 完全淹没 → 困难 [elder_thing] 自动失败；简单 [elder_thing] -5。
  const deep = state.locations.find(location => location.level === 4)
  inv.location = deep.id
  assert.equal(isFullyFlooded(state, deep.id), true)
  assert.equal(theWesternWallTokenValue(state, inv, 'elderthing'), -5)
  assert.equal(testAutoFail(state, inv, { drawn: ['elderthing'] }), true)
  assert.equal(testAutoFail(state, inv, { drawn: ['skull'] }), false)
  state.difficulty = 'standard'
  assert.equal(testAutoFail(state, inv, { drawn: ['elderthing'] }), false)
  const easyTablet = theWesternWallChaosToken(state, inv, 'tablet')
  assert.equal(easyTablet.onFail[0].mode, 'increaseFloodLevel')
  assert.equal(THE_WESTERN_WALL_TOKEN_MEANINGS.easy.cultist.delta, -3)
  assert.equal(THE_WESTERN_WALL_TOKEN_MEANINGS.hard.elderthing.autoFailWhenFullyFlooded, true)
})

test('P7 theWesternWall 标记效果：完全淹没受伤、提高淹没等级', () => {
  const { state, api } = setup(1, { records: { theExpeditionHeadedWest: true } })
  const inv = state.investigators[0]
  const deep = state.locations.find(location => location.level === 4)
  inv.location = deep.id
  assert.equal(behavior.applyTokenEffect(state, inv, { token: 'cultist', mode: 'floodedDamage' }, api), true)
  assert.equal(inv.damage, 1)
  const level1 = state.locations.find(location => location.level === 1)
  inv.location = level1.id
  assert.equal(behavior.applyTokenEffect(state, inv, { token: 'tablet', mode: 'increaseFloodLevel' }, api), true)
  assert.equal(behavior.waterLevel(state, api, level1.id), 1)
})

// ---------------------------------------------------------------------------
// 6. 幕目标
// ---------------------------------------------------------------------------
test('P7 theWesternWall 幕目标：西线全员到黑曜石地基、东线全员到西墙（达成后询问推进）', () => {
  const west = setup(2, { records: { theExpeditionHeadedWest: true } })
  west.api.choose = () => 'advance'
  west.state.investigators[0].location = 'obsidianFoundations'
  assert.equal(behavior.checkObjectives(west.state, west.api), false, '还有一人未到')
  west.state.investigators[1].location = 'obsidianFoundations'
  assert.equal(behavior.checkObjectives(west.state, west.api), true)
  assert.equal(west.api.advanced, 1)
  const east = setup(1, { records: { theExpeditionHeadedEast: true } })
  east.api.choose = () => 'advance'
  east.state.investigators[0].location = 'westernWall'
  assert.equal(behavior.checkObjectives(east.state, east.api), true)
  assert.equal(east.api.advanced, 1)
})

test('P7 theWesternWall 幕背面：西线 R1 → 结局 3（战役跳章）、东线 → 结局 2；西线无结局也绑结局 3', () => {
  const west = setup(1, { records: { theExpeditionHeadedWest: true } })
  assert.equal(behavior.actReveal(west.state, ACT_STAGES.west, west.api), true)
  assert.equal(west.api.finished, 'resolution3', '西线 R1 在战役层绑定结局 3 的跳章选择')
  assert.equal(west.state.scenarioFlags.twwResolutionEntry, 'resolution1')
  const east = setup(1, { records: { theExpeditionHeadedEast: true } })
  assert.equal(behavior.actReveal(east.state, ACT_STAGES.east, east.api), true)
  assert.equal(east.api.finished, 'resolution2')
  // 议程背面：全员被击败 + 1 点精神创伤；西线 → 结局 3，东线 → 无结局。
  const agendaWest = setup(2, { records: { theExpeditionHeadedWest: true } })
  assert.equal(behavior.agendaReveal(agendaWest.state, agendaWest.state.agendas[0], agendaWest.api), true)
  assert.equal(agendaWest.state.investigators.every(inv => inv.defeated === true), true)
  assert.equal(agendaWest.state.campaign.trauma[0].mental, 1)
  assert.equal(agendaWest.api.finished, 'resolution3')
  const agendaEast = setup(2, { records: { theExpeditionHeadedEast: true } })
  assert.equal(behavior.agendaReveal(agendaEast.state, agendaEast.state.agendas[0], agendaEast.api), true)
  assert.equal(agendaEast.api.finished, 'noResolution')
})

// ---------------------------------------------------------------------------
// 7. Do No Harm
// ---------------------------------------------------------------------------
test('P7 theWesternWall Do No Harm（帮助）：记录 helped、议程 +1 毁灭、结局加寄生虫与 2 点进度', () => {
  const state = stateWithScenario(1)
  state.investigators[0].assets.push({ code: DO_NO_HARM_TASK_CODES[0], originalCode: DO_NO_HARM_TASK_CODES[0] })
  const api = makeApi(state, { choose: request => (request.kind === 'story' ? 'bringAlong' : 'none'), taskOptions: { 0: 'doNoHarm' } })
  behavior.setupScenario(state, api)
  assert.equal(state.campaign.records.theExpeditionHelpedThePilgrim, true)
  assert.equal(state.doom, 1, '帮助朝圣者：议程上 1 毁灭')
  const result = behavior.resolution(state, 'resolution2', null, api)
  assert.equal(result.flowData.nextChapter, NEXT_CHAPTER_EAST)
  assert.deepEqual(api.topOfDeck, [[0, HUNTING_PARASITE_CODE]])
  const progress = api.progressChanges.find(row => row.track === 'tdcTask')
  assert.deepEqual(progress, { track: 'tdcTask', seat: 0, amount: 2, receipt: 'western-wall-do-no-harm' })
})

test('P7 theWesternWall Do No Harm（抛弃）：起始地点无线索、结局 1 点精神创伤与 -1 进度', () => {
  const state = stateWithScenario(1)
  state.investigators[0].assets.push({ code: DO_NO_HARM_TASK_CODES[1], originalCode: DO_NO_HARM_TASK_CODES[1] })
  const api = makeApi(state, { choose: request => (request.kind === 'story' ? 'leaveBehind' : 'none'), taskOptions: { 0: 'doNoHarm' } })
  behavior.setupScenario(state, api)
  assert.equal(state.campaign.records.theExpeditionLeftThePilgrim, true)
  const start = locationOf(state, state.investigators[0].location)
  assert.equal(start.clues, 0, '起始地点不放线索')
  behavior.resolution(state, 'resolution2', null, api)
  assert.equal(state.campaign.trauma[0].mental, 1)
  assert.equal(api.progressChanges.find(row => row.track === 'tdcTask').amount, -1)
  assert.deepEqual(api.topOfDeck, [])
})

// ---------------------------------------------------------------------------
// 8. 结局与跳章
// ---------------------------------------------------------------------------
test('P7 theWesternWall 结局：拉莱耶地图划除「西墙」、结局 2/东线无结局去沉睡者之墓、结局 3 跳章由战役流程决定', () => {
  const case1 = setup(1, { records: { theExpeditionHeadedWest: true }, choose: () => 'theDrownedQuarter' })
  const result1 = behavior.resolution(case1.state, 'resolution1', null, case1.api)
  assert.ok(case1.state.campaign.records.rlyehMap.includes('rlyehWesternWall'), '地图记录用战役规范 id')
  assert.equal(result1.flowData.resolution, 'resolution1')
  assert.equal(result1.flowData.resolutionEntry, 'resolution1')
  assert.ok(Array.isArray(result1.flowData.resolution3Choices))
  const case3 = setup(1, { records: { theExpeditionHeadedWest: true } })
  const result3 = behavior.resolution(case3.state, 'resolution3', null, case3.api)
  assert.equal(result3.flowData.resolution, 'resolution3')
  assert.equal(result3.flowData.nextChapter, undefined, '结局 3 的跳章选择由战役流程 westernWallShortcut 承担')
  const case2 = setup(1, { records: { theExpeditionHeadedEast: true } })
  const result2 = behavior.resolution(case2.state, 'resolution2', null, case2.api)
  assert.equal(result2.flowData.nextChapter, NEXT_CHAPTER_EAST)
  const noResEast = setup(1, { records: { theExpeditionHeadedEast: true } })
  assert.equal(behavior.resolution(noResEast.state, 'noResolution', null, noResEast.api).flowData.nextChapter,
    NEXT_CHAPTER_EAST)
  const noResWest = setup(1, { records: { theExpeditionHeadedWest: true } })
  const resultNoResWest = behavior.resolution(noResWest.state, 'noResolution', null, noResWest.api)
  assert.equal(resultNoResWest.flowData.nextChapter, undefined, '西线无结局并入结局 3 跳章选择')
  assert.deepEqual(behavior.resolution3Choices().map(option => option.id), [...RESOLUTION3_CHAPTERS])
  const chosen = setup(1, { records: { theExpeditionHeadedWest: true }, choose: () => 'theApiary' })
  assert.equal(behavior.chooseResolution3(chosen.state, chosen.api), 'theApiary')
})

// ---------------------------------------------------------------------------
// 9. 条目与投影
// ---------------------------------------------------------------------------
test('P7 theWesternWall 单卡条目：20 张注册、code 唯一、剧情/敌人/诡计 flags', () => {
  assert.equal(ENTRIES.length, 20)
  assert.equal(new Set(ENTRIES.map(entry => entry.code)).size, 20)
  for (const entry of ENTRIES) {
    assert.equal(registeredEntry(entry.code).code, entry.code)
    assert.ok(['agenda', 'act', 'location', 'enemy', 'treachery', 'storyAsset'].includes(entry.scope), `${entry.code} scope`)
  }
  assert.equal(implementedEntryFlags('11521').enterFromAbove.damage, 1)
  assert.equal(implementedEntryFlags('11522').enterTest.skill, 'agility')
  assert.equal(implementedEntryFlags('11519').objectiveAllAt, 'obsidianFoundations')
  assert.equal(implementedEntryFlags('11520').objectiveAllAt, 'westernWall')
  assert.equal(implementedEntryFlags('11526').revealUnderseaVault, true)
  assert.equal(implementedEntryFlags('11527').deepOneMovingConnectsFlooded, true)
  assert.equal(implementedEntryFlags('11528').glyphAction.letter, 'V')
  assert.equal(implementedEntryFlags('11531b').glyph.letter, 'W')
  assert.equal(implementedEntryFlags('11532b').glyph.letter, 'Z')
  assert.equal(implementedEntryFlags('11533').searchDeepOneOnEnter, true)
  assert.equal(registeredEntry('11534').implemented, true, '第二轮已接线；残余近似写在 note')
  assert.equal(registeredEntry('11535').implemented, true, '第二轮已接线 enemyPhaseEnd/spawnLocation')
  assert.equal(typeof registeredEntry('11531').encounterResolve, 'function')
  assert.equal(scenario.enemies['11533'].hunter, true)
  assert.equal(scenario.enemies['11535'].aloof, true)
  assert.equal(scenario.enemies['11535'].hunter, true)
})

test('P7 theWesternWall 只读投影与 JSON 存档往返', () => {
  const { state } = setup(2, { records: { theExpeditionHeadedWest: true } })
  const summary = scenarioSummary(state)
  assert.equal(summary.direction, 'west')
  assert.equal(summary.act, ACT_WEST_CODE)
  assert.equal(summary.agenda, AGENDA_CODE)
  assert.equal(summary.locations, 10)
  assert.deepEqual(summary.levelCounts, { 1: 1, 2: 1, 3: 2, 4: 3, 5: 3 })
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.scenarioFlags, state.scenarioFlags)
  assert.deepEqual(restored.scenarioZones, state.scenarioZones)
  assert.equal(restored.locations.length, state.locations.length)
})


// ---------------------------------------------------------------------------
// 9. saveReplay：真实 saveSnapshot / readSnapshot 持久化 + 同一动作重放
// ---------------------------------------------------------------------------
test('P7 theWesternWall saveReplay：saveSnapshot/readSnapshot 恢复后状态等价，西墙抽 3 张动作结果一致', async () => {
  const fsMod = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const home = fsMod.mkdtempSync(path.join(os.tmpdir(), 'dsh-tdc-tww-'))
  const previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = home
  try {
    const { saveSnapshot, readSnapshot, persistEnabled } = await import('../../../lib/sessions.js')
    assert.equal(persistEnabled(), true, 'BOARDGAME_PERSIST 默认开启路径必须被覆盖')
    const { state } = setup(1, { records: { theExpeditionHeadedWest: true } })
    const session = {
      sessionId: 'tdc-the-western-wall-save-replay',
      modId: 'arkhamhorror',
      state: JSON.parse(JSON.stringify(state)),
      players: [{ seat: 0, name: '调查员1' }],
      events: [{ kind: 'setup', note: 'test' }],
      settings: { difficulty: 'standard' },
    }
    const file = saveSnapshot(session)
    assert.equal(fsMod.existsSync(file), true, '快照文件应落盘')
    const restoredRecord = readSnapshot(session.sessionId)
    assert.ok(restoredRecord, 'readSnapshot 应返回记录')
    assert.equal(restoredRecord.sessionId ?? restoredRecord.session.sessionId, session.sessionId)
    const restoredState = restoredRecord.session.state
    assert.deepEqual(restoredState, JSON.parse(JSON.stringify(state)), '恢复后状态必须与内存状态等价')
    assert.deepEqual(restoredState.scenarioFlags.mechanics.flood, state.scenarioFlags.mechanics.flood,
      'P7 淹没状态（mechanicState）必须随存档恢复')

    // 同一动作：西墙 [action][action] 抽 3 张（每场游戏一次），两边的结果指纹一致。
    const moveOf = target => behavior.actions(target, target.investigators[0])
      .find(move => move.rule === 'twwWesternWallDraw')
    const freshMove = moveOf(state)
    const restoredMove = moveOf(restoredState)
    assert.ok(freshMove && restoredMove, '两个起点都必须提供同一动作')
    const apiFresh = makeApi(state)
    const apiRestored = makeApi(restoredState)
    assert.equal(behavior.performAction(state, state.investigators[0], freshMove, apiFresh), true)
    assert.equal(behavior.performAction(restoredState, restoredState.investigators[0], restoredMove, apiRestored), true)
    const fingerprint = target => JSON.stringify({
      hand: target.investigators[0].hand,
      flags: target.scenarioFlags,
      flood: target.scenarioFlags.mechanics.flood,
      summary: scenarioSummary(target),
    })
    assert.equal(fingerprint(restoredState), fingerprint(state), '恢复后继续同一动作的结果必须一致')
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    fsMod.rmSync(home, { recursive: true, force: true })
  }
})


// ---------------------------------------------------------------------------
// 10. 第二轮接线：11535 enemyPhaseEnd / 11534 威胁区与淹没进场恐惧（引擎既有读点）
// ---------------------------------------------------------------------------
test('P7 theWesternWall 第二轮接线：11535 敌军阶段末放毁灭弃自身、11534 失败入威胁区并按轮恐惧', () => {
  const { state, api } = setup(1, { records: { theExpeditionHeadedWest: true } })
  const location = state.locations.find(item => item.level === 2)
  state.investigators[0].location = location.id
  const asset = { id: 'asset-1', code: '01020', originalCode: '01020', controllerSeat: 0 }
  state.investigators[0].assets.push(asset)
  const parasite = api.spawn('11535', location.id)
  const doomCalls = []
  const discardCalls = []
  const apiEnemyPhase = {
    ...api,
    doomOn: (card, amount) => { doomCalls.push([card.id, amount]); card.doom = (Number(card.doom) || 0) + amount },
    discardEnemy: enemy => { discardCalls.push(enemy.id); state.enemies = state.enemies.filter(item => item !== enemy) },
  }
  assert.equal(behavior.enemyPhaseEnd(state, apiEnemyPhase), true, '敌军阶段结束强制必须结算')
  assert.deepEqual(doomCalls, [['asset-1', 1]], '在所在地点玩家卡上放 1 毁灭')
  assert.deepEqual(discardCalls, [parasite.id], '随后弃掉猎食寄生虫')
  assert.equal(state.enemies.includes(parasite), false)
  const spawnLocationId = behavior.spawnLocation(state, '11535', null, 0, api)
  assert.ok(location.connections.includes(spawnLocationId), '生成在连接地点')

  // 11534 显现：智力(3) 失败 → 进入威胁区（api.threat 唯一写入口）。
  const lookOut = ENTRIES.find(entry => entry.code === '11534')
  const threatCalls = []
  const apiRevelation = {
    last: null,
    test: (seat, skill, difficulty, resolve) => { apiRevelation.last = { seat, skill, difficulty }; resolve({ success: false }) },
    threat: (seat, code) => { threatCalls.push([seat, code]); return { seat, code } },
    info: () => {},
  }
  assert.equal(lookOut.encounterResolve(state, state.investigators[0], { code: '11534' }, apiRevelation), true)
  assert.deepEqual(apiRevelation.last, { seat: 0, skill: 'intellect', difficulty: 3 })
  assert.deepEqual(threatCalls, [[0, '11534']])

  // 强制：每轮首次进入淹没地点受 1 恐惧（同轮只一次，下一轮再触发）。
  state.investigators[0].threat.push({ id: 'threat-1', code: '11534', originalCode: '11534' })
  const flooded = state.locations.find(item => item.level === 4)
  const horrorBefore = state.investigators[0].horror
  state.round = 3
  assert.equal(behavior.locationEntered(state, state.investigators[0], flooded, api), true)
  assert.equal(state.investigators[0].horror, horrorBefore + 1)
  behavior.locationEntered(state, state.investigators[0], flooded, api)
  assert.equal(state.investigators[0].horror, horrorBefore + 1, '同一轮只触发一次')
  state.round = 4
  behavior.locationEntered(state, state.investigators[0], flooded, api)
  assert.equal(state.investigators[0].horror, horrorBefore + 2, '下一轮再次触发')

  // 回合结束检定走引擎既有 threatEffect.endTurnTest 读点（turn.js#runThreatEndTurn）。
  assert.deepEqual(registeredEntry('11534').threatEffect.endTurnTest, { skill: 'agility', difficulty: 3 })
  assert.equal(registeredEntry('11534').treacheryRule.threatArea, true)
  assert.equal(registeredEntry('11534').implemented, true)
  assert.equal(registeredEntry('11535').implemented, true)
})


// ---------------------------------------------------------------------------
// 11. 其余专属卡：淹没棚屋动态连接、符文 V/Z/W、海底壁画与水下秘库翻面
// ---------------------------------------------------------------------------
test('P7 theWesternWall 其余专属卡：淹没棚屋动态连接、破碎遗迹符文 V、黑曜石地基抽海底壁画、水下秘库/海底壁画翻面', () => {
  const { state, api } = setup(1, { records: { theExpeditionHeadedWest: true } })
  const inv = state.investigators[0]

  // 11527 淹没棚屋：深潜者敌人「移动时」才与完全淹没地点双向互连（enemyConnections 钩子）。
  const shanty = locationOf(state, 'drownedShanty')
  assert.ok(shanty, '淹没棚屋在入场 10 地点之一')
  const floodedLocation = state.locations.find(location => behavior.waterLevel(state, api, location.id) >= 2
    && location.id !== 'drownedShanty')
  assert.ok(floodedLocation, '西线 4–5 层存在完全淹没地点')
  behavior.syncShantyConnections(state, api)
  assert.equal(shanty.connections.includes(floodedLocation.id), false, '常态下淹没棚屋不并入完全淹没地点')
  const deepOneMover = { id: 'deep-mover', code: '11746', originalCode: '11746', traits: ['Humanoid', 'Monster', 'Deep One'], location: 'drownedShanty' }
  assert.ok(behavior.enemyConnections(state, deepOneMover, shanty).includes(floodedLocation.id),
    '深潜者移动时：淹没棚屋 → 任意完全淹没地点')
  assert.ok(behavior.enemyConnections(state, deepOneMover, floodedLocation).includes('drownedShanty'),
    '深潜者移动时：完全淹没地点 → 淹没棚屋（双向）')
  assert.deepEqual(behavior.enemyConnections(state, { traits: ['Humanoid'] }, shanty), [], '非深潜者不生效')
  assert.deepEqual(behavior.enemyConnections(state, deepOneMover, locationOf(state, 'westernWall')), [],
    '非淹没地点不回连淹没棚屋')

  // 11528 破碎遗迹：未淹没时发现符文 V（陌生人）。
  const ruins = locationOf(state, 'shatteredRuins')
  behavior.waterSet(state, {}, ruins.id, 0)
  inv.location = ruins.id
  const glyphMove = behavior.actions(state, inv).find(move => move.rule === 'twwLocationGlyph')
  assert.ok(glyphMove && glyphMove.reason === null)
  assert.equal(behavior.performAction(state, inv, glyphMove, api), true)
  assert.ok(state.campaign.records.discoveredGlyphs.includes('V'))
  assert.equal(state.scenarioFlags.twwGlyphTranslation.V, '陌生人')

  // 11529 黑曜石地基：智力(3) 成功抽出放一边的海底壁画（11531）。
  const foundations = locationOf(state, 'obsidianFoundations')
  inv.location = foundations.id
  const drawMove = behavior.actions(state, inv).find(move => move.rule === 'twwObsidianFoundations')
  assert.ok(drawMove)
  state.scenarioZones.setAside.includes('11531')
  const deckPuts = []
  const apiFrieze = { ...api, putOnEncounterDeck: codes => { deckPuts.push(...codes) }, drawEncounter: () => {} }
  assert.equal(behavior.performAction(state, inv, drawMove, apiFrieze), true)
  assert.deepEqual(deckPuts, ['11531'], '放到一边的海底壁画进入遭遇管线')
  assert.equal(state.scenarioZones.setAside.includes('11531'), false)

  // 11531/11531b 海底壁画：附属到地点；两次检定成功后翻面 → 符文 W（寄生虫）+ 加入胜利区。
  foundations.attachments ||= []
  foundations.attachments.push({ id: '11531:foundations', code: '11531', originalCode: '11531' })
  const friezeMove = behavior.actions(state, inv).find(move => move.rule === 'twwSeafloorFrieze')
  assert.ok(friezeMove)
  assert.equal(behavior.performAction(state, inv, friezeMove, api), true)
  assert.ok(state.campaign.records.discoveredGlyphs.includes('W'))
  assert.equal(state.scenarioFlags.twwGlyphTranslation.W, '寄生虫')
  assert.ok(state.victoryDisplay.some(entry => entry.code === '11531b'), '海底壁画 story 面进胜利区')

  // 11532/11532b 水下秘库：从沉没阶梯揭示入场后，智力(层级) 成功翻面 → 符文 Z（城市）。
  const stairway = locationOf(state, 'sunkenStairway')
  api.choose = () => '0'
  behavior.locationRevealed(state, stairway, api)
  const vault = locationOf(state, 'underseaVault')
  assert.ok(vault)
  inv.location = vault.id
  const vaultMove = behavior.actions(state, inv).find(move => move.rule === 'twwUnderseaVault')
  assert.ok(vaultMove)
  assert.equal(behavior.performAction(state, inv, vaultMove, api), true)
  assert.ok(state.campaign.records.discoveredGlyphs.includes('Z'))
  assert.equal(state.scenarioFlags.twwGlyphTranslation.Z, '城市')
  assert.equal(state.scenarioFlags.twwVaultFlipped, true)
})


// ---------------------------------------------------------------------------
// 12. 第二轮阶段2：11525 走已落地原语 preventEnemyReadyNextUpkeep；11535 用 placeDoomOnCard
// ---------------------------------------------------------------------------
test('P7 theWesternWall 第二轮阶段2：11525 珊瑚星之眷族调用 preventEnemyReadyNextUpkeep，11535 敌军阶段末用 placeDoomOnCard', () => {
  // 11525：揭示浅滩巢穴 → 生成横置珊瑚星之眷族，并调用 P7 已落地原语让其在下一补给阶段不重整。
  const first = setup(1, { records: { theExpeditionHeadedWest: true } })
  const shallowDen = first.state.locations.find(location => codeOfLocation(location) === '11525')
  assert.ok(shallowDen, '浅滩巢穴在入场 10 地点之一')
  const primitiveCalls = []
  const apiPrimitive = {
    ...first.api,
    scenario: {
      preventEnemyReadyNextUpkeep: enemy => {
        primitiveCalls.push(enemy.originalCode)
        enemy.skipNextUpkeepReady = true
        return true
      },
    },
  }
  assert.equal(behavior.locationRevealed(first.state, shallowDen, apiPrimitive), true)
  const coral = first.state.enemies.find(enemy => enemy.originalCode === '11727')
  assert.ok(coral, '珊瑚星之眷族生成')
  assert.equal(coral.exhausted, true, '横置状态生成')
  assert.deepEqual(primitiveCalls, ['11727'], '调用 preventEnemyReadyNextUpkeep')
  assert.equal(coral.skipNextUpkeepReady, true, '引擎读点 skipNextUpkeepReady 已写')
  // 没有运行时 api 时，behavior 退回写同一引擎读点（文档化的 fallback）。
  const second = setup(1, { records: { theExpeditionHeadedWest: true } })
  const shallowDen2 = second.state.locations.find(location => codeOfLocation(location) === '11525')
  behavior.locationRevealed(second.state, shallowDen2, second.api)
  assert.equal(second.state.enemies.find(enemy => enemy.originalCode === '11727')?.skipNextUpkeepReady, true)

  // 11535：敌军阶段结束时优先用 api.placeDoomOnCard 放 1 毁灭，然后弃掉自身。
  const third = setup(1, { records: { theExpeditionHeadedWest: true } })
  const location = third.state.locations.find(item => item.level === 2)
  third.state.investigators[0].location = location.id
  third.state.investigators[0].assets.push({ id: 'asset-2', code: '01020', originalCode: '01020' })
  third.api.spawn('11535', location.id)
  const doomPlaced = []
  const discarded = []
  const apiPhaseEnd = {
    ...third.api,
    placeDoomOnCard: (card, amount) => { doomPlaced.push([card.id, amount]) },
    discardEnemy: enemy => { discarded.push(enemy.originalCode) },
  }
  assert.equal(behavior.enemyPhaseEnd(third.state, apiPhaseEnd), true)
  assert.deepEqual(doomPlaced, [['asset-2', 1]])
  assert.deepEqual(discarded, ['11535'])
})

function codeOfLocation(location) {
  return String(location.originalCode || location.code || '')
}

// ---------------------------------------------------------------------------
// 13. Good Money（11611）跨章限制：章节 behavior.canGainResources 消费 campaign-rules
// ---------------------------------------------------------------------------
test('P7 theWesternWall Good Money 跨章限制：补给阶段 canGainResources 按 campaign.ruleFlags 命中', () => {
  const { state } = setup(1)
  const inv = state.investigators[0]
  assert.equal(behavior.canGainResources(state, inv), true, '无标记 → 正常获得资源')
  state.campaign.ruleFlags = {
    tdcNoUpkeepResources: { originScenario: 'theGrandVault', seats: [0], appliesToScenarioIndex: 7 },
  }
  state.campaign.scenarioIndex = 7
  assert.equal(behavior.canGainResources(state, inv), false, 'seat + scenarioIndex 命中 → 补给阶段不能获得资源')
  state.campaign.scenarioIndex = 8
  assert.equal(behavior.canGainResources(state, inv), true, 'scenarioIndex 不匹配 → 正常获得')
  state.campaign.scenarioIndex = 7
  assert.equal(behavior.canGainResources(state, { seat: 1 }), true, 'seat 不匹配 → 正常获得')
  // seats 为空表示全队都受限（Good Money playBothSides 失败口径）。
  state.campaign.ruleFlags.tdcNoUpkeepResources = { originScenario: 'theGrandVault', seats: [], appliesToScenarioIndex: 7 }
  assert.equal(behavior.canGainResources(state, { seat: 1 }), false, 'seats 为空 → 全队受限')
  delete state.campaign.ruleFlags.tdcNoUpkeepResources
  assert.equal(behavior.canGainResources(state, inv), true, '移除标记 → 恢复正常')
})


// ---------------------------------------------------------------------------
// 12. 第五轮：幕目标推进选择 / 11524 盟友选择 / 11535 领队选择玩家卡
// ---------------------------------------------------------------------------
test('P7 theWesternWall 幕目标：达成后询问推进/跳过（skip 不推进且本幕本回合不重复询问）', () => {
  const { state, api } = setup(1, { records: { theExpeditionHeadedWest: true } })
  state.investigators[0].location = 'obsidianFoundations'
  const prompts = []
  let answer = 'skip'
  api.choose = request => { prompts.push(request); return answer }
  assert.equal(behavior.checkObjectives(state, api), false, '选 skip 不推进')
  assert.equal(api.advanced, 0)
  assert.equal(behavior.checkObjectives(state, api), false)
  assert.equal(prompts.length, 1, '本幕本回合 skip 后不再重复询问')
  assert.equal(prompts[0].options.map(option => option.id).join(','), 'advance,skip')
  state.round = (Number(state.round) || 1) + 1
  answer = 'advance'
  assert.equal(behavior.checkObjectives(state, api), true, '下一回合可以重新选择推进')
  assert.equal(api.advanced, 1)
})

test('P7 theWesternWall 11524 致命通道：淹没无法提高时由玩家选择弃掉自己控制的[[盟友]]支援', () => {
  const { state, api } = setup(1, { records: { theExpeditionHeadedWest: true } })
  const deadlyPass = state.locations.find(location => String(location.originalCode || location.code) === '11524')
  assert.ok(deadlyPass, '致命通道在入场地点之一')
  behavior.waterSet(state, api, deadlyPass.id, 2)
  const inv = state.investigators[0]
  inv.location = deadlyPass.id
  inv.assets.push({ id: 'ally-1', code: '10041', originalCode: '10041' })
  inv.assets.push({ id: 'ally-2', code: '10041', originalCode: '10041' })
  const chooseCalls = []
  const discardCalls = []
  let answer = 'ally-2'
  const apiAlly = {
    ...api,
    choose: request => { chooseCalls.push(request); return answer },
    discardAsset: (seat, assetId) => { discardCalls.push([seat, assetId]); return true },
    // 进入检定固定失败，才会进入「无法提高淹没 → 弃盟友」分支。
    test: (seat, skill, difficulty, resolve) => resolve({ success: false }),
  }
  assert.equal(behavior.locationEntered(state, inv, deadlyPass, apiAlly), true)
  assert.equal(chooseCalls.length, 1, '只选择一次盟友')
  assert.deepEqual(chooseCalls[0].options.map(option => option.id), ['ally-1', 'ally-2'])
  assert.deepEqual(discardCalls, [[0, 'ally-2']], '弃置玩家选择的盟友支援')
  // 没有盟友时不崩溃。
  inv.assets = []
  behavior.waterSet(state, api, deadlyPass.id, 2)
  behavior.locationEntered(state, inv, deadlyPass, apiAlly)
})

test('P7 theWesternWall 11535 猎食寄生虫：敌军阶段末由领队选择所在地点的一张玩家卡放毁灭', () => {
  const { state, api } = setup(1, { records: { theExpeditionHeadedWest: true } })
  const location = state.locations.find(item => item.level === 2)
  state.investigators[0].location = location.id
  state.investigators[0].assets.push({ id: 'p1', code: '01020', originalCode: '01020' })
  state.investigators[0].assets.push({ id: 'p2', code: '01020', originalCode: '01020' })
  state.campaign.leadSeat = 0
  api.spawn('11535', location.id)
  const doomPlaced = []
  const chooseCalls = []
  const apiChoose = {
    ...api,
    choose: request => { chooseCalls.push(request); return 'p2' },
    placeDoomOnCard: (card, amount) => { doomPlaced.push([card.id, amount]) },
    discardEnemy: () => {},
  }
  assert.equal(behavior.enemyPhaseEnd(state, apiChoose), true)
  assert.equal(chooseCalls.length, 1)
  assert.equal(chooseCalls[0].seat, 0, '由领队选择')
  assert.deepEqual(chooseCalls[0].options.map(option => option.id).sort(), ['p1', 'p2'])
  assert.deepEqual(doomPlaced, [['p2', 1]], '毁灭放在领队选择的玩家卡上')
})


// ---------------------------------------------------------------------------
// 13. 第七轮：11531 不能离场（引擎 cannotLeavePlay 统一拒绝）
// ---------------------------------------------------------------------------
test('P7 theWesternWall 11531 海底壁画不能离场：条目声明 cannotLeavePlay、背面 11531b 不声明', () => {
  // 引擎读点：scenario-decks.js#encounterCardCannotLeavePlay 读条目 cannotLeavePlay === true，
  // 并被 detachEncounterAttachment / detachEncounterAttachmentById / discardEncounterAttachment 统一拒绝
  // （引擎侧断言见 Lead 的引擎测试；本 checkout 的引擎模块图当前存在与 content 的循环导入，
  //  无法在内容测试中 import engine.js —— 已在第七轮报告向 Lead 说明，修复后可在本文件补端到端断言）。
  assert.equal(registeredEntry('11531').cannotLeavePlay, true, '11531 声明 cannotLeavePlay')
  assert.notEqual(registeredEntry('11531b').cannotLeavePlay, true, '11531b（翻面）不声明 cannotLeavePlay')
  const attached = []
  const api = {
    attachToLocation: (locationId, attachment) => { attached.push({ locationId, attachment }); return attachment },
    info: () => {},
  }
  const state = { locations: [{ id: 'locA', attachments: [] }], encounterDiscard: [] }
  assert.equal(registeredEntry('11531').encounterResolve(state, { location: 'locA', seat: 0 }, { code: '11531' }, api), true)
  assert.equal(attached.length, 1, '显现附属一次')
  assert.equal(attached[0].locationId, 'locA')
  assert.equal(attached[0].attachment.code, '11531')
  assert.equal(attached[0].attachment.cannotLeavePlay, true, '附属实例同样带 cannotLeavePlay')
  // 同地点重复显现不再重复附属。
  assert.equal(registeredEntry('11531').encounterResolve(
    { locations: [{ id: 'locA', attachments: attached.map(item => item.attachment) }] },
    { location: 'locA', seat: 0 }, { code: '11531' }, api), false)
})
