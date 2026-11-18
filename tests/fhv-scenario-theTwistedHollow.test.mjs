// P7 扭曲空洞（theTwistedHollow · 10605）章节测试。
//
// 覆盖：章节结构/manifest、gather 组与放一边、树林（Woods）独立牌库与网格铺开、
// 地点相邻连接、黑暗等级与骷髅标记、毒沼/各地点揭示强制、幕 1/幕 2/特殊议程的三段推进、
// 类熊混种与猎踪混种、三张诡计的二选一失败分支、结局 1/2/3/无结局与战役记录、JSON 存档往返。
//
// 本文件不 import engine.js：章节 behavior 只走内容层函数（真实引擎钩子由 P7 主进程合并后
// 用 contentRegistry 注册），因此单测可在并行 worker 尚未重建索引时独立运行。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import * as chapter from '../content/campaigns/theFeastOfHemlockVale/scenarios/theTwistedHollow/index.js'
import {
  scenario, LOCATIONS, LOCATION_CONNECTIONS, LOCATION_IDS, WESTERN_WOODS_IDS, ENCOUNTER_DECK,
  GATHER_GROUPS, GATHER_SET_ASIDE_GROUPS, SET_ASIDE_CARDS, SET_ASIDE_LOCATIONS, ACT_CODES, AGENDA_CODES,
  SPECIAL_AGENDA_CODE, URSINE_HYBRID_CODE, LANTERN_SPEC, LANTERN_CODES, STORY_CODES, ACT_STAGES,
  AGENDA_STAGES, SCENARIO_TEXT, RESIDENTS, DIRECTION_VECTORS, ACT2_GRID_OFFSETS,
} from '../content/campaigns/theFeastOfHemlockVale/scenarios/theTwistedHollow/definition.js'
import {
  darknessLevel, setDarknessLevel, raiseDarkness, twistedHollowChaosToken, twistedHollowChaosTokenValue,
  TWISTED_HOLLOW_TOKEN_MEANINGS, isHardSide, INITIAL_DARKNESS,
} from '../content/campaigns/theFeastOfHemlockVale/scenarios/theTwistedHollow/chaos.js'
import { layout, OPENING_SLOTS, areAdjacent } from '../content/campaigns/theFeastOfHemlockVale/scenarios/theTwistedHollow/layout.js'
import entry10606 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/10606.js'
import entry10607a from '../src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/10607a.js'
import entry10607b from '../src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/10607b.js'
import entry10608 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/10608.js'
import entry10609 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/10609.js'
import entry10610a from '../src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/10610a.js'
import entry10610b from '../src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/10610b.js'
import entry10611a from '../src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/10611a.js'
import entry10611b from '../src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/10611b.js'
import entry10612 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/10612.js'
import entry10613 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/10613.js'
import entry10614 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/10614.js'
import entry10615 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/10615.js'
import entry10616 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/10616.js'
import entry10617 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/10617.js'
import entry10618 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/10618.js'
import entry10619 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/10619.js'
import entry10620 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/10620.js'
import entry10621 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/10621.js'
import entry10622 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/10622.js'
import entry10623 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/10623.js'
import entry10624 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/10624.js'
import entry10625 from '../src/cards/encounter-entries/theFeastOfHemlockVale/theTwistedHollow/10625.js'

const ENTRIES = [entry10606, entry10607a, entry10607b, entry10608, entry10609, entry10610a, entry10610b,
  entry10611a, entry10611b, entry10612, entry10613, entry10614, entry10615, entry10616, entry10617,
  entry10618, entry10619, entry10620, entry10621, entry10622, entry10623, entry10624, entry10625]
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

const clone = value => JSON.parse(JSON.stringify(value))
const stateFor = (investigatorCount = 1, records = {}, flags = {}) => ({
  investigators: Array.from({ length: investigatorCount }, (_, seat) => ({
    seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
    assets: [], engaged: [], deck: [], discard: [], hand: [], threat: [],
  })),
  locations: [], enemies: [], storyAssets: [], encounterDeck: [], encounterDiscard: [],
  scenarioFlags: { ...flags }, scenarioZones: {}, chaosBag: [], rngState: 20261117,
  campaign: { leadSeat: 0, records: { ...records }, completedSteps: [], trauma: {}, investigators: {} },
  victoryDisplay: [], doom: 0, difficulty: 'standard', numInvestigators: investigatorCount,
  phase: 'investigation', round: 1, status: 'playing',
})
const stateWithScenario = (count = 1, records = {}, flags = {}) => {
  const state = stateFor(count, records, flags)
  state.scenario = structuredClone(scenario)
  state.acts = structuredClone(scenario.acts)
  state.agendas = structuredClone(scenario.agendas)
  return state
}
const quietApi = () => ({ info: () => {} })

/** 引擎 out-of-play 敌区（enemy-zones.js）的最小桩：追击中的敌人不在 state.enemies 里。 */
function pursuitZones(state) {
  const store = []
  const zones = {
    list: () => store.map(record => record.enemy),
    get: (zone, id) => store.find(record => record.enemy.id === id)?.enemy || null,
    isInactive: id => store.some(record => record.enemy.id === id) && !state.enemies.some(enemy => enemy.id === id),
    contains: id => store.some(record => record.enemy.id === id),
    // 引擎 restore 会走 enterExisting → 生成钩子；桩里用回调模拟。
    _onRestore: null,
    enter(enemy, zone) {
      void zone
      const index = state.enemies.findIndex(item => item.id === enemy.id)
      if (index < 0) return null
      state.enemies.splice(index, 1)
      enemy.location = null
      enemy.engagedSeat = null
      enemy.exhausted = false
      store.push({ enemy })
      return enemy.id
    },
    restore(zone, id, { location, engageSeat = null, exhausted = false } = {}) {
      void zone
      const index = store.findIndex(record => record.enemy.id === id)
      if (index < 0) return null
      const [record] = store.splice(index, 1)
      record.enemy.location = location
      record.enemy.engagedSeat = engageSeat
      record.enemy.exhausted = exhausted
      state.enemies.push(record.enemy)
      if (typeof zones._onRestore === 'function') zones._onRestore(record.enemy)
      return record.enemy
    },
    size: () => store.length,
  }
  return zones
}

