// 重返地底噬魔（returnToNightOfTheZealot 第三章 · returnToTheDevourerBelow · 场景参考卡 50032a）·
// 引擎集成测试。
//
// 覆盖：
//   1. 章节模块 / manifest 通过注册期契约（campaign 50 已在生产组合根注册）；
//   2. 真实 createGameState + startScenario 开局布置（主道路起点、10 选 4 密林、放一边区、
//      使者组入遭遇牌库、50032b 附属记录、逃跑异教徒毁灭）；
//   3. 幕推进：幕 1 团队支付线索 → 仪式地入场；进入仪式地 → 幕 2；幕 3 线索目标 → 结局 1 记录；
//   4. 密谋推进：密谋 1 背面在主道路生成[[怪物]]敌人并放毁灭；
//   5. 单卡/章节钩子：50032b/50033/50034/50035/50039/50041/50043 的读点夹具；
//   6. JSON 存档往返（migrateState）后观察投影、合法行动与重放同一动作结果一致。
//
// 运行：node --test tests/ret-notz-devourer.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { contentRegistry } from '../content/registered.js'
import {
  createGameState, startScenario, advanceAgenda, applyMove, legalMoves,
} from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { migrateState } from '../src/engine/save-migration.js'
import { viewState } from '../src/integration/observation.js'
import * as devourer from '../content/campaigns/returnToNightOfTheZealot/scenarios/returnToTheDevourerBelow/index.js'

const CAMPAIGN_ID = 'returnToNightOfTheZealot'
const SCENARIO_ID = 'returnToTheDevourerBelow'
const CHAPTERS = ['returnToTheGathering', 'returnToTheMidnightMasks', 'returnToTheDevourerBelow']

const inTransaction = (state, run) => resolveTransaction(state, 0, { action: 'ret-notz-devourer-test' }, draft => run(draft))

const settle = state => {
  for (let i = 0; state.pendingChoice && i < 300; i += 1) {
    const choice = state.pendingChoice
    const option = choice.options.find(item => ['done', 'skip', 'self'].includes(item.id)) || choice.options[0]
    applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: option.id })
  }
  return state
}

function newGame(seed) {
  const game = createGameState({ campaignId: CAMPAIGN_ID, playerInvestigator: '01001', seed }, [{ seat: 0 }])
  settle(game)
  return game
}
function startChapter(game, scenarioId = SCENARIO_ID) {
  const campaign = contentRegistry.getCampaign(CAMPAIGN_ID)
  startScenario(game, campaign.scenarioIds.indexOf(scenarioId), [])
  settle(game)
  return game
}
function prepareTurn(game, inv) {
  game.currentSeat = inv.seat
  game.phase = 'investigation'
  game.turnSeat = inv.seat
  inv.actionsLeft = 3
  game.chaosBag = ['0']
  return game
}

// ---------------------------------------------------------------------------
// 0. 章节模块 / manifest
// ---------------------------------------------------------------------------
test('RtDB：章节 manifest 通过注册期契约，campaign 50 第三章可在生产注册表启动', () => {
  assert.equal(devourer.manifest.id, SCENARIO_ID)
  assert.equal(devourer.manifest.campaignId, CAMPAIGN_ID)
  assert.equal(devourer.manifest.referenceCode, '50032a')
  assert.equal(devourer.manifest.status, 'playable')
  assert.deepEqual(devourer.manifest.resolutionIds, ['noResolution', 'r1', 'r2', 'r3'])
  assert.deepEqual(devourer.manifest.requiredPackIds, ['core', 'notz', 'rtnotzCampaign'])
  assert.deepEqual([...devourer.manifest.requiredEncounterGroupIds], [
    'theDevourerBelow', 'ancientEvils', 'strikingFear', 'ghoulsOfUmordhoth',
    'theDevourersCult', 'returnToTheDevourerBelow',
  ])
  assert.deepEqual(devourer.scenario.acts.map(act => act.originalCode), ['01146', '01147', '01148'])
  assert.deepEqual(devourer.scenario.agendas.map(agenda => agenda.originalCode), ['01143', '01144', '01145'])
  assert.equal(Object.keys(devourer.LOCATIONS).length, 12)
  assert.equal(devourer.WOODS_POOL.length, 10)
  assert.equal(devourer.ENCOUNTER_DECK.length, 27)
  assert.equal(devourer.ENCOUNTER_DECK_CODES.length, 12)
  assert.deepEqual(devourer.AGENT_SET_IDS.sort(), [
    'agentsOfCthulhu', 'agentsOfHastur', 'agentsOfShubNiggurath', 'agentsOfYogSothoth',
  ])
  assert.ok(typeof devourer.scenario.setupNote === 'string' && devourer.scenario.setupNote.length > 20)
  assert.ok(devourer.scenario.setup.length > 20)
  const campaign = contentRegistry.getCampaign(CAMPAIGN_ID)
  assert.ok(campaign.scenarioIds.includes(SCENARIO_ID))
  assert.deepEqual(campaign.scenarioIds, CHAPTERS)
})

