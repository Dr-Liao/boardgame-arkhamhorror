// P7 寂静荒野（theSilentHeath · 提示卡 10549）章节测试。
//
// 覆盖：章节结构/manifest（19 张非玩家条目、12 地点、2 幕、3 议程/2 张入牌库）、
// 遭遇牌库（固定 6 组 + 当日组）、放一边与「岩中恐怖」独立地点牌库、珍珠岭网格与印刷图标连接、
// 昼夜与荒芜 v.I/v.II、幕 1 背面（3 地点 + 6 张暗牌）、幕 2 暗堆行动与目标、议程 1/2 正反面、
// 四档混乱符号、昆虫关键词（冷漠/猎手/虫后光环）、水晶残骸（回合开始 / 献纳 / 击败暗堆）、
// 结局 1–4 与战役记录、JSON 存档往返。
//
// 本文件不 import engine.js：章节 behavior 只走内容层函数与 P2 原语（网格坐标用 mechanicState），
// 因此单测可在并行 worker 尚未重建索引时独立运行。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { mechanicState } from '../src/engine/mechanic-state.js'
import * as chapter from '../content/campaigns/theFeastOfHemlockVale/scenarios/theSilentHeath/index.js'
import {
  scenario, ACT_CODES, AGENDA_CODES, DESOLATION_V1_CODE, DESOLATION_V2_CODE, ACT_STAGES, AGENDA_STAGES,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, dayGroupCards, DAY_TREACHERY_CODES, LOCATIONS,
  LOCATION_CONNECTIONS, LOCATION_COORDINATES, LOCATION_CELLS, LOCATION_TABLE, HORRORS_SET_ASIDE_CELLS,
  HORRORS_POOL_IDS, HORRORS_SET_ASIDE_COUNT, HORRORS_REMOVED_COUNT, HORRORS_SET_ASIDE_CODES,
  SET_ASIDE_CARDS, SET_ASIDE_LOCATION_IDS, CAVE_LOCATION_IDS, START_LOCATION, START_LOCATION_IDS,
  CRYSTAL_REMAINS_CODES, CRYSTAL_REMAINS_CHILD, CRYSTAL_REMAINS_FATHER, CRYSTAL_REMAINS_MOTHER,
  BROOD_QUEEN_CODE, BROOD_SOLDIER_CODE, COLORLESS_LARVA_CODE, CRYSTAL_PARASITE_CODE,
  TIME_MARKER_CODES, RESIDENT_ASSETS, RESIDENT_LOCATIONS, RESOLUTION_KEYS, STAGE_CARDS,
  SCENARIO_TEXT, SETUP_STEPS, INTRO_BRANCHES,
} from '../content/campaigns/theFeastOfHemlockVale/scenarios/theSilentHeath/definition.js'
import {
  behavior, implementedEntryFlags, scenarioSummary, dayOf, isNight, introBranchKey, codex,
  resolutionChainForKey,
} from '../content/campaigns/theFeastOfHemlockVale/scenarios/theSilentHeath/behavior.js'
import {
  silentHeathChaosToken, silentHeathChaosTokenValue, SILENT_HEATH_TOKEN_MEANINGS, skullValue,
  insectCount, insectsInPlay, insectsInVictory, isHardSide, atLairLocation, CHAOS_TOKEN_FACES,
} from '../content/campaigns/theFeastOfHemlockVale/scenarios/theSilentHeath/chaos.js'
import entry10550 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theSilentHeath/10550.js'
import entry10551 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theSilentHeath/10551.js'
import entry10552 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theSilentHeath/10552.js'
import entry10553 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theSilentHeath/10553.js'
import entry10554 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theSilentHeath/10554.js'
import entry10555 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theSilentHeath/10555.js'
import entry10556 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theSilentHeath/10556.js'
import entry10557 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theSilentHeath/10557.js'
import entry10558 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theSilentHeath/10558.js'
import entry10559 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theSilentHeath/10559.js'
import entry10560 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theSilentHeath/10560.js'
import entry10561 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theSilentHeath/10561.js'
import entry10562 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theSilentHeath/10562.js'
import entry10563 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theSilentHeath/10563.js'
import entry10564 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theSilentHeath/10564.js'
import entry10565 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theSilentHeath/10565.js'
import entry10566 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theSilentHeath/10566.js'
import entry10567 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theSilentHeath/10567.js'
import entry10568 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theSilentHeath/10568.js'

const ENTRIES = [
  entry10550, entry10551, entry10552, entry10553, entry10554, entry10555, entry10556, entry10557,
  entry10558, entry10559, entry10560, entry10561, entry10562, entry10563, entry10564, entry10565,
  entry10566, entry10567, entry10568,
]
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

const clone = value => JSON.parse(JSON.stringify(value))
const CHARACTER_CODES = Object.freeze({
  insect: COLORLESS_LARVA_CODE, soldier: BROOD_SOLDIER_CODE, queen: BROOD_QUEEN_CODE,
  child: CRYSTAL_REMAINS_CHILD, father: CRYSTAL_REMAINS_FATHER, mother: CRYSTAL_REMAINS_MOTHER,
})
const ENTITY_DEF = code => scenario.enemies?.[code] || scenario.storyAssets?.[code] || {}

const stateFor = (investigatorCount = 1, records = {}, flags = {}) => ({
  investigators: Array.from({ length: investigatorCount }, (_, seat) => ({
    seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
    assets: [], hand: [], deck: [], discard: [], threat: [], defeated: false, resigned: false,
  })),
  locations: [], enemies: [], storyAssets: [], encounterDeck: [], encounterDiscard: [],
  scenarioFlags: { ...flags }, scenarioZones: {},
  campaign: { leadSeat: 0, records: { ...records }, trauma: {}, investigators: {} },
  victoryDisplay: [], doom: 0, difficulty: 'standard', numInvestigators: investigatorCount,
  phase: 'investigation', round: 1, status: 'playing',
})
const stateWithScenario = (count = 1, records = {}, flags = {}) => {
  const state = stateFor(count, records, flags)
  state.scenario = structuredClone(scenario)
  return state
}

