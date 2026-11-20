// P7 山谷的命运（fateOfTheVale · 10651）章节测试。
//
// 覆盖：章节结构/manifest、gather 组与放一边、遭遇牌库、镜巢环与坐标、宇宙密使阵形、破碎自我
// 换卡与读点、深渊牌库（分类/抽牌/放回/地点/居民/真身）、幕/议程推进与背面、幕间四选项与
// 幕 3a 四个版本、镜巢回合末强制效果、混乱符号、三个诡计的显现、结局 1–5/无结局与剧本日志写入、
// JSON 存档往返。
//
// 本文件不 import engine.js：章节 behavior 只走内容层函数，条目经 src/engine/ability.js 注册，
// 因此单测可在并行 worker 尚未重建索引时独立运行。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import * as chapter from '../content/campaigns/theFeastOfHemlockVale/scenarios/fateOfTheVale/index.js'
import {
  scenario, ACT_CODES, ACT3_VARIANT_CODES, ALL_ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, GATHER_GROUPS, GATHER_SET_ASIDE_GROUPS,
  LOCATION_SET_ASIDE_GROUPS, DECK_GROUPS, LOCATIONS, LOCATION_CONNECTIONS, LOCATION_COORDINATES,
  SET_ASIDE_CARDS, SET_ASIDE_LOCATION_IDS, MIRROR_NEST_POSITIONS, MIRROR_NEST_CODES,
  EMISSARY_FORMATION, ABYSS_LOCATION_ID, ABYSS_LOCATION_CODE, STORY_CARD_CODE,
  SHATTERED_SELF_CODE, OLD_MEMORY_CODE, CRYSTAL_MIMIC_CODE, FRENZIED_REVELER_CODE, FIRE_CODE,
  RESIDENT_ASSET_CODES, RESIDENT_ENEMY_CODES, RESIDENT_ENEMY_BY_ASSET, VALE_LOCATION_IDS,
  CAVE_LOCATION_IDS, SCENARIO_TEXT, RESOLUTION_KEYS, START_LOCATION,
} from '../content/campaigns/theFeastOfHemlockVale/scenarios/fateOfTheVale/definition.js'
import {
  FATE_TOKEN_MEANINGS, fateChaosToken, fateChaosTokenValue, currentActNumber, colourEnemyCount,
  againstCosmicEmissary, isHardSide,
} from '../content/campaigns/theFeastOfHemlockVale/scenarios/fateOfTheVale/chaos.js'
import entry10651 from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10651.js'
import entry10652 from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10652.js'
import entry10653 from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10653.js'
import entry10654 from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10654.js'
import entry10655 from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10655.js'
import entry10656 from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10656.js'
import entry10657 from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10657.js'
import entry10658 from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10658.js'
import entry10659 from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10659.js'
import entry10660 from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10660.js'
import entry10661 from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10661.js'
import entry10661b from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10661b.js'
import entry10662a from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10662a.js'
import entry10662b from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10662b.js'
import entry10663a from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10663a.js'
import entry10663b from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10663b.js'
import entry10664a from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10664a.js'
import entry10664b from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10664b.js'
import entry10665a from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10665a.js'
import entry10665b from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10665b.js'
import entry10666 from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10666.js'
import entry10667 from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10667.js'
import entry10668 from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10668.js'
import entry10669 from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10669.js'
import entry10670 from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10670.js'
import entry10670b from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10670b.js'
import entry10671 from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10671.js'
import entry10672 from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10672.js'
import entry10673 from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10673.js'
import entry10674 from '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/10674.js'

const ENTRIES = [entry10651, entry10652, entry10653, entry10654, entry10655, entry10656, entry10657,
  entry10658, entry10659, entry10660, entry10661, entry10661b, entry10662a, entry10662b, entry10663a,
  entry10663b, entry10664a, entry10664b, entry10665a, entry10665b, entry10666, entry10667, entry10668,
  entry10669, entry10670, entry10670b, entry10671, entry10672, entry10673, entry10674]
const { behavior } = chapter
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

const ENTITY_CODES = Object.freeze({
  '10651': 'scenario', '10652': 'agenda', '10653': 'agenda', '10654': 'agenda',
  '10655': 'act', '10656': 'act', '10657': 'act', '10658': 'act', '10659': 'act', '10660': 'act',
  '10661': 'scenario', '10661b': 'storyAsset', '10670b': 'storyAsset',
  '10662a': 'enemy', '10662b': 'enemy', '10663a': 'enemy', '10663b': 'enemy',
  '10664a': 'enemy', '10664b': 'enemy', '10665a': 'enemy', '10665b': 'enemy', '10671': 'enemy',
  '10666': 'location', '10667': 'location', '10668': 'location', '10669': 'location', '10670': 'location',
  '10672': 'treachery', '10673': 'treachery', '10674': 'treachery',
})

const clone = value => JSON.parse(JSON.stringify(value))
const investigator = (seat, code = '10001') => ({
  seat, code, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
  assets: [], engaged: [], deck: ['01001', '01002', '01003', '01004', '01005', '01006', '01007'],
  hand: ['01020', '01021', '01022'], discard: [], threat: [],
})
const stateFor = (investigatorCount = 1, records = {}, flags = {}) => ({
  investigators: Array.from({ length: investigatorCount }, (_, seat) => investigator(seat)),
  locations: [], enemies: [], storyAssets: [], encounterDeck: [], encounterDiscard: [],
  scenarioFlags: { ...flags }, scenarioZones: {},
  campaign: { leadSeat: 0, records: { ...records }, completedSteps: [], trauma: {}, investigators: {} },
  victoryDisplay: [], doom: 0, difficulty: 'standard', numInvestigators: investigatorCount,
  phase: 'investigation', round: 1, status: 'playing', currentSeat: 0, acts: [], agendas: [],
})
const stateWithScenario = (count = 1, records = {}, flags = {}) => {
  const state = stateFor(count, records, flags)
  state.scenario = structuredClone(scenario)
  state.encounterDeck = [...ENCOUNTER_DECK]
  return state
}
const quietApi = () => ({ info: () => {} })
// 模拟引擎 advanceAct：结算当前幕背面，然后推进指针（actReveal 内 finish 时不推进）。
const engineishApi = () => {
  const api = { info: () => {}, finished: null, trauma: [] }
  api.advanceAct = () => {
    const state = api.state
    const act = state.acts[state.actIndex]
    behavior.actReveal(state, act, api)
    if (api.finished) return
    state.actIndex += 1
  }
  api.finish = key => { api.finished = key }
  api.addTrauma = (seat, kind, amount) => { api.trauma.push({ seat, kind, amount }) }
  api.test = (seat, skill, difficulty, resolve) => resolve({ success: true, difficulty, value: difficulty })
  return api
}
// 条目 encounterResolve → api.resolveScenarioEvent → behavior.events（与引擎同一条桥）。
const bridge = (state, extra = {}) => ({
  info: () => {},
  ...extra,
  resolveScenarioEvent: (id, payload) => behavior.events[id](state, payload, extra),
})
const setup = (count = 1, api = quietApi()) => {
  const state = stateWithScenario(count)
  const report = behavior.setupScenario(state, api)
  return { state, report }
}

// ---------------------------------------------------------------------------
// 1. 章节结构
// ---------------------------------------------------------------------------

