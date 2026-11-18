// P7 汉洛克庄园（hemlockHouse · 提示卡 10523）章节测试。
//
// 覆盖：章节结构/38 张卡与 gather 分区、放一边与遭遇牌库（含当日组）、13 个地点的网格布置、
// 第一层固定连接与「与相邻地点相连」、卧室楼层帷幕、敌人在场与双面敌人-地点（翻面/翻回/封印禁止/
// 背面揭示强制效果/击败进胜利展示区）、掠食袋与掠食检定、幕/议程推进与背面、混乱标记与追加效果、
// 结局与战役记录写入、存档 JSON 往返。
//
// 本文件不 import engine.js：章节 behavior 只走内容层函数（真实引擎钩子由 P7 主进程合并后用
// contentRegistry 注册），因此单测可在并行 worker 尚未重建索引时独立运行。单卡条目经
// src/engine/ability.js 的注册表读取（与 TSK 章测试同一口径）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import * as chapter from '../content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/index.js'
import {
  scenario, LOCATIONS, LOCATION_CONNECTIONS, ROOM_IDS, ALL_LOCATION_IDS, CELLAR_ID, FIRST_FLOOR,
  RANDOM_SLOTS, TOP_BEDROOM_SLOT, SHUFFLE_POOL_IDS, BEDROOM_IDS, ENEMY_LOCATION_CODE_BY_LOCATION,
  ENEMY_LOCATION_FACES, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, DAY_ENCOUNTER_DECKS,
  SET_ASIDE_CARDS, ACT_CODES, SET_ASIDE_ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES,
  SCENARIO_TEXT, RESOLUTION_KEYS, PREDATION_BAG_ID, predationBagTokens, PREDATION_DAY_CULTISTS,
  SHAPELESS_CELLAR_CODE, LITTLE_SYLVIE_CODE, PREDATORY_HOUSE_CODE, PREDATION_TEST_CODE,
  GRAPPLING_SPAWN_CODE, OUT_OF_THE_WALLS_CODE, PULLED_IN_CODE, FIRE_CODE, RESIDENT_SETUP,
  CODEX_ENTRY_IDS, RECORD_KEYS, AREAS_SURVEYED_HEMLOCK_HARBOR, agendaUseV1,
  START_LOCATION, GATHER_GROUPS, GATHER_SET_ASIDE_GROUPS, DAY_ENCOUNTER_GROUPS,
} from '../content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/definition.js'
import { floorOfCell, layout } from '../content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/layout.js'
import {
  HEMLOCK_TOKEN_MEANINGS, hemlockHouseChaosToken, hemlockHouseChaosTokenValue, skullValue,
  tabletHealAmount, floorOf as chaosFloorOf,
} from '../content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/chaos.js'
import entryPredatoryHouse from '../src/cards/encounter-entries/theFeastOfHemlockVale/hemlockHouse/10524.js'
import entryPredationTest from '../src/cards/encounter-entries/theFeastOfHemlockVale/hemlockHouse/10524b.js'
import entryEerieSilence from '../src/cards/encounter-entries/theFeastOfHemlockVale/hemlockHouse/10525.js'
import entryOutOfTheWalls from '../src/cards/encounter-entries/theFeastOfHemlockVale/hemlockHouse/10545.js'
import entryPulledIn from '../src/cards/encounter-entries/theFeastOfHemlockVale/hemlockHouse/10546.js'
import entryCellar from '../src/cards/encounter-entries/theFeastOfHemlockVale/hemlockHouse/10547.js'
import entryGrapplingSpawn from '../src/cards/encounter-entries/theFeastOfHemlockVale/hemlockHouse/10544.js'
import entrySylvie from '../src/cards/encounter-entries/theFeastOfHemlockVale/hemlockHouse/10548.js'
import entryBedroom from '../src/cards/encounter-entries/theFeastOfHemlockVale/hemlockHouse/10532.js'
import entryLivingBedroom from '../src/cards/encounter-entries/theFeastOfHemlockVale/hemlockHouse/10532b.js'
import entryParlor from '../src/cards/encounter-entries/theFeastOfHemlockVale/hemlockHouse/10541.js'
import entryLivingParlor from '../src/cards/encounter-entries/theFeastOfHemlockVale/hemlockHouse/10541b.js'
import entryFoyer from '../src/cards/encounter-entries/theFeastOfHemlockVale/hemlockHouse/10543.js'
import entryStrangeInfestation from '../src/cards/encounter-entries/theFeastOfHemlockVale/hemlockHouse/10529.js'
import entryHeartOfTheHouse from '../src/cards/encounter-entries/theFeastOfHemlockVale/hemlockHouse/10531.js'
import entryAgainstTheHouse from '../src/cards/encounter-entries/theFeastOfHemlockVale/hemlockHouse/10530.js'

const ENTRIES = [entryPredatoryHouse, entryPredationTest, entryEerieSilence, entryOutOfTheWalls,
  entryPulledIn, entryCellar, entryGrapplingSpawn, entrySylvie, entryBedroom, entryLivingBedroom,
  entryParlor, entryLivingParlor, entryFoyer, entryStrangeInfestation, entryHeartOfTheHouse,
  entryAgainstTheHouse]
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])
// 其余条目只做「文件存在且能注册」的覆盖：按 input.entryPaths（38 个）逐个动态载入。
for (const code of chapter.implementedEncounterCodes) {
  if (registeredEntry(code)) continue
  // eslint-disable-next-line no-await-in-loop
  const module = await import(`../src/cards/encounter-entries/theFeastOfHemlockVale/hemlockHouse/${code}.js`)
  registerCardAbilities([module.default])
}

const clone = value => JSON.parse(JSON.stringify(value))
const stateFor = (count = 1, records = {}, flags = {}) => ({
  investigators: Array.from({ length: count }, (_, seat) => ({
    seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
    assets: [], engaged: [], deck: [], hand: [], discard: [], threat: [],
  })),
  locations: [], enemies: [], storyAssets: [], encounterDeck: [], encounterDiscard: [],
  scenarioFlags: { ...flags }, scenarioZones: {},
  campaign: { leadSeat: 0, records: { ...records }, completedSteps: [], trauma: {}, investigators: {} },
  victoryDisplay: [], chaosBag: ['skull', 'cultist', 'tablet', 'elderthing'], doom: 0,
  difficulty: 'standard', numInvestigators: count, phase: 'investigation', round: 1, status: 'playing',
  rngState: 20261117,
})
const stateWithScenario = (count = 1, records = {}, flags = {}) => {
  const state = stateFor(count, records, flags)
  state.scenario = structuredClone(scenario)
  return state
}
const quietApi = () => ({ info: () => {} })
const setup = (count = 1, { day = 1, night = false } = {}, api = quietApi()) => {
  const state = stateWithScenario(count, { day, time: night ? 'night' : 'day' })
  const report = chapter.behavior.setupScenario(state, api)
  return { state, report }
}
// 模拟引擎 advanceAct：先结算当前幕背面，再按 actIndexAfterAdvance 推进指针。
const engineishApi = extra => {
  const api = { info: () => {}, finished: null, trauma: [], ...extra }
  api.advanceAct = () => {
    const state = api.state
    const act = state.acts[state.actIndex]
    chapter.behavior.actReveal(state, act, api)
    if (api.finished) return
    const next = chapter.behavior.actIndexAfterAdvance(state, act)
    state.actIndex = Number.isInteger(next) ? next : state.actIndex + 1
  }
  api.advanceAgenda = () => {
    const state = api.state
    const agenda = state.agendas[state.agendaIndex]
    chapter.behavior.agendaReveal(state, agenda, api)
    state.agendaIndex += 1
  }
  api.finish = key => { api.finished = key }
  api.addTrauma = (seat, kind, amount) => { api.trauma.push({ seat, kind, amount }) }
  return api
}
// 掠食袋 / 混乱袋的轻量 api 桩（真实实现是 src/engine/token-bag.js 的原语）。
const tokenBagApi = (state, queue = []) => ({
  info: id => ({
    id, exists: Boolean(state.tokenBags?.[id]),
    count: state.tokenBags?.[id]?.tokens?.length || 0,
    revealed: [...(state.tokenBags?.[id]?.revealed || [])],
  }),
  create: (id, tokens) => {
    state.tokenBags ||= {}
    state.tokenBags[id] = { tokens: [...tokens], revealed: [] }
    return tokens.length
  },
  reveal: id => {
    const bag = state.tokenBags?.[id]
    if (!bag || !bag.tokens.length) return null
    const wanted = queue.length ? queue.shift() : bag.tokens[0]
    const at = bag.tokens.indexOf(wanted)
    const token = bag.tokens.splice(at < 0 ? 0 : at, 1)[0]
    bag.revealed.push(token)
    return token
  },
  add: (id, token) => {
    state.tokenBags ||= {}
    const bag = state.tokenBags[id] || (state.tokenBags[id] = { tokens: [], revealed: [] })
    bag.tokens.push(token)
    return bag.tokens.length
  },
  return: (id, token) => {
    const bag = state.tokenBags?.[id]
    const at = bag?.revealed?.indexOf(token) ?? -1
    if (at < 0) return false
    bag.revealed.splice(at, 1)
    bag.tokens.push(token)
    return true
  },
})
const roomInPlay = (state, code) => state.locations.find(location => location.code === code)
const pushRoom = (state, id, x, y) => {
  const location = {
    ...structuredClone(LOCATIONS[id]), id, revealed: true, clues: 1, maxClues: 1, doom: 0, damage: 0,
    horror: 0, resources: 0, attachments: [], sealCount: 0,
  }
  state.locations.push(location)
  state.scenarioFlags.mechanics ||= { version: 1 }
  state.scenarioFlags.mechanics.grid ||= {}
  state.scenarioFlags.mechanics.grid[id] = { x, y, isolated: false, connections: [] }
  chapter.behavior.syncConnections(state)
  return location
}

