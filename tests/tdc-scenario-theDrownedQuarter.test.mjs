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
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { persistEnabled, readSnapshot, saveSnapshot, snapshotPath } from '../../../lib/sessions.js'
import { scenarioRuntime } from '../src/engine/engine.js'
import {
  fixture as engineFixture, asset as engineAsset, move as engineMove, settle as engineSettle,
  legalMoves as engineLegalMoves,
} from './core-fixture.mjs'
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
  revealedSeafloorLocationCount,
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
  // 引擎运行时（scenarioRuntime）会写日志/事件/离场区；真实存档与 replay 依赖这些纯 JSON 字段。
  log: [], events: [], setAsideEnemies: [], removedFromGame: [],
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
    // 海床地点 11542–11548 的既有 api 桩（P7 第四轮）。
    choice(spec) { return spec?.options?.[0]?.id ?? null },
    discardChosen(seat, count) {
      const inv = state.investigators[seat]
      for (let index = 0; index < count; index += 1) inv?.hand?.pop()
      return true
    },
    gainResources(seat, amount) { state.investigators[seat].resources = (Number(state.investigators[seat].resources) || 0) + amount },
    drawCards(seat, count) {
      const inv = state.investigators[seat]
      for (let index = 0; index < count; index += 1) {
        const code = inv.deck?.length ? inv.deck.pop() : `testCard${index}`
        inv.hand.push(code)
      }
    },
    takeFromSetAside(code) {
      const pile = state.scenarioZones?.setAside || []
      const index = pile.indexOf(code)
      if (index < 0) return false
      pile.splice(index, 1)
      return true
    },
    spawnEngaged(code, locationId, seat) {
      const enemy = api.spawn(code, locationId)
      if (Number.isInteger(seat)) {
        enemy.engagedSeat = seat
        state.investigators[seat].engaged ||= []
        state.investigators[seat].engaged.push(enemy.id)
      }
      return enemy
    },
    readyEnemy(enemy) { enemy.exhausted = false; return true },
    setEnemyKeywords() { return true },
    attack() { return true },
    discardEncounterTop(count = 1) {
      const discarded = []
      for (let index = 0; index < count; index += 1) {
        const code = state.encounterDeck.pop()
        if (code == null) break
        state.encounterDiscard.push(code)
        discarded.push(code)
      }
      return discarded
    },
    takeEncounterCard(code, options = {}) {
      const piles = options.pile ? [options.pile] : ['encounterDeck', 'encounterDiscard']
      for (const pile of piles) {
        const list = state[pile] || []
        const index = list.lastIndexOf(code)
        if (index < 0) continue
        list.splice(index, 1)
        return code
      }
      return null
    },
    shuffleIntoEncounterDeck(codes) { state.encounterDeck.push(...codes); return codes.length },
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
  assert.equal(chapter.manifest.status, 'playable')
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
  // 11551 水母：巡逻（最近的未淹没或部分淹没地点）由引擎既有 enemyRule.patrolTarget 读点声明。
  assert.deepEqual(registeredEntry('11551').enemyRule.patrolTarget, { kind: 'flood', below: 2 })
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