function makeApi(state, options = {}) {
  const api = {
    info: () => {},
    trauma: [],
    revealed: [],
    advanced: 0,
    reverted: 0,
    finished: null,
    drawn: [],
    attacks: [],
    choices: options.choices || [],
    choose(request = {}) {
      api.lastRequest = request
      if (api.choices.length) return api.choices.shift()
      return options.defaultChoice ?? request.options?.[0]?.id ?? null
    },
    test(seat, skill, difficulty, resolve) {
      api.tests ||= []
      api.tests.push({ seat, skill, difficulty })
      const success = options.testSuccess ?? false
      resolve({ success, value: success ? difficulty : 0, difficulty, seat, skill })
    },
    healDamage: (seat, amount) => { state.investigators[seat].damage = Math.max(0, state.investigators[seat].damage - amount) },
    healHorror: (seat, amount) => { state.investigators[seat].horror = Math.max(0, state.investigators[seat].horror - amount) },
    directDamage: (seat, amount) => { state.investigators[seat].damage += amount },
    directHorror: (seat, amount) => { state.investigators[seat].horror += amount },
    damageAsset: (seat, assetId, amount) => {
      const asset = (state.investigators[seat]?.assets || []).find(item => item.id === assetId)
      if (asset) asset.damage = (Number(asset.damage) || 0) + amount
    },
    addTrauma: (seat, kind, amount) => { api.trauma.push({ seat, kind, amount }) },
    defeatInvestigator: seat => { state.investigators[seat].defeated = true },
    spendClues: (seat, amount) => { state.investigators[seat].clues = Math.max(0, state.investigators[seat].clues - amount) },
    gainClues: (seat, amount) => { state.investigators[seat].clues += amount },
    remove: id => { state.locations = state.locations.filter(location => location.id !== id) },
    reveal: id => {
      const location = state.locations.find(item => item.id === id)
      if (location) location.revealed = true
      api.revealed.push(id)
      return true
    },
    advanceAct: () => { api.advanced += 1 },
    finish: key => { api.finished = key },
    revertAgenda: () => { api.reverted += 1 },
    addDoom: amount => { state.doom = (Number(state.doom) || 0) + amount },
    drawEncounter: seat => { api.drawn.push(seat) },
    attack: (enemy, inv) => { api.attacks.push([enemy.id, inv.seat]) },
    moveInvestigator: (seat, id) => { state.investigators[seat].location = id },
    addChaosToken: token => { state.chaosBag.push(token) },
    addTraumaRaw: null,
  }
  api.enemyZones = pursuitZones(state)
  api.enemyZones._onRestore = enemy => chapter.behavior.enemySpawned(state, enemy, api)
  api.zones = api.enemyZones
  return api
}

const setup = (count = 1, records = {}, options = {}) => {
  const state = stateWithScenario(count, records)
  const api = makeApi(state, options)
  const report = chapter.behavior.setupScenario(state, api)
  return { state, api, report }
}

const placeEnemy = (state, code, overrides = {}) => {
  const def = state.scenario.enemies?.[code] || {}
  const enemy = {
    ...structuredClone(def), id: `enemy-${code}-${(state.enemies || []).length + 1}`,
    code, originalCode: code, location: null, engagedSeat: null, exhausted: false, damageTaken: 0,
    fight: def.fight ?? 3, evade: def.evade ?? 3, health: def.health ?? 1, damage: def.damage ?? 1,
    horror: def.horror ?? 1, traits: [...(def.traits || [])], ...overrides,
  }
  state.enemies.push(enemy)
  return enemy
}

// ---------------------------------------------------------------------------
// 1. 章节结构 / manifest / 单卡条目
// ---------------------------------------------------------------------------

test('P7 theTwistedHollow 章节结构：23 条单卡条目、15 张西部树林、4 个 gather 组与 manifest', () => {
  assert.equal(chapter.scenario.id, 'theTwistedHollow')
  assert.equal(chapter.scenario.originalCode, '10605')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.campaignId, 'theFeastOfHemlockVale')
  assert.deepEqual([...GATHER_GROUPS].sort(), ['myconids', 'theFirstDay', 'theForest', 'theTwistedHollow'].sort())
  assert.deepEqual([...GATHER_SET_ASIDE_GROUPS], [], '本章没有整组放一边的遭遇组')
  assert.equal(Object.keys(LOCATIONS).length, 15)
  assert.equal(LOCATION_IDS.length, 15)
  assert.equal(WESTERN_WOODS_IDS.length, 14)
  assert.deepEqual([...SET_ASIDE_LOCATIONS], ['theTwistedHollow'])
  assert.equal(chapter.implementedEncounterCodes.length, 23)
  assert.deepEqual([...chapter.implementedEncounterCodes].sort(), ENTRIES.map(entry => entry.code).sort())
  assert.equal(ENTRIES.length, 23)
  for (const entry of ENTRIES) {
    assert.equal(entry.implemented, true, `${entry.code} 声明 implemented`)
    assert.equal(typeof entry.scope, 'string')
    assert.equal(entry.code, String(entry.code))
    assert.ok(Array.isArray(entry.abilities), `${entry.code} 数据型条目 abilities 为空数组`)
  }
  assert.equal(chapter.manifest.zones.setAside.length > 0, true)
  assert.deepEqual([...ACT_CODES], ['10607a', '10608'])
  assert.deepEqual([...AGENDA_CODES], ['10606'])
  assert.equal(SPECIAL_AGENDA_CODE, '10609')
  assert.equal(ACT_STAGES[1].objective.perInvestigator, 3)
  assert.equal(ACT_STAGES[1].objective.lairOnly, true)
  assert.equal(AGENDA_STAGES[1].doomThreshold, 3)
  assert.equal(SCENARIO_TEXT.specialRules.length, 3)
  assert.ok(SCENARIO_TEXT.specialRules.some(rule => /Darkness Level/i.test(rule.title)))
  assert.ok(SCENARIO_TEXT.specialRules.some(rule => /Pursuit|Adjacency/i.test(rule.title)))
  assert.ok(SCENARIO_TEXT.intro.length > 0)
  assert.equal(Object.keys(chapter.scenario.resolutions).length, 5)
  assert.equal(chapter.scenario.textLanguage, 'en')
})

test('P7 theTwistedHollow 单卡条目：scope/flags 与 implementedEntryFlags 一致，诡计经 events 分派', () => {
  assert.equal(entry10606.scope, 'agenda')
  assert.equal(entry10607a.scope, 'act')
  assert.equal(entry10607b.scope, 'enemy')
  assert.equal(entry10609.scope, 'agenda')
  assert.equal(entry10625.scope, 'enemy')
  for (const code of LANTERN_CODES) {
    assert.equal(registeredEntry(code).scope, 'storyAsset')
    assert.equal(registeredEntry(code).flags.lantern, true)
  }
  for (const code of ['10612', '10613', '10614', '10615', '10616', '10617', '10618', '10619', '10620', '10621']) {
    assert.equal(registeredEntry(code).scope, 'location')
    assert.equal(registeredEntry(code).flags.westernWoods, true)
    assert.equal(chapter.implementedEntryFlags(code).westernWoods, true)
  }
  assert.equal(chapter.implementedEntryFlags('10607b').ursineHybrid, true)
  assert.equal(chapter.implementedEntryFlags('10625').healthX, 'darkness')
  assert.deepEqual(registeredEntry('10622').flags.test, { skill: 'willpower', difficulty: 3, darkDifficulty: 5 })
  assert.equal(typeof registeredEntry('10624').encounterResolve, 'function')
  assert.deepEqual(registeredEntry('10613').flags.onReveal, 'lowestFightPursuitHere')
  assert.equal(registeredEntry('10621').flags.printedShroud, 4)
  assert.equal(registeredEntry('10618').flags.printedShroud, 'X')
  assert.equal(registeredEntry('10618').flags.cluesPerInvestigator, false)
  // 卡表把「X 生命值」记成 -2、伤害/恐惧记成 0；印刷是 1/1，X 由 behavior 补。
  assert.equal(chapter.scenario.enemies['10625'].health, 0)
  assert.equal(chapter.scenario.enemies['10625'].damage, 1)
  assert.equal(chapter.scenario.enemies['10625'].horror, 1)
  assert.equal(chapter.scenario.enemies[URSINE_HYBRID_CODE].health, 5)
  assert.equal(chapter.scenario.enemies[URSINE_HYBRID_CODE].victory, 2)
})

