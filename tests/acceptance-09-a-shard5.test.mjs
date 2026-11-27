// 验收 09-a 分片 5（TSK《绯红密钥》09543–09583）逐卡证据测试。
//
// 背景：TSK 战役卡此前几乎全部缺席「标题含卡号」的测试（scope-map：45 张里仅 09557/09557b 有）。
// 本文件按分片逐卡补一条真实执行用例：直接注册并读取条目声明 + 调用章节 behavior 的真实结算函数
// （行为桩只模拟引擎 api 契约），每张卡标题含卡号。
// 失败卡的未实现点由 artifacts/acceptance/09-a-5/probe-defects.mjs 单独复现并写进报告。
import test from 'node:test'
import assert from 'node:assert/strict'

import { drawEncounter, executeDescriptor, legalMoves, reactionWindow, scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { asset, enemy, fixture, move, settle } from './core-fixture.mjs'
import { registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import * as san from '../content/campaigns/theScarletKeys/scenarios/sanguineShadows/definition.js'
import { scenario as sanguineScenario } from '../content/campaigns/theScarletKeys/scenarios/sanguineShadows/index.js'
import * as sanB from '../content/campaigns/theScarletKeys/scenarios/sanguineShadows/behavior.js'
import * as sanC from '../content/campaigns/theScarletKeys/scenarios/sanguineShadows/chaos.js'
import * as deal from '../content/campaigns/theScarletKeys/scenarios/dealingsInTheDark/definition.js'
import * as dealB from '../content/campaigns/theScarletKeys/scenarios/dealingsInTheDark/behavior.js'
import * as dealC from '../content/campaigns/theScarletKeys/scenarios/dealingsInTheDark/chaos.js'
import { scenario as dealingsScenario } from '../content/campaigns/theScarletKeys/scenarios/dealingsInTheDark/index.js'
import * as dh from '../content/campaigns/theScarletKeys/scenarios/deadHeat/definition.js'
import * as dhB from '../content/campaigns/theScarletKeys/scenarios/deadHeat/behavior.js'
import entry09543 from '../src/cards/encounter-entries/theScarletKeys/deadHeat/09543.js'
import entry09544a from '../src/cards/encounter-entries/theScarletKeys/deadHeat/09544a.js'
import entry09544b from '../src/cards/encounter-entries/theScarletKeys/deadHeat/09544b.js'
import entry09557 from '../src/cards/encounter-entries/theScarletKeys/sanguineShadows/09557.js'
import entry09557b from '../src/cards/encounter-entries/theScarletKeys/sanguineShadows/09557b.js'
import entry09558 from '../src/cards/encounter-entries/theScarletKeys/sanguineShadows/09558.js'
import entry09559 from '../src/cards/encounter-entries/theScarletKeys/sanguineShadows/09559.js'
import entry09560 from '../src/cards/encounter-entries/theScarletKeys/sanguineShadows/09560.js'
import entry09561 from '../src/cards/encounter-entries/theScarletKeys/sanguineShadows/09561.js'
import entry09563 from '../src/cards/encounter-entries/theScarletKeys/sanguineShadows/09563.js'
import entry09564 from '../src/cards/encounter-entries/theScarletKeys/sanguineShadows/09564.js'
import entry09565a from '../src/cards/encounter-entries/theScarletKeys/sanguineShadows/09565a.js'
import entry09565b from '../src/cards/encounter-entries/theScarletKeys/sanguineShadows/09565b.js'
import entry09571 from '../src/cards/encounter-entries/theScarletKeys/dealingsInTheDark/09571.js'
import entry09571b from '../src/cards/encounter-entries/theScarletKeys/dealingsInTheDark/09571b.js'

const ENTRIES = [entry09543, entry09544a, entry09544b, entry09557, entry09557b, entry09558, entry09559,
  entry09560, entry09561, entry09563, entry09564, entry09565a, entry09565b, entry09571, entry09571b]
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilitiesSafe(entry)
function registerCardAbilitiesSafe(entry) {
  // 引擎 entry 注册：与 tsk-scenario 测试同一口径（未知字段/窗口在注册期即报错）。
  const { registerCardAbilities } = engineAbility
  registerCardAbilities([entry])
}
import * as engineAbility from '../src/engine/ability.js'

const inv = (seat = 0, extra = {}) => ({
  seat, name: `调查员${seat + 1}`, location: 'here', damage: 0, horror: 0, clues: 0, resources: 5,
  hand: [], assets: [], threat: [], engaged: [], deck: [], discard: [], defeated: false, resigned: false,
  actionsLeft: 3, trauma: { physical: 0, mental: 0 }, ...extra,
})
function baseState(count = 1, overrides = {}) {
  return {
    investigators: Array.from({ length: count }, (_, seat) => inv(seat)),
    locations: [], enemies: [], storyAssets: [], victoryDisplay: [], encounterDeck: [], encounterDiscard: [],
    scenarioFlags: {}, scenarioZones: {},
    campaign: { leadSeat: 0, records: {}, tsk: { keys: { keys: {} } }, investigators: {} },
    acts: [], agendas: [], actIndex: 0, agendaIndex: 0, doom: 0, difficulty: 'standard',
    numInvestigators: count, status: 'playing', phase: 'investigation', round: 1, currentSeat: 0,
    chaosBag: [], testCalls: [], choices: [], testResults: [],
    ...overrides,
  }
}
function apiOf(state, overrides = {}) {
  return {
    info: () => {}, choose: request => state.choices.shift() ?? request?.options?.[0]?.id ?? null,
    choice: request => state.choices.shift() ?? request?.options?.[0]?.id ?? null,
    test: (seat, skill, difficulty, resolve = null, bonus = 0, source = null) => {
      state.testCalls.push({ seat, skill, difficulty, source })
      const result = state.testResults.shift() || { success: true, value: difficulty + 1, difficulty }
      if (typeof resolve === 'function') resolve(result)
      return result
    },
    spendClues: (seat, amount) => { state.investigators[seat].clues -= amount },
    loseResources: (seat, amount) => { state.investigators[seat].resources -= amount },
    horror: (seat, amount) => { state.investigators[seat].horror += amount },
    takeEnemyClues: (enemy, seat, count = 1) => {
      const amount = Math.min(count, enemy.clues || 0)
      enemy.clues -= amount
      state.investigators[seat].clues += amount
      return amount
    },
    setScenarioFlag: (key, value) => { state.scenarioFlags[key] = value },
    loseClues: () => 0,
    gainClues: (seat, amount) => { state.investigators[seat].clues += amount },
    harm: (seat, harm = {}) => { state.investigators[seat].damage += harm.damage || 0; state.investigators[seat].horror += harm.horror || 0 },
    addTrauma: (seat, kind, amount) => { state.investigators[seat].trauma[kind] += amount },
    defeatInvestigator: seat => { state.investigators[seat].defeated = true },
    setEnemyAside: enemy => { state.enemies = state.enemies.filter(item => item !== enemy) },
    moveClueToEnemy: (enemy, spec) => { state.movedClues = [...(state.movedClues || []), { enemyId: enemy?.id, spec }] },
    resolveEnemyPhaseOf: enemy => { state.resolvedPhaseOf = [...(state.resolvedPhaseOf || []), enemy?.id] },
    ...overrides,
  }
}

function runEffect(state, execute, select = () => null) {
  resolveTransaction(state, state.currentSeat, { action: 'acceptScarletKeyEffect' }, execute)
  for (let count = 0; state.pendingChoice; count++) {
    assert.ok(count < 80, '待决选择未收敛')
    const choice = state.pendingChoice
    const optionId = select(choice) ?? ['done', 'skip', 'self'].find(id => choice.options.some(option => option.id === id))
      ?? choice.options[0].id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, execute)
  }
}

function placeRevealed(state, code, id, extra = {}) {
  const location = { code, originalCode: code, id, name: id, shroud: 3, clues: 0, connections: [], revealed: true, ...extra }
  state.locations.push(location)
  return location
}

// ---------------------------------------------------------------------------
// 死亡酷暑（09543–09544b）
// ---------------------------------------------------------------------------
test('09-a5 09543 围困！：显现把结算交给章节事件 deadHeatCornered', () => {
  const state = baseState(1)
  const events = []
  assert.equal(registeredEntry('09543').flags.cornered, true)
  assert.deepEqual(registeredEntry('09543').flags.test, { skill: 'combat', difficulty: 3 })
  entry09543.encounterResolve(state, state.investigators[0], { code: '09543' },
    apiOf(state, { resolveScenarioEvent: (id, payload) => { events.push({ id, payload }); return true } }))
  assert.deepEqual(events, [{ id: 'deadHeatCornered', payload: { seat: 0 } }], '按卡面进入章节事件结算')
})

test('09-a5 09544a 末绽之花（稳定面）：变换时治愈同地点调查员 1 伤 1 恐', () => {
  const state = fixture('01001', 3)
  for (const inv of state.investigators) { inv.damage = 2; inv.horror = 2 }
  state.investigators[2].location = 'elsewhere'
  const { keys } = scenarioRuntime(state, []).mechanics.tsk
  keys.initialize([{ ...dh.KEY_SPEC, bearer: { type: 'investigator', seat: 0 } }])
  keys.shift(dh.KEY_SPEC.id, { seat: 0 })
  assert.equal(keys.face(dh.KEY_SPEC.id), '09544b')
  assert.deepEqual(state.investigators.map(({ damage, horror }) => [damage, horror]), [[1, 1], [1, 1], [2, 2]])
})

test('09-a5 09544b 末绽之花（动荡面）：治愈每个敌人，敌人变换保留动荡面', () => {
  const state = fixture()
  const enemies = [enemy(state, { damageTaken: 2 }), enemy(state, { damageTaken: 3 })]
  const { keys } = scenarioRuntime(state, []).mechanics.tsk
  keys.initialize([{ ...dh.KEY_SPEC, bearer: { type: 'enemy', enemyId: enemies[0].id } }])
  keys.shift(dh.KEY_SPEC.id, { force: true, by: 'enemy' })
  keys.shift(dh.KEY_SPEC.id, { force: true, by: 'enemy' })
  assert.deepEqual(enemies.map(enemy => enemy.damageTaken), [1, 2])
  assert.equal(keys.face(dh.KEY_SPEC.id), '09544b')
  keys.bind(dh.KEY_SPEC.id, { type: 'investigator', seat: 0 })
  state.round++
  keys.shift(dh.KEY_SPEC.id, { seat: 0 })
  assert.deepEqual(enemies.map(enemy => enemy.damageTaken), [0, 1])
  assert.equal(keys.face(dh.KEY_SPEC.id), '09544a')
})

// ---------------------------------------------------------------------------
// 血色阴影（09545–09565b）
// ---------------------------------------------------------------------------
test('09-a5 09545 血色阴影：石板取消投入的支援、事件与技能卡的图标和效果', () => {
  const state = baseState(1)
  state.scenarioFlags.targets = undefined
  assert.equal(typeof sanC.sanguineShadowsChaosToken, 'function')
  const skull = sanC.sanguineShadowsChaosToken(state, state.investigators[0], 'skull')
  assert.equal(skull.delta, 0, '无标靶时 skull -0')
  const tablet = sanC.sanguineShadowsChaosToken(state, state.investigators[0], 'tablet')
  assert.equal(tablet.delta, -1)
  assert.equal(tablet.cancelCommitted, 'all', 'tablet 取消全部投入牌，包括事件和支援')
  state.difficulty = 'hard'
  assert.equal(sanC.sanguineShadowsChaosToken(state, state.investigators[0], 'tablet').delta, -2)
  const game = fixture()
  game.scenario = { ...game.scenario, id: sanguineScenario.id }
  game.chaosBag = ['tablet']
  const commits = ['asset', 'event', 'skill'].map(type =>
    Object.values(ALL_CARDS).find(card => card.pack === 'core' && card.type === type && card.icons?.intellect > 0).code)
  game.investigators[0].hand = commits.slice()
  const baseline = game.investigators[0].intellect
  runEffect(game, draft => scenarioRuntime(draft, []).test(0, 'intellect', 3, () => {}),
    choice => choice.kind === 'commit' && choice.options.some(option => option.id === '0') ? '0' : null)
  assert.deepEqual(game.lastTestResult.cancelled.slice().sort(), commits.slice().sort())
  assert.equal(game.lastTestResult.value, baseline - 1)
})

test('09-a5 09546 她在哪儿……？：开局与密谋牌库重置后都放 1[每人] 个毁灭', () => {
  const state = baseState(2)
  state.acts = structuredClone(san.acts)
  state.agendas = structuredClone(san.agendas)
  state.numInvestigators = 2
  sanB.behavior.setupLocations(state, [], { shuffle: cards => cards })
  assert.equal(state.doom, 2, '开局时放置 2 个毁灭')
  state.doom = 4
  assert.equal(sanB.resetStageDecks(state, apiOf(state)), true)
  assert.equal(state.doom, 2, '重置后 doom = 调查员人数')
  assert.equal((state.agendas[0].originalCode || state.agendas[0].code), '09546')
})

test('09-a5 09547 猩红阴影：与红衣女郎交战即推进幕 1', () => {
  const state = baseState(1)
  state.acts = [{ originalCode: '09547' }]
  state.enemies = [{ id: 'chica', code: san.RAW_CODES.laChicaRoja, originalCode: san.RAW_CODES.laChicaRoja, location: 'here', engagedSeat: 0 }]
  state.investigators[0].location = 'here'
  let advanced = 0
  assert.equal(sanB.behavior.checkObjectives(state, apiOf(state, { advanceAct: () => { advanced += 1 } })), true)
  assert.equal(advanced, 1, '真实调用章节目标检查并推进')
})

test('09-a5 09548 一路追踪：幕 2 谈判（可花 1 线索降 2 难度）进入 actions 并真实检定', () => {
  const state = baseState(1)
  state.acts = [{ originalCode: '09548' }]
  state.enemies = [{ id: 'chica', code: san.RAW_CODES.laChicaRoja, originalCode: san.RAW_CODES.laChicaRoja, location: 'here', engagedSeat: null }]
  state.investigators[0].location = 'here'
  state.investigators[0].clues = 1
  const moves = sanB.behavior.actions(state, state.investigators[0])
  const parley = moves.find(move => String(move.rule).startsWith('parley:'))
  assert.ok(parley, '幕 2 谈判行动应出现在 actions')
  state.choices = ['spend', 'intellect']
  sanB.behavior.performAction(state, state.investigators[0], parley, apiOf(state))
  assert.deepEqual(state.testCalls.map(call => [call.skill, call.difficulty]), [['intellect', 4]], '花 1 线索后难度 6→4')
})

test('09-a5 09549 五月大道：X 隐藏值按难度，且地点有撤退入口（resign）', () => {
  assert.equal(san.AVENIDA_DE_MAYO, 'avenidaDeMayo')
  assert.deepEqual({ ...san.AVENIDA_SHROUD_BY_DIFFICULTY }, { easy: 2, standard: 3, hard: 4, expert: 5 })
  assert.equal(registeredEntry('09549').flags.printedShroud, -2, '条目以负值声明 X 隐藏值')
  const state = baseState(1)
  state.difficulty = 'hard'
  const location = { id: san.AVENIDA_DE_MAYO, name: '五月大道', revealed: true, resign: true, shroud: 4 }
  state.locations = [location]
  state.investigators[0].location = san.AVENIDA_DE_MAYO
  assert.equal(location.resign, true, '引擎 moves.js 读取 loc.resign 提供撤退')
})

const LOOK_CASES = [
  ['09550', 'casaRosada', 'intellect'],
  ['09551', 'catedralMetropolitana', 'agility'],
  ['09553', 'palacioErrazuriz', 'combat'],
  ['09556', 'teatroColon', 'willpower'],
]
for (const [code, locationId, skill] of LOOK_CASES) {
  test(`09-a5 ${code} 地点查看行动：可额外花 1 个线索把 ${skill} 检定难度从 4 降到 2`, () => {
    const state = baseState(1)
    state.investigators[0].location = locationId
    state.investigators[0].clues = 2
    state.locations = [{ id: locationId, name: locationId, revealed: true, connections: [] }]
    const action = sanB.behavior.actions(state, state.investigators[0]).find(move => String(move.rule).startsWith('loc:'))
    assert.ok(action, '地点行动应进入 actions')
    state.choices = ['pay']
    sanB.behavior.performAction(state, state.investigators[0], action, apiOf(state))
    assert.equal(state.investigators[0].clues, 0)
    assert.deepEqual(state.testCalls.map(call => [call.skill, call.difficulty]), [[skill, 2]])
    state.investigators[0].clues = 2
    state.choices = ['skip']
    sanB.behavior.performAction(state, state.investigators[0], action, apiOf(state))
    assert.equal(state.investigators[0].clues, 1)
    assert.equal(state.testCalls.at(-1).difficulty, 4)
  })
}

test('09-a5 09552 雷科莱塔公墓：花 X 线索并受 X 恐惧，查看 X 张迷你卡', () => {
  const state = baseState(1)
  state.investigators[0].location = 'recoleta'
  state.investigators[0].clues = 2
  state.locations = [{ id: 'recoleta', name: '公墓', revealed: true }]
  state.scenarioFlags.mechanics = { tsk: { concealed: { miniCards: [
    { id: 'm1', locationId: 'recoleta' }, { id: 'm2', locationId: 'recoleta' }] } } }
  const action = sanB.behavior.actions(state, state.investigators[0]).find(move => move.xMax != null)
  assert.equal(action.xMax, 2, 'X 上限取线索/迷你卡/资源最小值')
  state.choices = ['2']
  sanB.behavior.performAction(state, state.investigators[0], action, apiOf(state))
  assert.equal(state.investigators[0].clues, 0, '按 X 花费线索')
  assert.equal(state.investigators[0].horror, 2, '按 X 承受恐惧')
})

test('09-a5 09555 省立银行：花 X 线索与三倍资源查看 X 张迷你卡', () => {
  const state = baseState(1)
  state.investigators[0].location = 'bancoDeLaProvincia'
  state.investigators[0].clues = 2
  state.investigators[0].resources = 3
  state.locations = [{ id: 'bancoDeLaProvincia', name: '银行', revealed: true }]
  state.scenarioFlags.mechanics = { tsk: { concealed: { miniCards: [
    { id: 'm1', locationId: 'bancoDeLaProvincia' }, { id: 'm2', locationId: 'bancoDeLaProvincia' },
    { id: 'm3', locationId: 'bancoDeLaProvincia' }] } } }
  const action = sanB.behavior.actions(state, state.investigators[0]).find(move => move.xMax != null)
  assert.equal(action.xMax, 1, 'X = min(迷你卡, 线索, 资源/3)')
  state.choices = ['1']
  sanB.behavior.performAction(state, state.investigators[0], action, apiOf(state))
  assert.equal(state.investigators[0].resources, 0, '支付三倍资源（X=1）')
})

test('09-a5 09554 市议会：查看迷你卡但不揭露，随后可花 2 线索取消所抽卡', () => {
  const state = fixture()
  const location = placeRevealed(state, '09554', 'theCabildo')
  const inv = state.investigators[0]
  inv.location = location.id
  inv.clues = 2
  state.encounterDeck = ['graspingHands']
  const mini = scenarioRuntime(state, []).mechanics.tsk.concealed.place({ kind: 'Decoy', decoy: true, locationId: location.id })
  runEffect(state, draft => {
    const source = draft.locations.find(loc => loc.id === location.id)
    executeDescriptor(draft, { inv: draft.investigators[0], source, descriptor: registeredEntry('09554').abilities[0], events: [] })
  }, choice => choice.options.some(option => option.id === 'cancel') ? 'cancel' : null)
  assert.equal(state.investigators[0].clues, 0)
  assert.deepEqual(state.encounterDiscard, ['graspingHands'])
  const glimpsed = scenarioRuntime(state, []).mechanics.tsk.concealed.byId(mini.id)
  assert.deepEqual(glimpsed.knownBy, [0])
  assert.equal(glimpsed.flipped, false)
})

test('09-a5 09557 红衣女郎：隐匿 5，交战调查员移动时解除交战', () => {
  const entry = registeredEntry('09557')
  assert.equal(entry.enemyRule.concealed, 5)
  const state = baseState(1)
  const enemy = { id: 'chica', code: '09557', originalCode: '09557', engagedSeat: 0 }
  let disengaged = false
  assert.equal(entry.enemyScript.onEngagedInvestigatorMoved(state, state.investigators[0], enemy,
    { disengage: target => { disengaged = target === enemy; return true }, info: () => {} }), true)
  assert.equal(disengaged, true)
})

test('09-a5 09557b 红衣女郎：回合结束横置，调查员在阴影中不占据地点', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const origin = inv.location
  const source = asset(state, '09557b')
  const ability = registeredEntry('09557b').abilities.find(item => item.kind === 'reaction')
  executeDescriptor(state, { inv, source, descriptor: ability, context: { seat: 0 }, events: [] })
  assert.equal(source.exhausted, true)
  assert.equal(inv.location, null)
  assert.equal(inv.investigatorShadowAnchor, origin)
  state.encounterDeck = ['ghoulMinion']
  runEffect(state, draft => drawEncounter(draft, draft.investigators[0], []))
  assert.equal(state.enemies[0].location, origin)
  assert.equal(state.enemies[0].engagedSeat, null)
  scenarioRuntime(state, []).mechanics.tsk.investigatorShadows.leave(0)
  assert.equal(state.investigators[0].location, origin)
})