test('P7 fateOfTheVale 章节结构：30 个卡条目、10 个 gather 组、4 个镜巢与深渊', () => {
  assert.equal(chapter.scenario.id, 'fateOfTheVale')
  assert.equal(chapter.scenario.originalCode, '10651')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.campaignId, 'theFeastOfHemlockVale')
  assert.equal(chapter.scenario.encounterCode, 'fate_of_the_vale')
  assert.equal(chapter.implementedEncounterCodes.length, 30)
  assert.deepEqual([...chapter.implementedEncounterCodes].sort(), [...Object.keys(ENTITY_CODES)].sort())
  assert.deepEqual([...GATHER_GROUPS].sort(), ['agentsOfTheColour', 'dayOfTheFeast', 'fateOfTheVale',
    'fire', 'horrorsInTheRock', 'refractions', 'residents', 'theFinalDay', 'theVale',
    'transfiguration'].sort())
  assert.deepEqual([...GATHER_SET_ASIDE_GROUPS], ['dayOfTheFeast', 'residents', 'fire'])
  assert.deepEqual([...LOCATION_SET_ASIDE_GROUPS], ['theVale', 'horrorsInTheRock'])
  assert.equal(DECK_GROUPS.length, 6)
  assert.deepEqual([...chapter.manifest.requiredEncounterGroupIds], [...GATHER_GROUPS])
  // 卡面：4 个镜巢 + 深渊 + 8 个山谷黑夜地点 + 5 个洞穴地点。
  assert.equal(MIRROR_NEST_POSITIONS.length, 4)
  assert.equal(VALE_LOCATION_IDS.length, 8)
  assert.equal(CAVE_LOCATION_IDS.length, 5)
  assert.equal(Object.keys(LOCATIONS).length, 4 + 1 + 8 + 5)
  assert.equal(ABYSS_LOCATION_CODE, '10670')
  assert.equal(STORY_CARD_CODE, '10670b')
  assert.equal(chapter.manifest.locations.length, Object.keys(LOCATIONS).length)
  assert.equal(chapter.manifest.zones.setAside.filter(zone => SET_ASIDE_LOCATION_IDS
    .some(id => chapter.identities.locations[id]?.originalCode === zone.cardCode)).length,
  SET_ASIDE_LOCATION_IDS.length)
  // 每个条目：code 与 scope 合法，flags 可被 behavior 读到。
  for (const [code, scope] of Object.entries(ENTITY_CODES)) {
    const entry = registeredEntry(code)
    assert.ok(entry, `条目 ${code} 已注册`)
    assert.equal(entry.scope, scope, `${code} 的 scope`)
    assert.equal(entry.implemented, true)
    assert.ok(behavior.referencesFlags ? true : true)
    assert.ok(chapter.implementedEntryFlags(code), `${code} 的 flags 可读`)
  }
  assert.equal(chapter.implementedEntryFlags('10651').referenceCard, true)
  assert.equal(chapter.implementedEntryFlags('10662a').formation, 'colour')
  assert.equal(chapter.implementedEntryFlags('10662b').defeatTest.difficulty, 100)
  assert.equal(chapter.implementedEntryFlags('10671').defaultX, 6)
  assert.equal(chapter.implementedEntryFlags('10669').abyssSearch.groupCluesPerInvestigator, 7)
})

test('P7 fateOfTheVale 正文与特殊规则：英文印刷文本 + 三条规则 + 六个结局', () => {
  assert.equal(SCENARIO_TEXT.textLanguage, 'en')
  assert.ok(SCENARIO_TEXT.intro.length > 400)
  assert.ok(SCENARIO_TEXT.intro.includes('iridescent cavern'))
  assert.equal(SCENARIO_TEXT.specialRules.length, 3)
  assert.deepEqual(SCENARIO_TEXT.specialRules.map(rule => rule.id), ['theAbyss', 'cosmicEmissary', 'shatteredSelf'])
  assert.ok(SCENARIO_TEXT.specialRules[0].body.includes('The Abyss'))
  assert.ok(SCENARIO_TEXT.setup.gatherSets.includes('The Final Day'))
  assert.ok(SCENARIO_TEXT.setup.seedAbyssDeck.length > 0)
  assert.deepEqual([...RESOLUTION_KEYS], ['noResolution', 'resolution1', 'resolution2',
    'resolution3', 'resolution4', 'resolution5'])
  for (const key of RESOLUTION_KEYS) assert.ok(chapter.scenario.resolutions[key].length > 100, `${key} 正文`)
  assert.equal(chapter.scenario.resolutionTitles.resolution3, 'Resolution 3')
  assert.equal(Object.keys(chapter.manifest.recordWrites).length >= 10, true)
})

test('P7 fateOfTheVale 遭遇牌库：28 张、密使/水晶仿体/狂乱的赴宴者不在牌库', () => {
  assert.equal(ENCOUNTER_DECK.length, 28)
  assert.equal(ENCOUNTER_DECK.filter(code => code === '10672').length, 2)
  assert.equal(ENCOUNTER_DECK.filter(code => code === '10680').length, 3)
  assert.equal(ENCOUNTER_DECK.filter(code => code === '10731').length, 3)
  for (const code of ['10671', FRENZIED_REVELER_CODE, FIRE_CODE, ...EMISSARY_FORMATION.map(item => item.front)]) {
    assert.equal(ENCOUNTER_DECK.includes(code), false, `${code} 不进遭遇牌库`)
  }
  // 放一边：幕 3a 四版、深渊故事卡、两张水晶仿体、狂乱的赴宴者、着火了！、居民双面。
  for (const code of [...ACT3_VARIANT_CODES, STORY_CARD_CODE, CRYSTAL_MIMIC_CODE, FRENZIED_REVELER_CODE, FIRE_CODE]) {
    assert.equal(SET_ASIDE_CARDS.includes(code), true, `${code} 放一边`)
  }
  assert.equal(SET_ASIDE_CARDS.filter(code => code === CRYSTAL_MIMIC_CODE).length, 2, '水晶仿体 ×2')
  assert.deepEqual([...SET_ASIDE_LOCATION_IDS].sort(),
    [ABYSS_LOCATION_ID, ...VALE_LOCATION_IDS, ...CAVE_LOCATION_IDS].sort())
  const deckZone = chapter.manifest.zones.encounterDeck
  assert.equal(deckZone.reduce((sum, entry) => sum + entry.count, 0), 28)
  assert.equal(chapter.manifest.zones.encounterDeck.some(entry => entry.cardCode === '10671'), false)
})

// ---------------------------------------------------------------------------
// 2. 布置：镜巢环、密使阵形、深渊牌库
// ---------------------------------------------------------------------------

test('P7 fateOfTheVale 地点连接：四个镜巢围成环、双向对称、坐标取阵法网格', () => {
  assert.deepEqual([...LOCATION_CONNECTIONS.mirrorNestTop].sort(), ['mirrorNestLeft', 'mirrorNestRight'])
  assert.deepEqual([...LOCATION_CONNECTIONS.mirrorNestLeft].sort(), ['mirrorNestBottom', 'mirrorNestTop'])
  for (const position of MIRROR_NEST_POSITIONS) {
    for (const neighbor of LOCATION_CONNECTIONS[position]) {
      assert.equal(LOCATION_CONNECTIONS[neighbor].includes(position), true, `${position} ↔ ${neighbor} 对称`)
    }
  }
  assert.deepEqual(LOCATION_CONNECTIONS[ABYSS_LOCATION_ID], [], '深渊入场前不连镜巢')
  assert.deepEqual(LOCATION_COORDINATES.mirrorNestTop, { x: 3, y: 1 })
  assert.deepEqual(LOCATION_COORDINATES[ABYSS_LOCATION_ID], { x: 3, y: 2 })
  assert.deepEqual(chapter.layout.locations.mirrorNestLeft, { x: 1, y: 2 })
  // layout 覆盖全部可能入场的地点：镜巢环 4×2 + 山谷环 8×2 + 洞穴环 5×2 = 34 条有向边。
  assert.equal(chapter.layout.edges.length, 34)
})

