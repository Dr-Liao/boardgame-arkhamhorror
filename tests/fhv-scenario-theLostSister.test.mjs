// P7 消失的姐妹（theLostSister · 10569）章节测试。
//
// 覆盖：章节结构/manifest（20 条实施条目 + 3 幕 2 议程 + 16 地点）、gather 5 组与当日组、
// 岩穴牌库（组牌/移出 2 张/顶 3 张未揭示入场/扩图）、黑暗地点口径、双面敌人翻面与强制效果、
// 地点连接（正交网格重算）、幕 1/2/3 与议程 1/2 背面、混乱符号（skull/cultist/tablet/elder_thing）、
// 地点行动与 Remembered、法典分支、结局 1–4/无结局与战役记录、JSON 存档往返。
//
// 本文件不 import engine.js：章节 behavior 只走内容层函数（真实引擎钩子由 P7 主进程合并后
// 用 contentRegistry 注册），因此单测可在并行 worker 尚未重建索引时独立运行。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import * as chapter from '../content/campaigns/theFeastOfHemlockVale/scenarios/theLostSister/index.js'
import {
  scenario, LOCATIONS, LOCATION_CONNECTIONS, LOCATION_COORDINATES, LOCATION_IDS, LOCATION_TABLE,
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, SET_ASIDE_CARDS, SET_ASIDE_ENEMY_CODES,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, GATHER_GROUPS, DAY_GATHER_GROUPS, DAY_NUMBERS,
  CAVERN_LOCATION_IDS, HORRORS_CAVERN_POOL_IDS, CAVERNS_DECK_SIZE, HYBRID_FACES, LIMULUS_CODES,
  CRUSTACEAN_CODES, REMEMBERED, RESIDENT_ASSETS, START_LOCATION, FUNGAL_CAVE_ID, SCENARIO_TEXT,
  CONNECTION_POLICY, encounterDeckForDay, dayGroupCards,
} from '../content/campaigns/theFeastOfHemlockVale/scenarios/theLostSister/definition.js'
import {
  chaosTokenAutoFails, locationIsDark, revealedCaveCount, skullValue, theLostSisterChaosToken,
  theLostSisterChaosTokenValue, THE_LOST_SISTER_TOKEN_MEANINGS,
} from '../content/campaigns/theFeastOfHemlockVale/scenarios/theLostSister/chaos.js'
import { behavior, events } from '../content/campaigns/theFeastOfHemlockVale/scenarios/theLostSister/behavior.js'
import entry10570 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10570.js'
import entry10571 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10571.js'
import entry10572 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10572.js'
import entry10573 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10573.js'
import entry10574 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10574.js'
import entry10575 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10575.js'
import entry10576 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10576.js'
import entry10577 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10577.js'
import entry10578 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10578.js'
import entry10579 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10579.js'
import entry10580 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10580.js'
import entry10581 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10581.js'
import entry10582 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10582.js'
import entry10583a from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10583a.js'
import entry10583b from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10583b.js'
import entry10584a from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10584a.js'
import entry10584b from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10584b.js'
import entry10585 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10585.js'
import entry10586 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10586.js'
import entry10587 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10587.js'

const ENTRIES = [
  entry10570, entry10571, entry10572, entry10573, entry10574, entry10575, entry10576, entry10577,
  entry10578, entry10579, entry10580, entry10581, entry10582, entry10583a, entry10583b,
  entry10584a, entry10584b, entry10585, entry10586, entry10587,
]
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

const clone = value => JSON.parse(JSON.stringify(value))
const identityShuffle = list => [...list]
// 确定性「洗牌」：按固定优先级排序，让初始 3 张岩穴固定为隐蔽海湾/地下水池/露天洞穴 1，
// 测试才能稳定断言具体地点的规则（真实对局用引擎的随机源）。
const CAVE_PRIORITY = [
  'hiddenCove', 'undergroundPools', 'openCave1', 'openCave2', 'suspendedGraveyard1',
  'suspendedGraveyard2', 'weedChokedBeach', 'rockyShoreline',
  'dryBurrow1', 'dryBurrow2', 'alkalineForest', 'iridescentPassage', 'overgrownTunnel', 'mineralTunnel',
]
const orderedShuffle = list => [...list].sort((a, b) => {
  const left = CAVE_PRIORITY.indexOf(String(a))
  const right = CAVE_PRIORITY.indexOf(String(b))
  return (left < 0 ? 99 : left) - (right < 0 ? 99 : right) || String(a).localeCompare(String(b))
})
const stateFor = (investigatorCount = 1, { day = 1, time = 'day', records = {}, flags = {}, difficulty = 'standard' } = {}) => ({
  investigators: Array.from({ length: investigatorCount }, (_, seat) => ({
    seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
    assets: [], hand: [], engaged: [], deck: [], discard: [], threat: [],
  })),
  locations: [], enemies: [], storyAssets: [], encounterDeck: [], encounterDiscard: [],
  scenarioFlags: { ...flags }, scenarioZones: {},
  campaign: { leadSeat: 0, records: { day, time, ...records }, completedSteps: [], trauma: {}, investigators: {} },
  victoryDisplay: [], doom: 0, difficulty, numInvestigators: investigatorCount,
  phase: 'investigation', round: 1, status: 'playing', actIndex: 0, agendaIndex: 0,
})

const stateWithScenario = (count = 1, options = {}) => {
  const state = stateFor(count, options)
  state.scenario = structuredClone(scenario)
  state.acts = clone(scenario.acts)
  state.agendas = clone(scenario.agendas)
  state.scenarioFlags.lostSisterDay = options.day ?? 1
  state.scenarioFlags.lostSisterNight = String(options.time || 'day').toLowerCase() === 'night'
  return state
}

const quietApi = () => ({ info: () => {} })
const recordingApi = () => {
  const api = { info: () => {}, trauma: [], defeated: [], finishes: [] }
  api.addTrauma = (seat, kind, amount) => { api.trauma.push({ seat, kind, amount }) }
  api.defeatInvestigator = seat => { api.defeated.push(seat) }
  api.finish = key => { api.finishes.push(key) }
  return api
}

