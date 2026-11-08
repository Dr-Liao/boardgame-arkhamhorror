// 亡命冰原 第 I 部分（iceAndDeathPart1 · 08501a）· 章节测试（P7 + P0 修复）。
//
// 证据分两层：
//   1. 章节数据/剧情：manifest/identities/locations/story-access 正文 + printed shroud；
//   2. 真实引擎路径（生产组合根 content/registered.js）：hub 建局 → legalMoves 出现剧本行动 →
//      applyMove 结算结局；advanceAgenda 结算议程 I–III 背面；入场费在揭示前收取；
//      chaos 标记走引擎 resolveSpecialToken；调查难度不再是 NaN。
// 不再用 api stub 直调 behavior.* 冒充真实路径。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registeredEntry } from '../src/engine/ability.js'
import * as chapter from '../content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/index.js'
import {
  ENCOUNTER_DECK, LOCATIONS, RAW_CODES, SCENARIO_TEXT, SET_ASIDE_ALIASES, UNCHARTED_ENTRY_COST,
  UNCHARTED_LOCATION_IDS, scenario,
} from '../content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/definition.js'
import { chapterStory, resolutionText, storyText } from '../content/campaigns/edgeOfTheEarth/story-access.js'
import { part1ChaosFailureSpec, part1ChaosTokenValue } from '../content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/chaos.js'
import {
  loadEoteWorld, openChapter, legalFor, decisionSeat, playMove, settleChoices, transact,
  saveAndRestore,
} from './eote-p8-fixture.mjs'

const world = await loadEoteWorld()
const SCENARIO_ID = 'iceAndDeathPart1'
const locationOf = (state, id) => state.locations.find(location => location.id === id)
const inScenario = () => openChapter(world, 0, { seats: 2, seed: 'p7-idp1', investigatorCodes: ['08001', '08004'] })

// ---------------------------------------------------------------------------
// 1. manifest / identities / 剧情正文
// ---------------------------------------------------------------------------
test('P7 iceAndDeathPart1 章节清单：development、08501、13 地点、3 议程 + 1 幕、遭遇组', () => {
  assert.equal(chapter.manifest.id, 'iceAndDeathPart1')
  assert.equal(chapter.manifest.campaignId, 'edgeOfTheEarth')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.referenceCode, '08501')
  assert.equal(chapter.manifest.locations.length, 13)
  assert.deepEqual(chapter.manifest.acts.map(act => act.id), ['act1'])
  assert.deepEqual(chapter.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2', 'agenda3'])
  assert.deepEqual(chapter.manifest.resolutionIds, ['noResolution', 'resolution1'])
  assert.equal(chapter.manifest.startLocationId, 'crashSite')
  for (const group of chapter.manifest.requiredEncounterGroupIds) assert.match(group, /^[a-z][A-Za-z0-9]*$/)
  assert.ok(chapter.manifest.requiredMechanicIds.includes('eoteFrost'))
  assert.ok(chapter.manifest.requiredMechanicIds.includes('eoteTekeliDeck'))
  assert.ok(chapter.manifest.requiredMechanicIds.includes('eoteShelter'))
  assert.equal(chapter.scenario.textLanguage, 'zh-CN')
})

test('P7 iceAndDeathPart1 剧情正文：story-access 的 setup/resolution 可读且已接入 definition', () => {
  const story = chapterStory('iceAndDeathPart1')
  assert.ok(story.sectionCount >= 20, `章节 sections 过少：${story.sectionCount}`)
  assert.ok(storyText('iceAndDeathPart1', 'setup').length > 0, 'setup 正文为空')
  assert.ok(storyText('iceAndDeathPart1', 'resolutions').length > 0, 'resolutions 正文为空')
  assert.ok(resolutionText('iceAndDeathPart1', 'resolution1'), 'resolution1 正文缺失')
  assert.ok(SCENARIO_TEXT.setup.length > 0, 'definition 未接入 setup 正文')
  assert.ok(SCENARIO_TEXT.resolutions.resolution1.length > 0, 'definition 未接入 resolution1 正文')
  assert.ok(scenario.intro.length > 0, 'intro 为空')
})

test('P7 iceAndDeathPart1 身份登记：13 地点 + 幕/议程均有印刷原卡', () => {
  for (const category of ['locations', 'acts', 'agendas']) {
    for (const [id, identity] of Object.entries(chapter.identities[category] || {})) {
      assert.ok(identity.originalCode, `${category}/${id} 缺 originalCode`)
    }
  }
  assert.equal(chapter.identities.locations.crashSite.originalCode, '08502')
  assert.equal(chapter.identities.locations.crystallineCavern.originalCode, '08514')
  assert.equal(chapter.identities.acts.act1.originalCode, '08521')
  assert.equal(chapter.identities.agendas.agenda3.originalCode, '08520')
})