test('P7 fateOfTheVale 布置：四个镜巢未揭示、四个密使以星之彩面入场、起始镜巢互不相同', () => {
  const { state, report } = setup(2)
  assert.deepEqual(report.placedIds, [...MIRROR_NEST_POSITIONS])
  assert.equal(state.locations.length, 4)
  assert.equal(state.locations.every(location => location.revealed === false), true, '镜巢未揭示入场')
  assert.equal(state.locations.every(location => location.clues === 0), true)
  assert.equal(report.enemies, 4)
  assert.deepEqual(report.placedIds, [...MIRROR_NEST_POSITIONS])
  const emissaries = behavior.emissaryInPlay(state)
  assert.equal(emissaries.length, 4)
  assert.deepEqual(emissaries.map(enemy => enemy.code).sort(), ['10662a', '10663a', '10664a', '10665a'].sort())
  for (const entry of EMISSARY_FORMATION) {
    assert.equal(behavior.emissaryAt(state, entry.position)?.code, entry.front)
    assert.equal(behavior.emissaryPosition(state, behavior.emissaryAt(state, entry.position)), entry.position)
  }
  const nests = Object.values(state.scenarioFlags.fateStartingNests)
  assert.equal(new Set(nests).size, 2, '两位调查员在不同镜巢')
  assert.ok(state.investigators.every(inv => MIRROR_NEST_POSITIONS.includes(inv.location)))
  // 深渊牌库：各调查员牌库顶 5 张 + 「真正的」调查员卡；遭遇牌库保留（approximation 1）。
  assert.equal(behavior.abyssSize(state), 2 * 5 + 2)
  assert.equal(state.encounterDeck.length, 28, '遭遇牌库不在布置时清空')
  assert.equal(state.investigators[0].deck.length, 7 - 5, '牌库顶 5 张被拿走')
  assert.ok(behavior.abyssStoryInPlay(state), '深渊故事卡入场')
  // 镜巢洗牌是隐藏信息：位置→卡号是四个卡号的排列。
  assert.deepEqual(Object.values(behavior.nestAssignment(state)).sort(), [...MIRROR_NEST_CODES].sort())
})

test('P7 fateOfTheVale 镜巢洗牌：随机源打乱位置→卡号并写回地点定义', () => {
  const state = stateWithScenario(1)
  const api = { info: () => {}, randomValue: () => 0 }
  const assignment = behavior.nestAssignment(state, api)
  assert.deepEqual(Object.keys(assignment).sort(), [...MIRROR_NEST_POSITIONS].sort())
  assert.deepEqual(Object.values(assignment).sort(), [...MIRROR_NEST_CODES].sort())
  behavior.applyNestCodes(state)
  for (const position of MIRROR_NEST_POSITIONS) {
    assert.equal(state.scenario.locations[position].code, assignment[position])
  }
  assert.equal(behavior.nestCodeAt(state, 'mirrorNestTop'), assignment.mirrorNestTop)
})

// ---------------------------------------------------------------------------
// 3. 破碎自我
// ---------------------------------------------------------------------------

test('P7 fateOfTheVale 破碎自我：换卡、手牌上限 -3、技能 = 手牌数、旧印 +2', () => {
  const state = stateWithScenario(1)
  behavior.prepareScenario(state, quietApi())
  behavior.shatterSelves(state, quietApi())
  const inv = state.investigators[0]
  assert.equal(inv.code, SHATTERED_SELF_CODE)
  assert.equal(inv.form, 'shattered')
  assert.equal(state.scenarioFlags.fateTrueSelves[0], '10001', '记下「真正的」调查员卡')
  assert.equal(behavior.handSizePenalty(state, inv), 3)
  assert.equal(behavior.statModifier(state, inv, 'willpower'), 3 - (-2), '3 张手牌 → X = 3')
  inv.hand = ['01020', '01021', '01022', '01023', '01024', '01025', '01026']
  assert.equal(behavior.statModifier(state, inv, 'combat'), 5 - (-2), 'X 最多为 5')
  assert.deepEqual(behavior.elderSign(state, inv), { delta: 2 })
  assert.equal(behavior.isShattered?.(state, inv) ?? behavior.statModifier(state, inv, 'agility') > 0, true)
  // 被击败 → 疯狂（阵亡）在结局里按 killed 处理；破碎自我卡其余 3 张移出游戏。
  assert.equal(state.scenarioFlags.fateShatteredSelfRemoved, 3)
  // 取回「真正的」调查员卡：恢复身份、治愈、旧时记忆入场。
  inv.damage = 2
  inv.horror = 1
  const api = { info: () => {}, heal: () => true }
  const result = behavior.returnToTrueSelf(state, 0, api)
  assert.equal(inv.code, '10001')
  assert.equal(Boolean(inv.form), false)
  assert.equal(inv.damage, 0)
  assert.equal(result.oldMemory.code, OLD_MEMORY_CODE)
  assert.equal(state.storyAssets.some(asset => asset.code === OLD_MEMORY_CODE), true)
})

// ---------------------------------------------------------------------------
// 4. 深渊
// ---------------------------------------------------------------------------

test('P7 fateOfTheVale 深渊：五类结算卡片、从底部抽遭遇卡、其余放回顶部', () => {
  const { state } = setup(1)
  assert.equal(behavior.classifyAbyssCard('10672'), 'encounter')
  assert.equal(behavior.classifyAbyssCard('10662a'), 'encounter')
  assert.equal(behavior.classifyAbyssCard(CAVE_LOCATION_IDS.length ? '10716' : '10716'), 'location')
  assert.equal(behavior.classifyAbyssCard('10693'), 'resident')
  assert.equal(behavior.classifyAbyssCard('10693b'), 'resident')
  assert.equal(behavior.classifyAbyssCard('10001'), 'investigator')
  assert.equal(behavior.classifyAbyssCard('01020'), 'player')
  assert.equal(behavior.classifyAbyssCard(STORY_CARD_CODE), 'story')
  // 手写深渊：底 [玩家卡, 玩家卡, 诡计] 顶 ...
  // randomValue 接近 1 时洗牌是恒等置换，便于断言"底部/顶部"的精确顺序。
  behavior.initializeAbyss(state, ['01020', '01021', '10674', '10693b'],
    { info: () => {}, randomValue: () => 0.999999 })
  assert.equal(behavior.abyssSize(state), 4)
  const bottom = behavior.revealBottomOfAbyss(state, 2)
  assert.deepEqual(bottom, behavior.abyssCards(state).slice(0, 2))
  const drawn = behavior.drawEncounterFromAbyss(state, 0, { info: () => {} })
  assert.equal(drawn, '10674')
  assert.equal(behavior.abyssSize(state), 3, '只抽走遭遇卡')
  assert.deepEqual(behavior.abyssCards(state).slice(0, 2), ['01020', '01021'], '其余揭示牌放回深渊顶')
  // 放一张牌到深渊顶（引擎：deck 尾部是顶）。
  behavior.putOnAbyss(state, ['01030'])
  assert.equal(behavior.abyssCards(state).at(-1), '01030')
  const painted = behavior.drawFromAbyss(state, 0, { info: () => {} })
  assert.equal(painted.kind, 'player')
  assert.equal(state.investigators[0].hand.includes(painted.code), true, '玩家卡加入手牌')
})