function instanceFor(state, id) {
  const base = state.scenario.locations[id]
  if (!base) throw new Error(`unknown location ${id}`)
  const clues = base.cluesFixed ?? (base.cluesPerInvestigator != null
    ? base.cluesPerInvestigator * state.numInvestigators : Number(base.clues) || 0)
  return { ...clone(base), id, revealed: false, clues: 0, maxClues: clues, connections: [], attachments: [] }
}

/** 模拟引擎的 setupScenarioLocations + afterDeckSetup（placeLocation 会派发 locationPlaced）。 */
function runSetup(state, api = quietApi(), { shuffle = orderedShuffle } = {}) {
  const ids = behavior.setupLocations(state, null, { shuffle, api, info: api.info })
  for (const id of ids) {
    if (!state.locations.some(location => location.id === id)) state.locations.push(instanceFor(state, id))
    behavior.locationPlaced(state, state.locations.find(location => location.id === id), api)
  }
  behavior.afterDeckSetup(state, null, { shuffle, api, info: api.info })
  if (!state.investigators[0].location) state.investigators[0].location = START_LOCATION
  for (const inv of state.investigators.slice(1)) if (!inv.location) inv.location = START_LOCATION
  return state
}

const setup = (count = 1, options = {}) => {
  const state = stateWithScenario(count, options)
  runSetup(state, options.api || quietApi(), options)
  return state
}

const reveal = (state, id, api = quietApi()) => {
  const location = state.locations.find(item => item.id === id)
  location.revealed = true
  return behavior.locationRevealed(state, location, api)
}

const caveId = state => state.locations.find(location => location.id !== START_LOCATION)?.id

// ---------------------------------------------------------------------------
// 1. 章节结构、gather、条目
// ---------------------------------------------------------------------------

test('P7 theLostSister 章节结构：20 条实施条目、3 幕 2 议程、16 个地点、5 个 gather 组', () => {
  assert.equal(chapter.scenario.id, 'theLostSister')
  assert.equal(chapter.scenario.originalCode, '10569')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.campaignId, 'theFeastOfHemlockVale')
  assert.equal(chapter.manifest.referenceCode, '10569')
  assert.deepEqual([...GATHER_GROUPS], ['theLostSister', 'blight', 'horrorsInTheRock', 'mutations', 'myconids'])
  assert.deepEqual(DAY_NUMBERS, [1, 2, 3])
  assert.deepEqual(Object.keys(DAY_GATHER_GROUPS), ['1', '2', '3'])
  assert.equal(chapter.implementedEncounterCodes.length, 20)
  assert.deepEqual([...chapter.implementedEncounterCodes].sort(), ENTRIES.map(entry => entry.code).sort())
  for (const entry of ENTRIES) {
    assert.equal(entry.implemented, true, `${entry.code} implemented`)
    assert.equal(['act', 'agenda', 'location', 'enemy', 'treachery'].includes(entry.scope), true, `${entry.code} scope`)
  }
  assert.deepEqual([...ACT_CODES], ['10572', '10573', '10574'])
  assert.deepEqual([...AGENDA_CODES], ['10570', '10571'])
  assert.equal(scenario.acts.length, 3)
  assert.equal(scenario.agendas.length, 2)
  assert.equal(Object.keys(LOCATIONS).length, 16)
  assert.equal(LOCATION_IDS.length, 16)
  assert.equal(LOCATION_TABLE.length, 16)
  assert.equal(chapter.layout.edges.length, 0, '连接全部来自运行期网格')
  assert.equal(Object.keys(chapter.layout.locations).length, 16)
  assert.deepEqual(LOCATION_COORDINATES.akwan, { x: 0, y: 0 })
  assert.equal(CONNECTION_POLICY, 'orthogonal')
})

test('P7 theLostSister 指南正文：开场四分支、20 步设置、两条特别规则、四个结局', () => {
  assert.equal(SCENARIO_TEXT.textLanguage, 'en')
  assert.equal(SCENARIO_TEXT.heading, 'Scenario: The Lost Sister')
  assert.ok(SCENARIO_TEXT.intro.includes('Peters family home in Akwan'))
  assert.ok(SCENARIO_TEXT.introBranches.intro2.includes('Theo steps out'))
  assert.ok(SCENARIO_TEXT.introBranches.intro3.includes('rain'))
  assert.ok(SCENARIO_TEXT.introBranches.intro4.includes('Gideon'))
  assert.ok(SCENARIO_TEXT.introBranches.intro5.includes('night sky'))
  assert.equal(SCENARIO_TEXT.setupSteps.length, 20)
  assert.ok(SCENARIO_TEXT.setupSteps.every(step => step.text))
  assert.equal(SCENARIO_TEXT.specialRules.length, 2)
  assert.equal(SCENARIO_TEXT.specialRules[0].title, 'Dark Locations')
  assert.equal(SCENARIO_TEXT.specialRules[1].title, 'Double-Sided Enemies')
  assert.ok(SCENARIO_TEXT.specialRules[1].body.includes('Forced'))
  assert.ok(SCENARIO_TEXT.codex.theoPeters.passed.includes('Theo reconciled with Helen'))
  assert.ok(SCENARIO_TEXT.codex.drRosaMarquez.body.includes('Caverns deck'))
  assert.deepEqual(chapter.manifest.resolutionIds, ['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4'])
  assert.ok(SCENARIO_TEXT.resolutions.resolution4.includes('Akwan Shoreline'))
  assert.ok(SCENARIO_TEXT.resolutions.noResolution.includes('Skip to _Resolution 4_'))
})