// ---------------------------------------------------------------------------
// 1. 章节结构、38 张卡、gather 分区、放一边
// ---------------------------------------------------------------------------

test('P7 hemlockHouse 章节结构：38 条卡、7 个 gather 组 + 当日组、13 个地点与 38 个单卡条目', () => {  assert.equal(chapter.scenario.id, 'hemlockHouse')
  assert.equal(chapter.scenario.originalCode, '10523')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.campaignId, 'theFeastOfHemlockVale')
  assert.deepEqual([...GATHER_GROUPS], ['hemlockHouse', 'agentsOfTheColour', 'blight', 'fire',
    'transfiguration', 'lockedDoors', 'rats'])
  assert.deepEqual([...GATHER_SET_ASIDE_GROUPS], ['residents'])
  assert.deepEqual(Object.values(DAY_ENCOUNTER_GROUPS), ['theFirstDay', 'theSecondDay', 'theFinalDay'])
  assert.equal(Object.keys(LOCATIONS).length, 13)
  assert.equal(ROOM_IDS.length, 12)
  assert.equal(ALL_LOCATION_IDS.length, 13)
  assert.equal(Object.keys(ENEMY_LOCATION_FACES).length, 12)
  assert.equal(chapter.implementedEncounterCodes.length, 38)
  assert.deepEqual([...chapter.implementedEncounterCodes].sort(), [
    ...ACT_CODES, ...SET_ASIDE_ACT_CODES, ...AGENDA_CODES, '10527',
    ...Object.values(ENEMY_LOCATION_CODE_BY_LOCATION),
    '10524', '10524b', '10544', '10545', '10546', '10547', '10548',
    ...ROOM_IDS.map(id => LOCATIONS[id].code),
  ].sort())
  // 幕/议程牌库：幕 2 只保留一张（幕 1 背面按封印/胜利区选择另一张）。
  assert.equal(chapter.scenario.acts.length, 2)
  assert.deepEqual(chapter.scenario.acts.map(act => act.originalCode), [ACT_CODES[0], ACT_CODES[1]])
  assert.equal(SET_ASIDE_ACT_CODES.length, 1, '幕 2a「对抗庄园」放一边')
  assert.equal(chapter.scenario.agendas.length, 3)
  assert.deepEqual(chapter.scenario.agendas.map(agenda => agenda.originalCode),
    ['10525', '10526', '10528'], 'Day 1 / Day 3 白天使用议程 2 v.I')
  assert.equal(agendaUseV1({ day: 2, period: 'day' }), false, 'Day 2 用 v.II')
  assert.equal(agendaUseV1({ day: 3, period: 'night' }), false, 'Day 3 夜晚用 v.II')
  assert.equal(agendaUseV1({ day: 3, period: 'day' }), true, 'Day 3 白天用 v.I')
  // 单卡条目：数据型/行为型都注册成功且卡号一致。
  for (const code of chapter.implementedEncounterCodes) {
    assert.ok(registeredEntry(code), `条目已注册：${code}`)
    assert.equal(registeredEntry(code).code, code)
  }
  assert.equal(chapter.implementedEntryFlags('10532b').enemyLocation, true)
  assert.equal(chapter.implementedEntryFlags('10541b').retaliate, true)
  assert.equal(chapter.implementedEntryFlags('10547').singleSided, true)
  assert.equal(chapter.implementedEntryFlags('10544').floorHealthBonus, true)
  assert.equal(chapter.implementedEntryFlags('10546').surgeWithoutEnemyLocation, true)
  assert.equal(chapter.implementedEntryFlags('10525').resolvePredatoryHouseOnBack, true)
  // 指南正文（story-text 生成物；本关没有本地中译，逐叶披露）。
  assert.equal(SCENARIO_TEXT.intro.intro1.body.length > 0, true)
  assert.equal(SCENARIO_TEXT.setupSteps.length >= 20, true)
  assert.equal(SCENARIO_TEXT.specialRules.length, 2)
  assert.equal(SCENARIO_TEXT.specialRules.some(rule => /敌人-地点|Enemy-Locations/.test(rule.body)), true)
  assert.equal(SCENARIO_TEXT.chineseGaps.length, 0)
  assert.equal(SCENARIO_TEXT.textLanguage, 'zh-CN')
  assert.equal(Object.keys(chapter.scenario.resolutions).length, 3)
  assert.deepEqual([...RESOLUTION_KEYS], ['noResolution', 'resolution1', 'resolution2'])
})

test('P7 hemlockHouse 遭遇牌库与放一边：19 张基础牌、当日组 3 张、5 张 Fire! 与 6 张洗入牌放一边', () => {
  assert.equal(ENCOUNTER_DECK.length, 19)
  assert.equal(ENCOUNTER_DECK.filter(code => code === GRAPPLING_SPAWN_CODE).length, 2, '紧锢孽种 ×2')
  for (const code of [FIRE_CODE, OUT_OF_THE_WALLS_CODE, PULLED_IN_CODE]) {
    assert.equal(ENCOUNTER_DECK.includes(code), false, `放一边的诡计不进初始牌库：${code}`)
  }
  assert.equal(SET_ASIDE_CARDS.filter(code => code === FIRE_CODE).length, 5, '全部 5 张 Fire!')
  assert.equal(SET_ASIDE_CARDS.filter(code => code === OUT_OF_THE_WALLS_CODE).length, 4)
  assert.equal(SET_ASIDE_CARDS.filter(code => code === PULLED_IN_CODE).length, 2)
  assert.equal(SET_ASIDE_CARDS.includes(PREDATORY_HOUSE_CODE), true, '猎杀之屋剧情卡放一边')
  assert.equal(SET_ASIDE_CARDS.includes('10530'), true, '幕 2a「对抗庄园」放一边')
  for (const day of [1, 2, 3]) {
    assert.equal(DAY_ENCOUNTER_DECKS[day].length, 3, `第 ${day} 日遭遇组 3 张`)
  }
  assert.equal(DAY_ENCOUNTER_DECKS[1][0], '10676')
  assert.equal(DAY_ENCOUNTER_DECKS[2][0], '10678')
  assert.equal(DAY_ENCOUNTER_DECKS[3][0], '10680')
  // 双面地点/敌人-地点、剧情卡、居民都不在遭遇牌库里。
  for (const code of [...Object.values(ENEMY_LOCATION_CODE_BY_LOCATION), SHAPELESS_CELLAR_CODE,
    LITTLE_SYLVIE_CODE, PREDATORY_HOUSE_CODE, PREDATION_TEST_CODE]) {
    assert.equal(ENCOUNTER_DECK.indexOf(code), -1, `不进遭遇牌库：${code}`)
  }
  const setAside = chapter.manifest.zones.setAside
  assert.equal(setAside.find(entry => entry.cardCode === FIRE_CODE)?.count, 5)
  assert.equal(setAside.find(entry => entry.cardCode === SHAPELESS_CELLAR_CODE)?.count, 1,
    '失形地窖在放一边区域')
  assert.equal(chapter.manifest.zones.encounterDeck.reduce((sum, entry) => sum + entry.count, 0), 19)
  assert.equal(chapter.manifest.zones.inPlay.find(entry => entry.cardCode === LITTLE_SYLVIE_CODE)?.count, 1)
})

// ---------------------------------------------------------------------------
// 2. 布置、楼层、地点连接
// ---------------------------------------------------------------------------