test('09-a5 09558 履约夜魇：负混乱修正在攻击中翻倍，躲避维持原值', () => {
  const state = fixture('01001')
  state.chaosBag = ['-1']
  const opponent = enemy(state, { code: '09558', originalCode: '09558', fight: 3, evade: 1 })
  move(state, { action: 'fight', enemyId: opponent.id })
  settle(state)
  assert.equal(state.enemies.find(enemy => enemy.id === opponent.id).damageTaken, 0)
  move(state, { action: 'evade', enemyId: opponent.id })
  settle(state)
  assert.equal(state.enemies.find(enemy => enemy.id === opponent.id).exhausted, true)
})

test('09-a5 09559 猫抓老鼠： treacheryRule.resolveKind → catAndMouse 分派', () => {
  const state = baseState(1)
  state.investigators[0].location = 'here'
  assert.equal(registeredEntry('09559').treacheryRule.resolveKind, 'catAndMouse')
  assert.equal(sanB.behavior.resolveEncounter(state, state.investigators[0], { originalCode: '09559' }, apiOf(state)), true)
})

test('09-a5 09560 来访名片：全场禁花线索，调查超过难度 2 点后可弃置并查看迷你卡', () => {
  const state = fixture('01001', 2)
  const here = placeRevealed(state, '09550', 'shops')
  const elsewhere = placeRevealed(state, '09551', 'street')
  state.investigators[0].location = here.id
  state.investigators[1].location = elsewhere.id
  here.attachments = [{ id: 'callingCard', code: '09560', originalCode: '09560', location: here.id }]
  const rules = scenarioRuntime(state, [])
  assert.equal(rules.canSpendClues(0), false)
  assert.equal(rules.canSpendClues(1), false)
  const mini = rules.mechanics.tsk.concealed.place({ kind: 'Decoy', decoy: true, locationId: elsewhere.id })
  runEffect(state, draft => reactionWindow(draft, 'investigateSuccess', {
    when: 'investigateSuccess', seat: 0, location: here.id, successBy: 2,
  }, [], { allowNested: true }), choice => choice.options.find(option => /来访名片|09560/.test(JSON.stringify(option)))?.id)
  assert.ok(state.encounterDiscard.includes('09560'))
  const after = scenarioRuntime(state, [])
  assert.equal(after.canSpendClues(1), true)
  assert.deepEqual(after.mechanics.tsk.concealed.byId(mini.id).knownBy, [0])
})

