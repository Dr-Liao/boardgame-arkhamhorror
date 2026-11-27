// P7 深沼之物（theThingInTheDepths · 提示卡 10588）章节测试。
//
// 覆盖：章节结构/23 张单卡条目、独立遭遇牌库（4 个固定组 + 当日组）与放一边、
// 3×3 网格布置与地点连接（参考摆法 + 洗牌后运行时重算）、渗坑下沉（3 个渗坑翻面/保留线索与遭遇附属）、
// 幕/议程正反面与目标、撤退、混乱符号四档与追加效果、两种诡计显现、地点规则与行动、
// 敌人（深沼之物/鳄龟混种/攫噬触须）、引入分支与居民、结局 1–5/无结局与剧本记录、法典与 JSON 往返。
//
// 本文件不 import engine.js：章节 behavior 只走内容层函数与轻量 api 桩（真实引擎钩子由 P7 主进程合并后
// 用 contentRegistry 注册）；地点翻面用与 src/engine/location-face.js#sinkLocation 同口径的桩实现。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import * as chapter from '../content/campaigns/theFeastOfHemlockVale/scenarios/theThingInTheDepths/index.js'
import {
  CARD_CODES, LOCATION_IDS, LOCATIONS, LOCATION_CONNECTIONS, LOCATION_COORDINATES, LOCATION_TABLE,
  OPEN_WATER_FACES, OPEN_WATER_CODE_BY_LOCATION, GRID_SLOTS, SLOT_IDS, SLOT_LABELS, GRID_ADJACENCY,
  DEFAULT_SLOT_ASSIGNMENT, DEFAULT_REMOVED_LOCATION, START_LOCATION, NORTH_SHORE_LOCATION,
  CRANBERRY_BOG_LOCATION, CENTER_LOCATION, START_SLOT, CENTER_SLOT, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES,
  GATHER_GROUPS, EXTERNAL_GATHER_GROUPS, DAY_ENCOUNTER_GROUPS, dayEncounterDeck, SET_ASIDE_CARDS,
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, RECORD_KEYS, RECORD_READS, RECORD_WRITES,
  RESIDENT_CODES, RESIDENT_RECORDS, SCENARIO_TEXT, THING_IN_THE_DEPTHS_CODE, CHELYDRAN_HYBRID_CODE,
  GRASPING_TENDRIL_CODE, STORY_CODES, DAY_STORY_CODES, connectionsForAssignment,
} from '../content/campaigns/theFeastOfHemlockVale/scenarios/theThingInTheDepths/definition.js'
import {
  THE_THING_IN_THE_DEPTHS_TOKEN_MEANINGS, thingInTheDepthsChaosToken, thingInTheDepthsChaosTokenValue,
  sunkenLocationCount, skullValue, isHardSide,
} from '../content/campaigns/theFeastOfHemlockVale/scenarios/theThingInTheDepths/chaos.js'

// ---------------------------------------------------------------------------
// 单卡条目注册（23 张；主进程会统一注册，这里按目录动态载入以便并行 worker 独立跑）
// ---------------------------------------------------------------------------
const ENTRIES = []
for (const code of CARD_CODES) {
  const module = await import(`../src/cards/encounter-entries/theFeastOfHemlockVale/theThingInTheDepths/${code}.js`)
  ENTRIES.push(module.default)
}
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

const CLONE = value => JSON.parse(JSON.stringify(value))
const ALLY_CODE = Object.keys(ALL_CARDS).find(code => (ALL_CARDS[code].slots || [])
  .some(slot => String(slot).toLowerCase() === 'ally')) || '01020'

const stateFor = (investigatorCount = 1, records = {}, flags = {}) => ({
  investigators: Array.from({ length: investigatorCount }, (_, seat) => ({
    seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, actions: 3, resources: 5,
    assets: [], engaged: [], deck: [], discard: [], threat: [], physicalTrauma: 0,
  })),
  locations: [], enemies: [], storyAssets: [], encounterDeck: [], encounterDiscard: [],
  scenarioFlags: { ...flags }, scenarioZones: {},
  campaign: { leadSeat: 0, records: { ...records }, completedSteps: [], trauma: {}, investigators: {} },
  victoryDisplay: [], doom: 0, difficulty: 'standard', numInvestigators: investigatorCount,
  phase: 'investigation', round: 1, status: 'playing',
})

function makeApi(state, overrides = {}) {
  const log = { info: [], finished: [], trauma: [], drawn: [], tests: [], moved: [] }
  const api = {
    info: text => log.info.push(text),
    random: () => 0,
    shuffle: list => [...list],
    choose: request => (request?.options || []).find(option => option.id !== 'skip')?.id ?? null,
    finish: key => log.finished.push(key),
    advanceAct: () => { log.advances = (log.advances || 0) + 1 },
    advanceAgenda: () => { log.advanceAgendas = (log.advanceAgendas || 0) + 1 },
    addTrauma: (seat, kind, amount) => log.trauma.push({ seat, kind, amount }),
    defeatInvestigator: seat => {
      const inv = state.investigators[seat]
      if (inv) inv.defeated = true
      log.defeated = (log.defeated || 0) + 1
    },
    damage: (seat, amount) => { state.investigators[seat].damage = (Number(state.investigators[seat].damage) || 0) + amount },
    directDamage: (seat, amount) => api.damage(seat, amount),
    damageAsset: (seat, assetId, amount) => {
      const asset = state.investigators[seat].assets.find(item => item.id === assetId)
      if (asset) asset.damage = (Number(asset.damage) || 0) + amount
    },
    spendClues: (seat, amount) => { state.investigators[seat].clues -= amount },
    payGroupClues: (amount, options = {}) => {
      let left = amount
      for (const inv of state.investigators) {
        if (options.atLocation && inv.location !== options.atLocation) continue
        const pay = Math.min(Number(inv.clues) || 0, left)
        inv.clues -= pay
        left -= pay
        if (left <= 0) break
      }
      log.groupClues = { amount, left, atLocation: options.atLocation }
      return amount - left
    },
    loseActions: (seat, amount) => { state.investigators[seat].actions -= amount },
    moveInvestigator: (seat, destination) => { state.investigators[seat].location = destination; log.moved.push(destination) },
    moveEnemy: (enemy, destination) => { enemy.location = destination; log.moved.push(destination) },
    damageEnemy: (enemyId, amount) => {
      const enemy = state.enemies.find(item => item.id === enemyId)
      if (enemy) enemy.damageTaken = (Number(enemy.damageTaken) || 0) + amount
    },
    defeatEnemy: enemy => { enemy.defeated = true },
    spawn: () => null,
    drawEncounter: seat => {
      const code = state.encounterDeck.pop() ?? null
      log.drawn.push({ seat, code })
      return code
    },
    takeEncounterCard: code => {
      const deck = state.encounterDeck.lastIndexOf(code)
      if (deck >= 0) { state.encounterDeck.splice(deck, 1); return { pile: 'encounterDeck' } }
      const discard = state.encounterDiscard.lastIndexOf(code)
      if (discard >= 0) { state.encounterDiscard.splice(discard, 1); return { pile: 'encounterDiscard' } }
      return null
    },
    shuffleIntoEncounterDeck: codes => { state.encounterDeck.push(...codes); log.shuffledIn = (log.shuffledIn || 0) + 1 },
    shuffleDiscard: () => { state.encounterDeck.push(...state.encounterDiscard); state.encounterDiscard = [] },
    test: (seat, skill, difficulty, resolve) => {
      log.tests.push({ seat, skill, difficulty })
      resolve({ success: true, difficulty, value: difficulty })
    },
    sinkLocation: (id, face, threshold = 3) => {
      const location = state.locations.find(item => item.id === id)
      if (!location || (Number(location.damage) || 0) < threshold
        || (location.originalCode || location.code) === face.code) return false
      for (const attachment of (location.attachments || []).filter(card => card.ownerSeat != null && !card.encounterAttached)) {
        state.investigators[attachment.ownerSeat]?.discard.push(attachment.code)
      }
      location.attachments = (location.attachments || []).filter(card => card.ownerSeat == null || card.encounterAttached)
      Object.assign(location, {
        code: face.code, originalCode: face.code, name: face.name, nameEn: face.nameEn,
        shroud: face.shroud, traits: [...face.traits], ...(face.victory != null ? { victory: face.victory } : {}),
      })
      location.damage = 0
      return true
    },
    storyAsset: (code, locationId) => {
      state.storyAssets ||= []
      if (state.storyAssets.some(asset => asset.code === code)) return null
      const def = ALL_CARDS[code] || {}
      const asset = { id: `story-${code}`, code, originalCode: code, name: def.nameZh || def.name || code,
        location: locationId ?? null, controllerSeat: null, exhausted: false, tokens: 0 }
      state.storyAssets.push(asset)
      return asset
    },
    setCampaignRecord: (key, value) => {
      state.campaign.records[key] = value
      return value
    },
    mechanics: {
      calendar: { set: (day, period) => { state.campaign.records.hemlockDate = `${day}:${period}` } },
      residents: {
        change: (spec, delta) => {
          const records = state.campaign.records
          const next = Math.max(0, Math.min(spec.max, (Number(records[spec.level]) || 0) + delta))
          records[spec.level] = next
          return next
        },
        status: spec => ({ level: Number(state.campaign.records[spec.level]) || 0, crossedOut: false, notes: [] }),
      },
      recordSets: {
        add: (key, value) => {
          const records = state.campaign.records
          const list = Array.isArray(records[key]) ? records[key] : []
          if (!list.includes(value)) list.push(value)
          records[key] = list
          return true
        },
      },
    },
    ...overrides,
  }
  api.log = log
  return api
}

