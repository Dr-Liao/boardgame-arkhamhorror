// P7 最终日黎明（dawnOfTheFinalDay · 序曲 3 · 提示卡 10679a / 10704）章节测试。
//
// 覆盖：序曲结构/manifest（8 地点、1 幕、1 议程、3 结局、无遭遇牌库）、第 3 日布置
// （gather 5 组、时间标记、Mother Rachel / Judith Park 入场、划掉的居民移出、放一边 20 张、
// 毁灭 = 调查员人数）、日期推进与疲劳降级（2 枚非符号标记永久降 1 点）、开场 Intro 1/2 分支、
// 居民关系与传家宝（Heirlooms 10713–10715）、法典 1/2/4/5/6/7/8/9/10/11/13/14/15/16 的
// 条件/分支/一次性、幕 1 背面 The Bliss、议程 1 背面 Bertie's Choice、结局记录与下一次勘察候选、
// 四档混乱标记（谈判自动成功 / 再揭示一枚）、JSON 存档往返。
//
// 本文件不 import engine.js：章节 behavior 只走内容层函数与已登记原语（日历/居民记录/勘察整备），
// 轻量 api 桩覆盖 choose/test/资源/抽牌/生成/故事资产等读点。
import test from 'node:test'
import assert from 'node:assert/strict'
import { mechanicState } from '../src/engine/mechanic-state.js'
import * as chapter from '../content/campaigns/theFeastOfHemlockVale/scenarios/dawnOfTheFinalDay/index.js'
import {
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, CODEX_ENTRIES, CODEX_IDS, CODEX_BY_NUMBER,
  ENCOUNTER_DECK, GATHER_GROUPS, GATHER_SET_ASIDE_GROUPS, SET_ASIDE_CARDS, IN_PLAY_CARDS,
  RESOLUTION_KEYS, RESOLUTION_RECORD, RECORD_KEYS, LOCATIONS, LOCATION_CONNECTIONS, LOCATION_COORDINATES,
  LOCATION_IDS, START_LOCATION, TIME_MARKER_CODE, TIME_MARKER_CODES, SET_ASIDE_LOCATION_IDS,
  REMOVED_CARDS, REMOVED_LOCATION_CODES, REMOVED_STAGE_CODES, HEIRLOOM_CODES, RESIDENT_SPECS,
  RESIDENT_RECORDS, RESIDENT_BY_KEY, RESIDENT_ASSET_CODES, RESIDENT_ENEMY_CODES, RESIDENT_MAX_LEVEL,
  RESIDENTS_IN_PLAY_AT_START, RESIDENTS_SET_ASIDE_CARDS, AGENTS_SET_ASIDE_CARDS, MIASMATIC_SHADOW_CODE,
  ALIEN_WHISPERS_CODE, SURVEY_DESTINATIONS, SURVEY_AREAS, SCENARIO_TEXT, CARD_DATA,
  ENEMY_DEFINITIONS, TREACHERY_DEFINITIONS, STORY_ASSET_DEFINITIONS,
} from '../content/campaigns/theFeastOfHemlockVale/scenarios/dawnOfTheFinalDay/definition.js'
import {
  behavior, implementedEntryFlags, introBranchKey, introSections, readCodex, codexAvailable,
  codexBranch, codexDone, codexTextKeys, planTally, hasPlanUnderway, relationshipLevel,
  addRelationship, residentNote, residentCrossedOut, crossedOutResidentKeys, residentSnapshot,
  residentPlacementState, residentsInPlay, placeResidentFromSetAside, surveyedArea, surveyedScenario,
  surveyChoices, chooseNextSurvey, remember, isRemembered, heirloomCandidates, removeHeirloom,
  lowRelationshipResidents, applyFatigue, timeMarkerInPlay, killedInvestigatorXpShare,
  survivorUpgradePlan, events, actions, performAction, actReveal, agendaReveal, resolution,
  storyResolutionKey, scenarioResolution, resolveChaosToken, chaosTokenValue, introduction,
  CODEX_ENTRY_LIST, setupScenario, preScenarioSetup, setupLocations, afterDeckSetup, prepareScenario,
} from '../content/campaigns/theFeastOfHemlockVale/scenarios/dawnOfTheFinalDay/behavior.js'
import {
  PRELUDE_TOKEN_MEANINGS, PRELUDE_TOKEN_TEXT, CHAOS_TOKEN_FACES, isHardSide, isEasyStandard,
  preludeChaosToken, preludeChaosTokenValue, skullValue, cultistValue, tabletValue, elderThingValue,
  lowerChaosToken, fatigueReplacementPlan, FATIGUE_REPLACEMENT_COUNT, normalizeTokenFace,
  dayNumber,
} from '../content/campaigns/theFeastOfHemlockVale/scenarios/dawnOfTheFinalDay/chaos.js'

// ---------------------------------------------------------------------------
// 轻量状态 / api 桩（与 TSK/FHV 章测试同一写法；不加载整局引擎）
// ---------------------------------------------------------------------------
const clone = value => JSON.parse(JSON.stringify(value))
const makeInvestigator = seat => ({
  seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
  assets: [], hand: [], deck: [], discard: [], threat: [], defeated: false, resigned: false,
})
const stateFor = (investigatorCount = 1, records = {}, flags = {}, extra = {}) => ({
  investigators: Array.from({ length: investigatorCount }, (_, seat) => makeInvestigator(seat)),
  locations: [], enemies: [], storyAssets: [], encounterDeck: [], encounterDiscard: [],
  scenarioFlags: { ...flags }, scenarioZones: {},
  campaign: { leadSeat: 0, records: { ...records }, trauma: {}, investigators: {}, chaosBag: [] },
  victoryDisplay: [], doom: 0, difficulty: 'standard', numInvestigators: investigatorCount,
  phase: 'investigation', round: 1, status: 'playing', ...extra,
})
const stateWithScenario = (count = 1, records = {}, flags = {}, extra = {}) => {
  const state = stateFor(count, records, flags, extra)
  state.scenario = clone(chapter.scenario)
  state.acts = clone(chapter.scenario.acts)
  state.agendas = clone(chapter.scenario.agendas)
  return state
}

/** 可配置 api 桩：choose/test 决定分支；资源/抽牌/生成/故事资产都产生可断言记录。 */
const makeApi = (state, options = {}) => {
  let serial = 0
  const api = {
    state, finished: null, chooses: [], tests: [], draws: [], spawns: [], storyAssets: [],
    autoSuccess: false, searches: [],
    info: () => {},
    choose(request) {
      api.chooses.push(request)
      if (typeof options.choose === 'function') return options.choose(request)
      return request.options?.[0]?.id ?? null
    },
    test(seat, skill, difficulty, resolve) {
      api.tests.push({ seat, skill, difficulty })
      const result = typeof options.testResult === 'function'
        ? options.testResult(seat, skill, difficulty)
        : options.testResult ?? { success: true, value: difficulty, difficulty }
      resolve?.(result)
      return result
    },
    gainResources(seat, amount) { state.investigators[seat].resources += amount },
    loseResources(seat, amount) { state.investigators[seat].resources = Math.max(0, state.investigators[seat].resources - amount) },
    drawCards(seat, amount) {
      api.draws.push({ seat, amount })
      for (let index = 0; index < amount; index += 1) state.investigators[seat].hand.push(`0100${index}`)
      return amount
    },
    discardRandom(seat, amount) {
      const inv = state.investigators[seat]
      const count = Math.min(amount, inv.hand.length)
      inv.discard.push(...inv.hand.splice(0, count))
      return count
    },
    discardChosen(seat, amount) { return api.discardRandom(seat, amount) },
    addTrauma(seat, kind, amount = 1) {
      state.campaign.trauma[seat] ||= { physical: 0, mental: 0 }
      state.campaign.trauma[seat][kind] += amount
    },
    addBasicWeakness(seat, traits) { api.weakness = { seat, traits }; return '01100' },
    setTestAutoSuccess() { api.autoSuccess = true },
    remember(fact) { (state.scenarioFlags.remembered ||= []).push(fact) },
    storyAsset(code, location) {
      const def = chapter.scenario.storyAssets?.[code] || {}
      const asset = {
        id: `sa-${code}-${serial++}`, code, originalCode: code, name: def.name || code, location,
        controllerSeat: null, exhausted: false, tokens: 0, assets: [], attachments: [],
      }
      state.storyAssets.push(asset)
      api.storyAssets.push(code)
      return asset
    },
    spawn(code, location) {
      const def = ENEMY_DEFINITIONS[code] || chapter.scenario.enemies?.[code] || {}
      const enemy = {
        id: `e-${code}-${serial++}`, code, originalCode: code, name: def.name || code, location,
        fight: def.fight ?? 0, evade: def.evade ?? 0, health: def.health ?? 1,
        damage: def.damage || 0, horror: def.horror || 0, traits: [...(def.traits || [])],
        exhausted: false, engagedSeat: null, damageTaken: 0, doom: 0, clues: 0, attachments: [], victory: 0,
      }
      state.enemies.push(enemy)
      api.spawns.push(code)
      return enemy
    },
    searchAndPlayFromDeck(seat, filters) { api.searches.push({ seat, filters }); return [] },
    campaignCard(code, seat) { (state.campaign.records.obtainedHeirlooms ||= []).push(code) },
    addDoom(amount) { state.doom += amount },
    finish(key) { api.finished = key },
    otherCards: [],
  }
  return api
}