// ---------------------------------------------------------------------------
// 1. 开局布置
// ---------------------------------------------------------------------------
test('RtDB：真实引擎开局布置（主道路 + 随机 4 密林 / 放一边区 / 使者组 / 50032b 记录）', () => {
  const game = newGame('ret-notz-devourer-setup')
  startChapter(game)
  assert.equal(game.scenario.id, SCENARIO_ID)
  assert.equal(game.investigators[0].location, 'mainPath')
  const ids = game.locations.map(location => location.id)
  assert.ok(ids.includes('mainPath'))
  const woods = game.locations.filter(location => (location.traits || []).includes('Woods'))
  assert.equal(woods.length, 5, '主道路 + 随机 4 张阿卡姆密林')
  assert.equal(game.locations.filter(location => location.id !== 'mainPath').length, 4)
  // 遭遇牌库：固定 27 张 + 使者组 4 张（食尸鬼祭司在无记录时不加入）。
  assert.equal(game.encounterDeck.length, 31)
  const prepared = game.scenarioFlags.retDevourerPrepared
  assert.equal(prepared.agentSetCards.length, 4)
  for (const code of prepared.agentSetCards) assert.ok(game.encounterDeck.includes(code))
  assert.equal(prepared.woods.length, 4)
  for (const id of prepared.woods) assert.ok(ids.includes(id))
  assert.ok(!ids.includes('ritualSite'), '仪式地放在一边，不直接入场')
  assert.deepEqual(game.scenarioZones.setAside.slice().sort(), ['01156', '01157', '50032b'].sort())
  const vault = game.scenarioFlags.retDevourerVault
  assert.equal(vault.code, '50032b')
  assert.equal(vault.attachedTo, '01157')
  assert.equal(vault.resources, 0)
  assert.equal(vault.inPlay, false)
  assert.deepEqual(game.acts.map(act => act.originalCode), ['01146', '01147', '01148'])
  assert.deepEqual(game.agendas.map(agenda => agenda.originalCode), ['01143', '01144', '01145'])
  assert.equal(game.doom, 0)
})

test('RtDB：逃跑的异教徒让密谋开局多放毁灭，食尸鬼祭司仍存活则洗入遭遇牌库', () => {
  const game = newGame('ret-notz-devourer-records')
  game.campaign.records.cultistsEscaped = ['01137', '01138', '01139']
  game.campaign.records.ghoulPriestAlive = true
  startChapter(game)
  assert.equal(game.doom, 2, '3 名逃跑异教徒 → floor((3+1)/2)=2 点毁灭')
  assert.ok(game.encounterDeck.includes('01116'), '食尸鬼祭司洗入遭遇牌库')
  const setAside = game.scenarioZones.setAside
  assert.ok(!setAside.includes('01116'))
})

