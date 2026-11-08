// 亡命冰原 III（iceAndDeathPart3）章节测试（P7 + P0 修复）。
//
// 证据分两层：
//   1. 章节数据/剧情：manifest/identities/locations/story-access 正文 + 印刷地点数据（shroud/shelter/clues）；
//   2. 真实引擎路径（生产组合根 content/registered.js）：hub 建局 → legalMoves 出现营地撤退（共同花 4 线索）
//      → applyMove 结算结局 2；advanceAgenda 结算议程 7 强制拦截/背面、议程 8 背面；
//      advanceAct 结算幕 3 背面（结局 1/2）；chaos 标记与失败后果走引擎 read point。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registeredEntry } from '../src/engine/ability.js'
import * as chapter from '../content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/index.js'
import {
  CAMPS, EIDOLON_ENEMY_CODES, ENCOUNTER_DECK, LOCATIONS, RAW_CODES, SEEDING_NIGHTMARE_CODE,
  SEEDING_NIGHTMARE_COPIES, scenario,
} from '../content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/definition.js'
import { part3ChaosFailureSpec, part3ChaosTokenValue } from '../content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/chaos.js'
import {
  chapterStory, storyText, flattenStory, resolutionText,
} from '../content/campaigns/edgeOfTheEarth/story-access.js'
import {
  loadEoteWorld, createHubGame, hubSetup, finishScenario, continueFromResult, beginChapter,
  legalFor, decisionSeat, playMove, settleChoices, transact, saveAndRestore,
} from './eote-p8-fixture.mjs'

const world = await loadEoteWorld()
const SCENARIO_ID = 'iceAndDeathPart3'
const locationOf = (state, id) => state.locations.find(location => location.id === id)

// 检查点 II 选择「留下战斗」才能进入第 III 部分（fixture 的 openChapter 默认选第一项=逃跑）。
function inScenario(options = {}) {
  const state = createHubGame(world, {
    seats: 2, seed: 'p7-idp3', investigatorCodes: ['08001', '08004'], ...options,
  })
  hubSetup(world, state, { investigatorCodes: ['08001', '08004'] })
  for (let current = 0; current < 2; current++) {
    assert.equal(state.scenario.id, ['iceAndDeathPart1', 'iceAndDeathPart2'][current])
    finishScenario(world, state, 'resolution1')
    continueFromResult(world, state, {
      upgrades: false,
      storySelect: choice => (choice.options.some(option => option.id === 'stand') ? 'stand' : null),
    })
    beginChapter(world, state)
  }
  assert.equal(state.scenario.id, SCENARIO_ID)
  return state
}

// ---------------------------------------------------------------------------
// 1. 章节结构 / 剧情 / 地点数据
// ---------------------------------------------------------------------------
test('P7 iceAndDeathPart3 章节结构与 story-access 正文（结局键 resolution1/2）', () => {
  assert.equal(chapter.scenario.id, 'iceAndDeathPart3')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.campaignId, 'edgeOfTheEarth')
  assert.equal(Object.keys(scenario.locations).length, 13)
  assert.equal(chapter.layout.edges.length, 36)
  assert.deepEqual(scenario.acts.map(act => act.originalCode), ['08546'])
  assert.deepEqual(scenario.agendas.map(agenda => agenda.originalCode).sort(), ['08544', '08545'].sort())
  assert.deepEqual(Object.keys(scenario.resolutions), ['noResolution', 'resolution1', 'resolution2'])
  const story = chapterStory('iceAndDeathPart3')
  assert.equal(story.sectionCount, 31)
  assert.ok(storyText('iceAndDeathPart3', 'setup').length > 0, 'story-access setup 正文可读')
  assert.ok((resolutionText('iceAndDeathPart3', 'resolution1') || '').length > 0, '结局 1 正文可读')
  assert.ok((resolutionText('iceAndDeathPart3', 'resolution2') || '').length > 0, '结局 2 正文可读')
  assert.equal(scenario.setup, flattenStory(chapterStory('iceAndDeathPart3').sections.setup))
  assert.equal(chapter.implementedEncounterCodes.length, 5)
})

