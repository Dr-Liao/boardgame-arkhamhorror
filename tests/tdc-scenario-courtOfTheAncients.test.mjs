// P7 古代议庭（courtOfTheAncients · 提示卡 11612）章节测试。
//
// 覆盖：模块 import / manifest 结构 / 11 个规则地点（12 张地点卡）与竖直 4 层网格 / 2 幕 2 议程
// （路线化牌库）/ 结局键 / 遭遇牌库与放一边守恒（含路线组与 Star Spawn 处理）/ 崩塌档案库移出 1 张 /
// 向东路线淹没布局 / 大升降机 1–4 层滑动（连接与寻路即时更新、卡牌标记随行）/ 已激活面翻面与
// 幕 1 推进 / 成功调查改为滑动 / 不稳地基强制检定 / 符文（胜利区符文数、skull 值、祭坛进入限制、
// 破封取碎片）/ 宇宙预兆与符文诡计事件 / 四档混乱标记 / 结局记录 / JSON 存档往返。
//
// 本文件不 import engine.js：章节 behavior 只走内容层函数与 P2/P7 原语（网格坐标用 mechanicState）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { mechanicState } from '../src/engine/mechanic-state.js'
import { assertScenarioManifest } from '../content/schema.js'
import { scenarioZoneReport } from '../content/scenario-manifest.js'
import * as chapter from '../content/campaigns/theDrownedCity/scenarios/courtOfTheAncients/index.js'
import {
  scenario, ACT_CODES, AGENDA_CODES, RESOLUTION_KEYS, RESOLUTION_BY_ROUTE, LOCATIONS, LOCATION_IDS,
  LOCATION_CELLS, LOCATION_CONNECTIONS, FIXED_LOCATION_IDS, ARCHIVE_IDS, ARCHIVE_CODES,
  ARCHIVE_SLOT_CELLS, GREAT_LIFT_ID, LIFT_LEVELS, LIFT_CELL_BY_LEVEL, LIFT_LEVEL_BY_ROUTE,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, GATHER_GROUPS, REQUIRED_ENCOUNTER_GROUPS, ROUTE_GATHER_GROUPS,
  routeGroupDeck, starSpawnRemainder, encounterDeckFor, SET_ASIDE_ALIASES, STAR_SPAWN_OBSERVER_CODE,
  STAR_SPAWN_OTHER_CODES, INESCAPABLE_SET_CODES, SHARD_CODE, COLOSSAL_TYRANT_CODE, GLYPH_RECORDS,
  GLYPH_RUNE_ORDER, TRANSLATED_GLYPHS_FOR_ELITE, GLYPHS_FOR_ALTAR, START_LOCATION_BY_ROUTE,
  SCENARIO_TEXT, SETUP_STEPS, ACT_STAGES, AGENDA_STAGES, ACT_CODE_BY_ROUTE,
  encounterDefinitions,
} from '../content/campaigns/theDrownedCity/scenarios/courtOfTheAncients/definition.js'
import {
  behavior, prepareScenario, setupScenario, routeOf, currentActCode, currentAgendaCode,
  liftState, liftNeighbors, setLiftConnections, slideGreatLift, flipGreatLift, afterLiftMoved,
  translateGlyph, translatedGlyphCount, glyphCount, shardControlledBy, giveShard, altarSealDifficulty,
  eliteKeeperKeywordsActive, locationShroudModifier, enemyDefeated, moveError, checkObjectives,
  actReveal, agendaReveal, resolution, discardCountFor, increaseFloodLevel, decreaseFloodLevel,
  spawnEnemy, isGlyphTranslated,
} from '../content/campaigns/theDrownedCity/scenarios/courtOfTheAncients/behavior.js'
import {
  courtChaosToken, courtChaosTokenValue, courtTokenText, skullValue, cultistValue, glyphCardsInVictory,
  stowawayAtLocation, locationFlooded, isHardSide, COURT_TOKEN_MEANINGS, CHAOS_TOKEN_FACES,
  translatedGlyphCount as chaosTranslatedGlyphCount,
} from '../content/campaigns/theDrownedCity/scenarios/courtOfTheAncients/chaos.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ENTRY_DIR = resolve(HERE, '../src/cards/encounter-entries/theDrownedCity/courtOfTheAncients')
const ENTRY_FILES = readdirSync(ENTRY_DIR).filter(name => name.endsWith('.js')).sort()
const ENTRIES = []
for (const name of ENTRY_FILES) ENTRIES.push((await import(`file:///${ENTRY_DIR.replace(/\\/g, '/')}/${name}`)).default)
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