// ---------------------------------------------------------------------------
// 2. 幕推进 → 结局记录
// ---------------------------------------------------------------------------
test('RtDB：幕 1 团队支付线索 → 仪式地入场；进入仪式地推进幕 2；幕 3 线索目标 → 结局 1', () => {
  const game = newGame('ret-notz-devourer-act')
  startChapter(game)
  const inv = game.investigators[0]
  prepareTurn(game, inv)
  inv.location = 'mainPath'
  inv.clues = 3
  assert.ok(legalMoves(game).some(move => move.action === 'advanceAct'), '幕 1 应可共同支付 3 线索推进')
  applyMove(game, 0, { action: 'advanceAct' })
  settle(game)
  assert.equal(game.acts[game.actIndex].originalCode, '01147', '幕 1 应推进到「深入黑暗」')
  assert.ok(game.locations.some(location => location.id === 'ritualSite'), '幕 1 背面应把仪式地放置入场')
  // 幕 2 目标：有调查员进入仪式地。
  prepareTurn(game, inv)
  inv.location = 'mainPath'
  const move = legalMoves(game).find(item => item.action === 'move' && item.locationId === 'ritualSite')
  assert.ok(move, '应能移动到仪式地')
  applyMove(game, 0, { action: 'move', locationId: 'ritualSite' })
  settle(game)
  assert.equal(game.acts[game.actIndex].originalCode, '01148', '进入仪式地应推进到「阻止计划」')
  // 幕 3 目标：本场景线索数达到 2×调查员人数（真实 interruptRitual 行动的结算用一个夹具替代）。
  game.actClues = 2 * game.numInvestigators
  prepareTurn(game, inv)
  applyMove(game, 0, { action: 'resource' })
  settle(game)
  const result = (game.campaign.scenarioResults || []).at(-1)
  assert.ok(result, '应写入一条剧本结算记录')
  assert.equal(result.scenarioId, SCENARIO_ID)
  assert.equal(result.resolution, 'r1', '幕 3 背面进入结局 1')
  assert.equal(result.recordsAfter.ritualBroken, true)
  assert.notEqual(result.recordsAfter.succumbedToUmordhoth, true)
})

test('RtDB：密谋 1 背面在主道路生成[[怪物]]敌人并放 1 毁灭', () => {
  const game = newGame('ret-notz-devourer-agenda')
  startChapter(game)
  game.chaosBag = ['0']
  inTransaction(game, draft => advanceAgenda(draft, []))
  settle(game)
  assert.equal(game.agendas[game.agendaIndex].originalCode, '01144', '密谋 1 应推进到「仪式开始」')
  const spawned = game.enemies.filter(enemy => enemy.location === 'mainPath')
  assert.equal(spawned.length, 1, '密谋 1 背面应在主道路生成 1 个[[怪物]]敌人')
  assert.equal(spawned[0].doom, 1, '该敌人应带 1 点毁灭')
})

// ---------------------------------------------------------------------------
// 3. 章节钩子 / 单卡规则夹具
// ---------------------------------------------------------------------------
test('RtDB：50032b 凡尘终陨之墟 → 乌默尔多斯 +X 攻击/+X 倍人数生命、入场按剩余幕数放资源', () => {
  const state = {
    investigators: [{ seat: 0 }, { seat: 1 }], numInvestigators: 2, round: 1,
    scenarioFlags: {}, campaign: { leadSeat: 0, records: {} },
    acts: [{ originalCode: '01146' }, { originalCode: '01147' }, { originalCode: '01148' }], actIndex: 0,
    agendaIndex: 0, agendas: [{ originalCode: '01143' }],
    enemies: [], locations: [], scenarioZones: { setAside: ['01157', '50032b'] },
  }
  const umordhoth = { id: 'e1', code: '01157', originalCode: '01157', name: '乌默尔多斯', location: 'ritualSite', attachments: [] }
  state.enemies.push(umordhoth)
  const taken = []
  const api = {
    info() {},
    takeFromSetAside: code => { taken.push(code); return true },
    get random() { return () => 0.5 },
  }
  assert.equal(devourer.behavior.enemySpawned(state, umordhoth, api), true)
  assert.equal(state.scenarioFlags.retDevourerVault.resources, 3, '剩余 3 张幕 → 3 资源')
  assert.deepEqual(taken.sort(), ['01157', '50032b'])
  // +X 攻击、+X 倍调查员人数的生命。
  assert.equal(devourer.behavior.enemyStatModifier(state, umordhoth, 'fight'), 3)
  assert.equal(devourer.behavior.enemyStatModifier(state, umordhoth, 'health'), 6)
  // 面具附属：+2 生命。
  umordhoth.attachments.push({ code: '50043', originalCode: '50043' })
  assert.equal(devourer.behavior.enemyStatModifier(state, umordhoth, 'health'), 8)
})

