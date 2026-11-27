// P7 最长一夜（theLongestNight · 10626）章节测试。
//
// 覆盖：章节结构（31 张卡 / 30 个单卡条目）、8 个 gather 组、遭遇牌库 33 张、Fire! 五张放一边、
// 敌人牌库 14 张与 15 张红背敌人、地图格位与 18 条连接、序章二选一与共舞分支、
// 布置（病俘/乌尔辛/初始工事/线索）、屏障/诱饵/陷阱（牛奶房重定向、农庄禁止、[elder_thing] 移除）、
// 敌人牌库规则（议程毁灭抽牌、弃置路由、耗尽洗回、吉迪恩法典、生成方向、忽略工事、伤害封顶、
// 攻击后自愈、乌尔辛 +3/人生命值、鸡笼/谷仓修正）、幕/议程推进、混乱标记四档与追加效果、
// 地点能力、诡计事件、四个结局与战役记录、JSON 存档往返。
//
// 本文件不 import engine.js：章节 behavior 只走内容层函数（真实引擎钩子由 P7 主进程合并后
// 用 contentRegistry 注册），因此单测可在并行 worker 尚未重建索引时独立运行。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import * as chapter from '../content/campaigns/theFeastOfHemlockVale/scenarios/theLongestNight/index.js'
import {
  scenario, LOCATIONS, LOCATION_CONNECTIONS, LOCATION_COORDINATES, SLOT_COORDINATES, FARM_LOCATION_IDS,
  OUTER_FIELD_IDS, REMOVED_OUTER_FIELD_ID, PLAYED_OUTER_FIELD_IDS, ENCOUNTER_DECK, ENEMY_DECK,
  ENEMY_CARD_CODES, GATHER_GROUPS, GATHER_SET_ASIDE_GROUPS, SET_ASIDE_CARDS, SET_ASIDE_LOCATIONS,
  FIRE_CARDS, FIRE_CODE, ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, URSINE_CODE,
  CAPTIVES_CODE, AJAX_CODE, BARRIER_TOKENS_CODE, SCENARIO_TEXT, RECORD_KEYS, RESOLUTION_KEYS,
  STORY_CODES, CARD_DATA, CHAPTER_ID, REFERENCE_CODE, DANCE_RECORDS, MIDNIGHT_MASKS_CODES,
} from '../content/campaigns/theFeastOfHemlockVale/scenarios/theLongestNight/definition.js'
import {
  theLongestNightChaosToken, theLongestNightChaosTokenValue, doomInPlay, halfDoomInPlay,
  THE_LONGEST_NIGHT_TOKEN_MEANINGS,
} from '../content/campaigns/theFeastOfHemlockVale/scenarios/theLongestNight/chaos.js'
import * as behaviorModule from '../content/campaigns/theFeastOfHemlockVale/scenarios/theLongestNight/behavior.js'

const ENTRY_DIR = '../src/cards/encounter-entries/theFeastOfHemlockVale/theLongestNight/'
const ENTRY_CODES = [
  '10627', '10628', '10629', '10630', '10631', '10632', '10633', '10634', '10635', '10636',
  '10637', '10638', '10639', '10640', '10641', '10642', '10643', '10644a', '10644b', '10644c',
  '10645a', '10645b', '10645c', '10646', '10647a', '10647b', '10647c', '10648', '10649', '10650',
]
const ENTRIES = []
for (const code of ENTRY_CODES) {
  // eslint-disable-next-line no-await-in-loop
  ENTRIES.push((await import(`${ENTRY_DIR}${code}.js`)).default)
}
registerCardAbilities(ENTRIES)
const entryOf = code => registeredEntry(code)

const behavior = chapter.behavior
const clone = value => JSON.parse(JSON.stringify(value))

const stateFor = (investigatorCount = 2, records = {}, flags = {}) => ({
  investigators: Array.from({ length: investigatorCount }, (_, seat) => ({
    seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
    assets: [], engaged: [], deck: [], discard: [], threat: [], hand: [], trauma: { physical: 0, mental: 0 },
  })),
  locations: [], enemies: [], storyAssets: [], encounterDeck: [], encounterDiscard: [],
  scenarioFlags: { ...flags }, scenarioZones: {},
  campaign: { leadSeat: 0, records: { ...records }, completedSteps: [], trauma: {}, investigators: {} },
  victoryDisplay: [], victory: 0, doom: 0, difficulty: 'standard', numInvestigators: investigatorCount,
  phase: 'investigation', round: 1, status: 'playing',
})
const stateWithScenario = (count = 2, records = {}, flags = {}) => {
  const state = stateFor(count, records, flags)
  state.scenario = structuredClone(scenario)
  return state
}
const quietApi = () => ({ info: () => {} })
// 模拟引擎 advanceAct：结算当前幕背面，然后推进指针（actReveal 内 finish 时不推进）。
const engineishApi = () => {
  const api = { info: () => {}, finished: null, trauma: [], clues: [] }
  api.advanceAct = () => {
    const state = api.state
    const act = state.acts[state.actIndex]
    behavior.actReveal(state, act, api)
    if (api.finished) return
    state.actIndex += 1
  }
  api.finish = key => { api.finished = key }
  api.addTrauma = (seat, kind, amount) => { api.trauma.push({ seat, kind, amount }) }
  api.gainClues = (seat, amount) => {
    api.clues.push({ seat, amount })
    api.state.investigators[seat].clues += amount
  }
  return api
}
const setup = (count = 2, records = {}, api = quietApi()) => {
  const state = stateWithScenario(count, records)
  if (api && typeof api === 'object') api.state = state
  const report = behavior.setupScenario(state, api)
  return { state, report }
}
const captivesDamage = state => behavior.captivesDamage(state)
const locationId = (state, code) => state.locations.find(loc => (loc.originalCode || loc.code) === code)?.id || null

// ---------------------------------------------------------------------------
// 1. 章节结构、条目与文本
// ---------------------------------------------------------------------------

test('P7 theLongestNight 章节结构：31 张卡 / 30 个条目 / 单幕单议程 / 4 个结局', () => {
  assert.equal(chapter.scenario.id, 'theLongestNight')
  assert.equal(chapter.scenario.originalCode, '10626')
  assert.equal(REFERENCE_CODE, '10626')
  assert.equal(CHAPTER_ID, 'theLongestNight')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.campaignId, 'theFeastOfHemlockVale')
  assert.equal(chapter.manifest.referenceCode, '10626')
  assert.equal(CARD_DATA['10626'].name, 'The Longest Night')
  assert.equal(Object.keys(CARD_DATA).length, 31, '提示卡 + 30 张章内卡')
  assert.equal(Object.keys(LOCATIONS).length, 11, '农庄 + 5 农场 + 5 外围农田')
  assert.deepEqual([...ACT_CODES], ['10629'])
  assert.deepEqual([...AGENDA_CODES], ['10628'])
  assert.deepEqual([...RESOLUTION_KEYS], ['resolution1', 'resolution2', 'resolution3', 'resolution4'])
  assert.deepEqual(Object.keys(chapter.scenario.resolutions).sort(),
    ['investigatorDefeat', 'noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4'].sort())
  assert.deepEqual([...STORY_CODES].sort(), ['10627', '10641', '10642'].sort())
  assert.equal(chapter.manifest.locations.length, 11)
  assert.equal(chapter.manifest.acts.length, 1)
  assert.equal(chapter.manifest.agendas.length, 1)
  assert.equal(behavior.id, 'theLongestNight')
  assert.equal(chapter.implementedEntryFlags('10629').fastDefenseClueCost, 1)
  assert.equal(chapter.implementedEntryFlags('10628').doomThreshold, 10)
  assert.equal(chapter.implementedEntryFlags('10634').codexOnReveal, 'omega')
})

