// 亡命冰原 第 II 部分（iceAndDeathPart2 · 08501b）· 章节测试（P7 + P0 修复）。
//
// 证据分两层：
//   1. 章节数据/剧情：manifest/identities/locations/story-access 正文 + setup 底牌/牌库数据；
//   2. 真实引擎路径（生产组合根 content/registered.js）：hub 建局 → legalMoves 出现剧本行动（抽底牌/营地撤退）
//      → applyMove 结算；advanceAgenda 结算议程 4–6 背面并收束到结局 1；chaos 标记走引擎 read point。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registeredEntry } from '../src/engine/ability.js'
import * as chapter from '../content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/index.js'
import {
  ENCOUNTER_DECK, LOCATIONS, POSSESSED_ENEMY_CODES, POSSESSED_PARTNERS, RAW_CODES,
  SCENARIO_TEXT, STORY_CODES, scenario,
} from '../content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/definition.js'
import { chapterStory, resolutionText, storyText } from '../content/campaigns/edgeOfTheEarth/story-access.js'
import { part2ChaosTokenValue } from '../content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/chaos.js'
import {
  loadEoteWorld, openChapter, legalFor, decisionSeat, playMove, settleChoices, transact,
} from './eote-p8-fixture.mjs'

const world = await loadEoteWorld()
const SCENARIO_ID = 'iceAndDeathPart2'
const locationOf = (state, id) => state.locations.find(location => location.id === id)
const inScenario = () => openChapter(world, 1, { seats: 2, seed: 'p7-idp2', investigatorCodes: ['08001', '08004'] })

// ---------------------------------------------------------------------------
// 1. manifest / identities / 剧情正文
// ---------------------------------------------------------------------------
test('P7 iceAndDeathPart2 章节清单：development、08501、13 地点、3 议程 + 1 幕、lostInTheNight', () => {
  assert.equal(chapter.manifest.id, 'iceAndDeathPart2')
  assert.equal(chapter.manifest.campaignId, 'edgeOfTheEarth')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.referenceCode, '08501')
  assert.equal(chapter.manifest.locations.length, 13)
  assert.deepEqual(chapter.manifest.acts.map(act => act.id), ['act1'])
  assert.deepEqual(chapter.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2', 'agenda3'])
  assert.deepEqual(chapter.manifest.resolutionIds, ['noResolution', 'resolution1'])
  assert.ok(chapter.manifest.requiredEncounterGroupIds.includes('lostInTheNight'))
  assert.ok(chapter.manifest.requiredMechanicIds.includes('eotePartners'))
  assert.equal(SCENARIO_TEXT.textLanguage, 'zh-CN')
})

test('P7 iceAndDeathPart2 剧情正文：story-access 的 setup/resolution 可读且已接入 definition', () => {
  const story = chapterStory('iceAndDeathPart2')
  assert.ok(story.sectionCount >= 20, `章节 sections 过少：${story.sectionCount}`)
  assert.ok(storyText('iceAndDeathPart2', 'setup').length > 0, 'setup 正文为空')
  assert.ok(storyText('iceAndDeathPart2', 'resolutions').length > 0, 'resolutions 正文为空')
  assert.ok(resolutionText('iceAndDeathPart2', 'resolution1'), 'resolution1 正文缺失')
  assert.ok(SCENARIO_TEXT.setup.length > 0, 'definition 未接入 setup 正文')
  assert.ok(SCENARIO_TEXT.resolutions.resolution1.length > 0)
  assert.ok(scenario.intro.length > 0)
})

test('P7 iceAndDeathPart2 地点：与第 I 部分同一张冰原地图（庇护值/线索/帷幕/连接）', () => {
  assert.equal(LOCATIONS.broadSnowdrifts.shelter, 4)
  assert.equal(LOCATIONS.broadSnowdrifts.cluesPerInvestigator, 2)
  assert.equal(LOCATIONS.broadSnowdrifts.shroud, 1, 'card-data 必须复制印刷 shroud')
  assert.equal(LOCATIONS.crashSite.shelter, 0)
  assert.ok(LOCATIONS.crashSite.connections.includes('frozenShores'))
  assert.equal(LOCATIONS.snowGraves.shelter, 5)
  assert.equal(Object.keys(LOCATIONS).length, 13)
})

// ---------------------------------------------------------------------------
// 2. 真实引擎路径：setup（13 地点 / 9 张底牌 / 遭遇牌库）
// ---------------------------------------------------------------------------
test('P0 真实 setup：13 地点、9 张（Mia 队员+剧情）压在未探索地点下、营地继承', () => {
  const state = inScenario()
  assert.equal(state.scenario.id, SCENARIO_ID)
  assert.equal(state.locations.length, 13)
  const hosts = state.locations.filter(location => (location.beneath || []).length)
  assert.equal(hosts.length, 9, '9 张底牌应压到 9 个未探索地点下')
  assert.ok(hosts.every(location => location.beneath.length === 1 && location.beneathFaceDown[0] === true))
  assert.equal(state.encounterDeck.length, ENCOUNTER_DECK.length + 3, '遭遇牌库 = gather + 远古恶魔 ×3')
  assert.equal(state.encounterDeck.includes('08535'), false, '被附身队员不在遭遇牌库')
  assert.equal(state.scenarioFlags.camp, state.investigators[0].location)
  for (const location of state.locations) assert.ok(Number.isFinite(location.shroud), `${location.id} shroud`)
})

