// P7 淹没城区（theDrownedQuarter · 提示卡 11536）章节测试。
//
// 覆盖：章节结构与 manifest、遭遇牌库/放一边守恒、随机海床布局（8 张环位 + 2 张移出）、
// 3×3 网格正交连接、屏障核心未激活/已激活翻面、幕 1 目标与背面分流、议程正反面、
// 四档混乱符号、水下寄生虫/黑曜石遗物/屏障节点、结局 1/2/3 与无结局、东西向跳章、
// JSON 存档往返，以及 20 张单卡条目的导入与注册唯一性。
//
// 本文件不 import engine.js：behavior 只走内容层函数与既有引擎主值（网格 mechanicState、
// flood.js 原语），因此可在主进程重建索引前独立运行。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { mechanicState } from '../src/engine/mechanic-state.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { assertScenarioManifest } from '../content/schema.js'
import * as chapter from '../content/campaigns/theDrownedCity/scenarios/theDrownedQuarter/index.js'
import {
  scenario, ACT_CODES, AGENDA_CODES, ACT1_CODE, AGENDA1_CODE, AGENDA2_CODE, RESOLUTION_KEYS,
  RESOLUTION_CHAIN, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, GATHER_GROUPS, LOCATIONS, LOCATION_IDS,
  START_LOCATION, SEA_FLOOR_POOL_IDS, SEA_FLOOR_CELLS, LOCATION_COORDINATES, SET_ASIDE_CARDS,
  SET_ASIDE_ALIASES, ENEMY_CODES, UNDESEA_PARASITE_CODE, UNDESEA_PARASITE_STORY_CODE, MEDUSA_CODE,
  SEAFLOOR_LEVIATHAN_CODE, OBSIDIAN_RELIC_CODE, OBSIDIAN_RELIC_STORY_CODE, BARRIER_NODE_CODE,
  BARRIER_CORE_ACTIVE_CODE, BARRIER_CORE_INACTIVE_CODE, NEXT_SCENARIO_IDS,
} from '../content/campaigns/theDrownedCity/scenarios/theDrownedQuarter/definition.js'
import {
  behavior, planLayout, layoutPlan, writeGridCell, placeLocationAt, floodLevelOf, canChangeFloodOf,
  changeFloodOf, adjacentFloodable, syncBarrierCore, flipBarrierCore, barrierCoreSummary,
  revealedUnfloodedSeaFloorCount, controlledBarrierNode, headedWest, translateGlyph, glyphsKnown,
  flipUnderseaParasite, flipObsidianRelic, barrierNodeInPlay, spawnEnemy, seafloorLeviathanHealth,
  resolutionChainForKey, nextScenarioFor, locationOf, isSeaFloorLocation, setupScenario,
} from '../content/campaigns/theDrownedCity/scenarios/theDrownedQuarter/behavior.js'
import {
  DROWNED_QUARTER_TOKEN_MEANINGS, CHAOS_TOKEN_FACES, drownedQuarterChaosToken,
  drownedQuarterChaosTokenValue, drownedQuarterTokenText, skullValue, revealedLocationCount,
  investigatorFloodLevel, isHardSide,
} from '../content/campaigns/theDrownedCity/scenarios/theDrownedQuarter/chaos.js'

const MODULE_ROOT = '../src/cards/encounter-entries/theDrownedCity/theDrownedQuarter/'
const ENTRY_MODULES = await Promise.all([
  '11537', '11537b', '11538', '11539', '11540', '11540b', '11541', '11542', '11543', '11544',
  '11545', '11546', '11547', '11548', '11549', '11549b', '11550', '11550b', '11551', '11552',
].map(code => import(`${MODULE_ROOT}${code}.js`)))
const ENTRIES = ENTRY_MODULES.map(module => module.default)
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
    attacks: [],
    finished: null,
    random: () => 0.5,
    shuffle: list => [...list],
    choose: () => null,
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
    healHorror(seat, amount = 1) { state.investigators[seat].horror = Math.max(0, state.investigators[seat].horror - amount) },
    addTrauma(seat, kind, amount = 1) {
      state.campaign.trauma[seat] ||= { physical: 0, mental: 0 }
      state.campaign.trauma[seat][kind] += amount
    },
    addScenarioXpBonus(seat, amount = 1) {
      state.investigators[seat].scenarioXpBonus = (Number(state.investigators[seat].scenarioXpBonus) || 0) + amount
    },
    defeat(inv) { inv.defeated = true; inv.defeatCause = 'physical' },
    finish(key) { api.finished = key },
    advanceAct() {
      behavior.actReveal(state, state.acts[state.actIndex], api)
      if (api.finished) return
      state.actIndex += 1
    },
    spawn(code, locationId, extra = {}) {
      serial += 1
      const enemy = {
        id: `${code}-${serial}`, code, originalCode: code, name: code, location: locationId,
        fight: 2, evade: 2, health: 3, damage: 1, horror: 1, traits: [],
        exhausted: extra.exhausted === true, engagedSeat: extra.engagedSeat ?? null,
        damageTaken: 0, doom: 0, clues: 0, attachments: [],
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
    moveEnemyToward(enemy, destination) { enemy.location = destination; return true },
    ...overrides,
  }
  return api
}
const fresh = async (count = 2, records = {}, apiOptions = {}, setUp = true) => {
  const state = makeState(count, records)
  state.scenario = structuredClone(scenario)
  const api = makeApi(state, apiOptions)
  if (setUp) {
    const report = setupScenario(state, api)
    state.difficulty = 'standard'
    return { state, api, report }
  }
  return { state, api }
}
const jsonClone = value => JSON.parse(JSON.stringify(value))