// ---------------------------------------------------------------------------
// 2. 地点数据（含 P0-4：印刷 shroud 进入运行期地点）
// ---------------------------------------------------------------------------
test('P7 iceAndDeathPart1 地点：庇护值/符号/线索/连接与印刷 shroud', () => {
  const broad = LOCATIONS.broadSnowdrifts
  assert.equal(broad.shelter, 4)
  assert.equal(broad.cluesPerInvestigator, 2)
  assert.equal(broad.shroud, 1, 'card-data 必须复制印刷 shroud')
  assert.equal(LOCATIONS.crystallineCavern.shelter, 8)
  assert.equal(LOCATIONS.crystallineCavern.cluesPerInvestigator, 3)
  assert.equal(UNCHARTED_ENTRY_COST.barrierCamp, 4)
  assert.equal(UNCHARTED_LOCATION_IDS.length, 9)
  assert.equal(SET_ASIDE_ALIASES.length, 11)
  assert.ok(LOCATIONS.crashSite.connections.includes('frozenShores'))
})

test('P7 iceAndDeathPart1 遭遇牌库构成：ENCOUNTER_DECK 与 definition 一致且不含剧情/议程卡', () => {
  assert.equal(ENCOUNTER_DECK.length, 20, '基础 gather 的敌人/诡计印刷展开 = 20')
  assert.ok(ENCOUNTER_DECK.includes('08516'))
  assert.ok(ENCOUNTER_DECK.includes('08517'))
  assert.equal(ENCOUNTER_DECK.includes('08518'), false)
  assert.equal(ENCOUNTER_DECK.includes('08522'), false)
  assert.equal(LOCATIONS.crashSite.originalCode, '08502')
})

// ---------------------------------------------------------------------------
// 3. 真实引擎路径：setup / 入口费 / 调查难度
// ---------------------------------------------------------------------------
test('P0-4 真实 setup：4 地点入场、帷幕为有限数值、调查难度不再是 NaN', () => {
  const state = inScenario()
  assert.equal(state.scenario.id, SCENARIO_ID)
  const ids = state.locations.map(location => location.id).sort()
  assert.deepEqual(ids, ['crashSite', 'frozenShores', 'precariousIceSheet', 'treacherousPath'])
  for (const location of state.locations) {
    assert.ok(Number.isFinite(location.shroud), `${location.id} shroud 非数值：${location.shroud}`)
  }
  assert.equal(locationOf(state, 'frozenShores').shroud, 2)
  const seat = decisionSeat(world, state)
  const moveToShores = legalFor(world, state, seat)
    .find(move => move.action === 'move' && move.locationId === 'frozenShores')
  assert.ok(moveToShores, '应能移动到已揭示的冰冻海岸')
  playMove(world, state, moveToShores, seat)
  settleChoices(world, state)
  const seat2 = decisionSeat(world, state)
  const investigate = legalFor(world, state, seat2).find(move => move.action === 'investigate')
  assert.ok(investigate, '应能调查')
  assert.match(investigate.label, /帷幕 \d+/)
  playMove(world, state, investigate, seat2)
  assert.ok(Number.isFinite(state.skillTest?.difficulty), `调查难度 NaN：${state.skillTest?.difficulty}`)
  settleChoices(world, state)
})

test('P0-4 未探索地点入场费：线索不足不可进入；揭示前共同花费并揭示', () => {
  const state = inScenario()
  const seat = decisionSeat(world, state)
  playMove(world, state, legalFor(world, state, seat)
    .find(move => move.action === 'move' && move.locationId === 'frozenShores'), seat)
  settleChoices(world, state)
  const broad = locationOf(state, 'broadSnowdrifts')
  assert.ok(broad, '议程 I 正面强制应把相连地点（辽阔雪地）放置入场')
  assert.equal(broad.revealed, false)
  const seat2 = decisionSeat(world, state)
  assert.equal(legalFor(world, state, seat2)
    .some(move => move.action === 'move' && move.locationId === 'broadSnowdrifts'), false,
  '线索不足时未探索地点不应出现在 legalMoves')
  state.investigators[seat2].clues = 2 // 1[per_investigator] × 2 名调查员
  const seat3 = decisionSeat(world, state)
  const intoBroad = legalFor(world, state, seat3)
    .find(move => move.action === 'move' && move.locationId === 'broadSnowdrifts')
  assert.ok(intoBroad, '线索足够时应可进入')
  playMove(world, state, intoBroad, seat3)
  settleChoices(world, state)
  const entered = locationOf(state, 'broadSnowdrifts')
  assert.equal(state.investigators[seat3].clues, 0, '应共同花费 2 个线索')
  assert.equal(entered.revealed, true, '进入后应揭示')
  assert.equal(entered.clues, 4, '揭示后按 2 线索/调查员 × 2 放置')
})