test('P7 theLongestNight 单卡条目：input.entryPaths 的 30 个文件全部注册且 scope 正确', () => {
  assert.equal(ENTRY_CODES.length, 30)
  assert.deepEqual([...chapter.implementedEncounterCodes].sort(), [...ENTRY_CODES].sort())
  const scopes = {
    act: ['10629'], agenda: ['10628'],
    location: ['10630', '10631', '10632', '10633', '10634', '10635', '10636', '10637', '10638', '10639', '10640'],
    storyAsset: ['10627', '10641', '10642'],
    enemy: ['10643', '10644a', '10644b', '10644c', '10645a', '10645b', '10645c', '10646', '10647a', '10647b', '10647c', '10648'],
    treachery: ['10649', '10650'],
  }
  for (const [scope, codes] of Object.entries(scopes)) {
    for (const code of codes) {
      const entry = entryOf(code)
      assert.ok(entry, `条目缺失：${code}`)
      assert.equal(entry.scope, scope, `${code} scope`)
      assert.equal(entry.implemented, true, `${code} implemented`)
      assert.equal(entry.code, code, `${code} code 与文件名一致`)
    }
  }
  for (const code of ENTRY_CODES) {
    assert.equal(typeof entryOf(code).flags, 'object', `${code} 声明了印刷数值 flags`)
  }
})

test('P7 theLongestNight 印刷文本：序章/设置/四条特别规则/九个法典/结局来自 story-access', () => {
  assert.equal(SCENARIO_TEXT.intro.length > 100, true)
  assert.equal(SCENARIO_TEXT.setup.length, 25, '参考 Setup 的 25 条布置条目')
  assert.equal(SCENARIO_TEXT.specialRules.length, 4)
  assert.deepEqual(SCENARIO_TEXT.specialRules.map(rule => rule.key),
    ['barriers', 'decoys', 'traps', 'enemyDeckRules'])
  assert.ok(/屏障|barrier/.test(SCENARIO_TEXT.rules.barriers))
  assert.ok(SCENARIO_TEXT.rules.enemyDeck.length > 0)
  assert.equal(Object.keys(SCENARIO_TEXT.codex).length, 9)
  assert.equal(Object.keys(SCENARIO_TEXT.resolutions).length, 5)
  assert.equal(SCENARIO_TEXT.textLanguage, 'zh-CN')
  assert.equal(SCENARIO_TEXT.chineseGaps.length, 0)
  assert.ok(SCENARIO_TEXT.introBranches.intro8.length > 0)
})

// ---------------------------------------------------------------------------
// 2. 遭遇牌库 / 敌人牌库 / 放一边
// ---------------------------------------------------------------------------

test('P7 theLongestNight 遭遇牌库：33 张、8 个 gather 组、Fire! 与敌人不进牌库', () => {
  assert.deepEqual([...GATHER_GROUPS].sort(), [
    'theSecondDay', 'theLongestNight', 'blight', 'transfiguration', 'fire', 'chillingCold',
    'theMidnightMasks', 'strikingFear',
  ].sort())
  assert.deepEqual([...GATHER_SET_ASIDE_GROUPS], [])
  assert.equal(ENCOUNTER_DECK.length, 33)
  const count = code => ENCOUNTER_DECK.filter(item => item === code).length
  assert.equal(count('10649'), 2, '无尽夜晚 ×2')
  assert.equal(count('10650'), 4, '入侵 ×4')
  assert.equal(count('10678'), 3, 'Downpour ×3（The Second Day）')
  assert.equal(count('10728'), 2, 'Enervation ×2（Blight）')
  assert.equal(count('10729'), 2, 'Desiccation ×2')
  assert.equal(count('10726'), 2, 'Strange Mutations ×2（Transfiguration）')
  assert.equal(count('10727'), 2, 'Fungal Rot ×2')
  assert.equal(count('01167'), 2, 'Crypt Chill ×2（Chilling Cold）')
  assert.equal(count('01168'), 2, 'Obscuring Fog ×2')
  assert.equal(count('01163'), 3, 'Rotting Remains ×3（Striking Fear）')
  assert.equal(count('01164'), 2)
  assert.equal(count('01165'), 2)
  assert.equal(count('01135'), 3, '猎影 ×3（The Midnight Masks 只取诡计）')
  assert.equal(count('01136'), 2, '伪线索 ×2')
  assert.deepEqual([...MIDNIGHT_MASKS_CODES].sort(), ['01135', '01136'].sort())
  assert.equal(ENCOUNTER_DECK.includes(FIRE_CODE), false, 'Fire! 整组放在一边')
  for (const code of ENEMY_CARD_CODES) assert.equal(ENCOUNTER_DECK.includes(code), false, `敌人不进遭遇牌库：${code}`)
  assert.equal(chapter.manifest.zones.encounterDeck.reduce((sum, row) => sum + row.count, 0), 33)
})

test('P7 theLongestNight 敌人牌库与放一边：15 张红背敌人、14 张进牌库、乌尔辛开局在场', () => {
  assert.equal(ENEMY_CARD_CODES.length, 12, '12 个不同敌人面')
  assert.equal(ENEMY_DECK.length, 14, '15 张红背敌人 − 乌尔辛 = 14')
  const count = code => ENEMY_DECK.filter(item => item === code).length
  assert.equal(count('10646'), 3, '山羊混种 ×3')
  assert.equal(count('10648'), 2, '蠕滑混种 ×2')
  assert.equal(count('10643'), 0, '乌尔辛开局在场，不进敌人牌库')
  assert.deepEqual([...FIRE_CARDS], Array(5).fill(FIRE_CODE))
  assert.deepEqual([...SET_ASIDE_CARDS].sort(), [...FIRE_CARDS, AJAX_CODE].sort())
  assert.deepEqual([...SET_ASIDE_LOCATIONS], [REMOVED_OUTER_FIELD_ID])
  const setAside = chapter.manifest.zones.setAside
  assert.equal(setAside.find(row => row.cardCode === FIRE_CODE)?.count, 5)
  assert.equal(setAside.find(row => row.cardCode === AJAX_CODE)?.count, 1)
  assert.equal(setAside.find(row => row.cardCode === '10640')?.count, 1, '被移除的外围农田在放一边区域')
  const inPlay = chapter.manifest.zones.inPlay
  assert.equal(inPlay.find(row => row.cardCode === URSINE_CODE)?.count, 1)
  assert.equal(inPlay.find(row => row.cardCode === CAPTIVES_CODE)?.count, 1)
  assert.equal(inPlay.find(row => row.cardCode === BARRIER_TOKENS_CODE)?.count, 1)
  assert.equal(PLAYED_OUTER_FIELD_IDS.length, 4)
})

// ---------------------------------------------------------------------------
// 3. 地点连接与坐标
// ---------------------------------------------------------------------------