test('P7 hemlockHouse 布置：第一层固定三间、随机 6 间上两层、四层中列卧室、2 间移出游戏', () => {
  const { state, report } = setup(2)
  assert.equal(state.locations.length, 10, '3 间一层 + 6 间随机 + 四层卧室')
  assert.equal(report.removed.length, 2)
  assert.equal(RANDOM_SLOTS.length, 6)
  assert.equal(SHUFFLE_POOL_IDS.length, 9, '12 间房减去第一层三间')
  // 第一层坐标印刷固定。
  assert.deepEqual(chapter.behavior.cellOf(state, 'parlor'), { ...FIRST_FLOOR.parlor })
  assert.deepEqual(chapter.behavior.cellOf(state, 'foyer'), { ...FIRST_FLOOR.foyer })
  assert.deepEqual(chapter.behavior.cellOf(state, 'diningRoom'), { ...FIRST_FLOOR.diningRoom })
  // 四层中列：随机选中的那一间卧室。
  const topBedroom = state.scenarioFlags.hemlockAsideBedroom
  assert.equal(BEDROOM_IDS.includes(topBedroom), true)
  assert.deepEqual(chapter.behavior.cellOf(state, topBedroom), { ...TOP_BEDROOM_SLOT })
  assert.equal(chapter.behavior.floorOf(state, topBedroom), 4)
  // 被移出游戏的两间既不在场也没有格。
  for (const id of report.removed) {
    assert.equal(state.locations.some(location => location.id === id), false)
    assert.equal(chapter.behavior.cellOf(state, id), null)
  }
  // 随机 6 间的格互不重复且落在第二/三层。
  const cells = RANDOM_SLOTS.map(slot => state.locations
    .find(location => {
      const cell = chapter.behavior.cellOf(state, location.id)
      return cell && cell.x === slot.x && cell.y === slot.y
    }))
  assert.equal(cells.every(Boolean), true)
  assert.equal(new Set(cells.map(location => location.id)).size, 6)
  // 楼层与卧室帷幕（X = 楼层 + 1）。
  assert.equal(chapter.behavior.floorOf(state, 'parlor'), 1)
  for (const id of BEDROOM_IDS) {
    const location = state.locations.find(item => item.id === id)
    if (!location) continue
    assert.equal(location.shroud, chapter.behavior.floorOf(state, id) + 1, `${id} 帷幕 = 楼层 + 1`)
  }
  // 起始地点：Day/Night 1-2 从门厅；Day 3 从四层卧室。
  assert.equal(chapter.behavior.startLocation(state), 'foyer')
  assert.equal(state.investigators[0].location, 'foyer')
  assert.equal(chapter.START_LOCATION, 'foyer')
  const day3 = setup(1, { day: 3 })
  assert.equal(chapter.behavior.startLocation(day3.state), day3.state.scenarioFlags.hemlockAsideBedroom)
  assert.equal(day3.state.investigators[0].location, day3.state.scenarioFlags.hemlockAsideBedroom)
  // 当日遭遇组并入牌库：19 + 3。
  assert.equal(state.encounterDeck.length, 22)
  assert.equal(state.encounterDeck.filter(code => code === '10676').length, 3)
})

test('P7 hemlockHouse 地点连接：第一层走廊印刷固定、其余按网格正交相邻且双向对称', () => {
  const { state } = setup(1)
  assert.deepEqual(LOCATION_CONNECTIONS.parlor, ['foyer'])
  assert.deepEqual(LOCATION_CONNECTIONS.foyer, ['parlor', 'diningRoom'])
  assert.deepEqual(LOCATION_CONNECTIONS.diningRoom, ['foyer'])
  const byId = id => state.locations.find(location => location.id === id)
  const roomAbove = (id, dy = 1) => {
    const cell = chapter.behavior.cellOf(state, id)
    return state.locations.find(location => {
      const other = chapter.behavior.cellOf(state, location.id)
      return other && other.x === cell.x && other.y === cell.y + dy
    }) || null
  }
  const parlorAbove = roomAbove('parlor')
  assert.ok(parlorAbove, '客厅正上方有地点')
  assert.deepEqual([...byId('parlor').connections].sort(), ['foyer', parlorAbove.id].sort())
  assert.equal(byId('foyer').connections.includes('parlor'), true)
  assert.equal(byId('foyer').connections.includes('diningRoom'), true)
  // 门厅正上方（0,1）与门厅相连；正下方（0,-1）为地窖层，入场后相连。
  const aboveFoyer = roomAbove('foyer')
  assert.equal(aboveFoyer.connections.includes('foyer'), true)
  assert.equal(byId('foyer').connections.includes(aboveFoyer.id), true)
  // 全图对称。
  for (const location of state.locations) {
    for (const neighbor of location.connections) {
      assert.equal(byId(neighbor)?.connections.includes(location.id), true, `${location.id} ↔ ${neighbor} 对称`)
    }
  }
  assert.equal(layout.adjacency, 'orthogonal')
  assert.deepEqual(layout.grid.columns, [-1, 0, 1])
  assert.equal(floorOfCell({ x: 0, y: 3 }), 4)
  assert.equal(floorOfCell({ x: 0, y: -1 }), 0, '地窖 0 层')
  assert.equal(layout.edges.length, 4, '布局只镜像第一层走廊的规则连接')
  assert.deepEqual(layout.locations.foyer, { x: 0, y: 0 })
  // 地窖入场后与门厅相连（正下方）。
  chapter.behavior.placeCellar(state, quietApi())
  assert.equal(byId(CELLAR_ID).connections.includes('foyer'), true)
  assert.equal(byId('foyer').connections.includes(CELLAR_ID), true)
  assert.equal(chapter.behavior.floorOf(state, CELLAR_ID), 0)
})

// ---------------------------------------------------------------------------
// 3. 敌人在场与双面敌人-地点
// ---------------------------------------------------------------------------

test('P7 hemlockHouse 敌人在场与双面敌人：地点翻到敌人-地点面并生成同名 id 的敌人，翻回保留伤害', () => {
  const api = quietApi()
  const { state } = setup(2, {}, api)
  const room = roomInPlay(state, '10541')
  assert.ok(room)
  const enemy = chapter.behavior.flipToEnemySide(state, room, api)
  assert.ok(enemy, '翻面生成敌人实例')
  assert.equal(room.code, ENEMY_LOCATION_CODE_BY_LOCATION[room.id])
  assert.equal(enemy.enemyLocation, true)
  assert.equal(enemy.massive, true, '敌人-地点是 Massive')
  assert.equal(enemy.immobile, true, '不能被卡效果移动')
  assert.equal(enemy.location, room.id, '敌人视为在该地点')
  assert.equal(enemy.engagedSeat, null)
  assert.equal(enemy.id, room.id)
  assert.equal(room.enemyLocationFace.code, '10541', '保留地点面')
  assert.equal(chapter.behavior.isEnemyLocation(room), true)
  assert.equal(chapter.behavior.isDormant(room), false)
  // 连接在翻面后保留（翻转不移动调查员/敌人/附属/标记）。
  assert.deepEqual(room.connections, chapter.behavior.syncConnections(state) && room.connections)
  assert.equal(room.connections.includes('foyer'), true)
  // 翻回：地点面恢复、敌人移除、伤害以 enemyLocationCondition 保留。
  enemy.damageTaken = 2
  enemy.exhausted = true
  const restored = chapter.behavior.flipToLocationSide(state, room, api)
  assert.ok(restored)
  assert.equal(room.code, '10541')
  assert.equal(chapter.behavior.isEnemyLocation(room), false)
  assert.equal(state.enemies.length, 0)
  assert.deepEqual(room.enemyLocationCondition, { exhausted: true, damageTaken: 2 })
  // 再次翻面把保留的伤害带回敌人。
  const again = chapter.behavior.flipToEnemySide(state, room, api)
  assert.equal(again.damageTaken, 2)
  assert.equal(again.exhausted, true)
  // 已封印的地点不能被掠食检定翻面；失形地窖不能被封印或翻面。
  room.enemyLocationFace && chapter.behavior.flipToLocationSide(state, room, api)
  room.sealCount = 1
  assert.equal(chapter.behavior.flipToEnemySide(state, room, api), null, '封印地点不能翻面')
  room.sealCount = 0
  const cellar = chapter.behavior.placeCellar(state, api)
  assert.equal(chapter.behavior.isEnemyLocation(cellar), true, '地窖一入场就是敌人-地点')
  assert.equal(chapter.behavior.flipToLocationSide(state, cellar, api), null, '地窖不能翻回地点面')
  assert.equal(chapter.behavior.placeSeal(state, CELLAR_ID, 0, api), false, '地窖不能被封印')
  assert.equal(entryCellar.flags.cannotBeSealed, true)
  assert.equal(entryLivingBedroom.flags.enemyLocation, true)
  assert.equal(entryBedroom.flags.enemyLocationCode, '10532b')
})