// ---------------------------------------------------------------------------
// 1. 章节结构 / manifest / 条目
// ---------------------------------------------------------------------------
test('P7 theDrownedQuarter 章节结构：20 张条目、11 处地点、1 幕 2 议程与 development manifest', () => {
  assert.equal(scenario.id, 'theDrownedQuarter')
  assert.equal(scenario.referenceCode, '11536')
  assert.deepEqual([...ACT_CODES], ['11539'])
  assert.deepEqual([...AGENDA_CODES], ['11537', '11538'])
  assert.equal(scenario.acts.length, 1)
  assert.equal(scenario.agendas.length, 2)
  assert.equal(ACT1_CODE, '11539')
  assert.equal(AGENDA1_CODE, '11537')
  assert.equal(AGENDA2_CODE, '11538')
  assert.equal(chapter.manifest.status, 'development')
  assert.equal(chapter.manifest.campaignId, 'theDrownedCity')
  assert.equal(chapter.manifest.referenceCode, '11536')
  assert.equal(chapter.manifest.contentVersion, '0.1.0')
  assert.equal(chapter.manifest.locations.length, 11)
  // manifest 通过内容注册结构校验（scheme 与 layout 连线都必须合法）。
  assert.equal(assertScenarioManifest(chapter.manifest), chapter.manifest)
  assert.deepEqual(chapter.manifest.resolutionIds, [...RESOLUTION_KEYS])
  assert.deepEqual([...RESOLUTION_KEYS], ['noResolution', 'resolution1', 'resolution2', 'resolution3'])
  assert.equal(chapter.implementedEncounterCodes.length, 20)
  assert.equal(chapter.behaviorEntryCodes.length, 10)
  assert.deepEqual([...GATHER_GROUPS], ['theDrownedQuarter', 'alienMachinery', 'cosmicLegacy',
    'deepOnes', 'elderMist', 'tdcFlood', 'rlyeh', 'underseaCreatures'])
  // 剧情/指南文本与四档符号表就位。
  assert.equal(chapter.SCENARIO_TEXT.textLanguage, 'zh')
  assert.ok(chapter.SCENARIO_TEXT.intro.length > 0)
  assert.equal(chapter.SCENARIO_TEXT.setupSteps.length, 11)
  assert.equal(Object.keys(chapter.SCENARIO_TEXT.resolutions).length, 4)
  assert.equal(CHAOS_TOKEN_FACES.length, 4)
  assert.equal(Object.keys(DROWNED_QUARTER_TOKEN_MEANINGS).length, 4)
  assert.equal(scenario.mechanics.water.air, true)
  assert.equal(scenario.mechanics.water.damage, 5)
})

test('P7 theDrownedQuarter 单卡条目：20 个文件、code = 文件名、身份都是真实卡号且注册唯一', () => {
  assert.equal(ENTRIES.length, 20)
  const codes = ENTRIES.map(entry => entry.code)
  assert.equal(new Set(codes).size, 20)
  assert.deepEqual([...codes].sort(),
    ['11537', '11537b', '11538', '11539', '11540', '11540b', '11541', '11542', '11543',
      '11544', '11545', '11546', '11547', '11548', '11549', '11549b', '11550', '11550b',
      '11551', '11552'].sort())
  const scopes = new Set(ENTRIES.map(entry => entry.scope))
  for (const scope of scopes) {
    assert.ok(['agenda', 'act', 'location', 'enemy', 'treachery', 'storyAsset'].includes(scope), scope)
  }
  // 物理身份：同一张双面卡的两个卡号都指向同一张印刷卡（11540/11540b、11550/11550b 等）。
  assert.ok(registeredEntry('11540b').note.includes('data-type'))
  assert.equal(registeredEntry('11552').cannotLeavePlay, true)
  assert.equal(registeredEntry('11550').flags.test.difficulty, 8)
  // 数据型条目必须带 note，说明行为读点或近似。
  for (const entry of ENTRIES) assert.ok(typeof entry.note === 'string' && entry.note.length > 0, entry.code)
})