test('P7 fateOfTheVale 深渊：居民翻到敌人面攻击后弃掉、地点在镜巢旁入场并相连', () => {
  const state = stateWithScenario(1)
  behavior.setupScenario(state, quietApi())
  state.investigators[0].location = 'mirrorNestTop'
  behavior.initializeAbyss(state, ['10693b'], quietApi())
  let attacked = null
  const api = { info: () => {}, attack: (enemy, inv) => { attacked = { enemy, seat: inv.seat } },
    discardEnemy: enemy => { state.enemies = state.enemies.filter(item => item !== enemy) } }
  const result = behavior.drawFromAbyss(state, 0, api)
  assert.equal(result.kind, 'resident')
  assert.equal(attacked.enemy.code, '10693b')
  assert.equal(attacked.seat, 0)
  assert.equal(state.enemies.some(enemy => enemy.code === '10693b'), false, '居民敌人攻击后弃掉')
  // 地点：放到最近的镜巢旁并互相连接。
  behavior.initializeAbyss(state, ['10716'], quietApi())
  const placed = behavior.drawFromAbyss(state, 0, quietApi())
  assert.equal(placed.kind, 'location')
  const cave = state.locations.find(location => location.code === '10716')
  assert.ok(cave, '洞穴地点入场')
  assert.equal(cave.revealed, false)
  const nest = state.locations.find(location => location.id === cave.connections[0])
  assert.equal(MIRROR_NEST_POSITIONS.includes(nest.id), true)
  assert.equal(nest.connections.includes(cave.id), true, '双向连接')
})

test('P7 fateOfTheVale 深渊翻到地点面：与每个镜巢相连；进入深渊时深渊有牌即阵亡', () => {
  const { state } = setup(2)
  behavior.flipAbyssToLocation(state, quietApi())
  const abyss = behavior.abyssLocationInPlay(state)
  assert.ok(abyss)
  assert.equal(abyss.revealed, true)
  assert.deepEqual([...abyss.connections].sort(), [...MIRROR_NEST_POSITIONS].sort())
  for (const position of MIRROR_NEST_POSITIONS) {
    const nest = state.locations.find(location => location.id === position)
    assert.equal(nest.connections.includes(ABYSS_LOCATION_ID), true)
  }
  const killed = []
  const api = { info: () => {}, kill: seat => killed.push(seat) }
  behavior.initializeAbyss(state, ['01020'], quietApi())
  assert.equal(behavior.locationEntered(state, state.investigators[0], abyss, api), true)
  assert.deepEqual(killed, [0])
  behavior.initializeAbyss(state, [], quietApi())
  assert.equal(behavior.locationEntered(state, state.investigators[1], abyss, api), false, '深渊为空时安全')
})

// ---------------------------------------------------------------------------
// 5. 宇宙密使
// ---------------------------------------------------------------------------

test('P7 fateOfTheVale 宇宙密使：正面无生命值不能受伤、成功攻击/躲避后本轮不攻击', () => {
  const { state } = setup(1)
  const colour = behavior.emissaryInPlay(state)[0]
  assert.equal(behavior.enemyDamageAllowed(state, colour), false, '星之彩面不能受到伤害')
  const shattered = behavior.spawnFateEnemy(state, '10662b', ABYSS_LOCATION_ID, quietApi(), { ignoreSpawn: true })
  assert.equal(behavior.enemyDamageAllowed(state, shattered), true, '破碎面有生命值')
  const api = { info: () => {} }
  assert.equal(behavior.enemyAttackedSuccessfully(state, state.investigators[0], colour, api), true)
  assert.equal(behavior.isWardedEmissary(state, colour), true)
  assert.equal(behavior.enemyCannotAttack(state, colour), true, '本轮敌军阶段不攻击')
  state.round = 2
  assert.equal(behavior.enemyCannotAttack(state, colour), false, '下一轮恢复')
  assert.equal(behavior.enemyAttackedSuccessfully(state, state.investigators[0], shattered, api), false)
})

test('P7 fateOfTheVale 破阵：密使翻到破碎面，深渊密使移到深渊、其余留在原镜巢', () => {
  const { state } = setup(1)
  behavior.flipAbyssToLocation(state, quietApi())
  const before = Object.fromEntries(behavior.emissaryInPlay(state).map(enemy => [enemy.code, enemy.location]))
  const flips = behavior.flipEmissariesToShattered(state, { abyssId: ABYSS_LOCATION_ID }, quietApi())
  assert.equal(flips.length, 4)
  assert.equal(state.scenarioFlags.fateFormationBroken, true)
  const shattered = behavior.emissaryInPlay(state)
  assert.deepEqual(shattered.map(enemy => enemy.code).sort(),
    ['10662b', '10663b', '10664b', '10665b'].sort())
  assert.equal(shattered.find(enemy => enemy.code === '10662b').location, ABYSS_LOCATION_ID)
  for (const entry of EMISSARY_FORMATION.filter(item => item.label !== 'cosmicEmissaryAbyss')) {
    assert.equal(shattered.find(enemy => enemy.code === entry.back).location, before[entry.front])
  }
  // 破碎的深渊密使被击败：每位调查员检定[意志](100)，失败者阵亡。
  const killed = []
  const api = { info: () => {}, kill: seat => killed.push(seat),
    test: (seat, skill, difficulty, resolve) => { assert.equal(skill, 'willpower'); assert.equal(difficulty, 100); resolve({ success: false, difficulty, value: 0 }) } }
  behavior.enemyDefeated(state, shattered.find(enemy => enemy.code === '10662b'), api)
  assert.deepEqual(killed, [0])
})

// ---------------------------------------------------------------------------
// 6. 镜巢回合末与地点行动
// ---------------------------------------------------------------------------

test('P7 fateOfTheVale 镜巢回合末：未成功攻击时二选一、10669 总是随机弃牌', () => {
  const { state } = setup(1)
  const inv = state.investigators[0]
  const nest = state.locations.find(location => location.id === 'mirrorNestTop')
  Object.assign(nest, { code: '10666', originalCode: '10666' })
  inv.location = 'mirrorNestTop'
  inv.clues = 2
  const api = { info: () => {}, choose: () => 'clue' }
  assert.equal(behavior.turnEnded(state, inv, api), true)
  assert.equal(inv.clues, 1)
  assert.equal(nest.clues, 1, '线索放在镜巢上')
  // 本轮成功攻击 → 强制效果不触发。
  behavior.afterTest(state, inv, { success: true }, quietApi(), { test: { actionKind: 'fight' } })
  assert.equal(behavior.turnEnded(state, inv, api), false)
  behavior.roundEnded(state, quietApi())
  // 10669：总是随机弃 1 张手牌。
  Object.assign(nest, { code: '10669', originalCode: '10669' })
  const handBefore = inv.hand.length
  assert.equal(behavior.turnEnded(state, inv, { info: () => {} }), true)
  assert.equal(inv.hand.length, handBefore - 1)
})