test('P7 theLongestNight 地点连接：18 条边、双向对称、农庄连四向、坐标十字格', () => {
  const edges = Object.values(LOCATION_CONNECTIONS).reduce((sum, list) => sum + list.length, 0)
  assert.equal(edges, 18)
  assert.equal(chapter.layout.edges.length, 18)
  assert.deepEqual([...LOCATION_CONNECTIONS.theFarmhouse].sort(),
    ['milkhouse', 'coop', 'barn', 'pasture'].sort())
  assert.deepEqual([...LOCATION_CONNECTIONS.milkhouse].sort(), ['theFarmhouse', 'vineyard'].sort())
  assert.deepEqual([...LOCATION_CONNECTIONS.vineyard].sort(), ['milkhouse', 'outerFieldsBloodiedPaths'].sort())
  assert.deepEqual([...LOCATION_CONNECTIONS.outerFieldsBloodiedPaths], ['vineyard'])
  assert.deepEqual([...LOCATION_CONNECTIONS[REMOVED_OUTER_FIELD_ID]], [], '被移除的外围农田没有连接')
  for (const [id, list] of Object.entries(LOCATION_CONNECTIONS)) {
    for (const neighbor of list) {
      assert.equal(LOCATION_CONNECTIONS[neighbor].includes(id), true, `${id} ↔ ${neighbor} 对称`)
    }
  }
  assert.deepEqual(LOCATION_COORDINATES.theFarmhouse, { x: 0, y: 0 })
  assert.deepEqual(LOCATION_COORDINATES.outerFieldsBloodiedPaths, { x: -3, y: 0 })
  assert.deepEqual(LOCATION_COORDINATES.outerFieldsDesolateHills, { x: 2, y: 0 })
  assert.deepEqual(LOCATION_COORDINATES.outerFieldsBlightedCornfields, { x: 0, y: -2 })
  assert.deepEqual(LOCATION_COORDINATES.outerFieldsScorchedKnoll, { x: 0, y: 2 })
  assert.equal(LOCATION_COORDINATES[REMOVED_OUTER_FIELD_ID], undefined, '被移除的地点没有坐标')
  assert.equal(SLOT_COORDINATES.westInner.x, -1)
  assert.equal(Object.keys(chapter.layout.locations).length, 10, 'layout 只给在场地点')
})

test('P7 theLongestNight 布置：10 处地点入场、病俘在农庄、乌尔辛在西面外围农田', () => {
  const { state, report } = setup(2)
  assert.equal(state.locations.length, 10)
  assert.equal(report.placedIds.length, 10)
  assert.equal(state.locations.some(loc => loc.id === REMOVED_OUTER_FIELD_ID), false, '随机移除的外围农田不在场')
  assert.equal(state.locations.every(loc => loc.revealed === true), true, '本实现地点开场即揭示（披露）')
  assert.equal(state.locations.find(loc => loc.id === 'theFarmhouse').clues, 4, '农庄 2×2 人')
  assert.equal(state.locations.find(loc => loc.id === 'barn').clues, 2, '谷仓 1×2 人')
  assert.equal(state.locations.find(loc => loc.id === 'outerFieldsBloodiedPaths').clues, 6, '血染小径 3×2 人')
  const west = behavior.outerFieldAtDirection(state, 'west')
  assert.equal(west, 'outerFieldsBloodiedPaths')
  assert.equal(state.enemies.length, 1)
  assert.equal(state.enemies[0].code, URSINE_CODE)
  assert.equal(state.enemies[0].location, west, '乌尔辛在西面外围农田')
  assert.equal(state.storyAssets.some(asset => asset.code === CAPTIVES_CODE), true)
  assert.equal(behavior.captivesAsset(state).location, 'theFarmhouse')
  assert.equal(behavior.enemyDeckSize(state), 14)
  assert.equal(state.storyAssets.some(asset => asset.code === BARRIER_TOKENS_CODE), true, '工事参考卡入场')
  // 埃阿斯：谷仓揭示时入场并交给队长（本实现地点开场即揭示）
  assert.equal(state.storyAssets.some(asset => asset.code === AJAX_CODE), false)
  assert.equal(state.investigators[0].assets.filter(asset => asset.code === AJAX_CODE).length, 1)
  assert.equal(behavior.captivesDamage(state), 0)
  assert.equal(state.investigators.every(inv => inv.clues === 2), true, '有居民相助：每人 2 线索')
})

test('P7 theLongestNight 布置：独自面对时每人 3 线索；熊受伤则 2×人数伤害并横置', () => {
  const alone = setup(2, { [RECORD_KEYS.facedAlone]: true })
  assert.equal(alone.state.investigators.every(inv => inv.clues === 3), true)
  const wounded = setup(3, { [RECORD_KEYS.bearWounded]: true })
  const ursine = wounded.state.enemies.find(enemy => enemy.code === URSINE_CODE)
  assert.equal(ursine.damageTaken, 6, '2[per_investigator] × 3 人')
  assert.equal(ursine.exhausted, true)
})

test('P7 theLongestNight 序章：当面质问 +1[tablet]、躲藏 +1[skull]、共舞分支决定标记与记录', () => {
  // 没有共舞记录 → 结局分支 intro7，记录 faced alone，加 1 个 elder_thing。
  const api = { info: () => {}, choose: () => 'confront', state: null }
  const state = stateWithScenario(2)
  state.chaosBag = []
  state.campaign.chaosBag = []
  behavior.preScenarioSetup(state, [], api)
  assert.equal(behavior.danceCount(state) === 0, true)
  assert.equal(state.scenarioFlags.theLongestNightIntro, 'danceNone')
  assert.equal(state.campaign.records[RECORD_KEYS.facedAlone], true)
  assert.deepEqual(state.scenarioFlags.theLongestNightIntroTokens, ['tablet', 'elderthing'])
  behavior.afterChaosBagSetup(state, api)
  assert.deepEqual(state.chaosBag, ['tablet', 'elderthing'])
  assert.deepEqual(state.campaign.chaosBag, ['tablet', 'elderthing'], '标记留在战役袋')
  // 两位居民共舞 + 躲藏 → cultist；一位居民共舞 → cultist + elder_thing。
  const two = stateWithScenario(2, { simeonSharedADance: true, leahSharedADance: true })
  behavior.preScenarioSetup(two, [], { info: () => {}, choose: () => 'keepHidden' })
  assert.equal(two.scenarioFlags.theLongestNightIntro, 'danceTwo')
  assert.deepEqual(two.scenarioFlags.theLongestNightIntroTokens, ['skull', 'cultist'])
  const one = stateWithScenario(2, { helenSharedADance: true })
  behavior.preScenarioSetup(one, [], { info: () => {}, choose: () => 'keepHidden' })
  assert.equal(one.scenarioFlags.theLongestNightIntro, 'danceOne')
  assert.deepEqual(one.scenarioFlags.theLongestNightIntroTokens, ['skull', 'cultist', 'elderthing'])
  assert.equal(one.campaign.records[RECORD_KEYS.facedAlone], undefined)
  assert.equal(DANCE_RECORDS.length, 8)
})

// ---------------------------------------------------------------------------
// 4. 工事：屏障 / 诱饵 / 陷阱
// ---------------------------------------------------------------------------

test('P7 theLongestNight 屏障：放在两个连接地点之间、计数与相邻读点', () => {
  const { state } = setup(2)
  const api = quietApi()
  assert.equal(behavior.barrierCount(state, 'theFarmhouse', 'milkhouse'), 1, '初始 1 个屏障')
  assert.equal(behavior.barrierCountAt(state, 'theFarmhouse'), 1)
  behavior.changeBarrierCount(state, api, 'barn', 'theFarmhouse', 1)
  assert.equal(behavior.barrierCount(state, 'theFarmhouse', 'barn'), 1)
  assert.equal(behavior.barrierCount(state, 'barn', 'theFarmhouse'), 1, '无序边')
  behavior.changeBarrierCount(state, api, 'barn', 'theFarmhouse', -1)
  assert.equal(behavior.barrierCount(state, 'barn', 'theFarmhouse'), 0)
  behavior.changeBarrierCount(state, api, 'barn', 'theFarmhouse', -1)
  assert.equal(behavior.barrierCount(state, 'barn', 'theFarmhouse'), 0, '不会为负')
  // 幕的快速工事：花费 1 线索放屏障（默认第一个相邻地点）。
  const inv = state.investigators[0]
  inv.location = 'coop'
  inv.clues = 1
  const move = behavior.actions(state, inv).find(item => item.rule === 'theLongestNightPlaceDefense')
  assert.ok(move)
  assert.equal(behavior.performAction(state, inv, move, { ...api, choose: () => 'barrier' }), true)
  assert.equal(inv.clues, 0)
  assert.equal(behavior.barrierCount(state, 'coop', 'theFarmhouse'), 1)
})