const setup = (count = 1, { date = '1:day', records = {}, overrides = {} } = {}) => {
  const state = stateFor(count, { hemlockDate: date, ...records })
  state.scenario = structuredClone(chapter.scenario)
  const api = makeApi(state, overrides)
  const report = chapter.behavior.setupScenario(state, api)
  return { state, api, report }
}

const locationOf = (state, id) => state.locations.find(location => location.id === id)
const slotId = (state, slot) => state.scenarioFlags.depthsSlots[slot]
const sinkAt = (state, api, id, damage = 3) => {
  const location = locationOf(state, id)
  location.damage = damage
  return chapter.behavior.sinkLocationsAtThreshold(state, api)
}

// ---------------------------------------------------------------------------
// 1. 章节结构
// ---------------------------------------------------------------------------
test('P7 theThingInTheDepths 章节结构：23 张单卡条目、10 个双面地点、6 个结局与 manifest', () => {
  assert.equal(chapter.scenario.id, 'theThingInTheDepths')
  assert.equal(chapter.scenario.originalCode, '10588')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.campaignId, 'theFeastOfHemlockVale')
  assert.equal(chapter.manifest.behaviorIds[0], 'theThingInTheDepths')
  assert.equal(CARD_CODES.length, 23)
  assert.equal(new Set(CARD_CODES).size, 23, '卡号不重复')
  assert.equal(ENTRIES.length, 23)
  assert.deepEqual(ENTRIES.map(entry => entry.code).sort(), [...CARD_CODES].sort())
  for (const entry of ENTRIES) {
    assert.equal(entry.implemented, true, `${entry.code} implemented`)
    assert.equal(registeredEntry(entry.code)?.code, entry.code, `${entry.code} 注册`)
    assert.ok(['act', 'agenda', 'enemy', 'treachery', 'location'].includes(entry.scope), `${entry.code} scope`)
  }
  // 10 张物理地点卡、7 种 Bog 面、7 种沉没面
  assert.equal(Object.keys(LOCATIONS).length, 10)
  assert.equal(LOCATION_IDS.length, 10)
  assert.equal(new Set(LOCATION_TABLE.map(([, bog]) => bog)).size, 7)
  assert.equal(Object.keys(OPEN_WATER_FACES).length, 7)
  assert.equal(OPEN_WATER_CODE_BY_LOCATION.muddyFen1, '10593b')
  assert.equal(ACT_CODES.length, 2)
  assert.equal(AGENDA_CODES.length, 2)
  // 剧情卡：3 位居民 + 3 张「第 N 日」时间标记
  assert.equal(STORY_CODES.length, 6)
  assert.equal(Object.keys(chapter.scenario.storyAssets).length, 6)
  assert.equal(chapter.scenario.storyAssets[RESIDENT_CODES.judithPark].code, RESIDENT_CODES.judithPark)
  assert.equal(chapter.scenario.storyAssets[DAY_STORY_CODES[1]].global, true)
  assert.equal(Object.keys(chapter.scenario.resolutions).length, 6)
  assert.deepEqual(Object.keys(chapter.scenario.resolutions),
    ['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4', 'resolution5'])
  // 指南正文（story-text 英文叶子投影）
  assert.match(SCENARIO_TEXT.intro.title, /深沼之物|The Thing in the Depths/)
  assert.match(SCENARIO_TEXT.setup.locations, /3×3|3x3/i)
  assert.equal(SCENARIO_TEXT.specialRules.length, 1)
  assert.match(SCENARIO_TEXT.specialRules[0].title, /下沉地点|Sinking Locations/i)
  assert.match(SCENARIO_TEXT.specialRules[0].body, /渗坑|sinkhole/i)
  assert.equal(SCENARIO_TEXT.setup.setAsideEnemies.length > 0, true)
  assert.match(SCENARIO_TEXT.resolutions.resolution4, /结局 4|Resolution 4/)
  assert.match(SCENARIO_TEXT.resolutions.resolution5, /东威克沼|Eastwick Bog/)
  assert.equal(chapter.layout.locations[START_LOCATION].x, -1, '参考摆法起始槽位 (-1,-1)')
  // 条目规则数据
  assert.equal(chapter.implementedEntryFlags('10600').healthBonusPerInvestigator, 5)
  assert.equal(chapter.implementedEntryFlags('10601').patrol, 'nearestEmptyLocation')
  assert.deepEqual(registeredEntry('10601').enemyRule.patrolTarget, { kind: 'nearestEmpty' })
  assert.equal(chapter.implementedEntryFlags('10602').healthEqualsDayNumber, true)
  assert.equal(chapter.implementedEntryFlags('10593a').printedShroud, 4)
  assert.equal(chapter.implementedEntryFlags('10599b').printedVictory, 1)
  assert.equal(chapter.implementedEntryFlags('10603').test.difficulty, 4)
  assert.equal(chapter.implementedEntryFlags('10589').doomThreshold, 3)
  assert.equal(chapter.implementedEntryFlags('10590').doomThreshold, 10)
})