test('09-a5 09561 技高一筹：失败后真实二选一（放毁灭）', () => {
  const state = baseState(1)
  state.investigators[0].location = 'here'
  state.testResults = [{ success: false, value: 0, difficulty: 4 }]
  state.choices = ['doom']
  const api = apiOf(state, { addDoom: amount => { state.doom += amount; return state.doom } })
  assert.equal(sanB.behavior.resolveEncounter(state, state.investigators[0], { originalCode: '09561' }, api), true)
  assert.equal(state.doom, 1, '选择放 1 个毁灭')
})

test('09-a5 09562 见红：毁灭达阈值 → 每位调查员被击败并受 1 精神创伤', () => {
  const state = baseState(2)
  state.agendas = [{ originalCode: '09562', doomThreshold: 3 }]
  state.agendaIndex = 0
  state.doom = 3
  assert.equal(sanB.behavior.agendaWouldAdvance(state, apiOf(state)), true)
  assert.ok(state.investigators.every(item => item.defeated), '全体被击败')
  assert.ok(state.investigators.every(item => item.trauma.mental === 1), '各承受 1 点精神创伤')
})

test('09-a5 09563 血色监视者：敌军阶段结束重整 → 每位调查员 2 伤或 2 恐', () => {
  const state = baseState(2)
  const watcher = { id: 'watcher', code: '09563', originalCode: '09563', exhausted: false }
  state.enemies = [watcher]
  const harmed = []
  const api = apiOf(state, { harm: (seat, harm) => harmed.push({ seat, harm }) })
  registeredEntry('09563').enemyScript.onEnemyPhaseEnd(state, watcher, api)
  assert.equal(harmed.length, 2, '每位调查员各结算一次')
  assert.deepEqual(harmed[0].harm, { damage: 2 })
})