// ---------------------------------------------------------------------------
// 2. 遭遇牌库 / 放一边守恒
// ---------------------------------------------------------------------------
test('P7 theDrownedQuarter 遭遇牌库：36 张、8 组、水下寄生虫/利维坦不进牌库', () => {
  assert.equal(ENCOUNTER_DECK.length, 36)
  assert.equal(ENCOUNTER_DECK.filter(code => code === MEDUSA_CODE).length, 3, '水母 ×3')
  assert.equal(ENCOUNTER_DECK.includes(UNDESEA_PARASITE_CODE), false, '水下寄生虫放一边')
  assert.equal(ENCOUNTER_DECK.includes(SEAFLOOR_LEVIATHAN_CODE), false, '海底利维坦是议程背面')
  for (const code of ENCOUNTER_DECK_CODES) {
    assert.ok(['enemy', 'treachery'].includes(ALL_CARDS[code]?.type), `${code} 是敌人/诡计`)
  }
  assert.equal(new Set(ENCOUNTER_DECK_CODES).size, ENCOUNTER_DECK_CODES.length)
  // manifest 的遭遇区按卡号计数守恒（同卡 3 份深渊沟壑在地点表而不是牌库）。
  const total = chapter.manifest.zones.encounterDeck.reduce((sum, entry) => sum + entry.count, 0)
  assert.equal(total, ENCOUNTER_DECK.length)
  const setAside = chapter.manifest.zones.setAside
  for (const code of SET_ASIDE_CARDS) {
    assert.equal(setAside.find(entry => entry.cardCode === code)?.count, 1, code)
  }
  assert.deepEqual([...SET_ASIDE_ALIASES], [...SET_ASIDE_CARDS])
})

test('P7 theDrownedQuarter Setup：放一边 3 张、遭遇牌库 36 张、屏障核心未激活在场', async () => {
  const { state, api } = await fresh(2, { theExpeditionHeadedWest: true })
  assert.deepEqual([...state.scenarioZones.setAside].sort(), [...SET_ASIDE_CARDS].sort())
  assert.equal(state.encounterDeck.length, 36)
  const core = locationOf(state, START_LOCATION)
  assert.ok(core)
  assert.equal(core.revealed, true)
  assert.equal(behavior.barrierCoreSummary(state).active, false)
  assert.equal(core.face, 'inactive')
  assert.equal(state.scenarioFlags.drownedQuarterHeadedWest, true)
  assert.equal(api.finished, null)
  // 每位调查员都在屏障核心。
  assert.deepEqual(state.investigators.map(inv => inv.location), [START_LOCATION, START_LOCATION])
})

// ---------------------------------------------------------------------------
// 3. 随机海床布局与网格连接
// ---------------------------------------------------------------------------
test('P7 theDrownedQuarter 随机海床：两组二选一各移出 1 张，8 张洗牌进环位（未揭示）', async () => {
  const first = await fresh(1, { theExpeditionHeadedWest: true })
  const plan = layoutPlan(first.state)
  assert.ok(plan)
  assert.equal(plan.removed.length, 2, '淹没卫城与珊瑚礁各随机移出 1 张')
  for (const pair of [['acropolisEphemeral', 'acropolisCollapsed'], ['coralStatuaryGarden', 'coralFeedingGrounds']]) {
    assert.equal(pair.filter(id => plan.removed.includes(id)).length, 1, pair.join('/'))
  }
  assert.equal(plan.inPlay.length, 8)
  assert.equal(new Set(plan.inPlay).size, 8)
  assert.deepEqual([...plan.inPlay, ...plan.removed].sort(), [...SEA_FLOOR_POOL_IDS].sort())
  assert.equal(first.state.locations.length, 9, '屏障核心 + 8 张海床')
  for (const id of plan.inPlay) {
    const location = locationOf(first.state, id)
    assert.ok(location, `${id} 入场`)
    assert.equal(location.revealed, false, `${id} 起始未揭示（背面 = 海床）`)
    assert.equal(isSeaFloorLocation(first.state, location), true)
    assert.deepEqual(location.grid, plan.cells[id])
    assert.equal(location.clues, 0)
  }
  // 网格坐标：核心 (0,0)，8 个环位互不相同且都在核心的正交相邻格。
  assert.deepEqual(plan.cells.barrierCore, { x: 0, y: 0 })
  const ring = plan.inPlay.map(id => plan.cells[id])
  assert.equal(new Set(ring.map(cell => `${cell.x},${cell.y}`)).size, 8)
  // 环位 = 3×3 网格里核心周围的 8 格（含 4 个正交邻格与 4 个斜角格）。
  for (const cell of ring) assert.equal(Math.max(Math.abs(cell.x), Math.abs(cell.y)), 1)
  assert.deepEqual([...SEA_FLOOR_CELLS].map(cell => `${cell.x},${cell.y}`).sort(),
    ring.map(cell => `${cell.x},${cell.y}`).sort())
  // layout 与定义一致：11 个坐标、静态 connections 为空（连接来自运行期网格邻接）。
  assert.equal(Object.keys(chapter.layout.locations).length, 11)
  assert.equal(chapter.layout.edges.length, 0)
  assert.equal(Object.keys(LOCATION_COORDINATES).length, 11)
  // 不同洗牌得到不同布局（随机性读点）。
  const second = await fresh(1, { theExpeditionHeadedWest: true }, { shuffle: list => [...list].reverse() })
  assert.notDeepEqual(layoutPlan(second.state).inPlay, plan.inPlay)
})

