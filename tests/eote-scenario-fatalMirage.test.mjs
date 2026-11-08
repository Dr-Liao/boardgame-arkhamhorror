// P7 致命幻景（fatalMirage）章节测试。
//
// 覆盖：章节结构/story-access、三次重入版本（幕/议程阈值与阶段）、伙伴与坚毅（Resolute）切换、
// 幻景翻面行动（Mirage：线索扣减/花线索翻面/揭示记忆）、记忆放逐/发现记录、代表条目、
// 真实引擎内的伙伴攻击能力、混乱标记数值（catalog + 真实 performTest）、结局记录与 JSON 往返、
// 以及真实大厅路径下的议程推进（P0-5）。
import test from 'node:test'
import assert from 'node:assert/strict'
import '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { executeDescriptor, performTest } from '../src/engine/engine.js'
import { contentRegistry } from '../content/registered.js'
import { fixture, asset, enemy } from './core-fixture.mjs'
import {
  loadEoteWorld, createHubGame, hubSetup, finishScenario, continueFromResult, beginChapter,
} from './eote-p8-fixture.mjs'
import { setPartnerStatus } from '../src/campaign/eote-partners.js'
import * as chapter from '../content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/index.js'
import {
  scenario, LOCATIONS, AGENDA_VERSION_CODES, ACT_VERSION_CODES, MEMORY_ENEMY_CODES, PARTNER_CODES,
  AGENDA_STAGES, ACT_STAGES,
} from '../content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/definition.js'
import { fatalMirageChaosToken, fatalMirageChaosTokenValue, storyVictoryCount } from '../content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/chaos.js'
import { chapterStory, storyText } from '../content/campaigns/edgeOfTheEarth/story-access.js'
import entry08549 from '../src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08549.js'
import entry08550 from '../src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08550.js'
import entry08556 from '../src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08556.js'
import entry08560 from '../src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08560.js'
import entry08556b from '../src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08556b.js'
import entry08560b from '../src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08560b.js'
import entry08569b from '../src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08569b.js'
import entry08575 from '../src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08575.js'
import entry08585 from '../src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08585.js'
import entry08587 from '../src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08587.js'
import entry08592 from '../src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/08592.js'

const ENTRIES = [entry08549, entry08550, entry08556, entry08560, entry08556b, entry08560b, entry08569b,
  entry08575, entry08585, entry08587, entry08592]
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

const clone = value => JSON.parse(JSON.stringify(value))
const stateFor = (investigatorCount = 1, records = {}, flags = {}) => ({
  investigators: Array.from({ length: investigatorCount }, (_, seat) => ({
    seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
    assets: [], engaged: [], deck: [], discard: [], threat: [],
  })),
  locations: [], enemies: [], encounterDeck: [], encounterDiscard: [], scenarioFlags: { ...flags },
  scenarioZones: {}, campaign: { leadSeat: 0, records: { ...records }, completedSteps: [], trauma: {}, investigators: {} },
  victoryDisplay: [], doom: 0, difficulty: 'standard', numInvestigators: investigatorCount,
  phase: 'investigation', round: 1, status: 'playing',
})

test('P7 fatalMirage 章节结构与 story-access 正文', () => {
  assert.equal(chapter.scenario.id, 'fatalMirage')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(Object.keys(scenario.locations).length, 19)
  assert.equal(chapter.layout.edges.length, 34)
  assert.equal(chapter.PARTNER_CODES.length, 9)
  const story = chapterStory('fatalMirage')
  assert.equal(story.sectionCount, 68)
  assert.ok(storyText('fatalMirage', 'setup').length > 0, 'story-access setup 正文可读')
  assert.equal(chapter.implementedEncounterCodes.length, 75)
  assert.deepEqual(chapter.scenario.setAsideLocations.length, 18)
})