test('P7 hemlockHouse 敌人-地点背面揭示：强制攻击/放毁灭，紧锢孽种按楼层加生命与夜间报复', () => {
  const api = quietApi()
  api.attacks = []
  api.attack = (enemy, inv) => api.attacks.push({ enemy: enemy.id, seat: inv.seat })
  const { state } = setup(2, {}, api)
  const parlor = roomInPlay(state, '10541')
  state.investigators.forEach(inv => { inv.location = 'parlor' })
  chapter.behavior.flipToEnemySide(state, parlor, api)
  assert.equal(api.attacks.filter(row => row.enemy === parlor.id).length, 2, '该处每名调查员各被攻击一次')
  // 卧室 10532b：在其上放置 1 个毁灭。
  state.locations = state.locations.filter(location => location.id !== 'bedroom32')
  state.enemies = state.enemies.filter(enemy => enemy.id !== 'bedroom32')
  const bedroom = pushRoom(state, 'bedroom32', -1, 1)
  chapter.behavior.flipToEnemySide(state, bedroom, api)
  const bedroomEnemy = state.enemies.find(enemy => enemy.id === 'bedroom32')
  assert.equal((bedroomEnemy.doom || 0) + (bedroom.doom || 0), 1, '被揭示时放 1 个毁灭')  // 紧锢孽种：生命 = 印刷 2 + 当前楼层（最少 1），夜间获得报复。
  const nightState = setup(1, { day: 2, night: true }).state
  const spawn = { id: 'spawn-1', code: GRAPPLING_SPAWN_CODE, originalCode: GRAPPLING_SPAWN_CODE,
    location: 'foyer', traits: ['Monster', 'Mutated'], health: 2 }
  assert.equal(chapter.behavior.enemyStatModifier(nightState, spawn, 'health'), 1, '一层 +1 生命')
  spawn.location = nightState.scenarioFlags.hemlockAsideBedroom
  assert.equal(chapter.behavior.enemyStatModifier(nightState, spawn, 'health'), 4, '四层 +4 生命')
  chapter.behavior.enemySpawned(nightState, spawn, quietApi())
  assert.equal(spawn.retaliate, true, '夜晚获得报复')
  const dayState = setup(1, { day: 2 }).state
  const daySpawn = { ...spawn, retaliate: false, code: GRAPPLING_SPAWN_CODE }
  chapter.behavior.enemySpawned(dayState, daySpawn, quietApi())
  assert.equal(daySpawn.retaliate, false, '白天没有报复')
  assert.equal(entryGrapplingSpawn.flags.nightRetaliate, true)
})

// ---------------------------------------------------------------------------
// 4. 掠食袋与掠食检定
// ---------------------------------------------------------------------------

test('P7 hemlockHouse 掠食袋：基础 3 枚 + 当日 cultist（Day1 +2 / Day2 +1 / Day3 0）', () => {
  assert.deepEqual(predationBagTokens(1), ['cultist', 'tablet', 'elderthing', 'cultist', 'cultist'])
  assert.deepEqual(predationBagTokens(2), ['cultist', 'tablet', 'elderthing', 'cultist'])
  assert.deepEqual(predationBagTokens(3), ['cultist', 'tablet', 'elderthing'])
  assert.deepEqual({ ...PREDATION_DAY_CULTISTS }, { 1: 2, 2: 1, 3: 0 })
  for (const day of [1, 2, 3]) {
    const { state } = setup(1, { day })
    const bag = chapter.behavior.ensurePredationBag(state, quietApi())
    assert.equal(bag.count, predationBagTokens(day).length)
    assert.deepEqual([...state.tokenBags[PREDATION_BAG_ID].tokens], predationBagTokens(day))
    assert.deepEqual(state.tokenBags[PREDATION_BAG_ID].revealed, [])
  }
  // 掠食检定卡（10524b）从放一边进入场上。
  const { state } = setup(1)
  const asset = chapter.behavior.resolvePredatoryHouse(state, quietApi())
  assert.equal(asset.code, PREDATION_TEST_CODE)
  assert.equal(state.storyAssets.some(item => item.code === PREDATION_TEST_CODE), true)
  assert.equal(chapter.behavior.predationBagInfo(state).exists, true)
  assert.equal(entryPredatoryHouse.flags.backFaceCode, '10524b')
  assert.equal(entryPredationTest.flags.predationTest, true)
})

test('P7 hemlockHouse 掠食检定：cultist 放到一边、tablet 敌人-地点攻击后归还、elder_thing 翻面地点', () => {
  // cultist：放到一边（留在已验证区），不归还。
  {
    const api = quietApi()
    api.attacks = []
    api.attack = (enemy, inv) => api.attacks.push([enemy.id, inv.seat])
    const { state } = setup(2, {}, api)
    const room = roomInPlay(state, '10541')
    chapter.behavior.flipToEnemySide(state, room, quietApi())
    api.attacks.length = 0
    const apiWithBag = { ...api, tokenBag: tokenBagApi(state, ['cultist']) }
    chapter.behavior.ensurePredationBag(state, apiWithBag)
    const before = state.tokenBags[PREDATION_BAG_ID].tokens.length
    const outcome = chapter.behavior.makePredationTest(state, apiWithBag)
    assert.equal(outcome.token, 'cultist')
    assert.equal(outcome.effect, 'cultist')
    assert.equal(state.tokenBags[PREDATION_BAG_ID].tokens.length, before - 1)
    assert.deepEqual(state.tokenBags[PREDATION_BAG_ID].revealed, ['cultist'], '放到一边')
    assert.equal(api.attacks.length, 0, 'cultist 不引发攻击')
  }
  // tablet：每个敌人-地点攻击该处每名调查员，然后把放一边的标记与本标记放回袋里。
  {
    const api = quietApi()
    api.attacks = []
    api.attack = (enemy, inv) => api.attacks.push([enemy.id, inv.seat])
    const { state } = setup(2, {}, api)
    state.investigators[0].location = 'parlor'
    state.investigators[1].location = 'foyer'
    const parlor = roomInPlay(state, '10541')
    chapter.behavior.flipToEnemySide(state, parlor, quietApi())
    api.attacks.length = 0
    const apiWithBag = { ...api, tokenBag: tokenBagApi(state, ['tablet']) }
    chapter.behavior.ensurePredationBag(state, apiWithBag)
    // 先放一枚 cultist 到一边，tablet 应把它一起归还。
    state.tokenBags[PREDATION_BAG_ID].tokens.splice(state.tokenBags[PREDATION_BAG_ID].tokens.indexOf('cultist'), 1)
    state.tokenBags[PREDATION_BAG_ID].revealed.push('cultist')
    const outcome = chapter.behavior.makePredationTest(state, apiWithBag)
    assert.equal(outcome.effect, 'tablet')
    assert.equal(api.attacks.length, 1, 'parlor 的调查员被攻击（foyer 处没有敌人-地点）')
    assert.deepEqual(state.tokenBags[PREDATION_BAG_ID].revealed, [], '标记全部归还')
  }
  // tablet 无攻击：领队抽 1 张遭遇牌。
  {
    const api = quietApi()
    api.drawn = 0
    api.drawEncounter = () => { api.drawn += 1 }
    const { state } = setup(2, {}, api)
    const apiWithBag = { ...api, tokenBag: tokenBagApi(state, ['tablet']) }
    chapter.behavior.ensurePredationBag(state, apiWithBag)
    chapter.behavior.makePredationTest(state, apiWithBag)
    assert.equal(api.drawn, 1, '没有发生攻击 → 领队抽遭遇牌')
  }
  // elder_thing：翻面最近的未封印 [[Dormant]] 地点。
  {
    const api = quietApi()
    const { state } = setup(2, {}, api)
    const apiWithBag = { ...api, tokenBag: tokenBagApi(state, ['elderthing']) }
    chapter.behavior.ensurePredationBag(state, apiWithBag)
    const outcome = chapter.behavior.makePredationTest(state, apiWithBag)
    assert.equal(outcome.effect, 'elderthing')
    assert.equal(outcome.flipped, true)
    assert.equal(chapter.behavior.isEnemyLocation(roomInPlay(state, 'foyer')) === false, true, '门厅不会被翻面（最多调查员最近的地点不是它）')
    assert.ok(state.locations.some(location => chapter.behavior.isEnemyLocation(location)), '至少一处地点翻面')
    assert.deepEqual(state.tokenBags[PREDATION_BAG_ID].revealed, ['elderthing'], '放到一边')
  }
})