// ---------------------------------------------------------------------------
// 2. 遭遇牌库 / 放一边 / 树林牌库
// ---------------------------------------------------------------------------

test('P7 theTwistedHollow 遭遇牌库：28 张、类熊混种与提灯不在牌库', () => {
  assert.equal(ENCOUNTER_DECK.length, 28)
  assert.equal(ENCOUNTER_DECK.filter(code => code === '10625').length, 4, '猎踪混种 ×4')
  assert.equal(ENCOUNTER_DECK.filter(code => code === '10622').length, 2, '暗影深深 ×2')
  assert.equal(ENCOUNTER_DECK.filter(code => code === '10623').length, 2, '惊惧潜伏 ×2')
  assert.equal(ENCOUNTER_DECK.filter(code => code === '10624').length, 1, '光明遭窃 ×1')
  assert.equal(ENCOUNTER_DECK.filter(code => code === '10676').length, 3, '先遣之日的虫群 ×3')
  for (const code of [URSINE_HYBRID_CODE, ...LANTERN_CODES, ...LOCATION_IDS.map(id => LOCATIONS[id].code)]) {
    assert.equal(ENCOUNTER_DECK.includes(code), false, `不进遭遇牌库：${code}`)
  }
  const setAside = chapter.manifest.zones.setAside
  assert.equal(setAside.find(entry => entry.cardCode === URSINE_HYBRID_CODE)?.count, 1)
  assert.equal(setAside.find(entry => entry.cardCode === SPECIAL_AGENDA_CODE)?.count, 1)
  assert.equal(setAside.find(entry => entry.cardCode === RESIDENTS.bertieMusgrave)?.count, 1)
  assert.equal(setAside.find(entry => entry.cardCode === '10621')?.count, 1, '扭曲空洞放一边')
  assert.equal(SET_ASIDE_CARDS.includes(URSINE_HYBRID_CODE), true)
  assert.equal(STORY_CODES.length, 4)
})

test('P7 theTwistedHollow 树林牌库：母亲瑞秋指路分支（1–2 人：移出 2、牌库 7）', () => {
  const { state, report } = setup(1)
  assert.equal(report.start, 'glimmeringWoods')
  assert.equal(state.locations.length, 5, '起始地点 + 四方向各 1')
  assert.equal(chapter.behavior.woodsDeckSize(state), 7)
  assert.equal(state.scenarioFlags.twistedHollowPlan.removed.length, 2)
  assert.deepEqual(report.placedIds.length, 5)
  // 网格：起始 (0,0)，四方向各一格。
  const grid = chapter.behavior.gridState(state)
  assert.deepEqual(grid.glimmeringWoods, { x: 0, y: 0 })
  assert.equal(Object.keys(grid).length, 5)
  assert.equal(Object.values(grid).filter(point => point.x === 0 && point.y === 0).length, 1)
  // 15 张西部树林的去向：在场 5 + 牌库 7 + 移出 2 + 放一边 1。
  assert.equal(5 + 7 + 2 + 1, 15)
  // 荧光草地在场且已揭示；四周都是未揭示的西部树林。
  const glimmering = state.locations.find(location => location.id === 'glimmeringWoods')
  assert.equal(glimmering.revealed, true)
  assert.equal(glimmering.clues, 0, '荧光草地固定 0 线索')
  const neighbours = state.locations.filter(location => location.id !== 'glimmeringWoods')
  assert.equal(neighbours.every(location => location.revealed === false), true)
  assert.equal(neighbours.every(location => location.clues === 0), true, '未揭示地点不放线索')
  assert.deepEqual([...state.locations.find(location => location.id === 'glimmeringWoods').connections].sort(),
    neighbours.map(location => location.id).sort())
})

test('P7 theTwistedHollow 树林牌库：迷失方向分支（随机西部树林开场、荧光草地进牌库）', () => {
  const { state, report } = setup(2, { theInvestigatorsLostThePath: true })
  assert.notEqual(report.start, 'glimmeringWoods')
  assert.equal(WESTERN_WOODS_IDS.includes(report.start), true)
  assert.equal(state.locations.some(location => location.id === 'glimmeringWoods'), false)
  assert.equal(state.locations[0].revealed, true, '起始地点已揭示')
  assert.equal(state.investigators.every(inv => inv.location === report.start), true)
  assert.equal(chapter.behavior.woodsDeckSize(state), 7)
  const plan = state.scenarioFlags.twistedHollowPlan
  assert.equal(plan.pool.includes('glimmeringWoods'), true)
  assert.equal(plan.removed.includes(report.start), false)
})

test('P7 theTwistedHollow 树林牌库：3–4 人局只移出 1 张、牌库 8', () => {
  const { state } = setup(3)
  assert.equal(state.scenarioFlags.twistedHollowPlan.removed.length, 1)
  assert.equal(chapter.behavior.woodsDeckSize(state), 8)
})