const setup = (count = 1, { records = {}, flags = {}, choose, testResult, chaosBag } = {}) => {
  const state = stateWithScenario(count, records, flags)
  if (chaosBag) state.campaign.chaosBag = [...chaosBag]
  const api = makeApi(state, { choose, testResult })
  const report = setupScenario(state, api)
  return { state, api, report }
}

const residentAt = (state, code) => state.storyAssets.find(asset => asset.code === code) || null
const locationOf = (state, id) => state.locations.find(location => location.id === id) || null
// 把放一边的居民放到指定地点（正常由法典 9/11/13 触发；法典测试里直接预置）。
const placeResident = (state, key, location) => placeResidentFromSetAside(state, key, location, makeApi(state, {}))
const GAME_BAG = ['+1', '0', '0', '-1', '-1', '-2', '-2', '-3', 'skull', 'cultist', 'tablet', 'elderthing', 'elderSign']

// ===========================================================================
// 1. 章节结构 / manifest
// ===========================================================================
test('P7 dawnOfTheFinalDay 章节结构：序曲、8 地点、1 幕 1 议程、3 结局与 playable manifest', () => {
  assert.equal(chapter.scenario.id, 'dawnOfTheFinalDay')
  assert.equal(chapter.scenario.originalCode, '10704')
  assert.equal(chapter.scenario.isPrelude, true)
  assert.equal(chapter.scenario.kind, 'prelude')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.campaignId, 'theFeastOfHemlockVale')
  assert.equal(chapter.manifest.referenceCode, '10679a')
  assert.equal(chapter.manifest.kind, 'prelude')
  assert.deepEqual([...ACT_CODES], ['10687'])
  assert.deepEqual([...AGENDA_CODES], ['10686'])
  assert.equal(chapter.scenario.acts.length, 1)
  assert.equal(chapter.scenario.agendas.length, 1)
  assert.equal(AGENDA_STAGES[1].doomThreshold, 6)
  assert.deepEqual(ACT_STAGES[1].objective, { type: 'talkToLocals' })
  assert.equal(Object.keys(LOCATIONS).length, 8)
  assert.equal(chapter.manifest.locations.length, 8)
  assert.equal(chapter.layout.edges.length, 22, '8 地点按印刷图标两两相连（十字路口 6 边）')
  assert.equal(chapter.manifest.startLocationId, START_LOCATION)
  assert.deepEqual(chapter.manifest.zones.encounterDeck, [])
  assert.equal(chapter.manifest.zones.setAside.length, 18)
  assert.equal(chapter.manifest.zones.removed.length, 8)
  assert.equal(chapter.manifest.zones.inPlay.reduce((sum, entry) => sum + entry.count, 0), 3)
  assert.deepEqual([...chapter.manifest.resolutionIds], [...RESOLUTION_KEYS])
  assert.deepEqual([...RESOLUTION_KEYS], ['noResolution', 'resolution1', 'resolution2'])
  assert.deepEqual([...GATHER_GROUPS], ['theFinalDay', 'dayOfTheFeast', 'agentsOfTheColour', 'residents', 'theVale'])
  assert.deepEqual([...GATHER_SET_ASIDE_GROUPS], ['agentsOfTheColour', 'residents'])
  assert.deepEqual([...chapter.manifest.requiredEncounterGroupIds], [...GATHER_GROUPS])
  assert.equal(chapter.implementedEncounterCodes.length, 0, '序曲没有本章专属单卡条目')
  assert.equal(chapter.SCENARIO_TEXT.textLanguage, 'en')
  assert.match(chapter.SCENARIO_TEXT.textStatus, /printed-en/)
  assert.equal(chapter.SCENARIO_TEXT.setupSteps.length, 12)
  assert.equal(chapter.SCENARIO_TEXT.specialRules.length >= 4, true)
  assert.match(chapter.SCENARIO_TEXT.setupSteps[0].text, /The Final Day/)
  assert.match(chapter.SCENARIO_TEXT.setupSteps[2].text, /All is Full of Love/)
  assert.match(chapter.SCENARIO_TEXT.setupSteps[10].text, /Agents of the Colour/)
})

test('P7 dawnOfTheFinalDay 卡号与遭遇定义：时间标记/幕/议程/居民/放一边组齐全', () => {
  assert.equal(TIME_MARKER_CODES[3], TIME_MARKER_CODE)
  assert.deepEqual(Object.keys(TIME_MARKER_CODES), ['3'])
  assert.equal(CARD_DATA['10687'].type, 'act')
  assert.equal(CARD_DATA['10686'].type, 'agenda')
  assert.equal(CARD_DATA['10679'].type, 'story')
  assert.equal(CARD_DATA['10704'].type, 'scenario')
  assert.equal(ENEMY_DEFINITIONS[MIASMATIC_SHADOW_CODE].nameEn, 'Miasmatic Shadow')
  assert.equal(ENEMY_DEFINITIONS[MIASMATIC_SHADOW_CODE].aloof, true)
  assert.equal(ENEMY_DEFINITIONS[MIASMATIC_SHADOW_CODE].hunter, true)
  assert.equal(TREACHERY_DEFINITIONS[ALIEN_WHISPERS_CODE].nameEn, 'Alien Whispers')
  assert.equal(TREACHERY_DEFINITIONS['10680'].nameEn, 'Otherworldly Visions')
  for (const code of ['10693', '10699', '10700']) assert.equal(STORY_ASSET_DEFINITIONS[code].type, 'asset')
  assert.equal(STORY_ASSET_DEFINITIONS[TIME_MARKER_CODE].type, 'story')
  for (const code of RESIDENT_ENEMY_CODES) assert.equal(chapter.scenario.enemies[code].type, 'enemy')
  assert.equal(ENCOUNTER_DECK.length, 0, '序曲 hasEncounterDeck = false')
  assert.equal(SET_ASIDE_CARDS.length, 20)
  assert.equal(RESIDENTS_SET_ASIDE_CARDS.length, 16)
  assert.equal(AGENTS_SET_ASIDE_CARDS.length, 4)
  assert.equal(AGENTS_SET_ASIDE_CARDS.filter(code => code === MIASMATIC_SHADOW_CODE).length, 2)
  assert.deepEqual([...IN_PLAY_CARDS], ['10679', '10693', '10699'])
  assert.equal(RESIDENT_ASSET_CODES.length, 11)
  assert.equal(RESIDENT_MAX_LEVEL, 5)
})

test('P7 dawnOfTheFinalDay 地点：图标连接对称、十字路口连 6 处、坐标来自页 6 地图', () => {
  for (const [id, connections] of Object.entries(LOCATION_CONNECTIONS)) {
    for (const to of connections) {
      assert.equal(LOCATION_CONNECTIONS[to].includes(id), true, `${id} ↔ ${to} 必须对称`)
      assert.equal(Boolean(LOCATIONS[to]), true)
    }
  }
  assert.equal(LOCATION_CONNECTIONS.theCrossroads.length, 6)
  assert.deepEqual([...LOCATIONS.boardingHouse.connections].sort(), ['theCrossroads', 'valeSchoolhouse'])
  assert.equal(LOCATIONS.theOldMill.cluesFixed, 1)
  assert.equal(LOCATIONS.theOldMill.shroud, 4)
  assert.equal(LOCATIONS.boardingHouse.shroud, 3)
  assert.equal(LOCATIONS.theCrossroads.symbol, 'diamond')
  assert.deepEqual(LOCATION_COORDINATES.theCrossroads, { x: 1, y: 2 })
  assert.deepEqual(LOCATION_COORDINATES.boardingHouse, { x: 1, y: 4 })
  assert.equal(LOCATION_IDS.length, 8)
  assert.deepEqual([...SET_ASIDE_LOCATION_IDS], [])
  assert.deepEqual([...REMOVED_STAGE_CODES], ['10688', '10689'])
  assert.equal(REMOVED_LOCATION_CODES.length, 6)
  assert.equal(REMOVED_CARDS.length, 8)
  assert.equal(implementedEntryFlags('10690a').codex, 'theCrossroads')
  assert.equal(implementedEntryFlags('10693').codex, 'motherRachel')
  assert.equal(implementedEntryFlags('10693').parleySkill, 'willpower')
  assert.equal(implementedEntryFlags('10699').parleyActions, 1)
  assert.equal(implementedEntryFlags('10696b').residentEnemy, 'williamHemlock')
  assert.equal(implementedEntryFlags('10679').timeMarker, 'dayThree')
  assert.equal(implementedEntryFlags('10686').agendaBack, 'bertieChoice')
  assert.equal(implementedEntryFlags('10687').actBack, 'theBliss')
  assert.equal(implementedEntryFlags('10724').spawnCodex, 7)
  assert.equal(implementedEntryFlags('10706a').removed, true)
})