test('P7 hemlockHouse 掠食检定取消与印记：基甸法典取消下一次掠食；[tablet] 治愈最近的敌人-地点', () => {
  const api = quietApi()
  const { state } = setup(2, {}, api)
  const apiWithBag = { ...api, tokenBag: tokenBagApi(state, ['cultist']) }
  chapter.behavior.ensurePredationBag(state, apiWithBag)
  const before = state.tokenBags[PREDATION_BAG_ID].tokens.length
  assert.equal(chapter.behavior.cancelNextPredation(state, api), true)
  const outcome = chapter.behavior.makePredationTest(state, apiWithBag)
  assert.equal(outcome.cancelled, true)
  assert.equal(state.tokenBags[PREDATION_BAG_ID].tokens.length, before, '取消时不抽标记')
  assert.equal(state.scenarioFlags.hemlockCancelPredation, undefined, '标记被消耗')
  // [tablet]：治愈最近的敌人-地点（困难/专家按人数）。
  const inv = state.investigators[0]
  const parlor = roomInPlay(state, '10541')
  chapter.behavior.flipToEnemySide(state, parlor, quietApi())
  const enemy = state.enemies.find(item => item.id === parlor.id)
  enemy.damageTaken = 3
  const api2 = quietApi()
  api2.healEnemy = (target, amount) => { target.damageTaken = Math.max(0, target.damageTaken - amount); api2.healed = amount }
  inv.location = 'foyer'
  assert.equal(chapter.behavior.applyTokenEffect(state, inv, { token: 'tablet', mode: 'fail' }, api2), true)
  assert.equal(api2.healed, 1, 'standard 治愈 1 点')
  state.difficulty = 'hard'
  assert.equal(tabletHealAmount(state), 2, 'hard 治愈 1[per_investigator] × 2 人')
  // [cultist]：所在地点是敌人时横置它。
  const api3 = quietApi()
  api3.exhaustEnemy = target => { api3.exhaustedEnemy = target.id }
  inv.location = parlor.id
  assert.equal(chapter.behavior.applyTokenEffect(state, inv, { token: 'cultist', mode: 'always' }, api3), true)
  assert.equal(enemy.exhausted, true)
  assert.equal(api3.exhaustedEnemy, parlor.id)
})

// ---------------------------------------------------------------------------
// 5. 幕 / 议程推进与背面
// ---------------------------------------------------------------------------

test('P7 hemlockHouse 幕 1 目标与背面：7 处封印/胜利区推进；封印较多→地窖 + 庄园之心', () => {
  const api = engineishApi()
  const { state } = setup(2)
  api.state = state
  assert.equal(state.acts[0].objective.type, 'seals')
  assert.equal(state.acts[0].objective.count, 7)
  assert.equal(chapter.behavior.roundEndActIndex, 0, '幕 1 目标在轮末结算')
  const dormant = chapter.behavior.unsealedDormantLocations(state)
  assert.ok(dormant.length >= 7)
  dormant.slice(0, 7).forEach(location => chapter.behavior.placeSeal(state, location.id, null, api))
  assert.equal(chapter.behavior.sealedLocationCount(state), 7)
  assert.equal(chapter.behavior.roundEnded(state, api), true)
  assert.equal(state.acts.length, 1)
  assert.equal(state.acts[0].originalCode, '10531', '进入幕 2a「庄园之心」')
  assert.equal(state.scenarioFlags.hemlockActPath, 'heartOfTheHouse')
  assert.equal(chapter.behavior.cellarInPlay(state), true, '失形地窖入场')
  assert.equal(chapter.behavior.isEnemyLocation(state.locations.find(location => location.id === CELLAR_ID)), true)
  assert.equal(chapter.behavior.floorOf(state, CELLAR_ID), 0, '放在地窖层（中列下方）')
})

test('P7 hemlockHouse 幕 1 背面分支：胜利区敌人-地点多于封印→幕 2a「对抗庄园」', () => {
  const api = engineishApi()
  const { state } = setup(2)
  api.state = state
  // 把 3 个地点翻成敌人-地点并放进胜利展示区（模拟被击败）。
  for (const code of ['10541', '10542', '10543']) {
    const room = roomInPlay(state, code)
    chapter.behavior.flipToEnemySide(state, room, quietApi())
    state.victoryDisplay.push({ id: room.id, code: room.code, originalCode: room.code, victory: 0 })
    state.locations = state.locations.filter(location => location.id !== room.id)
    state.enemies = state.enemies.filter(enemy => enemy.id !== room.id)
  }
  assert.equal(chapter.behavior.enemyLocationsInVictory(state), 3)
  chapter.behavior.placeSeal(state, chapter.behavior.unsealedDormantLocations(state)[0].id, null, api)
  assert.equal(chapter.behavior.sealedLocationCount(state), 1)
  api.advanceAct()
  assert.equal(state.acts[0].originalCode, '10530', '进入幕 2a「对抗庄园」')
  assert.equal(state.scenarioFlags.hemlockActPath, 'againstTheHouse')
  assert.equal(chapter.behavior.cellarInPlay(state), false, '这条路线不放入失形地窖')
  assert.equal(entryStrangeInfestation.flags.setAsideAlternateAct, '10530')
})

test('P7 hemlockHouse 幕与地点限制：无人地点不能发现线索、庄园之心把被敌人-地点攻击者送入地窖', () => {
  const api = quietApi()
  const { state } = setup(2, {}, api)
  const [first] = state.investigators
  // 幕 1a：没有调查员的地点不能发现线索。
  const empty = state.locations.find(location => location.id !== first.location
    && location.id !== state.investigators[1].location)
  assert.equal(chapter.behavior.canDiscoverClues(state, first, empty), false, '无人地点不能发现线索')
  assert.equal(chapter.behavior.canDiscoverClues(state, state.investigators[1],
    state.locations.find(location => location.id === state.investigators[1].location)), true)
  // 幕 2a「庄园之心」：被敌人-地点攻击后移动到失形地窖。
  state.acts = [structuredClone(ACT_STAGES.heartOfTheHouse)]
  state.actIndex = 0
  const flips = chapter.behavior.flipToEnemySide(state, state.locations
    .find(location => chapter.behavior.isDormant(location)), quietApi())
  assert.ok(flips)
  chapter.behavior.placeCellar(state, quietApi())
  const attacker = state.enemies.find(enemy => enemy.enemyLocation && enemy.id === flips.id)
  first.location = 'foyer'
  assert.equal(chapter.behavior.enemyAttackResolved(state, attacker, first, api), true)
  assert.equal(first.location, CELLAR_ID, '被敌人-地点攻击后移动到失形地窖')
  // 幕 2b 已翻面（不再是 2a 正面）时不再强制移动。
  first.location = 'foyer'
  state.acts = [structuredClone(ACT_STAGES.againstTheHouse)]
  state.actIndex = 0
  assert.equal(chapter.behavior.enemyAttackResolved(state, attacker, first, api), false)
  assert.equal(first.location, 'foyer')
})

test('P7 hemlockHouse 幕 2 背面：庄园之心翻回所有敌人-地点 + 每处未封印地点放封印；对抗庄园直接结局 1', () => {
  {
    const api = engineishApi()
    const { state } = setup(2)
    api.state = state
    // 幕 1 背面（封印多于胜利区）→ 幕 2a「庄园之心」并把地窖放入场。
    const sealed = chapter.behavior.unsealedDormantLocations(state).slice(0, 7)
    sealed.forEach(location => { location.sealCount = 1 })
    api.advanceAct()
    assert.equal(state.acts[0].originalCode, '10531')
    state.actIndex = 0
    // 选一处未封印的房间翻面（已封印的地点不能翻）。
    const room = state.locations.find(location => !sealed.includes(location)
      && chapter.behavior.isDormant(location) && location.id !== 'parlor')
    chapter.behavior.flipToEnemySide(state, room, quietApi())
    assert.equal(state.locations.filter(location => chapter.behavior.isEnemyLocation(location)).length, 2,
      '一处房间 + 失形地窖')
    chapter.behavior.actReveal(state, state.acts[0], api)
    const stillEnemy = state.locations.filter(location => chapter.behavior.isEnemyLocation(location))
    assert.deepEqual(stillEnemy.map(location => location.id), [CELLAR_ID],
      '所有可翻面的敌人-地点翻回地点面；失形地窖「cannot be flipped」保持原样')
    assert.equal(api.finished, 'resolution1')
    assert.equal(state.locations.filter(location => (location.sealCount || 0) > 0).length >= 8, true,
      '每处未封印的 [[Dormant]] 地点各获得 1 个封印')
  }
  {
    const api = engineishApi()
    const { state } = setup(2)
    api.state = state
    state.acts = [structuredClone(ACT_STAGES.againstTheHouse)]
    state.actIndex = 0
    chapter.behavior.actReveal(state, state.acts[0], api)
    assert.equal(api.finished, 'resolution1')
  }
  // 对抗庄园的目标：场上没有地点时立即推进（先于「不在任何地点→被击败」）。
  {
    const api = engineishApi()
    const { state } = setup(1)
    api.state = state
    state.acts = [structuredClone(ACT_STAGES.againstTheHouse)]
    state.actIndex = 0
    assert.equal(chapter.behavior.checkObjectives(state, api), false, '还有地点时不推进')
    state.locations = []
    assert.equal(chapter.behavior.checkObjectives(state, api), true)
    assert.equal(api.finished, 'resolution1')
  }
  // 庄园之心的目标：失形地窖进胜利展示区才推进。
  {
    const api = engineishApi()
    const { state } = setup(1)
    api.state = state
    state.acts = [structuredClone(ACT_STAGES.heartOfTheHouse)]
    state.actIndex = 0
    assert.equal(state.acts[0].objective.type, 'cellarVictory')
    assert.equal(chapter.behavior.checkObjectives(state, api), false)
    const cellar = chapter.behavior.placeCellar(state, quietApi())
    cellar.clues = 0
    assert.equal(chapter.behavior.checkObjectives(state, api), true)
    assert.equal(chapter.behavior.cellarInVictory(state), true)
    assert.equal(chapter.behavior.isEnemyLocation(state, cellar), false, '已离开场上')
    assert.equal(api.finished, 'resolution1')
  }
})