test('P7 fatalMirage 版本：首次/第二次/第三次重入选择不同密谋与幕（阈值 15/13/11、阶段 1a/2a/3a）', () => {
  const first = stateFor()
  const report = chapter.behavior.setupScenario(first, {})
  assert.equal(report.version, 1)
  assert.equal(report.agendaCode, AGENDA_VERSION_CODES[1])
  assert.equal(report.actCode, ACT_VERSION_CODES[1])
  assert.equal(first.agendaIndex, 0, 'v1 议程索引必须从 0 开始')
  assert.equal(first.agendas.length, 1, '每个版本只放 1 张议程（其余移出游戏）')
  assert.equal(first.agendas[0].stage, '1a')
  assert.equal(first.agendas[0].doomThreshold, 15)
  assert.equal(first.acts[0].stage, '1a')
  assert.equal(first.locations.length, 1, '首次只在记忆囚笼开始')
  assert.equal(first.locations[0].id, 'prisonOfMemories')
  assert.equal(first.locations[0].revealed, true, '幻景地点没有未揭示面，入场即揭示')
  assert.equal(report.setAsideLocations.length, 18)
  assert.equal(report.memoryEnemies.length, 9)

  const second = stateFor(1, {}, { fatalMirageVersion: 2 })
  const report2 = chapter.behavior.setupScenario(second, {})
  assert.equal(report2.version, 2)
  assert.equal(second.agendaIndex, 0, 'v2 议程索引不得越界')
  assert.equal(second.agendas[0].stage, '2a')
  assert.equal(second.agendas[0].doomThreshold, AGENDA_STAGES[2].doomThreshold)
  assert.equal(second.acts[0].stage, '2a')
  assert.equal(report2.actCode, ACT_VERSION_CODES[2])

  const third = stateFor(1, { memoriesDiscovered: ['baseCamp', 'coastalWaters'], memoriesBanished: ['hedgeMaze'] })
  third.campaign.completedSteps = ['fatalMirage', 'fatalMirage']
  const report3 = chapter.behavior.setupScenario(third, {})
  assert.equal(report3.version, 3)
  assert.equal(third.agendas[0].stage, '3a')
  assert.equal(third.agendas[0].doomThreshold, AGENDA_STAGES[3].doomThreshold)
  assert.equal(third.acts[0].stage, '3a')
  assert.ok(third.locations.some(location => location.id === 'baseCamp'), '上一轮发现的记忆直接入场')
  assert.ok(third.locations.some(location => location.id === 'coastalWaters'))
  assert.ok(third.victoryDisplay.some(entry => String(entry.code) === '08560b'), '已放逐记忆的剧情卡进胜利区')
  assert.equal(report3.setAsideLocations.includes('hedgeMaze'), false)
})

test('P7 fatalMirage Mirage 关键词：入场线索按已入场目标扣减，花线索翻面揭示下一层记忆', () => {
  const state = stateFor(2)
  chapter.behavior.setupScenario(state, {})
  const prison = state.locations.find(location => location.id === 'prisonOfMemories')
  assert.equal(prison.clues, 3 * 2, '记忆囚笼初始 3/人（无目标已入场）')
  // 花线索翻面：本地点 2 人 × 幻景 1 = 2 个线索（GroupClueCost）。
  assert.equal(chapter.behavior.mirageFlipCost(state, 'prisonOfMemories'), 2)
  assert.equal(chapter.behavior.isClearedOfMirages(state, 'prisonOfMemories'), false)
  assert.deepEqual(chapter.behavior.pendingMirageTargets(state, 'prisonOfMemories').map(target => target.id),
    ['baseCamp', 'deckOfTheTheodosia', 'universityHalls'])
  state.investigators[0].clues = 2
  const moves = chapter.behavior.actions(state, state.investigators[0])
  const flipMoves = moves.filter(move => move.rule === 'mirageFlip:prisonOfMemories' && !move.reason)
  assert.equal(flipMoves.length, 3, '三个可选记忆各给一个合法行动')
  // 引擎路径：performAction → api.payGroupClues → api.flipLocation → locationStory。
  let paid = null
  const api = {
    payGroupClues: (amount, options) => { paid = { amount, options } },
    flipLocation: (locationId, seat) => chapter.behavior.locationStory(state,
      state.locations.find(location => location.id === locationId), {}, seat),
  }
  assert.equal(chapter.behavior.performAction(state, state.investigators[0], flipMoves[1], api), true)
  assert.deepEqual(paid, { amount: 2, options: { atLocation: 'prisonOfMemories' } })
  const chosen = state.locations.find(location => location.id === 'deckOfTheTheodosia')
  assert.ok(chosen, '选择的记忆地点入场')
  assert.equal(chosen.revealed, true)
  // deckOfTheTheodosia 印刷线索 3/人；其 Mirage 1 的三张目标都还未入场 → 3 × 2 人 = 6。
  assert.equal(chosen.clues, 3 * 2)
  // 揭示后该目标已入场，不再是 pending 目标。
  assert.equal(chapter.behavior.pendingMirageTargets(state, 'prisonOfMemories').some(target => target.id === 'deckOfTheTheodosia'), false)
})