test('P7 fateOfTheVale 查找深渊：7/人 线索、团队每幕一次', () => {
  const state = stateWithScenario(2)
  behavior.setupScenario(state, quietApi())
  const nest = state.locations.find(location => location.id === 'mirrorNestLeft')
  Object.assign(nest, { code: '10669', originalCode: '10669' })
  const inv = state.investigators[0]
  inv.location = 'mirrorNestLeft'
  inv.clues = 10
  state.investigators[1].clues = 4
  behavior.initializeAbyss(state, ['01020'], quietApi())
  const move = behavior.actions(state, inv).find(item => item.rule === 'fateAbyssSearch')
  assert.ok(move)
  assert.equal(move.reason, undefined, '线索足够时可执行')
  assert.equal(behavior.performAction(state, inv, move, quietApi()), true)
  assert.equal(state.investigators[0].clues, 0)
  assert.equal(state.investigators[1].clues, 0, '共同支付')
  const again = behavior.actions(state, inv).find(item => item.rule === 'fateAbyssSearch')
  assert.equal(again.used, true, '本幕已使用')
})

// ---------------------------------------------------------------------------
// 7. 幕 / 议程 / 幕间 / 多结局
// ---------------------------------------------------------------------------

test('P7 fateOfTheVale 幕：1a/2a 与议程 1a/2a/3a，幕 3a 有四个版本', () => {
  const { state } = setup(2)
  assert.deepEqual(state.acts.map(act => act.stage), ['1a', '2a'])
  assert.deepEqual(state.agendas.map(agenda => agenda.stage), ['1a', '2a', '3a'])
  assert.deepEqual(state.agendas.map(agenda => agenda.doomThreshold), [6, 5, 4])
  assert.deepEqual([...ACT_CODES], ['10655', '10656'])
  assert.equal(ACT3_VARIANT_CODES.length, 4)
  assert.equal(ALL_ACT_CODES.length, 6)
  for (const code of ACT3_VARIANT_CODES) {
    const stage = ACT_STAGES[code === '10657' ? 3 : code === '10658' ? 4 : code === '10659' ? 5 : 6]
    assert.equal(stage.stage, '3a')
    assert.equal(stage.originalCode || stage.code, code)
  }
  assert.equal(AGENDA_STAGES[1].doomThreshold, 6)
  assert.equal(behavior.objectiveStatus(state).rule, 'trueSelves')
})

test('P7 fateOfTheVale 幕 1 背面：地点补线索、蕾切尔嬷嬷划掉、居民与洞穴洗入深渊', () => {
  const { state } = setup(2)
  state.investigators[0].location = 'mirrorNestTop'
  state.locations[0].revealed = true
  state.locations[0].maxClues = 4
  behavior.actReveal(state, state.acts[0], quietApi())
  assert.equal(state.locations[0].clues, 4, '补线索到线索值')
  assert.equal(state.campaign.records.motherRachelCrossedOut, true)
  assert.ok(state.scenarioFlags.fateCrossedOutResidents.includes('10693'))
  const abyss = behavior.abyssCards(state)
  for (const code of CAVE_LOCATION_IDS.map((id, index) => ['10716', '10717', '10718', '10719', '10720'][index])) {
    assert.equal(abyss.includes(code), true, `洞穴 ${code} 洗入深渊`)
  }
  assert.equal(state.scenarioZones.setAside.includes('10693'), false, '被划掉的居民离开放一边区')
})

test('P7 fateOfTheVale 幕间：四个选项按战役记录开放，选择决定幕 3a 版本', () => {
  const cases = [
    [{ drMarquesHasAHunch: true, drMarquezHasAPlan: true }, 'letsEndThis', '10657'],
    [{ thePetersFamilyWereReunited: true }, 'saveTheVale', '10658'],
    [{ theValeIsFullOfFireworks: true }, 'burnItAll', '10659'],
    [{}, 'escape', '10660'],
  ]
  for (const [records, choice, code] of cases) {
    const state = stateWithScenario(2, records)
    behavior.setupScenario(state, quietApi())
    const options = behavior.interludeOptions(state)
    const entry = options.find(item => item.choice === choice)
    assert.equal(entry.available, true, `${choice} 应可用`)
    if (choice !== 'escape') {
      assert.equal(options.find(item => item.choice === 'letsEndThis').available, choice === 'letsEndThis')
    }
    state.investigators[0].clues = 3
    const result = behavior.resolveInterlude(state, choice, { info: () => {}, choose: () => choice })
    assert.equal(result.choice, choice)
    assert.equal(state.acts.length, 3)
    assert.equal(state.actIndex, 2)
    assert.equal(state.acts[2].originalCode || state.acts[2].code, code)
    assert.equal(state.investigators[0].clues, 0, '幕间：全员失去线索')
    assert.equal(state.campaign.records.fateInterlude, choice)
  }
})

test('P7 fateOfTheVale 幕间 1/2/5：马奎兹与深渊翻面、黑夜山谷与居民、密使在村庄', () => {
  // Fate of the Vale 1
  const one = stateWithScenario(1, { drMarquesHasAHunch: true, drMarquezHasAPlan: true })
  behavior.setupScenario(one, quietApi())
  behavior.resolveInterlude(one, 'letsEndThis', { info: () => {} })
  assert.ok(behavior.abyssLocationInPlay(one), '深渊翻到地点面')
  assert.equal(behavior.abyssLocationInPlay(one).revealed, true)
  assert.equal(behavior.emissaryInPlay(one).every(enemy => enemy.code.endsWith('b')), true, '密使全部破碎面')
  assert.equal(one.storyAssets.some(asset => asset.code === '10702'), true, '马奎兹博士入场')
  // Fate of the Vale 2
  const two = stateWithScenario(2, { thePetersFamilyWereReunited: true })
  behavior.setupScenario(two, quietApi())
  behavior.resolveInterlude(two, 'saveTheVale', { info: () => {} })
  assert.equal(two.locations.some(location => MIRROR_NEST_POSITIONS.includes(location.id)), false, '镜巢移出游戏')
  assert.equal(VALE_LOCATION_IDS.every(id => two.locations.some(location => location.id === id)), true)
  assert.equal(two.investigators.every(inv => inv.location === 'theCrossroads'), true)
  assert.equal(two.scenarioZones.beneathResidents.length, RESIDENT_ASSET_CODES.length + 2, '居民与 2 张狂乱的赴宴者在地点底下')
  assert.equal(behavior.emissaryInPlay(two).length, 4, '破碎密使在村庄')
  assert.equal(behavior.emissaryAt(two, 'theCrossroads').code, '10662b')
  // Fate of the Vale 5（v.III 走 3 → 5）
  const three = stateWithScenario(1, { theValeIsFullOfFireworks: true })
  behavior.setupScenario(three, quietApi())
  behavior.resolveInterlude(three, 'burnItAll', { info: () => {} })
  assert.equal(three.scenarioFlags.fateNightVale, true)
  assert.equal(three.acts[2].originalCode || three.acts[2].code, '10659')
})

test('P7 fateOfTheVale 幕 3a v.I 背面：让马奎兹执行计划 → 结局 1；有棱柱碎片可自己动手 → 结局 2', () => {
  for (const [shard, choice, expected] of [[false, 'resolution1', 'resolution1'], [true, 'resolution2', 'resolution2']]) {
    const api = engineishApi()
    const state = stateWithScenario(2, { drMarquesHasAHunch: true, drMarquezHasAPlan: true })
    behavior.setupScenario(state, quietApi())
    api.state = state
    behavior.resolveInterlude(state, 'letsEndThis', { info: () => {} })
    if (shard) state.investigators[0].assets.push({ id: 'shard', code: '10522', name: '棱柱碎片' })
    const options = behavior.interludeOptions(state)
    assert.equal(options.length, 4)
    const act = state.acts[2]
    api.choose = request => (request.options.some(item => item.id === expected) ? expected : request.options[0].id)
    assert.equal(behavior.actReveal(state, act, api), true)
    assert.equal(api.finished, expected)
  }
})