test('P7 theLostSister 遭遇牌库：26 张固定 + 当日组；放一边 6 张；双面敌人不进牌库', () => {
  assert.equal(ENCOUNTER_DECK.length, 26)
  assert.equal(ENCOUNTER_DECK.filter(code => code === '10585').length, 3, '岩穴青苔 ×3')
  assert.equal(ENCOUNTER_DECK.filter(code => code === '10586').length, 3, '重属自然 ×3')
  assert.equal(ENCOUNTER_DECK.filter(code => code === '10587').length, 3, '荧光增生 ×3')
  for (const code of [...LIMULUS_CODES, ...CRUSTACEAN_CODES, '10721']) {
    assert.equal(ENCOUNTER_DECK.includes(code), false, `放一边的敌人不进牌库：${code}`)
  }
  for (const day of DAY_NUMBERS) {
    const deck = encounterDeckForDay(day)
    assert.equal(deck.length, 29, `第 ${day} 日牌库 26 + 当日诡计 3`)
    assert.deepEqual(deck.slice(26), DAY_GROUP_TREACHERY[day])
  }
  assert.deepEqual(dayGroupCards(2), ['10678', '10678', '10678'])
  assert.equal(SET_ASIDE_CARDS.length, 6)
  assert.deepEqual([...SET_ASIDE_ENEMY_CODES].sort(), ['10583a', '10584a', '10721'])
  const setAside = chapter.manifest.zones.setAside
  assert.equal(setAside.find(entry => entry.cardCode === '10721')?.count, 2, '水晶寄生虫 ×2')
  assert.equal(setAside.find(entry => entry.cardCode === '10584a')?.count, 2, '虾类混种 ×2')
  assert.equal(setAside.find(entry => entry.cardCode === '10582')?.count, 1, '真菌洞穴放一边')
  assert.equal(chapter.manifest.zones.inPlay.find(entry => entry.cardCode === RESIDENT_ASSETS.helen)?.count, 1)
  assert.deepEqual(chapter.manifest.dynamicEncounterGroups, ['theFirstDay', 'theSecondDay', 'theFinalDay'])
})
const DAY_GROUP_TREACHERY = { 1: ['10676', '10676', '10676'], 2: ['10678', '10678', '10678'], 3: ['10680', '10680', '10680'] }

test('P7 theLostSister modifyDeck：按当前天数把当日组并入遭遇牌库', () => {
  const state = stateWithScenario(1, { day: 2 })
  assert.deepEqual(behavior.modifyDeck(state, ['10585'], null, {}), ['10585', '10678', '10678', '10678'])
  const day3 = stateWithScenario(1, { day: 3 })
  assert.deepEqual(behavior.modifyDeck(day3, [], null, {}), ['10680', '10680', '10680'])
})

// ---------------------------------------------------------------------------
// 2. 岩穴牌库与地点连接
// ---------------------------------------------------------------------------

test('P7 theLostSister 岩穴牌库：12 张、移出 2 张岩中恐怖、顶 3 张未揭示入场、余 9 张', () => {
  assert.equal(CAVERN_LOCATION_IDS.length, 8)
  assert.equal(HORRORS_CAVERN_POOL_IDS.length, 6)
  assert.equal(CAVERNS_DECK_SIZE, 12)
  const state = setup(2)
  assert.equal(behavior.cavernsDeck(state).length, 9)
  assert.equal(state.scenarioZones.removedCaves.length, 2)
  const initial = state.scenarioFlags.lostSisterInitialCaves
  assert.equal(initial.length, 3)
  for (const id of initial) {
    const location = state.locations.find(item => item.id === id)
    assert.ok(location, `${id} 入场`)
    assert.equal(location.revealed, false, '顶 3 张未揭示')
    assert.equal(location.name, 'Cavern')
    assert.deepEqual(location.traits, ['Cave', 'Dark'])
  }
  assert.equal(state.scenarioZones.setAside.length, 6)
  assert.deepEqual(behavior.scenarioSummary(state).darkLocations.sort(),
    [...initial].sort(), '未揭示岩穴全部是黑暗地点')
})

test('P7 theLostSister 地点连接：阿克望与三个初始岩穴正交相连、双向对称、扩图补到 4 条', () => {
  const state = setup(1)
  const initial = state.scenarioFlags.lostSisterInitialCaves
  const akwan = state.locations.find(location => location.id === START_LOCATION)
  assert.equal(akwan.revealed, true, '起始地点已揭示')
  assert.deepEqual([...akwan.connections].sort(), [...initial].sort())
  for (const id of initial) {
    const location = state.locations.find(item => item.id === id)
    assert.equal(location.connections.includes(START_LOCATION), true, `${id} ↔ akwan 对称`)
  }
  assert.deepEqual(LOCATION_CONNECTIONS, {})
  // 幕 1 背面：真菌洞穴放在海岸旁，再用岩穴牌库顶补到 4 个连接。
  const api = quietApi()
  behavior.actReveal(state, state.acts[0], api)
  const fungal = state.locations.find(location => location.id === FUNGAL_CAVE_ID)
  assert.ok(fungal, '真菌洞穴入场')
  assert.ok(fungal.connections.length >= 4, `真菌洞穴连接 ${fungal.connections.join(',')}`)
  assert.ok(behavior.cavernsDeck(state).length < 9, '扩图消耗岩穴牌库')
})

// ---------------------------------------------------------------------------
// 3. 黑暗地点
// ---------------------------------------------------------------------------