// ---------------------------------------------------------------------------
// 10. 真实持久化（lib/sessions.js 的 saveSnapshot / readSnapshot）
// ---------------------------------------------------------------------------
test('P7 theDrownedQuarter 真实 saveSnapshot/readSnapshot 存档重放：读回状态等价且后续动作确定', async (t) => {
  const home = mkdtempSync(join(tmpdir(), 'tdc-drowned-quarter-save-'))
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
  const { state, api } = await fresh(2, { theExpeditionHeadedWest: true })
  const plan = layoutPlan(state)
  for (const id of plan.inPlay) locationOf(state, id).revealed = true
  changeFloodOf(state, plan.inPlay[0], 1, api)
  translateGlyph(state, 'rune_x', '总和', api)
  const inMemory = jsonClone(state)
  const sessionId = 'tdc-drowned-quarter-replay'
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
  // 从读回状态与内存状态执行同一个真实章节动作（揭示全部 + 排空淹没 + 同步核心），指纹必须一致。
  const advance = (draft) => {
    const draftApi = makeApi(draft)
    for (const location of draft.locations) location.revealed = true
    for (const location of draft.locations) {
      while (floodLevelOf(draft, location.id) > 0) changeFloodOf(draft, location.id, -1, draftApi)
    }
    const flipped = syncBarrierCore(draft, draftApi)
    return {
      flipped,
      summary: barrierCoreSummary(draft),
      glyphs: [...(draft.campaign.records.discoveredGlyphs || [])],
      locations: draft.locations.map(location => location.id).sort(),
    }
  }
  const fromRestored = advance(restored.session.state)
  const fromMemory = advance(jsonClone(inMemory))
  assert.deepEqual(fromRestored, fromMemory, '恢复后继续行动的结果与内存状态一致')
  assert.equal(fromRestored.flipped, true)
  assert.equal(fromRestored.summary.active, true)
  assert.deepEqual(fromRestored.glyphs, ['X'])
})

// ---------------------------------------------------------------------------
// 11. 引擎「敌人非击败离场」钩子（PRIMITIVES 2026-11-20 已落地）
// ---------------------------------------------------------------------------
test('P7 theDrownedQuarter enemyLeftPlay：水下寄生虫非击败离场（弃牌 / 移出游戏）翻面结算故事面', async () => {
  const { state, api } = await fresh(2, { theExpeditionHeadedWest: true })
  const plan = layoutPlan(state)
  const runtime = scenarioRuntime(state, [])
  // 路径 1：引擎 discardEnemyCard（discardEnemy）→ behavior.enemyLeftPlay(reason='discarded')。
  const discarded = spawnEnemy(state, UNDESEA_PARASITE_CODE, plan.inPlay[0], api)
  assert.equal(state.enemies.includes(discarded), true)
  runtime.discardEnemy(discarded)
  assert.equal(state.enemies.includes(discarded), false, '离场后不在场上')
  assert.deepEqual(state.campaign.records.discoveredGlyphs, ['X'], '离场翻面 → 符文 X')
  assert.equal(state.victoryDisplay.some(entry => entry.code === UNDESEA_PARASITE_STORY_CODE), true,
    '故事面（11549b）加入胜利区')
  assert.equal(state.encounterDiscard.includes(UNDESEA_PARASITE_CODE), false,
    '故事面进胜利区后不再重复留在遭遇弃牌堆')
  assert.notEqual(state.scenarioFlags[`drownedQuarterEnemyLeftPlay:${discarded.id}`], undefined,
    '钩子按实体标记已结算')
  // 路径 2：引擎 removeEnemyFromGame → behavior.enemyLeftPlay(reason='removed')。
  const removed = spawnEnemy(state, UNDESEA_PARASITE_CODE, plan.inPlay[1], api)
  runtime.removeEnemyFromGame(removed)
  assert.equal(state.enemies.includes(removed), false)
  assert.equal(state.removedFromGame.includes(UNDESEA_PARASITE_CODE), false,
    '故事面进胜利区后撤销默认「移出游戏」去向')
  assert.notEqual(state.scenarioFlags[`drownedQuarterEnemyLeftPlay:${removed.id}`], undefined)
  // 幂等：同一实体再次触发不再结算（避免双结算）。
  assert.equal(behavior.enemyLeftPlay(state, removed, 'removed', runtime), false)
  assert.equal(state.victoryDisplay.filter(entry => entry.code === UNDESEA_PARASITE_STORY_CODE).length, 1,
    '故事面只进一次胜利区；符文只记录一次')
  // 非目标敌人离场不走本钩子：不会产生符文/胜利区变化。
  const medusa = spawnEnemy(state, MEDUSA_CODE, plan.inPlay[2], api)
  runtime.discardEnemy(medusa)
  assert.equal(state.victoryDisplay.length, 1)
  assert.deepEqual(state.campaign.records.discoveredGlyphs, ['X'])
})