test('RtDB：50033 / 50034 / 50035 / 50039 特殊规则读点', () => {
  // 50033 巨大柳树：本地点击败诡计的技能检定成功后，该诡计经 encounterGainsSurge 获得涌动（团队每轮一次）。
  const willowState = {
    round: 3, scenarioFlags: {}, investigators: [{ seat: 0, location: 'greatWillow' }],
    locations: [{ id: 'greatWillow', code: '50033', originalCode: '50033', name: '阿卡姆密林 · 巨大柳树', traits: ['Woods'] }],
    enemies: [], campaign: {},
  }
  const willowInv = willowState.investigators[0]
  const result = { success: true, source: { type: 'encounter', code: '01158', name: '乌默尔多斯的愤怒' } }
  assert.equal(devourer.behavior.afterTest(willowState, willowInv, result, { info() {} }), true)
  assert.equal(devourer.behavior.encounterGainsSurge(willowState, '01158', willowInv), true)
  assert.equal(devourer.behavior.encounterGainsSurge(willowState, '01158', willowInv), false, '每张卡只涌动一次')
  // 团队每轮仅限一次：同一轮第二次成功检定不再给涌动。
  assert.equal(devourer.behavior.afterTest(willowState, willowInv, result, { info() {} }), false)
  // 50034 湖畔：调查时额外揭示 1 个混乱标记。
  const lakeState = {
    scenarioFlags: {}, campaign: {},
    skillTest: { seat: 0, source: { label: '调查', code: '50034' } },
    locations: [{ id: 'lakeside', code: '50034', originalCode: '50034', name: '阿卡姆密林 · 湖畔' }],
  }
  devourer.behavior.chaosTokenRevealed(lakeState, { seat: 0, location: 'lakeside', name: '调查员1' }, '0', { info() {} })
  const plans = lakeState.skillTest.pendingExtraReveals
  assert.equal(plans.length, 1)
  assert.equal(plans[0].retDevourerExtra, '50034')
  // 同一检定只加一次。
  devourer.behavior.chaosTokenRevealed(lakeState, { seat: 0, location: 'lakeside' }, '-1', { info() {} })
  assert.equal(lakeState.skillTest.pendingExtraReveals.length, 1)
  // 非法检定类型不触发。
  const evadeAtLakeside = { ...lakeState, skillTest: { seat: 0, source: { label: '躲避' } }, scenarioFlags: {} }
  devourer.behavior.chaosTokenRevealed(evadeAtLakeside, { seat: 0, location: 'lakeside' }, '0', { info() {} })
  assert.equal(evadeAtLakeside.skillTest.pendingExtraReveals, undefined)
  // 50035 尸横遍野的空地：本地点的敌人每次至多受 1 点伤害。
  const clearing = { code: '50035', originalCode: '50035', id: 'clearing', name: '阿卡姆密林 · 尸横遍野的空地' }
  const dmgState = { locations: [clearing], scenarioFlags: {}, campaign: {} }
  const enemy = { id: 'e2', code: '50041', location: 'clearing', traits: ['Humanoid', 'Cultist'] }
  assert.equal(devourer.behavior.enemyDamageAmount(dmgState, enemy, 3, { info() {} }), 1)
  assert.equal(devourer.behavior.enemyDamageAmount(dmgState, enemy, 1, { info() {} }), 1)
  // 50039 乌默尔多斯的祭司：与没有手牌的调查员交战时不能被躲避。
  const acolyte = { id: 'e3', code: '50039', originalCode: '50039' }
  assert.equal(devourer.behavior.canEvadeEnemy({}, { seat: 0, hand: [] }, acolyte), false)
  assert.equal(devourer.behavior.canEvadeEnemy({}, { seat: 0, hand: ['01001'] }, acolyte), true)
  // 50038 食墓鬼：攻击后随机弃 1 张手牌。
  const discards = []
  assert.equal(devourer.behavior.enemyAttackResolved({}, { code: '50038', originalCode: '50038' },
    { seat: 0, name: '调查员1', hand: ['01001'] }, { discardRandom: (seat, n) => discards.push([seat, n]), info() {} }), true)
  assert.deepEqual(discards, [[0, 1]])
})