test('P7 theLongestNight 诱饵/陷阱：每地点限 1、农庄禁止、牛奶房改放相邻地点', () => {
  const { state } = setup(1)
  const api = quietApi()
  // 清掉布置时的初始工事，单独验证规则。
  state.scenarioFlags.mechanics.defenses = { decoy: [], trap: [], cannotReady: {} }
  assert.equal(behavior.canPlaceDefenseAt(state, 'decoy', 'theFarmhouse'), false, '农庄不能放诱饵')
  assert.equal(behavior.canPlaceDefenseAt(state, 'trap', 'theFarmhouse'), false, '农庄不能放陷阱')
  assert.equal(behavior.placeDefense(state, 'decoy', 'theFarmhouse', 0, api), false)
  // 牛奶房：诱饵改放到相邻地点（农庄被禁止 → 葡萄园）。
  assert.equal(behavior.placeDefense(state, 'decoy', 'milkhouse', 0, api), true)
  assert.equal(behavior.decoyAt(state, 'milkhouse'), false)
  assert.equal(behavior.decoyAt(state, 'vineyard'), true, '牛奶房反应改放相邻地点')
  // 每地点限 1 个。
  assert.equal(behavior.placeDefense(state, 'decoy', 'vineyard', 0, api), false)
  assert.equal(behavior.placeDefense(state, 'trap', 'pasture', 0, api), true)
  assert.equal(behavior.trapAt(state, 'pasture'), true)
  assert.equal(behavior.placeDefense(state, 'trap', 'pasture', 0, api), false)
  // [elder_thing]：移除本地点 1 个屏障/诱饵/陷阱。
  behavior.placeDefense(state, 'decoy', 'barn', 0, api)
  assert.equal(behavior.removeDefenseAt(state, 0, 'barn', { ...api, choose: () => 'decoy' }), true)
  assert.equal(behavior.decoyAt(state, 'barn'), false)
})

test('P7 theLongestNight 工事：初始 1 诱饵 / 1 陷阱 / 1 屏障，引擎 defenses 机制已声明', () => {
  const { state, report } = setup(2)
  assert.equal(report.defenses.decoy.length, 1)
  assert.equal(report.defenses.trap.length, 1)
  assert.equal(report.defenses.barrier.length, 1)
  const store = behavior.defenseStore(state)
  assert.equal(store.decoy.length, 1)
  assert.equal(store.trap.length, 1)
  const edges = behavior.barrierEdges(state)
  assert.equal(edges.reduce((sum, edge) => sum + edge.count, 0), 1)
  assert.deepEqual(scenario.mechanics, { defenses: true }, '引擎 location-defenses 的声明读点')
  assert.equal(LOCATIONS.theFarmhouse.noLocationDefenses, true)
})

// ---------------------------------------------------------------------------
// 5. 敌人牌库规则
// ---------------------------------------------------------------------------

test('P7 theLongestNight 敌人牌库：议程放毁灭后按玩家顺序每人抽 1 张', () => {
  const { state } = setup(3)
  const api = quietApi()
  assert.equal(behavior.enemyDeckSize(state), 14)
  assert.equal(behavior.doomPlaced(state, { agenda: true, amount: 1 }, api), true)
  assert.equal(behavior.enemyDeckSize(state), 11, '3 位调查员各抽 1 张')
  assert.equal(behavior.doomPlaced(state, { agenda: false, amount: 1 }, api), false, '非议程放毁灭不触发')
})

test('P7 theLongestNight 敌人牌库：耗尽时把弃牌堆洗回、弃置路由到敌人弃牌堆', () => {
  const { state } = setup(1)
  const api = quietApi()
  const piles = state.scenarioFlags.mechanics.scenarioDecks.enemyDeck
  piles.deck = []
  piles.discard = ['10644a', '10645a']
  const drawn = behavior.drawFromEnemyDeck(state, 0, api)
  assert.ok(['10644a', '10645a'].includes(drawn))
  assert.equal(piles.deck.length, 1, '洗回后剩下 1 张')
  assert.equal(piles.discard.length, 0)
  behavior.discardToEnemyDeck(state, '10648', api)
  assert.equal(behavior.enemyDeckDiscard(state).includes('10648'), true)
  // 单卡条目的弃置路由是引擎读点（routeEnemyDiscardToScenarioDeck）。
  for (const code of ENEMY_CARD_CODES) {
    assert.equal(entryOf(code).enemyRule?.discardToScenarioDeck, 'enemyDeck', `${code} 弃置到敌人牌库`)
  }
})

test('P7 theLongestNight 敌人牌库：吉迪恩法典让下一次抽牌改为弃掉', () => {
  const { state } = setup(1)
  const api = quietApi()
  const top = state.scenarioFlags.mechanics.scenarioDecks.enemyDeck.deck.at(-1)
  assert.equal(behavior.codexEntry(state, 0, 6, api), true)
  assert.equal(behavior.drawFromEnemyDeck(state, 0, api), null, '改为弃掉，不结算')
  assert.equal(behavior.enemyDeckDiscard(state).includes(top), true)
  assert.equal(behavior.enemyDeckSize(state), 13)
  assert.equal(state.campaign.records.gideonStoodByYou, true)
})

test('P7 theLongestNight 敌人生成方向：外围农田四向 + 敌人最少/最多', () => {
  const { state } = setup(2)
  assert.equal(behavior.spawnLocation(state, '10644a', 'theFarmhouse', null, quietApi()), 'outerFieldsDesolateHills')
  assert.equal(behavior.spawnLocation(state, '10644b', 'theFarmhouse', null, quietApi()), 'outerFieldsScorchedKnoll')
  assert.equal(behavior.spawnLocation(state, '10644c', 'theFarmhouse', null, quietApi()), 'outerFieldsBloodiedPaths')
  assert.equal(behavior.spawnLocation(state, '10645a', 'theFarmhouse', null, quietApi()), 'outerFieldsBlightedCornfields')
  assert.equal(behavior.spawnLocation(state, '10647b', 'theFarmhouse', null, quietApi()), 'outerFieldsDesolateHills')
  // 敌人最少 / 最多的外围农田。
  const empty = behavior.fewestOuterField(state)
  assert.equal(['outerFieldsBloodiedPaths', 'outerFieldsDesolateHills', 'outerFieldsBlightedCornfields', 'outerFieldsScorchedKnoll'].includes(empty), true)
  behavior.spawnScenarioEnemy(state, '10648', 'outerFieldsScorchedKnoll')
  behavior.spawnScenarioEnemy(state, '10648', 'outerFieldsScorchedKnoll')
  assert.equal(behavior.mostOuterField(state), 'outerFieldsScorchedKnoll')
  assert.equal(behavior.spawnLocation(state, '10646', null, null, quietApi()).includes('outerFields'), true)
  assert.equal(behavior.spawnLocation(state, URSINE_CODE, 'theFarmhouse', null, quietApi()), 'theFarmhouse',
    '没有印刷生成方向时保留传入地点')
})