// ===========================================================================
// 2. 布置（第 3 日黎明）
// ===========================================================================
test('P7 dawnOfTheFinalDay 布置：gather 5 组、8 地点入场、时间标记、居民入场与放一边', () => {
  const { state, report } = setup(2)
  assert.equal(report.day, 3)
  assert.equal(report.period, 'day')
  assert.equal(report.intro, 'intro2')
  assert.equal(report.doom, 2, 'setup 在议程上放等于调查员人数的毁灭')
  assert.equal(state.locations.length, 8)
  assert.equal(state.locations.every(location => location.revealed === true), true, '序曲地点正面入场')
  assert.equal(locationOf(state, 'theOldMill').clues, 1, '老磨坊印刷 1 线索')
  for (const inv of state.investigators) assert.equal(inv.location, 'boardingHouse')
  assert.equal(state.doom, 2, '议程毁灭 = 调查员人数')
  assert.equal(state.acts[0].originalCode, '10687')
  assert.equal(state.agendas[0].originalCode, '10686')
  assert.equal(state.actIndex, 0)
  assert.equal(state.agendaIndex, 0)
  assert.equal(timeMarkerInPlay(state).code, TIME_MARKER_CODE)
  assert.equal(residentAt(state, '10693').location, 'theCrossroads')
  assert.equal(residentAt(state, '10699').location, 'theCrossroads')
  assert.equal(residentAt(state, '10693').controllerSeat, null, '开局居民无人控制')
  assert.equal(state.scenarioZones.setAside.length, 20)
  assert.equal(state.scenarioZones.setAside.includes('10694'), true)
  assert.equal(state.scenarioZones.setAside.includes('10693'), false, '入场的居民不在放一边')
  assert.equal(state.scenarioZones.removed.length, 8)
  assert.equal(state.campaign.records.day, 3)
  assert.equal(state.campaign.records.time, 'Day')
  assert.equal(state.campaign.records.hemlockDate, '3:day')
  assert.deepEqual(mechanicState(state).scenarioDate, { day: 3, period: 'day' })
  assert.equal(state.investigators[0].scenarioXpBonus ?? 0, 0)
})

test('P7 dawnOfTheFinalDay 布置：被划掉的居民整张移出游戏，不放一边也不入场', () => {
  const state = stateWithScenario(1, {
    day: 3, time: 'Day', motherRachelCrossedOut: true, theoCrossedOut: true,
  })
  const api = makeApi(state, {})
  setupScenario(state, api)
  assert.equal(residentAt(state, '10693'), null, '被划掉的蕾切尔嬷嬷不入场')
  assert.equal(state.scenarioZones.setAside.includes('10693'), false)
  assert.equal(state.scenarioZones.removed.includes('10693'), true)
  assert.equal(state.scenarioZones.removed.includes('10693b'), true)
  assert.equal(state.scenarioZones.removed.includes('10700'), true, '被划掉的希奥同样移出')
  assert.equal(state.scenarioZones.setAside.includes('10700'), false)
  assert.deepEqual(crossedOutResidentKeys(state), ['motherRachel', 'theoPeters'])
  assert.deepEqual(residentsInPlay(state).map(asset => asset.code), ['10699'])
  assert.equal(state.scenarioZones.setAside.length, 18, '放一边 20 - 希奥的正反两面（嬷嬷本不在放一边清单里）')
  assert.equal(state.scenarioZones.removed.length, 12, '固定 8 + 两位被划掉居民的正反两面')
})

test('P7 dawnOfTheFinalDay 引擎布置入口：preScenarioSetup / setupLocations / afterDeckSetup', () => {
  const state = stateWithScenario(3, { day: 3, time: 'Day', drMarquezHasAPlan: true })
  state.campaign.chaosBag = [...GAME_BAG]
  const api = makeApi(state, {})
  const pre = preScenarioSetup(state, [], api)
  assert.equal(pre.day, 3)
  assert.equal(pre.intro, 'intro1')
  assert.deepEqual(pre.introText, ['prelude3.intro.intro1', 'prelude3.intro.intro3'])
  const ids = setupLocations(state, null, { api })
  assert.deepEqual(ids, [...LOCATION_IDS])
  assert.equal(state.locations.length, 0, '地点由引擎 placeLocation 放置')
  assert.equal(state.doom, 3, 'setupLocations 放置等于人数的毁灭')
  const after = afterDeckSetup(state, null, { api })
  assert.equal(after.residentsInPlay.length, 2)
  assert.equal(after.timeMarkerCode, TIME_MARKER_CODE)
  assert.equal(after.setAsideCards.length, 20, '开局居民不在放一边清单里，放一边保持 20 张')
  // prepareScenario 幂等：再次 preScenarioSetup 不重复放毁灭/不重复疲劳。
  const again = preScenarioSetup(state, [], api)
  assert.equal(again.day, 3)
  assert.equal(state.doom, 3)
  assert.equal(api.storyAssets.filter(code => code === TIME_MARKER_CODE).length <= 1, true)
})

// ===========================================================================
// 3. 时间推进与疲劳
// ===========================================================================
test('P7 dawnOfTheFinalDay 时间推进：第 3 日白昼、日期记录与时间标记', () => {
  const state = stateWithScenario(1, { day: 2, time: 'Night' })
  const api = makeApi(state, {})
  const report = prepareScenario(state, api)
  assert.equal(report.day, 3)
  assert.equal(state.campaign.records.day, 3)
  assert.equal(state.campaign.records.time, 'Day')
  assert.equal(state.campaign.records.hemlockDate, '3:day')
  assert.equal(dayNumber(state), 3)
  assert.equal(isHardSide(state), false)
  assert.equal(isEasyStandard(state), true)
  const marker = (() => {
    setupScenario(state, api)
    return timeMarkerInPlay(state)
  })()
  assert.equal(marker.code, TIME_MARKER_CODE)
  assert.equal(marker.face, 'front')
})

test('P7 dawnOfTheFinalDay 疲劳：战役层 fatiguePending 的 2 枚非符号标记降 1 点并清零', () => {
  // 战役层流程：theLongestNight → fatigue 节点只把待替换次数写进 records.fatiguePending。
  const state = stateWithScenario(1, { day: 3, time: 'Day', fatiguePending: 2 })
  state.campaign.chaosBag = [...GAME_BAG]
  state.chaosBag = [...GAME_BAG]
  const api = makeApi(state, {})
  const replaced = applyFatigue(state, api)
  assert.equal(replaced.length, FATIGUE_REPLACEMENT_COUNT)
  assert.deepEqual(replaced.map(row => [row.from, row.to]), [['+1', '0'], ['0', '-1']])
  assert.deepEqual(state.campaign.chaosBag.slice(0, 3), ['0', '-1', '0'])
  assert.deepEqual(state.chaosBag, state.campaign.chaosBag)
  assert.equal(state.campaign.chaosBag.length, GAME_BAG.length)
  assert.equal(state.campaign.records.fatiguePending, 0, '待替换次数已消费')
  // 幂等：第二次返回同一结果，不重复降级。
  const again = applyFatigue(state, makeApi(state, {}))
  assert.deepEqual(again, replaced)
  assert.deepEqual(state.campaign.chaosBag.slice(0, 3), ['0', '-1', '0'])
  // 没有 pending（旧存档/已结算）时不凭空替换。
  const settled = stateWithScenario(1, { day: 3, time: 'Day', fatiguePending: 0 })
  settled.campaign.chaosBag = [...GAME_BAG]
  assert.deepEqual(applyFatigue(settled, makeApi(settled, {})), [])
  assert.deepEqual(settled.campaign.chaosBag, GAME_BAG)
  // 疲劳只挑可降级的非符号标记。
  assert.deepEqual(fatigueReplacementPlan(['skull', '-8', '-2', 'elderSign'], { count: 2 }).map(row => row.to), ['-3'])
  assert.equal(lowerChaosToken('-8'), null)
  assert.equal(lowerChaosToken('+1'), '0')
  assert.equal(lowerChaosToken('skull'), null)
  assert.equal(lowerChaosToken('-7'), '-8')
  assert.equal(normalizeTokenFace('elder_thing'), 'elderthing')
})

test('P7 dawnOfTheFinalDay 疲劳：api.mechanics.chaosTokens.replaceCampaignNumeric 优先', () => {
  const state = stateWithScenario(1, { day: 3, time: 'Day' })
  state.campaign.chaosBag = [...GAME_BAG]
  const calls = []
  const api = makeApi(state, {})
  api.mechanics = { chaosTokens: { replaceCampaignNumeric: (count, delta) => { calls.push([count, delta]); return [{ from: '0', to: '-1' }] } } }
  const replaced = applyFatigue(state, api)
  assert.deepEqual(calls, [[2, -1]])
  assert.deepEqual(replaced, [{ from: '0', to: '-1' }])
})