test('RtDB：50041 生成后放毁灭/线索；50043 附属到最远异教徒；50042 神话末放毁灭', () => {
  // 50041 噬魔信徒：生成后放 1 毁灭（密谋 1）；密谋 ≠1 时两者都做。
  const disciple = { id: 'e4', code: '50041', originalCode: '50041', name: '噬魔信徒', location: 'ritualSite', drawnBySeat: 0 }
  const doomState = {
    agendaIndex: 0, scenarioFlags: {}, campaign: { leadSeat: 0 }, numInvestigators: 1,
    investigators: [{ seat: 0, clues: 2, hand: [], location: 'mainPath' }], enemies: [disciple], locations: [],
  }
  const doomCalls = []
  devourer.behavior.enemySpawned(doomState, disciple, { doomOn: () => doomCalls.push('doom'), info() {} })
  assert.deepEqual(doomCalls, ['doom'])
  const bothState = { ...doomState, agendaIndex: 1, investigators: [{ ...doomState.investigators[0] }] }
  const both = []
  devourer.behavior.enemySpawned(bothState, disciple, {
    doomOn: () => both.push('doom'), loseClues: (seat, n) => both.push(`lose:${seat}:${n}`),
    addCluesToLocation: (id, n) => both.push(`clue:${id}:${n}`), info() {},
  })
  assert.deepEqual(both.sort(), ['clue:ritualSite:1', 'doom', 'lose:0:1'])
  // 50043 乌默尔多斯的面具：附属到最远的[[异教徒]]敌人。
  const far = { id: 'e5', code: '01137', originalCode: '01137', name: '「狼人」德鲁', location: 'far', traits: ['Humanoid', 'Cultist'], unique: true, attachments: [] }
  const maskState = {
    scenarioFlags: {}, campaign: {}, round: 2,
    investigators: [{ seat: 0, location: 'here' }],
    locations: [{ id: 'here', connections: ['mid'] }, { id: 'mid', connections: ['here', 'far'] }, { id: 'far', connections: ['mid'] }],
    enemies: [far],
  }
  const attachCalls = []
  const keywords = []
  const mask = devourer.behavior.resolveEncounter(maskState, maskState.investigators[0],
    { code: '50043', originalCode: '50043' }, {
      info() {},
      locationDistance: (from, targets) => (from === 'here' ? 2 : 0),
      attachToEnemy: (enemy, code) => { far.attachments.push({ code }); attachCalls.push([enemy.id, code]) },
      doomOn: () => {},
      setEnemyKeywords: (enemy, list) => keywords.push(list),
    })
  assert.deepEqual(mask, { placed: true })
  assert.deepEqual(attachCalls, [['e5', '50043']])
  assert.deepEqual(keywords, [['retaliate']], '独特敌人获得反击')
  // 50042 掠尸者：神话阶段末放 1 毁灭；在主道路时敌军阶段末把毁灭移到密谋。
  const taker = { id: 'e6', code: '50042', originalCode: '50042', name: '掠尸者', location: 'mainPath', doom: 0 }
  const mythosState = { scenarioFlags: {}, campaign: {}, enemies: [taker], locations: [] }
  devourer.behavior.mythosEnded(mythosState, { doomOn: (target, n) => { taker.doom += n }, info() {} })
  assert.equal(taker.doom, 1)
  const addedDoom = []
  devourer.behavior.enemyPhaseEnd(mythosState, { addDoom: n => addedDoom.push(n), info() {} })
  assert.deepEqual(addedDoom, [1])
  assert.equal(taker.doom, 0)
})