test('P7 theDrownedQuarter 网格相邻即相连：核心 4 条、环角 2 条、环边 3 条且双向', async () => {
  const { state } = await fresh(2, { theExpeditionHeadedWest: true })
  for (const location of state.locations) {
    for (const neighbor of location.connections) {
      const target = locationOf(state, neighbor)
      assert.ok(target, `${location.id} → ${neighbor} 已入场`)
      assert.ok(target.connections.includes(location.id), `${location.id} ↔ ${neighbor} 双向`)
    }
  }
  const core = locationOf(state, START_LOCATION)
  assert.equal(core.connections.length, 4)
  const plan = layoutPlan(state)
  const byCell = new Map([[START_LOCATION, plan.cells[START_LOCATION]],
    ...plan.inPlay.map(id => [id, plan.cells[id]])])
  const expected = (cell) => [
    { x: cell.x - 1, y: cell.y }, { x: cell.x + 1, y: cell.y },
    { x: cell.x, y: cell.y - 1 }, { x: cell.x, y: cell.y + 1 },
  ].filter(neighbor => [...byCell.values()].some(other => other.x === neighbor.x && other.y === neighbor.y)).length
  for (const id of plan.inPlay) assert.equal(locationOf(state, id).connections.length, expected(byCell.get(id)), id)
})

// ---------------------------------------------------------------------------
// 4. 屏障核心与淹没
// ---------------------------------------------------------------------------
test('P7 theDrownedQuarter 屏障核心：≥6 处已揭示且未淹没海床 → 已激活；≤5 → 翻回', async () => {
  const { state, api } = await fresh(2, { theExpeditionHeadedWest: true })
  const plan = layoutPlan(state)
  // 全部海床揭示且未淹没（+ 屏障核心本身也带 [[海底]]，Haskell 同口径计入）。
  for (const id of plan.inPlay) {
    locationOf(state, id).revealed = true
    if (floodLevelOf(state, id) > 0) changeFloodOf(state, id, -2, api)
  }
  assert.ok(revealedUnfloodedSeaFloorCount(state) >= 9)
  assert.equal(syncBarrierCore(state, api), true)
  assert.deepEqual(barrierCoreSummary(state), {
    inPlay: true, active: true, face: 'active', revealedUnfloodedSeaFloor: revealedUnfloodedSeaFloorCount(state),
  })
  const core = locationOf(state, START_LOCATION)
  assert.equal(core.code, BARRIER_CORE_ACTIVE_CODE)
  assert.equal(core.clues, 0)
  // 把 5 处海床淹没（有效等级 >0）→ 未淹没且已揭示的数量 ≤5 → 翻回未激活。
  for (const id of plan.inPlay.slice(0, 5)) changeFloodOf(state, id, 1, api)
  assert.equal(syncBarrierCore(state, api), true)
  assert.equal(barrierCoreSummary(state).active, false)
  assert.equal(locationOf(state, START_LOCATION).code, BARRIER_CORE_INACTIVE_CODE)
  // flipBarrierCore 幂等。
  assert.equal(flipBarrierCore(state, false, api), false)
})

test('P7 theDrownedQuarter 海床漫入：进入海床时提高本地点与一处相邻地点淹没，每地点一次', async () => {
  const { state, api } = await fresh(2, { theExpeditionHeadedWest: true })
  const plan = layoutPlan(state)
  const id = plan.inPlay[0]
  const location = locationOf(state, id)
  const before = floodLevelOf(state, id)
  assert.equal(behavior.locationRevealed(state, location, api, 0), true)
  assert.equal(floodLevelOf(state, id), Math.min(2, before + 1))
  assert.equal(behavior.locationRevealed(state, location, api, 0), false, '同一地点不再重复触发')
  // 至少一处相邻地点被提高（若可提高）。
  const neighbors = adjacentFloodable(state, id)
  assert.ok(Array.isArray(neighbors))
  // 东向 Setup 初始涨水。
  const east = await fresh(2, { theExpeditionHeadedWest: false })
  const eastPlan = layoutPlan(east.state)
  const flooded = eastPlan.inPlay.filter(code => floodLevelOf(east.state, code) > 0)
  assert.equal(flooded.length, 2, '1/每名调查员（2 位）')
})