test('P7 dawnOfTheFinalDay 开场支援：被击败调查员的替补经验为原经验一半（向上取整）', () => {
  assert.equal(killedInvestigatorXpShare(7), 4)
  assert.equal(killedInvestigatorXpShare(0), 0)
  assert.equal(killedInvestigatorXpShare(8), 4)
  const state = stateWithScenario(1, {}, {})
  state.campaign.investigators = {
    0: { id: '10001', code: '10001', status: 'killed', earnedXp: 7 },
    1: { id: '10004', code: '10004', status: 'active', earnedXp: 9 },
  }
  assert.deepEqual(survivorUpgradePlan(state), [{ seat: 0, id: '10001', code: '10001', earnedXp: 7, halfXp: 4 }])
})

// ===========================================================================
// 4. 开场分支
// ===========================================================================
test('P7 dawnOfTheFinalDay 开场：Dr. Marquez has a plan → Intro 1，否则 Intro 2，Intro 3 恒读', () => {
  assert.equal(introBranchKey(stateWithScenario(1, { drMarquezHasAPlan: true })), 'intro1')
  assert.equal(introBranchKey(stateWithScenario(1, {})), 'intro2')
  assert.deepEqual(introSections(stateWithScenario(1, { drMarquezHasAPlan: true })),
    ['prelude3.intro.intro1', 'prelude3.intro.intro3'])
  assert.deepEqual(introSections(stateWithScenario(1, {})), ['prelude3.intro.intro2', 'prelude3.intro.intro3'])
  const withPlan = introduction(chapter.scenario, { drMarquezHasAPlan: true })
  assert.match(withPlan.paragraphs.join('\n'), /Intro 1/)
  assert.match(withPlan.paragraphs.join('\n'), /Intro 3/)
  assert.match(withPlan.paragraphs.join('\n'), /survey assistance/)
  const withoutPlan = introduction(chapter.scenario, {})
  assert.match(withoutPlan.paragraphs.join('\n'), /Intro 2/)
  assert.equal(withoutPlan.code, '10687')
  assert.equal(withoutPlan.version, 3)
})

// ===========================================================================
// 5. 混乱标记（提示卡 10704）
// ===========================================================================
test('P7 dawnOfTheFinalDay 混乱标记：四档 skull/cultist/tablet/elder_thing 取值', () => {
  const standard = { difficulty: 'standard', campaign: { records: { day: 3 } } }
  const hard = { difficulty: 'hard', campaign: { records: { day: 3 } } }
  assert.equal(skullValue(standard), 3)
  assert.equal(skullValue(hard), 4)
  assert.equal(cultistValue(standard), 1)
  assert.equal(cultistValue(standard, { parley: true }), 1)
  assert.equal(cultistValue(hard), -1)
  assert.equal(cultistValue(hard, { parley: true }), 1)
  assert.equal(tabletValue(standard, { handSize: 2 }), 0)
  assert.equal(tabletValue(standard, { handSize: 3 }), -2)
  assert.equal(tabletValue(hard, { handSize: 1 }), -2)
  assert.equal(tabletValue(hard, { handSize: 2 }), -4)
  assert.equal(elderThingValue(standard), -1)
  assert.equal(elderThingValue(hard), -3)
  assert.deepEqual(preludeChaosToken(standard, 'cultist', { parley: true }), {
    token: 'cultist', delta: 1, parley: true, autoSucceed: true, revealAnother: false,
    text: PRELUDE_TOKEN_TEXT.easyStandard.cultist,
  })
  assert.equal(preludeChaosToken(standard, 'elderthing', { parley: true }).revealAnother, true)
  assert.equal(preludeChaosToken(hard, 'elderthing', { parley: true }).revealAnother, true)
  assert.equal(preludeChaosToken(standard, 'elderthing', {}).revealAnother, false)
  assert.equal(preludeChaosTokenValue(hard, 'tablet', { handSize: 0 }), -2, '困难面手牌 < 2 改为 -2')
  assert.equal(preludeChaosTokenValue(hard, 'tablet', { handSize: 2 }), -4)
  assert.equal(preludeChaosToken(standard, 'unknown'), null)
  assert.deepEqual([...CHAOS_TOKEN_FACES], ['skull', 'cultist', 'tablet', 'elderthing'])
  for (const face of CHAOS_TOKEN_FACES) {
    for (const difficulty of ['easy', 'standard', 'hard', 'expert']) {
      assert.ok(PRELUDE_TOKEN_MEANINGS[difficulty][face].text.length > 0)
    }
  }
  assert.equal(CHAOS_TOKEN_FACES.length, 4)
})

test('P7 dawnOfTheFinalDay 混乱标记结算：谈判自动成功与再揭示一枚', () => {
  const state = stateWithScenario(1, { day: 3 })
  const api = makeApi(state, {})
  const parley = { ...state, skillTest: { actionKind: 'parley' } }
  const cultist = resolveChaosToken(parley, state.investigators[0], 'cultist', api)
  assert.equal(api.autoSuccess, true)
  assert.equal(cultist.delta, 1)
  const hardState = { ...parley, difficulty: 'hard' }
  const hardApi = makeApi(state, {})
  assert.equal(resolveChaosToken(hardState, state.investigators[0], 'cultist', hardApi).delta, 1)
  assert.equal(hardApi.autoSuccess, false)
  const elder = resolveChaosToken(parley, state.investigators[0], 'elderthing', makeApi(state, {}))
  assert.equal(elder.drawAnother, true)
  const normal = resolveChaosToken({ ...state, skillTest: {} }, state.investigators[0], 'elderthing', makeApi(state, {}))
  assert.equal(normal.drawAnother, false)
  assert.equal(resolveChaosToken(state, state.investigators[0], 'elderSign', makeApi(state, {})), null)
  assert.equal(chaosTokenValue({ ...state, skillTest: { actionKind: 'parley' } }, 'cultist',
    { hand: [] }), 1)
})

// ===========================================================================
// 6. 法典元数据
// ===========================================================================
test('P7 dawnOfTheFinalDay 法典元数据：14 条（1/2/4/5/6/7/8/9/10/11/13/14/15/16）与印刷编号', () => {
  assert.equal(CODEX_IDS.length, 14)
  assert.deepEqual([...CODEX_IDS].map(id => CODEX_ENTRIES[id].number),
    [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16])
  assert.deepEqual(Object.keys(CODEX_BY_NUMBER).map(Number).sort((a, b) => a - b),
    [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16])
  assert.equal(CODEX_ENTRIES.motherRachel.kind, 'resident')
  assert.equal(CODEX_ENTRIES.motherRachel.limit, 'scenario')
  assert.equal(CODEX_ENTRIES.boardingHouse.limit, 'unlimited')
  assert.equal(CODEX_ENTRIES.boardingHouse.extraActions, true)
  assert.equal(CODEX_ENTRIES.theCrossroads.limit, 'retry')
  assert.deepEqual([...CODEX_ENTRIES.theCrossroads.fireworksTest.skills], ['combat', 'agility'])
  assert.deepEqual([...CODEX_ENTRIES.hemlockChapel.fireworksTest.skills], ['agility'])
  assert.equal(CODEX_ENTRIES.hemlockChapel.fireworksTest.difficulty, 2)
  assert.equal(CODEX_ENTRIES.judithPark.trigger.cost.resourcesPerDay, true)
  assert.equal(CODEX_ENTRIES.theoPeters.trigger.cost.discardPerDay, true)
  assert.equal(CODEX_ENTRIES.gideonMizrah.trigger.actions, 2)
  assert.match(SCENARIO_TEXT.codex.titles.motherRachel, /Codex 1/)
  assert.match(SCENARIO_TEXT.codex.titles.theCommons, /Codex 16/)
  assert.match(SCENARIO_TEXT.codex.entries.motherRachel.branches.thankYou, /Thank you for your prayers/)
  assert.ok(SCENARIO_TEXT.codex.entries.williamHemlock.branches.william3.length > 0)
  assert.ok(SCENARIO_TEXT.codex.fireworksHidden.includes('tally'))
  assert.equal(CODEX_ENTRY_LIST.length, 14)
})

test('P7 dawnOfTheFinalDay 法典可用性：居民必须在场、一次性条目结算后不再可用', () => {
  const { state } = setup(1)
  assert.equal(codexAvailable(state, 'motherRachel'), true)
  assert.equal(codexAvailable(state, 'proxied'), false)
  removeStoryAsset(state, '10693')
  assert.equal(codexAvailable(state, 'motherRachel'), false, '居民不在场时不可触发')
  const { state: fresh } = setup(1)
  const api = makeApi(fresh, {})
  readCodex(fresh, 'theAtwoodHouse', { seat: 0 }, api)
  readCodex(fresh, 'leahAtwood', { seat: 0 }, api)
  assert.equal(codexDone(fresh, 'leahAtwood'), true)
  assert.equal(codexAvailable(fresh, 'leahAtwood'), false)
  assert.equal(readCodex(fresh, 'leahAtwood', { seat: 0 }, api).reason, 'done')
  assert.equal(codexTextKeys(fresh, 'leahAtwood')[0], 'prelude3.codex.leahAtwood.title')
})
const removeStoryAsset = (state, code) => {
  state.storyAssets = state.storyAssets.filter(asset => asset.code !== code)
}