test('P7 fatalMirage 伙伴与坚毅：地点剧情生成记忆敌人，击败后直面恶魔并切坚毅形态', () => {
  const state = stateFor()
  chapter.behavior.setupScenario(state, {})
  chapter.behavior.choosePartner(state, 0, '08587')
  state.locations.push({ ...clone(LOCATIONS.dyersClassroom), id: 'dyersClassroom', revealed: true, clues: 2, maxClues: 2 })
  state.investigators[0].location = 'dyersClassroom'
  // 地点背面：伙伴活着 → 在本地点生成记忆敌人「悔恨航程之记忆」（08579），剧情卡翻回。
  const spawned = chapter.behavior.flipStoryFace(state, '08569b', {}, { location: 'dyersClassroom' })
  assert.equal(spawned.spawnEnemy, '08579')
  assert.ok(state.enemies.some(enemy => enemy.code === '08579' && enemy.location === 'dyersClassroom'))
  assert.equal(state.campaign.records.partnersFacedInnerDemon?.length || 0, 0, '生成敌人时还未直面恶魔')
  // 记忆敌人被击败 → 引擎 enemyDefeated 钩子翻面读记忆剧情：记录 + 坚毅切换 + 进胜利区 + 可推进幕。
  const memoryEnemy = state.enemies.find(enemy => enemy.code === '08579')
  memoryEnemy.defeatedBy = 0
  assert.equal(chapter.behavior.enemyDefeated(state, memoryEnemy, {}), true)
  assert.equal(state.campaign.records.dyerHasConfrontedHisDemons, true, '记录「戴尔直面内心恶魔」')
  assert.ok(state.campaign.records.partnersFacedInnerDemon.includes('08587'))
  assert.equal(state.campaign.eote.partners.roster.find(entry => entry.code === '08714').status, 'resolute')
  assert.ok(state.victoryDisplay.some(entry => String(entry.code) === '08579b'), '记忆剧情卡进胜利区')
  assert.equal(state.scenarioFlags.fatalMirageMayAdvance, true, '允许推进当前幕')
  const resolute = chapter.behavior.resoluteVersionOf(chapter.behavior.basePartnerOf('08587'))
  assert.equal(resolute, '08587', '基础伙伴 → 坚毅版本映射')
  assert.equal(chapter.behavior.isAlive(state, '08587'), true)
})

test('P7 fatalMirage 记忆放逐：伙伴被划掉时翻面放逐并把现场移回记忆囚笼', () => {
  const state = stateFor()
  chapter.behavior.setupScenario(state, {})
  chapter.behavior.choosePartner(state, 0, '08587')
  const base = chapter.behavior.basePartnerOf('08587')
  assert.equal(chapter.behavior.eliminatePartner(state, base), true)
  assert.equal(chapter.behavior.isAlive(state, '08587'), false)
  state.locations.push({ ...clone(LOCATIONS.dyersClassroom), id: 'dyersClassroom', revealed: true, clues: 2, maxClues: 2 })
  state.investigators[0].location = 'dyersClassroom'
  state.enemies.push({ id: 'e1', code: '08575', name: '记忆', location: 'dyersClassroom' })
  const flipped = chapter.behavior.flipStoryFace(state, '08569b', {}, { location: 'dyersClassroom' })
  assert.equal(flipped.banished, true)
  assert.equal(flipped.victory, true)
  assert.equal(state.investigators[0].location, 'prisonOfMemories')
  assert.equal(state.enemies[0].location, 'prisonOfMemories')
  assert.equal(state.locations.some(location => location.id === 'dyersClassroom'), false, '地点随剧情卡进胜利区而离场')
  assert.ok(state.victoryDisplay.some(entry => String(entry.code) === '08569b'))
  assert.equal(state.scenarioFlags.fatalMirageMayAdvance, true)
})