test('P7 theTwistedHollow 引言：说实话/说谎写战役记录与混乱标记，并切换布置分支', () => {
  {
    const state = stateWithScenario(1)
    state.campaign.chaosBag = ['+1', '0']
    const api = makeApi(state, { defaultChoice: 'tellTheTruth' })
    chapter.behavior.preScenarioSetup(state, [], api)
    assert.equal(state.campaign.records.motherRachelShowedTheWay, true)
    assert.deepEqual(state.chaosBag, [], '引言标记等混乱袋建好后才入袋')
    assert.equal(chapter.behavior.afterChaosBagSetup(state, [], api), true)
    assert.deepEqual(state.chaosBag, ['cultist'])
    assert.deepEqual(state.campaign.chaosBag, ['+1', '0', 'cultist'], 'remainder of the campaign')
    assert.equal(chapter.behavior.afterChaosBagSetup(state, [], api), false, '只入袋一次')
    const report = chapter.behavior.setupScenario(state, api)
    assert.equal(report.start, 'glimmeringWoods')
  }
  {
    const state = stateWithScenario(1)
    const api = makeApi(state, { defaultChoice: 'lie' })
    chapter.behavior.preScenarioSetup(state, [], api)
    assert.equal(state.campaign.records.theInvestigatorsLostThePath, true)
    chapter.behavior.afterChaosBagSetup(state, [], api)
    assert.deepEqual(state.chaosBag, ['elderthing'])
    const report = chapter.behavior.setupScenario(state, api)
    assert.notEqual(report.start, 'glimmeringWoods', '说谎 → 随机西部树林开场')
  }
  {
    // 已有战役记录：不再询问、不重复加标记
    const state = stateWithScenario(1, { motherRachelShowedTheWay: true })
    const api = makeApi(state, { defaultChoice: 'lie' })
    chapter.behavior.preScenarioSetup(state, [], api)
    chapter.behavior.afterChaosBagSetup(state, [], api)
    assert.equal(state.chaosBag.length, 0)
    assert.equal(state.campaign.records.theInvestigatorsLostThePath, undefined)
    assert.equal(chapter.behavior.introBranch(state), 'showedTheWay')
  }
})

// ---------------------------------------------------------------------------
// 3. 地点连接 / 网格
// ---------------------------------------------------------------------------

test('P7 theTwistedHollow 地点连接：网格相邻即相连、双向对称、无对角线', () => {
  for (const id of LOCATION_IDS) assert.deepEqual([...LOCATION_CONNECTIONS[id]], [], `${id} 没有印刷连线`)
  const { state } = setup(1)
  const grid = chapter.behavior.gridState(state)
  for (const [id, point] of Object.entries(grid)) {
    const location = state.locations.find(item => item.id === id)
    const expected = Object.values(DIRECTION_VECTORS)
      .filter(vector => Object.values(grid).some(other => other.x === point.x + vector.x && other.y === point.y + vector.y))
      .length
    assert.equal(location.connections.length, expected, `${id} 的连接数 = 相邻格数`)
    for (const next of location.connections) {
      const other = state.locations.find(item => item.id === next)
      assert.equal(other.connections.includes(id), true, `${id} ↔ ${next} 对称`)
      assert.equal(areAdjacent(grid[id], grid[next]), true, `${id} ↔ ${next} 共享一条边`)
    }
  }
  assert.equal(chapter.layout.dynamic, true)
  assert.deepEqual(chapter.layout.locations, {})
  assert.deepEqual(chapter.layout.edges, [])
  assert.deepEqual(OPENING_SLOTS.start, { x: 0, y: 0 })
  assert.deepEqual(OPENING_SLOTS.north, { x: 0, y: -1 })
  assert.equal(ACT2_GRID_OFFSETS.length, 13)
})

test('P7 theTwistedHollow 网格扩张：议程 1 正面「地点揭示后」在四方向铺树林牌库顶', () => {
  const { state, api } = setup(1)
  const before = chapter.behavior.woodsDeckSize(state)
  // 把一名调查员放到相邻的西部树林并揭示它。
  const target = state.locations.find(location => location.id !== 'glimmeringWoods')
  state.investigators[0].location = target.id
  target.revealed = true
  chapter.behavior.locationRevealed(state, target, api, 0)
  const placed = state.locations.length - 5
  assert.equal(placed, 3, '四个方向中三个空槽（起始格已被占据）')
  assert.equal(chapter.behavior.woodsDeckSize(state), before - placed)
  const grid = chapter.behavior.gridState(state)
  for (const next of target.connections) {
    assert.equal(areAdjacent(grid[target.id], grid[next]), true)
  }
})

// ---------------------------------------------------------------------------
// 4. 黑暗等级 / 混乱标记
// ---------------------------------------------------------------------------

test('P7 theTwistedHollow 黑暗等级：初始 1、议程背面 +1、6 时上限且全员被击败', () => {
  const { state, api } = setup(2)
  assert.equal(darknessLevel(state), INITIAL_DARKNESS)
  assert.equal(state.scenarioFlags.twistedHollowDarkness, 1)
  assert.equal(raiseDarkness(state, 1), 2)
  assert.equal(darknessLevel(state), 2)
  setDarknessLevel(state, 6)
  assert.equal(darknessLevel(state), 6)
  assert.equal(raiseDarkness(state, 3), 6, '黑暗等级上限 6')
  // 议程 1 背面：6+ 时每位幸存调查员被击败 + 1 点肉体创伤。
  const before = darknessLevel(state)
  chapter.behavior.agendaReveal(state, state.agendas[0], api)
  assert.equal(darknessLevel(state), 6, '已经 6，不会超过上限')
  assert.equal(before, 6)
  assert.equal(state.investigators.every(inv => inv.defeated === true), true)
  assert.deepEqual(api.trauma.map(row => row.kind), ['physical', 'physical'])
})

test('P7 theTwistedHollow 混乱标记：骷髅 = -黑暗等级 / 困难面两倍，其余标记按印刷', () => {
  const state = stateWithScenario(1)
  setDarknessLevel(state, 3)
  assert.deepEqual(twistedHollowChaosToken(state, null, 'skull'), { delta: -3, onDraw: [], onFail: [] })
  assert.equal(twistedHollowChaosTokenValue(state, 'skull'), -3)
  const hard = { ...state, difficulty: 'hard' }
  assert.equal(isHardSide(hard), true)
  assert.equal(twistedHollowChaosToken(hard, null, 'skull').delta, -6)
  // 简单/普通
  assert.equal(twistedHollowChaosToken(state, null, 'cultist').delta, -1)
  assert.deepEqual(twistedHollowChaosToken(state, null, 'cultist').onDraw, [{ type: 'scenarioToken', token: 'cultist', mode: 'heal' }])
  assert.equal(twistedHollowChaosToken(state, null, 'tablet').delta, -3)
  assert.deepEqual(twistedHollowChaosToken(state, null, 'tablet').onFail, [{ type: 'scenarioToken', token: 'tablet', mode: 'fail' }])
  assert.equal(twistedHollowChaosToken(state, null, 'elderthing').delta, -4)
  assert.equal(twistedHollowChaosToken(state, null, 'elderthing').onFail.length, 1)
  // 困难/专家
  assert.equal(twistedHollowChaosToken(hard, null, 'cultist').delta, -3)
  assert.deepEqual(twistedHollowChaosToken(hard, null, 'cultist').onDraw, [], '困难面成功才治愈（afterTest 结算）')
  assert.deepEqual(twistedHollowChaosToken(hard, null, 'tablet').onDraw, [{ type: 'scenarioToken', token: 'tablet', mode: 'always' }])
  assert.equal(twistedHollowChaosToken(hard, null, 'elderthing').delta, -5)
  assert.deepEqual(twistedHollowChaosToken(hard, null, 'elderthing').onDraw, [{ type: 'scenarioToken', token: 'elderthing', mode: 'always' }])
  assert.equal(twistedHollowChaosToken(state, null, 'elder_sign'), null)
  // 印刷文本与卡表同源（防止两处漂移）
  assert.ok(TWISTED_HOLLOW_TOKEN_MEANINGS.standard.skull.text.includes('黑暗等级'))
  assert.ok(TWISTED_HOLLOW_TOKEN_MEANINGS.hard.skull.text.includes('两倍'))
})