// ---------------------------------------------------------------------------
// 2. 独立遭遇牌库
// ---------------------------------------------------------------------------
test('P7 theThingInTheDepths 独立牌库：4 个固定组 26 张、当日组运行时洗入、放一边 7 张', () => {
  assert.deepEqual([...GATHER_GROUPS], ['the_thing_in_the_depths', 'blight', 'the_forest', 'mutations'])
  assert.deepEqual([...EXTERNAL_GATHER_GROUPS], ['blight', 'the_forest', 'mutations'])
  assert.equal(ENCOUNTER_DECK.length, 26)
  assert.equal(ENCOUNTER_DECK.filter(code => code === '10603').length, 3, '地层扰动 ×3')
  assert.equal(ENCOUNTER_DECK.filter(code => code === '10604').length, 4, '泥泞下沉 ×4')
  for (const code of SET_ASIDE_CARDS) assert.equal(ENCOUNTER_DECK.includes(code), false, `放一边的卡不进牌库：${code}`)
  // 其它 gather 组（共享组）也在固定牌库里
  assert.equal(ENCOUNTER_DECK.includes('10728'), true, 'Blight')
  assert.equal(ENCOUNTER_DECK.includes('10732'), true, 'The Forest')
  assert.equal(ENCOUNTER_DECK.includes('10741'), true, 'Mutations')
  // 放一边：深沼之物 + 鳄龟混种 + 攫噬触须 ×5
  assert.equal(SET_ASIDE_CARDS.length, 7)
  assert.equal(SET_ASIDE_CARDS.filter(code => code === GRASPING_TENDRIL_CODE).length, 5)
  assert.deepEqual(chapter.manifest.zones.setAside, [
    { cardCode: '10600', count: 1 }, { cardCode: '10601', count: 1 }, { cardCode: '10602', count: 5 },
  ])
  assert.equal(chapter.manifest.zones.encounterDeck.find(entry => entry.cardCode === '10603').count, 3)
  // 当日组
  assert.deepEqual(DAY_ENCOUNTER_GROUPS, { 1: 'the_first_day', 2: 'the_second_day', 3: 'the_final_day' })
  assert.deepEqual(dayEncounterDeck(1), ['10676', '10676', '10676'])
  assert.deepEqual(dayEncounterDeck(2), ['10678', '10678', '10678'])
  assert.deepEqual(dayEncounterDeck(3), ['10680', '10680', '10680'])
  const first = setup(1, { date: '1:day' })
  assert.equal(first.state.encounterDeck.length, 29, '26 张固定组 + 3 张当日组')
  assert.equal(first.state.encounterDeck.filter(code => code === '10676').length, 3)
  const third = setup(1, { date: '3:day' })
  assert.equal(third.state.encounterDeck.filter(code => code === '10680').length, 3)
  assert.equal(third.state.encounterDeck.includes('10676'), false, '其它日子的组不进牌库')
  // 牌库里的敌人/诡计都来自本章目录
  for (const code of ENCOUNTER_DECK_CODES) assert.ok(ALL_CARDS[code], `目录里有 ${code}`)
})

// ---------------------------------------------------------------------------
// 3. 地点连接（参考摆法）
// ---------------------------------------------------------------------------
test('P7 theThingInTheDepths 地点连接：参考摆法 3×3 正交邻接、双向对称、双面身份', () => {
  assert.equal(GRID_SLOTS.length, 9)
  assert.equal(SLOT_IDS.length, 9)
  assert.deepEqual(SLOT_LABELS, { northShore: '北岸', startingLocation: '起始地点', cranberryBog: '蔓越莓沼' })
  assert.equal(GRID_ADJACENCY.center.length, 4)
  assert.equal(GRID_ADJACENCY.northWest.length, 2, '角格 2 个相邻')
  assert.equal(START_LOCATION, DEFAULT_SLOT_ASSIGNMENT[START_SLOT])
  assert.equal(NORTH_SHORE_LOCATION, DEFAULT_SLOT_ASSIGNMENT.northShore)
  assert.equal(CRANBERRY_BOG_LOCATION, DEFAULT_SLOT_ASSIGNMENT.cranberryBog)
  assert.equal(CENTER_LOCATION, DEFAULT_SLOT_ASSIGNMENT.center)
  assert.equal(DEFAULT_REMOVED_LOCATION, 'coveredBridge', '参考摆法默认移出廊桥')
  assert.equal(LOCATION_CONNECTIONS.coveredBridge, undefined, '被移出的地点不在参考摆法里')
  assert.deepEqual([...LOCATION_CONNECTIONS[DEFAULT_SLOT_ASSIGNMENT.northWest]].sort(),
    [DEFAULT_SLOT_ASSIGNMENT.north, DEFAULT_SLOT_ASSIGNMENT.west].sort())
  assert.deepEqual([...LOCATION_CONNECTIONS[CENTER_LOCATION]].sort(), [
    DEFAULT_SLOT_ASSIGNMENT.north, DEFAULT_SLOT_ASSIGNMENT.west,
    DEFAULT_SLOT_ASSIGNMENT.east, DEFAULT_SLOT_ASSIGNMENT.south,
  ].sort())
  for (const [id, neighbors] of Object.entries(LOCATION_CONNECTIONS)) {
    for (const neighbor of neighbors) {
      assert.equal(LOCATION_CONNECTIONS[neighbor].includes(id), true, `${id} ↔ ${neighbor} 对称`)
    }
  }
  // 坐标 = 槽位坐标，桌面 layout 与之同源
  assert.deepEqual(LOCATION_COORDINATES[START_LOCATION], { x: -1, y: -1 })
  assert.deepEqual(LOCATION_COORDINATES[NORTH_SHORE_LOCATION], { x: 1, y: 1 })
  assert.deepEqual(chapter.layout.locations[CRANBERRY_BOG_LOCATION], { x: 1, y: -1 })
  assert.equal(Object.keys(chapter.layout.locations).length, 9)
  // manifest 双面身份：正面 Bog、背面 Open Water
  const fen = chapter.manifest.locations.find(entry => entry.id === 'muddyFen1')
  assert.equal(fen.frontCode, '10593a')
  assert.equal(fen.backCode, '10593b')
  const bridge = chapter.manifest.locations.find(entry => entry.id === 'coveredBridge')
  assert.equal(bridge.frontCode, '10599a')
  assert.equal(bridge.backCode, '10599b')
  // 槽位邻接 → 地点 id 连接的纯函数
  assert.deepEqual(connectionsForAssignment(DEFAULT_SLOT_ASSIGNMENT), { ...LOCATION_CONNECTIONS })
})

// ---------------------------------------------------------------------------
// 4. 洗牌布置
// ---------------------------------------------------------------------------
test('P7 theThingInTheDepths 网格布置：10 张洗混随机移出 1 张、9 张按槽位入场、起始地点/北岸运行时改写', () => {
  const { state, report } = setup(2)
  // 确定性 api：shuffle 恒等 + random 0 → 移出第一张（muddyFen1），其余顺序入槽
  assert.equal(report.removed, 'muddyFen1')
  assert.equal(report.placedIds.length, 9)
  assert.deepEqual(state.scenarioFlags.depthsSlots, {
    northWest: 'muddyFen2', north: 'tangledThicket', northShore: 'fetidPool1',
    west: 'fetidPool2', center: 'floodedPath1', east: 'floodedPath2',
    startingLocation: 'abandonedShack', south: 'rottenDock', cranberryBog: 'coveredBridge',
  })
  assert.equal(state.locations.length, 9)
  assert.equal(state.locations.some(location => location.id === 'muddyFen1'), false, '移出的地点不在场')
  assert.equal(state.locations.every(location => location.revealed === true), true, '入场即 Bog 面朝上')
  assert.equal(state.investigators.every(inv => inv.location === 'abandonedShack'), true, '调查员在起始地点')
  assert.equal(chapter.behavior.startLocation(state), 'abandonedShack')
  // 运行时连接 = 实际槽位的网格邻接
  for (const [slot, id] of Object.entries(state.scenarioFlags.depthsSlots)) {
    const expected = GRID_ADJACENCY[slot].map(neighbor => state.scenarioFlags.depthsSlots[neighbor]).sort()
    assert.deepEqual([...locationOf(state, id).connections].sort(), expected, `${slot} 连接`)
    assert.deepEqual([...state.scenario.locations[id].connections].sort(), expected, `${slot} 定义表连接`)
  }
  // 线索：Bog 面每调查员印刷值
  assert.equal(locationOf(state, 'muddyFen2').clues, 4, '泥淖沼泽 2/人 × 2 人')
  assert.equal(locationOf(state, 'tangledThicket').clues, 2)
  assert.equal(locationOf(state, 'floodedPath1').clues, 0)
  // 幕 1 目标地点指向实际北岸
  assert.equal(state.acts[0].objective.atLocation, 'fetidPool1')
  // 随机移出：换一个随机值 → 移出的地点变化
  const second = stateFor(2)
  second.scenario = structuredClone(chapter.scenario)
  const plan = chapter.behavior.planLocations(second, { shuffle: list => [...list].reverse(), random: () => 0.99 })
  assert.equal(plan.removed, 'muddyFen1', 'reverse 后最后一个仍是 muddyFen1')
  assert.equal(plan.assignment.northWest, 'coveredBridge')
  assert.equal(plan.startLocation, plan.assignment.startingLocation)
  const third = chapter.behavior.planLocations(second, { shuffle: list => [...list], random: () => 0.5 })
  assert.equal(third.removed, LOCATION_IDS[5], 'floor(0.5×10)=5')
})