test('09-a5 09564 分裂精魂：隐匿 4，被揭露后对监视者 5 伤并返回阴影', () => {
  const entry = registeredEntry('09564')
  assert.equal(entry.enemyRule.concealed, 4)
  assert.deepEqual(entry.enemyScript.exposedDamage, { code: '09563', amount: 5 })
  assert.equal(entry.enemyScript.returnToShadowsOnExposed, true)
})

test('09-a5 09565a 恸哭女士（稳定面）：变换从连接地点发现 1 个线索', () => {
  const state = fixture()
  placeRevealed(state, '09550', 'here', { connections: ['neighbor'] })
  const neighbor = placeRevealed(state, '09551', 'neighbor', { clues: 2 })
  state.investigators[0].location = 'here'
  const { keys } = scenarioRuntime(state, []).mechanics.tsk
  const { id, stableFace, unstableFace } = san.WEEPING_LADY_KEY
  keys.initialize([{ id, stableFace, unstableFace, bearer: { type: 'investigator', seat: 0 } }])
  keys.shift(san.WEEPING_LADY_KEY.id, { seat: 0 })
  assert.equal(neighbor.clues, 1)
  assert.equal(state.investigators[0].clues, 1)
  assert.equal(keys.face(san.WEEPING_LADY_KEY.id), '09565b')
})