const makeApi = (state, options = {}) => {
  let serial = 0
  const api = {
    state,
    info: () => {},
    finished: null,
    attacks: [],
    choose: options.choose || (() => null),
    random: options.random || (() => 0.5),
    shuffle: options.shuffle || (list => [...list]),
    tokens: [...(options.tokens || [])],
    testResult: options.testResult || { success: false, failedBy: 1, value: 2 },
    present: () => {},
    revealToken() { return api.tokens.length ? api.tokens.shift() : '0' },
    test(seat, skill, difficulty, resolve) {
      const result = typeof api.testResult === 'function'
        ? api.testResult(seat, skill, difficulty) : api.testResult
      api.lastTest = { seat, skill, difficulty, result }
      resolve?.(result)
      return result
    },
    damage(seat, amount = 1) { state.investigators[seat].damage += amount },
    horror(seat, amount = 1) { state.investigators[seat].horror += amount },
    healHorror(seat, amount = 1) { state.investigators[seat].horror = Math.max(0, state.investigators[seat].horror - amount) },
    gainClues(seat, amount = 1) { state.investigators[seat].clues += amount },
    drawCards(seat, amount = 1) {
      const inv = state.investigators[seat]
      for (let index = 0; index < amount; index++) inv.hand.push(`0100${index}`)
      return amount
    },
    discardRandom(seat, amount = 1) {
      const inv = state.investigators[seat]
      let discarded = 0
      for (let index = 0; index < amount; index++) {
        if (!inv.hand.length) break
        inv.discard.push(inv.hand.shift())
        discarded += 1
      }
      return discarded
    },
    addTrauma(seat, kind, amount = 1) {
      state.campaign.trauma[seat] ||= { physical: 0, mental: 0 }
      state.campaign.trauma[seat][kind] += amount
    },
    addScenarioXpBonus(seat, amount = 1) {
      const inv = state.investigators[seat]
      inv.scenarioXpBonus = (Number(inv.scenarioXpBonus) || 0) + amount
    },
    defeat(inv) { inv.defeated = true; inv.defeatCause = 'physical' },
    finish(key) { api.finished = key },
    advanceAct() {
      const act = state.acts[state.actIndex]
      behavior.actReveal(state, act, api)
      if (api.finished || state.resolution) return
      state.actIndex += 1
    },
    spawn(code, locationId, extra = {}) {
      serial += 1
      const def = ENTITY_DEF(code)
      const enemy = {
        id: `${code}-${serial}`, code, originalCode: code, name: def.nameZh || def.name || code,
        location: locationId, fight: def.fight ?? 0, evade: def.evade ?? 0, health: def.health ?? 1,
        damage: def.damage || 0, horror: def.horror || 0, traits: [...(def.traits || [])],
        exhausted: extra.exhausted === true, engagedSeat: extra.engagedSeat ?? null,
        damageTaken: 0, doom: 0, clues: 0, attachments: [], victory: Number(def.victory) || 0,
        ...(def.elite ? { elite: true } : {}),
      }
      state.enemies.push(enemy)
      return enemy
    },
    defeatEnemy(enemy) {
      const index = state.enemies.indexOf(enemy)
      if (index < 0) return false
      state.enemies.splice(index, 1)
      return true
    },
    readyEnemy(enemy) { enemy.exhausted = false },
    exhaustEnemy(enemy) { enemy.exhausted = true },
    moveEnemy(enemy, destination) { enemy.location = destination; return true },
    moveEnemyToward(enemy, destination) { enemy.location = destination; return true },
    engage(enemy, seat) { enemy.engagedSeat = seat; return true },
    attack(enemy, inv) { api.attacks.push([enemy.id, inv?.seat]); return true },
    resolveEnemyPhaseOf(enemy) { api.attacks.push([enemy.id, 'phase']); return true },
    placeDoomOnCard(card, amount = 1) { card.doom = (Number(card.doom) || 0) + amount; return amount },
    setEnemyKeywords(enemy, keywords, { enabled }) {
      for (const keyword of keywords) enemy[keyword] = enabled
      return true
    },
    giveAsset(seat, code) {
      const inv = state.investigators[seat]
      if (!inv) return null
      const def = ENTITY_DEF(code)
      const asset = {
        id: `asset-${code}-${(inv.assets || []).length + 1}`, code, originalCode: code,
        name: def.nameZh || def.name || code, damage: 0, horror: 0, exhausted: false,
        controllerSeat: seat, ownerSeat: seat, tokens: 0, attachments: [],
      }
      inv.assets.push(asset)
      return asset
    },
    removeAsset(seat, assetId) {
      const inv = state.investigators[seat]
      const index = inv.assets.findIndex(asset => asset.id === assetId)
      if (index < 0) return null
      const [asset] = inv.assets.splice(index, 1)
      return asset.code
    },
    addStoryToVictory(code, options = {}) {
      const def = ENTITY_DEF(code)
      state.victoryDisplay.push({
        id: options.sourceId || code, code, originalCode: code,
        name: def.nameZh || def.name || code, victory: Number(def.victory) || 0,
      })
      return true
    },
    reveal(id, seat = null) {
      const location = state.locations.find(item => item.id === id)
      if (!location) return false
      location.revealed = true
      location.clues = Math.max(0, Number(location.maxClues) || 0)
      behavior.locationRevealed(state, location, api, seat)
      return true
    },
    drawEncounter(seat) {
      const code = state.encounterDeck.pop()
      if (!code) return null
      const def = ENTITY_DEF(code)
      if (def && (scenario.enemies?.[code])) {
        api.spawn(code, state.investigators[seat]?.location || null, { engagedSeat: seat })
      } else {
        state.encounterDiscard.push(code)
      }
      return code
    },
  }
  return api
}

const setup = (count = 1, { day = 1, night = false, records = {}, flags = {} } = {}) => {
  const state = stateWithScenario(count, { day, time: night ? 'Night' : 'Day', ...records }, {
    silentHeathDay: day, silentHeathNight: night, ...flags,
  })
  const api = makeApi(state)
  const report = behavior.setupScenario(state, api)
  assert.equal(dayOf(state), day, '测试夹具的当前天数')
  assert.equal(isNight(state), night, '测试夹具的昼夜')
  return { state, api, report }
}

const locationOf = (state, id) => state.locations.find(location => location.id === id) || null
const spawnCharacter = (state, api, code, location, extra = {}) => api.spawn(code, location, extra)
const placeCaveExplicit = (state, api, id, cell = { x: 0, y: -1 }) => {
  behavior.placeLocationAt(state, id, cell, api, { revealed: false })
  return locationOf(state, id)
}

// ---------------------------------------------------------------------------
// 1. 章节结构 / manifest
// ---------------------------------------------------------------------------
test('P7 theSilentHeath 章节结构：19 张条目、12 地点、2 幕、3 议程与 playable manifest', () => {
  assert.equal(chapter.scenario.id, 'theSilentHeath')
  assert.equal(chapter.scenario.originalCode, '10549')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.campaignId, 'theFeastOfHemlockVale')
  assert.deepEqual([...ACT_CODES], ['10553', '10554'])
  assert.deepEqual([...AGENDA_CODES], ['10550', '10551', '10552'])
  assert.equal(chapter.scenario.acts.length, 2)
  assert.equal(behavior.roundEndActIndex, 0, '幕 1 只在轮末支付线索')
  assert.deepEqual(ACT_STAGES[1].objective, { type: 'clues', perInvestigator: 2, atLocation: START_LOCATION })
  assert.equal(ACT_STAGES[2].objective.type, 'resignedWithCrystalRemains')
  assert.equal(chapter.scenario.agendas[1].originalCode, DESOLATION_V1_CODE, '默认（第 1 日）议程 2 为 v.I')
  assert.equal(chapter.scenario.agendas.length, 2)
  assert.equal(Object.keys(LOCATIONS).length, 12)
  assert.equal(LOCATION_TABLE.length, 3)
  assert.equal(CAVE_LOCATION_IDS.length, 3)
  assert.equal(HORRORS_POOL_IDS.length, 6)
  assert.equal(chapter.implementedEncounterCodes.length, 19)
  assert.deepEqual([...chapter.implementedEncounterCodes].sort(), [
    '10550', '10551', '10552', '10553', '10554', '10555', '10556', '10557', '10558', '10559',
    '10560', '10561', '10562', '10563', '10564', '10565', '10566', '10567', '10568',
  ].sort())
  assert.equal(chapter.behaviorEntryCodes.length, 8)
  assert.deepEqual(chapter.manifest.dynamicEncounterGroups.sort(),
    Object.values(chapter.DAY_GATHER_GROUPS).sort())
  assert.equal(chapter.manifest.horrorsLocationDeck.setAsideCount, HORRORS_SET_ASIDE_COUNT)
  assert.equal(chapter.manifest.horrorsLocationDeck.removedCount, HORRORS_REMOVED_COUNT)
  assert.equal(chapter.manifest.locations.length, 12)
  assert.equal(chapter.manifest.referenceCode, '10549')
  assert.equal(RESOLUTION_KEYS.length, 5)
  assert.equal(implementedEntryFlags('10553').warrensBack, true)
  assert.equal(implementedEntryFlags('10554').laidToRest, true)
  assert.equal(implementedEntryFlags('10555').crystalGrove, true)
  assert.equal(implementedEntryFlags('10556').resignRemains, true)
  assert.equal(implementedEntryFlags('10557').revealTest.difficulty, 4)
  assert.equal(implementedEntryFlags('10558').codex, 'saltChamber')
  assert.equal(implementedEntryFlags('10559').searchLarva, true)
  assert.equal(implementedEntryFlags('10560').codex, 'crystalNursery')
  assert.equal(implementedEntryFlags('10566').turnEffect.kind, 'choice')
  assert.equal(implementedEntryFlags('10567').turnEffect.kind, 'horror')
  assert.equal(implementedEntryFlags('10568').turnEffect.kind, 'damage')
  assert.equal(implementedEntryFlags('10564').readyShroudBonus, 2)
  assert.equal(implementedEntryFlags('10565').broodQueen, true)
  assert.equal(implementedEntryFlags('10561').test.difficulty, 3)
  assert.equal(registeredEntry('10562').flags.test.difficultyPerLair, 1)
  assert.equal(typeof registeredEntry('10561').encounterResolve, 'function')
  assert.equal(SCENARIO_TEXT.textLanguage, 'en')
  assert.ok(SCENARIO_TEXT.setup.length > 0)
  assert.equal(SETUP_STEPS.length, 15)
  assert.equal(Object.keys(INTRO_BRANCHES).length, 5)
  assert.equal(Object.keys(chapter.scenario.resolutions).length, 5)
  assert.equal(Object.keys(SCENARIO_TEXT.codex).length, 7)
})