// ---------------------------------------------------------------------------
// 3. P0-1 剧本行动（真实 applyMove）
// ---------------------------------------------------------------------------
test('P0-1 legalMoves 含营地撤退：[action] 真实提交后结算结局 1 并写伙伴记录', () => {
  const state = inScenario()
  const seat = decisionSeat(world, state)
  const resign = legalFor(world, state, seat)
    .find(move => move.action === 'scenarioAction' && move.rule === 'campResign')
  assert.ok(resign, `legalMoves 缺 campResign：${legalFor(world, state, seat).map(move => move.action).join(',')}`)
  playMove(world, state, resign, seat)
  settleChoices(world, state)
  assert.equal(state.uiState, 'scenarioResult')
  assert.equal(state.campaign.records.iceAndDeathPart2Resolution, 'resolution1')
  assert.equal(state.campaign.scenarioResults.at(-1).resolution, 'resolution1')
  assert.ok(state.investigators.every(inv => inv.resigned))
})

test('P0-1 [fast] 抽取地点底下遭遇卡：真实移动+applyMove，共同花费线索并结算底牌', () => {
  const state = inScenario()
  // BFS：从营地沿真实连接走到一个「底下压着遭遇卡」的地点（最多 2 步，落在 3 行动预算内）。
  const pathTo = (fromId, toId) => {
    const queue = [[fromId, []]]
    const seen = new Set([fromId])
    while (queue.length) {
      const [id, path] = queue.shift()
      const location = locationOf(state, id)
      for (const next of location?.connections || []) {
        if (seen.has(next)) continue
        if (next === toId) return [...path, next]
        seen.add(next)
        queue.push([next, [...path, next]])
      }
    }
    return null
  }
  const camp = state.investigators[0].location
  const hosts = state.locations.filter(location => (location.beneath || []).length)
  const target = hosts.find(location => pathTo(camp, location.id)?.length <= 2)
  assert.ok(target, '应有一个 2 步内可达的底牌地点')
  const path = pathTo(camp, target.id)
  assert.ok(path && path.length >= 1)
  for (const stepId of path) {
    const stepSeat = decisionSeat(world, state)
    const step = legalFor(world, state, stepSeat)
      .find(move => move.action === 'move' && move.locationId === stepId)
    assert.ok(step, `应能移动到 ${stepId}`)
    playMove(world, state, step, stepSeat)
    settleChoices(world, state)
  }
  const host = locationOf(state, target.id)
  assert.ok((host.beneath || []).length > 0)
  for (const inv of state.investigators) if (inv.location === host.id) inv.clues = 2
  const seat3 = decisionSeat(world, state)
  const draw = legalFor(world, state, seat3)
    .find(move => move.action === 'scenarioAction' && move.rule === 'drawUnderLocation')
  assert.ok(draw, `legalMoves 缺 drawUnderLocation：${legalFor(world, state, seat3).map(move => move.action).join(',')}`)
  const hostId = host.id
  const beneathBefore = host.beneath.length
  playMove(world, state, draw, seat3)
  settleChoices(world, state)
  // 事务会用 draft 重建 state（地点对象换新），必须按 id 重新取。
  const hostAfter = locationOf(state, hostId)
  assert.equal(hostAfter.beneath.length, beneathBefore - 1)
  assert.equal(state.investigators.reduce((sum, inv) => sum + inv.clues, 0), 0, '共同花费 2 线索')
})

// ---------------------------------------------------------------------------
// 4. P0-2 议程背面（真实 advanceAgenda）
// ---------------------------------------------------------------------------
test('P0-2 议程 4–6 背面经真实 advanceAgenda 结算：查看底牌 ×2，疯狂与死亡收束到结局 1', () => {
  const state = inScenario()
  const select = choice => choice.options[0]?.id
  transact(world, state, draft => world.engine.advanceAgenda(draft, [], 'doom'), select)
  assert.equal(state.agendaIndex, 1)
  assert.ok(state.scenarioFlags.lookedAt?.code, '议程 4 背面应查看一张底牌')
  assert.ok(locationOf(state, state.scenarioFlags.lookedAt.locationId).beneathFaceDown[0] === true,
    '查看后放回正面朝下')
  transact(world, state, draft => world.engine.advanceAgenda(draft, [], 'doom'), select)
  assert.equal(state.agendaIndex, 2)
  transact(world, state, draft => world.engine.advanceAgenda(draft, [], 'doom'), select)
  assert.ok(state.investigators.every(inv => inv.defeated), '疯狂与死亡：剩余调查员全部被击败')
  assert.equal(state.campaign.records.iceAndDeathPart2Resolution, 'resolution1')
  assert.equal(state.campaign.scenarioResults.at(-1).resolution, 'resolution1')
})

