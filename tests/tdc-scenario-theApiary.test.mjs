// P7 养育场（theApiary · 提示卡 11553）章节测试。
//
// 覆盖：章节结构与 manifest、东西向双 Setup（牌库/幕组/放一边/移出游戏）、符号连接、
// 地点从遭遇牌库显现、中央腔室面朝旋转、两段幕间、幕 2 目标与背面结局、
// 议题正反面、四档混乱符号、结局 1–4 与无结局、战役记录与跳章（淹没城区 / 西墙）、
// JSON 存档往返，以及 34 张单卡条目的导入、注册与显现接线。
//
// 本文件不 import engine.js：behavior 只走内容层函数与既有引擎主值（网格 mechanicState）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { assertScenarioManifest } from '../content/schema.js'
import * as chapter from '../content/campaigns/theDrownedCity/scenarios/theApiary/index.js'
import {
  scenario, ACT_CODES, ACT_CODES_BY_DIRECTION, AGENDA_CODES, ACT1_CODE, ACT2_WEST_CODE, ACT2_EAST_CODE,
  AGENDA1_CODE, AGENDA2_CODE, RESOLUTION_KEYS, RESOLUTION_NEXT, RESOLUTION4_NEXT,
  ENCOUNTER_DECK, ENCOUNTER_DECK_WEST, ENCOUNTER_DECK_EAST, ENCOUNTER_DECK_BY_DIRECTION,
  DECK_LOCATION_IDS, DECK_LOCATION_CODES, GATHER_GROUPS_BY_DIRECTION, LOCATIONS, LOCATION_IDS,
  LOCATION_CONNECTIONS, LOCATION_COORDINATES, START_LOCATION, SET_ASIDE_LOCATION_IDS,
  SET_ASIDE_ALIASES, ENEMY_CODES, TREACHERY_CODES, MOTHER_CODE, GROTESQUE_AMALGAM_CODE,
  APIARY_TENDER_CODE, SQUAMOUS_PARASITE_CODE, SQUAMOUS_PARASITE_STORY_CODE, MARIA_RIVERA_CODE,
  ANCIENT_RELIC_CODE, GRISLY_MASK_CODE, HIDDEN_VAULT_STORY_CODE, PARASITIC_TRANSFORMATION_CODE,
  CENTRAL_CHAMBER_ID, FACING_RING, INITIAL_FACING, HIDDEN_LOCATION_BY_DIRECTION, REMOVED_BY_DIRECTION,
  THE_INESCAPABLE_CODES, VICTORY_LOCATION_IDS, SANCTUM_LOCATION_IDS, ENCLAVE_LOCATION_IDS, NEST_LOCATION_IDS,
} from '../content/campaigns/theDrownedCity/scenarios/theApiary/definition.js'
import {
  behavior, setupScenario, expeditionDirection, headedWest, creatureWasDefeated,
  placeLocationAt, revealApiaryLocation, applyRevelation, centralFacing, rotateCentralChamber,
  applyCentralFacing, cultistCardsUnderAct, cultistCardsInVictory, cultistCardCount, motherHealth,
  spawnEnemy, spawnTheInescapable, flipSquamousParasite, flipAncientRelic, flipHiddenVault,
  translateGlyph, glyphsKnown, resolutionChainForKey, resolution4Choice, controlledGrislyMask,
  grantParasiticTransformation, resolution, locationOf, shuffleIntoBottom,
} from '../content/campaigns/theDrownedCity/scenarios/theApiary/behavior.js'
import {
  APIARY_TOKEN_MEANINGS, CHAOS_TOKEN_FACES, apiaryChaosToken, apiaryChaosTokenValue, apiaryTokenText,
  cultistEnemyAtLocation, enemiesAtLocation, isHardSide, doomInPlay, skullValue,
} from '../content/campaigns/theDrownedCity/scenarios/theApiary/chaos.js'

const MODULE_ROOT = '../src/cards/encounter-entries/theDrownedCity/theApiary/'
const CODES = ['11554', '11555', '11556', '11557', '11558', '11559', '11559b', '11560', '11561', '11562',
  '11563', '11564', '11565', '11566', '11567', '11568', '11569', '11570', '11571', '11572', '11573',
  '11574', '11575', '11576', '11577', '11578', '11579', '11579b', '11580', '11580b', '11581', '11581b',
  '11582', '11583']
const ENTRIES = (await Promise.all(CODES.map(code => import(`${MODULE_ROOT}${code}.js`))))
  .map(module => module.default)
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