// ---------------------------------------------------------------------------
// 5. 渗坑下沉
// ---------------------------------------------------------------------------
test('P7 theThingInTheDepths 渗坑下沉：回合结束放渗坑（1–2 人 2 个）、3 个渗坑翻面并保留线索/遭遇附属', () => {
  const { state, api } = setup(2)
  const inv = state.investigators[0]
  inv.location = 'muddyFen2'
  const fen = locationOf(state, 'muddyFen2')
  fen.clues = 4
  fen.maxClues = 4
  fen.attachments = [{ code: '01165', encounterAttached: true }, { code: '01088', ownerSeat: 0 }]
  assert.equal(chapter.behavior.turnEnded(state, inv, api), true, '回合结束在沼地 → 放渗坑')
  assert.equal(fen.damage, 2, '2 名调查员 → 2 个渗坑')
  assert.equal(fen.code, '10593a', '未达阈值不翻面')
  // 第二次回合结束 → 4 个渗坑 ≥ 3 → 翻面
  assert.equal(chapter.behavior.turnEnded(state, inv, api), true)
  assert.equal(fen.code, '10593b')
  assert.equal(fen.originalCode, '10593b')
  assert.deepEqual(fen.traits, ['Sunken'])
  assert.equal(fen.damage, 0, '翻面弃掉全部渗坑')
  assert.equal(fen.clues, 4, '线索保留')
  assert.equal(fen.shroud, 5, '沉没面帷幕 5')
  assert.equal(fen.victory, 1, '沉没面胜利 1')
  assert.deepEqual(fen.attachments.map(card => card.code), ['01165'], '遭遇附属保留、玩家附属 discard')
  assert.equal(inv.discard.includes('01088'), true)
  // 沉没地点不再是[[沼地]]：回合结束不再放渗坑
  assert.equal(chapter.behavior.turnEnded(state, inv, api), false)
  assert.equal(sunkenLocationCount(state), 1)
  // 4 人局：每次只放 1 个渗坑
  const four = setup(4)
  four.state.investigators[0].location = 'tangledThicket'
  chapter.behavior.turnEnded(four.state, four.state.investigators[0], four.api)
  assert.equal(locationOf(four.state, 'tangledThicket').damage, 1)
  // 未达阈值的扫描不翻面
  assert.equal(chapter.behavior.sinkLocationsAtThreshold(four.state, four.api), 0)
})

// ---------------------------------------------------------------------------
// 6. 议程背面
// ---------------------------------------------------------------------------
test('P7 theThingInTheDepths 议程背面：中央地点翻沉没（弃全部标记）+ 深沼之物生成；议程 2 全员被击败', () => {
  const { state, api } = setup(2)
  const centerId = slotId(state, CENTER_SLOT)
  const center = locationOf(state, centerId)
  center.clues = 2
  center.damage = 1
  center.attachments = [{ code: '01088', ownerSeat: 1 }]
  assert.equal(chapter.behavior.agendaReveal(state, state.agendas[0], api), true)
  assert.equal(center.code, OPEN_WATER_CODE_BY_LOCATION[centerId])
  assert.deepEqual(center.traits, ['Sunken'])
  assert.equal(center.damage, 0)
  assert.equal(center.clues, 0, '「弃掉其所有标记」含线索')
  assert.deepEqual(center.attachments, [])
  assert.equal(state.investigators[1].discard.includes('01088'), true)
  const thing = state.enemies.find(enemy => enemy.originalCode === THING_IN_THE_DEPTHS_CODE)
  assert.ok(thing, '深沼之物从放一边区域生成')
  assert.equal(thing.location, centerId)
  assert.equal(chapter.behavior.enemyStatModifier(state, thing, 'health'), 10, '+5/人 × 2 人')
  assert.equal(state.scenarioZones.setAside.includes(THING_IN_THE_DEPTHS_CODE), false)
  // 另一处地点也沉没后：移动时与每个[[沉没]]地点连通
  sinkAt(state, api, 'tangledThicket')
  assert.deepEqual(chapter.behavior.enemyConnections(state, thing, center).sort(),
    state.locations.filter(location => location.traits.includes('Sunken') && location.id !== centerId)
      .map(location => location.id).sort())
  // 议程 2 背面：幸存调查员全部被击败 + 1 点肉体创伤
  const second = setup(2)
  assert.equal(chapter.behavior.agendaReveal(second.state, second.state.agendas[1], second.api), true)
  assert.equal(second.state.investigators.every(inv => inv.defeated === true), true)
  assert.equal(second.api.log.trauma.length, 2)
  assert.equal(second.api.log.trauma.every(row => row.kind === 'physical' && row.amount === 1), true)
  assert.deepEqual(second.api.log.trauma.map(row => row.seat), [0, 1])
})

// ---------------------------------------------------------------------------
// 7. 幕背面
// ---------------------------------------------------------------------------
test('P7 theThingInTheDepths 幕：幕 1 背面生成鳄龟混种/触须并洗回其余；幕 2 背面按日期进结局 1/2', () => {
  const { state, api } = setup(2)
  const northShore = slotId(state, 'northShore')
  assert.equal(chapter.behavior.actReveal(state, state.acts[0], api), true)
  const hybrid = state.enemies.find(enemy => enemy.originalCode === CHELYDRAN_HYBRID_CODE)
  assert.ok(hybrid)
  assert.equal(hybrid.location, northShore, '鳄龟混种在北岸')
  const tendrils = state.enemies.filter(enemy => enemy.originalCode === GRASPING_TENDRIL_CODE)
  assert.equal(tendrils.length, 1)
  assert.equal(locationOf(state, northShore).connections.includes(tendrils[0].location), true, '触须在相邻地点')
  assert.equal(state.scenarioZones.setAside.includes(GRASPING_TENDRIL_CODE), false, '放一边的触须全部取走')
  assert.equal(state.encounterDeck.filter(code => code === GRASPING_TENDRIL_CODE).length, 4, '其余 4 张洗回遭遇牌库')
  assert.equal(state.encounterDiscard.length, 0, '遭遇弃牌堆一起洗回')
  // 幕 2 背面：第一日 → 结局 2；否则 → 结局 1
  for (const [date, expected] of [['1:day', 'resolution2'], ['2:day', 'resolution1'], ['3:night', 'resolution1']]) {
    const run = setup(2, { date })
    assert.equal(chapter.behavior.actReveal(run.state, run.state.acts[1], run.api), true)
    assert.deepEqual(run.api.log.finished, [expected], `${date} → ${expected}`)
  }
})

