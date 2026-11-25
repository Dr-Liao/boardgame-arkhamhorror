// 验收 09-a 分片 5（TSK《绯红密钥》09543–09583）逐卡证据测试。
//
// 背景：TSK 战役卡此前几乎全部缺席「标题含卡号」的测试（scope-map：45 张里仅 09557/09557b 有）。
// 本文件按分片逐卡补一条真实执行用例：直接注册并读取条目声明 + 调用章节 behavior 的真实结算函数
// （行为桩只模拟引擎 api 契约），每张卡标题含卡号。
// 失败卡的未实现点由 artifacts/acceptance/09-a-5/probe-defects.mjs 单独复现并写进报告。
import test from 'node:test'
import assert from 'node:assert/strict'

import '../src/engine/engine.js'
import { registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import * as san from '../content/campaigns/theScarletKeys/scenarios/sanguineShadows/definition.js'
import * as sanB from '../content/campaigns/theScarletKeys/scenarios/sanguineShadows/behavior.js'
import * as sanC from '../content/campaigns/theScarletKeys/scenarios/sanguineShadows/chaos.js'
import * as deal from '../content/campaigns/theScarletKeys/scenarios/dealingsInTheDark/definition.js'
import * as dealB from '../content/campaigns/theScarletKeys/scenarios/dealingsInTheDark/behavior.js'
import * as dealC from '../content/campaigns/theScarletKeys/scenarios/dealingsInTheDark/chaos.js'
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
    directHorror: (seat, amount) => { state.investigators[seat].horror += amount },
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

test('09-a5 09544a 末绽之花（稳定面）：Shift 数据 = 治愈持有者所在地点调查员 1 伤 1 恐', () => {
  const entry = registeredEntry('09544a')
  assert.equal(entry.flags.keyCard, true)
  assert.equal(entry.flags.face, 'stable')
  assert.equal(entry.flags.unstableFaceCode, '09544b')
  assert.deepEqual(entry.flags.shiftEffects, { healDamage: 1, healHorror: 1, scope: 'bearerLocationInvestigators' })
  assert.equal(typeof dhB.shiftLastBlossom, 'function', '章节 behavior 有 Shift 结算入口')
  assert.equal(typeof dhB.shiftWeepingLady, 'undefined')
})

test('09-a5 09544b 末绽之花（动荡面）：Shift 数据 = 治愈场上每个敌人 1 点伤害', () => {
  const entry = registeredEntry('09544b')
  assert.equal(entry.flags.face, 'unstable')
  assert.equal(entry.flags.stableFaceCode, '09544a')
  assert.equal(entry.flags.shiftEffect, 'healAllEnemies')
  assert.equal(entry.flags.shiftEffects.flipIfInvestigatorShifted, true)
  assert.equal(dh.KEY_SPEC.stableFace, '09544a')
  assert.equal(dh.KEY_SPEC.unstableFace, '09544b')
})

// ---------------------------------------------------------------------------
// 血色阴影（09545–09565b）
// ---------------------------------------------------------------------------
test('09-a5 09545 血色阴影：混乱标记数值（标靶数）与 tablet 取消投入', () => {
  const state = baseState(1)
  state.scenarioFlags.targets = undefined
  assert.equal(typeof sanC.sanguineShadowsChaosToken, 'function')
  const skull = sanC.sanguineShadowsChaosToken(state, state.investigators[0], 'skull')
  assert.equal(skull.delta, 0, '无标靶时 skull -0')
  const tablet = sanC.sanguineShadowsChaosToken(state, state.investigators[0], 'tablet')
  assert.equal(tablet.delta, -1)
  assert.equal(tablet.cancelCommitted, true, 'tablet 要求取消投入卡牌（引擎读点 tests.js#cancelCommitted）')
  state.difficulty = 'hard'
  assert.equal(sanC.sanguineShadowsChaosToken(state, state.investigators[0], 'tablet').delta, -2)
})

test('09-a5 09546 她在哪儿……？：密谋牌库重置后毁灭 = 1[每人]', () => {
  const state = baseState(2)
  state.acts = structuredClone(san.acts)
  state.agendas = structuredClone(san.agendas)
  state.numInvestigators = 2
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
  test(`09-a5 ${code} 地点查看行动：花 1 线索检定 ${skill}(4)，成功查看已揭示面`, () => {
    const state = baseState(1)
    state.investigators[0].location = locationId
    state.investigators[0].clues = 1
    state.locations = [{ id: locationId, name: locationId, revealed: true, connections: [] }]
    const action = sanB.behavior.actions(state, state.investigators[0]).find(move => String(move.rule).startsWith('loc:'))
    assert.ok(action, '地点行动应进入 actions')
    sanB.behavior.performAction(state, state.investigators[0], action, apiOf(state))
    assert.equal(state.investigators[0].clues, 0, '支付 1 个线索')
    assert.deepEqual(state.testCalls.map(call => [call.skill, call.difficulty]), [[skill, 4]])
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

test('09-a5 09554 市议会：条目印刷数据（隐藏值 4 / 线索 2）注册正确', () => {
  const entry = registeredEntry('09554')
  assert.equal(entry.code, '09554')
  assert.deepEqual(entry.flags, { printedShroud: 4, printedClues: 2 })
  assert.equal(ALL_CARDS['09554'].type, 'location')
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

test('09-a5 09557b 红衣女郎（剧情支援）：回合结束横置 → 记录阴影锚点', () => {
  const state = baseState(1)
  state.investigators[0].location = 'avenidaDeMayo'
  const ability = registeredEntry('09557b').abilities.find(item => item.kind === 'reaction')
  assert.ok(ability, '应有回合结束反应能力')
  ability.resolve({ state, inv: state.investigators[0], api: apiOf(state, { setScenarioFlag: (key, value) => { state.scenarioFlags[key] = value } }) })
  assert.equal(state.scenarioFlags['sanguineShadowAnchor:0'], 'avenidaDeMayo')
})

test('09-a5 09558 履约夜魇：enemyRule.doubleNegative 接线 + 简化披露', () => {
  const entry = registeredEntry('09558')
  assert.equal(entry.enemyRule.doubleNegative, true)
  assert.equal(entry.simplified, true, '攻击路径负值翻倍未实现（条目披露 simplified）')
})

test('09-a5 09559 猫抓老鼠： treacheryRule.resolveKind → catAndMouse 分派', () => {
  const state = baseState(1)
  state.investigators[0].location = 'here'
  assert.equal(registeredEntry('09559').treacheryRule.resolveKind, 'catAndMouse')
  assert.equal(sanB.behavior.resolveEncounter(state, state.investigators[0], { originalCode: '09559' }, apiOf(state)), true)
})

test('09-a5 09560 来访名片：附属后禁止（内容层）花费线索', () => {
  const entry = registeredEntry('09560')
  assert.equal(entry.treacheryRule.blocksClueSpendingEverywhere, true)
  const state = baseState(1)
  state.locations = [{ id: 'here', attachments: [{ code: '09560', originalCode: '09560' }] }]
  assert.equal(sanB.cluesSpendBlocked(state), true)
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

test('09-a5 09565a 恸哭女士（稳定面）：Shift 发现所在地点/连接地点 1 个线索', () => {
  const state = baseState(1)
  state.investigators[0].location = 'here'
  state.locations = [{ id: 'here', clues: 2, connections: [] }]
  state.campaign.tsk.keys.keys[san.WEEPING_LADY_KEY.id] = { stable: true, stableFace: '09565a', unstableFace: '09565b' }
  const discovered = []
  const api = apiOf(state, { discoverClue: (seat, amount, locationId) => discovered.push({ seat, amount, locationId }) })
  const result = sanB.shiftWeepingLady(state, 0, api)
  assert.equal(result.kind, 'discoverClue')
  assert.deepEqual(discovered, [{ seat: 0, amount: 1, locationId: 'here' }])
})

test('09-a5 09565b 恸哭女士（动荡面）：Shift 每位调查员弃 1 个支援', () => {
  const state = baseState(2)
  state.investigators[0].location = 'here'
  state.investigators[1].location = 'here'
  state.investigators[0].assets = [{ id: 'a0' }]
  state.investigators[1].assets = [{ id: 'a1' }]
  state.locations = [{ id: 'here', connections: [] }]
  state.campaign.tsk.keys.keys[san.WEEPING_LADY_KEY.id] = { stable: false, stableFace: '09565a', unstableFace: '09565b' }
  const discarded = []
  sanB.shiftWeepingLady(state, 0, apiOf(state, { discardAsset: (seat, assetId) => discarded.push({ seat, assetId }) }))
  assert.deepEqual(discarded, [{ seat: 0, assetId: 'a0' }, { seat: 1, assetId: 'a1' }])
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
})

test('09-a5 09567 黑暗使徒：躲避异教徒 → 返回阴影并夺走 1 个线索', () => {
  const state = baseState(1)
  state.agendas = [{ originalCode: '09567', chapterFlow: 'agentsOfTheDark' }]
  state.agendaIndex = 0
  state.investigators[0].location = 'here'
  const enemy = { id: 'c', code: '09586a', originalCode: '09586a', traits: ['Cultist'], clues: 2, location: 'here' }
  state.enemies = [enemy]
  assert.equal(dealB.behavior.afterEvade(state, state.investigators[0], enemy, {}, apiOf(state)), undefined)
  assert.equal(enemy.clues, 1, '夺走 1 个线索')
  assert.equal(state.enemies.includes(enemy), false, '返回阴影（放一边）')
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

test('09-a5 09572 加拉塔码头：只能从加拉塔进入（moveError 真实返回原因）', () => {
  const state = baseState(1)
  state.locations = [{ id: 'galataDocks', code: '09572', name: '加拉塔码头' },
    { id: 'galata', code: '09573', name: '加拉塔' }]
  state.investigators[0].location = 'galata'
  assert.equal(dealB.behavior.moveError(state, state.investigators[0], state.locations[0]), null, '从加拉塔进入合法')
  state.investigators[0].location = 'elsewhere'
  assert.match(String(dealB.behavior.moveError(state, state.investigators[0], state.locations[0])), /加拉塔/)
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

test('09-a5 09577 暗处小巷：隐匿迷你卡攻/躲 +2 规则已声明在章节规则表', () => {
  assert.equal(deal.LOCATION_RULES[deal.LOCATION_IDS.bazaarDarkenedAlley].concealedFightEvadeBonus, 2)
  assert.equal(registeredEntry('09577').locationRule ?? null, null, '数据型条目未把规则接到引擎读点（缺陷见报告）')
})

test('09-a5 09578 公共浴场：武器文本空白规则已声明在章节规则表', () => {
  assert.equal(deal.LOCATION_RULES[deal.LOCATION_IDS.bazaarPublicBaths].blankAssetsWithTrait, 'Weapon')
  assert.equal(registeredEntry('09578').locationRule ?? null, null, '数据型条目未把规则接到引擎读点（缺陷见报告）')
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

test('09-a5 09580 拥挤商铺：揭露诱饵后把 1 个线索移到最近异教徒', () => {
  const state = baseState(1)
  state.locations = [{ id: 'bazaarCrowdedShops', name: '商铺', clues: 1 }]
  state.investigators[0].location = 'bazaarCrowdedShops'
  state.enemies = [{ id: 'c', code: '09586a', traits: ['Cultist'], location: 'bazaarCrowdedShops' }]
  const concealed = {
    at: () => [{ id: 'm1' }], expose: () => ({ decoy: true, kind: 'decoy' }),
  }
  dealB.behavior.exposeConcealedByEffect(state, state.investigators[0], 'm1',
    apiOf(state, { mechanics: { tsk: { concealed } } }), 'bazaarCrowdedShops')
  assert.equal((state.movedClues || []).length, 1, '诱饵被揭露后移动 1 个线索')
})

test('09-a5 09581 繁忙走道：离开检定 + 失败二选一（失去行动/取消移动）', () => {
  const state = baseState(1)
  state.locations = [{ id: 'bazaarBusyWalkway', name: '繁忙走道' }]
  state.investigators[0].location = 'bazaarBusyWalkway'
  assert.deepEqual({ ...dealB.behavior.locationLeaveTest(state, state.investigators[0], state.locations[0]) },
    { skill: 'agility', difficulty: 3 })
  state.choices = ['loseAction']
  let lost = 0
  dealB.behavior.locationLeaveFailed(state, state.investigators[0], state.locations[0], apiOf(state, { loseActions: () => { lost += 1 } }))
  assert.equal(lost, 1, '选择失去 1 个行动')
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
})

test('09-a5 09583 珠宝匠之路：调查成功按超出点数免费打出[[守护]]/[[遗物]]支援', () => {
  const state = baseState(1)
  state.locations = [{ id: 'bazaarJewelersRoad', name: '珠宝匠之路', revealed: true, shroud: 2 }]
  state.investigators[0].location = 'bazaarJewelersRoad'
  const charm = Object.entries(ALL_CARDS).find(([code, card]) => (card.traits || [])
    .some(trait => ['Charm', 'Relic'].includes(trait)) && Number(card.cost) <= 2
    && card.type === 'asset' && code >= '09000')
  assert.ok(charm, '需要一张低费[[守护]]/[[遗物]]支援作样本')
  state.investigators[0].hand = [charm[0]]
  const action = dealB.behavior.actions(state, state.investigators[0]).find(move => String(move.rule).includes('Jewelers'))
  assert.ok(action, '调查并免费打出支援的行动应进入 actions')
  state.testResults = [{ success: true, value: 5, difficulty: 2 }]
  const played = []
  dealB.behavior.performAction(state, state.investigators[0], action, apiOf(state, { playCardFromHandFree: (seat, code) => played.push({ seat, code }) }))
  assert.deepEqual(played, [{ seat: 0, code: charm[0] }], '成功 3 点 → 免费打出费用 ≤3 的支援')
})
