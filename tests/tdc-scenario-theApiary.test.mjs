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
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { persistEnabled, readSnapshot, saveSnapshot, snapshotPath } from '../../../lib/sessions.js'
import { scenarioRuntime } from '../src/engine/engine.js'
import {
  damageEnemy as engineDamageEnemy, engageEnemy as engineEngageEnemy,
  placeDoomOnCard as enginePlaceDoomOnCard,
} from '../src/engine/engine.js'
import {
  fixture as engineFixture, asset as engineAsset, enemy as engineEnemy, move as engineMove,
  settle as engineSettle, legalMoves as engineLegalMoves,
} from './core-fixture.mjs'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { campsiteDeck } from '../content/campaigns/theDrownedCity/scenarios/theApiary/campsite.js'
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
  ANCIENT_RELIC_CODE, ANCIENT_RELIC_STORY_CODE, GRISLY_MASK_CODE, HIDDEN_VAULT_STORY_CODE,
  PARASITIC_TRANSFORMATION_CODE,
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
  // 引擎运行时（scenarioRuntime）会写日志/事件/离场区；真实存档与 replay 依赖这些纯 JSON 字段。
  log: [], events: [], setAsideEnemies: [], removedFromGame: [],
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
  assert.equal(chapter.manifest.status, 'playable')
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
  // 诡计 11577 用 encounterResolve 自发起意志检定并结算失败分支（弃到偷渡者并抽取），
  // 11578 用 encounterResolve 召唤敌人。
  const curiosity = registeredEntry('11577')
  assert.equal(typeof curiosity.encounterResolve, 'function')
  assert.equal(typeof registeredEntry('11578').encounterResolve, 'function')
  // 11583 弱点：威胁区弃置费用 + 章节 enemyEngaged 钩子；11568 受控剧情资产转嫁。
  assert.deepEqual(registeredEntry('11583').threatEffect.discardCost, { action: 2 })
  assert.deepEqual(registeredEntry('11568').storyAssetRule.redirectEnemyDamage, { traits: ['Cultist'] })
  // 未接线的条目如实标 implemented:false（本条全部落地后不再有 false 条目）。
  for (const code of ['11568', '11573', '11574', '11575', '11576', '11577', '11580', '11581', '11582', '11583']) {
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
  // 将两名原本放到一边的朝圣者移入遭遇牌库，验证跨区域收集。
  state.scenarioZones.setAside.splice(state.scenarioZones.setAside.indexOf('11723'), 1)
  state.scenarioZones.setAside.splice(state.scenarioZones.setAside.indexOf('11724'), 1)
  state.encounterDeck = ['11723', '11724', '11739']
  state.investigators[0].location = 'lostCampsite'
  const beforeClues = locationOf(state, 'acidicCoelom').clues
  assert.equal(behavior.actReveal(state, state.acts[0], api), true)
  assert.equal(state.scenarioFlags.apiaryInterlude, 'lostPilgrims')
  const entrance = locationOf(state, START_LOCATION)
  assert.equal(entrance.code, '11559b', '养育场入口翻到危险出口面')
  assert.equal(entrance.face, 'dangerousExit')
  assert.deepEqual([...campsiteDeck(state)].sort(), ['11723', '11723', '11723', '11724'], '朝圣者敌人叠到迷失营地下')
  assert.deepEqual(cultistCardsUnderAct(state), [], '营地下方卡牌不计为幕下积分')
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

// ---------------------------------------------------------------------------
// 11. 敌军阶段结束（引擎既有读点 scenarioBehavior.enemyPhaseEnd）
// ---------------------------------------------------------------------------
test('P7 theApiary 敌军阶段结束：幕 2 西向每名异教徒按同地点偷渡者数量受伤', async () => {
  const { state } = await fresh(2, WEST)
  state.actIndex = 1
  assert.deepEqual(state.acts.map(act => act.originalCode), [ACT1_CODE, ACT2_WEST_CODE])
  assert.equal(state.acts[1].enemyPhaseEndCultistDamage, 'perStowawayAtLocation')
  const cultist = {
    id: 'cultist-1', code: '11723', originalCode: '11723', name: '朝圣者侍僧',
    traits: ['Cultist'], location: 'lostCampsite', damageTaken: 0, doom: 0,
  }
  const cultistElsewhere = {
    id: 'cultist-2', code: '11723', originalCode: '11723', name: '朝圣者侍僧',
    traits: ['Cultist'], location: 'acidicCoelom', damageTaken: 0, doom: 0,
  }
  const stowawayA = { id: 'stow-1', code: '11721', originalCode: '11721', name: '偷渡者工蜂', traits: ['Stowaway'], location: 'lostCampsite' }
  const stowawayB = { id: 'stow-2', code: '11721', originalCode: '11721', name: '偷渡者工蜂', traits: ['Stowaway'], location: 'lostCampsite' }
  state.enemies = [cultist, cultistElsewhere, stowawayA, stowawayB]
  const api = makeApi(state)
  const damageCalls = []
  api.damageEnemy = (enemyId, amount, seat, source) => {
    damageCalls.push([enemyId, amount, seat, source?.code ?? null])
    const enemy = state.enemies.find(item => item.id === enemyId)
    if (!enemy) return false
    enemy.damageTaken = (enemy.damageTaken || 0) + amount
    return true
  }
  assert.equal(behavior.enemyPhaseEnd(state, api), true)
  assert.deepEqual(damageCalls, [['cultist-1', 2, 0, ACT2_WEST_CODE]])
  assert.equal(cultist.damageTaken, 2, '同名地点 2 名偷渡者 → 2 点伤害')
  assert.equal(cultistElsewhere.damageTaken, 0, '没有同地点偷渡者的异教徒不受伤')
  // 非幕 2 西向（幕 1）：不触发。
  state.actIndex = 0
  damageCalls.length = 0
  assert.equal(behavior.enemyPhaseEnd(state, api), false)
  assert.deepEqual(damageCalls, [])
  // 幕 2 西向但无同地点偷渡者：不触发。
  state.actIndex = 1
  state.enemies = [cultistElsewhere]
  assert.equal(behavior.enemyPhaseEnd(state, api), false)
})

// ---------------------------------------------------------------------------
// 12. 真实持久化（lib/sessions.js 的 saveSnapshot / readSnapshot）
// ---------------------------------------------------------------------------
test('P7 theApiary 真实 saveSnapshot/readSnapshot 存档重放：读回状态等价且后续动作确定', async (t) => {
  const home = mkdtempSync(join(tmpdir(), 'tdc-apiary-save-'))
  const savedEnv = { DSH_HOME: process.env.DSH_HOME, BOARDGAME_PERSIST: process.env.BOARDGAME_PERSIST }
  process.env.DSH_HOME = home
  delete process.env.BOARDGAME_PERSIST
  t.after(() => {
    if (savedEnv.DSH_HOME === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = savedEnv.DSH_HOME
    if (savedEnv.BOARDGAME_PERSIST === undefined) delete process.env.BOARDGAME_PERSIST
    else process.env.BOARDGAME_PERSIST = savedEnv.BOARDGAME_PERSIST
    rmSync(home, { recursive: true, force: true })
  })
  assert.equal(persistEnabled(), true, '未显式关闭时持久化默认开启')
  const { state, api } = await fresh(2, EAST)
  revealAll(state, api)
  applyCentralFacing(state, api)
  behavior.actReveal(state, state.acts[0], api) // 东向幕间：中央腔室 + 主母入场
  translateGlyph(state, 'rune_t', '空气', api)
  const inMemory = jsonClone(state)
  const sessionId = 'tdc-apiary-replay'
  const file = saveSnapshot({
    sessionId, modId: 'arkhamhorror', state: inMemory,
    players: [{ seat: 0, investigatorId: '01001' }], events: [], settings: { difficulty: 'standard' },
  })
  assert.equal(file, snapshotPath(sessionId, 'arkhamhorror'))
  assert.equal(existsSync(file), true, '快照必须真实落盘')
  const restored = readSnapshot(sessionId)
  assert.ok(restored, existsSync(file) ? `快照存在但解析失败：${file}` : `快照缺失：${file}`)
  assert.equal(restored.session.sessionId, sessionId)
  assert.equal(restored.session.modId, 'arkhamhorror')
  assert.deepEqual(jsonClone(restored.session.state), inMemory, '读回状态与内存状态深度相等')
  // 从读回状态与内存状态执行同一串真实章节动作，结果指纹必须一致。
  const advance = (draft) => {
    const draftApi = makeApi(draft)
    const facing = rotateCentralChamber(draft, 'clockwise', draftApi)
    draft.actIndex = 1
    const mother = draft.enemies.find(enemy => enemy.code === MOTHER_CODE)
    assert.ok(mother, '东向幕间存档里必须有主母')
    behavior.enemyDefeated(draft, mother, draftApi)
    const objective = behavior.checkObjectives(draft, draftApi)
    return {
      facing,
      currentFacing: centralFacing(draft),
      motherDefeated: draft.scenarioFlags.apiaryMotherDefeated === true,
      objective,
      finished: draftApi.finished || null,
      glyphs: [...(draft.campaign.records.discoveredGlyphs || [])],
      locations: draft.locations.map(location => location.id).sort(),
    }
  }
  const fromRestored = advance(restored.session.state)
  const fromMemory = advance(jsonClone(inMemory))
  assert.deepEqual(fromRestored, fromMemory, '恢复后继续行动的结果与内存状态一致')
  assert.equal(fromRestored.currentFacing, 'graspingCorridor')
  assert.equal(fromRestored.motherDefeated, true)
  assert.equal(fromRestored.finished, 'resolution3')
  assert.deepEqual(fromRestored.glyphs, ['T'])
})

test('P7 theApiary 幕 1 目标与行动：全队圣所轮末支付 2/人线索推进；弃线索换遭遇牌库顶地点显现', async () => {
  const { state, api } = await fresh(2, WEST)
  revealAll(state, api)
  for (const inv of state.investigators) inv.location = 'lostCampsite'
  // 目标需要共同花费 2[per_investigator]（2 人 = 4）：线索不足时不推进。
  state.investigators[0].clues = 1
  state.investigators[1].clues = 0
  state._roundEndWindow = true
  assert.equal(behavior.checkObjectives(state, api), false, '线索不足 4 个时不推进')
  assert.equal(api.advanced, undefined)
  // 补足线索后轮末支付并推进。
  state.investigators[0].clues = 3
  state.investigators[1].clues = 2
  assert.equal(behavior.checkObjectives(state, api), true, '全队在一处[[圣所]]且支付 4 线索，轮末推进幕 1')
  assert.equal(api.advanced, 1)
  assert.equal(state.investigators[0].clues + state.investigators[1].clues, 1, '只扣除所需 4 个线索')
  // 幕 1 正面行动：共同花费线索，每 1 个线索从遭遇牌库顶弃 5 张（单人 10 张），并抽取弃掉的地点。
  const second = await fresh(1, WEST)
  const inv = second.state.investigators[0]
  const locationCode = LOCATIONS.churningChasm.code
  const deck = ['11739', '11740', '11751', locationCode, '11752', '11736', '11737', '11738', '11729', '11730']
  second.state.encounterDeck = [...deck]
  inv.location = START_LOCATION
  inv.clues = 1
  const move = behavior.actions(second.state, inv).find(item => item.rule === 'apiaryDiscardForLocations')
  assert.ok(move, '幕 1 给弃牌换地点行动')
  assert.equal(behavior.performAction(second.state, inv, move, second.api), true)
  assert.equal(second.state.investigators[0].clues, 0, '共同花费 1 个线索')
  assert.equal(locationOf(second.state, 'churningChasm') !== null, true, '弃掉的地点被抽取并放入场地')
  assert.equal(second.state.encounterDeck.length, 0, '单人一次弃 10 张')
})

test('P7 theApiary 失落的朝圣者谈判：成功超出 n 点让 n 名不同异教徒各移动一次', async () => {
  const { state } = await fresh(2, WEST)
  const api = makeApi(state)
  revealAll(state, api)
  state.actIndex = 1
  assert.equal(state.acts[1].originalCode, ACT2_WEST_CODE)
  const inv = state.investigators[0]
  inv.location = 'lostCampsite'
  const cultistA = { id: 'cultA', code: '11723', originalCode: '11723', name: '朝圣者侍僧 A', traits: ['Cultist'], location: 'lostCampsite', defeated: false }
  const cultistB = { id: 'cultB', code: '11723', originalCode: '11723', name: '朝圣者侍僧 B', traits: ['Cultist'], location: 'lostCampsite', defeated: false }
  state.enemies = [cultistA, cultistB]
  api.test = (seat, skill, difficulty, resolve) => {
    const result = { success: true, failedBy: 0, successBy: 2, value: difficulty + 2 }
    resolve?.(result)
    return result
  }
  const move = behavior.actions(state, inv).find(item => item.rule === 'apiaryParleyCultist')
  assert.ok(move, '幕 2 西向给谈判行动')
  assert.equal(behavior.performAction(state, inv, move, api), true)
  assert.notEqual(cultistA.location, 'lostCampsite', '成功超出 2 点 → 第一名异教徒移动')
  assert.notEqual(cultistB.location, 'lostCampsite', '成功超出 2 点 → 第二名不同异教徒移动')
  // 只成功（超出 0 点）：不移动（默认测试桩 failedBy 0 且无 successBy 时按 difficulty 计）。
  const failed = await fresh(2, WEST)
  revealAll(failed.state, failed.api)
  failed.state.actIndex = 1
  failed.state.investigators[0].location = 'lostCampsite'
  const only = { id: 'cultC', code: '11723', originalCode: '11723', name: '朝圣者侍僧 C', traits: ['Cultist'], location: 'lostCampsite', defeated: false }
  failed.state.enemies = [only]
  failed.api.test = (seat, skill, difficulty, resolve) => {
    const result = { success: true, failedBy: 0, successBy: 0, value: difficulty }
    resolve?.(result)
    return result
  }
  const noExcess = behavior.actions(failed.state, failed.state.investigators[0])
    .find(item => item.rule === 'apiaryParleyCultist')
  assert.equal(behavior.performAction(failed.state, failed.state.investigators[0], noExcess, failed.api), true)
  assert.equal(only.location, 'lostCampsite', '成功但未超出难度不移动')
})

test('P7 theApiary 外星虫卵：最近的无毁灭非精英敌人被放置 1 个毁灭标记', async () => {
  const { state, api } = await fresh(2, WEST)
  revealAll(state, api)
  state.investigators[0].location = 'lostCampsite'
  const near = { id: 'near', code: '11723', originalCode: '11723', name: '朝圣者侍僧', traits: ['Cultist'], location: 'lostCampsite', doom: 0 }
  const far = { id: 'far', code: '11751', originalCode: '11751', name: '持久构造体', traits: ['Monster'], location: 'churningChasm', doom: 0 }
  const doomed = { id: 'doomed', code: '11724', originalCode: '11724', name: '朝圣者领袖', traits: ['Cultist'], location: 'lostCampsite', doom: 1 }
  const elite = { id: 'elite', code: MOTHER_CODE, originalCode: MOTHER_CODE, name: '主母', traits: ['Abomination', 'Elite'], location: 'lostCampsite', doom: 0 }
  state.enemies = [near, far, doomed, elite]
  assert.equal(behavior.events.apiaryDoomNearestEnemy(state, { seat: 0 }, api), true)
  assert.equal(near.doom, 1, '最近的、无毁灭、非精英敌人被放 1 个毁灭标记')
  assert.equal(far.doom, 0)
  assert.equal(doomed.doom, 1)
  assert.equal(elite.doom, 0, '[[精英]]敌人不被选择')
  // 场上没有合法候选时不再结算。
  state.enemies = [elite]
  assert.equal(behavior.events.apiaryDoomNearestEnemy(state, { seat: 0 }, api), false)
})

// ---------------------------------------------------------------------------
// 13. 引擎「敌人非击败离场」钩子（PRIMITIVES 2026-11-20 已落地）
// ---------------------------------------------------------------------------
test('P7 theApiary enemyLeftPlay：带鳞寄生虫非击败离场（弃牌 / 移出游戏）放一边场外', async () => {
  const { state, api } = await fresh(2, WEST)
  const runtime = scenarioRuntime(state, [])
  // 清掉 Setup 的放一边记录，便于断言钩子本身写入。
  state.scenarioZones.setAside = state.scenarioZones.setAside
    .filter(code => code !== SQUAMOUS_PARASITE_CODE)
  // 路径 1：引擎 discardEnemyCard（discardEnemy）→ behavior.enemyLeftPlay(reason='discarded')。
  const first = spawnEnemy(state, SQUAMOUS_PARASITE_CODE, 'churningChasm', api)
  runtime.discardEnemy(first)
  assert.equal(state.enemies.includes(first), false)
  assert.equal(state.encounterDiscard.includes(SQUAMOUS_PARASITE_CODE), false,
    '撤销默认弃牌去向（放一边场外）')
  assert.equal(state.scenarioZones.setAside.filter(code => code === SQUAMOUS_PARASITE_CODE).length, 1,
    '放一边记录只写一次')
  assert.equal(state.victoryDisplay.some(entry => entry.code === SQUAMOUS_PARASITE_STORY_CODE), false,
    '非击败离场不翻故事面（符文 T 只由被击败触发）')
  assert.equal(state.campaign.records.discoveredGlyphs, undefined)
  assert.notEqual(state.scenarioFlags[`apiaryEnemyLeftPlay:${first.id}`], undefined)
  // 路径 2：引擎 removeEnemyFromGame → behavior.enemyLeftPlay(reason='removed')。
  const second = spawnEnemy(state, SQUAMOUS_PARASITE_CODE, 'churningChasm', api)
  runtime.removeEnemyFromGame(second)
  assert.equal(state.enemies.includes(second), false)
  assert.equal(state.removedFromGame.includes(SQUAMOUS_PARASITE_CODE), false,
    '撤销默认移出游戏去向')
  assert.equal(state.scenarioZones.setAside.filter(code => code === SQUAMOUS_PARASITE_CODE).length, 1,
    '放一边不重复记录')
  // 幂等：同一实体再次触发不再结算。
  assert.equal(behavior.enemyLeftPlay(state, second, 'removed', runtime), false)
  // 非目标敌人离场不走本钩子。
  const tender = spawnEnemy(state, APIARY_TENDER_CODE, 'churningChasm', api)
  runtime.discardEnemy(tender)
  assert.equal(state.scenarioZones.setAside.includes(APIARY_TENDER_CODE), false)
})

// ---------------------------------------------------------------------------
// 13. 地点条件移动额外费用（P7 第二轮原语）：11571 酸性体腔
// ---------------------------------------------------------------------------
test('P7 theApiary 11571 酸性体腔：移动到养育场入口额外受 1 点伤害（其他出发地不收费）', () => {
  const locations = () => ([
    { id: 'acidicCoelom', code: '11571', originalCode: '11571', name: '酸性体腔', revealed: true,
      shroud: 4, clues: 0, traits: ['Apiary', 'Nest', 'Sanctum'], connections: ['apiaryEntrance'] },
    { id: 'apiaryEntrance', code: '11559', originalCode: '11559', name: '养育场入口', revealed: true,
      shroud: 1, clues: 0, traits: ['Apiary', 'Central'], connections: ['acidicCoelom'] },
  ])
  const state = engineFixture('01001')
  state.locations = locations()
  state.investigators[0].location = 'acidicCoelom'
  state.investigators[0].damage = 0
  engineMove(state, { action: 'move', locationId: 'apiaryEntrance' })
  assert.equal(state.investigators[0].location, 'apiaryEntrance')
  assert.equal(state.investigators[0].damage, 1, '从酸性体腔移动到养育场入口强制受到 1 点伤害')
  // 反向移动（养育场入口不是收费出发地）不受额外伤害。
  const back = engineFixture('01001')
  back.locations = locations()
  back.investigators[0].location = 'apiaryEntrance'
  back.investigators[0].damage = 0
  engineMove(back, { action: 'move', locationId: 'acidicCoelom' })
  assert.equal(back.investigators[0].location, 'acidicCoelom')
  assert.equal(back.investigators[0].damage, 0, '其他出发地不收费')
})

// ---------------------------------------------------------------------------
// 14. 地点附属离开检定（P7 第二轮原语）：11576 饥饿的墙壁
// ---------------------------------------------------------------------------
const hungryWallsLocations = () => ([
  { id: 'host', code: '11567', originalCode: '11567', name: '迷失营地', revealed: true, shroud: 2, clues: 0,
    traits: ['Apiary', 'Sanctum'], connections: ['dest'],
    attachments: [{ id: 'hungry-walls', code: '11576', originalCode: '11576' }] },
  { id: 'dest', code: '11559', originalCode: '11559', name: '养育场入口', revealed: true, shroud: 1, clues: 0,
    traits: ['Apiary', 'Central'], connections: ['host'] },
])
const hungryWallsState = (chaosToken) => {
  const state = engineFixture('01001')
  state.locations = hungryWallsLocations()
  state.investigators[0].location = 'host'
  state.investigators[0].damage = 0
  state.investigators[0].horror = 0
  state.chaosBag = [chaosToken]
  return state
}
const leaveWithSkill = (state, skill) => engineSettle(state, choice => (choice.kind === 'leave' ? skill : null))

test('P7 theApiary 11576 饥饿的墙壁：离开宿主地点检定；失败按技能结算并弃置诡计，成功无惩罚', () => {
  // 敏捷失败（敏捷 2 < 4）：弃 1 张控制支援 + 受 1 点伤害；移动不取消；诡计弃置。
  const agility = hungryWallsState('0')
  engineAsset(agility, '01006')
  engineMove(agility, { action: 'move', locationId: 'dest' })
  leaveWithSkill(agility, 'agility')
  assert.equal(agility.investigators[0].location, 'dest', 'cancelOnFail:false → 移动不取消')
  assert.equal(agility.investigators[0].damage, 1, '敏捷分支：受到 1 点伤害')
  assert.equal(agility.investigators[0].assets.some(asset => asset.code === '01006'), false, '敏捷分支：弃 1 张支援')
  assert.equal(agility.locations.find(loc => loc.id === 'host').attachments.length, 0, '结算后弃置附属')
  assert.ok(agility.encounterDiscard.includes('11576'), '诡计进入遭遇弃牌堆')
  // 战力失败：受到 2 点直接伤害（敏捷分支的弃支援不适用）。
  const combat = hungryWallsState('-20')
  engineAsset(combat, '01006')
  engineMove(combat, { action: 'move', locationId: 'dest' })
  leaveWithSkill(combat, 'combat')
  assert.equal(combat.investigators[0].location, 'dest')
  assert.equal(combat.investigators[0].damage, 2, '战力分支：受到 2 点直接伤害')
  assert.equal(combat.investigators[0].assets.some(asset => asset.code === '01006'), true, '战力分支不弃支援')
  // 成功：移动照常、无惩罚，但诡计仍按 discardOnResolve 弃置。
  const success = hungryWallsState('+20')
  engineMove(success, { action: 'move', locationId: 'dest' })
  leaveWithSkill(success, 'agility')
  assert.equal(success.investigators[0].location, 'dest')
  assert.equal(success.investigators[0].damage, 0, '成功不惩罚')
  assert.equal(success.locations.find(loc => loc.id === 'host').attachments.length, 0)
  assert.ok(success.encounterDiscard.includes('11576'))
})

// ---------------------------------------------------------------------------
// 15. 受控剧情资产（P7 第二轮原语）：11582 骇人“面具” / 11581 古代遗物
// ---------------------------------------------------------------------------
test('P7 theApiary 11582 骇人“面具”：[fast] 解除交战 / 受 1 点直接恐惧并造成 2 点伤害（真实 legalMoves + 结算）', () => {
  const state = engineFixture('01001')
  engineAsset(state, '11582')
  engineEnemy(state, { engagedSeat: 0, location: state.investigators[0].location })
  let mask = state.investigators[0].assets.find(asset => asset.code === '11582')
  let moves = engineLegalMoves(state, 0).filter(move => move.action === 'ability' && move.assetId === mask.id)
  assert.equal(moves.some(move => move.abilityIndex === 0), true, '第一条 [fast] 出现在合法动作里')
  engineMove(state, { action: 'ability', assetId: mask.id, abilityIndex: 0 })
  mask = state.investigators[0].assets.find(asset => asset.code === '11582')
  assert.deepEqual(state.investigators[0].engaged, [], '解除与所有交战敌人的交战')
  assert.equal(mask.exhausted, true, '横置自己')
  // 第二条 [fast]：受 1 点直接恐惧 + 横置 → 对所在地点一名敌人造成 2 点伤害。
  // 需要符文 j/m/s/c/b 集齐（P7 第六轮：字形门槛 criteria）；且第一条的「不能造成敌人伤害」
  // 限制仍在持续，所以用独立对局验证第二条。
  const fatigueState = engineFixture('01001')
  engineAsset(fatigueState, '11582')
  fatigueState.campaign.records.discoveredGlyphs = ['J', 'M', 'S', 'C', 'B']
  const fatigueMask = fatigueState.investigators[0].assets.find(asset => asset.code === '11582')
  const target = engineEnemy(fatigueState, { engagedSeat: null, location: fatigueState.investigators[0].location })
  const fatigueMoves = engineLegalMoves(fatigueState, 0)
    .filter(move => move.action === 'ability' && move.assetId === fatigueMask.id)
  const second = fatigueMoves.find(move => move.abilityIndex === 1)
  assert.ok(second, '第二条 [fast] 带目标枚举出现在合法动作里')
  engineMove(fatigueState, { action: 'ability', assetId: fatigueMask.id, abilityIndex: 1, targetId: target.id })
  assert.equal(fatigueState.enemies.find(enemy => enemy.id === target.id).damageTaken, 2, '对敌人造成 2 点伤害')
  assert.equal(fatigueState.investigators[0].horror, 1, '受到 1 点直接恐惧（费用）')
  assert.equal(fatigueState.investigators[0].assets.find(asset => asset.code === '11582').exhausted, true)
})

test('P7 theApiary 11581 古代遗物：controlledAsset 身份；离场由章节钩子放一边场外', () => {
  for (const code of ['11550', '11581', '11582']) {
    assert.equal(registeredEntry(code).controlledAsset, true, `${code} 声明 controlledAsset`)
  }
  assert.equal(registeredEntry('11581').abilities.every(ability => ['reaction', 'forced'].includes(ability.kind)), true,
    '11581 只有强制/反应能力，没有 action/free')
  const state = engineFixture('01001')
  state.scenario = { ...state.scenario, id: 'theApiary' }
  engineAsset(state, '11581')
  const relic = state.investigators[0].assets.find(asset => asset.code === '11581')
  const runtime = scenarioRuntime(state, [])
  // 真实引擎离场入口：discardAsset → leaveAsset → 章节 behavior.assetLeftPlay。
  assert.equal(runtime.discardAsset(0, relic.id), '11581')
  assert.equal(state.investigators[0].assets.some(asset => asset.code === '11581'), false)
  assert.equal(state.investigators[0].discard.includes('11581'), false, '不按默认弃牌去向')
  assert.ok(state.scenarioZones.setAside.includes('11581'), '放一边，位于场外')
})

// ---------------------------------------------------------------------------
// 16. 战役级「维护阶段不能获得资源」（Good Money 失败的跨章标记）
// ---------------------------------------------------------------------------
test('P7 theApiary 战役级维护禁资源：标记命中 → 补给阶段不获得资源；不命中 → 正常', () => {
  const flagged = engineFixture('01001')
  flagged.scenario = { ...flagged.scenario, id: 'theApiary' }
  flagged.campaign.ruleFlags = { tdcNoUpkeepResources: { appliesToScenarioIndex: flagged.campaign.scenarioIndex } }
  flagged.investigators[0].resources = 5
  engineMove(flagged, { action: 'endTurn' })
  engineSettle(flagged)
  assert.equal(flagged.investigators[0].resources, 5, '标记命中：补给阶段不获得资源')

  const normal = engineFixture('01001')
  normal.scenario = { ...normal.scenario, id: 'theApiary' }
  normal.investigators[0].resources = 5
  engineMove(normal, { action: 'endTurn' })
  engineSettle(normal)
  assert.equal(normal.investigators[0].resources, 6, '不命中：正常获得 1 资源')
})

// ---------------------------------------------------------------------------
// 17. 11574 奇丑混种 / 11575 养育场看守（P7 第四轮：引擎既有窗口）
// ---------------------------------------------------------------------------
const amalgamFixture = () => {
  const state = engineFixture('01001')
  state.scenario = { ...state.scenario, id: 'theApiary' }
  const inv = state.investigators[0]
  const enemy = {
    id: 'grotesque-amalgam', code: '11574', originalCode: '11574', name: '奇丑混种',
    location: inv.location, type: 'enemy', traits: ['Monster', 'Stowaway'], fight: 4, evade: 2,
    health: 5, damageTaken: 0, doom: 0, exhausted: false, engagedSeat: 0, attachments: [],
  }
  state.enemies.push(enemy)
  inv.engaged.push(enemy.id)
  return { state, inv, enemy }
}

test('P7 theApiary 11574 奇丑混种：用[[武器]]支援攻击它后，在该支援上放 1 个毁灭标记（真实 damageEnemy 窗口）', () => {
  const { state, inv, enemy } = amalgamFixture()
  const weapon = engineAsset(state, '01006')
  assert.equal(engineDamageEnemy(state, enemy, 2, 0, [], weapon.id), true)
  assert.equal(weapon.doom, 1, '武器支援上放置 1 个毁灭标记')
  // 非[[武器]]来源（盟友支援）攻击不触发。
  const ally = engineAsset(state, '01008')
  engineDamageEnemy(state, enemy, 2, 0, [], ally.id)
  assert.equal(ally.doom, undefined, '非武器来源不放置毁灭标记')
})

test('P7 theApiary 11575 养育场看守：本地点卡牌放置毁灭 → 重整 / 失去冷漠 / 交战立刻攻击（doomPlaced 钩子）', () => {
  const state = engineFixture('01001')
  state.scenario = { ...state.scenario, id: 'theApiary' }
  const inv = state.investigators[0]
  const location = state.locations.find(item => item.id === inv.location)
  const tender = {
    id: 'apiary-tender', code: '11575', originalCode: '11575', name: '养育场看守',
    location: inv.location, type: 'enemy', traits: ['Monster', 'Stowaway'], fight: 3, evade: 3,
    health: 3, damageTaken: 0, doom: 0, exhausted: true, engagedSeat: null, attachments: [],
  }
  state.enemies.push(tender)
  enginePlaceDoomOnCard(state, location, 1, [], {})
  assert.equal(tender.exhausted, false, '重整')
  assert.equal(tender.keywordOverrides?.aloof?.enabled, false, '本轮失去冷漠')
  assert.equal(tender.keywordOverrides?.aloof?.throughRound, state.round)
})

// ---------------------------------------------------------------------------
// 18. 11577 危险的好奇心（失败弃顶到偷渡者并抽取 / 地点洗回）
// ---------------------------------------------------------------------------
test('P7 theApiary 11577 危险的好奇心：失败受 1 伤害、弃到偷渡者敌人并抽取、弃掉的地点洗回遭遇牌库', () => {
  const state = engineFixture('01001')
  state.scenario = { ...state.scenario, id: 'theApiary' }
  const inv = state.investigators[0]
  state.encounterDeck = ['11574', '11567', '11559b'] // 顶部为末尾：先弃地点，再弃到偷渡者敌人
  state.encounterDiscard = []
  const spawned = []
  const shuffled = []
  const api = {
    info: () => {},
    // 失败桩：检定失败 → 走条目失败分支。
    test: (seat, skill, difficulty, options) => options.resolve({ success: false, failedBy: 2, value: difficulty - 2 }),
    damage: (seat, amount) => { state.investigators[seat].damage += amount },
    discardEncounterTop: count => {
      const out = []
      for (let index = 0; index < count; index += 1) {
        const code = state.encounterDeck.pop()
        if (code == null) break
        state.encounterDiscard.push(code)
        out.push(code)
      }
      return out
    },
    takeEncounterCard: (code, options = {}) => {
      for (const pile of options.pile ? [options.pile] : ['encounterDeck', 'encounterDiscard']) {
        const index = (state[pile] || []).lastIndexOf(code)
        if (index < 0) continue
        state[pile].splice(index, 1)
        return code
      }
      return null
    },
    spawnEngaged: (code, locationId, seat) => { spawned.push({ code, locationId, seat }); return { code } },
    shuffleIntoEncounterDeck: codes => { shuffled.push(...codes); state.encounterDeck.push(...codes); return codes.length },
  }
  assert.equal(registeredEntry('11577').encounterResolve(state, inv, { code: '11577' }, api), true)
  assert.equal(state.investigators[0].damage, 1, '失败受到 1 点伤害')
  assert.deepEqual(spawned, [{ code: '11574', locationId: inv.location, seat: inv.seat }], '弃到[[偷渡者]]敌人并将其抽取/生成')
  assert.deepEqual(shuffled, ['11559b', '11567'], '被弃掉的地点洗回遭遇牌库')
  assert.equal(state.encounterDeck.includes('11559b'), true)
  assert.equal(state.encounterDeck.includes('11567'), true)
})

// ---------------------------------------------------------------------------
// 19. 11583 寄生变形（威胁区弱点）
// ---------------------------------------------------------------------------
test('P7 theApiary 11583 寄生变形：敌人交战后在其上放 1 毁灭；[action][action] 弃掉本卡', () => {
  const state = engineFixture('01001')
  state.scenario = { ...state.scenario, id: 'theApiary' }
  const inv = state.investigators[0]
  const threat = { id: 'parasitic-transformation', code: '11583', originalCode: '11583', doom: 0, attachments: [] }
  inv.threat.push(threat)
  const enemy = engineEnemy(state, { engagedSeat: null, location: inv.location })
  engineEngageEnemy(state, enemy, 0, [])
  assert.equal(threat.doom, 1, '交战后在寄生变形上放置 1 个毁灭标记')
  // threatEffect.discardCost → 合法动作出现「弃掉威胁」。
  const discardMove = engineLegalMoves(state, 0).find(move => move.action === 'discardThreat' && move.threatId === threat.id)
  assert.ok(discardMove, '弃掉威胁行动出现在合法动作里')
  assert.match(discardMove.label, /花 2 行动/)
})

// ---------------------------------------------------------------------------
// 20. 11568 玛莉亚·里维拉（受控剧情资产转嫁）
// ---------------------------------------------------------------------------
test('P7 theApiary 11568 玛莉亚·里维拉：异教徒敌人伤害改道 / 毁灭转嫁为伤害（真实引擎读点）', () => {
  const state = engineFixture('01001')
  state.scenario = { ...state.scenario, id: 'theApiary' }
  const inv = state.investigators[0]
  const maria = engineAsset(state, '11568')
  const cultist = {
    id: 'pilgrim-acolyte', code: '11723', originalCode: '11723', name: '朝圣者侍僧',
    location: inv.location, type: 'enemy', traits: ['Cultist'], fight: 2, evade: 2, health: 5,
    damageTaken: 0, doom: 0, exhausted: false, engagedSeat: 0, attachments: [],
  }
  state.enemies.push(cultist)
  inv.engaged.push(cultist.id)
  // 伤害改道：异教徒敌人的伤害放到玛莉亚身上。
  engineDamageEnemy(state, cultist, 2, 0, [], null)
  assert.equal(cultist.damageTaken, 0, '敌人不受伤')
  assert.equal(maria.damage, 2, '伤害改道到玛莉亚')
  // 毁灭转嫁：[reaction] 描述子 trigger doomPlaced + cost exhaust → 移除敌人毁灭并改为玛莉亚的伤害。
  // 窗口/费用由引擎通用管线结算，这里直接验证条目描述子的条件与结算写点（spy api）。
  const descriptor = registeredEntry('11568').abilities[0]
  assert.deepEqual([...descriptor.trigger], ['doomPlaced'])
  assert.equal(descriptor.cost?.exhaust, true)
  assert.equal(descriptor.criteria({ state, source: maria, context: { card: cultist, amount: 1 } }), true)
  const calls = { removed: null, damaged: null }
  const stubApi = {
    removeDoomFromCard: (card, amount) => { calls.removed = { id: card.id, amount } },
    damageControlledAsset: (card, amount) => { calls.damaged = { id: card.id, amount } },
    info: () => {},
  }
  assert.equal(descriptor.criteria({ state, source: maria, context: { card: cultist, amount: 0 } }), false,
    '数量 0 不触发')
  descriptor.resolve({ state, source: maria, context: { card: cultist, amount: 1 }, api: stubApi })
  assert.deepEqual(calls.removed, { id: cultist.id, amount: 1 }, '移除敌人毁灭标记')
  assert.deepEqual(calls.damaged, { id: maria.id, amount: 1 }, '改为 1 点伤害放在玛莉亚身上')
  // 非[[异教徒]]敌人不触发。
  const monster = { ...cultist, id: 'monster', traits: ['Monster'] }
  state.enemies.push(monster)
  assert.equal(descriptor.criteria({ state, source: maria, context: { card: monster, amount: 1 } }), false)
})

// ---------------------------------------------------------------------------
// 21. 11581 古代遗物：受到 1+ 伤害后自伤 1
// ---------------------------------------------------------------------------
test('P7 theApiary 11581 古代遗物：你受到 1 点或更多伤害后，对它造成 1 点伤害', () => {
  const state = engineFixture('01001')
  const relic = engineAsset(state, '11581')
  const inv = state.investigators[0]
  const attacker = engineEnemy(state, { engagedSeat: 0, location: inv.location, damage: 1, horror: 0 })
  // 敌军阶段敌人攻击 → 调查员受到伤害 → harmDealt 窗口 → 古代遗物自伤 1。
  engineMove(state, { action: 'endTurn' })
  engineSettle(state)
  assert.equal(state.investigators[0].damage >= 1, true)
  assert.equal(state.investigators[0].assets.find(asset => asset.code === '11581').damage, 1, '古代遗物受到 1 点伤害')
})

// ---------------------------------------------------------------------------
// 22. 11557 失落的朝圣者：异教徒敌人获得「胜利 0 + 冷漠」
// ---------------------------------------------------------------------------
test('P7 theApiary 11557 失落的朝圣者：[[异教徒]]敌人获得胜利 0 与冷漠（已在场/后续生成）', async () => {
  const { state, api } = await fresh(2, WEST)
  state.acts = [{ id: 'act2w', code: ACT2_WEST_CODE, originalCode: ACT2_WEST_CODE }]
  state.actIndex = 0
  const existing = { id: 'existing-cultist', code: '11723', originalCode: '11723', name: '朝圣者侍僧',
    location: START_LOCATION, traits: ['Cultist'], fight: 2, evade: 2, health: 3, damageTaken: 0, doom: 0, victory: 1 }
  const monster = { id: 'monster', code: '11751', originalCode: '11751', name: '持久构造体',
    location: START_LOCATION, traits: ['Monster'], fight: 2, evade: 2, health: 3, damageTaken: 0, doom: 0, victory: 1 }
  state.enemies.push(existing, monster)
  behavior.phaseBegan(state, 'mythos', api)
  assert.equal(existing.aloof, true, '已在场的[[异教徒]]获得冷漠')
  assert.equal(existing.victory, 0, '印刷胜利 > 0 改为 0')
  assert.equal(monster.aloof, undefined, '非[[异教徒]]不受影响')
  // 后续生成的[[异教徒]]由 enemySpawned 钩子即时同步。
  const spawned = [spawnEnemy(state, '11723', START_LOCATION, api)]
  spawned[0].traits = ['Cultist']
  behavior.enemySpawned(state, spawned[0], api)
  assert.equal(spawned[0].aloof, true)
  // 非 11557 幕不生效。
  state.acts = [{ id: 'act1', code: '11556', originalCode: '11556' }]
  const outsider = { id: 'outsider', code: '11723', originalCode: '11723', name: '朝圣者侍僧',
    location: START_LOCATION, traits: ['Cultist'], victory: 1 }
  state.enemies.push(outsider)
  assert.equal(behavior.enemySpawned(state, outsider, api), false)
  assert.equal(outsider.aloof, undefined)
})

// ---------------------------------------------------------------------------
// 23. 11559 引诱之光：[action] 把遭遇弃牌堆中的地点洗入牌库底 10 张
// ---------------------------------------------------------------------------
test('P7 theApiary 11559 引诱之光：[action] 共同花费线索把遭遇弃牌堆中的地点洗入牌库底 10 张', async () => {
  const { state, api } = await fresh(2, WEST)
  revealAll(state, api)
  const inv = state.investigators[0]
  inv.location = START_LOCATION
  inv.clues = 2
  state.investigators[1].clues = 0
  state.encounterDiscard = ['11560', '11562', '01088']
  const deckBefore = state.encounterDeck.length
  const move = { action: 'scenarioAction', rule: 'apiaryEntranceShuffleLocations', locationId: START_LOCATION }
  assert.equal(behavior.performAction(state, inv, move, api), true)
  assert.equal(inv.clues, 0, '共同支付 2 个线索（1/人）')
  assert.equal(state.encounterDiscard.includes('11560'), false)
  assert.equal(state.encounterDiscard.includes('11562'), false)
  assert.equal(state.encounterDiscard.includes('01088'), true, '非地点留在遭遇弃牌堆')
  assert.equal(state.encounterDeck.length, deckBefore + 2, '两张地点洗入遭遇牌库')
  assert.deepEqual(state.encounterDeck.slice(0, 2), ['11560', '11562'], '洗入牌库底 10 张（栈底 = 数组前部）')
})

// ---------------------------------------------------------------------------
// 24. 11559b 危险出口：偷渡者落点改入口 + [action] 放异教徒到场景下方
// ---------------------------------------------------------------------------
test('P7 theApiary 11559b 危险出口：[[偷渡者]]敌人生成到入口；[action] 把异教徒支援/敌人放到场景下方', async () => {
  const { state, api } = await fresh(2, WEST)
  revealAll(state, api)
  const entrance = locationOf(state, START_LOCATION)
  entrance.code = '11559b'
  entrance.originalCode = '11559b'
  // 偷渡者敌人落点改为入口；非偷渡者不改。
  assert.equal(behavior.spawnLocation(state, '11574', 'somewhere', 0, api), START_LOCATION)
  assert.equal(behavior.spawnLocation(state, '11751', 'somewhere', 0, api), 'somewhere')
  // [action]：共同花费 2 线索，把入口的[[异教徒]]敌人放到场景下方。
  const inv = state.investigators[0]
  inv.location = START_LOCATION
  inv.clues = 2
  const cultist = { id: 'entrance-cultist', code: '11723', originalCode: '11723', name: '朝圣者侍僧',
    location: START_LOCATION, traits: ['Cultist'], fight: 2, evade: 2, health: 3, damageTaken: 0, doom: 0 }
  state.enemies.push(cultist)
  const move = { action: 'scenarioAction', rule: 'apiaryPutCultistUnder', locationId: START_LOCATION }
  assert.equal(behavior.performAction(state, inv, move, api), true)
  assert.equal(inv.clues, 0)
  assert.equal(state.enemies.includes(cultist), false, '敌人从场上移走')
  assert.deepEqual(state.scenarioFlags.apiaryCultistsUnder, ['11723'], '放到本场景下方')
  // [[异教徒]]支援也可被放到场景下方。
  inv.clues = 2
  inv.assets.push({ id: 'maria', code: MARIA_RIVERA_CODE, originalCode: MARIA_RIVERA_CODE, name: '玛莉亚·里维拉', attachments: [] })
  assert.equal(behavior.performAction(state, inv, move, api), true)
  assert.deepEqual(state.scenarioFlags.apiaryCultistsUnder, ['11723', MARIA_RIVERA_CODE])
  assert.equal(inv.assets.some(asset => asset.code === MARIA_RIVERA_CODE), false)
})

test('P7 theApiary 11567 读取旧存档时把营地牌和后来计分的卡分开', async () => {
  const { state, api } = await fresh(2, WEST)
  state.campaign.phase = 'scenario'
  state.scenarioFlags.apiaryInterlude = 'lostPilgrims'
  state.scenarioFlags.apiaryCultistsUnder = ['11723', '11724', '11723', MARIA_RIVERA_CODE]
  state.log = ['幕间：失落的朝圣者（叠在迷失营地下的异教徒 2 张）。']
  assert.equal(behavior.needsSaveRepair(state), true)
  behavior.repairSavedState(state, api)
  assert.deepEqual([...campsiteDeck(state)].sort(), ['11723', '11724'])
  assert.deepEqual(cultistCardsUnderAct(state), ['11723', MARIA_RIVERA_CODE])
  assert.equal(behavior.needsSaveRepair(state), false)
})

// ---------------------------------------------------------------------------
// 25. 11581 古代遗物：[reaction] 控制它结束游戏时自动翻面结算
// ---------------------------------------------------------------------------
test('P7 theApiary 11581 古代遗物：控制它结束游戏时翻面（符文 S + 胜利区）', async () => {
  const { state, api } = await fresh(2, WEST)
  revealAll(state, api)
  const inv = state.investigators[0]
  inv.assets.push({ id: 'relic', code: ANCIENT_RELIC_CODE, originalCode: ANCIENT_RELIC_CODE,
    name: '古代遗物', damage: 0, horror: 0, exhausted: false, attachments: [] })
  behavior.resolution(state, 'resolution1', null, api)
  assert.equal(state.campaign.records.discoveredGlyphs.includes('S'), true, '记录符文 [S]「机器」')
  assert.equal(state.victoryDisplay.some(entry => entry.code === ANCIENT_RELIC_STORY_CODE), true, '故事卡加入胜利区')
  assert.equal(inv.assets.some(asset => asset.code === ANCIENT_RELIC_CODE), false, '遗物离场')
})

// ---------------------------------------------------------------------------
// 26. 11582 骇人“面具”持续限制与字形门槛（P7 第六轮收口）
// ---------------------------------------------------------------------------
test('P7 theApiary 11582 骇人“面具”：直到下个回合开始不能移动/造成伤害/交战（api.addEffect）+ 字形门槛', () => {
  const state = engineFixture('01001')
  state.chaosBag = ['0']
  engineAsset(state, '11582')
  engineEnemy(state, { engagedSeat: 0, location: state.investigators[0].location })
  let mask = state.investigators[0].assets.find(asset => asset.code === '11582')
  // 符文未集齐：第二条 [fast] 不在合法动作里。
  let moves = engineLegalMoves(state, 0).filter(move => move.action === 'ability' && move.assetId === mask.id)
  assert.equal(moves.some(move => move.abilityIndex === 1), false, '符文 j/m/s/c/b 未集齐时第二条不可用')
  engineMove(state, { action: 'ability', assetId: mask.id, abilityIndex: 0 })
  const effect = (state.effects || []).find(item => item.sourceCode === '11582')
  assert.equal(effect?.duration, 'startOfNextTurn')
  assert.equal(effect?.controllerSeat, 0)
  assert.equal(state.investigators[0].engaged.length, 0, '解除交战')
  // 限制生效：不能移动、不能造成敌人伤害/交战。
  const restricted = engineLegalMoves(state, 0)
  assert.equal(restricted.some(move => move.action === 'move'), false, '不能移动')
  // 不能对敌人造成伤害（capability:dealEnemyDamage 在伤害写入口拦截）。
  const blockedEnemy = engineEnemy(state, { engagedSeat: null, location: state.investigators[0].location })
  assert.equal(engineDamageEnemy(state, blockedEnemy, 1, 0, [], null), false, '不能对敌人造成伤害')
  assert.equal(blockedEnemy.damageTaken || 0, 0)
  // 下个回合开始（结束回合后进入自己的下一回合）效果到期。
  engineMove(state, { action: 'endTurn' })
  engineSettle(state)
  assert.equal((state.effects || []).some(item => item.sourceCode === '11582'), false, 'startOfNextTurn 到期移除')
  // 符文集齐后第二条 [fast] 出现在合法动作里。
  const glyphState = engineFixture('01001')
  glyphState.scenario = { ...glyphState.scenario, id: 'theApiary' }
  engineAsset(glyphState, '11582')
  engineEnemy(glyphState, { engagedSeat: null, location: glyphState.investigators[0].location })
  glyphState.campaign.records.discoveredGlyphs = ['J', 'M', 'S', 'C', 'B']
  const glyphMask = glyphState.investigators[0].assets.find(asset => asset.code === '11582')
  const glyphMoves = engineLegalMoves(glyphState, 0)
    .filter(move => move.action === 'ability' && move.assetId === glyphMask.id)
  assert.equal(glyphMoves.some(move => move.abilityIndex === 1), true, '符文集齐后第二条可用')
})