// ===========================================================================
// 7. 居民关系与法典 1/2/4/5/6/7/8
// ===========================================================================
test('P7 dawnOfTheFinalDay 法典 1 蕾切尔嬷嬷：未勘察南方田野无法接近，勘察后二选一', () => {
  const { state } = setup(1)
  const api = makeApi(state, {})
  const unreachable = readCodex(state, 'motherRachel', { seat: 0 }, api)
  assert.equal(unreachable.ok, true)
  assert.equal(unreachable.branch, 'cannotReach')
  assert.equal(unreachable.consumed, false)
  assert.equal(relationshipLevel(state, 'motherRachel'), 0)
  assert.equal(codexDone(state, 'motherRachel'), false, '「无法接近」不消耗条目')
  // 勾选 Southern Fields 后走 Mother Rachel 2。
  state.campaign.records.areasSurveyed = ['southernFields']
  assert.equal(surveyedArea(state, 'southernFields'), true)
  const thankyouApi = makeApi(state, { choose: request => request.options.find(option => option.id === 'thankYou')?.id })
  const thankyou = readCodex(state, 'motherRachel', { seat: 0 }, thankyouApi)
  assert.equal(thankyou.branch, 'thankYou')
  assert.equal(thankyou.consumed, true)
  assert.equal(thankyou.xp, 1)
  assert.equal(state.campaign.records.theInvestigatorsLearnedTheirPlace, true)
  assert.equal(relationshipLevel(state, 'motherRachel'), 1)
  assert.equal(state.investigators[0].scenarioXpBonus, 1)
  // 另一个结局：I see you for what you really are → 关系 -1。
  const second = setup(1, { records: { areasSurveyed: ['southernFields'], motherRachelRelationshipLevel: 2 } })
  assert.equal(second.state.campaign.records.areasSurveyed[0], 'southernFields')
  const iseeApi = makeApi(second.state, { choose: request => request.options.find(option => option.id === 'iSeeYou')?.id })
  const isee = readCodex(second.state, 'motherRachel', { seat: 0 }, iseeApi)
  assert.equal(isee.branch, 'iSeeYou')
  assert.equal(relationshipLevel(second.state, 'motherRachel'), 1)
  assert.equal(second.state.campaign.records.theInvestigatorsLearnedTheirPlace, undefined)
})

test('P7 dawnOfTheFinalDay 法典 2 莉亚：席米恩被划掉 → +1/1XP，否则 +2/2XP', () => {
  const crossed = setup(1, { records: { simeonCrossedOut: true } })
  placeResident(crossed.state, 'leahAtwood', 'theAtwoodHouse')
  const crossedResult = readCodex(crossed.state, 'leahAtwood', { seat: 0 }, makeApi(crossed.state, {}))
  assert.equal(crossedResult.branch, 'crossedOut')
  assert.equal(relationshipLevel(crossed.state, 'leahAtwood'), 1)
  assert.equal(crossed.state.investigators[0].scenarioXpBonus, 1)
  const normal = setup(2)
  placeResident(normal.state, 'leahAtwood', 'theAtwoodHouse')
  const normalResult = readCodex(normal.state, 'leahAtwood', { seat: 0 }, makeApi(normal.state, {}))
  assert.equal(normalResult.branch, 'notCrossedOut')
  assert.equal(relationshipLevel(normal.state, 'leahAtwood'), 2)
  assert.equal(normalResult.xp, 2)
  assert.equal(normal.state.investigators[0].scenarioXpBonus, 2)
  assert.equal(normal.state.investigators[1].scenarioXpBonus, 2, '每位调查员都获得奖励经验')
})

test('P7 dawnOfTheFinalDay 法典 4 威廉：stood by you → William 2，took heart → 记录 is resolved', () => {
  const base = { williamHemlockNotes: ['williamStoodByYou', 'williamTookHeart'] }
  const { state } = setup(1, { records: base })
  placeResident(state, 'williamHemlock', 'theOldMill')
  const result = readCodex(state, 'williamHemlock', { seat: 0 }, makeApi(state, {}))
  assert.equal(result.branch, 'william2')
  assert.equal(result.effects.includes('williamIsResolved'), true)
  assert.equal(residentNote(state, 'williamHemlock', 'williamIsResolved'), true)
  assert.equal(relationshipLevel(state, 'williamHemlock'), 1)
  assert.equal(result.xp, 1)
  const without = setup(1, { records: { williamHemlockNotes: [] } })
  placeResident(without.state, 'williamHemlock', 'theOldMill')
  const other = readCodex(without.state, 'williamHemlock', { seat: 0 }, makeApi(without.state, {}))
  assert.equal(other.branch, 'william3')
  assert.equal(residentNote(without.state, 'williamHemlock', 'williamIsResolved'), false)
})

test('P7 dawnOfTheFinalDay 法典 5/6 河流与基甸：满足笔记记录给关系与经验，否则给资源/抽牌', () => {
  const river = setup(1, { records: {
    riverHawthorneNotes: ['riverStoodByYou', 'theSchemeIsInMotion'],
  } })
  placeResident(river.state, 'riverHawthorne', 'boardingHouse')
  const riverResult = readCodex(river.state, 'riverHawthorne', { seat: 0 }, makeApi(river.state, {}))
  assert.equal(riverResult.branch, 'stoodByYou')
  assert.equal(residentNote(river.state, 'riverHawthorne', 'riverIsReclaimingTheirLegacy'), true)
  assert.equal(relationshipLevel(river.state, 'riverHawthorne'), 1)
  assert.equal(riverResult.xp, 1)
  const poor = setup(1)
  placeResident(poor.state, 'riverHawthorne', 'boardingHouse')
  const riverOther = readCodex(poor.state, 'riverHawthorne', { seat: 0 }, makeApi(poor.state, {}))
  assert.equal(riverOther.branch, 'otherwise')
  assert.equal(poor.state.investigators[0].resources, 8, '否则获得 3 资源')
  const gideon = setup(1, { records: { gideonMizrahNotes: ['gideonStoodByYou'] } })
  placeResident(gideon.state, 'gideonMizrah', 'hemlockChapel')
  const gideonResult = readCodex(gideon.state, 'gideonMizrah', { seat: 0 }, makeApi(gideon.state, {}))
  assert.equal(gideonResult.branch, 'stoodByYou')
  assert.equal(relationshipLevel(gideon.state, 'gideonMizrah'), 1)
  assert.equal(gideonResult.xp, 1)
  const drawApi = makeApi(poor.state, {})
  placeResident(poor.state, 'gideonMizrah', 'hemlockChapel')
  const gideonOther = readCodex(poor.state, 'gideonMizrah', { seat: 0 }, drawApi)
  assert.equal(gideonOther.branch, 'otherwise')
  assert.deepEqual(drawApi.draws, [{ seat: 0, amount: 3 }])
})

test('P7 dawnOfTheFinalDay 法典 7 朱迪斯：生成瘴气之影；站队成功则取得控制权并记录', () => {
  const backed = setup(1, { records: { judithParkNotes: ['judithStoodByYou'] } })
  const result = readCodex(backed.state, 'judithPark', { seat: 0 }, makeApi(backed.state, {}))
  assert.equal(backed.state.enemies.length, 1)
  assert.equal(backed.state.enemies[0].code, MIASMATIC_SHADOW_CODE)
  assert.equal(backed.state.enemies[0].location, 'theCrossroads')
  assert.equal(result.branch, 'judith2')
  assert.equal(residentAt(backed.state, '10699').controllerSeat, 0, '取得朱迪斯控制权')
  assert.equal(residentNote(backed.state, 'judithPark', 'youBackedJudithUp'), true)
  assert.equal(relationshipLevel(backed.state, 'judithPark'), 1)
  assert.equal(result.xp, 1)
  const other = setup(1)
  const otherApi = makeApi(other.state, {})
  other.state.investigators[0].hand = ['01001', '01002']
  const otherResult = readCodex(other.state, 'judithPark', { seat: 0 }, otherApi)
  assert.equal(otherResult.branch, 'judith3')
  assert.equal(otherResult.effects.includes('randomDiscard1'), true)
  assert.equal(other.state.investigators[0].hand.length, 1, '随机弃 1 张手牌')
  assert.equal(other.state.enemies.length, 1, '未站队也会生成瘴气之影')
})