// ---------------------------------------------------------------------------
// 5. P0-3 混乱标记 / 失败后果（引擎读点）
// ---------------------------------------------------------------------------
test('P0-3 混乱标记：引擎 resolveSpecialToken 结算 [skull]/[cultist]/[tablet]', () => {
  const state = inScenario()
  const inv = state.investigators[0]
  inv.location = 'frozenShores' // 庇护值 2
  assert.equal(world.engine.resolveSpecialToken(state, inv.seat, inv, 'skull', []).delta, 1)
  assert.equal(world.engine.resolveSpecialToken(state, inv.seat, inv, 'cultist', []).delta, -2)
  assert.equal(world.engine.resolveSpecialToken(state, inv.seat, inv, 'tablet', []).delta, -3)
  state.difficulty = 'expert'
  assert.equal(world.engine.resolveSpecialToken(state, inv.seat, inv, 'skull', []).delta, 2)
  assert.equal(world.engine.resolveSpecialToken(state, inv.seat, inv, 'tablet', []).delta, -4)
})

test('P0-3 [tablet] 失败后果：真实 performTest 弃牌库顶', () => {
  const state = inScenario()
  const seat = state.investigators[0].seat
  state.chaosBag = ['tablet']
  const discardBefore = state.investigators[seat].discard.length
  transact(world, state, draft => {
    world.engine.performTest(draft, seat, 'intellect', 100, { resolve: () => {} })
  }, () => null)
  // 事务会按 draft 重建 state：调查员对象换新，按 seat 重新取。
  assert.ok(state.investigators[seat].discard.length > discardBefore, 'tablet 失败应弃掉牌库顶')
})

test('P7 iceAndDeathPart2 混沌标记纯数据口径：数值表与第 I 部分一致', () => {
  const state = {
    difficulty: 'standard', numInvestigators: 2, investigators: [{ seat: 0, location: 'barrierCamp' }],
    locations: [{ id: 'barrierCamp', shelter: 7, revealed: true }],
  }
  assert.equal(part2ChaosTokenValue(state, 'skull', state.investigators[0]), 4)
  assert.equal(part2ChaosTokenValue(state, 'cultist', state.investigators[0]), -2)
  state.difficulty = 'expert'
  assert.equal(part2ChaosTokenValue(state, 'skull', state.investigators[0]), 7)
  assert.equal(part2ChaosTokenValue(state, 'tablet', state.investigators[0]), -4)
})

// ---------------------------------------------------------------------------
// 6. 单卡条目数据 + 遭遇牌库数据
// ---------------------------------------------------------------------------
test('P7 iceAndDeathPart2 逐卡覆盖：lostInTheNight 组 21 张全部注册且声明引擎读点', () => {
  assert.equal(chapter.implementedEncounterCodes.length, 21)
  for (const code of chapter.implementedEncounterCodes) {
    assert.ok(registeredEntry(code), `${code} 未注册`)
  }
  for (const code of STORY_CODES) assert.ok(registeredEntry(code).flags.storyEffect, `${code} 缺剧情效果`)
  for (const code of POSSESSED_ENEMY_CODES) {
    assert.ok(registeredEntry(code).enemyScript.negotiation, `${code} 缺谈判配置`)
    assert.ok(registeredEntry(code).abilities.some(ability => ability.actionKind === 'parley'))
  }
  assert.equal(registeredEntry('08526').actRule.freeAction.rule, 'drawUnderLocation')
})

test('P7 iceAndDeathPart2 身份登记：9 名被附身队员 + 8 张剧情卡均有印刷原卡', () => {
  for (const enemy of POSSESSED_ENEMY_CODES) {
    assert.ok(chapter.identities.enemies[enemy], `缺身份 ${enemy}`)
    assert.equal(chapter.identities.enemies[enemy].originalCode, enemy)
  }
  for (const story of STORY_CODES) assert.ok(chapter.identities.storyAssets[story], `缺剧情身份 ${story}`)
  assert.equal(chapter.identities.locations.remnantsOfLakesCamp.originalCode, '08513')
  assert.equal(POSSESSED_PARTNERS.length, 9)
  assert.equal(ENCOUNTER_DECK.length + 3, 32, 'gather 敌人/诡计印刷展开 29 + 远古恶魔 ×3 = 32')
  assert.equal(SCENARIO_TEXT.textStatus, 'translated (self-translated)')
  assert.equal(RAW_CODES.agendaMadnessAndDeath, '08525')
})