test('P0-4 地点数据：13 地点带印刷 shroud/shelter/线索；营地候选覆盖全部地点', () => {
  for (const [id, location] of Object.entries(LOCATIONS)) {
    assert.ok(Number.isFinite(location.shroud), `${id} shroud`)
    assert.ok(Number.isInteger(location.shelter), `${id} shelter`)
  }
  assert.equal(LOCATIONS.broadSnowdrifts.shroud, 1)
  assert.equal(LOCATIONS.broadSnowdrifts.shelter, 4)
  assert.equal(LOCATIONS.broadSnowdrifts.cluesPerInvestigator, 2)
  assert.equal(LOCATIONS.crystallineCavern.shelter, 8)
  assert.equal(CAMPS.length, 13, '营地记录可能落在任意冰原地点')
})

test('P0-4 遭遇牌库：22 张 gather（排除幻灵/渗出梦魇/忒咳哩-哩弱点组）+ 远古恶魔 ×3，8 张幻灵压在渗出梦魇下', () => {
  assert.equal(ENCOUNTER_DECK.length, 22)
  assert.equal(scenario.encounterDeck.filter(code => code === '01166').length, 3, '远古恶魔 ×3')
  assert.equal(EIDOLON_ENEMY_CODES.length, 8, '印刷幻灵 = 疾行谬物×3 + 冰中幻灵×5')
  assert.equal(EIDOLON_ENEMY_CODES.filter(code => code === '08515').length, 3)
  assert.equal(ENCOUNTER_DECK.includes(RAW_CODES.seepingNightmare), false)
  assert.equal(ENCOUNTER_DECK.some(code => code.startsWith('0872')), false, '忒咳哩-哩弱点不混入遭遇牌库')
  assert.equal(ENCOUNTER_DECK.includes('08515'), false, '幻灵敌人压在渗出梦魇底下')
  assert.equal(SEEDING_NIGHTMARE_CODE, RAW_CODES.seepingNightmare)
  assert.equal(SEEDING_NIGHTMARE_COPIES, 4)
})

// ---------------------------------------------------------------------------
// 2. 真实引擎路径：setup
// ---------------------------------------------------------------------------
test('P0 真实 setup：营地、已揭示地点带线索、每调查员 1 张渗出梦魇、8 张幻灵均分压底', () => {
  const state = inScenario()
  assert.equal(state.scenario.id, SCENARIO_ID)
  assert.equal(state.locations.length, 13)
  const camp = state.scenarioFlags.camp
  assert.ok(locationOf(state, camp), '营地必须在地点表内')
  const campLocation = locationOf(state, camp)
  assert.equal(campLocation.revealed, true)
  assert.equal(campLocation.clues, 0, '营地开局无线索')
  const nightmares = state.enemies.filter(enemy => (enemy.originalCode || enemy.code) === RAW_CODES.seepingNightmare)
  assert.equal(nightmares.length, 2, '每调查员 1 张渗出梦魇')
  const beneath = nightmares.reduce((sum, enemy) => sum + (enemy.beneath || []).length, 0)
  assert.equal(beneath, 8, '8 张幻灵均分压在渗出梦魇下')
  assert.ok(nightmares.every(enemy => enemy.beneathFaceDown.every(Boolean)))
  for (const inv of state.investigators) assert.equal(inv.location, camp)
  for (const location of state.locations) assert.ok(Number.isFinite(location.shroud))
})

// ---------------------------------------------------------------------------
// 3. P0-1 剧本行动（真实 applyMove）：营地共同花 4 线索撤退 → 结局 2
// ---------------------------------------------------------------------------
test('P0-1 legalMoves 含营地撤退：[action] 真实提交（共同花 4 线索）结算结局 2', () => {
  const state = inScenario()
  const camp = state.scenarioFlags.camp
  const group = state.investigators.filter(inv => inv.location === camp)
  for (const inv of group) inv.clues = 2 // 2 人 × 2 = 4 线索
  const seat = decisionSeat(world, state)
  const resign = legalFor(world, state, seat)
    .find(move => move.action === 'scenarioAction' && move.rule === 'campResign')
  assert.ok(resign, `legalMoves 缺 campResign：${legalFor(world, state, seat).map(move => move.action).join(',')}`)
  playMove(world, state, resign, seat)
  settleChoices(world, state)
  assert.equal(state.uiState, 'scenarioResult')
  assert.equal(state.campaign.records.iceAndDeathPart3Resolution, 'resolution2')
  assert.equal(state.campaign.records.theTeamFledToTheMountains, true)
  assert.equal(state.campaign.scenarioResults.at(-1).resolution, 'resolution2')
  assert.ok(state.investigators.every(inv => inv.resigned))
})