test('P7 hemlockHouse 议程 1b/2b/3b：洗入放一边诡计、放掠食袋、翻面地点、Fire! 附属、全员被击败', () => {
  // 议程 1b「活着的庄园」。
  {
    const api = quietApi()
    api.shuffled = []
    api.shuffleIntoEncounterDeck = codes => api.shuffled.push(...codes)
    api.rebuilt = 0
    api.rebuildEncounterDeckFromDiscard = () => { api.rebuilt += 1 }
    const { state } = setup(2, {}, api)
    chapter.behavior.agendaReveal(state, state.agendas[0], api)
    assert.equal(api.shuffled.filter(code => code === OUT_OF_THE_WALLS_CODE).length, 4)
    assert.equal(api.shuffled.filter(code => code === PULLED_IN_CODE).length, 2)
    assert.equal(api.rebuilt, 1, '遭遇弃牌堆洗回牌库')
    assert.equal(chapter.behavior.predationBagInfo(state).exists, true, '建立掠食袋')
    assert.equal(state.storyAssets.some(asset => asset.code === PREDATION_TEST_CODE), true,
      '结算「猎杀之屋」')
    assert.equal(state.locations.some(location => chapter.behavior.isEnemyLocation(location)), true,
      '翻面最近的未封印 [[Dormant]] 地点')
    assert.equal(entryEerieSilence.flags.resolvePredatoryHouseOnBack, true)
  }
  // 议程 2b v.II「风雨大作」：Fire! 附属到最高层最左的地点，其余洗入遭遇牌库。
  {
    const api = quietApi()
    api.attached = []
    api.attachToLocation = (id, fields) => api.attached.push([id, fields.code])
    api.shuffled = []
    api.shuffleIntoEncounterDeck = codes => api.shuffled.push(...codes)
    api.rebuildEncounterDeckFromDiscard = () => 0
    const { state } = setup(2, { day: 2 }, api)
    state.agendaIndex = 1
    chapter.behavior.agendaReveal(state, state.agendas[1], api)
    const highest = chapter.behavior.highestFloorLocations(state)
    assert.equal(api.attached.length, 1)
    assert.equal(api.attached[0][0], highest[0].id, '最高层最左的地点')
    assert.equal(api.attached[0][1], FIRE_CODE)
    assert.equal(api.shuffled.filter(code => code === FIRE_CODE).length, 4, '其余 4 张 Fire! 洗入牌库')
  }
  // 议程 3b「墙壁合拢…」：未撤退的调查员全部被击败，各 1 点精神创伤。
  {
    const api = engineishApi()
    const { state } = setup(2)
    api.state = state
    api.defeated = []
    api.defeat = inv => { api.defeated.push(inv.seat); inv.defeated = true }
    state.agendaIndex = 2
    chapter.behavior.agendaReveal(state, state.agendas[2], api)
    assert.deepEqual(api.defeated.sort(), [0, 1])
    assert.equal(api.trauma.length, 2)
    assert.equal(api.trauma.every(row => row.kind === 'mental' && row.amount === 1), true)
  }
})

test('P7 hemlockHouse 议程 2a/3a 正面：神话阶段结束时进行掠食检定', () => {
  const { state } = setup(2, { day: 2 })
  const api = { ...quietApi(), tokenBag: tokenBagApi(state, ['cultist']) }
  chapter.behavior.ensurePredationBag(state, api)
  const before = state.tokenBags[PREDATION_BAG_ID].tokens.length
  state.agendaIndex = 0
  assert.equal(chapter.behavior.isPredationAgendaStep(state), false, '议程 1a 不强制掠食')
  assert.equal(chapter.behavior.mythosEnded(state, api), false)
  state.agendaIndex = 1
  assert.equal(chapter.behavior.isPredationAgendaStep(state), true)
  assert.equal(chapter.behavior.mythosEnded(state, api), true)
  assert.equal(state.tokenBags[PREDATION_BAG_ID].tokens.length, before - 1, '抽了 1 枚掠食标记')
  // 背面不再强制掠食。
  state.agendas[1].face = 'back'
  assert.equal(chapter.behavior.mythosEnded(state, api), false)
  assert.equal(entryEerieSilence.flags.stage, 1)
  assert.equal(chapter.implementedEntryFlags('10527').forcedPredationAtMythosEnd, true)
  assert.equal(chapter.implementedEntryFlags('10528').backDefeatsInvestigators, true)
})

// ---------------------------------------------------------------------------
// 6. 混乱标记
// ---------------------------------------------------------------------------

test('P7 hemlockHouse 混乱符号：[skull] 按楼层取值，其余三档的数值与失败/成功追加效果', () => {
  const { state } = setup(2)
  const inv = state.investigators[0]
  inv.location = 'foyer'
  assert.equal(chaosFloorOf(state, 'foyer'), 1)
  assert.equal(skullValue(state, inv), 1, '一层：-1（最少 1）')
  inv.location = state.scenarioFlags.hemlockAsideBedroom
  assert.equal(skullValue(state, inv), 4, '四层：-4')
  state.difficulty = 'hard'
  assert.equal(skullValue(state, inv), 8, '困难：两倍楼层')
  inv.location = CELLAR_ID
  assert.equal(skullValue(state, inv), 2, '地窖 0 层 → 困难最少 2')
  state.difficulty = 'standard'
  assert.equal(hemlockHouseChaosTokenValue(state, 'skull', inv), -1)
  assert.equal(hemlockHouseChaosTokenValue(state, 'cultist'), -1)
  assert.equal(hemlockHouseChaosTokenValue(state, 'tablet'), -3)
  assert.equal(hemlockHouseChaosTokenValue(state, 'elderthing'), -4)
  assert.equal(hemlockHouseChaosTokenValue(state, 'frost'), null, '未知标记交回引擎默认表')
  const cultist = hemlockHouseChaosToken(state, inv, 'cultist')
  assert.deepEqual(cultist.onDraw, [{ type: 'scenarioToken', token: 'cultist', mode: 'always' }])
  const tablet = hemlockHouseChaosToken(state, inv, 'tablet')
  assert.deepEqual(tablet.onFail, [{ type: 'scenarioToken', token: 'tablet', mode: 'fail' }])
  state.difficulty = 'expert'
  assert.equal(hemlockHouseChaosTokenValue(state, 'cultist'), -2)
  assert.equal(hemlockHouseChaosTokenValue(state, 'tablet'), -4)
  assert.equal(hemlockHouseChaosTokenValue(state, 'elderthing'), -5)
  assert.deepEqual(hemlockHouseChaosToken(state, inv, 'cultist').onDraw,
    [{ type: 'scenarioToken', token: 'cultist', mode: 'success' }], '困难：检定成功才横置')
  assert.deepEqual(hemlockHouseChaosToken(state, inv, 'elderthing').onDraw,
    [{ type: 'scenarioToken', token: 'elderthing', mode: 'always' }])
  assert.equal(HEMLOCK_TOKEN_MEANINGS.standard.skull.dynamic, 'floor')
  assert.equal(HEMLOCK_TOKEN_MEANINGS.hard.skull.dynamic, 'floorTwice')
  assert.equal(HEMLOCK_TOKEN_MEANINGS.easy.cultist.delta, -1)
  assert.equal(/层数|楼层|floor/.test(SCENARIO_TEXT.tokens.easyStandard.skull), true)
})

test('P7 hemlockHouse 混乱标记追加效果：[elder_thing] 在议程 2a/3a 把标记移入掠食袋', () => {
  const { state } = setup(1)
  const api = quietApi()
  chapter.behavior.ensurePredationBag(state, api)
  const inv = state.investigators[0]
  state.agendaIndex = 0
  assert.equal(chapter.behavior.applyTokenEffect(state, inv, { token: 'elderthing', mode: 'fail' }, api), false,
    '议程 1a 不转移')
  state.agendaIndex = 1
  assert.equal(chapter.behavior.applyTokenEffect(state, inv, { token: 'elderthing', mode: 'fail' }, api), true)
  assert.equal(state.scenarioFlags.hemlockElderThingTransfers, 1)
  const beforeBag = state.tokenBags[PREDATION_BAG_ID].tokens.length
  const removed = chapter.behavior.flushElderThingTransfers(state, api)
  assert.equal(removed, 1)
  assert.equal(state.chaosBag.includes('elderthing'), false, '已从混乱袋移除')
  assert.equal(state.tokenBags[PREDATION_BAG_ID].tokens.length, beforeBag + 1, '已放入掠食袋')
  assert.equal(state.scenarioFlags.hemlockElderThingTransfers, undefined)
})