test('P7 theDrownedQuarter 行动：幕 1 [fast] 降淹没、核心改道放线索、已激活核心取屏障节点', async () => {
  const { state, api } = await fresh(2, { theExpeditionHeadedWest: true })
  const plan = layoutPlan(state)
  // 幕 1 [fast]：在淹没地点共同支付 1/人线索降低淹没。
  const floodedId = plan.inPlay[0]
  changeFloodOf(state, floodedId, 1, api)
  state.investigators[0].location = floodedId
  state.investigators[1].location = floodedId
  state.investigators[0].clues = 1
  state.investigators[1].clues = 1
  const fast = behavior.actions(state, state.investigators[0])
    .find(move => move.rule === 'drownedQuarterDecreaseFlood')
  assert.ok(fast, '淹没地点给 [fast] 降淹没行动')
  assert.equal(behavior.performAction(state, state.investigators[0], fast, api), true)
  assert.equal(floodLevelOf(state, floodedId), 0)
  assert.equal(state.investigators[0].clues + state.investigators[1].clues, 0)
  // 核心改道：核心淹没 → 降低自身、提高相邻、放 3/人线索（团队每轮一次）。
  const core = locationOf(state, START_LOCATION)
  changeFloodOf(state, core.id, 1, api)
  state.investigators[0].location = core.id
  state.investigators[1].location = core.id
  const divert = behavior.actions(state, state.investigators[0])
    .find(move => move.rule === 'drownedQuarterCoreDivert')
  assert.ok(divert)
  const beforeCoreFlood = floodLevelOf(state, core.id)
  assert.equal(behavior.performAction(state, state.investigators[0], divert, api), true)
  assert.equal(floodLevelOf(state, core.id), beforeCoreFlood - 1)
  assert.equal(behavior.actions(state, state.investigators[0])
    .some(move => move.rule === 'drownedQuarterCoreDivert'), false, '团队每轮一次')
  // 已激活核心：团队支付 2/人线索取屏障节点（每场一次）。
  for (const location of state.locations) if (location.id !== START_LOCATION) location.revealed = true
  for (const location of state.locations) {
    while (floodLevelOf(state, location.id) > 0) changeFloodOf(state, location.id, -1, api)
  }
  syncBarrierCore(state, api)
  assert.equal(barrierCoreSummary(state).active, true)
  state.investigators[0].location = core.id
  state.investigators[1].location = core.id
  state.investigators[0].clues = 4
  state.investigators[1].clues = 0
  const take = behavior.actions(state, state.investigators[0])
    .find(move => move.rule === 'drownedQuarterTakeBarrierNode')
  assert.ok(take)
  assert.equal(behavior.performAction(state, state.investigators[0], take, api), true)
  assert.equal(controlledBarrierNode(state), true)
  assert.deepEqual(barrierNodeInPlay(state).code, BARRIER_NODE_CODE)
  assert.equal(behavior.performAction(state, state.investigators[0], take, api), false, '每场一次')
})

// ---------------------------------------------------------------------------
// 5. 幕 / 议程
// ---------------------------------------------------------------------------
test('P7 theDrownedQuarter 幕 1 目标与背面：全队轮末在已激活核心 → 有节点结局 1 / 无节点结局 2', async () => {
  const withNode = await fresh(2, { theExpeditionHeadedWest: true })
  const state = withNode.state
  const api = withNode.api
  for (const location of state.locations) location.revealed = true
  for (const location of state.locations) while (floodLevelOf(state, location.id) > 0) {
    changeFloodOf(state, location.id, -1, api)
  }
  syncBarrierCore(state, api)
  for (const inv of state.investigators) inv.location = START_LOCATION
  // 未到轮末窗口：不推进。
  assert.equal(behavior.checkObjectives(state, api), false)
  state._roundEndWindow = true
  assert.equal(behavior.checkObjectives(state, api), true)
  assert.equal(api.finished, 'resolution2', '未控制屏障节点 → 结局 2')
  // 控制屏障节点 → 结局 1。
  const second = await fresh(2, { theExpeditionHeadedWest: true })
  behavior.events.drownedQuarterTakeBarrierNode(second.state, { seat: 0 }, second.api)
  const core = locationOf(second.state, START_LOCATION)
  core.face = 'active'
  second.state.acts[0].originalCode = ACT1_CODE
  assert.equal(behavior.actReveal(second.state, second.state.acts[0], second.api), true)
  assert.equal(second.api.finished, 'resolution1')  // 全员未在核心时不推进。
  const third = await fresh(2, { theExpeditionHeadedWest: true })
  third.state.acts[0].objective = { type: 'allAtBarrierCoreActive' }
  third.state._roundEndWindow = true
  third.state.investigators[0].location = START_LOCATION
  third.state.investigators[1].location = null
  assert.equal(behavior.checkObjectives(third.state, third.api), false)
})

