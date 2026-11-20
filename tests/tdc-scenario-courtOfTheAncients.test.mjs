// P7 古代议庭（courtOfTheAncients · 提示卡 11612）章节测试。
//
// 覆盖：模块 import / manifest 结构 / 11 个规则地点（12 张地点卡）与竖直 4 层网格 / 2 幕 2 议程
// （路线化牌库）/ 结局键 / 遭遇牌库与放一边守恒（含路线组与 Star Spawn 处理）/ 崩塌档案库移出 1 张 /
// 向东路线淹没布局 / 大升降机 1–4 层滑动（连接与寻路即时更新、卡牌标记随行）/ 已激活面翻面与
// 幕 1 推进 / 成功调查改为滑动 / 不稳地基强制检定 / 符文（胜利区符文数、skull 值、祭坛进入限制、
// 破封取碎片）/ 宇宙预兆与符文诡计事件 / 四档混乱标记 / 结局记录 / JSON 存档往返。
//
// 本文件只对「引擎既有读点」的接线用例 import engine.js；
// 章节 behavior 的其余用例仍只走内容层函数与 P2/P7 原语（网格坐标用 mechanicState）。
import test from 'node:test'
import assert from 'node:assert/strict'
// 引导 import：先加载 mechanic-state，避免 engine/ability 与 card-rules 的初始化顺序回归（见 engine-needs 环境观察）。
import { mechanicState } from '../src/engine/mechanic-state.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { enemyAttack, reactionWindow, registerCampaignScenarios, relocateEnemy, scenarioRuntime } from '../src/engine/engine.js'
import {
  enemyHasAttackKeyword, enemyIsImmobile, enemyKeywordOverride, setEnemyKeywords,
} from '../src/engine/enemy-keyword-movement.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import {
  fixture as engineFixture, legalMoves as engineLegalMoves, move as engineMove, settle as engineSettle,
  validateMove as engineValidateMove,
} from './core-fixture.mjs'
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
  spawnEnemy, isGlyphTranslated, enemyPhaseStart, enemyPhaseEnd, enemyAttackResolved,
  movePassagewayAction, searchDiscardGlyphAction, lowestAgilityInvestigator,
  spawnLocation as courtSpawnLocation,
} from '../content/campaigns/theDrownedCity/scenarios/courtOfTheAncients/behavior.js'
import {
  courtChaosToken, courtChaosTokenValue, courtTokenText, skullValue, cultistValue, glyphCardsInVictory,
  stowawayAtLocation, locationFlooded, isHardSide, COURT_TOKEN_MEANINGS, CHAOS_TOKEN_FACES,
  translatedGlyphCount as chaosTranslatedGlyphCount,
} from '../content/campaigns/theDrownedCity/scenarios/courtOfTheAncients/chaos.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { readdirSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { saveSnapshot, readSnapshot, persistEnabled } from '../../../lib/sessions.js'

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
    moveEnemy(enemy, destination) { enemy.location = destination; return true },
    attack(enemy, inv) { (api.attacks ||= []).push([enemy.id, inv?.seat]); return true },
    discardRandom(seat, amount = 1) {
      const inv = state.investigators[seat]
      let discarded = 0
      for (let index = 0; index < amount && inv.hand.length; index += 1) {
        inv.discard ||= []
        inv.discard.push(inv.hand.shift())
        discarded += 1
      }
      return discarded
    },
    drawEncounter(seat, options = {}) {
      (api.draws ||= []).push({ seat, options })
      const code = options.code ?? (state.encounterDeck || []).pop()
      if (!code) return null
      const inv = state.investigators[seat]
      if (inv) { inv.hand ||= []; inv.hand.push(code) }
      return code
    },
    engage(enemy, seat) { enemy.engagedSeat = seat; return true },
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
  assert.equal(chapter.manifest.status, 'playable')
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
  // 引擎在击败敌人时把有胜利 X 的敌人放进胜利区；这里模拟该结算，验证 enemyDefeated
  // 只翻译符文、不额外补故事卡（第二轮修正：返回 false 保持常规胜利区结算）。
  state.victoryDisplay.push({ id: 'keeper', code: '11630', originalCode: '11630', name: '议庭守护者', victory: 1 })
  assert.equal(behavior.enemyDefeated(state, keeper, api), false, 'enemyDefeated 不替换击败去向往')
  assert.equal(isGlyphTranslated(state, 'rune_k'), true)
  assert.equal(glyphCount(state), 1, '胜利区只有引擎放入的敌人本身，未重复补故事卡')
  assert.equal(skullValue(state), 1)
  assert.equal(courtChaosTokenValue(state, 'skull'), -1)
  state.difficulty = 'hard'
  assert.equal(isHardSide(state), true)
  assert.equal(skullValue(state), 2, '困难/专家：符文数 +1')
  state.difficulty = 'standard'
  // 胜利区符文 <3：不能进入古代祭坛。
  assert.match(moveError(state, state.investigators[0], locationOf(state, 'ancientAltar')), /3 张/)
  // 再击败一名守护者（模拟引擎胜利区）+ 翻译两张符文诡计 → 胜利区符文 3 张。
  const keeper2 = spawnEnemy(state, '11631', 'eastAntechamber', api)
  state.victoryDisplay.push({ id: 'keeper2', code: '11631', originalCode: '11631', name: '议庭守护者', victory: 1 })
  behavior.enemyDefeated(state, keeper2, api)
  translateGlyph(state, '11632', api)
  translateGlyph(state, '11633', api)
  assert.equal(glyphCount(state), 4)
  assert.equal(moveError(state, state.investigators[0], locationOf(state, 'ancientAltar')), null)
  // 古代祭坛破封：难度 5 - floor(已翻译/5)。
  assert.equal(translatedGlyphCount(state), 4)
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
  assert.equal(chaosTranslatedGlyphCount(state), 11, '4 张本局符文 + 7 张跨章记录')
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
  const attached = behavior.events.courtGlyphTreachery(state, { code: '11632', seat: 0, from: 'discard' }, api)
  assert.deepEqual(attached, { placed: true })
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