// ---------------------------------------------------------------------------
// 7. 行动与地点能力
// ---------------------------------------------------------------------------

test('P7 hemlockHouse 行动：封印行动共同支付线索、议程 2a 的 [fast] 翻面、门厅快速移动与盥洗室搬线索', () => {
  const api = quietApi()
  const { state } = setup(2, {}, api)
  const inv = state.investigators[0]
  inv.location = 'diningRoom'
  // 幕 1a：封印行动（1[per_investigator] 线索 / 2 人）。
  inv.clues = 1
  state.investigators[1].location = 'diningRoom'
  state.investigators[1].clues = 1
  const sealMove = chapter.behavior.actions(state, inv).find(move => move.rule === 'hemlockHouseSeal')
  assert.ok(sealMove, '封印行动存在')
  assert.equal(chapter.behavior.performAction(state, inv, sealMove, api), true)
  assert.equal(chapter.behavior.sealCount(state.locations.find(location => location.id === 'diningRoom')), 1)
  assert.equal(inv.clues + state.investigators[1].clues, 0, '两人共同支付 2 个线索')
  // 已封印的地点不再提供封印行动。
  assert.equal(chapter.behavior.actions(state, inv).some(move => move.rule === 'hemlockHouseSeal' && !move.reason), false)
  // 议程 2a：支付线索（或用封印）重整并翻面你所在地点。
  state.agendaIndex = 1
  inv.location = 'parlor'
  inv.clues = 2
  state.investigators[1].clues = 0
  const parlor = state.locations.find(location => location.id === 'parlor')
  const flipMoves = chapter.behavior.actions(state, inv).filter(move => move.rule === 'hemlockHouseAgendaFlip')
  assert.equal(flipMoves.some(move => move.mode === 'clues'), true, '可以支付线索翻面')
  const clueFlip = flipMoves.find(move => move.mode === 'clues')
  assert.ok(clueFlip)
  assert.equal(chapter.behavior.performAction(state, inv, clueFlip, api), true)
  assert.equal(chapter.behavior.isEnemyLocation(parlor), true, '翻到敌人-地点面')
  assert.equal(chapter.behavior.sealCount(parlor), 0)
  // 已封印的地点还可以选择「移除 1 个封印」翻面。
  chapter.behavior.flipToLocationSide(state, parlor, api)
  parlor.sealCount = 1
  inv.clues = 0
  state.investigators[1].clues = 0
  const sealFlip = chapter.behavior.actions(state, inv)
    .find(move => move.rule === 'hemlockHouseAgendaFlip' && move.mode === 'seal')
  assert.ok(sealFlip, '移除封印翻面')
  assert.equal(chapter.behavior.performAction(state, inv, sealFlip, api), true)
  assert.equal(chapter.behavior.isEnemyLocation(parlor), true)
  assert.equal(chapter.behavior.sealCount(parlor), 0, '花费了 1 个封印')
  chapter.behavior.flipToLocationSide(state, parlor, api)
  // 门厅快速移动（每回合一次）。
  state.agendaIndex = 0
  const foyerInv = state.investigators[1]
  foyerInv.location = 'foyer'
  const move = chapter.behavior.actions(state, foyerInv).find(item => item.rule === 'hemlockHouseFoyerMove')
  assert.ok(move)
  assert.equal(chapter.behavior.performAction(state, foyerInv, move, api), true)
  assert.notEqual(foyerInv.location, 'foyer')
  assert.equal(chapter.behavior.actions(state, foyerInv)
    .some(item => item.rule === 'hemlockHouseFoyerMove' && !item.reason), false, '每回合一次')
  // 盥洗室：把 1 个线索移到正下方地点。
  const washroom = state.locations.find(location => ['washroom36', 'washroom37', 'washroom38'].includes(location.id))
  assert.ok(washroom)
  const below = chapter.behavior.locationBelow(state, washroom)
  assert.ok(below, '盥洗室下方有地点')
  washroom.clues = 2
  const belowClues = Number(below.clues) || 0
  foyerInv.location = washroom.id
  const washMove = chapter.behavior.actions(state, foyerInv).find(item => item.rule === 'hemlockHouseWashroomClue')
  assert.ok(washMove)
  assert.equal(chapter.behavior.performAction(state, foyerInv, washMove, api), true)
  assert.equal(washroom.clues, 1)
  assert.equal(below.clues, belowClues + 1)
  assert.equal(chapter.behavior.actions(state, foyerInv)
    .some(item => item.rule === 'hemlockHouseWashroomClue' && !item.reason), false, '每回合一次')
})

test('P7 hemlockHouse 诡计：墙外奇物失败三分支、拖离正道失败移动并按差值攻击', () => {
  const { state } = setup(2)
  const api = quietApi()
  api.harm = (seat, harm) => { api.harmed = { seat, ...harm } }
  api.discardRandom = (seat, n) => { api.discarded = { seat, n } }
  const inv = state.investigators[0]
  // 地点是敌人：1 伤害 1 恐惧。
  const parlor = roomInPlay(state, '10541')
  chapter.behavior.flipToEnemySide(state, parlor, quietApi())
  inv.location = parlor.id
  assert.equal(chapter.behavior.outOfTheWallsFailure(state, { seat: 0 }, api), true)
  assert.deepEqual(api.harmed, { seat: 0, damage: 1, horror: 1 })
  // 已封印：随机弃 1 张。
  chapter.behavior.flipToLocationSide(state, parlor, quietApi())
  parlor.sealCount = 1
  inv.location = parlor.id
  assert.equal(chapter.behavior.outOfTheWallsFailure(state, { seat: 0 }, api), true)
  assert.deepEqual(api.discarded, { seat: 0, n: 1 })
  // 未封印且 [[Dormant]]：翻面。
  parlor.sealCount = 0
  assert.equal(chapter.behavior.outOfTheWallsFailure(state, { seat: 0 }, api), true)
  assert.equal(chapter.behavior.isEnemyLocation(parlor), true)
  // 拖离正道：移动到最近的敌人-地点，失败 4+ 时它攻击你。
  const api2 = quietApi()
  api2.moved = []
  api2.moveInvestigator = (seat, destination) => api2.moved.push([seat, destination])
  api2.attacks = []
  api2.attack = (enemy, target) => api2.attacks.push([enemy.id, target.seat])
  inv.location = 'foyer'
  assert.equal(chapter.behavior.pulledInFailure(state, { seat: 0, failedBy: 4 }, api2), true)
  assert.equal(api2.moved.length, 1)
  assert.equal(chapter.behavior.isEnemyLocation(state.locations.find(location => location.id === api2.moved[0][1])), true)
  assert.equal(api2.attacks.length, 1, '失败 4 点以上：该敌人-地点攻击')
  assert.equal(entryOutOfTheWalls.flags.test.skill, 'agility')
  assert.equal(entryPulledIn.flags.attackOnFailByFour, true)
  // 拖离正道：场上没有敌人-地点时获得涌动（引擎读点 behavior.encounterGainsSurge）。
  {
    const fresh = setup(1).state
    assert.equal(chapter.behavior.encounterGainsSurge(fresh, PULLED_IN_CODE), true, '没有敌人-地点 → 涌动')
    chapter.behavior.flipToEnemySide(fresh, roomInPlay(fresh, '10541'), quietApi())
    assert.equal(chapter.behavior.encounterGainsSurge(fresh, PULLED_IN_CODE), false, '有敌人-地点 → 不涌动')
    assert.equal(chapter.behavior.encounterGainsSurge(fresh, OUT_OF_THE_WALLS_CODE), false)
  }
})

// ---------------------------------------------------------------------------
// 8. 结局与记录、法典、JSON 往返
// ---------------------------------------------------------------------------