test('P7 theTwistedHollow 混乱标记结算：[cultist] 治愈、[tablet] 生成追击敌人、[elder_thing] 恐惧', () => {
  const { state, api } = setup(1)
  const inv = state.investigators[0]
  inv.damage = 2
  assert.equal(chapter.behavior.applyTokenEffect(state, inv, { token: 'cultist', mode: 'heal' }, api), true)
  assert.equal(inv.damage, 1)
  const enemy = placeEnemy(state, '10625', { location: 'glimmeringWoods', evade: 3 })
  api.enemyZones.enter(enemy, 'pursuit')
  assert.equal(chapter.behavior.pursuitEnemies(state, api).length, 1)
  assert.equal(chapter.behavior.applyTokenEffect(state, inv, { token: 'tablet', mode: 'always' }, api), true)
  assert.equal(state.enemies.some(item => item.id === enemy.id), true, '[tablet] 把追击敌人拉回场上')
  assert.equal(enemy.location, inv.location)
  assert.equal(chapter.behavior.pursuitEnemies(state, api).some(item => item.id === enemy.id), false,
    '来自追击区域的生成不会被幕 1 正面再送回追击（防循环）')
  chapter.behavior.applyTokenEffect(state, inv, { token: 'elderthing', mode: 'always' }, api)
  assert.equal(inv.horror, 1)
  // 困难面 [cultist] 成功治愈走 afterTest
  state.difficulty = 'hard'
  inv.damage = 2
  assert.equal(chapter.behavior.afterTest(state, inv, { success: true, drawn: ['cultist'] }, api, { resolvedTokens: ['cultist'] }), true)
  assert.equal(inv.damage, 1)
  assert.equal(chapter.behavior.afterTest(state, inv, { success: false, drawn: ['cultist'] }, api, { resolvedTokens: ['cultist'] }), false)
})

// ---------------------------------------------------------------------------
// 5. 地点强制的具体读点（毒沼等）
// ---------------------------------------------------------------------------

test('P7 theTwistedHollow 毒沼：揭示时二选一（直接伤害 / 每个盟友支援各 1 点伤害）', () => {
  const marshAt = id => ({
    id, code: '10614', originalCode: '10614', traits: ['Forest', 'Blight', 'Dark'],
    revealed: true, shroud: 3, connections: [],
  })
  {
    const { state, api } = setup(1)
    const inv = state.investigators[0]
    api.choices = ['damage']
    chapter.behavior.resolveLocationReveal(state, marshAt('poisonedMarshX'), api, 0)
    assert.equal(inv.damage, 1)
    assert.equal(api.lastRequest.options.some(option => option.id === 'assets'), false, '没有盟友时只提供受伤')
  }
  {
    const { state, api } = setup(1)
    const inv = state.investigators[0]
    inv.assets = [{ id: 'ally1', code: '10699', traits: ['Ally'], damage: 0 }, { id: 'item1', code: '01059', traits: ['Item'], damage: 0 }]
    api.choices = ['assets']
    chapter.behavior.resolveLocationReveal(state, marshAt('poisonedMarshY'), api, 0)
    assert.equal(inv.damage, 0)
    assert.equal(inv.assets[0].damage, 1, '盟友支援各受 1 点伤害')
    assert.equal(inv.assets[1].damage, 0, '非盟友不受影响')
  }
})

test('P7 theTwistedHollow 地点揭示：尸林恐惧、熊穴抽遭遇、枯疫空地生成最低攻击追击敌人', () => {
  // 尸林：无条件 1 点恐惧
  {
    const { state, api } = setup(1)
    const corpse = { id: 'corpseGrove', code: '10619', originalCode: '10619', traits: ['Forest', 'Lair', 'Dark'], revealed: true, connections: [] }
    state.locations.push(corpse)
    chapter.behavior.resolveLocationReveal(state, corpse, api, 0)
    assert.equal(state.investigators[0].horror, 1)
  }
  // 熊穴：没有追击敌人时抽遭遇牌
  {
    const { state, api } = setup(1)
    const den = { id: 'bearDenX', code: '10620', originalCode: '10620', traits: ['Forest', 'Lair', 'Dark'], revealed: true, connections: [] }
    state.locations.push(den)
    chapter.behavior.resolveLocationReveal(state, den, api, 0)
    assert.deepEqual(api.drawn, [0])
  }
  // 枯疫空地：追击区里攻击最低的敌人被生成在本地点
  {
    const { state, api } = setup(1)
    const low = placeEnemy(state, '10625', { location: 'glimmeringWoods', fight: 1 })
    const high = placeEnemy(state, '10625', { location: 'glimmeringWoods', fight: 4 })
    api.enemyZones.enter(low, 'pursuit')
    api.enemyZones.enter(high, 'pursuit')
    const glade = { id: 'blightedGladeX', code: '10613', originalCode: '10613', traits: ['Forest', 'Blight', 'Dark'], revealed: true, connections: [] }
    state.locations.push(glade)
    chapter.behavior.resolveLocationReveal(state, glade, api, 0)
    assert.equal(low.location, glade.id)
    assert.equal(high.location, null, '攻击值最高的仍留在追击区域')
  }
})

test('P7 theTwistedHollow 地点帷幕：扭曲小路 = 黑暗等级、茂盛灌丛 -X、蘑菇园非黑暗 +2', () => {
  const { state, api } = setup(1)
  setDarknessLevel(state, 2)
  const crooked = { id: 'crookedPath', code: '10618', originalCode: '10618', shroud: 0, traits: ['Forest', 'Dark'], connections: [] }
  const fecund = { id: 'fecundThicket', code: '10615', originalCode: '10615', shroud: 6, traits: ['Forest', 'Dark'], connections: [] }
  assert.equal(chapter.behavior.locationShroudModifier(state, crooked), 2)
  assert.equal(chapter.behavior.locationShroudModifier(state, fecund), -2)
  // 提灯点燃：其所在地点与连接地点失去[[黑暗]]特性 → 蘑菇园 +2 帷幕。
  const glimmering = state.locations.find(location => location.id === 'glimmeringWoods')
  const mushroom = { ...glimmering, id: 'mushroomGroveX', code: '10616', originalCode: '10616', shroud: 2, traits: ['Forest', 'Dark'] }
  assert.equal(chapter.behavior.isDarkLocation(state, glimmering), false, '提灯所在地点失去黑暗特性')
  chapter.behavior.flipLantern(state, api, { lit: true, location: 'mushroomGroveX' })
  assert.equal(chapter.behavior.isDarkLocation(state, mushroom), false, '提灯移到的地点失去黑暗特性')
  assert.equal(chapter.behavior.locationShroudModifier(state, mushroom), 2)
  // 熄灭后该地点重新获得[[黑暗]]特性。
  chapter.behavior.flipLantern(state, api, { lit: false })
  assert.equal(chapter.behavior.isDarkLocation(state, mushroom), true)
  assert.equal(chapter.behavior.locationShroudModifier(state, mushroom), 0)
  assert.equal(chapter.behavior.isDarkLocation(state, crooked), true)
  setDarknessLevel(state, 3)
  assert.equal(chapter.behavior.locationShroudModifier(state, crooked), 3)
})