// ---------------------------------------------------------------------------
// 夹具
// ---------------------------------------------------------------------------
const makeState = (count = 2, records = {}, flags = {}) => ({
  investigators: Array.from({ length: count }, (_, seat) => ({
    seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
    assets: [], hand: [], deck: [], discard: [], threat: [], defeated: false, resigned: false,
  })),
  locations: [], enemies: [], storyAssets: [], encounterDeck: [], encounterDiscard: [],
  scenarioFlags: { ...flags }, scenarioZones: {},
  campaign: { leadSeat: 0, records: { ...records }, trauma: {}, investigators: {} },
  victoryDisplay: [], doom: 0, difficulty: 'standard', numInvestigators: count,
  phase: 'investigation', round: 1, status: 'playing', acts: [], agendas: [],
})
const makeApi = (state, overrides = {}) => {
  let serial = 0
  const api = {
    info: () => {},
    finished: null,
    random: () => 0.25,
    shuffle: list => [...list],
    choose: () => 'westernWall',
    tokens: [],
    revealToken() { return api.tokens.length ? api.tokens.shift() : '0' },
    addTestValue() {},
    present: () => {},
    test(seat, skill, difficulty, resolve) {
      const result = { success: true, failedBy: 0, value: difficulty }
      resolve?.(result)
      return result
    },
    damage(seat, amount = 1) { state.investigators[seat].damage += amount },
    horror(seat, amount = 1) { state.investigators[seat].horror += amount },
    addTrauma(seat, kind, amount = 1) {
      state.campaign.trauma[seat] ||= { physical: 0, mental: 0 }
      state.campaign.trauma[seat][kind] += amount
    },
    addScenarioXpBonus(seat, amount = 1) {
      state.investigators[seat].scenarioXpBonus = (Number(state.investigators[seat].scenarioXpBonus) || 0) + amount
    },
    campaignCard(code, seat, reason) {
      state.campaign.cards ||= []
      state.campaign.cards.push({ code, seat, reason })
    },
    defeat(inv) { inv.defeated = true; inv.defeatCause = 'physical' },
    finish(key) { api.finished = key },
    advanceAct() {
      behavior.actReveal(state, state.acts[state.actIndex], api)
      if (api.finished) return
      state.actIndex += 1
      api.advanced = (api.advanced || 0) + 1
    },
    spawn(code, locationId, extra = {}) {
      serial += 1
      const enemy = {
        id: `${code}-${serial}`, code, originalCode: code, name: code, location: locationId,
        fight: 2, evade: 2, health: 3, damage: 1, horror: 1,
        traits: code === MOTHER_CODE ? ['Abomination', 'Stowaway', 'Elite']
          : code === GROTESQUE_AMALGAM_CODE ? ['Monster', 'Stowaway']
            : code === APIARY_TENDER_CODE ? ['Monster', 'Stowaway']
              : code === SQUAMOUS_PARASITE_CODE ? ['Monster', 'Glyph'] : ['Monster'],
        exhausted: extra.exhausted === true, engagedSeat: extra.engagedSeat ?? null,
        damageTaken: 0, doom: 0, clues: 0, attachments: [],
      }
      state.enemies.push(enemy)
      return enemy
    },
    moveEnemy(enemy, destination) { enemy.location = destination; return true },
    giveAsset(seat, code) {
      const inv = state.investigators[seat]
      if (!inv) return null
      const asset = { id: `asset-${code}-${seat}`, code, originalCode: code, name: code,
        damage: 0, horror: 0, exhausted: false, controllerSeat: seat, ownerSeat: seat, tokens: 0, attachments: [] }
      inv.assets.push(asset)
      return asset
    },
    placeDoomOnCard(card, amount = 1) { card.doom = (Number(card.doom) || 0) + amount; return amount },
    defeatEnemy(enemy) {
      const index = state.enemies.indexOf(enemy)
      if (index < 0) return false
      state.enemies.splice(index, 1)
      return true
    },
    ...overrides,
  }
  api.resolveScenarioEvent = (name, payload) => (typeof behavior.events[name] === 'function'
    ? behavior.events[name](state, payload, api) : false)
  return api
}
const fresh = async (count = 2, records = {}, apiOptions = {}, setUp = true) => {
  const state = makeState(count, records)
  state.scenario = structuredClone(scenario)
  const api = makeApi(state, apiOptions)
  if (setUp) {
    const report = setupScenario(state, api)
    return { state, api, report }
  }
  return { state, api }
}
const WEST = { theExpeditionHeadedWest: true }
const EAST = { theExpeditionHeadedWest: false }
const jsonClone = value => JSON.parse(JSON.stringify(value))
const revealAll = (state, api) => {
  for (const id of LOCATION_IDS) if (!locationOf(state, id)) placeLocationAt(state, id, api, { revealed: true })
}

// ---------------------------------------------------------------------------
// 1. 章节结构 / manifest / 条目
// ---------------------------------------------------------------------------
test('P7 theApiary 章节结构：34 张条目、14 处地点、3 幕 2 议程、5 个结局与 development manifest', () => {
  assert.equal(scenario.id, 'theApiary')
  assert.equal(scenario.referenceCode, '11553')
  assert.deepEqual([...ACT_CODES], ['11556', '11557', '11558'])
  assert.deepEqual([...ACT_CODES_BY_DIRECTION.west], [ACT1_CODE, ACT2_WEST_CODE])
  assert.deepEqual([...ACT_CODES_BY_DIRECTION.east], [ACT1_CODE, ACT2_EAST_CODE])
  assert.deepEqual([...AGENDA_CODES], ['11554', '11555'])
  assert.equal(scenario.acts.length, 3)
  assert.equal(scenario.agendas.length, 2)
  assert.equal(chapter.manifest.status, 'development')
  assert.equal(chapter.manifest.campaignId, 'theDrownedCity')
  assert.equal(chapter.manifest.referenceCode, '11553')
  assert.equal(chapter.manifest.contentVersion, '0.1.0')
  assert.equal(chapter.manifest.locations.length, 14)
  assert.equal(assertScenarioManifest(chapter.manifest), chapter.manifest)
  assert.deepEqual(chapter.manifest.resolutionIds, [...RESOLUTION_KEYS])
  assert.deepEqual([...RESOLUTION_KEYS], ['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4'])
  assert.equal(chapter.implementedEncounterCodes.length, 34)
  assert.equal(chapter.behaviorEntryCodes.length, 28)
  assert.deepEqual([...GATHER_GROUPS_BY_DIRECTION.west],
    ['theApiary', 'cosmicLegacy', 'elderMist', 'theInescapable', 'pilgrims', 'pentagram', 'strikingFear'])
  assert.deepEqual([...GATHER_GROUPS_BY_DIRECTION.east],
    ['theApiary', 'cosmicLegacy', 'elderMist', 'theInescapable', 'starSpawn', 'stowaways', 'strikingFear'])
  assert.equal(chapter.SCENARIO_TEXT.setupSteps.length, 9)
  assert.equal(Object.keys(chapter.SCENARIO_TEXT.resolutions).length, 5)
  assert.equal(CHAOS_TOKEN_FACES.length, 4)
  assert.equal(Object.keys(APIARY_TOKEN_MEANINGS).length, 4)
  assert.equal(scenario.centralChamber.initialFacing, INITIAL_FACING)
  assert.deepEqual([...scenario.centralChamber.facingRing], [...FACING_RING])
  assert.equal(scenario.actCodesByDirection.west.length, 2)
})