test('P7 theLongestNight 敌人修正：乌尔辛 +3/人生命、鸡笼 +1 战斗/躲避、谷仓 +1 伤害、伤害封顶', () => {
  const { state, report } = setup(2)
  const ursine = state.enemies.find(enemy => enemy.code === URSINE_CODE)
  assert.equal(behavior.enemyStatModifier(state, ursine, 'health'), 6, '3×2 人')
  const coop = locationId(state, '10633')
  const normal = behavior.spawnScenarioEnemy(state, '10645a', coop)
  assert.equal(behavior.enemyStatModifier(state, normal, 'fight'), 1)
  assert.equal(behavior.enemyStatModifier(state, normal, 'evade'), 1)
  assert.equal(behavior.enemyStatModifier(state, normal, 'health'), 0)
  // 鸡笼有诱饵 → -2 帷幕；否则 0。
  assert.equal(behavior.locationShroudModifier(state, state.locations.find(loc => loc.id === coop)), 0)
  behavior.placeDefense(state, 'decoy', coop, 0, quietApi())
  assert.equal(behavior.locationShroudModifier(state, state.locations.find(loc => loc.id === coop)), -2)
  // 谷仓 +1 伤害。
  const barn = locationId(state, '10634')
  const inBarn = behavior.spawnScenarioEnemy(state, '10646', barn)
  assert.deepEqual(behavior.enemyAttackModifier(state, inBarn, state.investigators[0]), { damage: 1, horror: 0 })
  assert.deepEqual(behavior.enemyAttackModifier(state, normal, state.investigators[0]), {})
  // 易羽/马状：任何伤害降为 1。
  const molting = behavior.spawnScenarioEnemy(state, '10644a', barn)
  assert.equal(behavior.enemyDamageAmount(state, molting, 5), 1)
  assert.equal(behavior.enemyDamageAmount(state, inBarn, 5), undefined)
  assert.equal(behavior.enemyDamageAmount(state, molting, 0), 0)
  assert.equal(behavior.enemyDamageAmount(state, normal, 5), undefined)
  assert.equal(behavior.enemyDamageAmount(state, molting, 5, quietApi(), 0, FIRE_CODE), 1, 'Fire! 只被蠕滑混种忽略')
})

test('P7 theLongestNight 敌人关键词：忽略工事、巡逻农庄、乌尔辛田野互连', () => {
  const { state } = setup(2)
  assert.deepEqual([...entryOf('10643').enemyRule.ignoreDefenses], ['barrier', 'decoy'])
  assert.deepEqual([...entryOf('10646').enemyRule.ignoreDefenses], ['decoy'])
  assert.deepEqual([...entryOf('10647a').enemyRule.ignoreDefenses], ['trap'])
  assert.deepEqual([...entryOf('10648').enemyRule.ignoreDefenses], ['barrier', 'decoy', 'trap'])
  assert.deepEqual(entryOf('10644a').enemyRule.patrolTarget, { kind: 'named', locationId: 'theFarmhouse' })
  assert.equal(entryOf('10643').enemyRule.patrolTarget, undefined, '乌尔辛是猎手，没有巡逻')
  const ursine = state.enemies.find(enemy => enemy.code === URSINE_CODE)
  const west = ursine.location
  const connected = behavior.enemyConnections(state, ursine, state.locations.find(loc => loc.id === west))
  assert.deepEqual([...connected].sort(), ['outerFieldsBlightedCornfields', 'outerFieldsDesolateHills', 'outerFieldsScorchedKnoll'].sort(),
    '[[田野]]地点视为彼此连接')
  assert.deepEqual(behavior.enemyConnections(state, state.enemies[0], state.locations.find(loc => loc.id === 'theFarmhouse')), [])
})

test('P7 theLongestNight 敌人：狼形攻击后自愈 1 点、葡萄园进入时自愈 1 点', () => {
  const { state } = setup(2)
  const api = quietApi()
  const vineyard = locationId(state, '10632')
  const lupine = behavior.spawnScenarioEnemy(state, '10645a', locationId(state, '10635'))
  lupine.damageTaken = 3
  behavior.enemyAttackResolved(state, lupine, state.investigators[0], api)
  assert.equal(lupine.damageTaken, 2)
  behavior.enemyMoved(state, lupine, lupine.location, api)
  assert.equal(lupine.damageTaken, 2)
  lupine.location = vineyard
  behavior.enemyMoved(state, lupine, 'pasture', api)
  assert.equal(lupine.damageTaken, 1, '进入葡萄园治愈 1 点')
})

test('P7 theLongestNight 敌军阶段：农庄里重整且未交战的敌人攻击病俘（恐惧也变伤害）', () => {
  const { state } = setup(2)
  const api = quietApi()
  behavior.spawnScenarioEnemy(state, '10643', 'theFarmhouse') // 3 伤害 + 2 恐惧
  behavior.damageCaptives(state, 4, api)
  behavior.enemyPhaseEnd(state, api)
  assert.equal(captivesDamage(state), 9, '4 + (3+2)')
  behavior.enemyPhaseEnd(state, api)
  assert.equal(captivesDamage(state), 14, '超过 10 点：病俘被击败')
  assert.equal(state.scenarioFlags.theLongestNightCaptivesDefeated, true)
})

test('P7 theLongestNight 病俘：击败时进入结局 3（引擎 finish 读点）', () => {
  const api = engineishApi()
  const state = stateWithScenario(2)
  api.state = state
  behavior.setupScenario(state, api)
  behavior.damageCaptives(state, 10, api)
  assert.equal(api.finished, 'resolution3')
})

// ---------------------------------------------------------------------------
// 6. 幕 / 议程
// ---------------------------------------------------------------------------

test('P7 theLongestNight 幕 1 背面：病俘 ≤4 伤害 → 结局 1，否则结局 2', () => {
  for (const [damage, expected] of [[0, 'resolution1'], [4, 'resolution1'], [5, 'resolution2'], [9, 'resolution2']]) {
    const api = engineishApi()
    const { state } = setup(2, {}, api)
    api.state = state
    if (damage) behavior.damageCaptives(state, damage, quietApi())
    assert.equal(behavior.actReveal(state, state.acts[0], api), true)
    assert.equal(api.finished, expected)
  }
  const { state } = setup(2)
  assert.equal(behavior.actReveal(state, state.acts[0], quietApi()), true, '没有 api.finish 时写 state.resolution')
  assert.equal(state.resolution, 'resolution1')
})

test('P7 theLongestNight 议程 1 背面：精神创伤或牺牲居民，然后推进幕', () => {
  const api = engineishApi()
  const { state } = setup(2, {}, api)
  api.state = state
  assert.equal(behavior.agendaReveal(state, state.agendas[0], { ...api, choose: () => 'mentalTrauma' }), true)
  assert.equal(api.trauma.length, 2)
  assert.equal(api.trauma.every(row => row.kind === 'mental' && row.amount === 1), true)
  assert.equal(api.finished, 'resolution1', '议程背面推进幕 → 幕背面结算结局')
  // 牺牲居民路径：在调查员控制下的[[居民]]剧情资产被划掉/移除。
  const second = setup(2, {}, engineishApi())
  second.state.storyAssets.push({ id: 'resident-1', code: '10521', name: '莉亚·阿特伍德', traits: ['Resident'],
    controllerSeat: 0, location: 'theFarmhouse' })
  const sacrifice = engineishApi()
  sacrifice.state = second.state
  second.state.agendas = [structuredClone(AGENDA_STAGES[1])]
  const choose = request => (request.options.some(option => option.id === 'sacrificeResident') ? 'sacrificeResident' : request.options[0].id)
  behavior.agendaReveal(second.state, second.state.agendas[0], { ...sacrifice, choose })
  assert.equal(second.state.scenarioFlags.theLongestNightSacrificedResident, '10521')
  assert.equal(second.state.storyAssets.some(asset => asset.id === 'resident-1'), false)
  assert.equal(sacrifice.trauma.length, 0)
})