// ---------------------------------------------------------------------------
// 9. 第二轮：敌军阶段/战后强制、[[通道]]移动、搜弃牌堆符文（内容侧收口）
// ---------------------------------------------------------------------------
test('P7 courtOfTheAncients 敌军阶段钩子：11637 移动到猎物、11635 对相邻地点直接恐惧、11621 战后弃手牌', () => {
  const { state, api } = setup(2, { theExpeditionHeadedWest: false })
  // 11637 飞翼守护者：敌军阶段开始，重整且未交战 → 移动到[敏捷]最低的猎物所在地点。
  state.investigators[0].location = 'eastAntechamber'
  state.investigators[0].agility = 2
  state.investigators[1].location = 'twistingCatwalks'
  state.investigators[1].agility = 4
  const keeper = spawnEnemy(state, '11637', 'westAntechamber', api)
  assert.equal(lowestAgilityInvestigator(state).seat, 0)
  assert.equal(enemyPhaseStart(state, api), true)
  assert.equal(keeper.location, 'eastAntechamber', '移动到猎物所在地点')
  keeper.exhausted = true
  keeper.location = 'westAntechamber'
  enemyPhaseStart(state, api)
  assert.equal(keeper.location, 'westAntechamber', '横置或已交战时不动')
  // 11635 巨型暴君：敌军阶段结束，若其地点没有调查员 → 相邻地点上有理智值的卡牌直接恐惧。
  state.investigators[1].location = 'eastAntechamber'
  const tyrant = spawnEnemy(state, '11635', 'twistingCatwalks', api)
  const neighbor = 'greatLift'
  assert.ok(locationOf(state, 'twistingCatwalks').connections.includes(neighbor))
  state.investigators[0].location = neighbor
  state.investigators[0].horror = 0
  const asset = { id: 'asset-sanity', code: '01021', controllerSeat: 0, horror: 0, sanity: 1 }
  locationOf(state, neighbor).assets = [asset]
  assert.equal(enemyPhaseEnd(state, api), true)
  assert.equal(state.investigators[0].horror, 1, '相邻地点调查员 1 点直接恐惧')
  assert.equal(asset.horror, 1, '相邻地点有理智值的资产 1 点直接恐惧')
  tyrant.location = state.investigators[0].location
  assert.equal(enemyPhaseEnd(state, api), false, '暴君所在地点有调查员时不触发')
  // 11621 扭曲栈桥：位于扭曲栈桥的敌人攻击后弃 1 张手牌。
  state.investigators[0].location = 'twistingCatwalks'
  state.investigators[0].hand = ['01001', '01002']
  const foe = spawnEnemy(state, '11637', 'twistingCatwalks', api)
  assert.equal(enemyAttackResolved(state, foe, state.investigators[0], api), true)
  assert.equal(state.investigators[0].hand.length, 1)
  state.investigators[0].location = 'eastAntechamber'
  assert.equal(enemyAttackResolved(state, foe, state.investigators[0], api), false, '不在扭曲栈桥不触发')
})

test('P7 courtOfTheAncients 地点行动收口：[[通道]]移动与搜索遭遇弃牌堆[[符文]]卡', () => {
  const { state, api } = setup(1, { theExpeditionHeadedWest: false })
  const passageway = state.locations.find(loc => registeredEntry(loc.originalCode || loc.code)?.flags?.passageway)
  assert.ok(passageway, '场上有[[通道]]地点')
  const otherPassageway = state.locations.find(loc => loc !== passageway
    && registeredEntry(loc.originalCode || loc.code)?.flags?.passageway)
  otherPassageway.revealed = true
  state.investigators[0].location = passageway.id
  passageway.revealed = true
  const move = behavior.actions(state, state.investigators[0]).find(item => item.rule === 'courtMovePassageway')
  assert.ok(move, '[[通道]]地点提供[action]移动')
  api.choose = () => otherPassageway.id
  assert.equal(behavior.performAction(state, state.investigators[0], move, api), true)
  assert.equal(state.investigators[0].location, otherPassageway.id)
  // 11629 [action][action]：从遭遇弃牌堆搜索[[符文]]卡并抽取。
  const searcher = state.locations.find(loc => Number(registeredEntry(loc.originalCode || loc.code)?.flags?.searchDiscardGlyphActions || 0) > 0)
  if (searcher) {
    state.investigators[0].location = searcher.id
    state.encounterDiscard = ['11749', '11632', '11750']
    state.encounterDeck = []
    state.investigators[0].hand = []
    const search = behavior.actions(state, state.investigators[0]).find(item => item.rule === 'courtSearchDiscardGlyph')
    assert.ok(search)
    assert.equal(behavior.performAction(state, state.investigators[0], search, api), true)
    assert.equal(state.encounterDiscard.includes('11632'), false)
    assert.equal(state.investigators[0].hand.includes('11632'), true)
  }
})

// ---------------------------------------------------------------------------
// 10. 第二轮：生成落点与遭遇抽牌来源（PRIMITIVES.md 已落地读点）
// ---------------------------------------------------------------------------
test('P7 courtOfTheAncients 生成落点：11637 最高层且没有调查员处', () => {
  const { state, api } = setup(2, { theExpeditionHeadedWest: true })
  // 把 1–3 层各放一名调查员，第 4 层空出（向西路线大升降机在第 1 层）。
  const levelOne = state.locations.find(loc => levelOf(state, loc.id) === 1)
  const levelTwo = state.locations.find(loc => levelOf(state, loc.id) === 2)
  const levelThree = state.locations.find(loc => levelOf(state, loc.id) === 3)
  assert.ok(levelThree, '第 3 层有地点')
  state.investigators[0].location = levelOne.id
  state.investigators[1].location = levelTwo.id
  const picked = courtSpawnLocation(state, '11637', 'eastAntechamber', 0, api)
  assert.equal(levelOf(state, picked), 4, '生成在第 4 层（最高层且无调查员）')
  assert.equal(state.investigators.some(inv => inv.location === picked), false)
  // 第 4 层与第 3 层都被占时 → 退到最高空层（第 2 层）。
  const levelFour = state.locations.find(loc => levelOf(state, loc.id) === 4)
  state.investigators[0].location = levelFour.id
  state.investigators[1].location = levelThree.id
  const second = courtSpawnLocation(state, '11637', 'eastAntechamber', 0, api)
  assert.equal(levelOf(state, second), 2, '第 4/3 层被占后取最高空层第 2 层')
  assert.equal(state.investigators.some(inv => inv.location === second), false)
  // 其它卡号不改换落点。
  assert.equal(courtSpawnLocation(state, '11630', 'eastAntechamber', 0, api), 'eastAntechamber')
})