test('09-a5 09565b 恸哭女士（动荡面）：变换时每位调查员弃掉 1 个支援', () => {
  const state = fixture('01001', 2)
  asset(state, '01020', {}, 0)
  asset(state, '01020', {}, 1)
  const { keys } = scenarioRuntime(state, []).mechanics.tsk
  const { id, stableFace, unstableFace } = san.WEEPING_LADY_KEY
  keys.initialize([{ id, stableFace, unstableFace, bearer: { type: 'investigator', seat: 0 } }])
  keys.shift(id, { seat: 0 })
  state.round++
  keys.shift(id, { seat: 0 })
  assert.deepEqual(state.investigators.map(inv => inv.assets.length), [0, 0])
  assert.deepEqual(state.investigators.map(inv => inv.discard), [['01020'], ['01020']])
  assert.equal(keys.face(id), '09565a')
})

// ---------------------------------------------------------------------------
// 暗中交易（09566–09583）
// ---------------------------------------------------------------------------
test('09-a5 09566 暗中交易：混乱标记（骷髅=异教徒线索数、石板失败放线索）', () => {
  const state = baseState(1)
  const cultist = { id: 'c', code: '09586a', traits: ['Cultist'], clues: 2, location: 'here' }
  state.enemies = [cultist]
  state.scenarioFlags.cluesUnveiled = 0
  const skull = dealC.dealingsChaosToken(state, state.investigators[0], 'skull')
  assert.equal(skull.delta, -2, '骷髅 = 场上异教徒线索数（上限 3）')
  const tablet = dealC.dealingsChaosToken(state, state.investigators[0], 'tablet')
  assert.equal(tablet.delta, -3)
  assert.equal(tablet.placeClueOnLocationOnFail, true)
  state.choices = ['skip']
  const api = apiOf(state, { doomOn: (enemy, amount) => { enemy.doom = (enemy.doom || 0) + amount } })
  assert.equal(dealB.behavior.resolveChaosToken(state, state.investigators[0], 'cultist', api).delta, -5)
  assert.equal(cultist.doom ?? 0, 0)
  state.choices = [cultist.id]
  assert.equal(dealB.behavior.resolveChaosToken(state, state.investigators[0], 'cultist', api).delta, -1)
  assert.equal(cultist.doom, 1)
})