// ---------------------------------------------------------------------------
// 6. 幕 / 议程推进
// ---------------------------------------------------------------------------

test('P7 theTwistedHollow 幕 1 目标：轮末、全员同一巢穴、共同支付 3/人线索', () => {
  const { state, api } = setup(2)
  const lair = state.locations.find(location => location.id !== 'glimmeringWoods')
  lair.revealed = true
  for (const inv of state.investigators) { inv.location = lair.id; inv.clues = 3 }
  assert.equal(chapter.behavior.checkActOneObjective(state, api), false, '不在轮末窗口')
  state._roundEndWindow = true
  assert.equal(chapter.behavior.checkActOneObjective(state, api), true)
  assert.equal(api.advanced, 1)
  assert.equal(state.investigators.reduce((sum, inv) => sum + inv.clues, 0), 0, '共同支付 6 个线索')
  // 线索不足：不推进
  const second = setup(2)
  second.state._roundEndWindow = true
  for (const inv of second.state.investigators) { inv.location = lair.id; inv.clues = 1 }
  assert.equal(chapter.behavior.checkActOneObjective(second.state, second.api), false)
  assert.equal(second.api.advanced, 0)
})

test('P7 theTwistedHollow 幕 1 背面：Codex Σ（无居民→母亲瑞秋干预；有朱迪丝→入场并 2 点伤害）', () => {
  // 没有居民放一边 → The Bear 2：肉体创伤 + 直接伤害 + 记录
  {
    const { state, api } = setup(1)
    state.scenarioZones.setAside = state.scenarioZones.setAside.filter(code => ![RESIDENTS.judithPark, RESIDENTS.theoPeters].includes(code))
    const before = state.investigators[0].damage
    assert.equal(chapter.behavior.actReveal(state, state.acts[0], api), true)
    assert.equal(api.trauma.length, 1)
    assert.equal(api.trauma[0].kind, 'physical')
    assert.equal(state.investigators[0].damage, before + 1)
    assert.equal(state.campaign.records.motherRachelIntervened, true)
    assert.equal(state.enemies.some(enemy => enemy.code === URSINE_HYBRID_CODE), true, '类熊混种横置生成并受 1 点伤害')
    const bear = state.enemies.find(enemy => enemy.code === URSINE_HYBRID_CODE)
    assert.equal(bear.exhausted, true)
    assert.equal(bear.damageTaken, 1)
    // The Bear 3：空的[[黑暗]]地点收回树林牌库、扭曲空洞洗入牌库底 4 张，再在调查员四周铺开。
    assert.equal(state.scenarioZones.setAside.includes('theTwistedHollow'), false)
    assert.equal(chapter.behavior.woodsDeckSize(state) > 0, true)
  }
  // 朱迪丝放一边 → 入场并结算 Codex 7
  {
    const { state, api } = setup(1)
    assert.equal(state.scenarioZones.setAside.includes(RESIDENTS.judithPark), true)
    chapter.behavior.actReveal(state, state.acts[0], api)
    const judith = state.storyAssets.find(asset => asset.code === RESIDENTS.judithPark)
    assert.ok(judith, '朱迪丝入场')
    assert.equal(judith.controllerSeat, 0)
    assert.equal(judith.damage, 2)
    assert.equal(state.campaign.records.judithSavedYourAss, true)
    assert.equal(state.scenarioZones.setAside.includes(RESIDENTS.judithPark), false)
  }
})

test('P7 theTwistedHollow 幕 2：正面[fast]查看相邻地点；背面才出虎口（伯蒂/追击/重铺/特殊议程）', () => {
  const { state, api } = setup(2)
  state.acts = [structuredClone(ACT_STAGES[2])]
  state.actIndex = 0
  state.investigators[0].clues = 1
  const moves = chapter.behavior.actions(state, state.investigators[0])
  const look = moves.find(move => move.rule === 'twistedHollowLookAdjacent')
  assert.ok(look, '幕 2 正面提供快速查看行动')
  assert.equal(look.actions, 0)
  // 支付 1 线索并查看相邻地点（不移动）
  const neighbour = state.locations.find(location => location.id !== 'glimmeringWoods')
  api.choices = [neighbour.id]
  const beforeLocation = state.investigators[0].location
  assert.equal(chapter.behavior.performAction(state, state.investigators[0], look, api), true)
  assert.equal(state.investigators[0].clues, 0)
  assert.equal(state.investigators[0].location, beforeLocation, '[fast] 查看不移动')
  // 幕 2 背面
  const bear = placeEnemy(state, URSINE_HYBRID_CODE, { location: 'glimmeringWoods', damageTaken: 3 })
  state.doom = 2
  assert.equal(chapter.behavior.actReveal(state, state.acts[0], api), true)
  assert.equal(state.storyAssets.some(asset => asset.code === RESIDENTS.bertieMusgrave), true, '伯蒂入场')
  assert.equal(state.acts.length, 1)
  assert.equal(state.acts[0].originalCode ?? state.acts[0].code, SPECIAL_AGENDA_CODE, '当前幕 = 回到山谷！')
  assert.equal(state.agendas.length, 1)
  assert.equal(state.agendas[0].code ?? state.agendas[0].originalCode, SPECIAL_AGENDA_CODE, '当前议程 = 回到山谷！')
  assert.equal(state.doom, 2, '毁灭标记转移到特殊议程')
  assert.equal(state.scenarioFlags.twistedHollowBackToTheVale, true)
  const hollow = state.locations.find(location => location.id === 'theTwistedHollow')
  assert.ok(hollow, '扭曲空洞入场')
  assert.equal(hollow.revealed, true)
  assert.equal(state.enemies.some(enemy => enemy.code === URSINE_HYBRID_CODE), true)
  assert.equal(state.enemies.find(enemy => enemy.code === URSINE_HYBRID_CODE).location, 'theTwistedHollow')
  assert.equal(state.locations.length, 13, '扭曲空洞 + 12 张西部树林按示意图铺开')
  assert.equal(chapter.behavior.woodsDeckSize(state), 0, '树林牌库全部铺开')
  void bear
})