// P7 第三轮原语 enemyWouldBeSetAside：11549 放一边路径由内容接管去向，不进入 setAsideEnemies。
test('P7 theDrownedQuarter enemyWouldBeSetAside：11549 放一边路径翻面进胜利区且不进入放一边区', async () => {
  const { state, api } = await fresh(2, { theExpeditionHeadedWest: true })
  const plan = layoutPlan(state)
  state.scenarioZones.setAside = [...(state.scenarioZones.setAside || [])]
  const runtime = scenarioRuntime(state, [])
  const parasite = spawnEnemy(state, UNDESEA_PARASITE_CODE, plan.inPlay[0], api)
  assert.equal(runtime.setEnemyAside(parasite), parasite.id)
  assert.equal(state.enemies.includes(parasite), false, '离场后不在场上')
  assert.equal((state.setAsideEnemies || []).some(item => item.id === parasite.id), false,
    'enemyWouldBeSetAside 返回 true → 引擎跳过 setAsideEnemies 入列')
  assert.deepEqual(state.campaign.records.discoveredGlyphs, ['X'], '翻面结算符文 X')
  assert.equal(state.victoryDisplay.some(entry => entry.code === UNDESEA_PARASITE_STORY_CODE), true,
    '故事面加入胜利区')
  // 非 11549 敌人仍按默认去向进入放一边区。
  const medusa = spawnEnemy(state, MEDUSA_CODE, plan.inPlay[1], api)
  runtime.setEnemyAside(medusa)
  assert.equal((state.setAsideEnemies || []).some(item => item.id === medusa.id), true,
    '非目标敌人仍进入 setAsideEnemies')
})

// ---------------------------------------------------------------------------
// 12. 地点帷幕修正（既有读点 locationShroudModifier）
// ---------------------------------------------------------------------------
test('P7 theDrownedQuarter 深渊沟壑：帷幕 X = 已揭示[[海底]]地点数的一半（向下取整）', async () => {
  const { state } = await fresh(2, { theExpeditionHeadedWest: true })
  const plan = layoutPlan(state)
  const trench = locationOf(state, 'abyssalTrench1')
  assert.equal(trench.shroud, 0, '卡表 shroud 占位由章节改为 0')
  // 屏障核心 + 0 张海床已揭示时：X = 1 div 2 = 0。
  state.locations.forEach(location => { location.revealed = location.id === START_LOCATION })
  assert.equal(revealedSeafloorLocationCount(state), 1)
  assert.equal(behavior.locationShroudModifier(state, trench), 0)
  // 再揭示 3 张海床 → 4 张已揭示 → X = 2。
  for (const id of plan.inPlay.slice(0, 3)) locationOf(state, id).revealed = true
  assert.equal(revealedSeafloorLocationCount(state), 4)
  assert.equal(behavior.locationShroudModifier(state, trench), 2)
  // 再揭示 4 张 → 8 张 → X = 4；只对深渊沟壑生效。
  for (const id of plan.inPlay.slice(3)) locationOf(state, id).revealed = true
  assert.equal(revealedSeafloorLocationCount(state), 9)
  assert.equal(behavior.locationShroudModifier(state, trench), 4)
  assert.equal(behavior.locationShroudModifier(state, locationOf(state, 'ancientGallery')), 0)
  assert.equal(behavior.locationShroudModifier(state, locationOf(state, START_LOCATION)), 0)
})