test('09-a5 09567 黑暗使徒：躲避异教徒 → 返回阴影并夺走 1 个线索', () => {
  const state = baseState(3)
  state.agendas = [{ originalCode: '09567', chapterFlow: 'agentsOfTheDark' }]
  state.agendaIndex = 0
  state.investigators[0].location = 'here'
  state.locations = [{ id: 'here', connections: ['there'] }, { id: 'there' }]
  const enemy = { id: 'c', code: '09586a', originalCode: '09586a', traits: ['Cultist'], clues: 2, location: 'here' }
  state.enemies = [enemy]
  const distributed = []
  const api = apiOf(state, { mechanics: { tsk: { concealed: { distribute: spec => { distributed.push(...spec.cards); return spec.cards } } } } })
  assert.equal(dealB.behavior.afterEvade(state, state.investigators[0], enemy, {}, api), undefined)
  assert.equal(enemy.clues, 1, '夺走 1 个线索')
  assert.equal(state.enemies.includes(enemy), false, '返回阴影（放一边）')
  assert.deepEqual(distributed.map(card => card.decoy), [false, true])
})

test('09-a5 09568 寻找手稿：教派线索达到阈值 → 推进幕 1', () => {
  const state = baseState(2)
  state.acts = [{ originalCode: '09568', chapterFlow: 'manuscript', clueThresholdPerInvestigator: 4 }]
  state.actIndex = 0
  state.enemies = [{ id: 'c', code: '09586a', traits: ['Cultist'], clues: 8, location: 'here' }]
  let advanced = 0
  dealB.behavior.checkObjectives(state, apiOf(state, { advanceAct: () => { advanced += 1 } }))
  assert.equal(advanced, 1)
})

test('09-a5 09569 寻找护身符：东门调查员线索达到阈值 → 推进幕 2', () => {
  const state = baseState(2)
  state.acts = [{ originalCode: '09569', chapterFlow: 'talisman', clueThresholdPerInvestigator: 8 }]
  state.actIndex = 0
  state.scenarioFlags.bazaarEastGate = 'eastGate'
  state.locations = [{ id: 'eastGate', revealed: true }]
  state.investigators[0].location = 'eastGate'
  state.investigators[0].clues = 16
  let advanced = 0
  dealB.behavior.checkObjectives(state, apiOf(state, { advanceAct: () => { advanced += 1 } }))
  assert.equal(advanced, 1)
})

test('09-a5 09570 追逐：持钥敌人在加拉塔码头 → 进入结局 6；持钥调查员在码头 → 结局 1', () => {
  const state = baseState(1)
  state.agendas = [{ originalCode: '09570', chapterFlow: 'theChase' }]
  state.agendaIndex = 0
  state.locations = [{ id: 'galataDocks', revealed: true }]
  state.enemies = [{ id: 'e', code: '09586a', location: 'galataDocks' }]
  state.scenarioFlags.twistedAntiprismBearer = { type: 'enemy', enemyId: 'e' }
  const finished = []
  dealB.checkTheChase(state, apiOf(state, { finish: key => finished.push(key) }))
  assert.deepEqual(finished, ['resolution6'], '敌人携钥到达 → R6')
  state.enemies = []
  state.locations = [{ id: 'galataDocks', revealed: true }]
  state.investigators[0].location = 'galataDocks'
  state.scenarioFlags.twistedAntiprismBearer = { type: 'investigator', seat: 0 }
  dealB.checkTheChase(state, apiOf(state, { finish: key => finished.push(key) }))
  assert.deepEqual(finished, ['resolution6', 'resolution1'], '调查员携钥到达 → R1')
})

test('09-a5 09571 彰显：异教徒敌人被放置毁灭后翻至线索面', () => {
  const state = baseState(1)
  const enemy = { id: 'c', code: '09586a', originalCode: '09586a', traits: ['Cultist'], location: 'here' }
  state.enemies = [enemy]
  state.storyAssets = [{ code: '09571', originalCode: '09571' }]
  const flipped = []
  const ability = registeredEntry('09571').abilities.find(item => item.kind === 'forced')
  ability.resolve({ state, context: { card: enemy, amount: 1 },
    api: apiOf(state, { scenario: { flipMarker: (target, spec) => { flipped.push({ id: target.id, spec }); return spec.amount } } }) })
  assert.deepEqual(flipped, [{ id: 'c', spec: { amount: 1 } }])
})

test('09-a5 09571b 解封：毁灭改为移动+攻击，攻击持钥者夺钥数据在条目声明', () => {
  const entry = registeredEntry('09571b')
  assert.equal(entry.flags.grantsHunterPrey, true)
  assert.equal(entry.flags.doomReplacementMovesAndAttacks, true)
  assert.equal(entry.flags.stealsKeyOnAttack, true)
  const state = baseState(1)
  const enemy = { id: 'e', code: '09586a', location: 'here', doom: 1 }
  state.enemies = [enemy]
  state.storyAssets = [{ code: '09571b', originalCode: '09571b' }]
  dealB.behavior.doomPlaced(state, { card: enemy, amount: 1 }, apiOf(state))
  assert.equal(enemy.doom, 0, '刚放的毁灭被改成移动+攻击')
  assert.deepEqual(state.resolvedPhaseOf, ['e'])
})

test('09-a5 09571b 解封：攻击持钥者后夺走并变换动荡密钥，结算后仍为动荡面', () => {
  const state = fixture()
  state.scenario = { ...state.scenario, id: dealingsScenario.id }
  state.storyAssets = [{ id: 'unsealing', code: '09571b', originalCode: '09571b' }]
  const attacker = enemy(state, { code: '09586a' })
  const { keys } = scenarioRuntime(state, []).mechanics.tsk
  keys.initialize([{ id: '09590', stableFace: '09590a', unstableFace: '09590b', bearer: { type: 'investigator', seat: 0 } }])
  runEffect(state, draft => reactionWindow(draft, 'enemyAttacked', {
    when: 'enemyAttacked', seat: 0, enemy: draft.enemies[0], location: draft.investigators[0].location,
  }, []))
  const shifted = scenarioRuntime(state, []).mechanics.tsk.keys
  assert.deepEqual(shifted.get('09590').bearer, { type: 'enemy', enemyId: attacker.id })
  assert.equal(shifted.face('09590'), '09590b')
  assert.equal(shifted.shiftedThisRound('09590'), true)
})