test('P7 theLongestNight 议程正面：卡牌效果的毁灭改放病俘，神话阶段的毁灭留在议程', () => {
  const { state } = setup(2)
  const api = quietApi()
  assert.equal(behavior.doomPlacementReplacement(state, 2, api, { source: 'effect' }), true)
  assert.equal(behavior.captivesAsset(state).doom, 2)
  assert.equal(behavior.doomPlacementReplacement(state, 1, api, { source: 'mythos' }), false)
  state.storyAssets = state.storyAssets.filter(asset => asset.code !== CAPTIVES_CODE)
  assert.equal(behavior.doomPlacementReplacement(state, 1, api, { source: 'effect' }), false, '病俘不在场时不替换')
})

// ---------------------------------------------------------------------------
// 7. 混乱标记
// ---------------------------------------------------------------------------

test('P7 theLongestNight 混乱标记：[skull] 半毁灭向上取整 / 困难为全毁灭', () => {
  const { state } = setup(2)
  state.doom = 5
  assert.equal(doomInPlay(state), 5)
  assert.equal(halfDoomInPlay(state), 3, '向上取整')
  state.difficulty = 'standard'
  assert.equal(theLongestNightChaosTokenValue(state, 'skull'), -3)
  state.difficulty = 'easy'
  assert.equal(theLongestNightChaosTokenValue(state, 'skull'), -3)
  state.difficulty = 'hard'
  assert.equal(theLongestNightChaosTokenValue(state, 'skull'), -5)
  state.difficulty = 'expert'
  assert.equal(theLongestNightChaosTokenValue(state, 'skull'), -5)
  const enemy = behavior.spawnScenarioEnemy(state, '10646', 'barn')
  enemy.doom = 3
  state.doom = 1
  assert.equal(doomInPlay(state), 4, '场上每张卡的毁灭都计入')
  assert.equal(theLongestNightChaosTokenValue(state, 'skull'), -4)
  assert.equal(theLongestNightChaosTokenValue(state, 'frost'), null, '未知标记交回引擎默认表')
})

test('P7 theLongestNight 混乱标记：四档数值与 onDraw/onFail 追加效果', () => {
  const { state } = setup(2)
  state.difficulty = 'standard'
  assert.deepEqual(theLongestNightChaosToken(state, null, 'cultist'), {
    delta: -2, onDraw: [{ type: 'scenarioToken', token: 'cultist', mode: 'always' }], onFail: [] })
  assert.deepEqual(theLongestNightChaosToken(state, null, 'tablet'), {
    delta: -1, drawAnother: true, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'tablet', mode: 'fail' }] })
  assert.deepEqual(theLongestNightChaosToken(state, null, 'elderthing'), {
    delta: -4, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'elderthing', mode: 'fail' }] })
  state.difficulty = 'hard'
  assert.deepEqual(theLongestNightChaosToken(state, null, 'cultist'), {
    delta: -3, onDraw: [{ type: 'scenarioToken', token: 'cultist', mode: 'success' }], onFail: [] })
  assert.deepEqual(theLongestNightChaosToken(state, null, 'tablet'), {
    delta: -4, onDraw: [{ type: 'scenarioToken', token: 'tablet', mode: 'always' }], onFail: [] })
  assert.deepEqual(theLongestNightChaosToken(state, null, 'elderthing'), {
    delta: -5, onDraw: [{ type: 'scenarioToken', token: 'elderthing', mode: 'always' }], onFail: [] })
  assert.equal(THE_LONGEST_NIGHT_TOKEN_MEANINGS.standard.cultist.delta, -2)
  assert.equal(THE_LONGEST_NIGHT_TOKEN_MEANINGS.hard.cultist.rider, 'placeBarrierOnSuccess')
})

test('P7 theLongestNight 混乱标记追加效果：[cultist] 放屏障、[tablet] 最近敌人攻击、[elder_thing] 移除工事', () => {
  const { state } = setup(2)
  const api = quietApi()
  const inv = state.investigators[0]
  inv.location = 'vineyard'
  assert.equal(behavior.applyTokenEffect(state, inv, { token: 'cultist', mode: 'always' }, api), true)
  assert.equal(behavior.barrierCountAt(state, 'vineyard'), 1, '每揭示 1 次放 1 个屏障')
  // [tablet]：最近的敌人重整、移动并攻击（这里只留一个敌人，且就在你的地点）。
  state.enemies = state.enemies.filter(item => item.code !== URSINE_CODE)
  const enemy = behavior.spawnScenarioEnemy(state, '10645a', 'vineyard')
  enemy.exhausted = true
  const attacks = []
  behavior.applyTokenEffect(state, inv, { token: 'tablet', mode: 'always' }, {
    ...api, attack: (target, targetInv) => attacks.push([target.id, targetInv.seat]),
  })
  assert.equal(enemy.exhausted, false)
  assert.deepEqual(attacks, [[enemy.id, 0]])
  // [elder_thing]：移除诱饵/陷阱/屏障。
  behavior.placeDefense(state, 'trap', 'vineyard', 0, api)
  assert.equal(behavior.applyTokenEffect(state, inv, { token: 'elderthing', mode: 'always' },
    { ...api, choose: request => (request.options.some(option => option.id === 'trap') ? 'trap' : request.options[0].id) }), true)
  assert.equal(behavior.trapAt(state, 'vineyard'), false)
})

test('P7 theLongestNight 混乱标记：[cultist] 困难/专家只在检定成功时放屏障', () => {
  const { state } = setup(2)
  const api = quietApi()
  const inv = state.investigators[0]
  inv.location = 'barn'
  state.difficulty = 'hard'
  behavior.applyTokenEffect(state, inv, { token: 'cultist', mode: 'success' }, api)
  assert.equal(state.scenarioFlags.theLongestNightCultistBarrierPending, true)
  assert.equal(behavior.afterTest(state, inv, { success: false }, api), false)
  assert.equal(behavior.barrierCountAt(state, 'barn'), 0)
  behavior.applyTokenEffect(state, inv, { token: 'cultist', mode: 'success' }, api)
  assert.equal(behavior.afterTest(state, inv, { success: true }, api), true)
  assert.equal(behavior.barrierCountAt(state, 'barn'), 1)
})

// ---------------------------------------------------------------------------
// 8. 地点能力
// ---------------------------------------------------------------------------

test('P7 theLongestNight 农庄：获得线索行动（团队每轮一次）与快速移动（1/人资源）', () => {
  const { state } = setup(2)
  const api = quietApi()
  const inv = state.investigators[0]
  inv.location = 'theFarmhouse'
  inv.clues = 0
  const clueMove = behavior.actions(state, inv).find(item => item.rule === 'theLongestNightFarmhouseClue')
  assert.ok(clueMove)
  assert.equal(behavior.performAction(state, inv, clueMove, api), true)
  assert.equal(inv.clues, 1)
  assert.equal(behavior.actions(state, inv)
    .find(item => item.rule === 'theLongestNightFarmhouseClue').reason, '农庄的获得线索行动本轮已由团队使用')
  behavior.roundEnded(state, api)
  assert.equal(behavior.limitUsed(state, 'farmhouseClue', 'round'), false, '轮末复位')
  const move = behavior.actions(state, inv).find(item => item.rule === 'theLongestNightFarmhouseMove' && item.destination === 'milkhouse')
  assert.ok(move)
  inv.resources = 3
  assert.equal(behavior.performAction(state, inv, move, api), true)
  assert.equal(inv.resources, 1, '2 人局费用 2')
  assert.equal(inv.location, 'milkhouse')
})