// ---------------------------------------------------------------------------
// 8. 幕目标与撤退
// ---------------------------------------------------------------------------
test('P7 theThingInTheDepths 幕目标与撤退：幕 1 轮末共同支付线索、幕 2 鳄龟混种在起始地点、议程 1 可撤退', () => {
  const { state, api } = setup(2)
  assert.equal(chapter.behavior.roundEndActIndex, 0, '幕 1 只在轮末支付线索')
  assert.equal(state.acts[0].objective.type, 'clues')
  assert.equal(state.acts[0].objective.perInvestigator, 3)
  assert.equal(state.acts[0].objective.atLocation, slotId(state, 'northShore'))
  // 议程 1 正面可撤退；推进到议程 2 后关闭
  assert.equal(chapter.behavior.syncResignAvailability(state), true)
  assert.equal(state.scenario.resignAnywhere, true)
  state.agendaIndex = 1
  assert.equal(chapter.behavior.syncResignAvailability(state), false)
  assert.equal(state.scenario.resignAnywhere, false)
  // 幕 2 目标：一轮结束时鳄龟混种在起始地点 → 立即推进
  const run = setup(2)
  run.state.actIndex = 1
  const startId = slotId(run.state, START_SLOT)
  chapter.behavior.spawnDepthsEnemy(run.state, CHELYDRAN_HYBRID_CODE, startId, run.api, { unique: true })
  assert.equal(chapter.behavior.checkObjectives(run.state, run.api), false, '不在轮末窗口时不推进')
  run.state._roundEndWindow = true
  assert.equal(chapter.behavior.checkObjectives(run.state, run.api), true)
  assert.equal(run.api.log.advances, 1)
  // 幕 2 快速能力：相邻地点共同支付 1/人 线索，本轮把鳄龟混种的巡逻地点改成该地点
  const fast = setup(2)
  fast.state.actIndex = 1
  const hybrid = chapter.behavior.spawnDepthsEnemy(fast.state, CHELYDRAN_HYBRID_CODE, 'fetidPool1', fast.api, { unique: true })
  const targetId = locationOf(fast.state, 'fetidPool1').connections.find(id => locationOf(fast.state, id))
  const fastInv = fast.state.investigators[0]
  fastInv.location = targetId
  fastInv.clues = 2
  const patrolMove = chapter.behavior.fastActions(fast.state, fastInv)
    .find(item => item.rule === 'depthsChangeHybridPatrol')
  assert.ok(patrolMove, '幕 2 的快速改巡逻行动存在')
  assert.equal(chapter.behavior.performAction(fast.state, fastInv, patrolMove, fast.api), true)
  assert.equal(fast.state.scenarioFlags.depthsHybridPatrol.location, targetId)
  assert.equal(fastInv.clues, 0, '共同支付 1/人 线索')
  const printed = { kind: 'nearestEmpty' }
  assert.deepEqual(chapter.behavior.patrolTarget(fast.state, hybrid, printed), { kind: 'named', locationId: targetId })
  fast.state.round++
  assert.deepEqual(chapter.behavior.patrolTarget(fast.state, hybrid, printed), printed)
  // 毁灭：Day 2 → 1；Day 3 白天 → 2；Day 3 夜晚 → 0
  assert.equal(setup(2, { date: '2:day' }).state.doom, 1)
  assert.equal(setup(2, { date: '3:day' }).state.doom, 2)
  assert.equal(setup(2, { date: '3:night' }).state.doom, 0)
  assert.equal(setup(2, { date: '1:day' }).state.doom, 0)
})

// ---------------------------------------------------------------------------
// 9. 混乱符号
// ---------------------------------------------------------------------------
test('P7 theThingInTheDepths 混乱符号：[skull] 沉没地点数一半/全数，cultist/tablet/elder_thing 四档', () => {
  const { state, api } = setup(1)
  assert.deepEqual(THE_THING_IN_THE_DEPTHS_TOKEN_MEANINGS.standard.skull.text.includes('沉没'), true)
  assert.equal(isHardSide({ difficulty: 'standard' }), false)
  assert.equal(isHardSide({ difficulty: 'expert' }), true)
  assert.equal(sunkenLocationCount(state), 0)
  assert.equal(skullValue(state), 0)
  sinkAt(state, api, 'tangledThicket')
  sinkAt(state, api, 'rottenDock')
  assert.equal(sunkenLocationCount(state), 2)
  state.difficulty = 'standard'
  assert.equal(skullValue(state), 1, '一半向上取整')
  assert.equal(thingInTheDepthsChaosTokenValue(state, 'skull'), -1)
  state.difficulty = 'hard'
  assert.equal(skullValue(state), 2, '困难/专家按全数')
  assert.equal(thingInTheDepthsChaosTokenValue(state, 'skull'), -2)
  state.difficulty = 'standard'
  assert.equal(thingInTheDepthsChaosTokenValue(state, 'cultist'), -1)
  assert.equal(thingInTheDepthsChaosTokenValue(state, 'tablet'), -3)
  assert.equal(thingInTheDepthsChaosTokenValue(state, 'elderthing'), -4)
  assert.equal(thingInTheDepthsChaosTokenValue(state, 'frost'), null, '未知标记交回引擎默认表')
  state.difficulty = 'expert'
  assert.equal(thingInTheDepthsChaosTokenValue(state, 'cultist'), -3)
  assert.equal(thingInTheDepthsChaosTokenValue(state, 'tablet'), -5)
  assert.equal(thingInTheDepthsChaosTokenValue(state, 'elderthing'), -5)
  state.difficulty = 'standard'
  assert.deepEqual(thingInTheDepthsChaosToken(state, state.investigators[0], 'cultist').onDraw,
    [{ type: 'scenarioToken', token: 'cultist', mode: 'mayRemoveSinkhole' }])
  assert.deepEqual(thingInTheDepthsChaosToken(state, state.investigators[0], 'tablet').onFail,
    [{ type: 'scenarioToken', token: 'tablet', mode: 'placeSinkhole' }])
  assert.deepEqual(thingInTheDepthsChaosToken(state, state.investigators[0], 'elderthing').onFail,
    [{ type: 'scenarioToken', token: 'elderthing', mode: 'searchTendril' }])
  state.difficulty = 'hard'
  assert.deepEqual(thingInTheDepthsChaosToken(state, state.investigators[0], 'tablet').onDraw,
    [{ type: 'scenarioToken', token: 'tablet', mode: 'placeSinkhole' }])
  assert.deepEqual(thingInTheDepthsChaosToken(state, state.investigators[0], 'cultist'), { delta: -3, onDraw: [], onFail: [] })
  assert.equal(THE_THING_IN_THE_DEPTHS_TOKEN_MEANINGS.hard.cultist.delta, -3)
})

test('P7 theThingInTheDepths 混乱符号追加效果：移渗坑/放渗坑/查找触须；困难 cultist 成功时结算', () => {
  const { state, api } = setup(2)
  const inv = state.investigators[0]
  inv.location = 'tangledThicket'
  const here = locationOf(state, 'tangledThicket')
  here.damage = 1
  const removeChoose = { choose: request => (request.options || []).find(option => option.id === 'tangledThicket')?.id ?? null }
  assert.equal(chapter.behavior.applyTokenEffect(state, inv, { token: 'cultist', mode: 'mayRemoveSinkhole' }, { ...api, ...removeChoose }), true)
  assert.equal(here.damage, 0)
  assert.equal(chapter.behavior.applyTokenEffect(state, inv, { token: 'tablet', mode: 'placeSinkhole' }, api), true)
  assert.equal(here.damage, 1)
  // [elder_thing]：从遭遇弃牌堆找触须并生成（忽略涌动 = 不经抽牌管线）
  chapter.behavior.spawnDepthsEnemy(state, CHELYDRAN_HYBRID_CODE, 'fetidPool1', api, { unique: true })
  state.encounterDiscard.push(GRASPING_TENDRIL_CODE)
  assert.equal(chapter.behavior.applyTokenEffect(state, inv, { token: 'elderthing', mode: 'searchTendril' }, api), true)
  assert.equal(state.encounterDiscard.includes(GRASPING_TENDRIL_CODE), false)
  assert.equal(state.enemies.some(enemy => enemy.originalCode === GRASPING_TENDRIL_CODE && enemy.location === 'fetidPool1'), true)
  // 困难/专家 cultist：检定成功时才可移除渗坑（afterTest）
  const hard = setup(2, { date: '1:day', overrides: { choose: removeChoose.choose } })
  hard.state.difficulty = 'hard'
  const hardInv = hard.state.investigators[0]
  hardInv.location = 'tangledThicket'
  locationOf(hard.state, 'tangledThicket').damage = 1
  assert.equal(chapter.behavior.afterTest(hard.state, hardInv, { success: true }, hard.api,
    { resolvedTokens: ['cultist'], test: { actionKind: 'investigate' } }), true)
  assert.equal(locationOf(hard.state, 'tangledThicket').damage, 0)
})