test('P7 theApiary 单卡条目：34 个文件、code = 文件名、身份真实且注册唯一 / 显现接线', () => {
  assert.equal(ENTRIES.length, 34)
  assert.equal(new Set(ENTRIES.map(entry => entry.code)).size, 34)
  assert.deepEqual([...ENTRIES.map(entry => entry.code)].sort(), [...CODES].sort())
  for (const entry of ENTRIES) {
    assert.ok(typeof entry.note === 'string' && entry.note.length > 0, entry.code)
    assert.ok(['agenda', 'act', 'location', 'enemy', 'treachery', 'storyAsset'].includes(entry.scope), entry.code)
  }
  // 地点条目通过 encounterResolve 接到 behavior.events.apiaryPlaceLocation。
  const growing = ENTRIES.find(entry => entry.code === '11562')
  assert.equal(typeof growing.encounterResolve, 'function')
  // 诡计 11577 用声明式 treacheryRule.test（引擎读点），11578 用 encounterResolve。
  const curiosity = registeredEntry('11577')
  assert.equal(curiosity.treacheryRule.test.skill, 'willpower')
  assert.deepEqual(curiosity.treacheryRule.test.difficulty, { base: 0, plus: 'shroud' })
  assert.equal(typeof registeredEntry('11578').encounterResolve, 'function')
  // 未接线的条目如实标 implemented:false。
  for (const code of ['11568', '11576', '11583']) assert.equal(registeredEntry(code).implemented, false, code)
  for (const code of ['11573', '11574', '11575', '11580', '11581', '11582']) {
    assert.equal(registeredEntry(code).implemented, true, code)
  }
})

// ---------------------------------------------------------------------------
// 2. 牌库 / 放一边（东西向）
// ---------------------------------------------------------------------------
test('P7 theApiary 遭遇牌库：西向 34 / 东向 35 + 3 张地点；放一边与移出游戏按方向', () => {
  assert.equal(ENCOUNTER_DECK_WEST.length, 31, '西向基础组（未含 3 张洗入的地点）')
  assert.equal(ENCOUNTER_DECK_EAST.length, 32, '东向基础组（未含 3 张洗入的地点）')
  assert.equal(ENCOUNTER_DECK_BY_DIRECTION.west.length, 34)
  assert.equal(ENCOUNTER_DECK_BY_DIRECTION.east.length, 35)
  assert.equal(ENCOUNTER_DECK.length, 34, 'manifest 默认西向')
  assert.deepEqual([...DECK_LOCATION_CODES], ['11562', '11560', '11561'])
  for (const code of DECK_LOCATION_CODES) {
    assert.ok(ALL_CARDS[code], code)
    assert.equal(ENCOUNTER_DECK.includes(code), true, '增生原野/两张血肉道路在牌库')
  }
  for (const code of ['11723', '11724']) {
    assert.equal(ENCOUNTER_DECK_WEST.includes(code), false, '朝圣者组放一边')
    assert.equal(ENCOUNTER_DECK_EAST.includes(code), false, '东向不取朝圣者组')
  }
  for (const code of ['01169', '01170', '01171']) assert.equal(ENCOUNTER_DECK_WEST.includes(code), true, '密会（西向）')
  for (const code of ['11721', '11722']) assert.equal(ENCOUNTER_DECK_EAST.includes(code), true, '偷渡者（东向）')
  for (const code of ['11725', '11727', '11728']) assert.equal(ENCOUNTER_DECK_EAST.includes(code), false, '其余星之眷族移出游戏')
  assert.equal(ENCOUNTER_DECK_EAST.includes('11726'), true, '只取感染星之眷族')
  for (const code of [MOTHER_CODE, GROTESQUE_AMALGAM_CODE, SQUAMOUS_PARASITE_CODE,
    PARASITIC_TRANSFORMATION_CODE, MARIA_RIVERA_CODE, ANCIENT_RELIC_CODE, GRISLY_MASK_CODE,
    ...THE_INESCAPABLE_CODES]) {
    assert.equal(ENCOUNTER_DECK.includes(code), false, `${code} 不进牌库`)
  }
  // manifest 静态区（默认西向）：10 处放一边地点 + 别名；主母被移出游戏。
  assert.equal(SET_ASIDE_LOCATION_IDS.length, 10)
  const setAsideCodes = chapter.manifest.zones.setAside.map(entry => entry.cardCode)
  for (const id of SET_ASIDE_LOCATION_IDS) assert.ok(setAsideCodes.includes(LOCATIONS[id].code), id)
  assert.equal(chapter.manifest.zones.removed.find(entry => entry.cardCode === MOTHER_CODE)?.count, 1)
  assert.equal(SET_ASIDE_ALIASES.filter(code => code === PARASITIC_TRANSFORMATION_CODE).length, 4)
  assert.deepEqual([...REMOVED_BY_DIRECTION.west], [MOTHER_CODE])
  assert.deepEqual([...REMOVED_BY_DIRECTION.east], [MARIA_RIVERA_CODE])
  assert.equal(RESOLUTION_NEXT.west.noResolution, 'theGrandVault')
  assert.equal(RESOLUTION_NEXT.east.noResolution, 'resolution4')
  assert.deepEqual({ ...RESOLUTION4_NEXT }, { drownedQuarter: 'theDrownedQuarter', westernWall: 'theWesternWall' })
})

test('P7 theApiary Setup 西向：朝圣者线幕组、移出主母、玛莉亚放一边、隐藏地点洗入牌库底 10 张', async () => {
  const { state, report } = await fresh(2, WEST)
  assert.equal(report.direction, 'west')
  assert.equal(expeditionDirection(state), 'west')
  assert.equal(headedWest(state), true)
  assert.deepEqual(state.acts.map(act => act.originalCode), [ACT1_CODE, ACT2_WEST_CODE])
  assert.deepEqual([...state.scenarioZones.removed], [MOTHER_CODE])
  assert.equal(state.scenarioZones.setAside.includes(MARIA_RIVERA_CODE), true)
  assert.equal(state.scenarioZones.setAside.includes(MOTHER_CODE), false)
  assert.equal(state.scenarioZones.setAside.includes('11723'), true, '朝圣者组放一边')
  assert.equal(state.encounterDeck.length, 35, '西向 34 + 隐藏地点荧光通道')
  assert.equal(state.encounterDeck.slice(0, 10).includes(LOCATIONS.luminousTunnels.code), true,
    '荧光通道在牌库底 10 张（数组前端）')
  const start = locationOf(state, START_LOCATION)
  assert.equal(start.revealed, true)
  assert.deepEqual(state.investigators.map(inv => inv.location), [START_LOCATION, START_LOCATION])
  assert.equal(state.campaign.records.theExpeditionHeadedWest, true)
})