test('P7 courtOfTheAncients 遭遇抽牌来源：弃牌堆抽取 → 附属到所在地点', () => {
  const { state, api } = setup(1, { theExpeditionHeadedWest: true })
  state.investigators[0].location = 'eastAntechamber'
  const entry = ENTRIES.find(item => item.code === '11632')
  const eventApi = { ...api, resolveScenarioEvent: (id, payload) => behavior.events[id](state, payload, api) }
  const result = entry.encounterResolve(state, state.investigators[0], { code: '11632', originalCode: '11632' },
    eventApi, { encounteredFrom: 'discard', location: locationOf(state, 'eastAntechamber') })
  assert.deepEqual(result, { placed: true }, '附属路径返回 placed:true 抑制引擎弃牌')
  const location = locationOf(state, 'eastAntechamber')
  assert.equal(location.attachments.some(attachment => attachment.code === '11632'), true, '附属到所在地点')
  assert.equal((api.draws || []).length, 0, '弃牌堆来源不触发涌动')
})

test('P7 courtOfTheAncients 遭遇抽牌来源：牌库顶抽取 → 弃掉并获得涌动', () => {
  const { state, api } = setup(1, { theExpeditionHeadedWest: true })
  state.investigators[0].location = 'eastAntechamber'
  state.encounterDeck = ['11749', '11750']
  const entry = ENTRIES.find(item => item.code === '11634')
  const eventApi = { ...api, resolveScenarioEvent: (id, payload) => behavior.events[id](state, payload, api) }
  const result = entry.encounterResolve(state, state.investigators[0], { code: '11634', originalCode: '11634' },
    eventApi, { encounteredFrom: 'deck', location: locationOf(state, 'eastAntechamber') })
  assert.equal(result, false, '牌库顶来源不附属（交由引擎弃掉本卡）')
  const location = locationOf(state, 'eastAntechamber')
  assert.equal(location.attachments.some(attachment => attachment.code === '11634'), false, '不附属')
  assert.equal((api.draws || []).length, 1, '获得涌动：额外抽 1 张遭遇牌')
  assert.equal(api.draws[0].seat, 0)
})

// ---------------------------------------------------------------------------
// 11. 第二轮：literal 账本证据（27 张条目的印刷关键子句断言）
// ---------------------------------------------------------------------------
test('P7 courtOfTheAncients literal 覆盖：27 张条目的印刷关键子句断言', () => {
  assert.equal(ENTRIES.length, 27)
  const byCode = Object.fromEntries(ENTRIES.map(entry => [entry.code, entry]))
  for (const code of chapter.implementedEncounterCodes) assert.ok(byCode[code], `缺少条目 ${code}`)
  // 路线化幕/议程牌库。
  assert.equal(ACT_STAGES[1].code, '11616')
  assert.equal(ACT_CODE_BY_ROUTE.west, '11617')
  assert.equal(ACT_CODE_BY_ROUTE.east, '11618')
  assert.equal(AGENDA_STAGES[1].code, '11613')
  assert.equal(AGENDA_STAGES[1.5].code, '11614')
  assert.equal(AGENDA_STAGES[2].code, '11615')
  assert.equal(registeredEntry('11615').flags.liftMovedAgilityTest.difficulty, 2)
  assert.equal(registeredEntry('11616').flags.discardCountSolo, 8)
  assert.equal(registeredEntry('11617').flags.resignLocation, 'twistingCatwalks')
  assert.equal(registeredEntry('11618').flags.resignLocation, 'eastAntechamber')
  // 地点：前厅下滑 / 大升降机两面 / 祭坛 / 档案库 / 通道 / 搜弃牌堆。
  assert.equal(registeredEntry('11619').flags.liftSlideDown, true)
  assert.equal(registeredEntry('11620').flags.liftSlideDown, true)
  assert.equal(registeredEntry('11622').flags.inactive, true)
  assert.equal(registeredEntry('11622b').flags.active, true)
  assert.equal(registeredEntry('11623').flags.cannotEnterUntilGlyphs, 3)
  // 第三轮：11623 进入额外费用声明（locationRule.entryCost，引擎 moves/movement 读点）。
  assert.deepEqual(registeredEntry('11623').locationRule.entryCost, { kind: 'groupClues', perInvestigator: 4 })
  // 第三轮：11638 [reaction]（enemySpawn → 横置敌人）已声明。
  assert.equal(registeredEntry('11638').abilities.length, 1)
  assert.equal(registeredEntry('11638').abilities[0].kind, 'reaction')
  assert.deepEqual(registeredEntry('11638').storyAssetRule, { ignoreFirstAttack: { traits: ['Star Spawn', 'Deep One'] } }, '第五轮：忽略首次攻击声明')
  assert.equal(registeredEntry('11626').flags.spawnObserver, true)
  // 第四轮：弃遭遇牌库顶窗口（encounterCardsDiscardedFromTop）的三张地点条目已声明能力。
  assert.equal(registeredEntry('11624').abilities.length, 1)
  assert.equal(registeredEntry('11624').abilities[0].kind, 'reaction')
  assert.deepEqual(registeredEntry('11624').abilities[0].trigger, ['encounterCardsDiscardedFromTop'])
  assert.deepEqual(registeredEntry('11624').abilities[0].cost, { discardHand: 1 })
  assert.equal(registeredEntry('11625').abilities[0].kind, 'reaction')
  assert.deepEqual(registeredEntry('11625').abilities[0].cost, { horror: 1 }, '第五轮：直接恐惧作为费用')
  assert.equal(registeredEntry('11628').flags.shroudPerAttachedGlyph, 1)
  assert.equal(registeredEntry('11628').abilities.length, 1, '第五轮：11628 [fast] 为条目 free 能力')
  assert.equal(registeredEntry('11628').abilities[0].kind, 'free')
  assert.equal(registeredEntry('11628').abilities[0].actionKind, 'activate')
  assert.equal(registeredEntry('11629').flags.searchDiscardGlyphActions, 2)
  assert.equal(registeredEntry('11629').abilities[0].kind, 'forced', '第五轮：11629 investigationPhaseEnds 强制')
  assert.deepEqual(registeredEntry('11629').abilities[0].trigger, ['investigationPhaseEnds'])
  for (const code of ['11624', '11626', '11628']) assert.equal(registeredEntry(code).flags.passageway, true)
  // 敌人：符文 / 关键词 / 生成与强制声明。
  assert.equal(registeredEntry('11630').flags.glyphRune, 'rune_k')
  assert.equal(registeredEntry('11631').flags.glyphRune, 'rune_j')
  assert.equal(registeredEntry('11635').flags.enemyPhaseEndDirectHorror, true)
  assert.deepEqual(registeredEntry('11635').enemyRule, { immobile: true }, '第四轮：11635 enemyRule.immobile')
  assert.equal(typeof behavior.syncKeeperKeywords, 'function', '第四轮：11630/11631 动态关键词同步读点')
  for (const hook of ['enemySpawned', 'phaseBegan', 'victoryChanged']) {
    assert.equal(typeof behavior[hook], 'function', `第四轮：${hook} 动态关键词同步时机`)
  }
  assert.equal(registeredEntry('11637').flags.phaseStartMoveToPrey, true)
  assert.equal(registeredEntry('11637').flags.prey, 'lowestAgility')
  // 诡计：符文诡计检定 / 宇宙预兆 / 剧情资产。
  for (const code of ['11632', '11633', '11634']) {
    assert.ok(registeredEntry(code).flags.glyphTreachery)
    assert.equal(typeof registeredEntry(code).encounterResolve, 'function')
  }
  assert.deepEqual(registeredEntry('11632').flags.test, { skill: 'willpower', difficulty: 3 })
  assert.equal(registeredEntry('11636').flags.cosmicOmen, true)
  assert.equal(typeof registeredEntry('11636').encounterResolve, 'function')
  assert.equal(registeredEntry('11638').flags.shardOfYchlecht, true)
  // 第二轮已落地原语接线断言：生成落点钩子 + 遭遇抽牌来源（encounterResolve 第 5 参）。
  assert.equal(typeof behavior.spawnLocation, 'function', 'behavior.spawnLocation 读点')
  for (const code of ['11632', '11633', '11634']) {
    const entry = ENTRIES.find(item => item.code === code)
    assert.equal(entry.encounterResolve.length >= 4, true, `${code} encounterResolve 有第 5 参（context）`)
  }
  assert.deepEqual(GLYPH_RUNE_ORDER, ['rune_k', 'rune_j', 'rune_g', 'rune_i', 'rune_h'])
  assert.deepEqual(Object.keys(GLYPH_RECORDS).sort(), ['11630', '11631', '11632', '11633', '11634'])
  for (const hook of ['enemyPhaseStart', 'enemyPhaseEnd', 'enemyAttackResolved', 'moveError', 'canGainResources']) {
    assert.equal(typeof behavior[hook], 'function', `behavior.${hook} 读点`)
  }
  assert.equal(typeof movePassagewayAction, 'function', 'movePassagewayAction 读点')
  assert.equal(typeof searchDiscardGlyphAction, 'function', 'searchDiscardGlyphAction 读点')
})