// ---------------------------------------------------------------------------
// 13. 受控剧情资产行动（P7 第二轮原语）：11550 黑曜石遗物
// ---------------------------------------------------------------------------
test('P7 theDrownedQuarter 11550 受控剧情资产：合法动作 + 真实智力(8) 结算 + 图标翻倍 + 离场故事面', () => {
  // 用真实引擎对局状态（core-fixture = 夜之特遣队夹具），把剧本身份指向本章以让引擎按
  // theDrownedQuarter behavior 派发 assetLeftPlay；能力本身是条目级声明，不依赖剧本。
  const state = engineFixture('01001')
  state.chaosBag = ['+20']
  state.scenario = { ...state.scenario, id: 'theDrownedQuarter' }
  engineAsset(state, '11550')
  const relic = state.investigators[0].assets.find(item => item.code === '11550')
  const moves = engineLegalMoves(state, 0).filter(move => move.action === 'ability' && move.assetId === relic.id)
  assert.equal(moves.length, 1, 'controlledAsset:true 让 [action] 出现在合法动作里')
  assert.match(moves[0].label, /智力\(8\)/)
  // 图标翻倍读点：仅在本次检定来源是 11550 时返回 2。
  state.skillTest = { source: { code: '11550' } }
  assert.equal(behavior.commitIconMultiplier(state), 2)
  state.skillTest = { source: { code: '01001' } }
  assert.equal(behavior.commitIconMultiplier(state), 0)
  state.skillTest = null
  // 真实结算：混乱标记 +20 → 智力检定成功 → 卡片离场 → 章节 behavior.assetLeftPlay 结算故事面。
  engineMove(state, { action: 'ability', assetId: relic.id, abilityIndex: 0 })
  engineSettle(state)
  const inv = state.investigators[0]
  assert.equal(inv.assets.some(item => item.code === '11550'), false, '成功后离场')
  assert.equal(inv.discard.includes('11550'), false, '离场不留在弃牌堆')
  assert.deepEqual(state.campaign.records.discoveredGlyphs, ['Y'], '故事面记录符文 Y「知识」')
  assert.equal(state.victoryDisplay.some(entry => entry.code === '11550b'), true, '故事卡 11550b 加入胜利区')
  assert.equal(state.removedFromGame.includes('11550'), true, '实体记录为移出游戏')
  // 失败路径：检定失败不离场、不产生符文/胜利区。
  const fail = engineFixture('01001')
  fail.chaosBag = ['-20']
  fail.scenario = { ...fail.scenario, id: 'theDrownedQuarter' }
  engineAsset(fail, '11550')
  const failRelic = fail.investigators[0].assets.find(item => item.code === '11550')
  engineMove(fail, { action: 'ability', assetId: failRelic.id, abilityIndex: 0 })
  engineSettle(fail)
  assert.equal(fail.investigators[0].assets.some(item => item.code === '11550'), true, '失败不离场')
  assert.equal(fail.campaign.records.discoveredGlyphs, undefined)
  assert.equal(fail.victoryDisplay.some(entry => entry.code === '11550b'), false)
})

// ---------------------------------------------------------------------------
// 14. 战役级「维护阶段不能获得资源」（Good Money 失败的跨章标记）
// ---------------------------------------------------------------------------
test('P7 theDrownedQuarter 战役级维护禁资源：标记命中 → 补给阶段不获得资源；不命中 → 正常', () => {
  const flagged = engineFixture('01001')
  flagged.scenario = { ...flagged.scenario, id: 'theDrownedQuarter' }
  flagged.campaign.ruleFlags = { tdcNoUpkeepResources: { appliesToScenarioIndex: flagged.campaign.scenarioIndex } }
  flagged.investigators[0].resources = 5
  engineMove(flagged, { action: 'endTurn' })
  engineSettle(flagged)
  assert.equal(flagged.investigators[0].resources, 5, '标记命中：补给阶段不获得资源')

  const normal = engineFixture('01001')
  normal.scenario = { ...normal.scenario, id: 'theDrownedQuarter' }
  normal.investigators[0].resources = 5
  engineMove(normal, { action: 'endTurn' })
  engineSettle(normal)
  assert.equal(normal.investigators[0].resources, 6, '不命中：正常获得 1 资源')
})