test('P7 theLongestNight 牧场/葡萄园：陷阱时快速移动、快速交战每回合一次', () => {
  const { state } = setup(2)
  const api = quietApi()
  behavior.placeDefense(state, 'trap', 'pasture', 0, api)
  const inv = state.investigators[0]
  inv.location = 'pasture'
  const move = behavior.actions(state, inv).find(item => item.rule === 'theLongestNightPastureMove' && item.destination === 'theFarmhouse')
  assert.ok(move)
  assert.equal(behavior.performAction(state, inv, move, api), true)
  assert.equal(inv.location, 'theFarmhouse')

  const second = state.investigators[1]
  second.location = 'vineyard'
  const enemy = behavior.spawnScenarioEnemy(state, '10646', 'vineyard')
  const engage = behavior.actions(state, second).find(item => item.rule === 'theLongestNightVineyardEngage' && item.enemyId === enemy.id)
  assert.ok(engage)
  assert.equal(behavior.performAction(state, second, engage, api), true)
  assert.equal(enemy.engagedSeat, 1)
  assert.equal(behavior.actions(state, second)
    .some(item => item.rule === 'theLongestNightVineyardEngage' && !item.reason), false, '每回合一次')
  behavior.roundEnded(state, api)
  assert.equal(behavior.limitUsed(state, 'vineyardEngage', 'turn'), false)
})

test('P7 theLongestNight Fire!：牛奶房/鸡笼抽 1 张放在一边的 Fire! 并把另 1 张洗入遭遇牌库', () => {
  const { state } = setup(2)
  const api = quietApi()
  const inv = state.investigators[0]
  inv.location = 'coop'
  assert.equal(state.scenarioZones.setAside.filter(code => code === FIRE_CODE).length, 5)
  const action = behavior.actions(state, inv).find(item => item.rule === 'theLongestNightFireDraw')
  assert.ok(action)
  assert.equal(behavior.performAction(state, inv, action, api), true)
  assert.equal(state.scenarioZones.setAside.filter(code => code === FIRE_CODE).length, 3, '抽 1 + 洗入 1')
  assert.equal(state.encounterDeck.filter(code => code === FIRE_CODE).length, 1)
  assert.equal(behavior.actions(state, inv)
    .find(item => item.rule === 'theLongestNightFireDraw').reason, '本地点本轮的「着火了！」已经抽过')
})

test('P7 theLongestNight 外围农田：查看敌人牌库顶、发现最后线索的反应、移动敌人', () => {
  const { state } = setup(1)
  const api = quietApi()
  const inv = state.investigators[0]
  inv.location = 'outerFieldsDesolateHills'
  const peek = behavior.actions(state, inv).find(item => item.rule === 'theLongestNightEnemyDeckPeek')
  assert.ok(peek)
  assert.equal(behavior.performAction(state, inv, peek, { ...api, choose: () => 'discard' }), true)
  assert.equal(behavior.enemyDeckSize(state), 13, '1 人局查看顶 1 张并弃掉')
  assert.equal(behavior.enemyDeckDiscard(state).length, 1)
  assert.equal(behavior.limitUsed(state, `peek:${inv.location}`, 'game'), true)
  // 发现最后线索：血染小径治愈病俘 2 点（每场游戏一次）。
  behavior.damageCaptives(state, 4, api)
  const bloodied = state.locations.find(loc => loc.code === '10636')
  bloodied.clues = 0
  behavior.cluesRemoved(state, bloodied, 1, api)
  assert.equal(captivesDamage(state), 2)
  behavior.cluesRemoved(state, bloodied, 1, api)
  assert.equal(captivesDamage(state), 2, '每场游戏一次')
  // 移动敌人：把一个敌人移动到连接地点。
  inv.location = 'outerFieldsBloodiedPaths'
  const enemy = behavior.spawnScenarioEnemy(state, '10645a', 'outerFieldsBloodiedPaths')
  const move = behavior.actions(state, inv).find(item => item.rule === 'theLongestNightMoveEnemy')
  assert.ok(move)
  assert.equal(behavior.performAction(state, inv, move, { ...api, choose: request =>
    (request.options.some(option => option.id === enemy.id) ? enemy.id
      : (request.options.some(option => option.id === 'vineyard') ? 'vineyard' : request.options[0].id)) }), true)
  assert.equal(enemy.location, 'vineyard')
})

test('P7 theLongestNight 谷仓：揭示时埃阿斯入场并由队长控制（codex Ω）', () => {
  const { state } = setup(2)
  const ajax = state.investigators[0].assets.find(asset => asset.code === AJAX_CODE)
  assert.ok(ajax)
  assert.equal(state.storyAssets.some(asset => asset.code === AJAX_CODE), false)
  assert.equal(ajax.controllerSeat, 0)
  assert.equal(state.campaign.records.codex === undefined, true)
  assert.equal(state.scenarioFlags.codexResolved.includes('omega'), true)
  // 未受控剧情支援的章节动作在接管后消失；同地点接管已进入支援自身能力。
  state.investigators[1].location = 'barn'
  const take = behavior.actions(state, state.investigators[1]).find(item => item.rule === 'theLongestNightTakeAjax')
  assert.equal(take, undefined, '已被控制时没有接管行动')
})

// ---------------------------------------------------------------------------
// 9. 诡计事件
// ---------------------------------------------------------------------------

test('P7 theLongestNight 无尽夜晚：三选一（移除毁灭 / 病俘 2 伤害 / 3+3）', () => {
  const api = quietApi()
  const { state } = setup(2)
  state.doom = 3
  const inv = state.investigators[0]
  assert.equal(entryOf('10649').encounterResolve(state, inv, {}, {
    ...api, resolveScenarioEvent: (id, payload) => behavior.events[id](state, payload, { ...api, choose: () => 'doom' }),
  }), false, '揭示后进弃牌堆')
  assert.equal(state.doom, 2)
  behavior.events.theLongestNightEndlessNight(state, { seat: 0 }, { ...api, choose: () => 'captives' })
  assert.equal(captivesDamage(state), 2)
  behavior.events.theLongestNightEndlessNight(state, { seat: 0 }, { ...api, choose: () => 'damage' })
  assert.equal(inv.damage, 3)
  assert.equal(inv.horror, 3)
})

test('P7 theLongestNight 入侵：检定[敏捷] X=半毁灭，失败点数逐个重整最近的[[突变]]敌人', () => {
  const { state } = setup(2)
  const api = quietApi()
  state.doom = 4
  const west = 'outerFieldsBloodiedPaths'
  const lupine = behavior.spawnScenarioEnemy(state, '10645a', west)
  lupine.exhausted = true
  const desolate = behavior.spawnScenarioEnemy(state, '10645b', 'outerFieldsDesolateHills')
  desolate.exhausted = true
  let tested = null
  const resolveEvent = {
    ...api,
    test: (seat, skill, difficulty, resolve) => { tested = { seat, skill, difficulty }; resolve({ success: false, difficulty, value: 1 }) },
  }
  assert.equal(entryOf('10650').encounterResolve(state, state.investigators[0], {}, {
    ...resolveEvent,
    resolveScenarioEvent: (id, payload) => behavior.events[id](state, payload, resolveEvent),
  }), false)
  assert.deepEqual(tested, { seat: 0, skill: 'agility', difficulty: 2 })
  assert.equal(desolate.exhausted, false, '失败 1 点 → 离农庄最近的[[突变]]敌人重整')
  assert.equal(lupine.exhausted, true, '只触发一个（失败 1 点）')
})

// ---------------------------------------------------------------------------
// 10. 结局与记录
// ---------------------------------------------------------------------------