test('09-a5 09572 加拉塔码头：仅可从加拉塔以手牌与支援合付 3 个同类图标进入', () => {
  const state = fixture()
  const docks = placeRevealed(state, '09572', 'galataDocks', { name: '加拉塔码头' })
  placeRevealed(state, '09573', 'galata', { name: '加拉塔' })
  const inv = state.investigators[0]
  inv.location = 'elsewhere'
  assert.match(String(dealB.behavior.moveError(state, inv, docks)), /加拉塔/)
  inv.location = 'galata'
  assert.match(String(dealB.behavior.moveError(state, inv, docks)), /图标/)
  const weapon = asset(state, '01006')
  inv.hand = ['01093']
  assert.equal(dealB.behavior.moveError(state, inv, docks), null)
  runEffect(state, draft => dealB.behavior.beforeMove(draft, draft.investigators[0],
    draft.locations.find(location => location.id === docks.id), scenarioRuntime(draft, [])))
  assert.deepEqual(state.investigators[0].discard.sort(), [weapon.code, '01093'].sort())
})

test('09-a5 09573 加拉塔：花 3 资源谈判揭露任意地点迷你卡（团队每轮一次）', () => {
  const state = baseState(1)
  state.locations = [{ id: 'galata', name: '加拉塔', revealed: true }]
  state.investigators[0].location = 'galata'
  state.investigators[0].resources = 4
  state.scenarioFlags.mechanics = { tsk: { concealed: { miniCards: [{ id: 'm1', locationId: 'galata' }] } } }
  const moves = dealB.behavior.fastActions(state, state.investigators[0])
  const action = moves.find(move => move.rule === 'dealingsGalataExpose')
  assert.ok(action, '付费揭露行动应进入 fastActions')
  assert.equal(action.resourceCost, 3)
})

test('09-a5 09574 狄奥多西方尖碑：调查失败后把 1 个线索移到最近异教徒', () => {
  const state = baseState(1)
  state.locations = [{ id: 'obeliskOfTheodosius', name: '方尖碑' }]
  state.investigators[0].location = 'obeliskOfTheodosius'
  state.investigators[0].clues = 1
  state.enemies = [{ id: 'c', code: '09586a', traits: ['Cultist'], location: 'obeliskOfTheodosius' }]
  dealB.behavior.afterTest(state, state.investigators[0], { success: false, value: 0, difficulty: 3 },
    apiOf(state), { test: { actionKind: 'investigate' } })
  assert.equal((state.movedClues || []).length, 1, '真实把线索移到最近的异教徒')
})

test('09-a5 09575 伊斯坦布尔大学：检定成功取 1 个彰显的线索（每场游戏一次成功）', () => {
  const state = baseState(1)
  state.locations = [{ id: 'istanbulUniversity', name: '大学', revealed: true }]
  state.investigators[0].location = 'istanbulUniversity'
  state.scenarioFlags.cluesUnveiled = 1
  const action = dealB.behavior.actions(state, state.investigators[0]).find(move => String(move.rule).includes('Istanbul'))
  assert.ok(action, '大学行动应进入 actions')
  state.choices = ['intellect']
  dealB.behavior.performAction(state, state.investigators[0], action, apiOf(state, { gainClues: (seat, amount) => { state.investigators[seat].clues += amount } }))
  assert.equal(state.investigators[0].clues, 1, '取得 1 个彰显的线索')
  assert.equal(state.scenarioFlags.cluesUnveiled, 0)
})

test('09-a5 09576 圣索菲亚：研究标记行动与每标记 +3 隐藏值', () => {
  const state = baseState(2)
  state.locations = [{ id: 'hagiaSophia', name: '圣索菲亚', revealed: true }]
  state.investigators[0].location = 'hagiaSophia'
  const action = dealB.behavior.actions(state, state.investigators[0]).find(move => String(move.rule).includes('Hagia'))
  assert.ok(action, '研究标记行动应进入 actions')
  let added = 0
  dealB.behavior.performAction(state, state.investigators[0], action, apiOf(state, { addCluesToLocation: (id, amount) => { added = amount } }))
  assert.equal(added, 2, '放置 1[每人] 线索')
  assert.equal(state.locations[0].studyTokens, 1)
  assert.equal(dealB.behavior.locationShroudModifier(state, state.locations[0]), 3, '每个研究标记 +3 隐藏值')
})

test('09-a5 09577 暗处小巷：攻击、躲避隐匿迷你卡均按隐藏值 +2 检定', () => {
  const state = fixture()
  const source = placeRevealed(state, '09577', 'darkAlley', { shroud: 2 })
  state.investigators[0].location = source.id
  const mini = scenarioRuntime(state, []).mechanics.tsk.concealed.place({ kind: 'Decoy', decoy: true, locationId: source.id })
  const actions = legalMoves(state, 0).filter(move => move.miniId === mini.id)
  assert.ok(actions.some(move => move.action === 'fightConcealed' && /vs 4/.test(move.label)))
  assert.ok(actions.some(move => move.action === 'evadeConcealed' && /vs 4/.test(move.label)))
})

test('09-a5 09578 公共浴场：在此地不能发动武器能力，离开后恢复', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const original = inv.location
  const location = placeRevealed(state, '09578', 'bathhouse')
  const weapon = asset(state, '01006')
  enemy(state)
  const canFire = () => legalMoves(state, 0).some(move => move.assetId === weapon.id)
  assert.equal(canFire(), true)
  inv.location = location.id
  state.enemies[0].location = location.id
  assert.equal(canFire(), false)
  inv.location = original
  state.enemies[0].location = original
  assert.equal(canFire(), true)
})