// ---------------------------------------------------------------------------
// 2. 遭遇牌库 / 当日组 / 放一边
// ---------------------------------------------------------------------------
test('P7 theSilentHeath 遭遇牌库：固定 38 张 + 当日 3 张，虫后/水晶寄生虫/残骸/地点不进牌库', () => {
  assert.equal(ENCOUNTER_DECK.length, 38)
  assert.equal(ENCOUNTER_DECK.filter(code => code === '10561').length, 2, '号令共振 ×2')
  assert.equal(ENCOUNTER_DECK.filter(code => code === '10562').length, 2, '保卫虫巢 ×2')
  assert.equal(ENCOUNTER_DECK.filter(code => code === COLORLESS_LARVA_CODE).length, 3, '无彩幼虫 ×3')
  assert.equal(ENCOUNTER_DECK.filter(code => code === BROOD_SOLDIER_CODE).length, 3, '族群兵虫 ×3')
  assert.equal(ENCOUNTER_DECK.filter(code => code === CRYSTAL_PARASITE_CODE).length, 0, '水晶寄生虫 ×2 放一边')
  for (const code of [BROOD_QUEEN_CODE, ...CRYSTAL_REMAINS_CODES, ...CAVE_LOCATION_IDS]) {
    assert.equal(ENCOUNTER_DECK.includes(code), false, `不直接进牌库：${code}`)
  }
  for (const day of [1, 2, 3]) {
    const extra = dayGroupCards(day)
    assert.equal(extra.length, 3, `第 ${day} 日组 3 张`)
    assert.equal(chapter.encounterDeckForDay(day).length, 41)
    assert.equal(DAY_TREACHERY_CODES[day].length, 1)
  }
  assert.deepEqual(DAY_TREACHERY_CODES[1], ['10676'])
  assert.deepEqual(DAY_TREACHERY_CODES[2], ['10678'])
  assert.deepEqual(DAY_TREACHERY_CODES[3], ['10680'])
  const { state } = setup(1)
  assert.equal(state.encounterDeck.length, 41)
  assert.ok(state.encounterDeck.includes('10676'))
  assert.ok(!state.encounterDeck.includes('10678'), '非当日组不进牌库')
})

test('P7 theSilentHeath 放一边：虫后 + 水晶寄生虫 ×2 + 水晶残骸 ×3 + 洞穴地点 ×3 + 岩中恐怖 6', () => {
  const { state } = setup(1)
  assert.deepEqual([...state.scenarioZones.setAside].sort(),
    [BROOD_QUEEN_CODE, CRYSTAL_PARASITE_CODE, CRYSTAL_PARASITE_CODE,
      ...CRYSTAL_REMAINS_CODES].sort())
  assert.deepEqual([...state.scenarioZones.setAsideLocations].sort(), [...SET_ASIDE_LOCATION_IDS].sort())
  assert.deepEqual([...behavior.crystalRemainsDeck(state)].sort(), [...CRYSTAL_REMAINS_CODES].sort())
  const manifestSetAside = chapter.manifest.zones.setAside
  assert.equal(manifestSetAside.find(entry => entry.cardCode === BROOD_QUEEN_CODE)?.count, 1)
  assert.equal(manifestSetAside.find(entry => entry.cardCode === CRYSTAL_PARASITE_CODE)?.count, 2)
  assert.equal(manifestSetAside.find(entry => entry.cardCode === '10716')?.count, 2)
  for (const code of SET_ASIDE_LOCATION_IDS.map(id => LOCATIONS[id].code)) {
    assert.equal(manifestSetAside.some(entry => entry.cardCode === code), true)
  }
  assert.equal(HORRORS_SET_ASIDE_CODES.length, 6)
})

test('P7 theSilentHeath 岩中恐怖独立牌库：6 张洗牌，3 张放一边 / 3 张移出游戏且不重复', () => {
  const { state, api } = setup(1)
  const setAside = behavior.horrorsSetAside(state)
  const removed = behavior.horrorsRemoved(state)
  assert.equal(setAside.length, HORRORS_SET_ASIDE_COUNT)
  assert.equal(removed.length, HORRORS_REMOVED_COUNT)
  assert.deepEqual([...setAside, ...removed].sort(), [...HORRORS_POOL_IDS].sort())
  assert.equal(new Set([...setAside, ...removed]).size, 6)
  // 洗牌回调生效：给一个反转洗牌，放一边的应是牌库顶 3 张。
  const reversed = setup(1, { flags: {} })
  reversed.api.shuffle = list => [...list].reverse()
  const built = behavior.buildHorrorsDeck(reversed.state, { shuffle: reversed.api.shuffle })
  assert.deepEqual(built.setAside, [...HORRORS_POOL_IDS].reverse().slice(0, 3))
  // 幕 1 背面只把「放一边」的 3 张放进网格。
  behavior.actReveal(state, state.acts[0], api)
  const placedHorrors = setAside.filter(id => locationOf(state, id))
  assert.equal(placedHorrors.length, 3)
  for (const id of removed) assert.equal(locationOf(state, id), null, '移出的地点不入场')
})

// ---------------------------------------------------------------------------
// 3. 地点连接与网格
// ---------------------------------------------------------------------------
test('P7 theSilentHeath 地点连接：三个起始地点两两图标相连，正交相邻由网格补足', () => {
  assert.deepEqual([...LOCATION_CONNECTIONS.pearlEstateRuins].sort(), ['ashenSlope', 'crystalGrove'])
  assert.deepEqual([...LOCATION_CONNECTIONS.crystalGrove].sort(), ['ashenSlope', 'pearlEstateRuins'])
  assert.deepEqual([...LOCATION_CONNECTIONS.ashenSlope].sort(), ['crystalGrove', 'pearlEstateRuins'])
  assert.deepEqual(LOCATION_CELLS.pearlEstateRuins, { x: 0, y: 0 })
  assert.deepEqual(LOCATION_CELLS.crystalGrove, { x: 1, y: -1 })
  assert.deepEqual(LOCATION_CELLS.ashenSlope, { x: 2, y: 0 })
  assert.deepEqual(HORRORS_SET_ASIDE_CELLS, [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 2, y: -1 }])
  assert.equal(chapter.layout.edges.length, 6)
  const { state, api } = setup(1)
  assert.equal(state.locations.length, 3)
  assert.equal(state.locations.every(location => location.revealed === true), true, '起始地点正面入场')
  const grid = mechanicState(state).grid
  assert.deepEqual({ x: grid.pearlEstateRuins.x, y: grid.pearlEstateRuins.y }, { x: 0, y: 0 })
  assert.deepEqual({ x: grid.crystalGrove.x, y: grid.crystalGrove.y }, { x: 1, y: -1 })
  assert.deepEqual({ x: grid.ashenSlope.x, y: grid.ashenSlope.y }, { x: 2, y: 0 })
  // 三个起始地点在这个网格里并不正交相邻，但印刷图标把它们连起来。
  for (const id of START_LOCATION_IDS) {
    for (const neighbor of LOCATION_CONNECTIONS[id]) {
      assert.equal(LOCATION_CONNECTIONS[neighbor].includes(id), true, `${id} ↔ ${neighbor} 对称`)
    }
  }
  // 幕 1 背面后，新地点与起始地点正交相邻。
  behavior.actReveal(state, state.acts[0], api)
  const pearl = locationOf(state, 'pearlEstateRuins')
  assert.equal(pearl.connections.includes('dryBurrow1') || pearl.connections.includes('dryBurrow2')
    || pearl.connections.includes('alkalineForest'), true)
  assert.equal(pearl.connections.includes('crystalGrove'), true, '图标连接保留')
})