test('P7 theApiary Setup 东向：蜂巢思维幕组、移出玛莉亚、主母放一边、隐藏地点为攫噬长廊', async () => {
  const { state, report } = await fresh(2, EAST)
  assert.equal(report.direction, 'east')
  assert.equal(expeditionDirection(state), 'east')
  assert.equal(headedWest(state), false)
  assert.deepEqual(state.acts.map(act => act.originalCode), [ACT1_CODE, ACT2_EAST_CODE])
  assert.equal(state.scenarioZones.removed.includes(MARIA_RIVERA_CODE), true)
  assert.equal(state.scenarioZones.setAside.includes(MOTHER_CODE), true)
  assert.equal(state.scenarioZones.setAside.includes(MARIA_RIVERA_CODE), false)
  assert.equal(state.scenarioZones.setAside.includes('11723'), false, '东向不取朝圣者组')
  assert.equal(state.encounterDeck.length, 36, '东向 35 + 隐藏地点攫噬长廊')
  assert.equal(state.encounterDeck.slice(0, 10).includes(LOCATIONS.graspingCorridor.code), true)
  // 若生物已被击败，穷途异魔组移出游戏而不是放一边。
  const defeated = await fresh(1, { ...EAST, theCreatureWasDefeated: true })
  assert.equal(creatureWasDefeated(defeated.state), true)
  for (const code of THE_INESCAPABLE_CODES) {
    assert.equal(defeated.state.scenarioZones.setAside.includes(code), false, `${code} 不放一边`)
  }
  assert.equal(defeated.state.scenarioZones.removed.includes('11744'), true)
})

// ---------------------------------------------------------------------------
// 3. 地点连接（印刷符号）
// ---------------------------------------------------------------------------
test('P7 theApiary 符号连接：入口 6 条、环位符号链、中央腔室动态面朝且全部对称', () => {
  assert.deepEqual([...LOCATION_CONNECTIONS.apiaryEntrance].sort(), [
    'acidicCoelom', 'fleshyPathsEasternBurrows', 'fleshyPathsWesternBurrows',
    'graspingCorridor', 'growingFields', 'luminousTunnels',
  ].sort())
  assert.deepEqual([...LOCATION_CONNECTIONS.growingFields].sort(),
    ['apiaryEntrance', 'hiddenVault'].sort())
  assert.deepEqual([...LOCATION_CONNECTIONS.luminousTunnels].sort(),
    ['apiaryEntrance', 'corruptedVault', 'spawningGrounds', 'starvingCorridor'].sort())
  assert.deepEqual([...LOCATION_CONNECTIONS.acidicCoelom].sort(),
    ['apiaryEntrance', 'spawningGrounds', 'starvingCorridor'].sort())
  assert.deepEqual([...LOCATION_CONNECTIONS.centralChamber], [], '中央腔室静态连接为空（面朝动态写入）')
  // 所有静态连接双向一致（符号列表双向匹配）。
  for (const [from, targets] of Object.entries(LOCATION_CONNECTIONS)) {
    for (const to of targets) assert.ok(LOCATION_CONNECTIONS[to].includes(from), `${from} ↔ ${to}`)
  }
  // layout 与定义一致：14 个坐标（东西向变体共用格）、展示连线来自真实连接。
  assert.equal(Object.keys(chapter.layout.locations).length, 14)
  assert.equal(chapter.layout.edges.length,
    Object.values(LOCATION_CONNECTIONS).reduce((sum, list) => sum + list.length, 0))
  assert.deepEqual(chapter.layout.locations.apiaryEntrance, { x: 0, y: 0 })
  assert.deepEqual(chapter.layout.locations.centralChamber, { x: 0, y: -2 })
  assert.deepEqual([...ENCLAVE_LOCATION_IDS], ['luminousTunnels', 'spawningGrounds', 'lostCampsite'])
  assert.deepEqual([...NEST_LOCATION_IDS], ['graspingCorridor', 'starvingCorridor', 'acidicCoelom'])
  assert.deepEqual([...SANCTUM_LOCATION_IDS], ['lostCampsite', 'acidicCoelom'])
  assert.equal(VICTORY_LOCATION_IDS.length, 5)
})

test('P7 theApiary 地点从遭遇牌库显现：全部入场后从入口可达、网格与遮挡一致', async () => {
  const { state, api } = await fresh(2, WEST)
  revealAll(state, api)
  assert.equal(state.locations.length, 14)
  // 网格坐标按印刷位置写入（东西向变体共用同一格）。
  assert.deepEqual(locationOf(state, 'apiaryEntrance').grid, { x: 0, y: 0 })
  assert.deepEqual(locationOf(state, 'growingFields').grid, { x: 0, y: 1 })
  assert.deepEqual(locationOf(state, 'hiddenVault').grid, { x: 0, y: 2 })
  assert.deepEqual(locationOf(state, 'corruptedVault').grid, { x: -1, y: -2 })
  assert.deepEqual(locationOf(state, 'acidicCoelom').grid, { x: 1, y: -1 })
  // 符号连接从入口遍历可达全部 14 处地点（含隐藏秘库）。
  const seen = new Set([START_LOCATION])
  const queue = [START_LOCATION]
  for (const id of queue) {
    for (const next of locationOf(state, id).connections || []) {
      if (seen.has(next) || !locationOf(state, next)) continue
      seen.add(next)
      queue.push(next)
    }
  }
  assert.equal(seen.size, 14, `从入口可达全部地点：${[...LOCATION_IDS].filter(id => !seen.has(id))}`)
})