// ---------------------------------------------------------------------------
// 4. P0-1/P0-2 真实引擎路径：剧本行动 → 幕目标 → 结局
// ---------------------------------------------------------------------------
test('P0-1 剧本行动进入 legalMoves：campResign 真实提交后结算结局 1 并写记录', () => {
  const state = inScenario()
  const seat = decisionSeat(world, state)
  const resign = legalFor(world, state, seat)
    .find(move => move.action === 'scenarioAction' && move.rule === 'campResign')
  assert.ok(resign, `legalMoves 缺 campResign：${legalFor(world, state, seat).map(move => move.action).join(',')}`)
  playMove(world, state, resign, seat)
  settleChoices(world, state)
  assert.equal(state.uiState, 'scenarioResult')
  assert.equal(state.campaign.records.iceAndDeathPart1Resolution, 'resolution1')
  assert.equal(state.campaign.scenarioResults.at(-1).resolution, 'resolution1')
  assert.ok(state.investigators.every(inv => inv.resigned))
  const campKey = Object.keys(state.campaign.records)
    .find(key => key.startsWith('camp') && key !== 'camp' && state.campaign.records[key] === true)
  assert.ok(campKey, '检查点 I 读的 Camp_* 记录必须写入')
  assert.ok(Number.isSafeInteger(state.campaign.records.eoteShelterValue), '检查点 I 庇护值快照')
  // 存档往返（真实存档路径）。
  const restored = saveAndRestore(world, state)
  assert.equal(restored.state.campaign.records.iceAndDeathPart1Resolution, 'resolution1')
  assert.equal(JSON.stringify(restored.state).includes('function'), false)
})

test('P0-2 议程 I–III 背面经真实 advanceAgenda 结算：生成疾行谬物/星之恐怖并收束到结局 1', () => {
  const state = inScenario()
  transact(world, state, draft => world.engine.advanceAgenda(draft, [], 'doom'), () => null)
  assert.equal(state.agendaIndex, 1)
  assert.ok(state.enemies.some(enemy => (enemy.originalCode || enemy.code) === RAW_CODES.skitteringNonsense),
    '议程 1 背面应生成疾行谬物')
  transact(world, state, draft => world.engine.advanceAgenda(draft, [], 'doom'), () => null)
  assert.equal(state.agendaIndex, 2)
  assert.ok(state.enemies.some(enemy => (enemy.originalCode || enemy.code) === RAW_CODES.terrorOfTheStars),
    '议程 2 背面应生成星之恐怖')
  transact(world, state, draft => world.engine.advanceAgenda(draft, [], 'doom'), () => null)
  assert.equal(state.campaign.records.iceAndDeathPart1Resolution, 'resolution1')
  assert.ok(Number.isSafeInteger(state.campaign.records.iceAndDeathPart1CampShelter))
  assert.equal(state.campaign.scenarioResults.at(-1).resolution, 'resolution1')
})

// ---------------------------------------------------------------------------
// 5. P0-3 混乱标记：走引擎真实 resolveSpecialToken / 纯数据口径
// ---------------------------------------------------------------------------
test('P0-3 混乱标记：引擎 resolveSpecialToken 结算 [skull]/[cultist]/[tablet] 数值', () => {
  const state = inScenario()
  const inv = state.investigators[0]
  inv.location = 'frozenShores' // 印刷庇护值 2
  const skull = world.engine.resolveSpecialToken(state, inv.seat, inv, 'skull', [])
  assert.equal(skull.delta, 1, '[skull] 简单/普通 = ceil(2/2)')
  assert.equal(world.engine.resolveSpecialToken(state, inv.seat, inv, 'cultist', []).delta, -2)
  assert.equal(world.engine.resolveSpecialToken(state, inv.seat, inv, 'tablet', []).delta, -3)
})

test('P0-3 混乱标记纯数据口径：困难/专家 [skull] 全额、[tablet] -4、失败后果', () => {
  const state = {
    difficulty: 'hard', numInvestigators: 2, investigators: [{ seat: 0, location: 'broadSnowdrifts' }],
    locations: [{ id: 'broadSnowdrifts', shelter: 4, revealed: true }],
    scenarioFlags: { mechanics: { eote: { shelter: { camp: 'broadSnowdrifts' } } } },
  }
  assert.equal(part1ChaosTokenValue(state, 'skull', state.investigators[0]), 4)
  assert.equal(part1ChaosTokenValue(state, 'tablet', state.investigators[0]), -4)
  assert.deepEqual(part1ChaosFailureSpec(state, 'cultist', 2), { token: 'cultist', kind: 'tekelili', count: 2 })
  assert.deepEqual(part1ChaosFailureSpec(state, 'tablet', 3), { token: 'tablet', kind: 'discardTop', count: 3 })
})

// ---------------------------------------------------------------------------
// 6. 单卡条目数据 + 结局 JSON
// ---------------------------------------------------------------------------
test('P7 iceAndDeathPart1 单卡条目：theCrash 5 张均已注册并声明引擎读点数据', () => {
  const codes = ['08518', '08519', '08520', '08521', '08522']
  assert.deepEqual(chapter.implementedEncounterCodes, codes)
  for (const code of codes) {
    assert.ok(registeredEntry(code), `${code} 未注册`)
  }
  assert.equal(registeredEntry('08518').agendaRule.chapterFlow, 'coldWelcome')
  assert.equal(registeredEntry('08519').agendaRule.onAdvance, 'resolveIntoTheWhiteBack')
  assert.equal(registeredEntry('08520').agendaRule.chapterFlow, 'runningOutOfTime')
  assert.equal(registeredEntry('08521').actRule.objective.type, 'resign')
  assert.equal(registeredEntry('08522').enemyScript.healthPerInvestigator, 3)
})