test('P7 theDrownedQuarter 议程背面：沉没遗迹生成海底利维坦（生命 4+3/人），崩塌圆顶击败全队', async () => {
  const first = await fresh(2, { theExpeditionHeadedWest: true })
  assert.equal(behavior.agendaReveal(first.state, first.state.agendas[0], first.api), true)
  const leviathan = first.state.enemies.find(enemy => enemy.code === SEAFLOOR_LEVIATHAN_CODE)
  assert.ok(leviathan)
  assert.equal(leviathan.location, START_LOCATION, '生成于屏障核心')
  assert.equal(leviathan.health, seafloorLeviathanHealth(first.state))
  assert.equal(seafloorLeviathanHealth(first.state), 4 + 2 * 3)
  const second = await fresh(2, { theExpeditionHeadedWest: true })
  assert.equal(behavior.agendaReveal(second.state, second.state.agendas[1], second.api), true)
  assert.equal(second.state.investigators.every(inv => inv.defeated === true), true)
  assert.equal(second.state.campaign.trauma[0].physical, 1)
  assert.equal(second.state.campaign.trauma[1].physical, 1)
})

test('P7 theDrownedQuarter 敌军阶段强制：水母/利维坦重整时提高所在地点淹没，不能则放毁灭', async () => {
  const { state, api } = await fresh(2, { theExpeditionHeadedWest: true })
  const medusa = spawnEnemy(state, MEDUSA_CODE, layoutPlan(state).inPlay[0], api)
  medusa.exhausted = false
  const at = medusa.location
  const before = floodLevelOf(state, at)
  assert.equal(behavior.phaseBegan(state, 'enemy', api), true)
  assert.equal(floodLevelOf(state, at), Math.min(2, before + 1))
  // 完全淹没后无法提高 → 放毁灭。
  changeFloodOf(state, at, 2, api)
  medusa.doom = 0
  behavior.phaseBegan(state, 'enemy', api)
  assert.equal(medusa.doom, 1)
  // 横置的水母不触发。
  const exhausted = spawnEnemy(state, MEDUSA_CODE, at, api)
  exhausted.exhausted = true
  exhausted.doom = 0
  behavior.phaseBegan(state, 'enemy', api)
  assert.equal(exhausted.doom, 0)
})

// ---------------------------------------------------------------------------
// 6. 混乱标记
// ---------------------------------------------------------------------------
test('P7 theDrownedQuarter 混乱标记：四档取值（已揭示地点数 / 淹没状态）', async () => {
  const { state } = await fresh(2, { theExpeditionHeadedWest: true })
  for (const location of state.locations.slice(0, 7)) location.revealed = true
  assert.equal(revealedLocationCount(state), 7)
  assert.equal(skullValue(state), 3, '简单/普通：7 的一半向下取整')
  assert.equal(drownedQuarterChaosTokenValue(state, 'skull'), -3)
  assert.equal(drownedQuarterChaosTokenValue(state, 'cultist'), -2)
  assert.equal(drownedQuarterChaosTokenValue(state, 'tablet'), -4)
  // 未淹没：[elder_thing] 普通 -5。
  assert.equal(drownedQuarterChaosTokenValue(state, 'elderthing'), -5)
  state.difficulty = 'hard'
  assert.equal(isHardSide(state), true)
  assert.equal(skullValue(state), 7)
  assert.equal(drownedQuarterChaosTokenValue(state, 'skull'), -7)
  assert.equal(drownedQuarterChaosTokenValue(state, 'cultist'), -3)
  assert.equal(drownedQuarterChaosTokenValue(state, 'elderthing'), -6)
  assert.equal(drownedQuarterChaosTokenValue(state, 'frost'), null, '未知标记交回默认表')
  // 调查员所在地点已淹没：[elder_thing] 困难 -4。
  const inv = state.investigators[0]
  inv.location = state.locations[0].id
  changeFloodOf(state, inv.location, 1)
  assert.equal(investigatorFloodLevel(state, inv), 1)
  assert.equal(drownedQuarterChaosToken(state, inv, 'elderthing').delta, -4)
  assert.equal(drownedQuarterChaosToken({ ...state, difficulty: 'standard' }, inv, 'elderthing').delta, -3)
  assert.equal(drownedQuarterTokenText(state, 'tablet').includes('-4'), true)
})