test('P7 theLostSister 黑暗地点：未揭示岩穴恒为黑暗，揭示后按印刷特性；露天洞穴可熄暗', () => {
  const state = setup(2)
  assert.deepEqual(state.scenarioFlags.lostSisterInitialCaves, ['hiddenCove', 'undergroundPools', 'openCave1'])
  const cove = state.locations.find(location => location.id === 'hiddenCove')
  assert.equal(behavior.isDarkLocation(state, cove), true, '未揭示的岩穴面是[[洞穴]][[黑暗]]')
  reveal(state, 'hiddenCove')
  assert.deepEqual([...cove.traits], ['Coastal'], '隐蔽海湾揭示面只有[[海岸]]')
  assert.equal(behavior.isDarkLocation(state, cove), false, '揭示后不是黑暗地点')
  assert.equal(revealedCaveCount(state), 0, '揭示面不是[[洞穴]]')
  reveal(state, 'undergroundPools')
  const pools = state.locations.find(location => location.id === 'undergroundPools')
  assert.deepEqual([...pools.traits].sort(), ['Cave', 'Dark'])
  assert.equal(behavior.isDarkLocation(state, pools), true, '地下水池仍是[[黑暗]]')
  assert.equal(revealedCaveCount(state), 1)
  // 露天洞穴：检定成功后失去[[黑暗]]，下一个调查阶段恢复。
  reveal(state, 'openCave1')
  const openCave = state.locations.find(location => location.id === 'openCave1')
  assert.ok(openCave)
  const inv = state.investigators[0]
  inv.location = openCave.id
  state.currentSeat = inv.seat
  let testCalls = 0
  const api = { info: () => {}, test: () => { testCalls += 1; return { success: true } } }
  const move = behavior.fastActions(state, inv).find(action => action.rule === `lostSisterOpenCaveLight:${openCave.id}`)
  assert.ok(move && !move.reason)
  assert.equal(behavior.performAction(state, inv, move, api), true)
  assert.equal(testCalls, 1)
  assert.equal(behavior.isDarkLocation(state, openCave), false, '熄暗直到下一调查阶段')
  behavior.roundEnded(state, api)
  assert.equal(behavior.isDarkLocation(state, openCave), false, '轮末仍然熄暗')
  behavior.phaseBegan(state, 'investigation', api)
  assert.equal(behavior.isDarkLocation(state, openCave), true, '下一调查阶段恢复黑暗')
  // 荧光增生附属后，附着地点同样不再黑暗。
  assert.equal(behavior.isDarkLocation(state, openCave), true)
  openCave.attachments = [{ id: 'growth', code: '10587' }]
  assert.equal(behavior.isDarkLocation(state, openCave), false, '荧光增生使附属地点失去[[黑暗]]')
})

// ---------------------------------------------------------------------------
// 4. 双面敌人
// ---------------------------------------------------------------------------

test('P7 theLostSister 双面敌人：黑暗地点翻到黑夜面、非黑暗翻回白日面并保留标记', () => {
  const state = setup(2)
  const enemy = behavior.spawnLostSisterEnemy(state, HYBRID_FACES.crustacean.day, 'hiddenCove', quietApi())
  enemy.damageTaken = 2
  enemy.attachments = [{ id: 'att-1', code: '10587' }]
  const flipped = behavior.enemySpawned(state, enemy, quietApi())
  assert.equal(String(flipped.originalCode), HYBRID_FACES.crustacean.night, '黑暗地点 → 黑夜面')
  assert.equal(flipped.damageTaken, 2, '保留伤害标记')
  assert.equal(flipped.attachments.length, 1, '保留附属')
  assert.equal(behavior.hybridsInPlay(state).length, 1)
  assert.equal(behavior.hybridGroupOf(flipped.originalCode), 'crustacean')
  // 移到非黑暗地点（阿克望）→ 翻回白日面；同一实体 id 不变。
  const before = flipped.id
  flipped.location = START_LOCATION
  behavior.syncHybridAt(state, START_LOCATION, quietApi())
  assert.equal(String(flipped.originalCode), HYBRID_FACES.crustacean.day, '非黑暗地点 → 白日面')
  assert.equal(flipped.id, before, '翻面保留实体 id')
  assert.equal(behavior.enemyStatModifier(state, { code: HYBRID_FACES.limulus.day, originalCode: HYBRID_FACES.limulus.day }, 'health'), 6)
})

test('P7 theLostSister 双面敌人：翻面强制（鳖类受到 1/人伤害、虾类对每位调查员 1 伤害）', () => {
  const state = setup(2)
  state.investigators[0].location = START_LOCATION
  state.investigators[1].location = START_LOCATION
  const limulus = behavior.spawnLostSisterEnemy(state, HYBRID_FACES.limulus.night, START_LOCATION, quietApi())
  behavior.syncHybridAt(state, START_LOCATION, quietApi())
  assert.equal(String(limulus.originalCode), HYBRID_FACES.limulus.day, '非黑暗 → 白日面')
  assert.equal(limulus.damageTaken, 2, '翻至(在光中)面：1[per_investigator] 点伤害')
  const crustacean = behavior.spawnLostSisterEnemy(state, HYBRID_FACES.crustacean.day, START_LOCATION, quietApi())
  behavior.flipHybrid(state, crustacean, HYBRID_FACES.crustacean.night, quietApi())
  assert.equal(String(crustacean.originalCode), HYBRID_FACES.crustacean.night)
  assert.equal(state.investigators[0].damage, 1)
  assert.equal(state.investigators[1].damage, 1)
  assert.equal(crustacean.health, Number(behavior.enemyHealthFor(state, HYBRID_FACES.crustacean.night)))
})

test('P7 theLostSister 双面敌人数值：鳖类 +3/人生命、虾类 +天数生命、荧光增生 +1 攻击/伤害', () => {
  const state = setup(2, { day: 2 })
  const limulus = { code: '10583b', originalCode: '10583b', traits: ['Monster', 'Abomination'] }
  const crustacean = { code: '10584a', originalCode: '10584a', traits: ['Creature', 'Abomination'] }
  assert.equal(behavior.enemyStatModifier(state, limulus, 'health'), 6)
  assert.equal(behavior.enemyStatModifier(state, crustacean, 'health'), 2, '第 2 日 +2')
  assert.equal(behavior.enemyHealthFor(state, '10583b'), 11, '印刷 5 + 3×2')
  assert.equal(behavior.enemyHealthFor(state, '10584a'), 5, '印刷 3 + 第 2 日')
  const cave = state.locations.find(location => location.id === 'openCave1')
  assert.ok(cave, '露天洞穴 1 在初始 3 张内')
  cave.attachments = [{ id: 'growth', code: '10587' }]
  const enemyHere = { code: '10585', originalCode: '10585', location: cave.id, traits: ['Flora'] }
  assert.equal(behavior.enemyStatModifier(state, enemyHere, 'fight'), 1)
  assert.deepEqual(behavior.enemyAttackModifier(state, enemyHere), { damage: 1 })
  assert.equal(behavior.enemyDamageAmount(state, crustacean, 3), 1, '虾类白日面把攻击伤害减至 1')
  assert.equal(behavior.canOpportunityAttack(state, { code: '10583a', originalCode: '10583a' }), false,
    '鳖类白日面不能进行趁乱攻击')
  assert.equal(behavior.canOpportunityAttack(state, { code: '10583b', originalCode: '10583b' }), true)
  assert.equal(behavior.implementedEntryFlags('10583b').hybridSide, 'night')
  assert.equal(behavior.implementedEntryFlags('10584a').reduceAttackDamageTo, 1)
})