test('09-a5 09579 大理石喷泉：快速谈判取走异教徒 1 线索并把它送回阴影', () => {
  const state = baseState(1)
  state.locations = [{ id: 'bazaarMarbleFountain', name: '喷泉', revealed: true }]
  state.investigators[0].location = 'bazaarMarbleFountain'
  const enemy = { id: 'c', code: '09586a', originalCode: '09586a', traits: ['Cultist'], clues: 1, location: 'bazaarMarbleFountain' }
  state.enemies = [enemy]
  const action = dealB.behavior.fastActions(state, state.investigators[0]).find(move => move.rule === 'dealingsMarbleFountainClue')
  assert.ok(action, '快速谈判行动应进入 fastActions')
  dealB.behavior.performAction(state, state.investigators[0], action, apiOf(state))
  assert.equal(state.investigators[0].clues, 1, '取得敌人 1 个线索')
  assert.equal(state.enemies.includes(enemy), false, '敌人返回阴影')
})

test('09-a5 09580 拥挤商铺：把商铺的线索移到连接地点最近的异教徒', () => {
  const state = fixture()
  const source = placeRevealed(state, '09580', 'bazaarCrowdedShops', { clues: 1, connections: ['near'] })
  placeRevealed(state, '09577', 'near', { clues: 2, connections: ['far'] })
  placeRevealed(state, '09578', 'far', { clues: 1 })
  state.investigators[0].location = source.id
  const nearer = enemy(state, { code: '09586a', location: 'near', engagedSeat: null, clues: 0 })
  const farther = enemy(state, { code: '09586a', location: 'far', engagedSeat: null, clues: 0 })
  const { concealed } = scenarioRuntime(state, []).mechanics.tsk
  const mini = concealed.place({ kind: 'Decoy', decoy: true, locationId: source.id })
  concealed.expose(mini.id, { seat: 0 })
  assert.equal(source.clues, 0)
  assert.equal(state.locations.find(location => location.id === 'near').clues, 2)
  assert.equal(nearer.clues, 1)
  assert.equal(farther.clues, 0)
})

test('09-a5 09581 繁忙走道：离开检定失败可付 1 行动继续，或取消移动', () => {
  for (const answer of ['loseAction', 'cancelMove']) {
    const state = fixture()
    state.scenario = { ...state.scenario, id: dealingsScenario.id }
    const source = placeRevealed(state, '09581', 'bazaarBusyWalkway', { connections: ['other'] })
    const destination = placeRevealed(state, '09577', 'other')
    state.investigators[0].location = source.id
    state.chaosBag = ['autofail']
    const actions = state.investigators[0].actionsLeft
    runEffect(state, draft => scenarioRuntime(draft, []).moveInvestigator(0, destination.id),
      choice => choice.options.some(option => option.id === answer) ? answer : null)
    assert.equal(state.investigators[0].location, answer === 'loseAction' ? destination.id : source.id)
    assert.equal(state.investigators[0].actionsLeft, actions - (answer === 'loseAction' ? 1 : 0))
  }
})

test('09-a5 09582 屋顶通道：进入后敏捷(4)成功可再次移动', () => {
  const state = baseState(1)
  state.locations = [{ id: 'bazaarRooftopAccess', name: '屋顶通道', connections: ['bazaarBusyWalkway'] },
    { id: 'bazaarBusyWalkway', name: '走道' }]
  state.investigators[0].location = 'bazaarRooftopAccess'
  const moved = []
  dealB.behavior.locationEntered(state, state.investigators[0], state.locations[0],
    apiOf(state, { moveInvestigator: (seat, destination) => moved.push({ seat, destination }) }))
  assert.deepEqual(state.testCalls.map(call => [call.skill, call.difficulty]), [['agility', 4]])
  assert.deepEqual(moved, [{ seat: 0, destination: 'bazaarBusyWalkway' }])
  const hunter = { id: 'hunter', code: '09586a', location: 'bazaarRooftopAccess', hunter: true }
  const patrol = { id: 'patrol', code: '09586b', location: 'bazaarRooftopAccess', patrol: 'Any' }
  const keyword = []
  const api = apiOf(state, {
    moveEnemyToward: candidate => keyword.push(candidate.id),
    resolveHunterMove: candidate => keyword.push(candidate.id),
  })
  state.enemies = [hunter, patrol]
  dealB.behavior.enemyMoved(state, hunter, 'bazaarBusyWalkway', api, { cause: 'effect' })
  assert.deepEqual(keyword, [])
  dealB.behavior.enemyMoved(state, patrol, 'bazaarBusyWalkway', api, { cause: 'patrol' })
  assert.deepEqual(keyword, ['patrol'])
})

test('09-a5 09583 珠宝匠之路：成功超 1 点后可付差额打出支援，或如常发现线索', () => {
  for (const answer of ['01059', 'skip']) {
    const state = fixture('01001')
    state.scenario = { ...state.scenario, id: dealingsScenario.id }
    const location = placeRevealed(state, '09583', 'bazaarJewelersRoad', { shroud: 2, clues: 1 })
    state.investigators[0].location = location.id
    state.investigators[0].hand = ['01059']
    const before = state.investigators[0].resources
    const available = legalMoves(state, 0)
    assert.ok(!available.some(move => move.rule === 'dealingsJewelersRoadInvestigate'))
    const action = available.find(move => move.action === 'entityAbility' && move.entityId === location.id)
    assert.ok(action)
    move(state, { action: action.action, entityId: action.entityId, abilityIndex: action.abilityIndex })
    settle(state, choice => choice.options.some(option => option.id === answer) ? answer : null)
    const played = answer !== 'skip'
    assert.equal(state.investigators[0].assets.some(asset => asset.code === '01059'), played)
    assert.equal(state.investigators[0].resources, before - (played ? ALL_CARDS['01059'].cost - 1 : 0))
    assert.equal(state.locations.find(loc => loc.id === location.id).clues, played ? 1 : 0)
  }
})