test('P7 theApiary 地点显现效果：增生原野带出隐藏秘库、翻涌裂隙生成带鳞寄生虫', async () => {
  const { state, api } = await fresh(2, WEST)
  assert.equal(revealApiaryLocation(state, LOCATIONS.growingFields.code, api, 0), true)
  assert.ok(locationOf(state, 'growingFields'))
  assert.ok(locationOf(state, 'hiddenVault'), '增生原野显现时带出隐藏秘库')
  assert.equal(revealApiaryLocation(state, LOCATIONS.churningChasm.code, api, 0), true)
  const parasite = state.enemies.find(enemy => enemy.code === SQUAMOUS_PARASITE_CODE)
  assert.ok(parasite, '翻涌裂隙显现时生成带鳞寄生虫')
  assert.equal(parasite.location, 'churningChasm')
  assert.equal(parasite.health, 2, '生命 1/人')
  // 隐藏秘库显现：从遭遇牌库找一名敌人生成在此。
  state.enemies = []
  state.encounterDeck = ['11756b', '11723', '11751']
  assert.equal(revealApiaryLocation(state, LOCATIONS.hiddenVault.code, api, 0), true)
  const searched = state.enemies[0]
  assert.ok(searched, '隐藏秘库找到敌人')
  assert.equal(ALL_CARDS[searched.code].type, 'enemy')
  assert.equal(searched.location, 'hiddenVault')
})

test('P7 theApiary 地点显现：荧光通道把繁殖地/腐化秘库洗入牌库底 10，并洗入朝圣者组', async () => {
  const { state, api } = await fresh(2, WEST)
  const targetCodes = [LOCATIONS.spawningGrounds.code, LOCATIONS.corruptedVault.code]
  const before = [...state.encounterDeck]
  state.encounterDeck = [...before]
  state.encounterDiscard = ['11739']
  const pilgrims = state.scenarioZones.setAside.filter(code => code === '11723' || code === '11724')
  assert.ok(pilgrims.length >= 1)
  assert.equal(revealApiaryLocation(state, LOCATIONS.luminousTunnels.code, api, 0), true)
  for (const code of targetCodes) {
    assert.equal(state.encounterDeck.slice(0, 10).includes(code) || state.scenarioZones.setAside.includes(code), true, code)
  }
  assert.equal(state.encounterDeck.includes('11739'), true, '弃牌堆洗回牌库')
  assert.equal(state.scenarioZones.setAside.includes('11723'), false, '朝圣者组洗入牌库')
})

// ---------------------------------------------------------------------------
// 4. 中央腔室面朝 / 旋转
// ---------------------------------------------------------------------------
test('P7 theApiary 中央腔室：初始面朝酸性体腔，顺时针 → 攫噬长廊，逆时针转回，连接随面朝更新', async () => {
  const { state, api } = await fresh(2, EAST)
  revealAll(state, api)
  assert.equal(centralFacing(state), INITIAL_FACING)
  assert.equal(INITIAL_FACING, 'acidicCoelom')
  assert.equal(applyCentralFacing(state, api), true)
  const central = locationOf(state, CENTRAL_CHAMBER_ID)
  assert.deepEqual(central.connections, ['acidicCoelom'])
  assert.equal(locationOf(state, 'acidicCoelom').connections.includes(CENTRAL_CHAMBER_ID), true, '双向连接')
  assert.equal(rotateCentralChamber(state, 'clockwise', api), 'graspingCorridor')
  assert.deepEqual(locationOf(state, CENTRAL_CHAMBER_ID).connections, ['graspingCorridor'])
  assert.equal(locationOf(state, 'acidicCoelom').connections.includes(CENTRAL_CHAMBER_ID), false, '旧面朝连接移除')
  assert.equal(rotateCentralChamber(state, 'counterclockwise', api), 'acidicCoelom')
  // 蜂巢思维幕：一轮结束掷币旋转（随机源 0.25 → heads → 顺时针）。
  state.actIndex = 1
  state.acts[1].originalCode = ACT2_EAST_CODE
  assert.equal(behavior.roundEnded(state, api), true)
  assert.equal(centralFacing(state), 'graspingCorridor')
  assert.equal(state.scenarioFlags.apiaryLastCoin, 'heads')
})

// ---------------------------------------------------------------------------
// 5. 幕间
// ---------------------------------------------------------------------------
test('P7 theApiary 幕 1 背面·西向幕间：入口翻危险出口、异教徒叠到营地下、玛莉亚与穷途异魔入场', async () => {
  const { state, api } = await fresh(2, WEST)
  revealAll(state, api)
  // 把 3 名朝圣者敌人放进遭遇牌库，模拟「搜索所有区域」。
  state.encounterDeck = ['11723', '11723', '11724', '11739']
  state.investigators[0].location = 'lostCampsite'
  const beforeClues = locationOf(state, 'acidicCoelom').clues
  assert.equal(behavior.actReveal(state, state.acts[0], api), true)
  assert.equal(state.scenarioFlags.apiaryInterlude, 'lostPilgrims')
  const entrance = locationOf(state, START_LOCATION)
  assert.equal(entrance.code, '11559b', '养育场入口翻到危险出口面')
  assert.equal(entrance.face, 'dangerousExit')
  assert.equal(cultistCardsUnderAct(state).length >= 3, true, '朝圣者敌人叠到迷失营地下')
  assert.equal(state.encounterDeck.includes('11723'), false)
  assert.ok(controlledGrislyMask(state) === false)
  const maria = state.investigators.flatMap(inv => inv.assets || []).find(asset => asset.code === MARIA_RIVERA_CODE)
  assert.ok(maria, '玛莉亚·里维拉由调查员控制')
  const inescapable = state.enemies.find(enemy => enemy.code === THE_INESCAPABLE_CODES[0])
  assert.ok(inescapable, '穷途异魔入场')
  assert.equal(inescapable.exhausted, true)
  assert.equal(locationOf(state, 'acidicCoelom').clues >= beforeClues, true, '在已揭示地点放线索')
})

test('P7 theApiary 幕 1 背面·东向幕间：重排环位、移除其余地点、中央腔室朝酸性体腔、主母生成', async () => {
  const { state, api } = await fresh(2, EAST)
  revealAll(state, api)
  state.victoryDisplay = []
  for (const location of state.locations) location.clues = 0
  state.investigators[0].location = 'acidicCoelom'
  assert.equal(behavior.actReveal(state, state.acts[0], api), true)
  assert.equal(state.scenarioFlags.apiaryInterlude, 'theHiveMind')
  assert.equal(centralFacing(state), 'acidicCoelom')
  const central = locationOf(state, CENTRAL_CHAMBER_ID)
  assert.ok(central, '中央腔室入场')
  assert.equal(central.connections.includes('acidicCoelom'), true)
  const mother = state.enemies.find(enemy => enemy.code === MOTHER_CODE)
  assert.ok(mother, '主母在中央腔室生成')
  assert.equal(mother.location, CENTRAL_CHAMBER_ID)
  // 其余地点：有胜利 X 且无线索的进胜利区，剩余移出游戏。
  assert.equal(state.locations.some(location => location.id === 'corruptedVault'), false)
  assert.equal(state.victoryDisplay.some(entry => entry.code === LOCATIONS.corruptedVault.code), true)
  assert.deepEqual(locationOf(state, START_LOCATION).grid, { x: -1, y: -2 })
  assert.deepEqual(locationOf(state, 'acidicCoelom').grid, { x: 0, y: -3 })
})