test('RtDB：50036 躲避额外揭示 / 50041 最远无人地点 / 01175 低神智敌人加成', () => {
  // 50036 木桥：躲避时额外揭示 1 个混乱标记（每次检定一次）。
  const bridgeState = {
    scenarioFlags: {}, campaign: {},
    skillTest: { seat: 0, source: { label: '躲避', code: '01181' } },
    locations: [{ id: 'woodenBridge', code: '50036', originalCode: '50036', name: '阿卡姆密林 · 木桥' }],
  }
  devourer.behavior.chaosTokenRevealed(bridgeState, { seat: 0, location: 'woodenBridge' }, '0', { info() {} })
  assert.equal(bridgeState.skillTest.pendingExtraReveals.length, 1)
  // 50041 / 50042 生成 - 最远的无人地点。
  const spawnState = {
    scenarioFlags: {}, campaign: {}, round: 1,
    investigators: [{ seat: 0, location: 'a' }],
    locations: [
      { id: 'a', connections: ['b'] }, { id: 'b', connections: ['a', 'c'] },
      { id: 'c', connections: ['b', 'd'] }, { id: 'd', connections: ['c'] },
    ],
    enemies: [],
  }
  const farthest = devourer.behavior.spawnLocation(spawnState, '50041', 'a', 0, {
    locationDistance: (from, targets) => ({ a: 0, b: 1, c: 2, d: 3 })[targets[0]] ?? -1,
    info() {},
  })
  assert.equal(farthest, 'd', '应生成在离抽牌者最远的无人地点')
  // 有调查员/敌人的地点算「非无人」。
  spawnState.investigators.push({ seat: 1, location: 'd' })
  assert.equal(devourer.behavior.spawnLocation(spawnState, '50042', 'a', 0, {
    locationDistance: (from, targets) => ({ a: 0, b: 1, c: 2, d: 3 })[targets[0]] ?? -1,
    info() {},
  }), 'c')
  // 01175 尖叫的拜亚基：与剩余神智 ≤4 的调查员交战时 +1 攻击 +1 躲避。
  const byakheeState = {
    investigators: [{ seat: 0, sanity: 6, horror: 2, location: 'x' }],
    enemies: [], locations: [], scenarioFlags: {}, campaign: {},
    agendas: [{ originalCode: '01143' }], agendaIndex: 0,
  }
  const byakhee = { id: 'e7', code: '01175', originalCode: '01175', engagedSeat: 0, location: 'x' }
  assert.equal(devourer.behavior.enemyStatModifier(byakheeState, byakhee, 'fight'), 1)
  assert.equal(devourer.behavior.enemyStatModifier(byakheeState, byakhee, 'evade'), 1)
  byakheeState.investigators[0].horror = 0
  assert.equal(devourer.behavior.enemyStatModifier(byakheeState, byakhee, 'fight'), 0)
})