const clone = value => JSON.parse(JSON.stringify(value))
const stateFor = (investigatorCount = 1, records = {}) => ({
  investigators: Array.from({ length: investigatorCount }, (_, seat) => ({
    seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
    assets: [], hand: [], deck: [], discard: [], threat: [], defeated: false, resigned: false,
  })),
  locations: [], enemies: [], storyAssets: [], encounterDeck: [], encounterDiscard: [],
  scenarioFlags: {}, scenarioZones: {},
  campaign: { leadSeat: 0, records: { ...records }, trauma: {}, investigators: {} },
  victoryDisplay: [], doom: 0, difficulty: 'standard', numInvestigators: investigatorCount,
  phase: 'investigation', round: 1, status: 'playing', acts: [], agendas: [], actIndex: 0, agendaIndex: 0,
})
const stateWithScenario = (count = 1, records = {}) => {
  const state = stateFor(count, records)
  state.scenario = clone(scenario)
  return state
}
const makeApi = (state, options = {}) => {
  let serial = 0
  const api = {
    state, info: () => {}, finished: null, presented: [], tests: [], choices: [],
    choose: options.choose || (() => null),
    random: options.random || (() => 0.5),
    shuffle: options.shuffle || (list => [...list]),
    testResult: options.testResult || { success: false, failedBy: 1 },
    present: (_text, meta) => api.presented.push(meta),
    test(seat, skill, difficulty, resolve) {
      const result = typeof api.testResult === 'function' ? api.testResult(seat, skill, difficulty) : api.testResult
      api.lastTest = { seat, skill, difficulty, result }
      api.tests.push(api.lastTest)
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
    finish(key) { api.finished = key },
    advanceAct() {
      const act = state.acts[state.actIndex]
      behavior.actReveal(state, act, api)
      state.actIndex += 1
    },
    resign(seat) { state.investigators[seat].resigned = true },
    spawn(code, locationId, extra = {}) {
      serial += 1
      const enemy = { id: `${code}-${serial}`, code, originalCode: code, name: code, location: locationId,
        fight: 0, evade: 0, health: 1, damage: 0, horror: 0, traits: [...(ALL_CARDS[code]?.traits || [])], exhausted: extra.exhausted === true,
        engagedSeat: extra.engagedSeat ?? null, damageTaken: 0, doom: 0, clues: 0, attachments: [], victory: 0 }
      state.enemies.push(enemy)
      return enemy
    },
    giveAsset(seat, code) {
      const asset = { id: `asset-${code}-${seat}`, code, originalCode: code, name: code, controllerSeat: seat,
        ownerSeat: seat, exhausted: false, damage: 0, horror: 0, tokens: 0, attachments: [], assets: [] }
      state.investigators[seat].assets.push(asset)
      return asset
    },
    addStoryToVictory(code, extra = {}) {
      if (!state.victoryDisplay.some(entry => (entry.originalCode || entry.code) === code)) {
        state.victoryDisplay.push({ id: extra.sourceId || code, code, originalCode: code,
          name: code, victory: Number(ALL_CARDS[code]?.victory) || 1 })
      }
      return true
    },
    attachEncounterToLocation(code, locationId) {
      const loc = state.locations.find(item => item.id === locationId)
      if (!loc) return false
      loc.attachments ||= []
      loc.attachments.push({ code, originalCode: code, name: code })
      return true
    },
    moveInvestigator(seat, destination) { state.investigators[seat].location = destination },
    reveal(id) {
      const location = state.locations.find(item => item.id === id)
      if (location) location.revealed = true
      return Boolean(location)
    },
  }
  api.mechanics = {}
  return api
}
const setup = (count = 1, records = {}, options = {}) => {
  const state = stateWithScenario(count, records)
  const api = makeApi(state, options)
  behavior.setupScenario(state, api)
  return { state, api }
}
const locationOf = (state, id) => state.locations.find(location => location.id === id) || null
const gridOf = (state, id) => mechanicState(state).grid?.[id] || null
const levelOf = (state, id) => gridOf(state, id) ? gridOf(state, id).y + 1 : null

// ---------------------------------------------------------------------------
// 1. 结构 / manifest
// ---------------------------------------------------------------------------
test('P7 courtOfTheAncients 结构：27 条目、11 规则地点（12 张地点卡）、2 幕 2 议程、development manifest', () => {
  assert.equal(chapter.scenario.id, 'courtOfTheAncients')
  assert.equal(chapter.scenario.referenceCode, '11612')
  assert.equal(chapter.manifest.status, 'development')
  assert.equal(chapter.manifest.campaignId, 'theDrownedCity')
  assert.equal(chapter.manifest.contentVersion, '0.1.0')
  assert.doesNotThrow(() => assertScenarioManifest(chapter.manifest))
  assert.equal(chapter.manifest.locations.length, LOCATION_IDS.length)
  assert.equal(LOCATION_IDS.length, 11)
  assert.deepEqual([...ACT_CODES], ['11616', '11617', '11618'])
  assert.deepEqual([...AGENDA_CODES], ['11613', '11614', '11615'])
  assert.equal(scenario.acts.length, 2, '路线只入 2 幕')
  assert.equal(scenario.agendas.length, 2)
  assert.deepEqual(Object.keys(scenario.resolutions), [...RESOLUTION_KEYS])
  assert.deepEqual([...RESOLUTION_KEYS], ['noResolution', 'resolution1', 'resolution2'])
  assert.deepEqual(RESOLUTION_BY_ROUTE, { west: 'resolution1', east: 'resolution2' })
  assert.equal(chapter.implementedEncounterCodes.length, 27)
  assert.equal(ENTRIES.length, 27)
  assert.equal(new Set(ENTRIES.map(entry => entry.code)).size, 27)
  assert.deepEqual(ENTRIES.map(entry => entry.code).sort(), [...chapter.implementedEncounterCodes].sort())
  for (const entry of ENTRIES) assert.equal(ENTRY_FILES.includes(`${entry.code}.js`), true, `${entry.code}.js`)
  assert.deepEqual([...REQUIRED_ENCOUNTER_GROUPS].sort(), [
    'courtOfTheAncients', 'domination', 'dreams', 'elderMist', 'theInescapable', 'rlyeh', 'starSpawn',
    'stowaways', 'pilgrims',
  ].sort())
  assert.equal(SCENARIO_TEXT.textLanguage, 'en')
  assert.ok(SCENARIO_TEXT.specialRules.length >= 1, '「大升降机与滑动地点」特别规则')
  assert.ok(SCENARIO_TEXT.setup.length > 0)
  assert.ok(SETUP_STEPS.length >= 20)
  assert.equal(chapter.manifest.archiveDeck.removedCount, 1)
  assert.equal(chapter.manifest.archiveDeck.inPlayCount, 5)
  assert.deepEqual(chapter.manifest.greatLift.levels, [...LIFT_LEVELS])
})

test('P7 courtOfTheAncients 地点与 layout：竖直 4 层塔、静态连接只有东侧前厅 ↔ 古代祭坛', () => {
  assert.equal(FIXED_LOCATION_IDS.length, 5)
  assert.equal(ARCHIVE_IDS.length, 6)
  assert.deepEqual(LOCATION_CELLS.westAntechamber, { x: 0, y: 0 })
  assert.deepEqual(LOCATION_CELLS.eastAntechamber, { x: 2, y: 0 })
  assert.deepEqual(LOCATION_CELLS.ancientAltar, { x: 3, y: 0 })
  assert.deepEqual(LOCATION_CELLS.twistingCatwalks, { x: 0, y: 3 })
  assert.deepEqual([...LIFT_LEVELS], [1, 2, 3, 4])
  assert.deepEqual(LIFT_CELL_BY_LEVEL[1], { x: 1, y: 0 })
  assert.deepEqual(LIFT_CELL_BY_LEVEL[4], { x: 1, y: 3 })
  assert.deepEqual([...LOCATION_CONNECTIONS.eastAntechamber], ['ancientAltar'])
  assert.deepEqual([...LOCATION_CONNECTIONS.ancientAltar], ['eastAntechamber'])
  for (const id of ARCHIVE_IDS) assert.deepEqual([...LOCATION_CONNECTIONS[id]], [])
  for (const id of LOCATION_IDS) assert.ok(chapter.layout.locations[id], `layout 覆盖 ${id}`)
  assert.equal(chapter.layout.edges.length, 2, '东侧前厅 ↔ 古代祭坛 双向展示边')
  const report = scenarioZoneReport(scenario, chapter.manifest)
  assert.equal(report.locationCount, 11)
  assert.equal(report.unresolvedAliases.length, 0)
})

// ---------------------------------------------------------------------------
// 2. 遭遇牌库 / 放一边守恒
// ---------------------------------------------------------------------------
test('P7 courtOfTheAncients 遭遇牌库：固定组 33 张 + 路线组 + 1 名 Star Spawn 残余；放一边 5 张声明', () => {
  assert.equal(ENCOUNTER_DECK.length, 33)
  assert.equal(ENCOUNTER_DECK.filter(code => code === '11636').length, 4, '宇宙预兆 ×4')
  assert.equal(ENCOUNTER_DECK.filter(code => code === '11745').length, 3, '仍在你身后 ×3 在牌库')
  assert.equal(ENCOUNTER_DECK.filter(code => code === STAR_SPAWN_OBSERVER_CODE).length, 0, '观察者放一边')
  assert.deepEqual(routeGroupDeck('west').length, 6)
  assert.deepEqual(routeGroupDeck('east').length, 4)
  assert.equal(starSpawnRemainder('west').length, 1)
  assert.equal(starSpawnRemainder('east').length, 0)
  assert.equal(encounterDeckFor('west').length, 33 + 6 + 1)
  assert.equal(encounterDeckFor('east').length, 33 + 4 + 0)
  const groupCodes = new Set()
  const groupDeck = Object.entries(ALL_CARDS)
    .filter(([, card]) => [...GATHER_GROUPS, ...Object.values(ROUTE_GATHER_GROUPS)]
      .map(group => group.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()).includes(card.encounterCode))
    .filter(([, card]) => ['enemy', 'treachery', 'asset'].includes(card.type))
    .flatMap(([code, card]) => {
      groupCodes.add(code)
      return Array(Math.max(1, Number(card.quantity) || 1)).fill(code)
    })
    .filter(code => !['11723', '11724'].includes(code))
  const declared = chapter.manifest.zones.encounterDeck.reduce((sum, entry) => sum + entry.count, 0)
    + chapter.manifest.zones.setAside.filter(entry => groupCodes.has(entry.cardCode)).reduce((sum, entry) => sum + entry.count, 0)
  const removed = STAR_SPAWN_OTHER_CODES.filter(code => !starSpawnRemainder('west').includes(code)).length
  assert.equal(declared + removed + routeGroupDeck('west').length + starSpawnRemainder('west').length, groupDeck.length,
    '静态牌库 + 放一边 + Star Spawn 移出 + 路线组 + Star Spawn 残余 = 组内全部（向西路线）')
  assert.equal(chapter.manifest.zones.setAside.some(entry => entry.cardCode === '11622b'), true, '大升降机已激活面放一边')
  const { state } = setup(1, { theExpeditionHeadedWest: true })
  assert.equal(state.scenarioZones.setAside.includes(STAR_SPAWN_OBSERVER_CODE), true)
  assert.equal(state.scenarioZones.setAside.length, SET_ASIDE_ALIASES.length, '向西：大升降机已激活面 + Shard + 暴君 + 观察者 + Inescapable 敌人')
  assert.equal(state.scenarioZones.removed.length, 2, '向西随机移出 2 张 Star Spawn')
})

// ---------------------------------------------------------------------------
// 3. 布置（向西 / 向东）
// ---------------------------------------------------------------------------
test('P7 courtOfTheAncients 向西布置：大升降机第 1 层、东侧前厅开场、崩塌档案库 5 张按环位入场', () => {
  const { state } = setup(1, { theExpeditionHeadedWest: true })
  const report = prepareScenario(state, { info: () => {} })
  assert.equal(report.route, 'west')
  assert.equal(report.startLocation, 'eastAntechamber')
  assert.equal(report.liftLevel, 1)
  assert.deepEqual(report.resolutionKey, 'resolution1')
  assert.equal(state.investigators[0].location, 'eastAntechamber')
  assert.equal(state.locations.length, 10, '5 固定 + 5 张档案库')
  const placedArchives = ARCHIVE_IDS.filter(id => locationOf(state, id))
  assert.equal(placedArchives.length, 5)
  const removed = ARCHIVE_IDS.filter(id => !placedArchives.includes(id))
  assert.equal(removed.length, 1)
  const occupied = placedArchives.map(id => `${gridOf(state, id).x},${gridOf(state, id).y}`).sort()
  assert.deepEqual(occupied, ARCHIVE_SLOT_CELLS.map(cell => `${cell.x},${cell.y}`).sort())
  assert.equal(levelOf(state, GREAT_LIFT_ID), 1)
  assert.equal(liftState(state).level, 1)
  assert.equal(liftState(state).active, false)
  assert.equal(locationOf(state, GREAT_LIFT_ID).code, '11622')
  // 大升降机与左右相邻地点相连（东侧前厅 / 西侧前厅）。
  assert.deepEqual(liftNeighbors(state).sort(), ['eastAntechamber', 'westAntechamber'])
  assert.equal(locationOf(state, 'eastAntechamber').connections.includes(GREAT_LIFT_ID), true)
  assert.equal(locationOf(state, 'westAntechamber').connections.includes(GREAT_LIFT_ID), true)
  // 向西路线不淹没。
  for (const inv of state.investigators) void inv
  for (const loc of state.locations) assert.equal(mechanicState(state).flood?.[loc.id] || 0, 0, `向西不淹没 ${loc.id}`)
})

test('P7 courtOfTheAncients 向东布置：大升降机第 4 层、扭曲栈桥开场、1 层全淹没/2 层部分淹没', () => {
  const { state } = setup(1, { theExpeditionHeadedWest: false })
  const report = prepareScenario(state, { info: () => {} })
  assert.equal(report.route, 'east')
  assert.equal(report.startLocation, 'twistingCatwalks')
  assert.equal(report.liftLevel, 4)
  assert.deepEqual(report.resolutionKey, 'resolution2')
  assert.equal(state.investigators[0].location, 'twistingCatwalks')
  assert.equal(levelOf(state, GREAT_LIFT_ID), 4)
  const eastNeighbors = liftNeighbors(state)
  assert.equal(eastNeighbors.length, 2)
  assert.equal(eastNeighbors.includes('twistingCatwalks'), true)
  assert.equal(eastNeighbors.some(id => ARCHIVE_IDS.includes(id)), true)
  const flood = mechanicState(state).flood
  assert.equal(flood.westAntechamber, 2, '第 1 层完全淹没')
  assert.equal(flood.eastAntechamber, 2)
  assert.equal(flood.ancientAltar, 2)
  const level2 = state.locations.filter(loc => levelOf(state, loc.id) === 2)
  assert.equal(level2.length, 2)
  for (const loc of level2) assert.equal(flood[loc.id], 1, '第 2 层部分淹没')
  assert.equal(flood[GREAT_LIFT_ID] || 0, 0, '第 4 层的大升降机不受影响')
  assert.equal(state.scenarioZones.removed.length, 3, '向东移出全部其他 Star Spawn')
})

// ---------------------------------------------------------------------------
// 4. 大升降机：滑动 / 邻接 / 随行 / 翻面 / 强制检定
// ---------------------------------------------------------------------------
test('P7 courtOfTheAncients 大升降机滑动：牌与标记随行、左右邻接与路径即时更新、层级边界', () => {
  const { state } = setup(2, { theExpeditionHeadedWest: true })
  const lift = locationOf(state, GREAT_LIFT_ID)
  lift.resources = 2
  lift.attachments = [{ code: '11636', originalCode: '11636', name: '宇宙预兆' }]
  state.investigators[0].location = GREAT_LIFT_ID
  assert.equal(slideGreatLift(state, 'up', { info: () => {} }), true)
  assert.equal(levelOf(state, GREAT_LIFT_ID), 2)
  assert.equal(locationOf(state, GREAT_LIFT_ID).resources, 2, '标记随升降机保留')
  assert.equal(locationOf(state, GREAT_LIFT_ID).attachments.length, 1, '附属卡随升降机保留')
  const neighbors = liftNeighbors(state)
  assert.equal(neighbors.length, 2, '第 2 层左右各有一张档案库')
  for (const id of neighbors) {
    assert.equal(locationOf(state, id).connections.includes(GREAT_LIFT_ID), true)
    assert.equal(locationOf(state, GREAT_LIFT_ID).connections.includes(id), true)
  }
  assert.equal(locationOf(state, 'westAntechamber').connections.includes(GREAT_LIFT_ID), false, '旧邻接立即失效')
  // 边界：从第 2 层向下两次到第 1 层后不能继续向下。
  assert.equal(slideGreatLift(state, 'down', {}), true)
  assert.equal(levelOf(state, GREAT_LIFT_ID), 1)
  assert.equal(slideGreatLift(state, 'down', {}), false, '不能低于第 1 层')
  // 向上到第 4 层后不能继续向上。
  for (let index = 0; index < 3; index += 1) assert.equal(slideGreatLift(state, 'up', {}), true)
  assert.equal(levelOf(state, GREAT_LIFT_ID), 4)
  assert.equal(slideGreatLift(state, 'up', {}), false, '不能高于第 4 层')
  const topNeighbors = liftNeighbors(state)
  assert.equal(topNeighbors.includes('twistingCatwalks'), true)
  assert.equal(topNeighbors.some(id => ARCHIVE_IDS.includes(id)), true)
})

test('P7 courtOfTheAncients 不稳地基：大升降机移动后其上调查员敏捷(2)检定，失败 1 伤害', () => {
  const { state } = setup(2, { theExpeditionHeadedWest: true })
  state.agendaIndex = 1
  state.investigators[0].location = GREAT_LIFT_ID
  state.investigators[1].location = 'eastAntechamber'
  const api = makeApi(state, { testResult: { success: false, failedBy: 1 } })
  assert.equal(afterLiftMoved(state, api), true)
  assert.equal(api.tests.length, 1, '只有在大升降机的 1 位调查员检定')
  assert.equal(api.tests[0].skill, 'agility')
  assert.equal(api.tests[0].difficulty, 2)
  assert.equal(state.investigators[0].damage, 1)
  assert.equal(state.investigators[1].damage, 0)
})

test('P7 courtOfTheAncients 大升降机翻面：最后一个线索 → 已激活面（保留标记）→ 立刻推进幕 1', () => {
  const { state, api } = setup(2, { theExpeditionHeadedWest: true })
  const lift = locationOf(state, GREAT_LIFT_ID)
  lift.clues = 0
  lift.resources = 1
  state.investigators[0].location = GREAT_LIFT_ID
  assert.equal(behavior.afterInvestigate(state, state.investigators[0], lift, { success: true }, api), true)
  const flipped = locationOf(state, GREAT_LIFT_ID)
  assert.equal(flipped.code, '11622b')
  assert.equal(flipped.originalCode, '11622b')
  assert.equal(flipped.resources, 1, '保留标记')
  assert.equal(liftState(state).active, true)
  assert.equal(state.scenarioZones.setAside.includes('11622b'), false)
  assert.equal(state.actIndex, 1, '幕 1 翻面后立刻推进')
  // 幕 1 背面：巨型暴君生成在大升降机，敏捷(3) 成功则横置。
  const tyrant = state.enemies.find(enemy => String(enemy.originalCode || enemy.code) === COLOSSAL_TYRANT_CODE)
  assert.ok(tyrant)
  assert.equal(tyrant.location, GREAT_LIFT_ID)
  assert.equal(api.tests.some(test => test.skill === 'agility' && test.difficulty === 3), true)
})

test('P7 courtOfTheAncients 已激活面调查：改为不发现线索、滑动升降机一次（可花线索再滑一次）', () => {
  const { state, api } = setup(1, { theExpeditionHeadedWest: true })
  flipGreatLift(state, api)
  state.actIndex = 0
  const lift = locationOf(state, GREAT_LIFT_ID)
  const beforeLevel = levelOf(state, GREAT_LIFT_ID)
  api.choose = () => 'up'
  const replaced = behavior.investigateResult(state, state.investigators[0], lift, { success: true }, api)
  assert.equal(replaced, false, '调查结果被改写（不发现线索）')
  assert.equal(levelOf(state, GREAT_LIFT_ID), beforeLevel + 1)
})

// ---------------------------------------------------------------------------
// 5. 符文 / 祭坛 / 地点修正
// ---------------------------------------------------------------------------
test('P7 courtOfTheAncients 符文：击败守护者译符文、胜利区符文驱动 [skull]、祭坛进入限制与破封取碎片', () => {
  const { state, api } = setup(1, { theExpeditionHeadedWest: true })
  state.investigators[0].location = 'eastAntechamber'
  const keeper = spawnEnemy(state, '11630', 'eastAntechamber', api)
  assert.equal(behavior.enemyDefeated(state, keeper, api), true)
  assert.equal(isGlyphTranslated(state, 'rune_k'), true)
  assert.equal(glyphCount(state), 1)
  assert.equal(skullValue(state), 1)
  assert.equal(courtChaosTokenValue(state, 'skull'), -1)
  state.difficulty = 'hard'
  assert.equal(isHardSide(state), true)
  assert.equal(skullValue(state), 2, '困难/专家：符文数 +1')
  state.difficulty = 'standard'
  // 胜利区符文 <3：不能进入古代祭坛。
  assert.match(moveError(state, state.investigators[0], locationOf(state, 'ancientAltar')), /3 张/)
  translateGlyph(state, '11631', api)
  translateGlyph(state, '11632', api)
  assert.equal(glyphCount(state), 3)
  assert.equal(moveError(state, state.investigators[0], locationOf(state, 'ancientAltar')), null)
  // 古代祭坛破封：难度 5 - floor(已翻译/5)。
  assert.equal(translatedGlyphCount(state), 3)
  assert.equal(altarSealDifficulty(state), 5)
  state.investigators[0].location = 'ancientAltar'
  state.investigators[0].clues = 0
  const action = behavior.actions(state, state.investigators[0])
    .find(move => move.rule === 'courtBreakSeal')
  assert.ok(action)
  api.choose = () => 'willpower'
  api.testResult = { success: true }
  assert.equal(behavior.performAction(state, state.investigators[0], action, api), true)
  assert.ok(shardControlledBy(state), '破封成功控制伊克雷希特碎片')
  assert.equal(state.campaign.records.shardOfYchlecht, undefined, '结局时才记录')
  // 已翻译 ≥10 符文：守护者获得关键词（跨章记录）。
  for (const rune of ['rune_l', 'rune_m', 'rune_n', 'rune_o', 'rune_p', 'rune_d', 'rune_b']) {
    state.campaign.records.discoveredGlyphs.push(rune)
  }
  assert.equal(eliteKeeperKeywordsActive(state), true)
  assert.equal(chaosTranslatedGlyphCount(state), 10)
})

test('P7 courtOfTheAncients 地点隐藏值修正：梦之档案库按胜利区符文 -1、历史档案库按附属符文 +1', () => {
  const { state, api } = setup(1, { theExpeditionHeadedWest: false })
  const dreams = locationOf(state, 'archiveOfDreams')
  const history = locationOf(state, 'archiveOfHistory')
  assert.ok(dreams && history)
  assert.equal(locationShroudModifier(state, dreams), 0)
  translateGlyph(state, '11630', api)
  translateGlyph(state, '11631', api)
  assert.equal(locationShroudModifier(state, dreams), -2, '每张胜利区[[符文]] -1')
  history.attachments = [{ code: '11632', originalCode: '11632' }, { code: '11633', originalCode: '11633' }]
  assert.equal(locationShroudModifier(state, history), 2, '每张附属符文 +1')
})

// ---------------------------------------------------------------------------
// 6. 幕 / 议程 / 结局
// ---------------------------------------------------------------------------
test('P7 courtOfTheAncients 幕 2 撤离：全员撤退推进并按路线进入结局 1/2', () => {
  const west = setup(1, { theExpeditionHeadedWest: true })
  west.api.testResult = { success: true }
  west.state.actIndex = 1
  west.state.investigators[0].location = 'twistingCatwalks'
  const resign = behavior.actions(west.state, west.state.investigators[0]).find(move => move.rule === 'courtResign')
  assert.ok(resign, 'v.I 在扭曲栈桥撤离')
  behavior.performAction(west.state, west.state.investigators[0], resign, west.api)
  assert.equal(west.state.investigators[0].resigned, true)
  assert.equal(checkObjectives(west.state, west.api), true)
  assert.equal(west.api.finished, 'resolution1')

  const east = setup(1, { theExpeditionHeadedWest: false })
  east.state.actIndex = 1
  east.state.investigators[0].location = 'eastAntechamber'
  const resignEast = behavior.actions(east.state, east.state.investigators[0]).find(move => move.rule === 'courtResign')
  assert.ok(resignEast, 'v.II 在东侧前厅撤离')
  behavior.performAction(east.state, east.state.investigators[0], resignEast, east.api)
  checkObjectives(east.state, east.api)
  assert.equal(east.api.finished, 'resolution2')
})

test('P7 courtOfTheAncients 议程背面：淹没档案塔降低淹没并洗回预兆/符文；不稳地基全体被击败', () => {
  const { state, api } = setup(2, { theExpeditionHeadedWest: false })
  state.encounterDiscard = ['11636', '11731', '11749', '11745']
  const before = mechanicState(state).flood?.westAntechamber || 0
  assert.equal(behavior.agendaReveal(state, state.agendas[0], api), true, '向东议程 1 背面')
  assert.ok((mechanicState(state).flood?.westAntechamber || 0) <= before, '降低每处地点淹没等级')
  assert.equal(state.encounterDiscard.includes('11636'), false, '预兆/符文洗回牌库')
  assert.ok(state.encounterDeck.includes('11636'))
  behavior.agendaReveal(state, state.agendas[1], api)
  assert.equal(state.investigators.every(inv => inv.defeated), true)
  assert.equal(state.campaign.trauma[0].mental, 1)
})

test('P7 courtOfTheAncients 结局：R\'lyeh 地图 + Shard of Y\'ch\'lecht 记录；幕 1 弃牌数量', () => {
  const { state, api } = setup(1, { theExpeditionHeadedWest: true })
  giveShard(state, 0, api)
  const result = resolution(state, 'resolution1', [], api)
  assert.deepEqual(result, { award: true })
  assert.deepEqual(state.campaign.records.rlyehMap, ['courtOfTheAncients'])
  assert.equal(state.campaign.records.shardOfYchlecht, true)
  assert.equal(state.actIndex, 0)
  assert.equal(discardCountFor(state), 8, '单人时弃 8 张')
  state.numInvestigators = 2
  state.investigators.push({ ...state.investigators[0], seat: 1, name: '调查员2', assets: [], clues: 0, hand: [] })
  assert.equal(discardCountFor(state), 5, '多人时弃 5 张')
})

// ---------------------------------------------------------------------------
// 7. 混乱标记
// ---------------------------------------------------------------------------
test('P7 courtOfTheAncients 混乱标记：四档取值（cultist 偷渡者 / tablet 淹没再揭示 / elder_thing 战斗）', () => {
  const { state, api } = setup(2, { theExpeditionHeadedWest: false })
  state.investigators[0].location = 'eastAntechamber'
  assert.equal(courtChaosTokenValue(state, 'cultist', state.investigators[0]), -2)
  const stowaway = spawnEnemy(state, '11721', 'eastAntechamber', api)
  assert.equal(stowawayAtLocation(state, state.investigators[0]), true)
  assert.equal(cultistValue(state, state.investigators[0]), -4)
  state.difficulty = 'hard'
  assert.equal(cultistValue(state, state.investigators[0]), -5)
  state.difficulty = 'standard'
  assert.equal(locationFlooded(state, state.investigators[0]), true, '向东第 1 层完全淹没')
  assert.equal(courtChaosToken(state, state.investigators[0], 'tablet').drawAnother, true)
  state.investigators[0].location = 'twistingCatwalks'
  assert.equal(locationFlooded(state, state.investigators[0]), false)
  assert.equal(courtChaosToken(state, state.investigators[0], 'tablet').drawAnother, false)
  // [elder_thing]：只有在攻击/躲避尝试中揭示才有惩罚。
  const effect = courtChaosToken(state, state.investigators[0], 'elderthing').onToken[0]
  assert.equal(effect.mode, 'elderThingCombat')
  assert.equal(behavior.applyTokenEffect(state, state.investigators[0], { ...effect, test: { actionKind: 'investigate' } }, api), false)
  api.choose = () => 'damage'
  assert.equal(behavior.applyTokenEffect(state, state.investigators[0], { ...effect, test: { actionKind: 'fight' } }, api), true)
  assert.equal(state.investigators[0].damage, 1)
  for (const face of CHAOS_TOKEN_FACES) assert.ok(COURT_TOKEN_MEANINGS.standard[face])
  assert.equal(CHAOS_TOKEN_FACES.length, 4)
})

// ---------------------------------------------------------------------------
// 8. 单卡事件 / 存档往返
// ---------------------------------------------------------------------------
test('P7 courtOfTheAncients 事件：符文诡计附属到地点、宇宙预兆失败结算', () => {
  const { state, api } = setup(1, { theExpeditionHeadedWest: true })
  state.investigators[0].location = 'eastAntechamber'
  assert.equal(behavior.events.courtGlyphTreachery(state, { code: '11632', seat: 0 }, api), true)
  const location = locationOf(state, 'eastAntechamber')
  assert.equal(location.attachments.some(attachment => attachment.code === '11632'), true)
  // 地点行动：翻译附属符文。
  state.investigators[0].location = 'eastAntechamber'
  const action = behavior.actions(state, state.investigators[0]).find(move => move.rule === 'courtTranslateGlyph')
  assert.ok(action, '附属符文诡计提供翻译行动')
  api.testResult = { success: true }
  assert.equal(behavior.performAction(state, state.investigators[0], action, api), true)
  assert.equal(isGlyphTranslated(state, 'rune_g'), true)
  assert.equal(location.attachments.some(attachment => attachment.code === '11632'), false, '翻译后移出附属')
  // 宇宙预兆：失败后选择受恐惧 + 随机弃牌。
  state.investigators[0].hand = ['01001', '01002']
  api.testResult = { success: false }
  api.choose = () => 'suffer'
  assert.equal(behavior.events.courtCosmicOmen(state, { seat: 0 }, api), true)
  assert.equal(state.investigators[0].horror >= 1, true)
  assert.equal(state.investigators[0].hand.length, 1)
})

test('P7 courtOfTheAncients JSON 存档往返：网格 / 升降机层级 / 符文 / 放一边保持', () => {
  const { state, api } = setup(2, { theExpeditionHeadedWest: true })
  slideGreatLift(state, 'up', api)
  translateGlyph(state, '11630', api)
  const saved = clone(state)
  assert.deepEqual(saved.campaign.records.discoveredGlyphs, ['rune_k'])
  assert.deepEqual(Object.keys(mechanicState(saved).grid).sort(), Object.keys(mechanicState(state).grid).sort())
  assert.equal(liftState(saved).level, 2)
  assert.deepEqual(saved.scenarioZones.setAside, state.scenarioZones.setAside)
  assert.equal(saved.investigators[0].location ?? 'eastAntechamber', 'eastAntechamber')
})