// ---------------------------------------------------------------------------
// 6. 幕 2 / 议题
// ---------------------------------------------------------------------------
test('P7 theApiary 幕 2 西向：异教徒卡牌 ≥5 轮末必须推进 → 幕下 ≥3 张进入结局 1，否则结局 2', async () => {
  const first = await fresh(2, WEST)
  first.state.actIndex = 1
  first.state._roundEndWindow = true
  first.state.scenarioFlags.apiaryCultistsUnder = ['11723', '11723', '11724']
  // 胜利区再加 2 张异教徒 → 合计 5。
  first.state.victoryDisplay.push(
    { id: 'v1', code: '11723', originalCode: '11723', name: '朝圣者侍僧', victory: 0 },
    { id: 'v2', code: '11724', originalCode: '11724', name: '朝圣者领袖', victory: 0 },
  )
  assert.equal(cultistCardCount(first.state), 5)
  assert.equal(behavior.checkObjectives(first.state, first.api), true)
  assert.equal(first.api.finished, 'resolution1', '幕下 3 张 → 结局 1')
  const second = await fresh(2, WEST)
  second.state.actIndex = 1
  second.state._roundEndWindow = true
  second.state.scenarioFlags.apiaryCultistsUnder = ['11723', '11723']
  second.state.victoryDisplay.push(
    { id: 'v1', code: '11723', originalCode: '11723', name: '朝圣者侍僧', victory: 0 },
    { id: 'v2', code: '11723', originalCode: '11723', name: '朝圣者侍僧', victory: 0 },
    { id: 'v3', code: '11724', originalCode: '11724', name: '朝圣者领袖', victory: 0 },
  )
  assert.equal(cultistCardCount(second.state), 5)
  assert.equal(behavior.checkObjectives(second.state, second.api), true)
  assert.equal(second.api.finished, 'resolution2', '幕下 2 张 → 结局 2')
  // 不足 5 张不推进。
  const third = await fresh(2, WEST)
  third.state.actIndex = 1
  third.state._roundEndWindow = true
  assert.equal(behavior.checkObjectives(third.state, third.api), false)
})

test('P7 theApiary 幕 2 东向：主母被击败立刻推进 → 结局 3', async () => {
  const { state, api } = await fresh(2, EAST)
  revealAll(state, api)
  state.actIndex = 1
  state.acts[1].originalCode = ACT2_EAST_CODE
  const mother = spawnEnemy(state, MOTHER_CODE, CENTRAL_CHAMBER_ID, api)
  assert.equal(behavior.enemyDefeated(state, mother, api), true)
  assert.equal(state.scenarioFlags.apiaryMotherDefeated, true)
  assert.equal(behavior.checkObjectives(state, api), true)
  assert.equal(api.finished, 'resolution3')
  assert.equal(motherHealth(state), 8 * 2)
})

test('P7 theApiary 议题：1 背面放线索并把奇丑混种洗入牌库底；2 正面毁灭生成敌人；2 背面击败全场', async () => {
  const first = await fresh(2, WEST)
  revealAll(first.state, first.api)
  for (const location of first.state.locations) location.clues = 0
  first.state.encounterDiscard = ['11739', '11740']
  assert.equal(behavior.agendaReveal(first.state, first.state.agendas[0], first.api), true)
  const noVictory = first.state.locations.filter(location => (location.victory || 0) === 0)
  for (const location of noVictory) {
    assert.equal(location.clues >= (location.maxClues || 0), true, `${location.id} 线索回到线索值`)
  }
  assert.equal(first.state.encounterDeck[0], GROTESQUE_AMALGAM_CODE, '奇丑混种在遭遇牌库底（数组前端）')
  // 议题 2 正面：没有非精英敌人时从牌库顶翻到一名敌人生成。
  const second = await fresh(2, WEST)
  second.state.agendaIndex = 1
  second.state.encounterDeck = ['11739', '11751', '11740']
  second.state.enemies = []
  assert.equal(behavior.doomPlaced(second.state, { agenda: true, amount: 1 }, second.api), true)
  assert.equal(second.state.enemies.length, 1)
  assert.equal(second.state.enemies[0].code, '11751')
  // 已有非精英敌人则不触发。
  assert.equal(behavior.doomPlaced(second.state, { agenda: true, amount: 1 }, second.api), false)
  // 议题 2 背面：每位未撤退调查员被击败。
  const third = await fresh(2, WEST)
  assert.equal(behavior.agendaReveal(third.state, third.state.agendas[1], third.api), true)
  assert.equal(third.state.investigators.every(inv => inv.defeated === true), true)
  assert.equal(third.state.resolution, 'noResolution')
})