// ---------------------------------------------------------------------------
// 15. 海床地点 11542–11548（P7 第四轮：既有 api 接线）
// ---------------------------------------------------------------------------
const seaFloorPlaces = () => ([
  { id: 'acropolisEphemeral', code: '11542', originalCode: '11542', name: '淹没卫城·短暂遗迹', revealed: true,
    traits: ['Seafloor'], clues: 2, connections: ['acropolisCollapsed'] },
  { id: 'acropolisCollapsed', code: '11543', originalCode: '11543', name: '淹没卫城·崩塌遗迹', revealed: true,
    traits: ['Seafloor'], clues: 2, connections: ['acropolisEphemeral', 'blastedCircle'] },
  { id: 'blastedCircle', code: '11544', originalCode: '11544', name: '残破遗迹·沉没圆环', revealed: true,
    traits: ['Seafloor'], clues: 1, connections: ['acropolisCollapsed', 'blastedEdifices'] },
  { id: 'blastedEdifices', code: '11545', originalCode: '11545', name: '残破遗迹·崩毁建筑', revealed: true,
    traits: ['Seafloor'], clues: 1, connections: ['blastedCircle', 'coralGarden'] },
  { id: 'coralGarden', code: '11546', originalCode: '11546', name: '珊瑚礁·雕像花园', revealed: true,
    traits: ['Seafloor'], clues: 3, connections: ['blastedEdifices', 'coralFeeding'] },
  { id: 'coralFeeding', code: '11547', originalCode: '11547', name: '珊瑚礁·觅食地', revealed: true,
    traits: ['Seafloor'], clues: 3, connections: ['coralGarden', 'ancientGallery'] },
  { id: 'ancientGallery', code: '11548', originalCode: '11548', name: '古代展廊', revealed: true,
    traits: ['Seafloor'], clues: 3, connections: ['coralFeeding'] },
])
const seaFloorFixture = () => {
  const state = makeState(2)
  state.scenario = structuredClone(scenario)
  const api = makeApi(state)
  state.locations = seaFloorPlaces()
  for (const inv of state.investigators) inv.deck = Array(6).fill('01088')
  return { state, api }
}

test('P7 theDrownedQuarter 海床地点 11542–11545：回合结束强制（提高淹没或受恐惧/伤害）', () => {
  const { state, api } = seaFloorFixture()
  const inv = state.investigators[0]
  // 11542：能提高 → 提高自身；已满 → 受 1 点恐惧。
  inv.location = 'acropolisEphemeral'
  assert.equal(behavior.turnEnded(state, inv, api), true)
  assert.equal(floodLevelOf(state, 'acropolisEphemeral'), 1)
  changeFloodOf(state, 'acropolisEphemeral', 1, api)
  behavior.turnEnded(state, inv, api)
  assert.equal(inv.horror, 1, '11542 无法提高淹没时受 1 点恐惧')
  // 11543：能提高相邻 → 提高一处相邻；相邻都满 → 受 1 点伤害。
  inv.location = 'acropolisCollapsed'
  changeFloodOf(state, 'acropolisCollapsed', -1, api)
  changeFloodOf(state, 'blastedCircle', -1, api)
  behavior.turnEnded(state, inv, api)
  assert.equal(floodLevelOf(state, 'acropolisCollapsed') <= 1, true)
  assert.equal(floodLevelOf(state, 'acropolisEphemeral') + floodLevelOf(state, 'blastedCircle') > 0, true)
  changeFloodOf(state, 'acropolisEphemeral', 2, api)
  changeFloodOf(state, 'blastedCircle', 2, api)
  behavior.turnEnded(state, inv, api)
  assert.equal(inv.damage, 1, '11543 无相邻可提高时受 1 点伤害')
  // 11544/11545：回合结束提高自身。
  const edifices = state.investigators[1]
  edifices.location = 'blastedEdifices'
  behavior.turnEnded(state, edifices, api)
  assert.equal(floodLevelOf(state, 'blastedEdifices'), 1)
})