// ---------------------------------------------------------------------------
// 4. P0-2 议程/幕 reveal（真实 advanceAgenda/advanceAct）
// ---------------------------------------------------------------------------
test('P0-2 议程 7 强制：底下有卡时阻止推进、移除 2 毁灭并真实生成 1 张底牌', () => {
  const state = inScenario()
  state.doom = 5
  const enemiesBefore = state.enemies.length
  const host = state.enemies.find(enemy => (enemy.beneath || []).length)
  const hostId = host.id
  const beneathBefore = host.beneath.length
  transact(world, state, draft => world.engine.advanceAgenda(draft, [], 'doom'), () => null)
  // 事务按 draft 重建 state：敌人对象已换新，按 id 重新取。
  const hostAfter = state.enemies.find(enemy => enemy.id === hostId)
  assert.equal(state.agendaIndex, 0, '有底牌时不得推进')
  assert.equal(state.doom, 3, '移除 2 点毁灭')
  assert.equal(hostAfter.beneath.length, beneathBefore - 1)
  assert.ok(state.enemies.length >= enemiesBefore, '翻出的卡应真实生成')
  assert.ok(state.scenarioFlags.spawnedFrom?.seepingNightmare)
})

test('P0-2 议程 7 背面（队长二选一 → frost）/ 议程 8 背面（剩余调查员被击败 → noResolution）', () => {
  const state = inScenario()
  for (const enemy of state.enemies) enemy.beneath = []
  const frostBefore = (state.chaosBag || []).filter(token => token === 'frost').length
  transact(world, state, draft => world.engine.advanceAgenda(draft, [], 'doom'), choice =>
    (choice.options.some(option => option.id === 'frost') ? 'frost' : choice.options[0]?.id))
  assert.equal((state.chaosBag || []).filter(token => token === 'frost').length, frostBefore + 1)
  assert.equal(state.agendaIndex, 1)
  transact(world, state, draft => world.engine.advanceAgenda(draft, [], 'doom'), () => null)
  assert.ok(state.investigators.every(inv => inv.defeated || inv.resigned))
  assert.equal(state.campaign.records.iceAndDeathPart3Resolution, 'noResolution')
  assert.equal(state.campaign.scenarioResults.at(-1).resolution, 'noResolution')
})

test('P0-2 幕 3 背面：无幻灵敌人 → 真实 advanceAct 结算结局 1', () => {
  const state = inScenario()
  state.enemies = []
  transact(world, state, draft => world.engine.advanceAct(draft, []), () => null)
  assert.equal(state.campaign.records.iceAndDeathPart3Resolution, 'resolution1')
  assert.equal(state.campaign.records.eidolonsVanquished, 1)
  assert.equal(state.campaign.records.theTeamDefeatedTheHuntingCreatures, true)
  assert.equal(state.campaign.scenarioResults.at(-1).resolution, 'resolution1')
  assert.ok(Number.isSafeInteger(state.campaign.records.shelterValue))
})

// ---------------------------------------------------------------------------
// 5. P0-3 混乱标记 + 失败后果
// ---------------------------------------------------------------------------
test('P0-3 混乱标记：引擎 resolveSpecialToken 结算 [skull]/[cultist]/[tablet]', () => {
  const state = inScenario()
  const inv = state.investigators[0]
  inv.location = 'frozenShores' // 庇护值 2
  assert.equal(world.engine.resolveSpecialToken(state, inv.seat, inv, 'skull', []).delta, 1)
  assert.equal(world.engine.resolveSpecialToken(state, inv.seat, inv, 'cultist', []).delta, -2)
  assert.equal(world.engine.resolveSpecialToken(state, inv.seat, inv, 'tablet', []).delta, -3)
  state.difficulty = 'hard'
  assert.equal(world.engine.resolveSpecialToken(state, inv.seat, inv, 'skull', []).delta, 2)
  assert.equal(world.engine.resolveSpecialToken(state, inv.seat, inv, 'tablet', []).delta, -4)
})