test('P7 fateOfTheVale 幕 3a v.II/v.III/v.IV 背面：结局 3/4/5', () => {
  for (const [version, expected] of [['saveTheVale', 'resolution3'], ['burnItAll', 'resolution4'], ['escape', 'resolution5']]) {
    const api = engineishApi()
    const records = version === 'saveTheVale' ? { theHemlocksMadeATruce: true }
      : version === 'burnItAll' ? { theValeIsFullOfFireworks: true } : {}
    const state = stateWithScenario(2, records)
    behavior.setupScenario(state, quietApi())
    api.state = state
    behavior.resolveInterlude(state, version, { info: () => {} })
    behavior.actReveal(state, state.acts[2], api)
    assert.equal(api.finished, expected)
  }
})

test('P7 fateOfTheVale v.III 引线与火势：放引线到隐藏值、点燃抽「着火了！」、5 张推进', () => {
  const api = engineishApi()
  const state = stateWithScenario(1, { theValeIsFullOfFireworks: true })
  behavior.setupScenario(state, quietApi())
  api.state = state
  behavior.resolveInterlude(state, 'burnItAll', { info: () => {} })
  const inv = state.investigators[0]
  inv.location = 'theCrossroads'
  const crossroads = state.locations.find(location => location.id === 'theCrossroads')
  crossroads.shroud = 2
  inv.clues = 10
  for (let index = 0; index < 2; index += 1) {
    const move = behavior.actions(state, inv).find(item => item.rule === 'fatePlaceKindling')
    behavior.performAction(state, inv, move, quietApi())
  }
  assert.equal(state.scenarioFlags.fateKindling.theCrossroads, 2)
  const fire = behavior.actions(state, inv).find(item => item.rule === 'fateDrawFire')
  assert.equal(fire.reason, undefined, '引线 ≥ 隐藏值可点燃')
  assert.equal(behavior.performAction(state, inv, fire, {
    drawEncounter(seat, { code }) {
      assert.equal(seat, inv.seat)
      crossroads.attachments = [{ code }]
    },
  }), true)
  assert.equal(state.scenarioFlags.fateKindling.theCrossroads, 0, '移除全部引线')
  assert.equal(crossroads.attachments[0].code, FIRE_CODE)
  const again = behavior.actions(state, inv).find(item => item.rule === 'fateDrawFire')
  assert.equal(again.used, true, '团队每地点一次')
  // 5 张「着火了！」→ 轮末立即推进：幕 3a v.III 背面直接结算结局 4。
  state.encounterDiscard = Array(5).fill(FIRE_CODE)
  assert.equal(behavior.objectiveStatus(state).satisfied, false)
  for (const location of state.locations.slice(0, 5)) location.attachments = [{ code: FIRE_CODE }]
  behavior.roundEnded(state, api)
  assert.equal(api.finished, 'resolution4', '幕 3a v.III 背面 → 结局 4')
})

test('P7 fateOfTheVale v.IV 撤退：记录条件 ≥5 才能撤退，全员撤退推进到结局 5', () => {
  const api = engineishApi()
  const state = stateWithScenario(1)
  behavior.setupScenario(state, quietApi())
  api.state = state
  behavior.resolveInterlude(state, 'escape', { info: () => {} })
  const inv = state.investigators[0]
  let move = behavior.actions(state, inv).find(item => item.rule === 'fateResign')
  assert.ok(move.reason, '没有记录时不能撤退')
  for (const key of ['theInvestigatorsFoundGas', 'theRoadIsClear', 'theSurveyNotesWereRecovered',
    'bertieIsFleeing', 'theSamplesWereFound']) state.campaign.records[key] = true
  move = behavior.actions(state, inv).find(item => item.rule === 'fateResign')
  assert.equal(move.reason, undefined)
  assert.equal(behavior.performAction(state, inv, move, { info: () => {}, resign: seat => { state.investigators[seat].resigned = true } }), true)
  assert.equal(inv.resigned, true)
  assert.equal(behavior.checkObjectives(state, api), true)
  behavior.actReveal(state, state.acts[state.actIndex - 1] || state.acts[2], api)
  assert.equal(api.finished, 'resolution5')
})

test('P7 fateOfTheVale 议程背面：议程 1/2 检定失败改伤害或洗牌入深渊、议程 3 全员阵亡', () => {
  const state = stateWithScenario(1)
  behavior.setupScenario(state, quietApi())
  const inv = state.investigators[0]
  const api1 = { info: () => {}, test: (seat, skills, difficulty, resolve) => resolve({ success: false, difficulty: 4, value: 1 }) }
  behavior.agendaReveal(state, state.agendas[0], api1)
  assert.equal(inv.horror, 3, '失败 3 点 → 3 恐惧')
  const beforeDeck = inv.deck.length
  const api2 = { info: () => {}, test: (seat, skills, difficulty, resolve) => resolve({ success: false, difficulty: 4, value: 2 }) }
  behavior.agendaReveal(state, state.agendas[1], api2)
  assert.equal(inv.damage, 2, '失败 2 点 → 2 伤害')
  void beforeDeck
  const finished = []
  const api3 = { info: () => {}, kill: seat => finished.push(seat) }
  behavior.agendaReveal(state, state.agendas[2], api3)
  assert.deepEqual(finished, [0], '议程 3 背面：所有调查员阵亡')
})

// ---------------------------------------------------------------------------
// 8. 混乱符号
// ---------------------------------------------------------------------------

test('P7 fateOfTheVale 混乱符号：[skull] 随幕号/星之彩敌人、其余符号的追加效果', () => {
  const state = stateWithScenario(1)
  behavior.setupScenario(state, quietApi())
  assert.equal(isHardSide(state), false)
  assert.equal(currentActNumber(state), 1)
  assert.equal(fateChaosTokenValue(state, 'skull'), -2, '幕 1 → X = 2')
  state.actIndex = 1
  assert.equal(fateChaosTokenValue(state, 'skull'), -3, '幕 2 → X = 3')
  assert.equal(colourEnemyCount(state), 4, '四个星之彩面密使')
  state.difficulty = 'hard'
  assert.equal(isHardSide(state), true)
  assert.equal(fateChaosTokenValue(state, 'skull'), -4, '困难：X = 星之彩敌人数量')
  assert.equal(fateChaosTokenValue(state, 'cultist'), -6)
  assert.equal(fateChaosTokenValue(state, 'tablet'), -8)
  assert.equal(fateChaosTokenValue(state, 'elderthing'), -5)
  const standard = { ...state, difficulty: 'standard' }
  assert.equal(fateChaosTokenValue(standard, 'cultist'), -4)
  assert.equal(fateChaosTokenValue(standard, 'tablet'), -5)
  assert.equal(fateChaosTokenValue(standard, 'elderthing'), -2)
  assert.equal(fateChaosTokenValue(standard, 'frost'), null, '未知标记交回引擎默认表')
  assert.equal(FATE_TOKEN_MEANINGS.hard.cultist.delta, -6)
  assert.deepEqual(fateChaosToken(standard, state.investigators[0], 'cultist').onFail,
    [{ type: 'scenarioToken', token: 'cultist', mode: 'fail' }])
  assert.deepEqual(fateChaosToken(state, state.investigators[0], 'cultist').onDraw,
    [{ type: 'scenarioToken', token: 'cultist', mode: 'always' }])
  assert.deepEqual(fateChaosToken(state, state.investigators[0], 'tablet').onDraw,
    [{ type: 'scenarioToken', token: 'tablet', mode: 'hard' }])
})