test('P7 theTwistedHollow 特殊议程：全员撤退 → 结局 1；背面 6+ → 结局 2；否则追击敌人再入场', () => {
  {
    const { state, api } = setup(2)
    chapter.behavior.outOfTheFryingPan(state, api)
    for (const inv of state.investigators) inv.resigned = true
    const claim = { id: 'cs', code: '10625', originalCode: '10625', location: 'glimmeringWoods', fight: 3, evade: 3, traits: [] }
    state.enemies.push(claim)
    api.enemyZones.enter(claim, 'pursuit')
    assert.equal(chapter.behavior.checkBackToTheValeObjective(state, api), true)
    assert.equal(api.finished, 'resolution1')
  }
  {
    const { state, api } = setup(1)
    chapter.behavior.outOfTheFryingPan(state, api)
    state.scenarioFlags.twistedHollowDarkness = 5
    chapter.behavior.backToTheValeBack(state, api)
    assert.equal(darknessLevel(state), 6)
    assert.equal(api.finished, 'resolution2')
    assert.equal(state.investigators.every(inv => inv.defeated), true)
  }
  {
    const { state, api } = setup(1)
    chapter.behavior.outOfTheFryingPan(state, api)
    setDarknessLevel(state, 2)
    const enemy = placeEnemy(state, '10625', { location: 'glimmeringWoods' })
    api.enemyZones.enter(enemy, 'pursuit')
    const reverts = api.reverted
    chapter.behavior.backToTheValeBack(state, api)
    assert.equal(state.enemies.some(item => item.id === enemy.id), true, '追击敌人在最近的黑暗地点再入场')
    assert.equal(api.reverted, reverts + 1, '翻回正面')
    assert.equal(api.finished, null)
  }
})

test('P7 theTwistedHollow 议程 1 背面：黑暗 +1、已揭示无人黑暗地点翻面、翻回议程 1a', () => {
  const { state, api } = setup(1)
  const dark = state.locations.find(location => location.id !== 'glimmeringWoods')
  dark.revealed = true
  dark.clues = 2
  // 把提灯移开，让该地点恢复[[黑暗]]特性。
  chapter.behavior.flipLantern(state, api, { lit: false, location: 'glimmeringWoods' })
  assert.equal(chapter.behavior.isDarkLocation(state, dark), true)
  assert.equal(chapter.behavior.agendaReveal(state, state.agendas[0], api), true)
  assert.equal(darknessLevel(state), 2)
  assert.equal(api.reverted, 1, '翻回议程 1a')
  assert.equal(dark.revealed, false)
  assert.equal(dark.clues, 0, '弃掉其上所有标记')
})

// ---------------------------------------------------------------------------
// 7. 敌人
// ---------------------------------------------------------------------------

test('P7 theTwistedHollow 类熊混种：幕 2 期间被击败 → 治愈并进入追击区域（不进胜利区）', () => {
  const { state, api } = setup(2)
  state.acts = [structuredClone(ACT_STAGES[2])]
  state.actIndex = 0
  const bear = placeEnemy(state, URSINE_HYBRID_CODE, { location: 'glimmeringWoods', damageTaken: 4 })
  assert.equal(chapter.behavior.enemyStatModifier(state, bear, 'health'), 4, '+2[per_investigator]（2 人局）')
  assert.equal(chapter.behavior.enemyDefeated(state, bear, api), true, '返回 replaced')
  assert.equal(bear.damageTaken, 0, '治愈全部伤害')
  assert.equal(state.enemies.some(enemy => enemy.id === bear.id), false, '离开场上（进入追击）')
  assert.equal(chapter.behavior.pursuitEnemies(state, api).some(enemy => enemy.id === bear.id), true)
  // 不在幕 2：正常击败
  const second = setup(2)
  const secondBear = placeEnemy(second.state, URSINE_HYBRID_CODE, { location: 'glimmeringWoods', damageTaken: 1 })
  assert.equal(chapter.behavior.enemyDefeated(second.state, secondBear, second.api), false)
  assert.equal(second.state.enemies.some(enemy => enemy.id === secondBear.id), true)
})

test('P7 theTwistedHollow 猎踪混种：生命值 = 黑暗等级、攻击后提灯翻面并落在你的地点', () => {
  const { state, api } = setup(1)
  setDarknessLevel(state, 4)
  const hybrid = placeEnemy(state, '10625', { location: 'glimmeringWoods' })
  assert.equal(chapter.behavior.enemyStatModifier(state, hybrid, 'health'), 4)
  assert.equal(chapter.behavior.enemyStatModifier(state, hybrid, 'fight'), 0)
  assert.equal(chapter.behavior.preyRank(state, hybrid, state.investigators[0]), 100, '提灯持有者是猎物')
  assert.equal(chapter.behavior.preyRank(state, hybrid, state.investigators[1] || { seat: 1 }), 0)
  state.investigators[0].location = 'bearDen'
  const before = chapter.behavior.lanternRecord(state)
  assert.equal(before.lit, true)
  assert.equal(chapter.behavior.enemyAttackResolved(state, hybrid, state.investigators[0], api), true)
  assert.equal(chapter.behavior.lanternRecord(state).lit, false)
  assert.equal(chapter.behavior.lanternRecord(state).location, 'bearDen')
  assert.equal(chapter.behavior.lanternRecord(state).code, LANTERN_SPEC.boon.unlit)
})

test('P7 theTwistedHollow 幕 1 正面：没有生成指示的敌人从遭遇牌库抽出时进入追击区域', () => {
  const { state, api } = setup(1)
  const stalker = placeEnemy(state, '10625', { location: 'glimmeringWoods' })
  chapter.behavior.enemySpawned(state, stalker, api)
  assert.equal(state.enemies.some(enemy => enemy.id === stalker.id), false)
  assert.equal(chapter.behavior.pursuitEnemies(state, api).some(enemy => enemy.id === stalker.id), true)
  // 有生成指示的类熊混种不受影响
  const bear = placeEnemy(state, URSINE_HYBRID_CODE, { location: 'glimmeringWoods' })
  chapter.behavior.enemySpawned(state, bear, api)
  assert.equal(state.enemies.some(enemy => enemy.id === bear.id), true)
})

// ---------------------------------------------------------------------------
// 8. 诡计
// ---------------------------------------------------------------------------