// ---------------------------------------------------------------------------
// 4. 密谋 3 背面：地底噬魔降临（真实引擎生成 + 50032b 资源）
// ---------------------------------------------------------------------------
test('RtDB：密谋 3 背面生成乌默尔多斯，50032b 按剩余幕数放资源并加攻击/生命', () => {
  const game = newGame('ret-notz-devourer-umordhoth')
  startChapter(game)
  const inv = game.investigators[0]
  prepareTurn(game, inv)
  inv.location = 'mainPath'
  inv.clues = 3
  applyMove(game, 0, { action: 'advanceAct' })
  settle(game)
  assert.ok(game.locations.some(location => location.id === 'ritualSite'), '仪式地已因幕 1 背面入场')
  // 直接把密谋推进到 3，再真实推进一次触发 01145 背面（以真实 advanceAgenda 走事务）。
  game.agendas = [game.agendas[2]]
  game.agendaIndex = 0
  game.doom = game.agendas[0].doomThreshold
  inTransaction(game, draft => advanceAgenda(draft, []))
  settle(game)
  const boss = game.enemies.find(enemy => enemy.code === '01157')
  assert.ok(boss, '密谋 3 背面应生成乌默尔多斯')
  assert.equal(boss.location, 'ritualSite')
  assert.equal(game.scenarioFlags.retDevourerVault.resources, 2, '幕 1 已推进：剩余幕 2 张 → 2 资源')
  assert.equal(game.scenarioFlags.retDevourerVault.inPlay, true)
  assert.deepEqual(game.acts.map(act => act.originalCode), ['01145'], '以「地底噬魔」替代当前幕/密谋')
  assert.equal(game.acts[0].objective.type, 'defeatEnemy')
  assert.equal(game.acts[0].objective.enemy, '01157')
  // 胜利目标：乌默尔多斯被击败 → 结局 2（forced 声明）。
  assert.equal(devourer.behavior.agendaForcedEnemyDefeated(game, boss, { finish: key => { game._finishKey = key }, info() {} }), true)
  assert.equal(game._finishKey, 'r2')
})

// ---------------------------------------------------------------------------
// 5. 结局声明
// ---------------------------------------------------------------------------
test('RtDB：结局记录/创伤/XP 声明（r1 +5 / r2 +10 / r3 牺牲丽塔）', () => {
  const fixture = () => ({
    campaign: { leadSeat: 0, records: {}, investigators: {} },
    investigators: [{ seat: 0, resigned: false, defeated: false }],
    victoryDisplay: [], scenarioFlags: {}, scenarioZones: {},
  })
  const r1 = devourer.behavior.resolution(fixture(), 'r1', [], { info() {} })
  assert.equal(r1.bonus, 5)
  assert.equal(r1.award, true)
  assert.ok(r1.effects.some(effect => effect.record?.ritualBroken === true))
  assert.ok(r1.effects.some(effect => effect.trauma?.all?.mental === 2))
  const r2 = devourer.behavior.resolution(fixture(), 'r2', [], { info() {} })
  assert.equal(r2.bonus, 10)
  assert.ok(r2.effects.some(effect => effect.record?.repelledUmordhoth === true))
  assert.ok(r2.effects.some(effect => effect.trauma?.all?.physical === 2))
  const r3 = devourer.behavior.resolution(fixture(), 'r3', [], { info() {} })
  assert.equal(r3.bonus, 0)
  assert.ok(r3.effects.some(effect => effect.record?.sacrificedLita === true))
  const noResolution = devourer.behavior.resolution(fixture(), 'noResolution', [], { info() {} })
  assert.equal(noResolution.award, false)
  assert.ok(noResolution.effects.some(effect => effect.record?.succumbedToUmordhoth === true))
})

// ---------------------------------------------------------------------------
// 5. JSON 存档往返
// ---------------------------------------------------------------------------
test('RtDB：JSON 存档往返（migrateState）后视图/合法行动/重放动作一致', () => {
  const game = newGame('ret-notz-devourer-save')
  startChapter(game)
  const inv = game.investigators[0]
  prepareTurn(game, inv)
  const saved = JSON.parse(JSON.stringify(game))
  migrateState(saved)
  assert.equal(JSON.stringify(viewState(saved, 0)), JSON.stringify(viewState(game, 0)), '存档往返后观察投影应一致')
  const movesBefore = legalMoves(game).map(move => `${move.action}:${move.locationId ?? move.enemyId ?? ''}`).sort()
  const movesAfter = legalMoves(saved).map(move => `${move.action}:${move.locationId ?? move.enemyId ?? ''}`).sort()
  assert.deepEqual(movesAfter, movesBefore, '存档往返后合法行动应一致')
  const replay = JSON.parse(JSON.stringify(saved))
  applyMove(game, 0, { action: 'resource' })
  settle(game)
  applyMove(replay, 0, { action: 'resource' })
  settle(replay)
  assert.equal(JSON.stringify(viewState(replay, 0)), JSON.stringify(viewState(game, 0)), '存档重放动作后投影应一致')
})