// ---------------------------------------------------------------------------
// 5. 幕 / 议程
// ---------------------------------------------------------------------------

test('P7 theLostSister 幕 1：两个 Remembered 齐备立即推进；背面放入真菌洞穴并补满连接', () => {
  const state = setup(2)
  const api = quietApi()
  assert.equal(behavior.checkObjectives(state, api), false, '尚未记住任何线索')
  behavior.remember(state, REMEMBERED.dogLeash, api)
  assert.equal(behavior.checkObjectives(state, api), false)
  behavior.remember(state, REMEMBERED.footprints, api)
  assert.equal(behavior.hasBothMemories(state), true)
  assert.equal(behavior.checkObjectives(state, api), true)
  assert.equal(state.actIndex, 1, '幕 1 → 幕 2')
  assert.ok(state.locations.some(location => location.id === FUNGAL_CAVE_ID), '背面放入真菌洞穴')
  assert.equal(state.scenarioFlags.lostSisterAct1Resolved, true)
})

test('P7 theLostSister 幕 2/3：进入真菌洞穴推进；幕 2 背面生成鳖类、移除海伦、读法典 Σ', () => {
  const api = recordingApi()
  const state = setup(2, { api })
  state.actIndex = 1
  state.investigators[0].location = FUNGAL_CAVE_ID
  // 先把真菌洞穴放进场（幕 1 背面）。
  behavior.actReveal(state, state.acts[0], api)
  assert.equal(behavior.checkObjectives(state, api), true, '有调查员在真菌洞穴 → 推进幕 2')
  assert.equal(state.actIndex, 2)
  const limulus = state.enemies.find(enemy => LIMULUS_CODES.includes(String(enemy.originalCode || enemy.code)))
  assert.ok(limulus, '幕 2 背面在真菌洞穴生成放一边的鳖类混种')
  assert.equal(limulus.location, FUNGAL_CAVE_ID)
  assert.equal(behavior.residentInPlay(state, 'helen'), null, '移出海伦')
  assert.equal(state.scenarioFlags.lostSisterAct2Resolved, true)
  // 幕 3：击败鳖类混种 → 推进并进入结局 1（advanceAct → actReveal 背面）。
  state.enemies = state.enemies.filter(enemy => enemy !== limulus)
  state.victoryDisplay.push({ code: '10583a', originalCode: '10583a', victory: 2 })
  assert.equal(behavior.checkObjectives(state, api), true)
  assert.deepEqual(api.finishes, ['resolution1'])
  assert.equal(state.scenarioFlags.lostSisterAct3Resolved, true)
})

test('P7 theLostSister 议程 1 背面：生成虾类混种、黑暗地点随机弃牌、按天数在议程 2 放毁灭', () => {
  const state = setup(2, { day: 3 })
  const cave = caveId(state)
  state.investigators[0].location = cave
  state.investigators[0].hand = ['01001']
  state.investigators[1].location = START_LOCATION
  state.investigators[1].hand = ['01002']
  const api = { info: () => {} }
  assert.equal(behavior.agendaReveal(state, state.agendas[0], api), true)
  const crustacean = state.enemies.find(enemy => CRUSTACEAN_CODES.includes(String(enemy.originalCode || enemy.code)))
  assert.ok(crustacean, '生成放一边的虾类混种')
  assert.equal(crustacean.location, START_LOCATION, '离最多调查员最近的海岸：阿克望（海岸）')
  assert.equal(state.investigators[0].hand.length, 0, '黑暗地点的调查员随机弃 1 张')
  assert.equal(state.investigators[1].hand.length, 1, '非黑暗地点不弃')
  assert.equal(state.doom, 3, '按当前天数在议程 2 放毁灭')
  assert.equal(state.agendas[1].doom, 3)
})

test('P7 theLostSister 议程 2 背面：未撤退的调查员全部被击败并承受 1 点精神创伤', () => {
  const api = recordingApi()
  const state = setup(2, { api })
  state.investigators[1].resigned = true
  assert.equal(behavior.agendaReveal(state, state.agendas[1], api), true)
  assert.deepEqual(api.defeated, [0])
  assert.deepEqual(api.trauma, [{ seat: 0, kind: 'mental', amount: 1 }])
  assert.deepEqual(api.finishes, ['noResolution'])
  assert.equal(state.investigators[0].defeated, true)
})

// ---------------------------------------------------------------------------
// 6. 混乱符号
// ---------------------------------------------------------------------------

test('P7 theLostSister 混乱符号：skull 按已揭示洞穴数、tablet 按是否在洞穴', () => {
  const state = setup(2)
  const inv = state.investigators[0]
  inv.location = 'undergroundPools'
  assert.equal(revealedCaveCount(state), 0, '未揭示不算已揭示洞穴')
  assert.equal(behavior.isDarkLocation(state, state.locations.find(location => location.id === 'undergroundPools')), true)
  reveal(state, 'undergroundPools')
  reveal(state, 'openCave1')
  assert.equal(revealedCaveCount(state), 2)
  assert.equal(skullValue(state), 1, '简单/普通：2/2 向上取整 = 1')
  state.difficulty = 'hard'
  assert.equal(skullValue(state), 2, '困难：等于洞穴数')
  assert.equal(theLostSisterChaosTokenValue(state, 'skull'), -2)
  state.difficulty = 'standard'
  // 平板：在洞穴 -4，不在 -2。
  assert.equal(theLostSisterChaosToken(state, inv, 'tablet').delta, -4)
  state.investigators[1].location = START_LOCATION
  assert.equal(theLostSisterChaosToken(state, state.investigators[1], 'tablet').delta, -2)
  state.difficulty = 'expert'
  assert.equal(theLostSisterChaosToken(state, inv, 'tablet').delta, -6)
  assert.equal(theLostSisterChaosToken(state, state.investigators[1], 'tablet').delta, -4)
})