test('P7 fatalMirage 代表条目与混乱标记（catalog 契约）', () => {
  assert.equal(registeredEntry('08550').flags.version, 1)
  assert.equal(registeredEntry('08560').flags.tier, 2)
  assert.equal(registeredEntry('08560').flags.forcedAfterInvestigate, 'shroudPlus1AndCannotLeave')
  assert.equal(registeredEntry('08575').flags.memoryEnemy, true)
  assert.equal(registeredEntry('08585').flags.attachLocationClues, 2)
  assert.equal(registeredEntry('08549').flags.tokenMeanings.cultist, -2)
  const state = stateFor()
  state.difficulty = 'standard'
  state.victoryDisplay = [{ code: '08556b' }, { code: '08557b' }, { code: '01001' }]
  assert.equal(storyVictoryCount(state), 2)
  assert.equal(fatalMirageChaosTokenValue(state, 'skull'), -2, '简单/普通 = -胜负区剧情卡牌数')
  assert.equal(fatalMirageChaosTokenValue(state, 'cultist'), -2)
  assert.equal(fatalMirageChaosTokenValue(state, 'tablet'), -3)
  assert.equal(fatalMirageChaosTokenValue(state, 'elderthing'), -4)
  state.difficulty = 'hard'
  state.agendas = [{ stage: '2a' }]
  assert.equal(fatalMirageChaosTokenValue(state, 'skull'), -4, '困难 = -(数量 + 当前密谋编号)')
  assert.equal(fatalMirageChaosTokenValue(state, 'tablet'), -4)
  assert.equal(fatalMirageChaosTokenValue(state, 'elderthing'), -5)
  assert.deepEqual(chapter.behavior.resolveChaosToken(state, state.investigators[0], 'cultist'),
    { delta: -2, rider: 'clueOnLocationUnlessSucceedBy2' })
  assert.equal(fatalMirageChaosToken(state, state.investigators[0], 'frost'), null, '未知标记交回引擎默认表')
})

test('P7 fatalMirage 混乱标记在真实 performTest 中生效（P0-13）', () => {
  const scenarioData = contentRegistry.getScenarioData('fatalMirage')
  const run = (token, difficulty = 'standard', victoryDisplay = []) => {
    const state = fixture('01001')
    state.scenario = structuredClone(scenarioData)
    state.difficulty = difficulty
    state.victoryDisplay = victoryDisplay
    state.chaosBag = [token]
    let captured = null
    const execute = draft => performTest(draft, 0, 'willpower', 2, { resolve: result => { captured = result } })
    resolveTransaction(state, 0, { action: 'p7-token-test' }, execute)
    for (let guard = 0; state.pendingChoice && guard < 40; guard++) {
      const choice = state.pendingChoice
      const optionId = ['done', 'skip', 'self'].find(id => choice.options.some(option => option.id === id))
        ?? choice.options[0].id
      resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, execute)
    }
    return captured
  }
  // 基础技能值 3（01001 的意志 3）+ 标记修正；难度 2。
  const cultist = run('cultist')
  assert.equal(cultist.value, 1, '[cultist] -2 生效（基础 3 - 2）')
  const tablet = run('tablet')
  assert.equal(tablet.value, 0, '[tablet] -3 生效')
  const elderthing = run('elderthing')
  assert.equal(elderthing.value, 0, '[elderthing] -4 生效（下限 0）')
  const hardTablet = run('tablet', 'hard')
  assert.equal(hardTablet.value, 0, '困难 [tablet] -4 生效')
  const skull = run('skull', 'standard', [{ code: '08556b', victory: 0 }, { code: '08560b', victory: 0 }])
  assert.equal(skull.value, 1, '[skull] -X（X=2）生效')
  const hardSkull = run('skull', 'hard', [{ code: '08556b', victory: 0 }])
  assert.equal(hardSkull.value, 1, '困难 [skull] -(X+密谋编号) 生效')
})