test('P7 theDrownedQuarter 标记追加效果：[tablet] 失败放线索、[cultist] 淹没伤害', async () => {
  const { state, api } = await fresh(2, { theExpeditionHeadedWest: true })
  const inv = state.investigators[0]
  inv.location = layoutPlan(state).inPlay[0]
  inv.clues = 3
  // 简单/普通 [tablet]：失败放 1 个线索到所在地点。
  assert.equal(behavior.applyTokenEffect(state, inv, { token: 'tablet', mode: 'placeClueOnFail', test: { failedBy: 2 } }, api), true)
  assert.equal(inv.clues, 2)
  assert.equal(locationOf(state, inv.location).clues, 1)
  // 困难/专家 [tablet]：按失败差值放线索（有上限）。
  assert.equal(behavior.applyTokenEffect(state, inv, { token: 'tablet', mode: 'placeCluesPerFailure', test: { failedBy: 2 } }, api), true)
  assert.equal(inv.clues, 0)
  assert.equal(locationOf(state, inv.location).clues, 3)
  // 成功时不放。
  assert.equal(behavior.applyTokenEffect(state, inv, { token: 'tablet', mode: 'placeClueOnFail', test: { failedBy: 0 } }, api), false)
  // [cultist] 简单/普通：失败且完全淹没 → 1 伤害。
  changeFloodOf(state, inv.location, 2, api)
  const damage = inv.damage
  assert.equal(behavior.applyTokenEffect(state, inv, { token: 'cultist', mode: 'damageOnFailFullyFlooded' }, api), true)
  assert.equal(inv.damage, damage + 1)
  // [cultist] 困难/专家：已淹没（部分即可）→ 1 伤害。
  changeFloodOf(state, inv.location, -2, api)
  changeFloodOf(state, inv.location, 1, api)
  assert.equal(behavior.applyTokenEffect(state, inv, { token: 'cultist', mode: 'damageIfFlooded' }, api), true)
  assert.equal(inv.damage, damage + 2)
  // 未淹没时不结算。
  changeFloodOf(state, inv.location, -1, api)
  assert.equal(behavior.applyTokenEffect(state, inv, { token: 'cultist', mode: 'damageIfFlooded' }, api), false)
})

// ---------------------------------------------------------------------------
// 7. 敌人 / 故事 / 资产
// ---------------------------------------------------------------------------
test('P7 theDrownedQuarter 水下寄生虫：攻击后翻面移动到连接地点；被击败 → 符文 X + 胜利区', async () => {
  const { state, api } = await fresh(2, { theExpeditionHeadedWest: true })
  const plan = layoutPlan(state)
  const hostId = plan.inPlay[0]
  const host = locationOf(state, hostId)
  const parasite = spawnEnemy(state, UNDESEA_PARASITE_CODE, hostId, api, { engagedSeat: 0 })
  assert.equal(behavior.enemyAttackResolved(state, parasite, state.investigators[0], api), true)
  assert.notEqual(parasite.location, hostId, '咬伤后移动到连接地点')
  assert.ok((host.connections || []).includes(parasite.location) || parasite.location === hostId)
  assert.equal(parasite.exhausted, true)
  // 离场翻面 → 符文 X + 胜利区。
  assert.equal(behavior.enemyDefeated(state, parasite, api), true)
  assert.deepEqual(state.campaign.records.discoveredGlyphs, ['X'])
  assert.equal(state.victoryDisplay.some(entry => entry.code === UNDESEA_PARASITE_STORY_CODE), true)
  assert.equal(state.enemies.includes(parasite), false)
  assert.equal(glyphsKnown(state, 'x'), true)
})

test('P7 theDrownedQuarter 黑曜石遗物与屏障节点：符文 Y、资产不可离场与回合自愈', async () => {
  const { state, api } = await fresh(2, { theExpeditionHeadedWest: true })
  const inv = state.investigators[0]
  const relic = behavior.events.drownedQuarterTakeObsidianRelic(state, { seat: 0 }, api)
  assert.ok(relic)
  assert.equal(behavior.flipObsidianRelic(state, inv, relic, api), true)
  assert.deepEqual(state.campaign.records.discoveredGlyphs, ['Y'])
  assert.equal(state.victoryDisplay.some(entry => entry.code === OBSIDIAN_RELIC_STORY_CODE), true)
  assert.equal(inv.assets.includes(relic), false)
  // 屏障节点：不能离场由条目 cannotLeavePlay 声明；回合开始治愈 1 点伤害。
  assert.equal(registeredEntry('11552').cannotLeavePlay, true)
  const barrier = behavior.events.drownedQuarterTakeBarrierNode(state, { seat: 0 }, api)
  assert.equal(barrier.code, BARRIER_NODE_CODE)
  assert.equal(controlledBarrierNode(state), true)
  barrier.damage = 1
  assert.equal(behavior.turnBegins(state, inv, api), true)
  assert.equal(barrier.damage, 0)
})