test('P7 theLostSister 混乱符号：[cultist] 治愈、[elder_thing] 再抽/自动失败', () => {
  const state = setup(2)
  const inv = state.investigators[0]
  inv.location = START_LOCATION
  const cultist = theLostSisterChaosToken(state, inv, 'cultist')
  assert.equal(cultist.delta, -1)
  assert.deepEqual(cultist.onDraw, [{ type: 'scenarioToken', token: 'cultist', mode: 'healOnSuccess' }])
  assert.equal(THE_LOST_SISTER_TOKEN_MEANINGS.hard.cultist.rider, 'cultistHealOnSuccessBy2')
  // 旧日支配者：有[[异形]]敌人时简单/普通再抽一个；困难/专家自动失败。
  state.enemies.push({ id: 'abo', code: '10583a', originalCode: '10583a', location: START_LOCATION,
    traits: ['Monster', 'Abomination', 'Elite'] })
  const easy = theLostSisterChaosToken(state, inv, 'elderthing')
  assert.equal(easy.drawAnother, true)
  assert.deepEqual(easy.onDraw, [{ type: 'scenarioToken', token: 'elderthing', mode: 'revealAnother' }])
  assert.equal(chaosTokenAutoFails(state, inv, 'elderthing'), false, '简单不自动失败')
  state.difficulty = 'hard'
  const hard = theLostSisterChaosToken(state, inv, 'elderthing')
  assert.equal(hard.delta, -3)
  assert.equal(behavior.testAutoFail(state, inv, { drawn: ['elderthing'] }), true)
  assert.equal(behavior.testAutoFail(state, inv, { drawn: ['skull'] }), false)
  state.enemies = []
  assert.equal(behavior.testAutoFail(state, inv, { drawn: ['elderthing'] }), false, '没有异形敌人就不自动失败')
})

test('P7 theLostSister 混乱标记追加效果：cultist 治愈恐惧、elder_thing 自动失败/再抽', () => {
  const state = setup(1)
  const inv = state.investigators[0]
  inv.horror = 2
  const api = { info: () => {}, healed: [], fails: 0, reveals: 0 }
  api.healHorror = (seat, amount) => { api.healed.push([seat, amount]); inv.horror -= amount }
  api.failTest = () => { api.fails += 1 }
  api.revealChaosTokens = () => { api.reveals += 1 }
  assert.equal(behavior.applyTokenEffect(state, inv, { token: 'cultist', mode: 'healOnSuccess', test: { failedBy: 0 } }, api), true)
  assert.equal(inv.horror, 1)
  assert.equal(behavior.applyTokenEffect(state, inv, { token: 'cultist', mode: 'healBy2', test: { failedBy: 1 } }, api), false,
    '困难侧要求差值 ≥2')
  assert.equal(behavior.applyTokenEffect(state, inv, { token: 'elderthing', mode: 'autoFail' }, api), true)
  assert.equal(api.fails, 1)
  assert.equal(behavior.applyTokenEffect(state, inv, { token: 'elderthing', mode: 'revealAnother' }, api), true)
  assert.equal(api.reveals, 1)
  assert.equal(scenario.tokenMeanings.standard.skull.delta, 0)
  assert.ok(scenario.tokenMeanings.hard.tablet.text.includes('-4'))
})

// ---------------------------------------------------------------------------
// 7. 地点行动、Remembered、法典
// ---------------------------------------------------------------------------

test('P7 theLostSister 地点行动：隐蔽海湾/地下水池的团队付款 Remembered、悬墓每场一次扩图', () => {
  const state = setup(2)
  const inv = state.investigators[0]
  const cove = state.locations.find(location => location.id === 'hiddenCove')
  assert.ok(cove)
  inv.location = cove.id
  inv.clues = 3
  state.investigators[1].location = cove.id
  state.investigators[1].clues = 2
  const move = behavior.actions(state, inv).find(action => action.rule === `lostSisterRemember:${REMEMBERED.dogLeash}`)
  assert.ok(move && !move.reason)
  assert.equal(behavior.performAction(state, inv, move, quietApi()), true)
  assert.equal(inv.clues + state.investigators[1].clues, 1, '共同支付 2[per_investigator] = 4')
  assert.equal(behavior.isRemembered(state, REMEMBERED.dogLeash), true)
  assert.equal(behavior.actions(state, inv).find(action => action.rule === `lostSisterRemember:${REMEMBERED.dogLeash}`).reason != null, true,
    '已经记住过就不能再付一次')
  // 地下水池：同一套团队付款，记下足迹。
  inv.location = 'undergroundPools'
  state.investigators[1].location = 'undergroundPools'
  inv.clues = 4
  const footprints = behavior.actions(state, inv).find(action => action.rule === `lostSisterRemember:${REMEMBERED.footprints}`)
  assert.ok(footprints && !footprints.reason)
  assert.equal(behavior.performAction(state, inv, footprints, quietApi()), true)
  assert.equal(behavior.isRemembered(state, REMEMBERED.footprints), true)
  assert.equal(behavior.hasBothMemories(state), true)
  // 悬墓：受到 1 点恐惧并把岩穴牌库顶放到相邻空格（团队每场一次）。
  const graveyardId = 'suspendedGraveyard1'
  behavior.placeCavernLocation(state, graveyardId, { x: 0, y: 1 }, quietApi())
  inv.location = graveyardId
  inv.horror = 0
  const deckBefore = behavior.cavernsDeck(state).length
  const dig = behavior.actions(state, inv).find(action => action.rule === `lostSisterGraveyardDig:${graveyardId}`)
  assert.ok(dig && !dig.reason)
  assert.equal(behavior.performAction(state, inv, dig, quietApi()), true)
  assert.equal(inv.horror, 1)
  assert.equal(behavior.cavernsDeck(state).length, deckBefore - 1)
  assert.notEqual(behavior.actions(state, inv)
    .find(action => action.rule === `lostSisterGraveyardDig:${graveyardId}`).reason, null, '团队每场游戏一次')
})