test('P7 theSilentHeath 引擎布置入口：preScenarioSetup / setupLocations / modifyDeck 与网格写入', () => {
  const state = stateWithScenario(2, { day: 2, time: 'Night' })
  const api = makeApi(state)
  const report = behavior.preScenarioSetup(state, null, api)
  assert.equal(report.day, 2)
  assert.equal(report.night, true)
  assert.equal(state.agendas[1].originalCode, DESOLATION_V2_CODE)
  assert.equal(report.timeMarkerCode, TIME_MARKER_CODES[2])
  const deck = behavior.modifyDeck(state, [...ENCOUNTER_DECK])
  assert.equal(deck.length, 41, '固定 38 + 第 2 日组 3')
  assert.ok(deck.includes('10678'))
  const ids = behavior.setupLocations(state, null, { api, shuffle: list => [...list], info: () => {} })
  assert.deepEqual(ids, [...START_LOCATION_IDS])
  assert.equal(state.locations.length, 0, '地点由引擎 placeLocation 放置，钩子只写网格/暗牌库')
  const grid = mechanicState(state).grid
  assert.deepEqual({ x: grid.pearlEstateRuins.x, y: grid.pearlEstateRuins.y }, { x: 0, y: 0 })
  assert.deepEqual({ x: grid.ashenSlope.x, y: grid.ashenSlope.y }, { x: 2, y: 0 })
  assert.equal(behavior.horrorsSetAside(state).length, 3)
  assert.equal(behavior.crystalRemainsDeck(state).length, 3)
  assert.deepEqual([...state.scenarioZones.setAside].sort(),
    [BROOD_QUEEN_CODE, CRYSTAL_PARASITE_CODE, CRYSTAL_PARASITE_CODE, ...CRYSTAL_REMAINS_CODES].sort())
})
// ---------------------------------------------------------------------------
// 4. 昼夜与荒芜
// ---------------------------------------------------------------------------
test('P7 theSilentHeath 昼夜：第 1 日荒芜 v.I，其余日 v.II；时间标记与白日居民', () => {
  const day1 = setup(1, { day: 1 })
  assert.equal(day1.state.agendas[1].originalCode, DESOLATION_V1_CODE)
  assert.equal(dayOf(day1.state), 1)
  assert.equal(isNight(day1.state), false)
  assert.equal(introBranchKey(day1.state), 'intro1')
  assert.equal(behavior.timeMarkerInPlay(day1.state)?.code, TIME_MARKER_CODES[1])
  assert.equal(behavior.timeMarkerInPlay(day1.state)?.face, 'front')
  assert.equal(behavior.residentInPlay(day1.state, 'leah')?.location, RESIDENT_LOCATIONS.leah)
  assert.equal(day1.state.storyAssets.some(asset => asset.code === RESIDENT_ASSETS.rosa), false)

  const day2 = setup(1, { day: 2 })
  assert.equal(day2.state.agendas[1].originalCode, DESOLATION_V2_CODE)
  assert.equal(behavior.timeMarkerInPlay(day2.state)?.code, TIME_MARKER_CODES[2])
  assert.equal(behavior.residentInPlay(day2.state, 'rosa')?.location, RESIDENT_LOCATIONS.rosa)

  const night2 = setup(2, { day: 2, night: true })
  assert.equal(night2.state.agendas[1].originalCode, DESOLATION_V2_CODE)
  assert.equal(isNight(night2.state), true)
  assert.equal(introBranchKey(night2.state), 'intro4')
  assert.equal(behavior.residentsInPlay(night2.state).length, 0, '夜晚不放置居民')
  assert.equal(behavior.timeMarkerInPlay(night2.state)?.code, TIME_MARKER_CODES[2])
  assert.equal(behavior.timeMarkerInPlay(night2.state)?.face, 'back', '夜晚面')
  assert.equal(mechanicState(night2.state).scenarioDate.period, 'night')
  assert.equal(day2.state.scenarioFlags.silentHeathIntro, 'intro2')
  assert.equal(night2.state.campaign.records.day, 2)
  assert.equal(night2.state.campaign.records.time, 'Night')
})

test('P7 theSilentHeath 荒芜关键词：v.I 失去冷漠，v.II 再加猎手；虫后光环覆盖所在地点', () => {
  const { state, api } = setup(1, { day: 2 })
  const soldier = spawnCharacter(state, api, BROOD_SOLDIER_CODE, 'pearlEstateRuins')
  soldier.aloof = true
  // v.I：所有昆虫失去冷漠，但不会获得猎手。
  state.agendas[1] = structuredClone(AGENDA_STAGES[2])
  state.agendaIndex = 1
  behavior.syncInsectKeywords(state, api)
  assert.equal(soldier.aloof, false)
  assert.notEqual(soldier.hunter, true)
  // v.II：失去冷漠 + 获得猎手。
  state.agendas[1] = structuredClone(chapter.DESOLATION_V2_STAGE)
  behavior.syncInsectKeywords(state, api)
  assert.equal(soldier.aloof, false)
  assert.equal(soldier.hunter, true)
  // 没有荒芜时，虫后所在地点的昆虫也失去冷漠。
  state.agendas[1] = structuredClone(AGENDA_STAGES[2])
  state.agendaIndex = 0
  const larva = spawnCharacter(state, api, COLORLESS_LARVA_CODE, 'crystalGrove')
  larva.aloof = true
  spawnCharacter(state, api, BROOD_QUEEN_CODE, 'crystalGrove')
  behavior.syncInsectKeywords(state, api)
  assert.equal(larva.aloof, false)
  assert.equal(atLairLocation(state, { location: 'saltChamber' }), false, '盐厅不在场时不算巢穴')
})

// ---------------------------------------------------------------------------
// 5. 幕 1 背面 + 暗堆 + 洞穴
// ---------------------------------------------------------------------------
test('P7 theSilentHeath 幕 1 背面：3 张岩中恐怖地点未揭示入场，6 个地点各 1 张暗牌', () => {
  const { state, api } = setup(2)
  const before = state.locations.length
  assert.equal(behavior.actReveal(state, state.acts[0], api), true)
  assert.equal(state.locations.length, before + 3)
  const placed = state.locations.slice(before)
  assert.equal(placed.every(location => location.revealed === false), true, '未揭示入场')
  assert.deepEqual(placed.map(location => {
    const grid = mechanicState(state).grid[location.id]
    return { x: grid.x, y: grid.y }
  }), [...HORRORS_SET_ASIDE_CELLS])
  const stacks = state.scenarioZones.beneathStacks
  const targets = [...START_LOCATION_IDS, ...placed.map(location => location.id)]
  assert.equal(targets.length, 6)
  for (const id of targets) assert.equal(stacks[id]?.length, 1, `${id} 底下 1 张暗牌`)
  const kinds = targets.flatMap(id => stacks[id].map(card => card.kind))
  assert.equal(kinds.filter(kind => kind === 'location').length, 3, '3 张洞穴地点')
  assert.equal(kinds.filter(kind => kind === 'encounter').length, 3, '3 张遭遇卡')
  assert.equal(state.encounterDeck.length, 38, '遭遇牌库顶 3 张已移出')
  assert.deepEqual([...state.scenarioZones.setAsideLocations], [], '洞穴地点离开放一边区')
})