test('P7 dawnOfTheFinalDay 法典 8 希奥：stood by you → 记录 second thoughts；否则记住包裹', () => {
  const stood = setup(1, { records: { theoPetersNotes: ['theoStoodByYou'] } })
  placeResident(stood.state, 'theoPeters', 'tadsGeneralStore')
  const result = readCodex(stood.state, 'theoPeters', { seat: 0 }, makeApi(stood.state, {}))
  assert.equal(result.branch, 'stoodByYou')
  assert.equal(residentNote(stood.state, 'theoPeters', 'theoIsHavingSecondThoughts'), true)
  assert.equal(relationshipLevel(stood.state, 'theoPeters'), 1)
  assert.equal(result.xp, 1)
  const other = setup(1)
  placeResident(other.state, 'theoPeters', 'tadsGeneralStore')
  const otherResult = readCodex(other.state, 'theoPeters', { seat: 0 }, makeApi(other.state, {}))
  assert.equal(otherResult.branch, 'otherwise')
  assert.equal(isRemembered(other.state, 'youAreDeliveringAPackage'), true)
  assert.equal(other.state.campaign.records.youAreDeliveringAPackage, true, '印刷复选框布尔键同写')
  assert.equal(other.state.campaign.records.remembered.youAreDeliveringAPackage, true)
  assert.equal(other.state.scenarioFlags.remembered.includes('youAreDeliveringAPackage'), true)
  assert.equal(codexDone(other.state, 'theoPeters'), true)
  assert.equal(other.state.campaign.records.codexRead.includes('dawnOfTheFinalDay:theoPeters'), true,
    '已读法典镜像进战役层 records.codexRead')
})

// ===========================================================================
// 8. 法典 9（居民入场）与 10/11/13/14/15（藏烟花/地点）
// ===========================================================================
test('P7 dawnOfTheFinalDay 法典 9 旅舍：把放一边的居民放到工作地点，可反复触发', () => {
  const { state } = setup(1)
  const api = makeApi(state, { choose: request => request.options.find(option => option.id === 'williamHemlock')?.id })
  const result = readCodex(state, 'boardingHouse', { seat: 0 }, api)
  assert.equal(result.ok, true)
  assert.equal(result.consumed, false, 'Codex 9 可反复触发')
  assert.equal(result.branch, 'williamHemlock')
  assert.equal(residentPlacementState(state, 'williamHemlock'), 'inPlay')
  assert.equal(residentAt(state, '10696').location, 'theOldMill')
  assert.equal(state.scenarioZones.setAside.includes('10696'), false)
  const theoApi = makeApi(state, { choose: request => request.options.find(option => option.id === 'theoPeters')?.id })
  readCodex(state, 'boardingHouse', { seat: 0 }, theoApi)
  assert.equal(residentAt(state, '10700').location, 'tadsGeneralStore')
  // 额外花费行动：一次多选 2 项（River 已无第三方可选，退化到 1）。
  const extraState = setup(1).state
  const extraApi = makeApi(extraState, {})
  const extra = readCodex(extraState, 'boardingHouse', { seat: 0, extraActions: 2 }, extraApi)
  assert.equal(extra.effects.length, 3, '1 基础 + 2 额外行动 → 最多 3 名居民')
  assert.equal(residentPlacementState(extraState, 'riverHawthorne'), 'inPlay')
  assert.equal(residentAt(extraState, '10697').location, 'boardingHouse')
  const emptyState = setup(1).state
  for (const key of ['williamHemlock', 'theoPeters', 'riverHawthorne']) {
    readCodex(emptyState, 'boardingHouse', { seat: 0, branch: key }, makeApi(emptyState, {}))
  }
  assert.equal(readCodex(emptyState, 'boardingHouse', { seat: 0 }, makeApi(emptyState, {})).reason, 'noResidentsSetAside')
  const blocked = actions(emptyState, { ...emptyState.investigators[0], location: 'boardingHouse' })
    .filter(move => move.rule.startsWith('dawnOfTheFinalDayCodex_boardingHouse'))
  assert.equal(blocked.length, 3)
  assert.equal(blocked.every(move => move.reason === '没有可放入场的居民'), true, '无居民可选时行动带 reason 被引擎筛掉')
})

test('P7 dawnOfTheFinalDay 法典 10 十字路口：The plan is underway 时战斗/敏捷(3)藏烟花', () => {
  const failed = setup(1)
  failed.state.campaign.records.thePlanIsUnderway = 1
  const failApi = makeApi(failed.state, { testResult: { success: false, value: 0, difficulty: 3 } })
  const failedResult = readCodex(failed.state, 'theCrossroads', { seat: 0, skill: 'combat' }, failApi)
  assert.equal(failedResult.branch, 'planUnderway')
  assert.equal(failedResult.test.success, false)
  assert.equal(failedResult.consumed, false, '失败可再次触发')
  assert.equal(planTally(failed.state), 1)
  const successApi = makeApi(failed.state, { testResult: { success: true, value: 3, difficulty: 3 } })
  const success = readCodex(failed.state, 'theCrossroads', { seat: 0 }, successApi)
  assert.equal(success.test.skill, 'combat')
  assert.equal(success.consumed, true)
  assert.equal(success.effects.includes('fireworksHidden'), true)
  assert.equal(planTally(failed.state), 2)
  assert.deepEqual(successApi.tests[0], { seat: 0, skill: 'combat', difficulty: 3 })
  // 没有 plan underway：抽 1 张或得 1 资源。
  const plain = setup(1)
  const plainApi = makeApi(plain.state, { choose: () => 'resource' })
  const otherwise = readCodex(plain.state, 'theCrossroads', { seat: 0 }, plainApi)
  assert.equal(otherwise.branch, 'otherwise')
  assert.equal(otherwise.consumed, true)
  assert.equal(plain.state.investigators[0].resources, 6)
})

test('P7 dawnOfTheFinalDay 法典 11 教堂：无论是否藏烟花先放基甸，2 敏捷成功记 tally', () => {
  const chapel = setup(1)
  chapel.state.campaign.records.thePlanIsUnderway = 1
  const api = makeApi(chapel.state, { testResult: { success: true, value: 2, difficulty: 2 } })
  const result = readCodex(chapel.state, 'hemlockChapel', { seat: 0 }, api)
  assert.equal(residentAt(chapel.state, '10698').location, 'hemlockChapel')
  assert.equal(result.branch, 'planUnderway')
  assert.equal(result.test.skill, 'agility')
  assert.equal(result.consumed, true)
  assert.equal(planTally(chapel.state), 2)
  const plain = setup(1)
  const plainResult = readCodex(plain.state, 'hemlockChapel', { seat: 0 }, makeApi(plain.state, {}))
  assert.equal(plainResult.branch, 'otherwise')
  assert.equal(plainResult.consumed, true)
  assert.equal(residentAt(plain.state, '10698').location, 'hemlockChapel')
  assert.equal(planTally(plain.state), 0)
})

test('P7 dawnOfTheFinalDay 法典 13/14/15：阿特伍德宅放莉亚、杂货店卖物品、学校抽牌/资源', () => {
  const atwood = setup(1)
  const atwoodResult = readCodex(atwood.state, 'theAtwoodHouse', { seat: 0 }, makeApi(atwood.state, {}))
  assert.equal(atwoodResult.consumed, true)
  assert.equal(residentAt(atwood.state, '10694').location, 'theAtwoodHouse')
  assert.equal(readCodex(atwood.state, 'theAtwoodHouse', { seat: 0 }, makeApi(atwood.state, {})).reason, 'done')
  // 14：5 资源换 Item。
  const tad = setup(1)
  tad.state.investigators[0].resources = 5
  const tadApi = makeApi(tad.state, { choose: () => 'spend' })
  const tadResult = readCodex(tad.state, 'tadsGeneralStore', { seat: 0 }, tadApi)
  assert.equal(tadResult.branch, 'otherwise')
  assert.equal(tadResult.effects.includes('spend5SearchItem'), true)
  assert.equal(tad.state.investigators[0].resources, 0)
  assert.deepEqual(tadApi.searches, [{ seat: 0, filters: { type: 'asset', trait: 'Item' } }])
  const tadPoor = setup(1)
  tadPoor.state.investigators[0].resources = 4
  assert.equal(readCodex(tadPoor.state, 'tadsGeneralStore', { seat: 0 }, makeApi(tadPoor.state, {})).branch, 'otherwise')
  // 15：藏烟花失败可重试；无 plan 时抽牌。
  const school = setup(1)
  school.state.campaign.records.thePlanIsUnderway = 1
  const failApi = makeApi(school.state, { testResult: { success: false, value: 0, difficulty: 3 } })
  assert.equal(readCodex(school.state, 'valeSchoolhouse', { seat: 0 }, failApi).consumed, false)
  const okApi = makeApi(school.state, { testResult: { success: true, value: 3, difficulty: 3 }, choose: () => 'draw' })
  const ok = readCodex(school.state, 'valeSchoolhouse', { seat: 0 }, okApi)
  assert.equal(ok.consumed, true)
  assert.equal(planTally(school.state), 2)
  const draw = setup(1)
  const drawApi = makeApi(draw.state, {})
  const other = readCodex(draw.state, 'valeSchoolhouse', { seat: 0 }, drawApi)
  assert.equal(other.branch, 'otherwise')
  assert.deepEqual(drawApi.draws, [{ seat: 0, amount: 1 }])
})