test('P7 theDrownedQuarter 海床地点 11542–11545 行动：提高自身淹没并降低目标淹没（团队 2 次 / 每轮 1 次 + 付费）', () => {
  const { state, api } = seaFloorFixture()
  const inv = state.investigators[0]
  inv.location = 'acropolisEphemeral'
  const move = { action: 'scenarioAction', rule: 'drownedQuarterAcropolisLowerFlood', locationId: 'acropolisEphemeral' }
  changeFloodOf(state, 'blastedCircle', 2, api)
  assert.equal(behavior.performAction(state, inv, move, api), true)
  assert.equal(floodLevelOf(state, 'acropolisEphemeral'), 1, '提高自身淹没')
  assert.equal(floodLevelOf(state, 'blastedCircle') < 2, true, '降低任意地点淹没')
  assert.equal(behavior.performAction(state, inv, move, api), true)
  assert.equal(state.scenarioFlags.drownedQuarterAcropolisLowerUses, 2)
  assert.equal(behavior.performAction(state, inv, move, api), false, '每场游戏团队限两次')
  // 11544：同地点调查员共同支付 5 资源；每轮限一次。
  inv.location = 'blastedCircle'
  inv.resources = 3
  state.investigators[1].location = 'blastedCircle'
  state.investigators[1].resources = 2
  const ruinMove = { action: 'scenarioAction', rule: 'drownedQuarterRuinsLowerFlood', locationId: 'blastedCircle' }
  changeFloodOf(state, 'acropolisCollapsed', 1, api)
  assert.equal(behavior.performAction(state, inv, ruinMove, api), true)
  assert.equal(inv.resources + state.investigators[1].resources, 0, '共同支付 5 资源')
  assert.equal(behavior.performAction(state, inv, ruinMove, api), false, '每轮团队限一次')
  state.round = 2
  assert.equal(behavior.performAction(state, inv, ruinMove, api), false, '资金不足仍不能使用')
  // 11545：共同弃合计 1[per_investigator] 张手牌。
  inv.location = 'blastedEdifices'
  inv.hand = ['a', 'b']
  state.investigators[1].location = 'blastedEdifices'
  state.investigators[1].hand = ['c']
  const handMove = { action: 'scenarioAction', rule: 'drownedQuarterRuinsLowerFlood', locationId: 'blastedEdifices' }
  changeFloodOf(state, 'coralGarden', 1, api)
  assert.equal(behavior.performAction(state, inv, handMove, api), true)
  assert.equal(inv.hand.length + state.investigators[1].hand.length, 1, '共弃 2 张手牌（1/人）')
})

test('P7 theDrownedQuarter 11546 雕像花园 / 11548 古代展廊：抽牌与资源 / 放一边遗物入场', () => {
  const { state, api } = seaFloorFixture()
  state.scenarioZones.setAside = [UNDESEA_PARASITE_CODE]
  const inv = state.investigators[0]
  inv.location = 'coralGarden'
  const garden = { action: 'scenarioAction', rule: 'drownedQuarterCoralGarden', locationId: 'coralGarden' }
  assert.equal(behavior.actions(state, inv).some(item => item.rule === 'drownedQuarterCoralGarden'), true)
  assert.equal(behavior.performAction(state, inv, garden, api), true)
  assert.equal(inv.hand.length, 2, '抽 2 张牌')
  assert.equal(inv.resources, 7, '获得 2 个资源')
  assert.equal(state.enemies.some(enemy => enemy.code === UNDESEA_PARASITE_CODE && enemy.location === 'coralGarden'), true)
  assert.equal(behavior.performAction(state, inv, garden, api), false, '每场游戏团队限一次')
  // 11548：弃 2 张手牌 → 放一边的黑曜石遗物入场由你控制。
  inv.location = 'ancientGallery'
  inv.hand = ['x', 'y']
  state.scenarioZones.setAside.push(OBSIDIAN_RELIC_CODE)
  const gallery = { action: 'scenarioAction', rule: 'drownedQuarterTakeObsidianRelic', locationId: 'ancientGallery' }
  assert.equal(behavior.performAction(state, inv, gallery, api), true)
  assert.equal(inv.hand.length, 0, '弃掉 2 张手牌')
  assert.equal(inv.assets.some(asset => asset.code === OBSIDIAN_RELIC_CODE), true, '黑曜石遗物由你控制')
  assert.equal(behavior.performAction(state, inv, gallery, api), false, '每场游戏团队限一次')
})