test('P0-3 afterTest 失败后果：真实 performTest 下 [cultist] 洗入 / [tablet] 弃牌库顶', () => {
  const cultistState = inScenario()
  const cultistSeat = cultistState.investigators[0].seat
  cultistState.chaosBag = ['cultist']
  const deckBefore = cultistState.investigators[0].deck.length
  transact(world, cultistState, draft => {
    world.engine.performTest(draft, cultistSeat, 'intellect', 100, { resolve: () => {} })
  }, () => null)
  // 事务按 draft 重建 state：调查员对象换新，按 seat 重新取。
  assert.equal(cultistState.investigators[cultistSeat].deck.length, deckBefore + 1,
    '[cultist] 失败应洗入 1 张忒咳哩-哩')
  const tabletState = inScenario()
  const tabletSeat = tabletState.investigators[0].seat
  tabletState.chaosBag = ['tablet']
  const discardBefore = tabletState.investigators[0].discard.length
  transact(world, tabletState, draft => {
    world.engine.performTest(draft, tabletSeat, 'intellect', 100, { resolve: () => {} })
  }, () => null)
  assert.ok(tabletState.investigators[tabletSeat].discard.length > discardBefore, '[tablet] 失败应弃掉牌库顶')
})

test('P7 iceAndDeathPart3 混乱标记纯数据口径：[skull] 简易/困难、失败差值', () => {
  const state = {
    difficulty: 'standard', numInvestigators: 1, investigators: [{ seat: 0, location: 'crashSite' }],
    locations: [{ id: 'crashSite', shelter: 6, revealed: true }],
  }
  assert.equal(part3ChaosTokenValue(state, 'skull', state.investigators[0]), 3)
  state.difficulty = 'hard'
  assert.equal(part3ChaosTokenValue(state, 'skull', state.investigators[0]), 6)
  assert.equal(part3ChaosTokenValue(state, 'tablet', state.investigators[0]), -4)
  assert.deepEqual(part3ChaosFailureSpec(state, 'cultist', 2), { token: 'cultist', kind: 'tekelili', count: 2 })
  assert.deepEqual(part3ChaosFailureSpec(state, 'tablet', 3), { token: 'tablet', kind: 'discardTop', count: 3 })
})

// ---------------------------------------------------------------------------
// 6. 条目 flags + 结局记录存档
// ---------------------------------------------------------------------------
test('P7 iceAndDeathPart3 代表条目 flags 已注册（数据声明保留）', () => {
  assert.equal(registeredEntry('08544').agendaRule.forcedAdvanceHold, true)
  assert.equal(registeredEntry('08547').flags.elite, true)
  assert.equal(registeredEntry('08547').flags.eidolon, true)
  assert.equal(registeredEntry('08548').flags.surgeIfNoSeepingNightmare, true)
  assert.equal(registeredEntry('08546').flags.campResign, true)
})

test('P7 iceAndDeathPart3 渗出梦魇被击败：条目 enemyRule.removeBeneathOnDefeat 读点生效', () => {
  assert.equal(registeredEntry(RAW_CODES.seepingNightmare).enemyRule.removeBeneathOnDefeat, true)
  const state = inScenario()
  const nightmare = state.enemies.find(enemy =>
    (enemy.originalCode || enemy.code) === RAW_CODES.seepingNightmare)
  const beneath = [...nightmare.beneath]
  assert.ok(beneath.length, '渗出梦魇底下应有幻灵')
  assert.equal(chapter.behavior.enemyDefeated(state, nightmare, { info: () => {} }), false,
    '不替换正常弃置流程（返回 false）')
  assert.equal(nightmare.beneath.length, 0)
  assert.equal(nightmare.beneathFaceDown.length, 0)
  for (const code of beneath) assert.ok((state.scenarioZones.removed || []).includes(code),
    `底牌 ${code} 应移出游戏`)
})

test('P7 iceAndDeathPart3 结局记录与 JSON 存档往返（真实撤退结算路径）', () => {
  const state = inScenario()
  const camp = state.scenarioFlags.camp
  const group = state.investigators.filter(inv => inv.location === camp)
  for (const inv of group) inv.clues = Math.ceil(4 / group.length)
  const seat = decisionSeat(world, state)
  const resign = legalFor(world, state, seat)
    .find(move => move.action === 'scenarioAction' && move.rule === 'campResign')
  assert.ok(resign)
  playMove(world, state, resign, seat)
  settleChoices(world, state)
  assert.equal(state.campaign.records.iceAndDeathPart3Resolution, 'resolution2')
  const restored = saveAndRestore(world, state)
  assert.equal(restored.state.campaign.records.iceAndDeathPart3Resolution, 'resolution2')
  assert.equal(restored.state.campaign.records.theTeamFledToTheMountains, true)
  assert.equal(JSON.stringify(restored.state).includes('function'), false)
})