test('P7 theSilentHeath 洞穴揭示：法典 Ψ/Ω/Φ 生成 1 残骸 + 2 遭遇卡的 3 张暗堆；幼虫隧道先搜幼虫', () => {
  const { state, api } = setup(2)
  const larvaCode = COLORLESS_LARVA_CODE
  state.encounterDeck = ['10676', larvaCode, '10725']
  state.encounterDiscard = [larvaCode]
  const cave = placeCaveExplicit(state, api, 'larvalTunnel', { x: 1, y: 0 })
  cave.revealed = true
  behavior.revealCave(state, cave, api, 0)
  assert.equal(state.stacks, undefined)
  const stack = behavior.stackAt(state, 'larvalTunnel')
  assert.equal(stack.length, 3, 'Ψ 的 3 张暗堆')
  assert.equal(stack[0].code, CRYSTAL_REMAINS_CODES[0], '第一张是暗放的水晶残骸')
  assert.equal(stack.every(card => card.facedown === true), true)
  assert.equal(behavior.crystalRemainsDeck(state).length, 2)
  assert.equal(state.encounterDeck.length, 0, '遭遇牌库顶 2 张进暗堆')
  const larvaEnemy = state.enemies.find(enemy => enemy.code === larvaCode)
  assert.ok(larvaEnemy, '幼虫隧道生成无彩幼虫')
  assert.equal(larvaEnemy.location, 'larvalTunnel')
  // 法典一次性：再次触发不生成第二堆。
  behavior.revealCave(state, cave, api, 0)
  assert.equal(behavior.stackAt(state, 'larvalTunnel').length, 3)
  // 盐厅 / 水晶温床各自由法典 Ω/Φ 生成暗堆。
  state.encounterDeck = ['10731', '10680']
  const salt = placeCaveExplicit(state, api, 'saltChamber', { x: 2, y: 0 })
  salt.revealed = true
  behavior.revealCave(state, salt, api, 0)
  assert.equal(behavior.stackAt(state, 'saltChamber').length, 3)
  assert.equal(behavior.crystalRemainsDeck(state).length, 1)
  state.encounterDeck = ['10728', '10729']
  const nursery = placeCaveExplicit(state, api, 'crystalNursery', { x: 3, y: 0 })
  nursery.revealed = true
  behavior.revealCave(state, nursery, api, 0)
  assert.equal(behavior.stackAt(state, 'crystalNursery').length, 3)
  assert.equal(behavior.crystalRemainsDeck(state).length, 0)
})

// ---------------------------------------------------------------------------
// 6. 法典
// ---------------------------------------------------------------------------
test('P7 theSilentHeath 法典：母亲瑞秋加关系与奖励经验、莉亚记录与线索、罗莎按幕两次', () => {
  const { state, api } = setup(2)
  assert.equal(codex(state, 'motherRachel', api), true)
  assert.equal(chapter.behavior.relationshipLevel(state, 'motherRachel'), 1)
  assert.equal(state.campaign.records.motherRachelRelationshipLevel, 1, '引擎居民清单读点')
  assert.equal(state.investigators.every(inv => inv.scenarioXpBonus === 1), true, '每位调查员 +1 奖励经验')
  assert.equal(codex(state, 'motherRachel', api), false, '同一法典不能重复结算')

  assert.equal(codex(state, 'leahAtwood', api), true)
  assert.equal(state.campaign.records.leahSearchedThePearlRuins, true)
  assert.equal(state.investigators.every(inv => inv.clues === 1), true, '每位调查员 1 个线索')

  // 罗莎：幕 1 抽 3 张；进入幕 2 后可再次触发并处理地点底下的暗牌。
  state.actIndex = 0
  state.investigators[0].hand = []
  assert.equal(codex(state, 'drRosaMarquez', api), true)
  assert.equal(state.investigators[0].hand.length, 3, '幕 1：抽 3 张')
  assert.equal(codex(state, 'drRosaMarquez', api), false, '同一幕内不能重复')
  state.actIndex = 1
  placeCaveExplicit(state, api, 'saltChamber', { x: 0, y: 1 })
  state.scenarioZones.beneathStacks ||= {}
  state.scenarioZones.beneathStacks.saltChamber = [
    { code: '10676', kind: 'encounter', facedown: true, name: '虫群' },
    { code: '10563', kind: 'encounter', facedown: true, name: '无彩幼虫' },
  ]
  assert.equal(codex(state, 'drRosaMarquez', api), true, '不同幕可以再次触发')
  assert.equal(behavior.stackAt(state, 'saltChamber').length, 1, '翻开后弃掉诡计、其余放回')
  assert.equal(state.encounterDiscard.includes('10676'), true)
})

test('P7 theSilentHeath 法典 Σ：生成族群虫后并把胜利区的昆虫敌人拉回场上', () => {
  const { state, api } = setup(2)
  placeCaveExplicit(state, api, 'crystalNursery', { x: 0, y: 1 })
  state.investigators[0].location = 'crystalNursery'
  state.investigators[1].location = 'crystalNursery'
  state.victoryDisplay.push({ id: 'v1', code: COLORLESS_LARVA_CODE, originalCode: COLORLESS_LARVA_CODE, name: '无彩幼虫', victory: 0 })
  assert.equal(codex(state, 'broodQueen', api), true)
  const queen = behavior.broodQueenInPlay(state)
  assert.ok(queen)
  assert.equal(queen.location, 'crystalNursery', '最多调查员的[[洞穴]]地点')
  assert.equal(queen.health, behavior.broodQueenHealth(state), '生命 = 5 + 天数 × 每调查员')
  assert.equal(state.victoryDisplay.some(entry => entry.code === COLORLESS_LARVA_CODE), false, '胜利区昆虫移出')
  assert.equal(state.enemies.filter(enemy => enemy.code === COLORLESS_LARVA_CODE).length, 1, '在虫后地点重新生成')
  assert.equal(state.scenarioZones.setAside.includes(BROOD_QUEEN_CODE), false, '虫后离开放一边区')
})

// ---------------------------------------------------------------------------
// 7. 幕 2 目标与背面
// ---------------------------------------------------------------------------
test('P7 theSilentHeath 幕 2：所有未败退调查员撤退且胜利区有残骸时推进，背面按残骸数进入结局 1/2', () => {
  // 3 张残骸 → 结局 1
  {
    const { state, api } = setup(2)
    state.actIndex = 1
    for (const inv of state.investigators) inv.resigned = true
    for (const code of CRYSTAL_REMAINS_CODES) {
      state.victoryDisplay.push({ id: code, code, originalCode: code, name: '水晶残骸', victory: 1 })
    }
    assert.equal(behavior.allUndefeatedResigned(state), true)
    assert.equal(behavior.allResigned(state, api), true)
    assert.equal(api.finished, 'resolution1')
    assert.equal(state.scenarioFlags.silentHeathAct2Advancing, true)
  }
  // 1 张残骸 → 结局 2
  {
    const { state, api } = setup(2)
    state.actIndex = 1
    for (const inv of state.investigators) inv.resigned = true
    state.victoryDisplay.push({ id: '10566', code: CRYSTAL_REMAINS_CHILD, originalCode: CRYSTAL_REMAINS_CHILD, name: '水晶残骸', victory: 1 })
    behavior.allResigned(state, api)
    assert.equal(api.finished, 'resolution2')
  }
  // 还有未败退调查员在场 → 即使有残骸也不推进（目标要求「都撤退」）。
  {
    const { state, api } = setup(2)
    state.actIndex = 1
    state.victoryDisplay.push({ id: '10566', code: CRYSTAL_REMAINS_CHILD, originalCode: CRYSTAL_REMAINS_CHILD, name: '水晶残骸', victory: 1 })
    assert.equal(behavior.checkObjectives(state, api), false)
    assert.equal(behavior.maybeAdvanceAct2(state, api), false)
    assert.equal(api.finished, null)
  }
  // 0 张残骸 → 不推进
  {
    const { state, api } = setup(2)
    state.actIndex = 1
    for (const inv of state.investigators) inv.resigned = true
    assert.equal(behavior.allResigned(state, api), false)
    assert.equal(api.finished, null)
    assert.equal(behavior.maybeAdvanceAct2(state, api), false)
  }
})

// ---------------------------------------------------------------------------
// 8. 议程正反面
// ---------------------------------------------------------------------------
test('P7 theSilentHeath 议程 1：正面放置毁灭时按胜利区昆虫揭示标记，[skull] 生成虫后', () => {
  const { state, api } = setup(2)
  state.victoryDisplay.push({ id: 'v1', code: COLORLESS_LARVA_CODE, originalCode: COLORLESS_LARVA_CODE, name: '无彩幼虫', victory: 0 })
  state.victoryDisplay.push({ id: 'v2', code: BROOD_SOLDIER_CODE, originalCode: BROOD_SOLDIER_CODE, name: '族群兵虫', victory: 0 })
  api.tokens = ['0', 'skull']
  assert.equal(behavior.doomPlaced(state, { agenda: true, amount: 1 }, api), true)
  assert.ok(behavior.broodQueenInPlay(state), '揭示了骷髅 → 生成虫后')
  assert.equal(api.tokens.length, 0, '按胜利区昆虫数（2）揭示标记')
})