test('P7 fatalMirage 伙伴能力在真实引擎内结算（曲奇：基础值 6 攻击）', () => {
  const s = fixture('01001')
  asset(s, '08592', { uses: 3 })
  enemy(s, { fight: 1, evade: 1, health: 10, engagedSeat: 0 })
  s.chaosBag = ['0']
  const descriptor = registeredEntry('08592').abilities[0]
  const execute = draft => executeDescriptor(draft, {
    inv: draft.investigators[0], source: draft.investigators[0].assets.find(card => card.code === '08592'),
    descriptor, events: [], context: { targetId: draft.enemies[0].id },
  })
  resolveTransaction(s, 0, { action: 'p7test' }, execute)
  for (let i = 0; s.pendingChoice && i < 60; i++) {
    const c = s.pendingChoice
    const id = ['done', 'skip', 'self'].find(option => c.options.some(o => o.id === option)) ?? c.options[0].id
    resolveTransaction(s, c.seat, { action: 'choose', choiceId: c.id, optionId: id }, execute)
  }
  assert.ok(s.enemies[0].damageTaken >= 1, '基础值 6 的战斗攻击命中')
  assert.equal(s.investigators[0].assets.find(card => card.code === '08592').uses, 2)
  assert.equal(s.investigators[0].assets.find(card => card.code === '08592').exhausted, true)
})

test('P7 fatalMirage 结局记录与 JSON 存档往返', () => {
  const state = stateFor()
  chapter.behavior.setupScenario(state, {})
  chapter.behavior.placeLocation(state, 'baseCamp', { revealed: true })
  state.victoryDisplay.push({ code: '08557b', type: 'story', victory: 0 }, { code: '08560b', type: 'story', victory: 2 })
  state.victory = 2
  const result = chapter.behavior.resolution(state, 'victory', [], {})
  assert.deepEqual(result, { award: true, bonus: 0 })
  const records = state.campaign.records
  assert.equal(records.fatalMirageResolution, 'victory')
  assert.equal(records.fatalMirageTimes, 1)
  assert.equal(records.fatalMirageCompleted, true)
  assert.equal(records.xp, 2)
  assert.ok(records.memoriesBanished.includes('08560b'))
  assert.ok(records.memoriesDiscovered.includes('08557'), '发现记忆记录地点卡号')
  const restored = clone(state)
  delete restored.scenarioFlags.fatalMirageVersion
  assert.equal(chapter.behavior.fatalMirageVersion(restored), 2, '完成一次后下一次是版本 2（记录不重复计数）')
  assert.equal(restored.campaign.records.fatalMirageCompleted, true)
  assert.ok(chapter.behavior.storyVictoryCount(restored) >= 2)
  assert.equal(MEMORY_ENEMY_CODES.length, 9)
  assert.equal(PARTNER_CODES.length, 9)
})

test('P0-5 真实引擎：致命幻景议程推进不再抛错，背面击败全员并按 noResolution 结算记录', async () => {
  const world = await loadEoteWorld()
  const state = createHubGame(world, { seats: 2, humans: [0], seed: 'fm-agenda' })
  hubSetup(world, state, {})
  for (let guard = 0; state.scenario?.id !== 'fatalMirage' && guard < 8; guard++) {
    finishScenario(world, state, 'resolution1')
    continueFromResult(world, state, { upgrades: false })
    if (state.uiState === 'scenarioSetup') beginChapter(world, state)
  }
  assert.equal(state.scenario.id, 'fatalMirage')
  assert.equal(state.agendaIndex, 0)
  assert.equal(state.agendas[0].doomThreshold, 15)
  // debug 是 CONTRACT §3 的合法引擎动作；随后走真实 advanceAgenda 入口（议程达到阈值时的同一函数）。
  world.engine.applyMove(state, 0, { action: 'debug', kind: 'doom', amount: 15 })
  world.engine.applyMove(state, 0, { action: 'debug', kind: 'advanceAgenda' })
  for (let guard = 0; state.pendingChoice && guard < 60; guard++) {
    const choice = state.pendingChoice
    const optionId = ['done', 'skip', 'self'].find(id => choice.options.some(option => option.id === id))
      ?? choice.options[0].id
    world.engine.applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId })
  }
  assert.equal(state.uiState, 'scenarioResult', '议程推进后应正常进入结算')
  const result = state.campaign.scenarioResults.at(-1)
  assert.equal(result?.resolution, 'noResolution')
  assert.equal(state.campaign.records.fatalMirageResolution, 'noResolution')
  assert.equal(state.campaign.records.fatalMirageTimes, 1)
  assert.ok(state.investigators.every(inv => inv.defeated || inv.resigned), '议程背面击败剩余调查员')
})