// ===========================================================================
// 9. 法典 16：传家宝与居民关系
// ===========================================================================
test('P7 dawnOfTheFinalDay 法典 16 集会厅：交还传家宝换取关系 ≤2 居民 +1 与全队经验', () => {
  const { state } = setup(2)
  state.investigators[1].deck.push('10715')
  state.campaign.records.theoPetersRelationshipLevel = 2
  const api = makeApi(state, {})
  const result = readCodex(state, 'theCommons', { seat: 0, heirloomCode: '10715', residentKey: 'theoPeters' }, api)
  assert.equal(result.branch, 'regardless')
  assert.equal(result.consumed, true)
  assert.equal(result.effects.includes('heirloom:10715'), true)
  assert.equal(result.effects.includes('relationship:theoPeters'), true)
  assert.equal(state.investigators[1].deck.includes('10715'), false)
  assert.deepEqual(state.campaign.records.obtainedHeirlooms, ['10715'])
  assert.equal(relationshipLevel(state, 'theoPeters'), 3)
  assert.equal(result.xp, 1)
  assert.equal(state.investigators[0].scenarioXpBonus, 1)
  assert.equal(state.investigators[1].scenarioXpBonus, 1)
  assert.equal(codexDone(state, 'theCommons'), true)
  assert.deepEqual([...HEIRLOOM_CODES], ['10713', '10714', '10715'])
})

test('P7 dawnOfTheFinalDay 法典 16：delivering 包裹分支给希奥关系；无传家宝则只结算一次', () => {
  const { state } = setup(1, { records: { remembered: { youAreDeliveringAPackage: true } } })
  const result = readCodex(state, 'theCommons', { seat: 0 }, makeApi(state, {}))
  assert.equal(result.branch, 'delivering')
  assert.equal(result.xp, 1)
  assert.equal(relationshipLevel(state, 'theoPeters'), 1)
  assert.equal(result.consumed, true)
  const candidates = heirloomCandidates(state)
  assert.deepEqual(candidates, [])
  const plain = setup(1)
  plain.state.investigators[0].hand.push('10713')
  assert.equal(heirloomCandidates(plain.state).length, 1)
  assert.deepEqual(removeHeirloom(plain.state, 0, '10713').zone, 'hand')
  assert.equal(heirloomCandidates(plain.state).length, 0)
  assert.equal(removeHeirloom(plain.state, 0, '10713').removed, false)
  assert.deepEqual(lowRelationshipResidents(plain.state).map(row => row.key).includes('motherRachel'), true)
})

// ===========================================================================
// 10. 幕/议程背面与行动
// ===========================================================================
test('P7 dawnOfTheFinalDay 幕 1 背面 The Bliss：精神创伤或随机基础疯狂弱点 + 2 奖励经验', () => {
  const trauma = setup(2)
  const traumaApi = makeApi(trauma.state, { choose: () => 'trauma' })
  assert.equal(actReveal(trauma.state, trauma.state.acts[0], traumaApi), true)
  assert.equal(trauma.state.campaign.trauma[0].mental, 1)
  assert.equal(trauma.state.campaign.trauma[1].mental, 1)
  assert.equal(trauma.state.investigators[0].scenarioXpBonus, 2)
  const madness = setup(1)
  const madnessApi = makeApi(madness.state, { choose: () => 'madness' })
  actReveal(madness.state, madness.state.acts[0], madnessApi)
  assert.deepEqual(madnessApi.weakness, { seat: 0, traits: ['madness'] })
  assert.equal(madness.state.investigators[0].scenarioXpBonus, 2)
  assert.equal(actReveal(madness.state, { code: '99999' }, madnessApi), false)
})

test('P7 dawnOfTheFinalDay 议程 1 背面 Bertie’s Choice：Bertie 有顿悟 → R2，否则 R1', () => {
  const r1 = setup(1)
  const r1Api = makeApi(r1.state, {})
  assert.equal(agendaReveal(r1.state, r1.state.agendas[0], r1Api), true)
  assert.equal(r1Api.finished, 'resolution1')
  const r2 = setup(1, { records: { bertieHadAnEpiphany: true } })
  const r2Api = makeApi(r2.state, {})
  agendaReveal(r2.state, r2.state.agendas[0], r2Api)
  assert.equal(r2Api.finished, 'resolution2')
  assert.equal(agendaReveal(r2.state, { code: '99999' }, r2Api), false)
})

test('P7 dawnOfTheFinalDay 行动：地点法典与居民谈判按所在位置列出并带费用原因', () => {
  const { state } = setup(2)
  const inv = state.investigators[0]
  inv.location = 'theCrossroads'
  const crossroadsMoves = actions(state, inv)
  const rules = crossroadsMoves.map(move => move.rule)
  assert.equal(rules.includes('dawnOfTheFinalDayCodex_motherRachel'), true)
  assert.equal(rules.includes('dawnOfTheFinalDayCodex_judithPark'), true)
  assert.equal(rules.includes('dawnOfTheFinalDayCodex_theCrossroads'), true)
  const judith = crossroadsMoves.find(move => move.rule === 'dawnOfTheFinalDayCodex_judithPark')
  assert.equal(judith.actionKind, 'parley')
  assert.equal(judith.actions, 1)
  // 资源不足时行动带 reason（引擎 moves.js 会过滤 reason）。
  inv.resources = 1
  const poor = actions(state, inv).find(move => move.rule === 'dawnOfTheFinalDayCodex_judithPark')
  assert.equal(poor.reason, '资源不足')
  inv.resources = 5
  // 谈判检定失败不结算法典。
  const failApi = makeApi(state, { testResult: { success: false, value: 0, difficulty: 2 } })
  assert.equal(performAction(state, inv, { rule: 'dawnOfTheFinalDayCodex_motherRachel', codex: 'motherRachel' }, failApi), true)
  assert.equal(codexDone(state, 'motherRachel'), false)
  assert.equal(failApi.tests[0].skill, 'willpower')
  // 成功进入法典。
  const okApi = makeApi(state, { testResult: { success: true, value: 2, difficulty: 2 }, choose: () => 'thankYou' })
  state.campaign.records.areasSurveyed = ['southernFields']
  assert.equal(performAction(state, inv, { rule: 'dawnOfTheFinalDayCodex_motherRachel', codex: 'motherRachel' }, okApi), true)
  assert.equal(codexDone(state, 'motherRachel'), true)
  // 基甸需要 2 行动（他先要由法典 11 或此处的预置放进教堂）。
  placeResident(state, 'gideonMizrah', 'hemlockChapel')
  const gideonMoves = actions(state, { ...inv, location: 'hemlockChapel' })
  const gideon = gideonMoves.find(move => move.rule === 'dawnOfTheFinalDayCodex_gideonMizrah')
  assert.equal(gideon.actions, 2)
  // 旅舍额外选项行动费递增。
  const boardingMoves = actions(state, { ...inv, location: 'boardingHouse' })
  assert.equal(boardingMoves.find(move => move.rule === 'dawnOfTheFinalDayCodex_boardingHouse').actions, 1)
  assert.equal(boardingMoves.find(move => move.rule === 'dawnOfTheFinalDayCodex_boardingHouse_extra1').actions, 2)
  assert.equal(boardingMoves.find(move => move.rule === 'dawnOfTheFinalDayCodex_boardingHouse_extra2').actions, 3)
})

test('P7 dawnOfTheFinalDay 行动：法典事件桥供共享卡经 resolveScenarioEvent 复用', () => {
  const { state } = setup(1)
  const api = makeApi(state, {})
  assert.equal(typeof events.dawnOfTheFinalDayCodex, 'function')
  assert.equal(typeof events.dawnOfTheFinalDayReadCodex, 'function')
  const result = events.dawnOfTheFinalDayCodex(state, { entry: 'theCrossroads', seat: 0 }, api)
  assert.equal(result.ok, true)
  assert.equal(result.branch, 'otherwise')
  assert.equal(codexDone(state, 'theCrossroads'), true)
  assert.equal(events.dawnOfTheFinalDayCodex(state, {}, api), false)
  assert.equal(readCodex(state, 'unknown', { seat: 0 }, api).ok, false)
  assert.equal(implementedEntryFlags('10693').resident, 'motherRachel')
})

// ===========================================================================
// 11. 结局记录 / 勘察候选 / 存档
// ===========================================================================
test('P7 dawnOfTheFinalDay 结局 1：记录 Dr. Marquez has a hunch 并收敛到 Resolution 2', () => {
  const { state } = setup(1)
  const api = makeApi(state, {})
  const result = resolution(state, 'resolution1', [], api)
  assert.equal(result.award, true)
  assert.equal(result.bonus, 0, '奖励经验已由 codex 记入 scenarioXpBonus')
  assert.equal(state.campaign.records.drMarquesHasAHunch, true)
  assert.equal(state.campaign.records.dawnOfTheFinalDayResolution, 'resolution1')
  assert.equal(state.campaign.records.dawnOfTheFinalDayResolvedTo, 'resolution2')
  assert.equal(chapter.behavior.storyResolutionKey(state, 'resolution1'), 'resolution2')
  assert.equal(storyResolutionKey(state, 'noResolution'), 'resolution2')
  assert.equal(RESOLUTION_RECORD.resolution2, 'resolution2')
})