test('P7 theLostSister 幕 2/3 行动：花费 1/人线索把相邻黑暗地点的敌人拉过来', () => {
  const state = setup(2)
  // 幕 1 背面：把真菌洞穴放到场，让洞穴彼此相连。
  behavior.actReveal(state, state.acts[0], quietApi())
  state.actIndex = 1
  const inv = state.investigators[0]
  const fungal = state.locations.find(location => location.id === FUNGAL_CAVE_ID)
  const darkNeighborId = fungal.connections.find(id => {
    const location = state.locations.find(item => item.id === id)
    return location && behavior.isDarkLocation(state, location)
  })
  assert.ok(darkNeighborId, '真菌洞穴与未揭示岩穴相连')
  const enemy = behavior.spawnLostSisterEnemy(state, '10585', darkNeighborId, quietApi())
  inv.location = FUNGAL_CAVE_ID
  inv.clues = 2
  const lure = behavior.actions(state, inv).find(action => action.rule === 'lostSisterLureFromDark')
  assert.ok(lure && !lure.reason)
  assert.equal(behavior.performAction(state, inv, lure, quietApi()), true)
  assert.equal(enemy.location, FUNGAL_CAVE_ID)
  assert.equal(inv.clues, 0)
})

test('P7 theLostSister 法典：威廉/吉迪恩/希奥/龙虾畸体/罗莎·马尔克斯', () => {
  const state = setup(2)
  const api = { info: () => {}, test: () => ({ success: true }), choose: () => 'bottom' }
  assert.equal(behavior.codex(state, 'williamHemlock', api), true)
  assert.equal(state.campaign.records.relationships.williamHemlock, 1)
  assert.equal(state.campaign.records.lostSisterBonusXp, 1)
  assert.equal(behavior.codex(state, 'gideonMizrah', api), true)
  assert.equal(behavior.isRemembered(state, REMEMBERED.gideonHeirloom), true)
  // 希奥：先记下「争论」，两人同地点时检定成功 → 和解记录。
  state.storyAssets.push({ id: 'theo', code: RESIDENT_ASSETS.theo, originalCode: RESIDENT_ASSETS.theo, location: START_LOCATION })
  state.storyAssets.push({ id: 'helen', code: RESIDENT_ASSETS.helen, originalCode: RESIDENT_ASSETS.helen, location: START_LOCATION })
  assert.equal(behavior.codex(state, 'theoPeters', api), true)
  assert.equal(behavior.isRemembered(state, REMEMBERED.theoArguing), true)
  assert.equal(behavior.codex(state, 'theoPeters', api), true)
  assert.equal(state.campaign.records.theoReconciledWithHelen, true)
  assert.equal(state.campaign.records.relationships.theoPeters, 1)
  // 龙虾畸体：和解后把希奥的 1 点伤害移给鳖类混种。
  const limulus = behavior.spawnLostSisterEnemy(state, '10583a', FUNGAL_CAVE_ID, api)
  const theo = behavior.residentInPlay(state, 'theo')
  theo.damage = 2
  assert.equal(behavior.codex(state, 'lobstrosity', api), true)
  assert.equal(theo.damage, 1)
  assert.equal(limulus.damageTaken, 1)
  // 罗莎：牌库顶放到牌库底。
  const top = behavior.cavernsTop(state)
  assert.equal(behavior.codex(state, 'drRosaMarquez', api), true)
  assert.equal(behavior.cavernsTop(state) === top, false)
  assert.equal(behavior.cavernsDeck(state).at(-1), top)
})

// ---------------------------------------------------------------------------
// 8. 结局与记录
// ---------------------------------------------------------------------------

test('P7 theLostSister 结局 1–4：分支、记录、经验与勘察勾选', () => {
  // 无结局：+1 奖励经验并进入结局 4。
  {
    const state = setup(2)
    const result = behavior.resolution(state, 'noResolution', [], quietApi())
    assert.equal(result.bonus, 1)
    assert.equal(state.campaign.records.lostSisterResolution, 'noResolution')
    assert.equal(state.campaign.records.lostSisterResolutionFinal, 'resolution4')
  }
  // 结局 1：未和解 → 结局 3。
  {
    const state = setup(2)
    const result = behavior.resolution(state, 'resolution1', [], quietApi())
    assert.equal(result.skipTo, 'resolution3')
    assert.equal(state.campaign.records.lostSisterResolutionNext, 'resolution3')
  }
  // 结局 1：已和解 → 结局 2，并在结局 2 记录家族重聚。
  {
    const state = setup(2)
    state.campaign.records.theoReconciledWithHelen = true
    assert.equal(behavior.resolution(state, 'resolution1', [], quietApi()).skipTo, 'resolution2')
    const result = behavior.resolution(state, 'resolution2', [], quietApi())
    assert.equal(result.bonus, 2)
    assert.equal(state.campaign.records.thePetersFamilyWasReunited, true)
  }
  // 结局 3：记录伊丽莎白获救。
  {
    const state = setup(2)
    const result = behavior.resolution(state, 'resolution3', [], quietApi())
    assert.equal(result.bonus, 2)
    assert.equal(state.campaign.records.elizabethPetersWasSaved, true)
  }
  // 结局 4：胜利区经验 + 吉迪恩传家宝 + 勘察记录。
  {
    const state = setup(2)
    state.victoryDisplay.push({ code: '10582', victory: 1 })
    state.investigators[0].clues = 2
    assert.equal(behavior.isRemembered(state, REMEMBERED.gideonHeirloom), false)
    const plain = behavior.resolution(state, 'resolution4', [], quietApi())
    assert.equal(plain.bonus, 1, '只有胜利区 1 点')
    assert.equal(state.campaign.records.areasSurveyed.akwanShoreline, true)
    const second = setup(2)
    second.victoryDisplay.push({ code: '10582', victory: 1 })
    second.investigators[0].clues = 2
    behavior.remember(second, REMEMBERED.gideonHeirloom, quietApi())
    const helped = behavior.resolution(second, 'resolution4', [], quietApi())
    assert.equal(helped.bonus, 2, '+1 吉迪恩奖励')
    assert.equal(second.campaign.records.gideonFoundHisTreasure, true)
    assert.equal(second.campaign.records.relationships.gideonMizrah, 1)
  }
})