// ---------------------------------------------------------------------------
// 10. 诡计显现
// ---------------------------------------------------------------------------
test('P7 theThingInTheDepths 诡计显现：地层扰动逐失败点二选一、泥泞下沉沉没/沼地分支', () => {
  const { state, api } = setup(2)
  const inv = state.investigators[0]
  inv.location = 'tangledThicket'
  const bog = locationOf(state, 'tangledThicket')
  const sinkholeApi = {
    ...api,
    test: (seat, skill, difficulty, resolve) => {
      api.log.tests.push({ seat, skill, difficulty })
      resolve({ success: false, difficulty: 4, value: 2 })
    },
    choose: request => (request.options || []).find(option => option.id === 'sinkhole')?.id ?? (request.options || [])[0]?.id,
  }
  bog.damage = 0
  assert.equal(chapter.behavior.groundDisturbanceResolve(state, inv, sinkholeApi), false)
  assert.deepEqual(api.log.tests.at(-1), { seat: 0, skill: 'intellect', difficulty: 4 })
  assert.equal(bog.damage, 2, '失败 2 点 → 2 个渗坑')
  // 选择伤害分支
  const damageApi = {
    ...api,
    test: (seat, skill, difficulty, resolve) => resolve({ success: false, difficulty: 4, value: 3 }),
    choose: request => (request.options || []).some(option => option.id === 'damage') ? 'damage' : null,
  }
  chapter.behavior.groundDisturbanceResolve(state, inv, damageApi)
  assert.equal(inv.damage, 1, '失败 1 点 → 1 点伤害')
  // 泥泞下沉：沉没地点 → 1 直接伤害 + 每个盟友 1 直接伤害
  const sunk = setup(2)
  const sunkInv = sunk.state.investigators[0]
  sinkAt(sunk.state, sunk.api, 'tangledThicket')
  sunkInv.location = 'tangledThicket'
  sunkInv.assets = [{ id: 'ally-1', code: ALLY_CODE, damage: 0, horror: 0 }]
  assert.equal(chapter.behavior.sinkingSludgeResolve(sunk.state, sunkInv, sunk.api), false)
  assert.equal(sunkInv.damage, 1)
  assert.equal(sunkInv.assets[0].damage, 1)
  // 沼地地点 → 1 个渗坑
  const bogRun = setup(2)
  const bogInv = bogRun.state.investigators[0]
  bogInv.location = 'fetidPool1'
  chapter.behavior.sinkingSludgeResolve(bogRun.state, bogInv, bogRun.api)
  assert.equal(locationOf(bogRun.state, 'fetidPool1').damage, 1)
})

// ---------------------------------------------------------------------------
// 11. 地点规则与行动
// ---------------------------------------------------------------------------
test('P7 theThingInTheDepths 地点规则：腐臭池塘帷幕、纠葛灌丛额外行动、泛滥道路/废弃棚屋快速行动', () => {
  const { state, api } = setup(2)
  const inv = state.investigators[0]
  // 腐臭池塘：每渗坑 +1 帷幕
  const pool = locationOf(state, 'fetidPool1')
  pool.damage = 2
  assert.equal(chapter.behavior.locationShroudModifier(state, pool), 2)
  assert.equal(chapter.behavior.locationShroudModifier(state, locationOf(state, 'tangledThicket')), 0)
  // 纠葛灌丛：离开需要额外 1 个行动
  inv.location = 'tangledThicket'
  inv.actions = 1
  assert.match(chapter.behavior.moveError(state, inv, null, 'fetidPool1'), /额外花费 1 个行动/)
  inv.actions = 3
  assert.equal(chapter.behavior.moveError(state, inv, null, 'fetidPool1'), null)
  assert.equal(chapter.behavior.beforeMove(state, inv, { id: 'fetidPool1' }, api, { reason: 'move' }), true)
  assert.equal(inv.actions, 2, '额外扣 1 个行动')
  inv.actions = 3
  assert.equal(chapter.behavior.beforeMove(state, inv, { id: 'fetidPool1' }, api, { reason: 'effect' }), true)
  assert.equal(inv.actions, 3, '效果位移不加价')
  // 泛滥道路 [fast]：放渗坑后移动
  inv.location = 'floodedPath1'
  const path = locationOf(state, 'floodedPath1')
  const move = chapter.behavior.actions(state, inv).find(item => item.rule === 'depthsFloodedPathMove')
  assert.ok(move)
  assert.equal(chapter.behavior.performAction(state, inv, move, api), true)
  assert.equal(path.damage, 1)
  assert.equal(path.connections.includes(inv.location), true, '移动到连接地点')
  // 废弃棚屋 [fast]：线索换渗坑伤害（每轮一次）
  const shack = setup(2)
  const shackInv = shack.state.investigators[0]
  shackInv.location = 'abandonedShack'
  const shackLocation = locationOf(shack.state, 'abandonedShack')
  shackLocation.damage = 1
  shackInv.clues = 1
  const enemy = chapter.behavior.spawnDepthsEnemy(shack.state, GRASPING_TENDRIL_CODE, 'abandonedShack', shack.api)
  const drain = chapter.behavior.actions(shack.state, shackInv).find(item => item.rule === 'depthsAbandonedShackDrain')
  assert.ok(drain)
  assert.equal(chapter.behavior.performAction(shack.state, shackInv, drain, shack.api), true)
  assert.equal(shackLocation.damage, 0)
  assert.equal(enemy.damageTaken, 1)
  assert.equal(shackInv.clues, 0)
  // 每轮一次：再给 1 个渗坑与 1 个线索，行动变成 unavailable 原因
  shackLocation.damage = 1
  shackInv.clues = 1
  assert.equal(chapter.behavior.actions(shack.state, shackInv)
    .find(item => item.rule === 'depthsAbandonedShackDrain').reason, '每轮仅限一次')
})

test('P7 theThingInTheDepths 地点触发：沉没面进入抽牌、腐烂码头发现线索后敏捷检定、廊桥符号标记抽牌', () => {
  const { state, api } = setup(2)
  const inv = state.investigators[0]
  // 沉没面：移动进入后抽遭遇牌
  sinkAt(state, api, 'tangledThicket')
  inv.location = 'tangledThicket'
  const before = api.log.drawn.length
  assert.equal(chapter.behavior.locationEntered(state, inv, locationOf(state, 'tangledThicket'), api), true)
  assert.equal(api.log.drawn.length, before + 1)
  // 未沉没的 Bog 地点不触发
  inv.location = 'fetidPool1'
  assert.equal(chapter.behavior.locationEntered(state, inv, locationOf(state, 'fetidPool1'), api), false)
  // 腐烂码头：发现线索后敏捷 3 检定，失败放 1 个渗坑
  inv.location = 'rottenDock'
  const dock = locationOf(state, 'rottenDock')
  const failing = {
    ...api,
    test: (seat, skill, difficulty, resolve) => {
      api.log.tests.push({ seat, skill, difficulty })
      resolve({ success: false, difficulty, value: difficulty - 1 })
    },
  }
  dock.damage = 0
  assert.equal(chapter.behavior.afterInvestigate(state, inv, dock, { success: true }, failing), true)
  assert.deepEqual(api.log.tests.at(-1), { seat: 0, skill: 'agility', difficulty: 3 })
  assert.equal(dock.damage, 1)
  // 廊桥：调查时揭示符号标记 → 抽遭遇牌
  inv.location = 'coveredBridge'
  const drawn = api.log.drawn.length
  assert.equal(chapter.behavior.afterTest(state, inv, { success: true }, api,
    { resolvedTokens: [{ face: 'skull' }], test: { actionKind: 'investigate' } }), true)
  assert.equal(api.log.drawn.length, drawn + 1)
  assert.equal(chapter.behavior.afterTest(state, inv, { success: true }, api,
    { resolvedTokens: ['+1'], test: { actionKind: 'investigate' } }), false, '非符号标记不触发')
})