test('P7 dawnOfTheFinalDay 结局 2：烟花 tally ≥ 调查员人数记录 The Vale is full of fireworks', () => {
  const two = setup(2, { records: { thePlanIsUnderway: 2 } })
  resolution(two.state, 'resolution2', [], makeApi(two.state, {}))
  assert.equal(two.state.campaign.records.theValeIsFullOfFireworks, true)
  assert.equal(two.state.scenarioFlags.dawnOfTheFinalDayFireworks, 2)
  const one = setup(2, { records: { thePlanIsUnderway: 1 } })
  resolution(one.state, 'resolution2', [], makeApi(one.state, {}))
  assert.equal(one.state.campaign.records.theValeIsFullOfFireworks, undefined, '1 < 2 不记录')
  const none = setup(1)
  const api = makeApi(none.state, {})
  const result = resolution(none.state, 'noResolution', [], api)
  assert.equal(none.state.investigators[0].doom, 1, '无结局：队长调查员卡上放 1 毁灭')
  assert.equal(result.survey.destinations.length, 5)
  assert.equal(none.state.campaign.records.theValeIsFullOfFireworks, undefined)
  assert.equal(scenarioResolution(none.state, 'noResolution', api).resolution, 'resolution2')
  assert.equal(scenarioResolution(none.state, 'noResolution', api).entry, 'noResolution')
  assert.equal(none.state.campaign.records.dawnOfTheFinalDayResolvedTo, 'resolution2')
  assert.equal(none.state.campaign.records.dawnOfTheFinalDayResolution, 'noResolution')
})

test('P7 dawnOfTheFinalDay 烟花 tally 兼容战役层 schema：布尔复选框与 Simeon 笔记都折算 1 道', () => {
  // 第二日黎明把「The plan is underway」写成 Simeon 的笔记/布尔复选框（campaign records.js）。
  const viaBoolean = stateWithScenario(1, { thePlanIsUnderway: true })
  assert.equal(planTally(viaBoolean), 1)
  assert.equal(hasPlanUnderway(viaBoolean), true)
  const viaNote = stateWithScenario(1, { simeonAtwoodNotes: ['thePlanIsUnderway'] })
  assert.equal(planTally(viaNote), 1)
  const viaNumber = stateWithScenario(1, { thePlanIsUnderway: 3 })
  assert.equal(planTally(viaNumber), 3)
  assert.equal(planTally(stateWithScenario(1, {})), 0)
  // 布尔 1 + 本次藏好 1 道 → 2 道，2 位调查员时满足「1 perPlayer」。
  const { state } = setup(2, { records: { thePlanIsUnderway: true } })
  const api = makeApi(state, { testResult: { success: true, value: 3, difficulty: 3 } })
  readCodex(state, 'theCrossroads', { seat: 0, skill: 'agility' }, api)
  assert.equal(planTally(state), 2)
  // 布尔 true 只折算 1 道；2 位调查员要 2 道才会记录 The Vale is full of fireworks。
  const { state: short } = setup(2, { records: { thePlanIsUnderway: true } })
  resolution(short, 'resolution2', [], makeApi(short, {}))
  assert.equal(short.campaign.records.theValeIsFullOfFireworks, undefined)
  const { state: resolved } = setup(2, { records: { thePlanIsUnderway: 2 } })
  resolution(resolved, 'resolution2', [], makeApi(resolved, {}))
  assert.equal(resolved.campaign.records.theValeIsFullOfFireworks, true)
})

test('P7 dawnOfTheFinalDay 勘察：Areas Surveyed 四种历史写法都可读，候选只留未勘察区域', () => {
  assert.equal(surveyedArea(stateWithScenario(1, { areasSurveyed: ['pearlRidge'] }), 'pearlRidge'), true)
  assert.equal(surveyedArea(stateWithScenario(1, { areasSurveyed: { pearlRidge: true } }), 'pearlRidge'), true)
  assert.equal(surveyedArea(stateWithScenario(1, { pearlRidgeSurveyed: true }), 'pearlRidge'), true)
  assert.equal(surveyedArea(stateWithScenario(1, { areasSurveyedPearlRidge: true }), 'pearlRidge'), true)
  assert.equal(surveyedArea(stateWithScenario(1, {}), 'pearlRidge'), false)
  assert.equal(surveyedScenario(stateWithScenario(1, { areasSurveyed: ['pearlRidge'] }), 'theSilentHeath'), true)
  assert.equal(SURVEY_AREAS.southernFields.scenarioId, 'theLongestNight')
  const state = stateWithScenario(1, { areasSurveyed: ['pearlRidge'] })
  const choices = surveyChoices(state)
  assert.deepEqual(choices.map(option => option.id),
    ['writtenInRock', 'hemlockHouse', 'theLostSister', 'theThingInTheDepths'])
  assert.match(choices[0].label, /Written in Rock/)
  assert.equal(SURVEY_DESTINATIONS.includes('theLongestNight'), false, '夜 3 固定 fateOfTheVale，不在候选里')
  // 选择写入 surveyPreparation（引擎 P4 勘察整备包裹）。
  state.campaign.surveyPreparation = {
    version: 1, source: 'dawnOfTheFinalDay', destinations: [...SURVEY_DESTINATIONS], seats: {},
  }
  const api = makeApi(state, {})
  assert.equal(chooseNextSurvey(state, 0, 'theLostSister', api), true)
  assert.equal(state.campaign.surveyPreparation.chosenDestination, 'theLostSister')
  assert.equal(chooseNextSurvey(state, 0, 'theLongestNight', api), false)
  assert.equal(chooseNextSurvey(state, 0, 'pearlRidge', api), false)
})

test('P7 dawnOfTheFinalDay 记录与存档：关系/笔记/Remember 的键与 JSON 往返', () => {
  const { state } = setup(1, { records: {
    areasSurveyed: ['southernFields'], thePlanIsUnderway: 1,
  } })
  const api = makeApi(state, {})
  addRelationship(state, 'motherRachel', 1, api)
  addRelationship(state, 'motherRachel', 1, api)
  assert.equal(relationshipLevel(state, 'motherRachel'), 2)
  assert.equal(state.campaign.records.relationships.motherRachel, 2, '与战役层同口径双写 relationships[id]')
  addRelationship(state, 'motherRachel', -1, api)
  assert.equal(relationshipLevel(state, 'motherRachel'), 1)
  for (const spec of RESIDENT_SPECS) {
    assert.equal(RESIDENT_RECORDS[spec.key].max, RESIDENT_MAX_LEVEL)
    assert.match(spec.record.level, /RelationshipLevel$/)
    assert.match(spec.record.notes, /Notes$/)
    assert.match(spec.record.crossedOut, /CrossedOut$/)
  }
  assert.equal(RESIDENT_RECORDS.motherRachel.crossedOut, 'motherRachelCrossedOut')
  remember(state, 'youAreDeliveringAPackage', api)
  assert.equal(isRemembered(state, 'youAreDeliveringAPackage'), true)
  const snapshot = residentSnapshot(state)
  assert.equal(snapshot.length, 8)
  assert.equal(snapshot.find(row => row.key === 'motherRachel').inPlay, true)
  assert.equal(snapshot.find(row => row.key === 'leahAtwood').inPlay, false)
  const roundTrip = JSON.parse(JSON.stringify(state))
  assert.equal(relationshipLevel(roundTrip, 'motherRachel'), 1)
  assert.equal(surveyedArea(roundTrip, 'southernFields'), true)
  assert.equal(planTally(roundTrip), 1)
  assert.equal(hasPlanUnderway(roundTrip), true)
  assert.equal(residentsInPlay(roundTrip).length, 2)
  assert.equal(residentPlacementState(roundTrip, 'motherRachel'), 'inPlay')
  assert.equal(residentCrossedOut(roundTrip, 'motherRachel'), false)
  assert.equal(roundTrip.scenarioFlags.dawnOfTheFinalDayReport.day, 3)
  assert.equal(roundTrip.locations.length, 8)
  assert.equal(roundTrip.storyAssets.length, 3)
  // 记录读点：Areas Surveyed 的键名与 base.json#key 一致。
  assert.deepEqual([...Object.keys(SURVEY_AREAS)], ['southernFields'])
  assert.equal(RECORD_KEYS.theValeIsFullOfFireworks, 'theValeIsFullOfFireworks')
  assert.equal(RECORD_KEYS.drMarquesHasAHunch, 'drMarquesHasAHunch')
  assert.equal(RECORD_KEYS.theInvestigatorsLearnedTheirPlace, 'theInvestigatorsLearnedTheirPlace')
  assert.equal(CARD_DATA['10715'].encounterCode, 'heirlooms')
  assert.equal(CARD_DATA['10715'].name, 'The Pearl Diary')
})