// ---------------------------------------------------------------------------
// 8. 结局与跳章
// ---------------------------------------------------------------------------
test('P7 theDrownedQuarter 结局链：结局 2 记录供能改导并在结局 3 发奖励经验；划掉拉莱耶地图', async () => {
  const west = await fresh(2, { theExpeditionHeadedWest: true }, {}, false)
  const result = behavior.resolution(west.state, 'resolution2', null, west.api)
  const records = west.state.campaign.records
  assert.equal(records.drownedQuarterResolution, 'resolution2')
  assert.equal(records.drownedQuarterResolvedTo, 'resolution3')
  assert.equal(records.thePowerWasDiverted, true)
  assert.equal(records.drownedQuarterNextScenario, NEXT_SCENARIO_IDS.west)
  assert.equal(result.nextScenarioId, 'theApiary')
  assert.deepEqual(records.rlyehMap, ['RlyehDrownedQuarter'])
  assert.deepEqual(west.state.investigators.map(inv => inv.scenarioXpBonus), [2, 2])
  // 结局 1：勾选屏障节点；不记录供能改道 → 无奖励经验。
  const first = await fresh(2, { theExpeditionHeadedWest: false }, {}, false)
  behavior.resolution(first.state, 'resolution1', null, first.api)
  assert.equal(first.state.campaign.records.barrierNode, true)
  assert.equal(first.state.campaign.records.thePowerWasDiverted, undefined)
  assert.equal(first.state.campaign.records.drownedQuarterNextScenario, NEXT_SCENARIO_IDS.east)
  assert.deepEqual(first.state.investigators.map(inv => inv.scenarioXpBonus), [undefined, undefined])
  // 无结局：链尾仍是结局 3（不写 barrierNode / thePowerWasDiverted）。
  const none = await fresh(1, { theExpeditionHeadedWest: true }, {}, false)
  behavior.resolution(none.state, 'noResolution', null, none.api)
  assert.equal(none.state.campaign.records.drownedQuarterNoResolution, true)
  assert.equal(none.state.campaign.records.drownedQuarterResolvedTo, 'resolution3')
  assert.equal(none.state.campaign.records.barrierNode, undefined)
  assert.deepEqual(resolutionChainForKey('noResolution'), ['noResolution', 'resolution3'])
  assert.deepEqual(resolutionChainForKey('resolution3'), ['resolution3'])
  assert.equal(nextScenarioFor(none.state), 'theApiary')
})

test('P7 theDrownedQuarter 跳章出口：西向 → theApiary，东向 → theWesternWall（manifest 一致）', async () => {
  const west = await fresh(1, { theExpeditionHeadedWest: true }, {}, false)
  const east = await fresh(1, { theExpeditionHeadedWest: false }, {}, false)
  assert.equal(headedWest(west.state), true)
  assert.equal(behavior.resolution(west.state, 'resolution3', null, west.api).nextScenarioId, 'theApiary')
  assert.equal(behavior.resolution(east.state, 'resolution3', null, east.api).nextScenarioId, 'theWesternWall')
  assert.deepEqual({ ...chapter.manifest.resolutionExits.resolution3 }, { ...NEXT_SCENARIO_IDS })
  assert.equal(chapter.manifest.nextScenarioId, 'theApiary')
})

// ---------------------------------------------------------------------------
// 9. 存档往返
// ---------------------------------------------------------------------------
test('P7 theDrownedQuarter JSON 存档往返：布局/淹没/放一边/记录读回后行为继续可用', async () => {
  const { state, api } = await fresh(2, { theExpeditionHeadedWest: true })
  const plan = layoutPlan(state)
  changeFloodOf(state, plan.inPlay[0], 1, api)
  behavior.resolveChaosToken(state, state.investigators[0], 'skull')
  const saved = jsonClone(state)
  const restored = makeApi(saved)
  assert.deepEqual(layoutPlan(saved).inPlay, plan.inPlay)
  assert.deepEqual(layoutPlan(saved).removed, plan.removed)
  assert.equal(floodLevelOf(saved, plan.inPlay[0]), 1)
  assert.deepEqual([...saved.scenarioZones.setAside].sort(), [...SET_ASIDE_CARDS].sort())
  // 无函数残留（行为状态必须是纯 JSON）。
  assert.equal(JSON.stringify(saved).includes('function'), false)
  // 读回后仍能翻面核心。
  for (const location of saved.locations) location.revealed = true
  for (const location of saved.locations) while (floodLevelOf(saved, location.id) > 0) changeFloodOf(saved, location.id, -1, restored)
  assert.equal(syncBarrierCore(saved, restored), true)
  assert.equal(barrierCoreSummary(saved).active, true)
})