// ---------------------------------------------------------------------------
// 12. 敌人
// ---------------------------------------------------------------------------
test('P7 theThingInTheDepths 敌人：深沼之物健康/连通/不能趁机攻击，鳄龟混种巡逻与不可移动，触须按日健康', () => {
  const { state, api } = setup(2)
  const thing = chapter.behavior.spawnDepthsEnemy(state, THING_IN_THE_DEPTHS_CODE, 'fetidPool1', api, { unique: true })
  assert.equal(chapter.behavior.enemyStatModifier(state, thing, 'health'), 10)
  assert.equal(thing.health + chapter.behavior.enemyStatModifier(state, thing, 'health'), 20, '10 + 5×2')
  assert.equal(chapter.behavior.canOpportunityAttack(state, thing), false, '深沼之物不能趁机攻击')
  // 移动时与每个沉没地点连通
  sinkAt(state, api, 'rottenDock')
  assert.deepEqual(chapter.behavior.enemyConnections(state, thing, locationOf(state, 'fetidPool1')).sort(), ['rottenDock'])
  // 鳄龟混种：巡逻（最近无人地点）+ 不可移动
  const hybrid = chapter.behavior.spawnDepthsEnemy(state, CHELYDRAN_HYBRID_CODE, 'abandonedShack', api, { unique: true })
  assert.deepEqual(registeredEntry(CHELYDRAN_HYBRID_CODE).enemyRule.patrolTarget, { kind: 'nearestEmpty' })
  assert.equal(chapter.behavior.refreshHybridImmovable(state), 0, '没有异形/未交战时可以移动')
  const tendril = chapter.behavior.spawnDepthsEnemy(state, GRASPING_TENDRIL_CODE, 'abandonedShack', api)
  assert.equal(chapter.behavior.refreshHybridImmovable(state), 1, '有重整异形 → 不能移动')
  assert.equal(hybrid.immobile, true)
  tendril.exhausted = true
  chapter.behavior.refreshHybridImmovable(state)
  assert.equal(hybrid.immobile, false)
  hybrid.engagedSeat = 0
  chapter.behavior.refreshHybridImmovable(state)
  assert.equal(hybrid.immobile, true, '交战 → 不能移动')
  hybrid.engagedSeat = null
  tendril.exhausted = false
  // 敌军阶段结束：每有 1 个重整[[异形]]敌人，鳄龟混种受 1 点伤害
  assert.equal(chapter.behavior.enemyPhaseEnd(state, api), true)
  assert.equal(hybrid.damageTaken, 1)
  // 触须健康值 = 当前天数（印刷 -2 占位）
  const day3 = setup(1, { date: '3:day' })
  const late = chapter.behavior.spawnDepthsEnemy(day3.state, GRASPING_TENDRIL_CODE, 'fetidPool1', day3.api)
  assert.equal(late.health + chapter.behavior.enemyStatModifier(day3.state, late, 'health'), 3)
  // 触须生成地点 = 鳄龟混种所在地点
  const spawnRun = setup(1)
  chapter.behavior.spawnDepthsEnemy(spawnRun.state, CHELYDRAN_HYBRID_CODE, 'rottenDock', spawnRun.api, { unique: true })
  assert.equal(chapter.behavior.spawnLocation(spawnRun.state, GRASPING_TENDRIL_CODE, 'fetidPool1', null, spawnRun.api), 'rottenDock')
  // 触须的冷漠只在黑夜
  const night = setup(1, { date: '3:night' })
  const nightTendril = chapter.behavior.spawnDepthsEnemy(night.state, GRASPING_TENDRIL_CODE, 'fetidPool1', night.api)
  chapter.behavior.enemySpawned(night.state, nightTendril, night.api)
  assert.equal(nightTendril.aloof, true)
  const day = setup(1, { date: '1:day' })
  const dayTendril = chapter.behavior.spawnDepthsEnemy(day.state, GRASPING_TENDRIL_CODE, 'fetidPool1', day.api)
  chapter.behavior.enemySpawned(day.state, dayTendril, day.api)
  assert.equal(dayTendril.aloof, false)
  // 击败 → 结局 3 / 4
  const finishRun = setup(2)
  const shot = chapter.behavior.spawnDepthsEnemy(finishRun.state, CHELYDRAN_HYBRID_CODE, 'fetidPool1', finishRun.api)
  chapter.behavior.enemyDefeated(finishRun.state, shot, finishRun.api)
  assert.deepEqual(finishRun.api.log.finished, ['resolution3'])
  chapter.behavior.enemyDefeated(finishRun.state, thing, finishRun.api)
  assert.deepEqual(finishRun.api.log.finished, ['resolution3', 'resolution4'])
})

// ---------------------------------------------------------------------------
// 13. 引入分支与居民
// ---------------------------------------------------------------------------
test('P7 theThingInTheDepths 引入分支：Judith 关系/旧怨、Day 2 二选一、居民按日期放置', () => {
  // Day 1 + Judith 关系 ≥1：关系 +1、每人 1 点奖励经验
  const high = setup(2, { date: '1:day', records: { judithParkRelationshipLevel: 1 } })
  assert.equal(high.state.campaign.records[RECORD_KEYS.introBranch], 'day1-judithHigh')
  assert.equal(high.state.campaign.records[RECORD_KEYS.judithRelationship], 2)
  assert.equal(high.state.scenarioFlags.depthsBonusXp, 1)
  // Day 1 + 关系 0：记录「Judith shared a grudge」
  const low = setup(2, { date: '1:day' })
  assert.equal(low.state.campaign.records[RECORD_KEYS.introBranch], 'day1-judithLow')
  assert.equal(low.state.campaign.records[RECORD_KEYS.judithSharedAGrudge], true)
  // 夜晚：直接 Intro 8；只有时间标记卡，没有居民
  const night = setup(1, { date: '2:night' })
  assert.equal(night.state.campaign.records[RECORD_KEYS.introBranch], 'night')
  assert.deepEqual(night.state.storyAssets.map(asset => asset.code), [DAY_STORY_CODES[2]])
  assert.equal(night.state.storyAssets[0].face, 'night')
  // Day 2 白天：推车（下一场景少 2 资源）
  const push = setup(2, { date: '2:day' })
  assert.equal(push.state.campaign.records[RECORD_KEYS.fewerResourcesNextScenario], 2)
  const rev = setup(2, {
    date: '2:day',
    overrides: { choose: request => (request.options || []).some(option => option.id === 'rev') ? 'rev' : null },
  })
  assert.equal(rev.state.campaign.records[RECORD_KEYS.fewerActionsNextScenario], 1)
  // 居民：Day 1 → Judith（北岸）+ 马奎兹（调查员控制）；Day 2/3 → 河·霍桑（北岸）
  const day1 = setup(2, { date: '1:day' })
  const judith = day1.state.storyAssets.find(asset => asset.code === RESIDENT_CODES.judithPark)
  const marquez = day1.state.storyAssets.find(asset => asset.code === RESIDENT_CODES.drRosaMarquez)
  assert.equal(judith.location, slotId(day1.state, 'northShore'))
  assert.equal(marquez.controllerSeat, 0)
  assert.equal(day1.state.storyAssets.some(asset => asset.code === DAY_STORY_CODES[1]), true, '时间标记卡入场')
  const day2 = setup(2, { date: '2:day' })
  assert.equal(day2.state.storyAssets.some(asset => asset.code === RESIDENT_CODES.judithPark), false)
  assert.equal(day2.state.storyAssets.find(asset => asset.code === RESIDENT_CODES.riverHawthorne).location,
    slotId(day2.state, 'northShore'))
  // 日期写回引擎日历记录
  assert.equal(day1.state.campaign.records.hemlockDate, '1:day')
})