// ---------------------------------------------------------------------------
// 7. 混乱标记
// ---------------------------------------------------------------------------
test('P7 theApiary 混乱标记：四档取值（毁灭标记总数 / 异教徒敌人 / 技能）', () => {
  const state = makeState(2)
  for (const enemy of [
    { code: 'a', doom: 2, traits: ['Monster'], location: 'here' },
    { code: 'b', doom: 1, traits: ['Cultist'], location: 'here' },
  ]) state.enemies.push(enemy)
  state.investigators[0].location = 'here'
  state.storyAssets.push({ code: 's', doom: 1 })
  assert.equal(doomInPlay(state), 4)
  assert.equal(skullValue(state), 2, '简单/普通：4 的一半')
  assert.equal(apiaryChaosTokenValue(state, 'skull'), -2)
  assert.equal(apiaryChaosTokenValue(state, 'cultist'), -1)
  assert.equal(apiaryChaosTokenValue(state, 'tablet'), -3)
  assert.equal(apiaryChaosTokenValue(state, 'elderthing'), -4)
  assert.equal(apiaryChaosTokenValue(state, 'frost'), null)
  state.difficulty = 'hard'
  assert.equal(isHardSide(state), true)
  assert.equal(skullValue(state), 4)
  assert.equal(apiaryChaosTokenValue(state, 'skull'), -4)
  assert.equal(apiaryChaosTokenValue(state, 'cultist'), -3)
  assert.equal(apiaryChaosTokenValue(state, 'tablet'), -5)
  assert.equal(apiaryChaosTokenValue(state, 'elderthing'), -6)
  // 毁灭标记上限：普通 4、困难 8。
  state.enemies.push({ code: 'c', doom: 20, traits: [], location: 'elsewhere' })
  assert.equal(skullValue(state), 8)
  assert.equal(apiaryChaosToken({ ...state, difficulty: 'standard' }, state.investigators[0], 'skull').delta, -4)
  assert.equal(apiaryTokenText(state, 'tablet').includes('-5'), true)
  assert.equal(cultistEnemyAtLocation(state, state.investigators[0]), true)
  assert.equal(enemiesAtLocation(state, state.investigators[0]).length, 2)
})

test('P7 theApiary 标记追加效果：[cultist] 再揭示、[tablet] 放毁灭、[elder_thing] 伤害或恐惧', () => {
  const state = makeState(2)
  const api = makeApi(state)
  const inv = state.investigators[0]
  inv.location = 'here'
  state.enemies = [
    { code: 'cultist', name: '异教徒', doom: 0, traits: ['Cultist'], location: 'here' },
    { code: 'other', name: '怪物', doom: 1, traits: ['Monster'], location: 'here' },
  ]
  // [cultist] 再揭示一个标记。
  api.tokens = ['-2']
  assert.equal(behavior.applyTokenEffect(state, inv, { token: 'cultist', mode: 'revealAnother' }, api), true)
  assert.equal(api.tokens.length, 0)
  // [tablet] 普通：优先无毁灭标记的敌人。
  assert.equal(behavior.applyTokenEffect(state, inv, { token: 'tablet', mode: 'doomOnEnemyNoDoom' }, api), true)
  assert.equal(state.enemies[0].doom, 1)
  assert.equal(state.enemies[1].doom, 1)
  // 两个都有毁灭时，普通不再结算；困难改选任意敌人。
  assert.equal(behavior.applyTokenEffect(state, inv, { token: 'tablet', mode: 'doomOnEnemyNoDoom' }, api), false)
  assert.equal(behavior.applyTokenEffect(state, inv, { token: 'tablet', mode: 'doomOnEnemy' }, api), true)
  assert.equal(state.enemies[0].doom, 2)
  // [elder_thing] 失败：选恐惧。
  api.choose = () => 'horror'
  assert.equal(behavior.applyTokenEffect(state, inv, { token: 'elderthing', mode: 'damageOrHorrorOnFail' }, api), true)
  assert.equal(inv.horror, 1)
  // 在无敌人地点放毁灭：不结算。
  inv.location = 'empty'
  assert.equal(behavior.applyTokenEffect(state, inv, { token: 'tablet', mode: 'doomOnEnemyNoDoom' }, api), false)
})

// ---------------------------------------------------------------------------
// 8. 敌人 / 剧情资产 / 符文
// ---------------------------------------------------------------------------
test('P7 theApiary 敌人：主母生命 8/人、偷渡者伤害转嫁；带鳞寄生虫被击败 → 符文 T + 胜利区', async () => {
  const { state, api } = await fresh(2, EAST)
  revealAll(state, api)
  const mother = spawnEnemy(state, MOTHER_CODE, CENTRAL_CHAMBER_ID, api)
  assert.equal(mother.health, 16)
  const tender = spawnEnemy(state, APIARY_TENDER_CODE, CENTRAL_CHAMBER_ID, api)
  tender.damageTaken = 4
  tender.doom = 1
  assert.equal(behavior.enemyDefeated(state, tender, api), true)
  assert.equal(mother.damageTaken, 4, '伤害移到主母')
  assert.equal(state.encounterDeck.includes(APIARY_TENDER_CODE), true, '有毁灭 → 洗回遭遇牌库')
  const parasite = spawnEnemy(state, SQUAMOUS_PARASITE_CODE, 'churningChasm', api)
  parasite.damageTaken = parasite.health
  assert.equal(behavior.flipSquamousParasite(state, parasite, 'defeat', api), true)
  assert.deepEqual(state.campaign.records.discoveredGlyphs, ['T'])
  assert.equal(state.victoryDisplay.some(entry => entry.code === SQUAMOUS_PARASITE_STORY_CODE), true)
  assert.equal(state.enemies.includes(parasite), false)
  assert.equal(glyphsKnown(state, 't'), true)
})

test('P7 theApiary 剧情资产与符文：古代遗物 → S，隐藏秘库 → U，符文去重', async () => {
  const { state, api } = await fresh(2, WEST)
  const inv = state.investigators[0]
  const relic = behavior.events.apiaryTakeAsset(state, { seat: 0, code: ANCIENT_RELIC_CODE }, api)
  assert.ok(relic)
  assert.equal(flipAncientRelic(state, inv, relic, api), true)
  assert.deepEqual(state.campaign.records.discoveredGlyphs, ['S'])
  assert.equal(state.victoryDisplay.some(entry => entry.code === '11581b'), true)
  placeLocationAt(state, 'hiddenVault', api, { revealed: true })
  assert.equal(flipHiddenVault(state, locationOf(state, 'hiddenVault'), api), true)
  assert.deepEqual(state.campaign.records.discoveredGlyphs, ['S', 'U'])
  assert.equal(translateGlyph(state, 'rune_s', '机器', api), true)
  assert.deepEqual(state.campaign.records.discoveredGlyphs, ['S', 'U'], '同一符文不重复记录')
  assert.equal(glyphsKnown(state, 'SU'), true)
})