test('P7 theLostSister 遭遇事件（10586 重属自然）：白日失败二选一、黑夜让敌人治愈', () => {
  const state = setup(2)
  const inv = state.investigators[0]
  inv.location = START_LOCATION
  const enemy = behavior.spawnLostSisterEnemy(state, '10585', START_LOCATION, quietApi())
  enemy.damageTaken = 2
  // 白日：失败 → 选择「最近的敌人攻击你」。
  const attackApi = { info: () => {}, test: () => ({ success: false }), choose: () => 'attack', attacks: 0 }
  attackApi.attack = (attacker, target) => {
    assert.equal(attacker, enemy)
    assert.equal(target, inv)
    attackApi.attacks += 1
  }
  assert.equal(typeof entry10586.encounterResolve, 'function', '诡计显现经 encounterResolve 交给章节事件')
  assert.equal(events.lostSisterReclaimedByNature(state, { seat: 0, night: false }, attackApi), true)
  assert.equal(attackApi.attacks, 1)
  // 黑夜：失败 → 选择让敌人治愈 1 点。
  const healApi = { info: () => {}, test: () => ({ success: false }), choose: () => 'heal' }
  assert.equal(events.lostSisterReclaimedByNature(state, { seat: 0, night: true }, healApi), true)
  assert.equal(enemy.damageTaken, 1)
  // 成功则不结算。
  assert.equal(events.lostSisterReclaimedByNature(state, { seat: 0, night: false }, { info: () => {}, test: () => ({ success: true }) }), false)
})

test('P7 theLostSister 居民与开场分支：预赛布置按天数/昼夜放入居民', () => {
  const day1 = setup(2, { day: 1 })
  assert.deepEqual(behavior.residentsInPlay(day1).map(asset => String(asset.originalCode)).sort(),
    [RESIDENT_ASSETS.helen, RESIDENT_ASSETS.theo].sort())
  assert.equal(behavior.introFor(day1).key, 'intro2')
  const day3 = setup(2, { day: 3 })
  assert.equal(behavior.residentsInPlay(day3).length, 3, 'Helen/Gideon/William')
  assert.equal(behavior.residentInPlay(day3, 'william').location, START_LOCATION)
  assert.equal(behavior.introFor(day3).key, 'intro4')
  const night = setup(2, { day: 1, time: 'night' })
  assert.equal(behavior.introFor(night).key, 'intro5')
  assert.deepEqual(behavior.residentsInPlay(night).map(asset => String(asset.originalCode)), [RESIDENT_ASSETS.helen])
  assert.equal(behavior.isNight(night), true)
  assert.equal(behavior.dayOf(night), 1)
})

test('P7 theLostSister JSON 往返：存档后继续扩图、翻面与结局', () => {
  const state = setup(2, { day: 2 })
  const api = quietApi()
  behavior.actReveal(state, state.acts[0], api)
  const restored = clone(state)
  assert.equal(restored.scenario.id, 'theLostSister')
  assert.equal(behavior.cavernsDeck(restored).length, behavior.cavernsDeck(state).length)
  assert.ok(restored.locations.some(location => location.id === FUNGAL_CAVE_ID))
  assert.equal(behavior.scenarioSummary(restored).day, 2)
  // 往返后仍能扩图并触发双面敌人同步。
  const fungal = restored.locations.find(location => location.id === FUNGAL_CAVE_ID)
  const enemy = behavior.spawnLostSisterEnemy(restored, HYBRID_FACES.crustacean.day, fungal.id, api)
  behavior.syncHybridAt(restored, fungal.id, api)
  assert.equal(String(enemy.originalCode), behavior.isDarkLocation(restored, fungal)
    ? HYBRID_FACES.crustacean.night : HYBRID_FACES.crustacean.day)
  const again = clone(restored)
  const result = behavior.resolution(again, 'resolution1', [], { info: () => {} })
  assert.equal(result.skipTo, 'resolution3')
  assert.equal(typeof again.campaign.records.lostSisterResolution, 'string')
})

test('P7 theLostSister 敌人定义读点：放一边与牌库敌人的印刷数值来自卡表', () => {
  assert.equal(scenario.enemies['10583a'].fight, 3)
  assert.equal(scenario.enemies['10583b'].fight, 4)
  assert.equal(scenario.enemies['10584a'].evade, 4)
  assert.equal(chapter.CARD_DATA['10584a'].quantity, 2, '虾类混种印刷 2 张')
  assert.equal(chapter.CARD_DATA['10585'].quantity, 3, '岩穴青苔印刷 3 张')
  assert.equal(scenario.enemies['10585'].health, 3)
  assert.equal(caveIdLabel(), 'hiddenCove')
  assert.equal(scenario.treacheries['10586'].quantity, undefined,
    'encounterDefinitions 只带印刷属性，数量从卡表读')
  assert.equal(chapter.CARD_DATA['10586'].quantity, 3)
  assert.equal(chapter.CARD_DATA['10587'].traits.includes('Flora'), true)
  assert.equal(scenario.locations[FUNGAL_CAVE_ID].victory, 1)
  assert.equal(scenario.locations[START_LOCATION].resign, true)
  assert.deepEqual([...scenario.locations[caveIdLabel()].traits].sort(), ['Coastal'])
  assert.equal(scenario.enemies['10583a'].elite, true)
  assert.equal(scenario.enemies['10583b'].hunter, true)
  assert.equal(scenario.enemies['10584a'].hunter, true)
})
const caveIdLabel = () => 'hiddenCove'