// ---------------------------------------------------------------------------
// 11. 第二轮：真实 saveSnapshot/readSnapshot 存档重放
// ---------------------------------------------------------------------------
test('P7 courtOfTheAncients saveReplay：真实 saveSnapshot/readSnapshot 恢复后状态等价、后续动作确定', () => {
  const previousHome = process.env.DSH_HOME
  const previousPersist = process.env.BOARDGAME_PERSIST
  const persistHome = mkdtempSync(join(tmpdir(), 'tdc-co-save-'))
  delete process.env.BOARDGAME_PERSIST // 覆盖默认开启路径（不设 BOARDGAME_PERSIST=0）
  process.env.DSH_HOME = persistHome
  try {
    assert.equal(persistEnabled(), true, 'BOARDGAME_PERSIST 默认为开启')
    const { state, api } = setup(2, { theExpeditionHeadedWest: true })
    slideGreatLift(state, 'up', api)
    translateGlyph(state, '11630', api, { addVictory: false })
    const sessionId = 'tdc-co-save-replay'
    const session = {
      sessionId, modId: 'arkhamhorror', state,
      players: [{ seat: 0, name: '调查员1' }, { seat: 1, name: '调查员2' }],
      events: [{ type: 'test', text: '古代议庭存档前' }],
      settings: { difficulty: 'hard', seed: 'tdc-co' },
      revision: 5,
    }
    const file = saveSnapshot(session)
    assert.equal(existsSync(file), true)
    const record = readSnapshot(sessionId)
    assert.ok(record, `readSnapshot 返回空：${readFileSync(file, 'utf8').slice(0, 400)}`)
    const normalize = value => JSON.parse(JSON.stringify(value))
    assert.deepEqual(normalize(record.session.state), normalize(state), '读回状态与内存状态深度相等')
    assert.equal(record.session.sessionId, sessionId)
    assert.equal(record.session.modId, 'arkhamhorror')
    assert.deepEqual(record.session.settings, session.settings)
    // 后续动作：从读回状态与内存起点各执行同一 behavior 入口（再滑一次升降机 + 翻译一个符文）。
    const restoredState = record.session.state
    const restoreApi = makeApi(restoredState)
    const memoryApi = makeApi(state)
    assert.equal(slideGreatLift(restoredState, 'up', restoreApi), true)
    assert.equal(slideGreatLift(state, 'up', memoryApi), true)
    assert.equal(translateGlyph(restoredState, '11632', restoreApi), true)
    assert.equal(translateGlyph(state, '11632', memoryApi), true)
    const fingerprint = value => JSON.stringify({
      lift: liftState(value),
      grid: Object.fromEntries(Object.entries(mechanicState(value).grid).map(([id, cell]) => [id, { x: cell.x, y: cell.y }])),
      glyphs: value.campaign.records.discoveredGlyphs,
      flags: value.scenarioFlags,
      victory: value.victoryDisplay,
      connections: Object.fromEntries((value.locations || []).map(loc => [loc.id, loc.connections])),
    })
    assert.equal(fingerprint(restoredState), fingerprint(state), '同一动作在恢复态与内存态结果一致')
    assert.equal(liftState(restoredState).level, 3)
    assert.deepEqual(restoredState.campaign.records.discoveredGlyphs, ['rune_k', 'rune_g'])
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    if (previousPersist === undefined) delete process.env.BOARDGAME_PERSIST
    else process.env.BOARDGAME_PERSIST = previousPersist
    rmSync(persistHome, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// 12. 第三轮：11623 古代祭坛进入费用（locationRule.entryCost）+ 11638 [reaction]
// ---------------------------------------------------------------------------
const addCourtLocations = (state, pairs) => {
  for (const [id, connections] of pairs) {
    state.locations.push({ id, code: id, name: id, revealed: true, clues: 0, shroud: 1, connections })
  }
}

test('P7 courtOfTheAncients 11623 进入费用：同地点组线索不足拒绝，支付 4×人数后进入', () => {
  const state = engineFixture('01001', 2)
  addCourtLocations(state, [['tdcHall', ['tdcAltar']], ['tdcAltar', ['tdcHall']]])
  const altar = state.locations.find(location => location.id === 'tdcAltar')
  altar.code = '11623'
  altar.originalCode = '11623'
  for (const inv of state.investigators) inv.location = 'tdcHall'
  // 古代祭坛的进入限制：胜利区符文 ≥3（behavior.moveError）。
  state.victoryDisplay.push(
    { id: 'g1', code: '11630', originalCode: '11630' },
    { id: 'g2', code: '11631', originalCode: '11631' },
    { id: 'g3', code: '11632', originalCode: '11632' },
  )
  state.investigators[0].clues = 2
  state.investigators[1].clues = 2
  // 2 名调查员 × 4 = 需要 8 个线索（同地点调查员共同支付）。
  assert.match(engineValidateMove(state, 0, { action: 'move', locationId: 'tdcAltar' }) || '', /8 个线索/)
  const blocked = engineLegalMoves(state, 0).filter(option => option.action === 'move')
  assert.equal(blocked.some(option => (option.to ?? option.locationId) === 'tdcAltar'), false, '线索不足时不可移动')
  // 补足到 8 后可以进入，并扣掉 8 个线索。
  state.investigators[1].clues = 6
  const moveOption = engineLegalMoves(state, 0)
    .find(option => option.action === 'move' && (option.to ?? option.locationId) === 'tdcAltar')
  assert.ok(moveOption, '线索足够时出现移动动作')
  engineMove(state, moveOption)
  engineSettle(state)
  assert.equal(state.investigators[0].location, 'tdcAltar')
  const remaining = state.investigators.reduce((sum, inv) => sum + (inv.clues || 0), 0)
  assert.equal(remaining, 0, '共同支付 8 个线索（2 + 6 → 0）')
  assert.equal(state.placesCluesSpent ?? 0, 0)
})

test('P7 courtOfTheAncients 11638 [reaction]：星之眷族敌人进入地点时横置碎片并横置该敌人', () => {
  const state = engineFixture('01001', 1)
  const inv = state.investigators[0]
  const shard = { id: 'shard11638', code: '11638', exhausted: false }
  inv.assets.push(shard)
  const execute = (draft, seat, move, events) => {
    void seat; void move
    scenarioRuntime(draft, events).spawn('11725', draft.investigators[0].location)
  }
  resolveTransaction(state, 0, { action: 'fixture-spawn' }, execute)
  assert.equal(state.pendingChoice?.kind, 'reaction', '敌人进入地点打开 enemySpawn 反应窗口')
  const triggerOption = state.pendingChoice.options.find(option => String(option.id).startsWith('desc:') && option.cardCode === '11638')
  assert.ok(triggerOption, '伊克雷希特碎片 [reaction] 出现在反应选项里')
  resolveTransaction(state, 0, { action: 'choose', choiceId: state.pendingChoice.id, optionId: triggerOption.id }, execute)
  const afterShard = state.investigators[0].assets.find(asset => asset.id === shard.id)
  assert.equal(afterShard.exhausted, true, '[reaction] 费用：横置伊克雷希特碎片')
  const enemy = state.enemies.find(item => String(item.originalCode || item.code) === '11725')
  assert.ok(enemy, '星之眷族敌人已生成')
  assert.equal(enemy.exhausted, true, '横置该敌人')
})

test('P7 courtOfTheAncients Good Money 标记读点：下一章维护阶段禁止获得资源（campaign-rules helper 判定，越章后 stale 无害）', () => {
  const { state } = setup(2, { theExpeditionHeadedWest: true })
  state.campaign.scenarioIndex = 5
  state.campaign.ruleFlags = {
    tdcNoUpkeepResources: { originScenario: 'theGrandVault', seats: [0], appliesToScenarioIndex: 5 },
  }
  assert.equal(behavior.canGainResources(state, state.investigators[0]), false, '下一章维护阶段不能获得资源')
  assert.equal(behavior.canGainResources(state, state.investigators[1]), true, '未选该分支的座位不受影响')
  // 越过下一章后 helper 按 appliesToScenarioIndex 判定，stale 标记不再生效（无需 preScenarioSetup 清理）。
  state.campaign.scenarioIndex = 6
  assert.equal(behavior.canGainResources(state, state.investigators[0]), true, '越章后 stale 标记无害')
  assert.ok(state.campaign.ruleFlags.tdcNoUpkeepResources, '标记保留（helper 判定）')
})

// ---------------------------------------------------------------------------
// 13. 第四轮：11635 immobile + 11624/11625/11627 弃顶窗口 + 11630/11631 动态关键词
// ---------------------------------------------------------------------------
const answerPendingChoices = (state, execute, seat = 0) => {
  let guard = 0
  let triggered = false
  while (state.pendingChoice && guard++ < 16) {
    const choice = state.pendingChoice
    // 11625 这类无费用弃顶反应会自我连锁：只触发第一次，后续反应窗口一律跳过（真实对局为可选）。
    let option = choice.options.find(item => !['skip', 'done'].includes(item.id)) || choice.options[0]
    if (triggered && choice.kind === 'reaction' && choice.options.some(item => item.id === 'skip')) option = { id: 'skip' }
    if (choice.kind === 'reaction' && option.id !== 'skip') triggered = true
    resolveTransaction(state, seat, { action: 'choose', choiceId: choice.id, optionId: option.id }, execute)
  }
}

test('P7 courtOfTheAncients 11635 不能移动：enemyRule.immobile 拦下移动，setEnemyKeywords 关闭后恢复移动', () => {
  const state = engineFixture('01001', 1)
  addCourtLocations(state, [['tdcTyrant', ['tdcDen']], ['tdcDen', ['tdcTyrant']]])
  const tyrant = {
    id: 'tyrant11635', code: '11635', originalCode: '11635', name: '巨型暴君',
    location: 'tdcTyrant', engagedSeat: null, exhausted: false, damageTaken: 0,
    traits: ['Monster', 'Abomination', 'Elite'],
  }
  state.enemies.push(tyrant)
  assert.equal(enemyIsImmobile(state, tyrant), true, '条目 enemyRule.immobile 声明生效')
  relocateEnemy(state, tyrant, 'tdcDen', [])
  assert.equal(tyrant.location, 'tdcTyrant', '不能移动：任何移动来源被拦下，位置不变')
  // 动态改写：内容层关闭 immobile 后同一实例恢复可移动。
  assert.equal(setEnemyKeywords(state, tyrant, ['immobile'], { enabled: false, throughRound: state.round }), true)
  assert.equal(enemyIsImmobile(state, tyrant), false)
  relocateEnemy(state, tyrant, 'tdcDen', [])
  assert.equal(tyrant.location, 'tdcDen', 'setEnemyKeywords 关闭 immobile 后恢复移动')
})

test('P7 courtOfTheAncients 11624 [reaction] 弃顶：弃 1 手牌后额外弃 2 张（encounterCardsDiscardedFromTop 窗口）', () => {
  const state = engineFixture('01001', 1)
  addCourtLocations(state, [['tdcStars', ['tdcHall']], ['tdcHall', ['tdcStars']]])
  const stars = state.locations.find(location => location.id === 'tdcStars')
  stars.code = '11624'
  stars.originalCode = '11624'
  const inv = state.investigators[0]
  inv.location = 'tdcStars'
  inv.hand = ['01020']
  inv.discard = []
  state.encounterDeck = ['cryptChill', 'ancientEvils', 'dissonantVoices', 'graveHunger', 'rottingRemains']
  state.encounterDiscard = []
  const execute = (draft, seat, move, events) => {
    void seat; void move
    scenarioRuntime(draft, events).discardEncounterTop(1, { seat: 0 })
  }
  resolveTransaction(state, 0, { action: 'fixture-discard-top' }, execute)
  assert.equal(state.pendingChoice?.kind, 'reaction', '弃顶后打开 encounterCardsDiscardedFromTop 反应窗口')
  const entityOption = state.pendingChoice.options.find(option => String(option.id).startsWith('entity:') && option.cardCode === '11624')
  assert.ok(entityOption, '11624 [reaction] 出现在反应选项里')
  answerPendingChoices(state, execute)
  const fresh = state.investigators[0]
  assert.equal(state.encounterDiscard.length, 3, '弃顶 1 张 + 反应额外 2 张')
  assert.deepEqual(fresh.discard, ['01020'], '费用：弃掉 1 张手牌')
  assert.equal(fresh.hand.length, 0)
})

test('P7 courtOfTheAncients 11625 [reaction] 弃顶：受到 1 点直接恐惧并额外弃 3 张', () => {
  const state = engineFixture('01001', 1)
  addCourtLocations(state, [['tdcAncients', ['tdcHall']], ['tdcHall', ['tdcAncients']]])
  const archive = state.locations.find(location => location.id === 'tdcAncients')
  archive.code = '11625'
  archive.originalCode = '11625'
  const inv = state.investigators[0]
  inv.location = 'tdcAncients'
  const horrorBefore = inv.horror
  state.encounterDeck = ['cryptChill', 'ancientEvils', 'dissonantVoices', 'graveHunger', 'rottingRemains', 'frozenInFear']
  state.encounterDiscard = []
  const execute = (draft, seat, move, events) => {
    void seat; void move
    scenarioRuntime(draft, events).discardEncounterTop(1, { seat: 0 })
  }
  resolveTransaction(state, 0, { action: 'fixture-discard-top' }, execute)
  const entityOption = state.pendingChoice?.options?.find(option => String(option.id).startsWith('entity:') && option.cardCode === '11625')
  assert.ok(entityOption, '11625 [reaction] 出现在反应选项里')
  answerPendingChoices(state, execute)
  assert.equal(state.investigators[0].horror, horrorBefore + 1, '受到 1 点直接恐惧')
  assert.ok(state.encounterDiscard.length >= 4, '弃顶 1 张 + 额外 3 张（连锁反应可能更多）')
})

test('P7 courtOfTheAncients 11627 强制弃顶：最近的重整非精英敌人解除交战并移动到高空栈道', () => {
  const state = engineFixture('01001', 1)
  addCourtLocations(state, [['tdcWalkway', ['tdcNear']], ['tdcNear', ['tdcWalkway']]])
  const walkway = state.locations.find(location => location.id === 'tdcWalkway')
  walkway.code = '11627'
  walkway.originalCode = '11627'
  const inv = state.investigators[0]
  inv.location = 'tdcWalkway'
  const thug = {
    id: 'thug-11627', code: '01169', originalCode: '01169', name: '暴徒',
    location: 'tdcNear', engagedSeat: 0, exhausted: false, damageTaken: 0,
    traits: ['Humanoid', 'Criminal'],
  }
  state.enemies.push(thug)
  inv.engaged = [thug.id]
  state.encounterDeck = ['cryptChill', 'ancientEvils']
  state.encounterDiscard = []
  const execute = (draft, seat, move, events) => {
    void seat; void move
    scenarioRuntime(draft, events).discardEncounterTop(1, { seat: 0 })
  }
  resolveTransaction(state, 0, { action: 'fixture-discard-top' }, execute)
  assert.equal(state.pendingChoice, null, '强制能力不询问')
  const fresh = state.enemies.find(enemy => enemy.id === 'thug-11627')
  assert.equal(fresh.location, 'tdcWalkway', '最近的未交战非[[精英]]敌人移动到本地点')
  assert.equal(fresh.engagedSeat, null, '移动到本地点后保持解除交战')
  assert.equal(state.investigators[0].engaged.includes('thug-11627'), false)
})

test('P7 courtOfTheAncients 11630/11631 动态关键词：<10 不加、≥10 加、跌破后移除并随 phaseBegan/enemySpawned/victoryChanged 同步', () => {
  const { state } = setup(1, { theExpeditionHeadedWest: true })
  state.round = 3
  const location = state.investigators[0].location
  state.enemies.push(
    { id: 'keeper30', code: '11630', originalCode: '11630', name: '议庭守护者·梦境', location, engagedSeat: null, exhausted: false, damageTaken: 0, traits: ['Monster', 'Keeper', 'Glyph', 'Elite'] },
    { id: 'keeper31', code: '11631', originalCode: '11631', name: '议庭守护者·睡眠', location, engagedSeat: null, exhausted: false, damageTaken: 0, traits: ['Monster', 'Keeper', 'Glyph', 'Elite'] },
  )
  const keeper30 = state.enemies.find(enemy => enemy.id === 'keeper30')
  const keeper31 = state.enemies.find(enemy => enemy.id === 'keeper31')
  state.campaign.records.discoveredGlyphs = ['rune_a', 'rune_b']
  behavior.syncKeeperKeywords(state, {})
  assert.equal(enemyKeywordOverride(state, keeper30, 'relentless'), false, '<10 符文：无情不授予')
  assert.equal(enemyKeywordOverride(state, keeper31, 'alert'), false)
  assert.equal(enemyKeywordOverride(state, keeper31, 'retaliate'), false)
  state.campaign.records.discoveredGlyphs = Array.from({ length: 10 }, (_, index) => `rune_${index}`)
  behavior.syncKeeperKeywords(state, {})
  assert.equal(enemyKeywordOverride(state, keeper30, 'relentless'), true, '≥10 符文：获得无情')
  assert.equal(enemyHasAttackKeyword(state, keeper30, 'relentless', false, registeredEntry), true)
  assert.equal(enemyKeywordOverride(state, keeper31, 'alert'), true, '≥10 符文：获得警戒')
  assert.equal(enemyKeywordOverride(state, keeper31, 'retaliate'), true, '≥10 符文：获得反击')
  assert.equal(enemyHasAttackKeyword(state, keeper31, 'alert', false, registeredEntry), true)
  // 跌破阈值：重新同步后移除。
  state.campaign.records.discoveredGlyphs = state.campaign.records.discoveredGlyphs.slice(0, 9)
  behavior.syncKeeperKeywords(state, {})
  assert.equal(enemyKeywordOverride(state, keeper30, 'relentless'), false, '跌破 10 后移除无情')
  assert.equal(enemyKeywordOverride(state, keeper31, 'alert'), false)
  // 同步时机：每轮开始（phaseBegan mythos）、胜利区符文变化（victoryChanged）、新生成（enemySpawned）。
  state.campaign.records.discoveredGlyphs = Array.from({ length: 10 }, (_, index) => `rune_${index}`)
  behavior.phaseBegan(state, 'mythos', {})
  assert.equal(enemyKeywordOverride(state, keeper30, 'relentless'), true, 'phaseBegan(mythos) 重新同步')
  // 轮次推进：上一轮写的 override 到期失效（throughRound=旧轮），神话阶段重同步前不再生效。
  state.round += 1
  assert.equal(enemyKeywordOverride(state, keeper30, 'relentless'), null, '越过 throughRound 后 override 到期')
  behavior.phaseBegan(state, 'mythos', {})
  assert.equal(enemyKeywordOverride(state, keeper30, 'relentless'), true, '新一轮神话阶段按符文数重新授予')
  // 胜利区符文变化（消耗符文）→ victoryChanged 立即重同步。
  state.campaign.records.discoveredGlyphs = ['rune_a']
  behavior.victoryChanged(state, {})
  assert.equal(enemyKeywordOverride(state, keeper30, 'relentless'), false, 'victoryChanged 按剩余符文数移除')
  // 新敌人生成 → enemySpawned 同步已有守护者。
  state.campaign.records.discoveredGlyphs = Array.from({ length: 11 }, (_, index) => `rune_${index}`)
  behavior.enemySpawned(state, { id: 'newKeeper', code: '11630' }, {})
  assert.equal(enemyKeywordOverride(state, keeper30, 'relentless'), true, 'enemySpawned 同步已有守护者')
})

// ---------------------------------------------------------------------------
// 14. 第五轮：11638 忽略首次攻击 / 11628 X 行动 / 11629 调查阶段结束洗回 / 11625 费用口径
// ---------------------------------------------------------------------------
test('P7 courtOfTheAncients 11638 被动：每轮首次[[星之眷族]]攻击可忽略（ignoredAttackRound 记账）', () => {
  const state = engineFixture('01001', 1)
  const inv = state.investigators[0]
  const shard = { id: 'shard11638', code: '11638', originalCode: '11638', exhausted: false }
  inv.assets.push(shard)
  state.enemies.push({
    id: 'star-spawn-11638', code: '11725', originalCode: '11725', name: '星之眷族',
    location: inv.location, engagedSeat: 0, exhausted: false, damageTaken: 0,
    damage: 1, horror: 1, traits: ['Monster', 'Star Spawn', 'Elite'],
  })
  inv.engaged = ['star-spawn-11638']
  const execute = (draft, seat, move, events) => {
    void seat; void move
    enemyAttack(draft, draft.enemies.find(enemy => enemy.id === 'star-spawn-11638'), draft.investigators[0], events)
  }
  resolveTransaction(state, 0, { action: 'fixture-attack' }, execute)
  assert.equal(state.pendingChoice?.source, 'ignoreFirstAttack', '首次攻击出现忽略选项')
  resolveTransaction(state, 0, { action: 'choose', choiceId: state.pendingChoice.id, optionId: 'ignore' }, execute)
  assert.equal(state.investigators[0].damage, 0, '选择忽略：无伤害')
  assert.equal(state.investigators[0].horror, 0, '选择忽略：无恐惧')
  assert.equal(state.investigators[0].assets.find(asset => asset.id === 'shard11638').ignoredAttackRound, state.round, '每轮一次记账')
  // 同一轮第二次攻击：不再询问，正常结算。
  resolveTransaction(state, 0, { action: 'fixture-attack-2' }, execute)
  assert.equal(state.pendingChoice, null, '同轮不再询问')
  assert.equal(state.investigators[0].damage, 1, '第二次攻击正常造成伤害')
  // 下一轮恢复：每轮首次攻击再次可忽略。
  state.round += 1
  resolveTransaction(state, 0, { action: 'fixture-attack-3' }, execute)
  assert.equal(state.pendingChoice?.source, 'ignoreFirstAttack', '下一轮恢复询问')
  resolveTransaction(state, 0, { action: 'choose', choiceId: state.pendingChoice.id, optionId: 'ignore' }, execute)
  assert.equal(state.investigators[0].damage, 1, '下一轮再次忽略成功')
})

test('P7 courtOfTheAncients 11628 [fast]：花 X 次行动搜索弃牌堆符文（X=1/2 扣行动、抽取数量正确）', () => {
  // 11628 的抽取走 api.drawEncounter（真实引擎按当前剧本的遭遇定义解析）；
  // 本用例在内容层状态上直接结算条目 free 能力，用与引擎同形的 api 桩记录支付与抽取。
  const ability = registeredEntry('11628').abilities[0]
  assert.equal(ability.kind, 'free')
  assert.equal(ability.actionKind, 'activate')
  const run = ({ x, actionsLeft, discard }) => {
    const { state } = setup(1, { theExpeditionHeadedWest: true })
    const inv = state.investigators[0]
    inv.actionsLeft = actionsLeft
    state.encounterDiscard = [...discard]
    const draws = []
    const api = {
      cardDef: code => ALL_CARDS[code] || null,
      choose: spec => (spec.kind === 'number' ? String(x) : null),
      loseActions: (seat, amount) => { state.investigators[seat].actionsLeft -= amount },
      drawEncounter: seat => draws.push(seat),
      scenario: {
        encounterDiscardCards: () => [...state.encounterDiscard],
        takeEncounterDiscard: code => {
          const index = state.encounterDiscard.lastIndexOf(code)
          if (index < 0) return false
          state.encounterDiscard.splice(index, 1)
          return true
        },
        putOnEncounterDeck: () => {},
      },
    }
    ability.resolve({ inv, api, state })
    return { state, draws }
  }
  // X = 1：扣 1 行动、抽 1 张符文。
  {
    const { state, draws } = run({ x: '1', actionsLeft: 2, discard: ['11632', 'cryptChill', '11633'] })
    assert.equal(state.investigators[0].actionsLeft, 1, 'X=1：扣 1 次行动')
    assert.equal(draws.length, 1, 'X=1：依次抽取 1 张')
    assert.equal(state.encounterDiscard.filter(code => code === '11632' || code === '11633').length, 1, 'X=1：只抽 1 张符文')
  }
  // X = 2：扣 2 行动、抽 2 张符文。
  {
    const { state, draws } = run({ x: '2', actionsLeft: 2, discard: ['11632', 'cryptChill', '11633'] })
    assert.equal(state.investigators[0].actionsLeft, 0, 'X=2：扣 2 次行动')
    assert.equal(draws.length, 2, 'X=2：依次抽取 2 张')
    assert.equal(state.encounterDiscard.filter(code => code === '11632' || code === '11633').length, 0, 'X=2：抽走 2 张符文')
  }
})

test('P7 courtOfTheAncients 11629 强制：调查阶段结束时把附属[[符文]]诡计混洗入遭遇牌库', () => {
  const state = engineFixture('01001', 1)
  addCourtLocations(state, [['tdcMemory', ['tdcHall']], ['tdcHall', ['tdcMemory']]])
  const archive = state.locations.find(location => location.id === 'tdcMemory')
  archive.code = '11629'
  archive.originalCode = '11629'
  archive.clues = 1
  archive.attachments = [
    { id: 'glyph-t1', code: '11632', originalCode: '11632' },
    { id: 'glyph-t2', code: '11633', originalCode: '11633' },
  ]
  state.encounterDeck = []
  state.encounterDiscard = ['cryptChill']
  const execute = (draft, seat, move, events) => {
    void seat; void move
    reactionWindow(draft, 'investigationPhaseEnds', { when: 'investigationPhaseEnds', round: draft.round }, events)
  }
  resolveTransaction(state, 0, { action: 'fixture-phase-end' }, execute)
  const fresh = state.locations.find(location => location.id === 'tdcMemory')
  assert.deepEqual(fresh.attachments || [], [], '附属诡计全部离场')
  assert.equal(state.encounterDeck.includes('11632'), true, '11632 混洗入遭遇牌库')
  assert.equal(state.encounterDeck.includes('11633'), true, '11633 混洗入遭遇牌库')
  assert.equal(state.encounterDiscard.includes('11632'), false, '弃牌堆不残留副本（不复制卡牌）')
  assert.equal(state.encounterDiscard.includes('cryptChill'), true, '其它遭遇弃牌不受影响')
})

test('P7 courtOfTheAncients 11625 费用口径：直接恐惧作为反应费用在额外弃牌前结算', () => {
  const state = engineFixture('01001', 1)
  addCourtLocations(state, [['tdcAncients2', ['tdcHall']], ['tdcHall', ['tdcAncients2']]])
  const archive = state.locations.find(location => location.id === 'tdcAncients2')
  archive.code = '11625'
  archive.originalCode = '11625'
  const inv = state.investigators[0]
  inv.location = 'tdcAncients2'
  const horrorBefore = inv.horror
  state.encounterDeck = ['cryptChill', 'ancientEvils', 'dissonantVoices', 'graveHunger']
  state.encounterDiscard = []
  const execute = (draft, seat, move, events) => {
    void seat; void move
    scenarioRuntime(draft, events).discardEncounterTop(1, { seat: 0 })
  }
  resolveTransaction(state, 0, { action: 'fixture-discard-top' }, execute)
  const entityOption = state.pendingChoice?.options?.find(option => String(option.id).startsWith('entity:') && option.cardCode === '11625')
  assert.ok(entityOption)
  answerPendingChoices(state, execute)
  assert.equal(state.investigators[0].horror, horrorBefore + 1, '费用：受到 1 点恐惧')
  assert.ok(state.encounterDiscard.length >= 4, '费用支付后额外弃 3 张')
})