test('P7 theLongestNight 结局 1：病俘伤害决定奖励经验 + 结局 4 记录', () => {
  for (const [damage, expected] of [[0, 5], [2, 4], [3, 3]]) {
    const api = engineishApi()
    const { state } = setup(2, { time: 1 }, api)
    api.state = state
    behavior.damageCaptives(state, damage, quietApi())
    const result = behavior.resolution(state, 'resolution1', [], api)
    assert.equal(result.bonus, expected, `伤害 ${damage} → ${expected} 经验`)
    assert.equal(result.resolution, 'resolution4')
    const records = state.campaign.records
    assert.equal(records[RECORD_KEYS.captivesSaved], true)
    assert.equal(records[RECORD_KEYS.drMarquezHasAPlan], true)
    assert.equal(records[RECORD_KEYS.areasSurveyedSouthernFields], true)
    assert.equal(records[RECORD_KEYS.resolution], 'resolution4')
    assert.equal(records.drMarquezJoinedTheInvestigators, true)
    assert.equal(records.ajaxJoinedTheInvestigators, true, '埃阿斯在调查员控制下')
  }
})

test('P7 theLongestNight 结局 2：5–9 点伤害给予 3/2/1 经验并记录许多病俘遇难', () => {
  for (const [damage, expected] of [[5, 3], [7, 2], [9, 1]]) {
    const { state } = setup(2)
    behavior.damageCaptives(state, damage, quietApi())
    const result = behavior.resolution(state, 'resolution2', [], quietApi())
    assert.equal(result.bonus, expected)
    assert.equal(state.campaign.records[RECORD_KEYS.captivesLost], true)
  }
})

test('P7 theLongestNight 结局 3：全员撤退/无结局 → 结局 3，每人为随机基础疯狂弱点', () => {
  const api = engineishApi()
  const { state } = setup(2, {}, api)
  api.state = state
  api.addBasicWeakness = (seat, traits) => { api.trauma.push({ seat, traits }); return '01006' }
  assert.equal(behavior.allResigned(state, api), true)
  assert.equal(api.finished, 'resolution3')
  const result = behavior.resolution(state, 'noResolution', [], api)
  assert.equal(result.resolution, 'resolution4')
  assert.equal(state.campaign.records[RECORD_KEYS.allCaptivesLost], true)
  assert.equal(api.trauma.length, 2)
  assert.deepEqual(api.trauma[0].traits, ['madness'])
})

test('P7 theLongestNight 结局 4：胜利区经验、埃阿斯与马奎兹入牌组记录', () => {
  const { state } = setup(2)
  state.victory = 3
  state.victoryDisplay = [{ cardCode: URSINE_CODE, victory: 2 }]
  const result = behavior.resolution(state, 'resolution4', [], quietApi())
  assert.equal(result.bonus, 3, '胜利区经验（state.victory 优先）')
  assert.equal(state.campaign.records[RECORD_KEYS.drMarquezHasAPlan], true)
  assert.equal(state.campaign.records[RECORD_KEYS.resolution], 'resolution4')
})

test('P7 theLongestNight 调查员败北：被击败的调查员被吞噬，其余人继续结算', () => {
  const { state } = setup(2)
  state.investigators[0].defeated = true
  const result = behavior.resolution(state, 'investigatorDefeat', [], quietApi())
  assert.equal(result.resolution, 'investigatorDefeat')
  assert.equal(state.investigators[0].killed, true)
  assert.equal(state.campaign.records.investigatorDefeat, true)
})

// ---------------------------------------------------------------------------
// 11. 法典（2–8 / Θ / Ω）
// ---------------------------------------------------------------------------

test('P7 theLongestNight 法典 2–8：记录「站在你这边」并结算各自效果', () => {
  const api = quietApi()
  const { state } = setup(2)
  const inv = state.investigators[0]
  inv.location = 'barn'
  const enemy = behavior.spawnScenarioEnemy(state, '10645a', 'barn')
  enemy.damageTaken = 0
  assert.equal(behavior.codexEntry(state, 0, 2, api), true)
  assert.equal(enemy.damageTaken, 3, '法典 2：对最近的敌人 3 点伤害')
  assert.equal(state.campaign.records.leahStoodByYou, true)
  assert.equal(behavior.codexEntry(state, 0, 3, api), true)
  assert.equal(state.campaign.records.simeonStoodByYou, true)
  assert.equal(behavior.defenseStore(state).decoy.length >= 1, true, '法典 3：任意地点放诱饵')
  const before = inv.clues
  assert.equal(behavior.codexEntry(state, 0, 4, api), true)
  assert.equal(inv.clues, before + 1, '法典 4：每位调查员 1 线索')
  assert.equal(behavior.codexEntry(state, 0, 5, api), true)
  assert.equal(state.campaign.records.riverStoodByYou, true)
  assert.equal(behavior.codexEntry(state, 0, 6, api), true)
  assert.equal(state.scenarioFlags.theLongestNightDiscardNextEnemyDraw, true)
  assert.equal(behavior.codexEntry(state, 0, 7, api), true)
  assert.equal(state.campaign.records.judithStoodByYou, true)
  assert.equal(behavior.codexEntry(state, 0, 8, api), true)
  assert.equal(state.campaign.records.theoStoodByYou, true)
  assert.equal(behavior.codexEntry(state, 0, 2, api), false, '同一条目只结算一次')
  assert.equal(behavior.codexEntry(state, 0, 'theta', api), true)
  assert.equal(state.scenarioFlags.codexResolved.includes('theta'), true)
})

// ---------------------------------------------------------------------------
// 12. 存档往返
// ---------------------------------------------------------------------------

test('P7 theLongestNight JSON 往返：工事、敌人牌库、病俘与记录都能继续结算', () => {
  const api = engineishApi()
  const { state } = setup(2, { [RECORD_KEYS.facedAlone]: true }, api)
  api.state = state
  behavior.doomPlaced(state, { agenda: true, amount: 1 }, quietApi())
  behavior.damageCaptives(state, 3, quietApi())
  behavior.placeDefense(state, 'trap', 'barn', 0, quietApi())
  const restored = clone(state)
  assert.equal(restored.scenario.id, 'theLongestNight')
  assert.equal(behavior.enemyDeckSize(restored), 12)
  assert.equal(behavior.captivesDamage(restored), 3)
  assert.equal(behavior.trapAt(restored, 'barn'), true)
  assert.equal(behavior.barrierEdges(restored).reduce((sum, edge) => sum + edge.count, 0), 1)
  restored.acts = [structuredClone(ACT_STAGES[1])]
  restored.actIndex = 0
  const restoreApi = engineishApi()
  restoreApi.state = restored
  behavior.actReveal(restored, restored.acts[0], restoreApi)
  assert.equal(restoreApi.finished, 'resolution1')
  const result = behavior.resolution(restored, 'resolution1', [], restoreApi)
  assert.equal(restored.campaign.records[RECORD_KEYS.captivesSaved], true)
  assert.equal(typeof result.bonus, 'number')
})

test('P7 theLongestNight 披露：无法表达的子句集中声明（随机移除/开场揭示/居民与法典触发）', () => {
  assert.equal(behavior.approximations.length >= 5, true)
  assert.ok(behavior.approximations.some(text => text.includes('随机移除')))
  assert.ok(behavior.approximations.some(text => text.includes('居民')))
  assert.ok(behavior.approximations.some(text => text.includes('病俘')))
  assert.ok(behavior.approximations.some(text => text.includes('法典')))
  assert.ok(behavior.approximations.some(text => text.includes('Atwood Farm')))
  assert.equal(behaviorModule.approximations, behavior.approximations, '命名导出与 behavior 表同一份声明')
})