test('P7 theTwistedHollow 诡计：暗影深深/惊惧潜伏的黑暗难度与二选一失败分支', () => {
  const { state, api } = setup(1)
  const inv = state.investigators[0]
  // 熄灭提灯：地点恢复[[黑暗]]特性，遭遇检定难度 +2。
  chapter.behavior.flipLantern(state, api, { lit: false, location: 'glimmeringWoods' })
  inv.location = 'bearDen'
  inv.horror = 0
  api.choices = ['horror']
  assert.equal(chapter.behavior.resolveTreacheryEvent(state, { code: '10622', seat: 0 }, api), true)
  assert.equal(api.tests[0].skill, 'willpower')
  assert.equal(api.tests[0].difficulty, 5, '黑暗地点难度 +2')
  assert.equal(inv.horror, 2)
  // 惊惧潜伏：另一支失败分支（2 点伤害）
  api.choices = ['damage']
  chapter.behavior.resolveTreacheryEvent(state, { code: '10623', seat: 0 }, api)
  assert.equal(api.tests[1].skill, 'agility')
  assert.equal(api.tests[1].difficulty, 5)
  assert.equal(inv.damage, 2)
})

test('P7 theTwistedHollow 光明遭窃：放毁灭或把提灯放到最远空地点（险境）', () => {
  {
    const { state, api } = setup(1)
    api.choices = ['doom']
    state.doom = 1
    assert.equal(chapter.behavior.resolveTreacheryEvent(state, { code: '10624', seat: 0 }, api), true)
    assert.equal(state.doom, 2)
  }
  {
    const { state, api } = setup(1)
    api.choices = ['lantern']
    assert.equal(chapter.behavior.resolveTreacheryEvent(state, { code: '10624', seat: 0 }, api), true)
    const lantern = chapter.behavior.lanternRecord(state)
    assert.equal(lantern.lit, false)
    assert.notEqual(lantern.location, state.investigators[0].location, '放到离所有调查员最远的空地点')
  }
})

// ---------------------------------------------------------------------------
// 9. 结局 / 战役记录
// ---------------------------------------------------------------------------

test('P7 theTwistedHollow 结局：1/2/3/无结局/单人模式的记录与经验', () => {
  {
    const { state, api } = setup(2)
    chapter.behavior.outOfTheFryingPan(state, api)
    state.victoryDisplay = [{ id: 'bear', code: URSINE_HYBRID_CODE, originalCode: URSINE_HYBRID_CODE, victory: 2 }]
    const result = chapter.behavior.resolution(state, 'resolution1', [], api)
    assert.equal(state.campaign.records.theTwistedHollowResolution, 'resolution1')
    assert.equal(state.campaign.records.bertieWasRescued, true)
    assert.equal(state.campaign.records.theTwistedHollowTimes, 1)
    assert.equal(state.campaign.records.areasSurveyedWesternWoods, true)
    assert.equal(state.campaign.records.theBearWasWounded, true)
    assert.equal(result.award, true)
    assert.equal(result.bonus, 4, '洞悉 1 + 与伯蒂一起撤退 1 + 胜利区 2')
  }
  {
    const { state, api } = setup(2)
    const result = chapter.behavior.resolution(state, 'resolution2', [], api)
    assert.equal(state.campaign.records.bertieWasLostInTheWoods, true)
    assert.equal(result.bonus, 1, '只有洞悉经验（伯蒂不在调查员控制下）')
  }
  {
    const { state, api } = setup(2)
    state.storyAssets.push({ id: 'bertie', code: RESIDENTS.bertieMusgrave, originalCode: RESIDENTS.bertieMusgrave, controllerSeat: 0 })
    const result = chapter.behavior.resolution(state, 'noResolution', [], api)
    assert.equal(state.campaign.records.bertieWasLostInTheWoods, true)
    assert.equal(result.bonus, 2, '无结局仍结算洞悉 + 与伯蒂一起撤退的经验')
    assert.equal(state.campaign.records.theTwistedHollowResolution, 'noResolution')
  }
  {
    const { state, api } = setup(1)
    setDarknessLevel(state, 4)
    const result = chapter.behavior.resolution(state, 'standalone', [], api)
    assert.equal(result.award, false, '单人模式没有胜利奖励')
    assert.equal(state.campaign.records.theTwistedHollowResolution, 'standalone')
    const summary = chapter.behavior.scenarioResolution(state, 'standalone', api)
    assert.equal(summary.resolution, 'standalone')
    assert.equal(summary.darkness, 4)
    assert.equal(summary.bertieLost, false)
  }
})

test('P7 theTwistedHollow 全员撤退：特殊议程在场 → 结局 1；否则无结局', () => {
  {
    const { state, api } = setup(1)
    chapter.behavior.outOfTheFryingPan(state, api)
    for (const inv of state.investigators) inv.resigned = true
    assert.equal(chapter.behavior.allResigned(state, api), true)
    assert.equal(api.finished, 'resolution1')
  }
  {
    const { state, api } = setup(1)
    for (const inv of state.investigators) inv.resigned = true
    assert.equal(chapter.behavior.allResigned(state, api), true)
    assert.equal(api.finished, 'noResolution')
  }
  {
    const { state, api } = setup(1)
    chapter.behavior.outOfTheFryingPan(state, api)
    for (const inv of state.investigators) { inv.resigned = true; inv.defeated = true }
    assert.equal(chapter.behavior.checkBackToTheValeObjective(state, api), false, '全员被击败时无结局 1')
  }
})

// ---------------------------------------------------------------------------
// 10. JSON 往返
// ---------------------------------------------------------------------------

test('P7 theTwistedHollow JSON 往返：存档后继续树林扩张、幕推进与结局', () => {
  const { state, api } = setup(2)
  const target = state.locations.find(location => location.id !== 'glimmeringWoods')
  state.investigators[0].location = target.id
  target.revealed = true
  chapter.behavior.locationRevealed(state, target, api, 0)
  const restored = clone(state)
  assert.equal(restored.scenario.id, 'theTwistedHollow')
  assert.equal(darknessLevel(restored), 1)
  assert.equal(chapter.behavior.woodsDeckSize(restored), chapter.behavior.woodsDeckSize(state))
  assert.equal(Object.keys(chapter.behavior.gridState(restored)).length, state.locations.length)
  // 读档后继续：把全员放到同一巢穴并推进幕 1
  const lairId = restored.locations.find(location => location.id !== 'glimmeringWoods').id
  const lair = restored.locations.find(location => location.id === lairId)
  lair.revealed = true
  for (const inv of restored.investigators) { inv.location = lairId; inv.clues = 3 }
  restored._roundEndWindow = true
  const restoreApi = makeApi(restored)
  assert.equal(chapter.behavior.checkActOneObjective(restored, restoreApi), true)
  assert.equal(restoreApi.advanced, 1)
  const again = clone(restored)
  const finalApi = makeApi(again)
  chapter.behavior.resolution(again, 'resolution3', [], finalApi)
  assert.equal(again.campaign.records.areasSurveyedWesternWoods, true)
  assert.equal(typeof again.scenarioFlags.twistedHollowWoods.deck, 'object')
})