test('P7 theDrownedQuarter 11547 觅食地：揭示后弃到敌人生成 + 发现线索生成放一边寄生虫', () => {
  const { state, api } = seaFloorFixture()
  state.encounterDeck = ['01088', '01088', '11551'] // 顶部为末尾：先弃非敌人，再弃到敌人
  state.scenarioZones.setAside = [UNDESEA_PARASITE_CODE]
  const inv = state.investigators[0]
  inv.location = 'coralFeeding'
  const location = locationOf(state, 'coralFeeding')
  assert.equal(behavior.locationRevealed(state, location, api, 0), true)
  assert.equal(state.enemies.some(enemy => enemy.code === '11551' && enemy.location === 'coralFeeding'), true,
    '弃到敌人后生成在本地点')
  assert.equal(state.scenarioFlags['drownedQuarterCoralFeedingSpawned:coralFeeding'], true)
  // 再次揭示不重复生成。
  behavior.locationRevealed(state, location, api, 0)
  assert.equal(state.enemies.filter(enemy => enemy.code === '11551').length, 1)
  // [reaction] 发现线索后生成放一边的水下寄生虫。
  assert.equal(behavior.cluesGained(state, inv, 1, api), true)
  assert.equal(state.enemies.some(enemy => enemy.code === UNDESEA_PARASITE_CODE && enemy.location === 'coralFeeding'), true)
  assert.equal(state.scenarioZones.setAside.includes(UNDESEA_PARASITE_CODE), false)
  // 其他地点发现线索不触发。
  inv.location = 'coralGarden'
  assert.equal(behavior.cluesGained(state, inv, 1, api), false)
})

// ---------------------------------------------------------------------------
// 16. 11541 深渊沟壑 [reaction]：成功攻击/躲避后降低自身淹没（每场团队一次）
// ---------------------------------------------------------------------------
test('P7 theDrownedQuarter 11541 深渊沟壑：成功攻击或躲避后降低本地点淹没（每场团队一次）', () => {
  const { state, api } = seaFloorFixture()
  state.locations.push({
    id: 'abyssalTrench', code: '11541', originalCode: '11541', name: '深渊沟壑', revealed: true,
    traits: ['Seafloor'], clues: 1, connections: ['coralGarden'], shroud: 0,
  })
  const inv = state.investigators[0]
  inv.location = 'abyssalTrench'
  changeFloodOf(state, 'abyssalTrench', 1, api)
  assert.equal(behavior.enemyAttackedSuccessfully(state, inv, { id: 'e1' }, api), true)
  assert.equal(floodLevelOf(state, 'abyssalTrench'), 0, '成功攻击后降低淹没')
  assert.equal(state.scenarioFlags.drownedQuarterTrenchLowerUsed, true)
  // 每场团队一次：第二次（含躲避）不再触发。
  changeFloodOf(state, 'abyssalTrench', 1, api)
  assert.equal(behavior.enemyEvadedSuccessfully(state, inv, { id: 'e2' }, api), false)
  assert.equal(floodLevelOf(state, 'abyssalTrench'), 1)
  // 不在深渊沟壑时不触发。
  const other = seaFloorFixture()
  other.state.investigators[0].location = 'coralGarden'
  assert.equal(behavior.enemyAttackedSuccessfully(other.state, other.state.investigators[0], { id: 'e3' }, other.api), false)
})