test('P7 hemlockHouse 结局与记录：No Resolution / 结局 1 都进入结局 2，写封印/敌人-地点/奖励经验', () => {
  // 结局 2：封印 8+（+2 经验）、胜利区敌人-地点 8+（+2 经验）、勾选 Hemlock Harbor。
  {
    const api = engineishApi()
    const { state } = setup(2)
    api.state = state
    chapter.behavior.unsealedDormantLocations(state).slice(0, 8).forEach(location => { location.sealCount = 1 })
    for (let index = 0; index < 8; index += 1) {
      state.victoryDisplay.push({ id: `victory-${index}`, code: '10541b', originalCode: '10541b', victory: 0 })
    }
    state.scenarioFlags.hemlockPredationBagActive = true
    chapter.behavior.ensurePredationBag(state, api)
    state.tokenBags[PREDATION_BAG_ID].tokens.push('elderthing', 'elderthing')
    const result = chapter.behavior.resolution(state, 'noResolution', [], api)
    const records = state.campaign.records
    assert.equal(records[RECORD_KEYS.resolution], 'resolution2', 'No Resolution → 跳过到结局 2')
    assert.equal(records.hemlockHouseResolutionEntry, 'noResolution')
    assert.equal(records.hemlockHouseSeals, 8)
    assert.equal(records.hemlockHouseEnemyLocations, 8)
    assert.equal(result.bonus, 2, '封印 8+ 与敌人-地点 8+ 各 +1')
    assert.equal(records[RECORD_KEYS.areasSurveyed][AREAS_SURVEYED_HEMLOCK_HARBOR], true)
    assert.equal(records.hemlockHarborSurveyed, true)
    assert.equal(state.tokenBags[PREDATION_BAG_ID].tokens.filter(token => token === 'elderthing').length <= 1, true,
      '掠食袋里的 [elder_thing] 只保留 1 枚（其余回到混乱袋）')
    assert.equal(state.chaosBag.filter(token => token === 'elderthing').length >= 1, true)
  }
  // 结局 1 → 同样进入结局 2，但不满足封印/敌人-地点阈值时奖励 0。
  {
    const api = engineishApi()
    const { state } = setup(1)
    api.state = state
    const result = chapter.behavior.resolution(state, 'resolution1', [], api)
    assert.equal(state.campaign.records[RECORD_KEYS.resolution], 'resolution2')
    assert.equal(state.campaign.records.hemlockHouseResolutionEntry, 'resolution1')
    assert.equal(result.bonus, 0)
    assert.equal(state.campaign.records[RECORD_KEYS.areasSurveyed][AREAS_SURVEYED_HEMLOCK_HARBOR], true)
  }
  // 「找到小西尔维」写入记录（Resolution 2 的牌组奖励读点）。
  {
    const api = engineishApi()
    const { state } = setup(1)
    api.state = state
    chapter.behavior.remember(state, 'foundLittleSylvie', api)
    assert.equal(state.storyAssets.some(asset => asset.code === LITTLE_SYLVIE_CODE), true)
    chapter.behavior.resolution(state, 'resolution2', [], api)
    assert.equal(state.campaign.records[RECORD_KEYS.foundLittleSylvie], true)
    assert.equal(state.campaign.records.hemlockHouseLittleSylvie, true)
    assert.equal(entrySylvie.flags.foundByRecord, 'foundLittleSylvie')
  }
})

test('P7 hemlockHouse 居民与法典：白天按日入场、基甸法典取消掠食、威廉/朱迪斯争论移出游戏', () => {
  // 布置：Day 1 白天 → 基甸 + 威廉 + 小西尔维；夜晚 → 无居民。
  {
    const { state } = setup(1, { day: 1 })
    const codes = state.storyAssets.map(asset => asset.code)
    assert.equal(codes.includes(RESIDENT_SETUP.gideon.code), true)
    assert.equal(codes.includes(RESIDENT_SETUP.william.code), true)
    assert.equal(codes.includes(LITTLE_SYLVIE_CODE), true)
    assert.equal(codes.includes(RESIDENT_SETUP.judith.code), false, 'Day 1 没有朱迪斯')
    const sylvie = state.storyAssets.find(asset => asset.code === LITTLE_SYLVIE_CODE)
    assert.equal(BEDROOM_IDS.includes(sylvie.location), true, '小西尔维放在一间卧室')
    const floors = state.locations.filter(location => BEDROOM_IDS.includes(location.id))
      .map(location => chapter.behavior.floorOf(state, location.id))
    assert.equal(chapter.behavior.floorOf(state, sylvie.location), Math.min(...floors), '最底层卧室')
    const william = state.storyAssets.find(asset => asset.code === RESIDENT_SETUP.william.code)
    assert.equal(chapter.behavior.floorOf(state, william.location), 4, '威廉在四层卧室')
    // 当日不入场的居民放一边（out of play）。
    for (const code of [RESIDENT_SETUP.judith.code, RESIDENT_SETUP.theo.code]) {
      assert.equal(state.scenarioZones.setAside.includes(code), true, `放一边：${code}`)
    }
    for (const code of [RESIDENT_SETUP.gideon.code, RESIDENT_SETUP.william.code, LITTLE_SYLVIE_CODE]) {
      assert.equal(state.scenarioZones.setAside.includes(code), false, `已入场，不在放一边：${code}`)
    }
  }
  {
    const { state } = setup(2, { day: 2, night: true })
    assert.equal(state.storyAssets.length, 0, '夜晚不收集居民')
    for (const code of [...Object.values(RESIDENT_SETUP).map(spec => spec.code), LITTLE_SYLVIE_CODE]) {
      assert.equal(state.scenarioZones.setAside.includes(code), true, `夜晚整组放一边：${code}`)
    }
  }
  // 法典：基甸「否则」→ 记住在帮他 + 取消下一次掠食。
  {
    const api = quietApi()
    const { state } = setup(1, { day: 1 }, api)
    assert.equal(chapter.behavior.codexAvailable(state, 'gideon'), true)
    const result = chapter.behavior.resolveCodexEntry(state, 'gideon', 0, api)
    assert.equal(result.branch, 'otherwise')
    assert.equal(chapter.behavior.isRemembered(state, 'youAreHelpingGideon'), true)
    assert.equal(state.scenarioFlags.hemlockCancelPredation, true)
    assert.equal(chapter.behavior.resolveCodexEntry(state, 'gideon', 0, api).branch, 'helping')
    assert.equal(chapter.behavior.residentLevel(state, 'gideon'), 1)
  }
  // 法典：威廉 Day 1 找到小西尔维 → 取得控制 + 关系 +1。
  {
    const api = quietApi()
    const { state } = setup(2, { day: 1 }, api)
    chapter.behavior.remember(state, 'foundLittleSylvie', api)
    const result = chapter.behavior.resolveCodexEntry(state, 'william', 0, api)
    assert.equal(result.branch, 'day1FoundSylvie')
    assert.equal(result.controlled, RESIDENT_SETUP.william.code)
    assert.equal(chapter.behavior.residentLevel(state, 'william'), 1)
    const william = state.storyAssets.find(asset => asset.code === RESIDENT_SETUP.william.code)
    assert.equal(william.controllerSeat, 0)
  }
  // 法典 Σ 争论：站朱迪斯 → 威廉移出游戏、朱迪斯关系 +1；站威廉则相反。
  {
    const api = quietApi()
    api.choose = () => 'judithRight'
    const { state } = setup(2, { day: 2 }, api)
    assert.deepEqual([...CODEX_ENTRY_IDS].includes('argument'), true)
    const result = chapter.behavior.resolveCodexEntry(state, 'argument', 0, api)
    assert.equal(result.branch, 'argument2')
    assert.equal(state.storyAssets.some(asset => asset.code === RESIDENT_SETUP.william.code), false)
    assert.equal(chapter.behavior.residentLevel(state, 'judith'), 1)
  }
})

test('P7 hemlockHouse JSON 往返：存储后继续翻面、掠食检定与结局记录', () => {
  const api = engineishApi()
  const { state } = setup(2, { day: 2 })
  api.state = state
  const parlor = roomInPlay(state, '10541')
  chapter.behavior.flipToEnemySide(state, parlor, quietApi())
  chapter.behavior.ensurePredationBag(state, api)
  const restored = clone(state)
  assert.equal(restored.scenario.id, 'hemlockHouse')
  assert.equal(chapter.behavior.isEnemyLocation(restored.locations.find(location => location.id === 'parlor')), true)
  assert.equal(restored.enemies.some(enemy => enemy.enemyLocation && enemy.id === 'parlor'), true)
  assert.equal(chapter.behavior.cellOf(restored, 'parlor').y, 0, '网格坐标存活')
  assert.equal(chapter.behavior.floorOf(restored, restored.scenarioFlags.hemlockAsideBedroom), 4)
  assert.equal(restored.tokenBags[PREDATION_BAG_ID].tokens.length, predationBagTokens(2).length)
  const api2 = { ...quietApi(), tokenBag: tokenBagApi(restored, ['tablet']) }
  const outcome = chapter.behavior.makePredationTest(restored, api2)
  assert.equal(outcome.effect, 'tablet')
  const again = clone(restored)
  const api3 = engineishApi()
  chapter.behavior.resolution(again, 'resolution2', [], api3)
  assert.equal(again.campaign.records[RECORD_KEYS.resolution], 'resolution2')
  assert.equal(typeof again.campaign.records.hemlockHouseSeals, 'number')
})