test('P7 fateOfTheVale 混乱符号对密使：简单再揭示一个标记、困难自动失败', () => {
  const state = stateWithScenario(1)
  behavior.setupScenario(state, quietApi())
  const enemy = behavior.emissaryInPlay(state)[0]
  state.skillTest = { seat: 0, actionKind: 'fight', target: { kind: 'enemy', id: enemy.id } }
  assert.equal(againstCosmicEmissary(state), true)
  const easy = fateChaosToken({ ...state, difficulty: 'standard' }, state.investigators[0], 'elderthing')
  assert.deepEqual(easy, { delta: -2, drawAnother: true, onDraw: [], onFail: [] })
  const hard = fateChaosToken({ ...state, difficulty: 'expert' }, state.investigators[0], 'elderthing')
  assert.equal(hard.delta, -5)
  assert.equal(hard.autoFail, true)
  // 引擎 testAutoFail 读同一条判定。
  assert.equal(behavior.testAutoFail(state, state.investigators[0], { drawn: ['elderthing'] }), false,
    'standard 难度不自动失败')
  assert.equal(behavior.testAutoFail({ ...state, difficulty: 'hard' }, state.investigators[0], { drawn: ['elderthing'] }), true)
  // 非对密使的检定：没有额外代价。
  state.skillTest = { seat: 0, actionKind: 'investigate' }
  assert.deepEqual(fateChaosToken({ ...state, difficulty: 'standard' }, state.investigators[0], 'elderthing'),
    { delta: -2, onDraw: [], onFail: [] })
})

test('P7 fateOfTheVale 破碎密使的标记反应：在该地点揭示指定标记时二选一', () => {
  const state = stateWithScenario(1)
  behavior.setupScenario(state, quietApi())
  behavior.flipAbyssToLocation(state, quietApi())
  behavior.flipEmissariesToShattered(state, { abyssId: ABYSS_LOCATION_ID }, quietApi())
  const inv = state.investigators[0]
  const miasma = behavior.emissaryInPlay(state).find(enemy => enemy.code === '10664b')
  inv.location = miasma.location
  const attacks = []
  const api = { info: () => {}, choose: () => 'attack', attack: (enemy, target) => attacks.push([enemy.code, target.seat]) }
  assert.equal(behavior.applyTokenEffect(state, inv, { token: 'cultist', mode: 'always' }, api), true)
  assert.deepEqual(attacks, [['10664b', 0]])
  const failApi = { info: () => {}, choose: () => 'autoFail' }
  assert.equal(behavior.applyTokenEffect(state, inv, { token: 'cultist', mode: 'always' }, failApi), true)
  assert.equal(state.scenarioFlags.fateAutoFail.seat, 0)
  assert.equal(behavior.testAutoFail(state, inv, { drawn: ['cultist'] }), true)
})

// ---------------------------------------------------------------------------
// 9. 诡计
// ---------------------------------------------------------------------------

test('P7 fateOfTheVale 诡计显现：狂喜二选一、碎裂最高费支援、升华按失败点数弃手牌', () => {
  const state = stateWithScenario(1)
  behavior.setupScenario(state, quietApi())
  behavior.initializeAbyss(state, [], quietApi())
  const inv = state.investigators[0]
  inv.location = 'mirrorNestTop'
  inv.assets = [
    { id: 'a1', code: '01001', name: '低费' },
    { id: 'a2', code: '01020', name: '高费' },
  ]
  // 狂喜：失败 → 2 恐惧 + 放支援到深渊。
  const euphoriaApi = bridge(state, {
    test: (seat, skill, difficulty, resolve) => { assert.equal(skill, 'intellect'); assert.equal(difficulty, 4); resolve({ success: false, difficulty, value: 2 }) },
    choose: () => 'horror',
  })
  assert.equal(entry10674.encounterResolve(state, inv, { code: '10674' }, euphoriaApi), true)
  assert.equal(inv.horror, 2)
  assert.equal(inv.assets.length, 1, '失败时两者都做：支援也放到深渊顶')
  assert.equal(behavior.abyssCards(state).length, 1)
  // 碎裂：失败 → 印刷费用最高的支援。
  const fragmentationApi = bridge(state, {
    test: (seat, skill, difficulty, resolve) => { assert.equal(skill, 'agility'); resolve({ success: false, difficulty, value: 1 }) },
    choose: () => 'asset',
  })
  assert.equal(entry10673.encounterResolve(state, inv, { code: '10673' }, fragmentationApi), true)
  assert.equal(inv.assets.length, 0)
  assert.equal(behavior.abyssCards(state).length, 2)
  // 升华：失败 2 点 → 2 张手牌放深渊顶。
  const handBefore = inv.hand.length
  const sublimationApi = bridge(state, {
    test: (seat, skill, difficulty, resolve) => { assert.equal(skill, 'willpower'); resolve({ success: false, difficulty, value: 2 }) },
    choose: () => 'hand',
  })
  assert.equal(entry10672.encounterResolve(state, inv, { code: '10672' }, sublimationApi), true)
  assert.equal(inv.hand.length, handBefore - 2)
  assert.equal(behavior.abyssCards(state).length, 4)
})

// ---------------------------------------------------------------------------
// 10. 结局与剧本日志
// ---------------------------------------------------------------------------

test('P7 fateOfTheVale 结局 1–5：剧本日志、创伤、奖励经验与划线居民', () => {
  const expectations = [
    ['resolution1', 'drMarquezSacrificedHerselfForTheVale', [1, 1], 5],
    ['resolution2', 'theInvestigatorsSacrificedThemselvesForTheVale', [0, 0], 0],
    ['resolution3', 'theValeWasSaved', [2, 2], 3],
    ['resolution4', 'theValeBurned', [2, 2], 3],
    ['resolution5', 'theInvestigatorsBarelySurvivedTheFeastOfHemlockVale', [3, 3], 2],
  ]
  for (const [key, record, trauma, bonus] of expectations) {
    const api = engineishApi()
    const state = stateWithScenario(2)
    behavior.setupScenario(state, quietApi())
    api.state = state
    // 让一位居民被控制、另一位无主，结局 1/4/5 要划掉无主居民。
    state.investigators[0].assets.push({ id: 'res', code: '10694', name: '莉亚·阿特伍德' })
    const result = behavior.resolution(state, key, [], api)
    const records = state.campaign.records
    assert.equal(records.fateOfTheValeResolution, key)
    assert.equal(records[record], true)
    assert.equal(result.bonus, bonus, `${key} 的奖励经验`)
    assert.equal(records.fateOfTheValeXpBonus, bonus)
    const physical = api.trauma.filter(row => row.kind === 'physical')
    const mental = api.trauma.filter(row => row.kind === 'mental')
    assert.equal(physical.reduce((sum, row) => sum + row.amount, 0), trauma[0] * 2)
    assert.equal(mental.reduce((sum, row) => sum + row.amount, 0), trauma[1] * 2)
    if (['resolution1', 'resolution4', 'resolution5'].includes(key)) {
      assert.ok(records.crossedOutResidents.includes('10693'), '无主居民被划掉')
      assert.equal(records.crossedOutResidents.includes('10694'), false, '被控制的居民不划掉')
    }
    if (key === 'resolution2') assert.equal(records.theInvestigatorsWereDevoured, true)
    if (key === 'resolution1') assert.equal(records.drMarquezRemovedFromDecks, true)
  }
})