test('P7 theSilentHeath 议程 1 背面：弃到昆虫敌人由队长抽取，遭遇弃牌堆洗回牌库', () => {
  const { state, api } = setup(2)
  state.encounterDeck = ['10676', BROOD_SOLDIER_CODE, '10725']
  state.encounterDiscard = ['10728']
  state.investigators[0].location = 'pearlEstateRuins'
  assert.equal(behavior.agendaReveal(state, state.agendas[0], api), true)
  const soldier = state.enemies.find(enemy => enemy.code === BROOD_SOLDIER_CODE)
  assert.ok(soldier, '找到的昆虫敌人被抽出并生成（stub 抽取路径）')
  assert.equal(state.encounterDiscard.length, 0, '遭遇弃牌堆洗回牌库')
  assert.equal(state.encounterDeck.includes('10728'), true, '弃牌堆的卡回到牌库')
})

test('P7 theSilentHeath 议程 2 背面：每位调查员 1 点肉体创伤并被击败', () => {
  const { state, api } = setup(2)
  assert.equal(behavior.agendaReveal(state, state.agendas[1], api), true)
  assert.equal(state.investigators.every(inv => inv.defeated === true), true)
  assert.equal(state.campaign.trauma[0].physical, 1)
  assert.equal(state.campaign.trauma[1].physical, 1)
})

// ---------------------------------------------------------------------------
// 9. 混乱标记
// ---------------------------------------------------------------------------
test('P7 theSilentHeath 混乱标记：四档取值与追加效果', () => {
  const { state } = setup(2)
  // 3 个昆虫：2 个在场，1 个在胜利区。
  state.enemies.push({ id: 'e1', code: COLORLESS_LARVA_CODE, traits: ['Insect'], location: 'pearlEstateRuins' })
  state.enemies.push({ id: 'e2', code: BROOD_SOLDIER_CODE, traits: ['Insect'], location: 'pearlEstateRuins' })
  state.victoryDisplay.push({ id: 'v1', code: COLORLESS_LARVA_CODE, originalCode: COLORLESS_LARVA_CODE, name: '无彩幼虫', victory: 0 })
  assert.equal(insectCount(state), 3)
  assert.equal(insectsInPlay(state).length, 2)
  assert.equal(insectsInVictory(state).length, 1)
  assert.equal(skullValue(state), 2, '简单/普通：3 的一半向上取整')
  assert.equal(silentHeathChaosTokenValue(state, 'skull'), -2)
  assert.equal(silentHeathChaosTokenValue(state, 'cultist'), -1)
  assert.equal(silentHeathChaosTokenValue(state, 'tablet'), -3)
  assert.equal(silentHeathChaosTokenValue(state, 'elderthing'), -2)
  assert.equal(silentHeathChaosTokenValue(state, 'frost'), null, '未知标记交回默认表')
  state.difficulty = 'hard'
  assert.equal(isHardSide(state), true)
  assert.equal(skullValue(state), 3, '困难/专家：不折半')
  assert.equal(silentHeathChaosTokenValue(state, 'skull'), -3)
  assert.equal(silentHeathChaosTokenValue(state, 'cultist'), -3)
  assert.equal(silentHeathChaosTokenValue(state, 'tablet'), -5)
  assert.equal(silentHeathChaosTokenValue(state, 'elderthing'), -4)
  assert.deepEqual(silentHeathChaosToken({ ...state, difficulty: 'standard' }, null, 'cultist').onDraw,
    [{ type: 'scenarioToken', token: 'cultist', mode: 'shuffleVictory' }])
  assert.deepEqual(silentHeathChaosToken({ ...state, difficulty: 'standard' }, null, 'tablet').onFail,
    [{ type: 'scenarioToken', token: 'tablet', mode: 'insectAttack' }])
  assert.deepEqual(silentHeathChaosToken(state, null, 'tablet').onDraw,
    [{ type: 'scenarioToken', token: 'tablet', mode: 'insectPhase' }])
  assert.equal(SILENT_HEATH_TOKEN_MEANINGS.standard.cultist.delta, -1)
  assert.equal(SILENT_HEATH_TOKEN_MEANINGS.hard.cultist.delta, -3)
  assert.equal(CHAOS_TOKEN_FACES.length, 4)
})

test('P7 theSilentHeath 混乱标记追加效果：[cultist] 洗回胜利区敌人、[tablet] 昆虫攻击/敌军阶段、[elder_thing] 再揭示', () => {
  const { state, api } = setup(1)
  // [cultist]：胜利区非精英敌人洗回遭遇牌库。
  state.victoryDisplay.push({ id: 'v1', code: COLORLESS_LARVA_CODE, originalCode: COLORLESS_LARVA_CODE, name: '无彩幼虫', victory: 0 })
  assert.equal(behavior.applyTokenEffect(state, state.investigators[0], { token: 'cultist', mode: 'shuffleVictory' }, api), true)
  assert.equal(state.victoryDisplay.length, 0)
  assert.equal(state.encounterDeck.includes(COLORLESS_LARVA_CODE), true)
  // [cultist] 困难/专家：检定失败时不洗回。
  state.victoryDisplay.push({ id: 'v2', code: COLORLESS_LARVA_CODE, originalCode: COLORLESS_LARVA_CODE, name: '无彩幼虫', victory: 0 })
  assert.equal(behavior.applyTokenEffect(state, state.investigators[0],
    { token: 'cultist', mode: 'shuffleVictoryOnSuccess', test: { failedBy: 2 } }, api), false)
  // [tablet] 简单/普通：失败时所在地点昆虫交战并攻击。
  state.investigators[0].location = 'pearlEstateRuins'
  const larva = spawnCharacter(state, api, COLORLESS_LARVA_CODE, 'pearlEstateRuins')
  assert.equal(behavior.applyTokenEffect(state, state.investigators[0], { token: 'tablet', mode: 'insectAttack' }, api), true)
  assert.equal(larva.engagedSeat, 0)
  assert.deepEqual(api.attacks.at(-1), [larva.id, 0])
  // [tablet] 困难/专家：重整最近的昆虫并像敌军阶段一样结算。
  const insect = spawnCharacter(state, api, BROOD_SOLDIER_CODE, 'crystalGrove')
  insect.exhausted = true
  state.investigators[0].location = 'crystalGrove'
  assert.equal(behavior.applyTokenEffect(state, state.investigators[0], { token: 'tablet', mode: 'insectPhase' }, api), true)
  assert.equal(insect.exhausted, false)
  assert.equal(api.attacks.at(-1)[1], 'phase')
  // [elder_thing] 简单/普通：不在巢穴不揭示；在巢穴再揭示并加修正。
  assert.equal(behavior.applyTokenEffect(state, state.investigators[0], { token: 'elderthing', mode: 'lairAnotherToken' }, api), false)
  placeCaveExplicit(state, api, 'saltChamber', { x: 0, y: 1 })
  state.investigators[0].location = 'saltChamber'
  state.investigators[0].location = 'saltChamber'
  api.tokens = ['-2']
  assert.equal(behavior.applyTokenEffect(state, state.investigators[0], { token: 'elderthing', mode: 'lairAnotherToken' }, api), true)
  // 困难/专家 [elder_thing]：巢穴自动失败。
  state.difficulty = 'hard'
  assert.equal(behavior.testAutoFail(state, state.investigators[0], { drawn: ['elderthing'] }), true)
  state.difficulty = 'standard'
  assert.equal(behavior.testAutoFail(state, state.investigators[0], { drawn: ['elderthing'] }), false)
})

// ---------------------------------------------------------------------------
// 10. 敌人
// ---------------------------------------------------------------------------
test('P7 theSilentHeath 族群兵虫：重整时所在地点 +2 隐藏值；巡逻目标为有线索的洞穴', () => {
  const { state, api } = setup(1)
  const soldier = spawnCharacter(state, api, BROOD_SOLDIER_CODE, 'pearlEstateRuins')
  const location = locationOf(state, 'pearlEstateRuins')
  assert.equal(behavior.locationShroudModifier(state, location), 2)
  soldier.exhausted = true
  assert.equal(behavior.locationShroudModifier(state, location), 0)
  assert.deepEqual(registeredEntry(BROOD_SOLDIER_CODE).enemyRule.patrolTarget,
    { kind: 'trait', trait: 'Cave', minClues: 1 })
})