test('P7 theApiary 骇人「面具」：仍被控制时结局记录 grislyMask', async () => {
  const { state, api } = await fresh(2, WEST)
  assert.equal(controlledGrislyMask(state), false)
  behavior.events.apiaryTakeAsset(state, { seat: 0, code: GRISLY_MASK_CODE }, api)
  assert.equal(controlledGrislyMask(state), true)
  const result = behavior.resolution(state, 'resolution1', null, api)
  assert.equal(state.campaign.records.grislyMask, true)
  assert.equal(result.nextScenarioId, 'theGrandVault')
  assert.deepEqual(state.campaign.records.rlyehMap, ['RlyehApiary'])
})

// ---------------------------------------------------------------------------
// 9. 结局与跳章
// ---------------------------------------------------------------------------
test('P7 theApiary 结局 1/2/3/4 与无结局：记录、寄生变形、奖励经验与跳章', async () => {
  // 结局 1：朝圣者获救 +2 奖励经验，下一章大秘库。
  const r1 = await fresh(2, WEST, {}, false)
  assert.equal(resolution(r1.state, 'resolution1', null, r1.api).nextScenarioId, 'theGrandVault')
  assert.equal(r1.state.campaign.records.thePilgrimsWereSaved, true)
  assert.deepEqual(r1.state.investigators.map(inv => inv.scenarioXpBonus), [2, 2])
  // 结局 2：朝圣者被吞噬 + 寄生变形（api.campaignCard）。
  const r2 = await fresh(2, EAST, {}, false)
  assert.equal(resolution(r2.state, 'resolution2', null, r2.api).nextScenarioId, 'theGrandVault')
  assert.equal(r2.state.campaign.records.thePilgrimsWereDevoured, true)
  assert.equal(r2.state.campaign.cards.filter(card => card.code === PARASITIC_TRANSFORMATION_CODE).length, 2)
  // 结局 3：灭绝异星寄生虫 → 强制结局 4，二选一。
  const r3 = await fresh(2, EAST, {}, false)
  const third = resolution(r3.state, 'resolution3', null, r3.api)
  assert.equal(r3.state.campaign.records.drownedQuartersResolvedTo, undefined)
  assert.equal(r3.state.campaign.records.theInvestigatorsExterminatedTheAlienParasites, true)
  assert.equal(r3.state.campaign.records.apiaryResolvedTo, 'resolution4')
  assert.equal(third.nextScenarioId, 'theWesternWall', '默认二选一（api.choose = westernWall）')
  // 结局 4：选择去淹没城区。
  const r4 = await fresh(1, EAST, { choose: () => 'drownedQuarter' }, false)
  assert.equal(resolution(r4.state, 'resolution4', null, r4.api).nextScenarioId, 'theDrownedQuarter')
  // 无结局：西向去大秘库；东向进入结局 4。
  const westNone = await fresh(1, WEST, {}, false)
  assert.equal(resolution(westNone.state, 'noResolution', null, westNone.api).nextScenarioId, 'theGrandVault')
  assert.equal(westNone.state.campaign.records.apiaryNoResolution, true)
  assert.equal(westNone.state.campaign.cards.length, 1, '无结局也获得寄生变形')
  const eastNone = await fresh(1, EAST, {}, false)
  assert.equal(resolution(eastNone.state, 'noResolution', null, eastNone.api).nextScenarioId, 'theWesternWall')
  assert.equal(eastNone.state.campaign.records.apiaryResolvedTo, 'resolution4')
  // 结局链：3 → 4，其余不自链。
  assert.deepEqual(resolutionChainForKey('resolution3', eastNone.state), ['resolution3', 'resolution4'])
  assert.deepEqual(resolutionChainForKey('resolution4', eastNone.state), ['resolution4'])
  assert.deepEqual(resolutionChainForKey('noResolution', eastNone.state), ['noResolution', 'resolution4'])
  assert.deepEqual(resolutionChainForKey('noResolution', westNone.state), ['noResolution'])
  assert.equal(resolution4Choice(eastNone.state, { choose: () => 'drownedQuarter' }), 'theDrownedQuarter')
  // manifest 出口与定义一致。
  assert.deepEqual({ ...chapter.manifest.resolutionExits.resolution4 }, { ...RESOLUTION4_NEXT })
})

// ---------------------------------------------------------------------------
// 10. 遭遇牌库工具 / 存档往返
// ---------------------------------------------------------------------------
test('P7 theApiary 牌库底 10 张：shuffleIntoBottom 把卡放进数组前端（引擎栈底）', async () => {
  const { state, api } = await fresh(2, WEST)
  const deckLength = state.encounterDeck.length
  const candidates = state.scenarioZones.setAside
    .filter(code => !state.encounterDeck.includes(code))
    .slice(0, 2)
  assert.equal(candidates.length, 2)
  shuffleIntoBottom(state, candidates, api, 10)
  assert.equal(state.encounterDeck.length, deckLength + 2)
  const bottomTen = state.encounterDeck.slice(0, 10)
  for (const code of candidates) assert.equal(bottomTen.includes(code), true, code)
  assert.equal(state.encounterDeck.slice(10).length, deckLength + 2 - 10, '底 10 之外仍保留原牌库')
})

test('P7 theApiary JSON 存档往返：方向/幕/放一边/面朝读回后行为继续可用', async () => {
  const { state, api } = await fresh(2, EAST)
  revealAll(state, api)
  applyCentralFacing(state, api)
  // 幕间（东向）后存档。
  behavior.actReveal(state, state.acts[0], api)
  const saved = jsonClone(state)
  const restored = makeApi(saved)
  assert.equal(expeditionDirection(saved), 'east')
  assert.deepEqual(saved.acts.map(act => act.originalCode), [ACT1_CODE, ACT2_EAST_CODE])
  assert.equal(centralFacing(saved), 'acidicCoelom')
  assert.equal(JSON.stringify(saved).includes('function'), false)
  // 读回后仍能旋转与判定目标。
  assert.equal(rotateCentralChamber(saved, 'clockwise', restored), 'graspingCorridor')
  saved.actIndex = 1
  saved.acts[1].originalCode = ACT2_EAST_CODE
  const mother = saved.enemies.find(enemy => enemy.code === MOTHER_CODE)
  assert.ok(mother, '主母从存档读回')
  behavior.enemyDefeated(saved, mother, restored)
  assert.equal(behavior.checkObjectives(saved, restored), true)
  assert.equal(restored.finished, 'resolution3')
})