// ---------------------------------------------------------------------------
// 14. 结局与记录
// ---------------------------------------------------------------------------
test('P7 theThingInTheDepths 结局与记录：结局 1–5/无结局、胜利区经验、勘察记录、居民关系', () => {
  const expectations = [
    ['noResolution', { bonus: 1 }],
    ['resolution1', { record: RECORD_KEYS.chelydranHybridPerished, bonus: 1 }],
    ['resolution2', { record: RECORD_KEYS.chelydranHybridLived, bonus: 3 }],
    ['resolution3', { record: RECORD_KEYS.chelydranHybridWasDevoured, bonus: 1 }],
    ['resolution4', { record: RECORD_KEYS.thingInTheDepthsWasDefeated, bonus: 0 }],
  ]
  for (const [key, expected] of expectations) {
    const { state, api } = setup(2)
    const result = chapter.behavior.resolution(state, key, [], api)
    const records = state.campaign.records
    assert.equal(records[RECORD_KEYS.resolution], key)
    assert.equal(result.bonus, expected.bonus, `${key} 奖励经验`)
    if (expected.record) assert.equal(records[expected.record], true, `${key} 记录`)
    assert.deepEqual(records[RECORD_KEYS.areasSurveyed], [RECORD_KEYS.eastwickBog], '结局 5 勘察东威克沼')
    assert.equal(api.log.finished.length, 0, '结局钩子不重复 finish')
    if (key === 'resolution3') {
      assert.equal(api.log.trauma.length, 2)
      assert.equal(api.log.trauma.every(row => row.kind === 'mental' && row.amount === 1), true)
    }
  }
  // 结局 5：胜利区 X + Judith 旧怨/深沼之物在胜利区 + 河·霍桑求助
  const { state, api } = setup(2, {
    date: '1:day',
    records: {
      judithSharedAGrudge: true, riverAskedForHelp: true,
      judithParkRelationshipLevel: 0, riverHawthorneRelationshipLevel: 2,
    },
    overrides: {},
  })
  state.victoryDisplay = [{ code: THING_IN_THE_DEPTHS_CODE, originalCode: THING_IN_THE_DEPTHS_CODE, victory: 2 }]
  const result = chapter.behavior.resolution(state, 'resolution5', [], api)
  assert.equal(result.bonus, 3, '2 点胜利区经验 + 1 点朱迪丝奖励')
  assert.equal(state.campaign.records[RECORD_KEYS.judithRelationship], 1)
  assert.equal(state.campaign.records[RECORD_KEYS.riverRelationship], 1)
  // 无结局也跳到结局 5：无胜利区经验时只有 1 点
  const plain = setup(1)
  assert.equal(chapter.behavior.resolution(plain.state, 'notAKey', [], plain.api).resolution, 'noResolution')
  // scenarioResolution 摘要
  const summary = chapter.behavior.scenarioResolution(plain.state, 'resolution2', plain.api)
  assert.equal(summary.resolution, 'resolution2')
  assert.equal(summary.bonusXp, 3)
  assert.deepEqual(summary.areasSurveyed, [RECORD_KEYS.eastwickBog])
  // 记录键声明与实写一致
  for (const key of [RECORD_KEYS.resolution, RECORD_KEYS.bonusXp]) assert.equal(RECORD_WRITES.includes(key), true)
  assert.equal(RECORD_READS.includes(RECORD_KEYS.judithSharedAGrudge), true)
})

test('P7 theThingInTheDepths 法典：5 河·霍桑 / 7 朱迪丝·帕克 / Θ 马奎兹博士', () => {
  // 7：有旧怨 → 击败 1 个非精英敌人并接管朱迪丝
  const { state, api } = setup(2, { date: '1:day', records: { judithSharedAGrudge: true } })
  const enemy = chapter.behavior.spawnDepthsEnemy(state, GRASPING_TENDRIL_CODE, 'fetidPool1', api)
  assert.equal(chapter.behavior.runCodex(state, chapter.behavior.CODEX_IDS.judithPark, 0, api), true)
  assert.equal(enemy.defeated, true)
  assert.equal(state.storyAssets.find(asset => asset.code === RESIDENT_CODES.judithPark).controllerSeat, 0)
  // 5：未控制 → 记录求助并接管；已控制 → 关系 +1、奖励经验、移出游戏
  const river = setup(1, { date: '2:day' })
  assert.equal(chapter.behavior.runCodex(river.state, chapter.behavior.CODEX_IDS.riverHawthorne, 0, river.api), true)
  assert.equal(river.state.campaign.records[RECORD_KEYS.riverAskedForHelp], true)
  assert.equal(river.state.storyAssets.find(asset => asset.code === RESIDENT_CODES.riverHawthorne).controllerSeat, 0)
  assert.equal(chapter.behavior.runCodex(river.state, chapter.behavior.CODEX_IDS.riverHawthorne, 0, river.api), true)
  assert.equal(river.state.campaign.records[RECORD_KEYS.riverRelationship], 1)
  assert.equal(river.state.scenarioFlags.depthsBonusXp, 1)
  assert.equal(river.state.storyAssets.some(asset => asset.code === RESIDENT_CODES.riverHawthorne), false)
  // Θ：Bog 地点移除全部渗坑；沉没地点翻回 Bog 面（保留线索）
  const theta = setup(2)
  const pool = locationOf(theta.state, 'fetidPool1')
  pool.damage = 2
  assert.equal(chapter.behavior.runCodex(theta.state, chapter.behavior.CODEX_IDS.drRosaMarquez, 0,
    { ...theta.api, choose: () => 'fetidPool1' }), true)
  assert.equal(pool.damage, 0)
  sinkAt(theta.state, theta.api, 'tangledThicket')
  const sunken = locationOf(theta.state, 'tangledThicket')
  sunken.clues = 2
  assert.equal(chapter.behavior.runCodex(theta.state, chapter.behavior.CODEX_IDS.drRosaMarquez, 0,
    { ...theta.api, choose: () => 'tangledThicket' }), true)
  assert.equal(sunken.code, '10594a', '翻回 Bog 面')
  assert.deepEqual(sunken.traits, ['Bog'])
  assert.equal(sunken.clues, 2, '保留线索')
})

// ---------------------------------------------------------------------------
// 15. JSON 往返
// ---------------------------------------------------------------------------
test('P7 theThingInTheDepths JSON 往返：存档后继续渗坑下沉、幕目标与结局记录', () => {
  const { state, api } = setup(2, { date: '2:day' })
  const inv = state.investigators[0]
  inv.location = 'muddyFen2'
  locationOf(state, 'muddyFen2').damage = 3
  assert.equal(chapter.behavior.sinkLocationsAtThreshold(state, api), 1)
  chapter.behavior.actReveal(state, state.acts[0], api)
  const restored = CLONE(state)
  assert.equal(restored.scenario.id, 'theThingInTheDepths')
  assert.equal(restored.scenarioFlags.depthsSlots.northShore, 'fetidPool1')
  assert.equal(restored.locations.find(location => location.id === 'muddyFen2').code, '10593b')
  assert.equal(sunkenLocationCount(restored), 1)
  const restoreApi = makeApi(restored)
  const hybrid = restored.enemies.find(enemy => enemy.originalCode === CHELYDRAN_HYBRID_CODE)
  hybrid.location = restored.scenarioFlags.depthsSlots[START_SLOT]
  restored.actIndex = 1
  restored._roundEndWindow = true
  assert.equal(chapter.behavior.checkObjectives(restored, restoreApi), true)
  assert.equal(restoreApi.log.advances, 1)
  assert.equal(chapter.behavior.actReveal(restored, restored.acts[1], restoreApi), true)
  assert.deepEqual(restoreApi.log.finished, ['resolution1'], '第二日 → 结局 1')
  const again = CLONE(restored)
  const finalApi = makeApi(again)
  chapter.behavior.resolution(again, 'resolution1', [], finalApi)
  assert.equal(again.campaign.records[RECORD_KEYS.chelydranHybridPerished], true)
  assert.equal(typeof again.campaign.records[RECORD_KEYS.bonusXp], 'number')
})