test('P7 theSilentHeath 无彩幼虫攻击后自灭；族群虫后 +1 攻击/每其他昆虫、生命随天数', () => {
  const { state, api } = setup(2, { day: 2 })
  const larva = spawnCharacter(state, api, COLORLESS_LARVA_CODE, 'pearlEstateRuins')
  assert.equal(behavior.enemyAttackResolved(state, larva, state.investigators[0], api), true)
  assert.equal(state.enemies.includes(larva), false, '攻击后被击败/移出')
  // 虫后：场上有 2 个其他昆虫 → 攻击值 +2；生命 = 5 + 天数 × 每调查员。
  state.enemies.push(
    { id: 'i1', code: COLORLESS_LARVA_CODE, originalCode: COLORLESS_LARVA_CODE, traits: ['Insect'], location: 'crystalGrove' },
    { id: 'i2', code: BROOD_SOLDIER_CODE, originalCode: BROOD_SOLDIER_CODE, traits: ['Insect'], location: 'crystalGrove' },
  )
  const queen = spawnCharacter(state, api, BROOD_QUEEN_CODE, 'crystalGrove')
  queen.health = behavior.broodQueenHealth(state)
  assert.equal(behavior.enemyStatModifier(state, queen, 'fight'), 2)
  assert.equal(behavior.enemyStatModifier(state, queen, 'evade'), 0)
  assert.equal(queen.health, 5 + 2 * 2, '第 2 日 × 2 位调查员')
  assert.equal(behavior.enemyStatModifier(state, state.enemies[0], 'fight'), 0)
})

// ---------------------------------------------------------------------------
// 11. 水晶残骸
// ---------------------------------------------------------------------------
test('P7 theSilentHeath 水晶残骸：回合开始伤害/恐惧，水晶果园献纳，击败后成 3 张暗堆', () => {
  const { state, api } = setup(2)
  const child = behavior.giveCrystalRemains(state, state.investigators[0], CRYSTAL_REMAINS_CHILD, api)
  const father = behavior.giveCrystalRemains(state, state.investigators[1], CRYSTAL_REMAINS_FATHER, api)
  const mother = behavior.giveCrystalRemains(state, state.investigators[0], CRYSTAL_REMAINS_MOTHER, api)
  api.choose = () => 'horror'
  behavior.turnBegins(state, state.investigators[0], api)
  assert.equal(state.investigators[0].horror, 1, '孩子：选择恐惧')
  assert.equal(state.investigators[0].damage, 1, '母亲：1 点伤害')
  behavior.turnBegins(state, state.investigators[1], api)
  assert.equal(state.investigators[1].horror, 1, '父亲：1 点恐惧')

  // 水晶果园行动：团队共付 1[per_investigator] 线索把残骸加入胜利区。
  state.investigators[0].location = 'crystalGrove'
  state.investigators[0].clues = 2
  const move = behavior.actions(state, state.investigators[0])
    .find(item => item.rule === 'silentHeathCrystalGrove')
  assert.ok(move)
  assert.equal(behavior.performAction(state, state.investigators[0], move, api), true)
  assert.equal(state.victoryDisplay.some(entry => entry.code === CRYSTAL_REMAINS_CHILD), true)
  assert.equal(state.investigators[0].clues, 0)
  assert.equal(state.investigators[0].assets.length, 1, '只献纳一张残骸')

  // 母亲残骸被击败：与遭遇牌库顶 2 张一起暗放在最近的[[巢穴]]地点底下。
  const remainsMother = state.investigators[0].assets.find(asset => asset.code === CRYSTAL_REMAINS_MOTHER)
  assert.ok(remainsMother)
  placeCaveExplicit(state, api, 'saltChamber', { x: 0, y: -1 })
  state.investigators[0].location = 'pearlEstateRuins'
  remainsMother.damage = 1
  state.encounterDeck = ['10676', '10725', '10728']
  assert.equal(behavior.assetLeftPlay(state, state.investigators[0], remainsMother, api), true)
  const stack = behavior.stackAt(state, 'saltChamber')
  assert.equal(stack.length, 3, '残骸 + 遭遇牌库顶 2 张')
  assert.equal(stack.some(card => card.code === CRYSTAL_REMAINS_MOTHER), true)
  assert.equal(remainsMother.removedFromGame, true, '不再进弃牌堆')
  assert.equal(state.encounterDeck.length, 1)
  void father
})

test('P7 theSilentHeath 珀尔庄园撤退：把受控水晶残骸全部加入胜利区', () => {
  const { state, api } = setup(2)
  state.investigators[0].location = START_LOCATION
  state.investigators[0].resigned = true
  behavior.giveCrystalRemains(state, state.investigators[0], CRYSTAL_REMAINS_CHILD, api)
  behavior.giveCrystalRemains(state, state.investigators[0], CRYSTAL_REMAINS_MOTHER, api)
  assert.equal(behavior.investigatorEliminated(state, state.investigators[0], 0, api), false, '返回 false 让线索照常掉落')
  assert.equal(state.victoryDisplay.length, 2)
  assert.deepEqual(state.victoryDisplay.map(entry => entry.code).sort(), [CRYSTAL_REMAINS_CHILD, CRYSTAL_REMAINS_MOTHER].sort())
  assert.equal(state.investigators[0].assets.length, 0)
})

// ---------------------------------------------------------------------------
// 12. 暗堆行动（幕 2）
// ---------------------------------------------------------------------------
test('P7 theSilentHeath 幕 2 暗堆行动：无线索时抽取顶牌；[fast] 查看顶牌并放底', () => {
  const { state, api } = setup(1)
  state.actIndex = 1
  state.investigators[0].location = 'pearlEstateRuins'
  state.investigators[0].clues = 1
  // 一张遭遇卡，一张洞穴地点。
  state.scenarioZones.beneathStacks = {
    pearlEstateRuins: [
      { code: '10676', kind: 'encounter', facedown: true, name: '虫群' },
      { code: 'saltChamber', kind: 'location', facedown: true, name: '盐厅' },
    ],
  }
  assert.equal(behavior.actions(state, state.investigators[0])
    .find(item => item.rule === 'silentHeathDrawBeneath')?.reason !== undefined, true, '有线索时给原因')
  state.investigators[0].clues = 0
  locationOf(state, 'pearlEstateRuins').clues = 0
  state.encounterDeck = []
  const draw = behavior.actions(state, state.investigators[0])
    .find(item => item.rule === 'silentHeathDrawBeneath')
  state.encounterDeck = []
  assert.equal(behavior.performAction(state, state.investigators[0], draw, api), true)
  assert.equal(behavior.stackAt(state, 'pearlEstateRuins').length, 1)
  assert.equal(state.encounterDiscard.includes('10676'), true, '遭遇卡进入结算/弃牌路径')
  // [fast]：团队付 1 个线索查看顶牌并放到最底下。
  state.investigators[0].clues = 2
  api.choose = () => 'bottom'
  const peek = behavior.actions(state, state.investigators[0])
    .find(item => item.rule === 'silentHeathPeekBeneath')
  assert.ok(peek)
  assert.equal(behavior.performAction(state, state.investigators[0], peek, api), true)
  assert.equal(state.investigators[0].clues, 1)
  // 第二次抽取：顶牌已是洞穴地点，放在相邻空格并揭示（触发法典 → 暗堆）。
  api.choose = () => 'leave'
  state.investigators[0].clues = 0
  state.encounterDeck = ['10725', '10728']
  const nextDraw = behavior.actions(state, state.investigators[0])
    .find(item => item.rule === 'silentHeathDrawBeneath')
  assert.equal(behavior.performAction(state, state.investigators[0], nextDraw, api), true)
  assert.ok(locationOf(state, 'saltChamber'), '洞穴地点入场')
  assert.equal(locationOf(state, 'saltChamber').revealed, true)
  assert.equal(behavior.stackAt(state, 'saltChamber').length, 3, '法典 Ω 生成暗堆（残骸 + 遭遇顶牌 ×2）')
})