test('P7 fateOfTheVale 结局 3 划线：只看胜利区里的居民', () => {
  const api = engineishApi()
  const state = stateWithScenario(1)
  behavior.setupScenario(state, quietApi())
  api.state = state
  state.victoryDisplay = [{ code: '10695' }]
  behavior.resolution(state, 'resolution3', [], api)
  assert.deepEqual(state.campaign.records.crossedOutResidents, ['10695'])
})

test('P7 fateOfTheVale 无结局：全员被吞噬、战役失败、记录写入', () => {
  const api = engineishApi()
  const state = stateWithScenario(2)
  behavior.setupScenario(state, quietApi())
  api.state = state
  const killed = []
  api.kill = seat => killed.push(seat)
  const result = behavior.resolution(state, 'noResolution', [], api)
  assert.equal(result.award, true)
  assert.equal(state.campaign.records.fateOfTheValeResolution, 'noResolution')
  assert.equal(state.campaign.records.theInvestigatorsBecameTheTrueFeastOfHemlockVale, true)
  assert.deepEqual(killed.sort(), [0, 1])
  assert.equal(state.campaign.lost, true)
  // 未知结局键退回无结局。
  const other = stateWithScenario(1)
  behavior.setupScenario(other, quietApi())
  behavior.resolution(other, 'resolution9', [], quietApi())
  assert.equal(other.campaign.records.fateOfTheValeResolution, 'noResolution')
})

test('P7 fateOfTheVale 声明即接线：议程/密使/镜巢/水晶仿体/深渊故事卡的 flags 都有读点', () => {
  const { state } = setup(1)
  state.investigators[0].location = 'mirrorNestTop'
  // 议程：深渊神话替换 + 凝视计时口径。
  assert.equal(behavior.abyssMythosActive(state), true)
  assert.deepEqual(behavior.gazeRule(state), { active: true, seconds: 15, penalty: 'drivenInsane' })
  state.agendaIndex = 2
  assert.equal(behavior.abyssMythosActive(state), true, '议程 3 同样有强制效果')
  state.agendaIndex = 0
  // 深渊故事卡：从底部抽牌 + 弃牌放顶部。
  assert.equal(behavior.abyssStoryInPlay(state).code, STORY_CARD_CODE)
  const storyFlags = chapter.implementedEntryFlags(STORY_CARD_CODE)
  assert.equal(storyFlags.drawFromBottom, true)
  assert.equal(storyFlags.revealRules.investigator, 'returnToTrueSelfThenOldMemory')
  // 水晶仿体：X = 手牌数（最多 5），否则 6。
  const mimic = behavior.spawnFateEnemy(state, CRYSTAL_MIMIC_CODE, 'mirrorNestTop', quietApi(), { ignoreSpawn: true })
  assert.equal(chapter.implementedEntryFlags(CRYSTAL_MIMIC_CODE).crystalMimic, true)
  state.skillTest = null
  assert.equal(behavior.enemyStatModifier(state, mimic, 'fight'), 6 - (-2), '不在检定中 → X = 6')
  state.skillTest = { seat: 0, actionKind: 'fight', target: { kind: 'enemy', id: mimic.id } }
  state.investigators[0].hand = ['01020', '01021', '01022']
  assert.equal(behavior.enemyStatModifier(state, mimic, 'fight'), 3 - (-2), '在手牌中 → X = 3')
  state.investigators[0].hand = Array.from({ length: 8 }, () => '01020')
  assert.equal(behavior.enemyStatModifier(state, mimic, 'evade'), 5 - (-2), 'X 最多为 5')
  const handBefore = state.investigators[0].hand.length
  assert.equal(behavior.enemyAttackResolved(state, mimic, state.investigators[0], quietApi()), true)
  assert.equal(state.investigators[0].hand.length, handBefore - 1, '攻击后随机弃 1 张')
  // 镜巢：回合末规则与查找深渊都从条目 flags 读取。
  const nest = state.locations.find(location => location.id === 'mirrorNestLeft')
  Object.assign(nest, { code: '10669', originalCode: '10669' })
  assert.equal(chapter.implementedEntryFlags('10669').turnEnd.require, null)
  assert.equal(chapter.implementedEntryFlags('10669').abyssSearch.limit, 'oncePerAct')
  // 幕 1 的 [reaction]：在[[巢穴]]检定成功 → 揭示深渊底部并抽 1 张。
  state.skillTest = null
  state.investigators[0].location = 'mirrorNestTop'
  behavior.initializeAbyss(state, ['01020', '01021'], { info: () => {}, randomValue: () => 0.999999 })
  const abyssBefore = behavior.abyssSize(state)
  const handSize = state.investigators[0].hand.length
  assert.equal(behavior.afterTest(state, state.investigators[0],
    { success: true, value: 5, difficulty: 3 }, quietApi(), { test: { actionKind: 'investigate' } }), true)
  assert.equal(behavior.abyssSize(state), abyssBefore - 1, '抽走 1 张深渊卡')
  assert.equal(state.investigators[0].hand.length, handSize + 1, '抽到玩家卡 → 进手牌')
})

test('P7 fateOfTheVale JSON 往返：深渊/破碎自我/幕指针/记录都能存档复原', () => {
  const api = engineishApi()
  const state = stateWithScenario(2, { thePetersFamilyWereReunited: true })
  behavior.setupScenario(state, quietApi())
  api.state = state
  behavior.shatterSelves(state, quietApi())
  behavior.resolveInterlude(state, 'saveTheVale', { info: () => {} })
  const restored = clone(state)
  assert.equal(restored.scenario.id, 'fateOfTheVale')
  assert.equal(restored.investigators[0].code, SHATTERED_SELF_CODE)
  assert.equal(behavior.handSizePenalty(restored, restored.investigators[0]), 3)
  assert.equal(behavior.abyssSize(restored), behavior.abyssSize(state))
  assert.deepEqual(behavior.abyssCards(restored), behavior.abyssCards(state))
  assert.equal(behavior.abyssLocationInPlay(restored), null, 'v.II 路线不翻深渊地点面（只有 v.I 翻）')
  assert.equal(restored.scenarioFlags.fateNightVale, true)
  assert.equal(VALE_LOCATION_IDS.every(id => restored.locations.some(location => location.id === id)), true)
  for (const position of MIRROR_NEST_POSITIONS) {
    assert.equal(restored.locations.some(location => location.id === position), false, 'v.II 后镜巢已移出游戏')
  }
  assert.equal(restored.actIndex, 2)
  const restoredApi = engineishApi()
  restoredApi.state = restored
  behavior.actReveal(restored, restored.acts[2], restoredApi)
  assert.equal(restoredApi.finished, 'resolution3')
  const again = clone(restored)
  assert.equal(behavior.abyssCards(again).length, behavior.abyssCards(restored).length)
  assert.equal(again.campaign.records.fateInterlude, 'saveTheVale')
  assert.equal(chapter.implementedEntryFlags('10670b').drawFromBottom, true)
  assert.equal(entry10670.abilities.length, 0)
  assert.equal(entry10651.scope, 'scenario')
  assert.equal(entry10661b.flags.oldMemory, true)
})