// ---------------------------------------------------------------------------
// 13. 结局与记录
// ---------------------------------------------------------------------------
test('P7 theSilentHeath 结局：无结局按残骸张数分流到结局 1/2/4 并写战役记录', () => {
  const cases = [
    { remains: 3, chain: ['resolution1', 'resolution3', 'resolution4'], final: 'resolution4' },
    { remains: 2, chain: ['resolution2', 'resolution3', 'resolution4'], final: 'resolution4' },
    { remains: 1, chain: ['resolution2', 'resolution3', 'resolution4'], final: 'resolution4' },
    { remains: 0, chain: ['resolution4'], final: 'resolution4' },
  ]
  for (const row of cases) {
    const { state, api } = setup(2)
    for (let index = 0; index < row.remains; index++) {
      const code = CRYSTAL_REMAINS_CODES[index]
      state.victoryDisplay.push({ id: code, code, originalCode: code, name: '水晶残骸', victory: 1 })
    }
    assert.deepEqual(resolutionChainForKey(state, 'noResolution'), row.chain)
    const result = behavior.resolution(state, 'noResolution', null, api)
    const records = state.campaign.records
    assert.equal(result.bonus, 0, 'R4 经验由引擎按胜利区结算')
    assert.equal(records.silentHeathResolution, 'noResolution')
    assert.equal(records.silentHeathResolvedTo, row.final)
    assert.equal(records.silentHeathNoResolution, true)
    assert.equal(records.areasSurveyed.pearlRidge, true)
    assert.equal(records.pearlRidgeSurveyed, true)
    if (row.remains === 3) assert.equal(records.theInvestigatorsLaidThePearlFamilyToRest, true)
    else assert.equal(records.theInvestigatorsLaidThePearlFamilyToRest, undefined)
    if (row.remains === 3) assert.equal(records.theRemainsWerePartiallyRecovered, undefined)
    if (row.remains > 0 && row.remains !== 3) assert.equal(records.theRemainsWerePartiallyRecovered, true)
    if (row.chain.includes('resolution3')) assert.equal(records.madamePearlsDiaryWasRecovered, true)
    else assert.equal(records.madamePearlsDiaryWasRecovered, undefined)
  }
  // 直接结局 1 也走完整链（R1 → R3 → R4）。
  const direct = setup(2)
  behavior.resolution(direct.state, 'resolution1', null, direct.api)
  const records = direct.state.campaign.records
  assert.equal(records.silentHeathResolution, 'resolution1')
  assert.equal(records.silentHeathResolvedTo, 'resolution4')
  assert.equal(records.theInvestigatorsLaidThePearlFamilyToRest, true)
  assert.equal(records.madamePearlsDiaryWasRecovered, true)
})

test('P7 theSilentHeath 开场分支与前言：Day 1/2/3 与夜晚取不同 Intro；指南正文完整', () => {
  const day1 = setup(1, { day: 1 })
  const intro1 = behavior.introduction(chapter.scenario, day1.state.campaign.records, day1.state)
  assert.ok(intro1.paragraphs.length > 0)
  assert.equal(intro1.code, '10553')
  assert.ok(intro1.paragraphs.some(text => /Leah Atwood/.test(text)), 'Day 1 的 Intro 1')
  assert.ok(intro1.paragraphs.some(text => /Pearl Estate/.test(text)), 'Intro 5')
  const night = setup(1, { day: 2, night: true })
  const introNight = behavior.introduction(chapter.scenario, night.state.campaign.records, night.state)
  assert.ok(introNight.paragraphs.some(text => /moonlight/.test(text)), '夜晚只读 Intro 4')
  assert.ok(!introNight.paragraphs.some(text => /Leah Atwood/.test(text)))
  assert.equal(SCENARIO_TEXT.introBranches.intro2.length > 0, true)
  assert.equal(SCENARIO_TEXT.resolutionBranches.proceedToResolution1.length > 0, true)
  assert.equal(SCENARIO_TEXT.tooltips.pearlEstateRuinsResign.length > 0, true)
  assert.equal(SCENARIO_TEXT.tokens.easyStandard.skull.length > 0, true)
  assert.equal(SCENARIO_TEXT.codex.drRosaMarquez.act2.length > 0, true)
  assert.equal(SCENARIO_TEXT.xp.bonus.length > 0, true)
})

// ---------------------------------------------------------------------------
// 14. JSON 往返
// ---------------------------------------------------------------------------
test('P7 theSilentHeath JSON 往返：存档后继续幕 1 背面、法典与结局', () => {
  const { state, api } = setup(2, { day: 2 })
  behavior.actReveal(state, state.acts[0], api)
  const restored = clone(state)
  assert.equal(restored.scenario.id, 'theSilentHeath')
  assert.equal(behavior.horrorsSetAside(restored).length, 3)
  assert.deepEqual(Object.keys(restored.scenarioZones.beneathStacks).length, 6)
  // 恢复后继续：走法典与幕 2 目标。
  const restoreApi = makeApi(restored)
  const cave = restored.locations.find(location => location.id === 'saltChamber')
    || restored.locations.find(location => CAVE_LOCATION_IDS.includes(location.id))
  if (cave) {
    cave.revealed = true
    behavior.revealCave(restored, cave, restoreApi, 0)
  }
  restored.actIndex = 1
  for (const inv of restored.investigators) inv.resigned = true
  restored.victoryDisplay.push({ id: '10566', code: CRYSTAL_REMAINS_CHILD, originalCode: CRYSTAL_REMAINS_CHILD, name: '水晶残骸', victory: 1 })
  behavior.checkObjectives(restored, restoreApi)
  assert.equal(restoreApi.finished, 'resolution2')
  behavior.resolution(restored, 'resolution2', null, restoreApi)
  const again = clone(restored)
  assert.equal(again.campaign.records.theRemainsWerePartiallyRecovered, true)
  assert.equal(again.campaign.records.areasSurveyed.pearlRidge, true)
  assert.equal(scenarioSummary(again).crystalRemainsInVictory, 1)
  assert.equal(scenarioSummary(again).day, 2)
})

test('P7 theSilentHeath 诡计显现事件：号令共振失败逐项结算、保卫虫巢失败放毁灭', () => {
  const { state, api } = setup(1)
  state.investigators[0].location = 'pearlEstateRuins'
  state.investigators[0].hand = ['01001', '01002']
  const larva = spawnCharacter(state, api, COLORLESS_LARVA_CODE, 'pearlEstateRuins')
  const picked = ['damage', 'discard', 'insect']
  api.choose = () => picked.shift()
  api.testResult = { success: false, failedBy: 3, value: 0 }
  assert.equal(entry10561.encounterResolve(state, state.investigators[0], {}, {
    ...api, resolveScenarioEvent: (id, payload) => behavior.events[id](state, payload, api),
  }), true)
  assert.equal(state.investigators[0].damage, 1, '第一项：1 点伤害')
  assert.equal(state.investigators[0].hand.length, 1, '第二项：随机弃 1 张手牌')
  assert.equal(larva.engagedSeat, 0, '第三项：最近昆虫交战')
  assert.deepEqual(api.attacks.at(-1), [larva.id, 0])

  // 保卫虫巢：1 个巢穴 → 难度 3；失败在最近昆虫上放 1 毁灭。
  placeCaveExplicit(state, api, 'saltChamber', { x: 0, y: -1 })
  api.testResult = { success: false, failedBy: 1, value: 2 }
  assert.equal(entry10562.encounterResolve(state, state.investigators[0], {}, {
    ...api, resolveScenarioEvent: (id, payload) => behavior.events[id](state, payload, api),
  }), true)
  assert.equal(api.lastTest.difficulty, 3)
  assert.equal(larva.doom, 1)
})

test('P7 theSilentHeath 惨白斜坡：揭示时敏捷(4)失败受 2 伤害', () => {
  const { state, api } = setup(1)
  api.testResult = { success: false, failedBy: 1, value: 3 }
  const location = placeCaveExplicit(state, api, 'saltChamber', { x: 0, y: -1 })
  void location
  const ashen = locationOf(state, 'ashenSlope')
  assert.equal(behavior.locationRevealed(state, ashen, api, 0), true)
  assert.equal(api.lastTest.skill, 'agility')
  assert.equal(api.lastTest.difficulty, 4)
  assert.equal(state.investigators[0].damage, 2)
})
