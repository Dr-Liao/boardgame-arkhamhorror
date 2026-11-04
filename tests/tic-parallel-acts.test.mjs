// 印斯茅斯阴谋 P7《暗潮之下》第八章「深海之城」v.I/II/III（07316/07317/07318）与
// 并行幕（parallel acts）机制专属测试。
//
// 覆盖：
//   1. 零变化：没有并行幕的章节没有 state.parallelActs 字段；actsInPlay 退化为 [当前幕]；
//      checkAct / 读点不写状态（旧 7 章 / 其它战役行为与 JSON 不变）。
//   2. 并行幕 API：addParallelAct 惰性创建、幂等、从 stageCards 实例化且不污染定义；
//      completeParallelAct 加入胜利区（Victory 2）并移除活动槽；字段在最后一张移除后删除。
//   3. 读点接线：activeStageEntities/actionEntityById（legalMoves 的 entityAbility）、
//      nonPlayerAbilitySources（窗口能力来源）、hasWindowListener、entityModifierRows（幕行修正）。
//   4. 07316 目标（全地点未淹没）+ [快速] 两条能力（古神伤害 / 巢穴团队线索）。
//   5. 07316 完成：无其他场景卡 → 直接 R1；有并行幕 → 队长选择继续（actIndex 推进、场景继续）。
//   6. 07317 目标（达贡巢穴/海德拉巢穴/带紫钥匙的财富宝库均无线索）正反例 + 完成/继续/R1。
//   7. 07318 目标（达贡与海德拉各 ≥ 4×人数伤害）正反例（含 3 人局 12 点）。
//   8. 存档往返：带 parallelActs 的 JSON 恢复后 actsInPlay / 目标 / 完成均可用。
//
// 注册：三张卡尚未进索引时由本测试直接 registerCardAbilities（索引由 Lead 统一重建）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { move, settle } from './core-fixture.mjs'
import { advanceAct, checkAct, legalMoves, nonPlayerAbilitySources, scenarioRuntime } from '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import {
  appendParallelAct, actsInPlay, parallelActs, removeParallelAct,
} from '../src/engine/parallel-acts.js'
import { activeStageEntities, actionEntityById } from '../src/engine/parley.js'
import { hasWindowListener } from '../src/engine/window-listeners.js'
import { entityModifierTotal, entityRuleActive } from '../src/engine/modifiers.js'
import { floodLevel } from '../src/engine/flood.js'

import card07316 from '../src/cards/encounter-entries/theInnsmouthConspiracy/intoTheMaelstrom/07316.js'
import card07317 from '../src/cards/encounter-entries/theInnsmouthConspiracy/intoTheMaelstrom/07317.js'
import card07318 from '../src/cards/encounter-entries/theInnsmouthConspiracy/intoTheMaelstrom/07318.js'

for (const entry of [card07316, card07317, card07318]) {
  if (!registeredEntry(entry.code)) registerCardAbilities([entry])
}

const codeOf = entity => String(entity?.originalCode || entity?.code || '')
const locationByCode = (state, code) => state.locations.find(location => codeOf(location) === code) || null
const requiredKeys = ['blue', 'red', 'yellow', 'green']

function transaction(state, execute, select = () => null) {
  let value
  const run = draft => {
    try { value = execute(draft); return value } catch (error) {
      if (error?.constructor?.name !== 'ScenarioEnded') throw error
      return undefined
    }
  }
  resolveTransaction(state, 0, { action: 'ticParallelActsTest' }, run)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 200, `choice loop: ${state.pendingChoice.source}`)
    const choice = state.pendingChoice
    const id = select(choice, state)
      ?? ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId))
      ?? choice.options[0]?.id
    assert.ok(id != null, JSON.stringify(choice))
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, run)
  }
  return value
}

// 把 4 把钥匙交给调查员 0 并正常推进到幕 2（07316 成为当前幕、Act 2 地图与两古神入场）。
function advanceToAct2(state, seat = 0) {
  const api = createMechanicsApi(state)
  for (const color of requiredKeys) {
    const key = state.scenarioFlags.mechanics.keys?.[color]
    assert.ok(key, `钥匙未初始化：${color}`)
    assert.equal(api.keys.transfer(color, key.holder, `investigator:${seat}`, { reveal: true }), true,
      `把 ${color} 钥匙交给调查员 ${seat}`)
  }
  transaction(state, draft => advanceAct(draft, []))
  assert.equal(state.actIndex, 1, '推进到幕 2')
  assert.equal(codeOf(state.acts[state.actIndex]), '07316')
  return state
}

const actMove = (state, abilityIndex, entityId = 'act07316') => {
  const command = legalMoves(state).find(item => item.action === 'entityAbility'
    && item.entityId === entityId && item.abilityIndex === abilityIndex)
  assert.ok(command, `实体 ${entityId} 的能力 ${abilityIndex} 不在合法行动里`)
  return command
}

// ---------------------------------------------------------------------------
// 1. 零变化
// ---------------------------------------------------------------------------

test('无并行幕的章节：没有 state.parallelActs 字段，actsInPlay 退化为 [当前幕]，读点不改状态', () => {
  for (const chapter of ['aLightInTheFog', 'theLairOfDagon']) {
    const state = chapterFixture(chapter)
    assert.equal(Object.hasOwn(state, 'parallelActs'), false, `${chapter} 不应出现 parallelActs 字段`)
    assert.deepEqual(parallelActs(state), [])
    assert.deepEqual(actsInPlay(state).map(codeOf), [codeOf(state.acts[state.actIndex])])
    const before = JSON.stringify({
      acts: state.acts, actIndex: state.actIndex, victoryDisplay: state.victoryDisplay,
      keys: Object.keys(state).sort(),
    })
    // 读点全是纯读：调用后状态逐字不变。
    actsInPlay(state)
    parallelActs(state)
    hasWindowListener(state, 'mythosEnd')
    assert.equal(JSON.stringify({
      acts: state.acts, actIndex: state.actIndex, victoryDisplay: state.victoryDisplay,
      keys: Object.keys(state).sort(),
    }), before)
    assert.equal(Object.hasOwn(state, 'parallelActs'), false)
  }
})

test('checkAct 在其它 TIC 章节仍是纯读（不推进、不新增字段）', () => {
  const state = chapterFixture('aLightInTheFog')
  transaction(state, draft => checkAct(draft, []))
  assert.equal(state.actIndex, 0)
  assert.equal(Object.hasOwn(state, 'parallelActs'), false)
})

// ---------------------------------------------------------------------------
// 2. 并行幕 API / 存档往返
// ---------------------------------------------------------------------------

test('addParallelAct：惰性创建、幂等、实例来自 stageCards 且不污染剧本定义', () => {
  const state = chapterFixture('intoTheMaelstrom')
  assert.equal(Object.hasOwn(state, 'parallelActs'), false, '未调用前不出现字段')
  assert.equal(transaction(state, draft => scenarioRuntime(draft, []).addParallelAct('99999')), false,
    '未知卡号添加失败并且不创建字段')
  assert.equal(Object.hasOwn(state, 'parallelActs'), false)

  assert.equal(transaction(state, draft => scenarioRuntime(draft, []).addParallelAct('07317')), true)
  const added = parallelActs(state)
  assert.equal(added.length, 1)
  assert.equal(added[0].id, 'act07317')
  assert.equal(codeOf(added[0]), '07317')
  assert.equal(added[0].stage, '2a')
  assert.equal(added[0].victory, 2, 'Victory 2 写入活动幕实例')
  assert.equal(added[0].scenarioId, 'intoTheMaelstrom')
  assert.equal(state.scenario.stageCards['07317'].scenarioId, undefined, '剧本定义未被实例污染')
  assert.deepEqual(actsInPlay(state).map(codeOf), ['07315', '07317'])

  // 重复添加幂等。
  transaction(state, draft => scenarioRuntime(draft, []).addParallelAct('07317'))
  assert.equal(parallelActs(state).length, 1)

  // 存档往返：parallelActs 是权威状态，JSON 恢复后读点/目标仍可用。
  const saved = JSON.parse(JSON.stringify(state))
  assert.equal(saved.parallelActs.length, 1)
  assert.deepEqual(actsInPlay(saved).map(codeOf), ['07315', '07317'])
  assert.deepEqual(parallelActs(saved).map(codeOf), ['07317'])
})

test('completeParallelAct：加入胜利区（Victory 2）、移出活动槽；最后一张移除后字段删除', () => {
  const state = advanceToAct2(chapterFixture('intoTheMaelstrom'))
  transaction(state, draft => scenarioRuntime(draft, []).addParallelAct('07317'))
  const act = parallelActs(state)[0]
  assert.equal(transaction(state, draft => scenarioRuntime(draft, []).completeParallelAct(act.id)), true)
  assert.equal(parallelActs(state).length, 0)
  assert.equal(Object.hasOwn(state, 'parallelActs'), false, '最后一张移除后恢复无字段形状')
  const inVictory = state.victoryDisplay.find(card => codeOf(card) === '07317')
  assert.ok(inVictory, '07317 进入胜利展示区')
  assert.equal(inVictory.victory, 2)
  assert.equal(inVictory.id, 'act07317')
  // 重复完成不重复写入胜利区。
  assert.equal(transaction(state, draft => scenarioRuntime(draft, []).completeParallelAct('07317')), false)
  assert.equal(state.victoryDisplay.filter(card => codeOf(card) === '07317').length, 1)
})

test('读点接线：并行幕参与实体枚举 / 窗口来源 / 幕行修正', () => {
  // 测试专用条目：仅在本测试进程注册，用于验证「额外活动幕」确实被各读点枚举。
  const SYNTHETIC = 'TSTPARACT9'
  if (!registeredEntry(SYNTHETIC)) registerCardAbilities([{
    code: SYNTHETIC, scope: 'act', implemented: false,
    modifiers: [{ target: 'enemyHealth', amount: 2 }],
    abilities: [{
      kind: 'forced', trigger: 'testParallelWindow', label: '测试：并行幕窗口来源', resolve: () => {},
    }],
  }])
  const state = advanceToAct2(chapterFixture('intoTheMaelstrom'))
  // 沉睡古神对未知来源修正 fail-closed；这里用一个普通敌人验证「幕行修正」读点。
  const enemy = {
    id: 'testEnemy', code: 'testEnemy', name: '测试敌人', location: state.investigators[0].location,
    fight: 1, evade: 1, health: 10, damageTaken: 0, damage: 0, horror: 0,
  }
  state.enemies.push(enemy)
  const healthBefore = entityModifierTotal(state, enemy, 'enemyHealth')
  const syntheticAct = {
    id: `act${SYNTHETIC}`, code: SYNTHETIC, originalCode: SYNTHETIC, name: '测试并行幕',
    stage: '2a', text: '', victory: 0, scenarioId: state.scenario.id,
  }
  assert.equal(appendParallelAct(state, syntheticAct), true)

  assert.ok(actsInPlay(state).includes(syntheticAct))
  assert.ok(activeStageEntities(state).includes(syntheticAct), 'activeStageEntities 覆盖并行幕')
  assert.equal(actionEntityById(state, syntheticAct.id), syntheticAct, 'actionEntityById 覆盖并行幕')
  assert.equal(hasWindowListener(state, 'testParallelWindow'), true, 'hasWindowListener 覆盖并行幕')
  assert.ok(nonPlayerAbilitySources(state).some(row => row.source === syntheticAct),
    'nonPlayerAbilitySources 覆盖并行幕')
  assert.equal(entityModifierTotal(state, enemy, 'enemyHealth'), healthBefore + 2, '幕行修正覆盖并行幕')
  assert.equal(entityRuleActive(state, enemy, 'cannot:parley'), false)

  removeParallelAct(state, syntheticAct.id)
  assert.equal(hasWindowListener(state, 'testParallelWindow'), false)
  assert.ok(!nonPlayerAbilitySources(state).some(row => row.source === syntheticAct))
  assert.equal(entityModifierTotal(state, enemy, 'enemyHealth'), healthBefore)
})

// ---------------------------------------------------------------------------
// 3. 07316 深海之城 v.I
// ---------------------------------------------------------------------------

test('07316 目标：场上每个地点都未淹没才成立（初始 Act 2 有淹没地点 → false）', () => {
  const state = advanceToAct2(chapterFixture('intoTheMaelstrom'))
  const rule = registeredEntry('07316').actRule
  assert.equal(rule.objective(state, state.acts[state.actIndex]), false, 'Act 2 初始有部分/完全淹没地点')
  const api = createMechanicsApi(state)
  for (const location of [...state.locations]) api.water.set(location.id, 0)
  assert.equal(rule.objective(state, state.acts[state.actIndex]), true, '全部抽干后成立')
  const flooded = state.locations[0]
  api.water.set(flooded.id, 1)
  assert.equal(rule.objective(state, state.acts[state.actIndex]), false, '任一部分淹没即不成立')
})

test('07316 [快速] 能力 a：从所在地点的[[古神]]敌人移除 1[每调查员]点伤害（不消耗行动）', () => {
  const state = advanceToAct2(chapterFixture('intoTheMaelstrom'))
  const lair = locationByCode(state, '07328')
  const dagon = state.enemies.find(item => ['07330a', '07330b'].includes(codeOf(item)))
  assert.ok(lair && dagon)
  state.investigators[0].location = lair.id
  state.currentSeat = 0
  dagon.damageTaken = 3
  const command = actMove(state, 0)
  assert.equal(command.actionKind, 'activate')
  const actionsLeft = state.investigators[0].actionsLeft
  move(state, command)
  settle(state)
  const healed = state.enemies.find(item => item.id === dagon.id)
  assert.equal(healed.damageTaken, 3 - state.numInvestigators, '移除 1[每调查员] 伤害')
  assert.equal(state.investigators[0].actionsLeft, actionsLeft, '[快速] 不消耗行动点')
})

test('07316 [快速] 能力 b：[[巢穴]]地点的调查员共同花费线索，降低非[[圣堂]]地点淹没等级', () => {
  const state = advanceToAct2(chapterFixture('intoTheMaelstrom'))
  const lair = locationByCode(state, '07328')
  assert.ok(lair)
  state.investigators[0].location = lair.id
  state.currentSeat = 0
  state.investigators[0].clues = state.numInvestigators
  const gateway = state.locations.find(location => location.id === state.scenario.startLocation)
  assert.ok(gateway)
  createMechanicsApi(state).water.set(gateway.id, 1)
  assert.equal(floodLevel(state, gateway.id), 1)
  const command = actMove(state, 1)
  move(state, command)
  // 施术调查员选择要降低淹没等级的地点。
  settle(state, choice => (choice.kind === 'location'
    ? (choice.options.some(option => option.id === gateway.id) ? gateway.id : null)
    : null))
  assert.equal(state.investigators[0].clues, 0, '共同花费 1[每调查员] 线索')
  assert.equal(floodLevel(state, gateway.id), 0, '目标地点淹没等级降低 1')
})

test('07316 完成：无其他场景卡 → 立即结局1（加入胜利区，Victory 2）', () => {
  const state = advanceToAct2(chapterFixture('intoTheMaelstrom'))
  const api = createMechanicsApi(state)
  for (const location of [...state.locations]) api.water.set(location.id, 0)
  transaction(state, draft => checkAct(draft, []))
  assert.equal(state.resolution, 'resolution1', '没有其他幕时直接进入 R1')
  const inVictory = state.victoryDisplay.find(card => codeOf(card) === '07316')
  assert.ok(inVictory, '07316 加入胜利区')
  assert.equal(inVictory.victory, 2)
  assert.equal(state.campaign.scenarioResults.length, 1, '本关已结算')
})

test('07316 完成：有并行幕时队长选择「继续游戏」，actIndex 推进且场景继续', () => {
  const state = advanceToAct2(chapterFixture('intoTheMaelstrom'))
  transaction(state, draft => scenarioRuntime(draft, []).addParallelAct('07317'))
  const api = createMechanicsApi(state)
  for (const location of [...state.locations]) api.water.set(location.id, 0)
  transaction(state, draft => checkAct(draft, []),
    choice => (choice.options.some(option => option.id === 'continue') ? 'continue' : null))
  assert.equal(state.resolution, null, '选择继续时不进入结局')
  assert.equal(state.actIndex, 2, 'advanceAct 正常推进指针（无下一张线性幕）')
  assert.equal(parallelActs(state).map(codeOf).join(','), '07317', '并行幕仍在场')
  assert.equal(state.victoryDisplay.filter(card => codeOf(card) === '07316').length, 1)
})

test('07316 完成：有并行幕时选择「立即进入结局1」→ resolution1', () => {
  const state = advanceToAct2(chapterFixture('intoTheMaelstrom'))
  transaction(state, draft => scenarioRuntime(draft, []).addParallelAct('07317'))
  const api = createMechanicsApi(state)
  for (const location of [...state.locations]) api.water.set(location.id, 0)
  transaction(state, draft => checkAct(draft, []),
    choice => (choice.options.some(option => option.id === 'r1') ? 'r1' : null))
  assert.equal(state.resolution, 'resolution1')
  assert.equal(state.campaign.scenarioResults.length, 1)
})

// ---------------------------------------------------------------------------
// 4. 07317 深海之城 v.II
// ---------------------------------------------------------------------------

function meetVaultObjective(state) {
  const api = createMechanicsApi(state)
  let vault = locationByCode(state, '07322')
  if (!vault) {
    const definitionId = Object.entries(state.scenario.locations)
      .find(([, definition]) => codeOf(definition) === '07322')?.[0]
    assert.ok(definitionId, '剧本定义里有财富宝库')
    transaction(state, draft => scenarioRuntime(draft, []).place(definitionId))
    vault = locationByCode(state, '07322')
  }
  assert.ok(vault, '财富宝库入场')
  const purple = state.scenarioFlags.mechanics.keys.purple
  assert.ok(purple, '紫色钥匙已初始化')
  assert.equal(api.keys.transfer('purple', purple.holder, `location:${vault.id}`, { reveal: true }), true)
  for (const code of ['07328', '07329', '07322']) {
    const location = locationByCode(state, code)
    assert.ok(location, `${code} 应在场`)
    location.clues = 0
  }
  return vault
}

test('07317 目标：三处地点无线索且财富宝库带紫钥匙才成立', () => {
  const state = advanceToAct2(chapterFixture('intoTheMaelstrom'))
  transaction(state, draft => scenarioRuntime(draft, []).addParallelAct('07317'))
  const rule = registeredEntry('07317').actRule
  const act = parallelActs(state)[0]
  assert.equal(rule.objective(state, act), false, '初始没有紫钥匙 → 不成立')
  const vault = meetVaultObjective(state)
  assert.equal(rule.objective(state, act), true, '目标达成')
  // 任一地点有线索 → 不成立。
  locationByCode(state, '07328').clues = 1
  assert.equal(rule.objective(state, act), false, '达贡巢穴有线索 → 不成立')
  locationByCode(state, '07328').clues = 0
  // 紫钥匙被拿走 → 不成立。
  const api = createMechanicsApi(state)
  assert.equal(api.keys.transfer('purple', `location:${vault.id}`, 'investigator:0', { reveal: true }), true)
  assert.equal(rule.objective(state, act), false, '紫钥匙不在宝库上 → 不成立')
})

test('07317 完成：有另一张场景卡 → 选择继续，加入胜利区并移出活动槽；无其他幕 → 自动 R1', () => {
  const state = advanceToAct2(chapterFixture('intoTheMaelstrom'))
  transaction(state, draft => scenarioRuntime(draft, []).addParallelAct('07317'))
  meetVaultObjective(state)
  // 当前线性幕（07316）仍在场 → 出现「继续/R1」选择，选继续。
  transaction(state, draft => checkAct(draft, []),
    choice => (choice.options.some(option => option.id === 'continue') ? 'continue' : null))
  assert.equal(state.resolution, null)
  assert.equal(parallelActs(state).length, 0, '07317 已从活动槽移除')
  assert.equal(state.victoryDisplay.filter(card => codeOf(card) === '07317').length, 1)
  assert.equal(state.campaign.scenarioResults.length, 0, '场景继续')

  // 再测试「无其他场景卡」：actIndex 指到尽头后再完成一张 07318 → 自动 R1。
  const lone = advanceToAct2(chapterFixture('intoTheMaelstrom'))
  const api = createMechanicsApi(lone)
  transaction(lone, draft => scenarioRuntime(draft, []).addParallelAct('07318'))
  lone.actIndex = 2
  const dagon = lone.enemies.find(item => ['07330a', '07330b'].includes(codeOf(item)))
  const hydra = lone.enemies.find(item => ['07331a', '07331b'].includes(codeOf(item)))
  const required = 4 * lone.numInvestigators
  assert.ok(dagon && hydra)
  dagon.damageTaken = required
  hydra.damageTaken = required
  transaction(lone, draft => checkAct(draft, []))
  assert.equal(lone.resolution, 'resolution1', '没有其他幕时自动 R1')
  assert.equal(lone.victoryDisplay.filter(card => codeOf(card) === '07318').length, 1)
})

// ---------------------------------------------------------------------------
// 5. 07318 深海之城 v.III
// ---------------------------------------------------------------------------

test('07318 目标：达贡与海德拉各至少 4[每调查员]伤害（3 人局需各 12 点）', () => {
  const state = advanceToAct2(chapterFixture('intoTheMaelstrom', 3))
  transaction(state, draft => scenarioRuntime(draft, []).addParallelAct('07318'))
  const rule = registeredEntry('07318').actRule
  const act = parallelActs(state)[0]
  const dagon = state.enemies.find(item => ['07330a', '07330b'].includes(codeOf(item)))
  const hydra = state.enemies.find(item => ['07331a', '07331b'].includes(codeOf(item)))
  assert.ok(dagon && hydra)
  assert.equal(state.numInvestigators, 3)
  dagon.damageTaken = 11
  hydra.damageTaken = 12
  assert.equal(rule.objective(state, act), false, '达贡 11 < 12 → 不成立')
  dagon.damageTaken = 12
  assert.equal(rule.objective(state, act), true, '各 12 点伤害成立')
  hydra.damageTaken = 0
  assert.equal(rule.objective(state, act), false, '海德拉没有伤害 → 不成立')
})

test('07318 完成：加入胜利区（Victory 2）并在无其他幕时自动进入结局1', () => {
  const state = advanceToAct2(chapterFixture('intoTheMaelstrom'))
  transaction(state, draft => scenarioRuntime(draft, []).addParallelAct('07318'))
  state.actIndex = 2
  const dagon = state.enemies.find(item => ['07330a', '07330b'].includes(codeOf(item)))
  const hydra = state.enemies.find(item => ['07331a', '07331b'].includes(codeOf(item)))
  const required = 4 * state.numInvestigators
  dagon.damageTaken = required
  hydra.damageTaken = required
  transaction(state, draft => checkAct(draft, []))
  assert.equal(state.resolution, 'resolution1')
  const inVictory = state.victoryDisplay.find(card => codeOf(card) === '07318')
  assert.ok(inVictory)
  assert.equal(inVictory.victory, 2)
  assert.equal(state.campaign.scenarioResults.length, 1)
})

// ---------------------------------------------------------------------------
// 6. 存档往返后继续结算
// ---------------------------------------------------------------------------

test('存档往返：带 parallelActs 的 JSON 恢复后目标/完成依然可用', () => {
  const original = advanceToAct2(chapterFixture('intoTheMaelstrom'))
  transaction(original, draft => scenarioRuntime(draft, []).addParallelAct('07317'))
  meetVaultObjective(original)
  const saved = JSON.parse(JSON.stringify(original))
  assert.deepEqual(actsInPlay(saved).map(codeOf), ['07316', '07317'])
  // 恢复后的 state 能直接完成并行幕并继续场景。
  transaction(saved, draft => checkAct(draft, []),
    choice => (choice.options.some(option => option.id === 'continue') ? 'continue' : null))
  assert.equal(saved.resolution, null)
  assert.deepEqual(parallelActs(saved), [])
  assert.equal(saved.victoryDisplay.filter(card => codeOf(card) === '07317').length, 1)
})

test('多个并行幕一起在场时按卡号逐一完成', () => {
  const state = advanceToAct2(chapterFixture('intoTheMaelstrom'))
  transaction(state, draft => scenarioRuntime(draft, []).addParallelAct('07317'))
  transaction(state, draft => scenarioRuntime(draft, []).addParallelAct('07318'))
  assert.deepEqual(parallelActs(state).map(codeOf), ['07317', '07318'])
  assert.equal(transaction(state, draft => scenarioRuntime(draft, []).completeParallelAct('07317')), true)
  assert.deepEqual(parallelActs(state).map(codeOf), ['07318'])
  assert.equal(state.victoryDisplay.filter(card => codeOf(card) === '07317').length, 1)
})

// ---------------------------------------------------------------------------
// 7. 幕/议程牌库操作（w6-act-agenda-deck-ops · Harper 07060 / flashback 的硬前置）
// ---------------------------------------------------------------------------

test('setActDeckCards：把卡号放进指定槽（长度处追加），不改变 actIndex，非法参数不写状态', () => {
  const state = chapterFixture('theVanishingOfElinaHarper', 2)
  assert.equal(codeOf(state.acts[0]), '07060')
  assert.equal(state.actIndex, 0)
  // 未知卡号 / 越界 / 非法卡号数组 → false 且不改状态。
  assert.equal(transaction(state, draft => scenarioRuntime(draft, []).setActDeckCards(0, ['99999'])), false)
  assert.equal(transaction(state, draft => scenarioRuntime(draft, []).setActDeckCards(5, ['07060'])), false)
  assert.deepEqual(state.acts.map(codeOf), ['07060'])
  // 在长度处追加「营救」07061（Harper 07060 背面 → setActDeckCards(1, ['07061'])）。
  assert.equal(transaction(state, draft => scenarioRuntime(draft, []).setActDeckCards(1, ['07061'])), true)
  assert.deepEqual(state.acts.map(codeOf), ['07060', '07061'])
  assert.equal(state.actIndex, 0, '指针不变：由调用方决定何时推进')
  assert.equal(state.acts[1].id, 'act07061', '实例来自 stageCards 且带 act 形状的 id')
  // 从 index 起替换（index 之后的旧牌删除）。
  assert.equal(transaction(state, draft => scenarioRuntime(draft, []).setActDeckCards(1, [])), true)
  assert.deepEqual(state.acts.map(codeOf), ['07060'])
})

test('setAgendaDeckCards：把卡号放进指定议程槽（长度处追加），保留毁灭阈值，不改变 agendaIndex', () => {
  const state = chapterFixture('theVanishingOfElinaHarper', 2)
  const beforeAgenda = codeOf(state.agendas[state.agendaIndex])
  assert.equal(beforeAgenda, '07057')
  assert.equal(transaction(state, draft => scenarioRuntime(draft, []).setAgendaDeckCards(1, ['07059'])), true)
  assert.deepEqual(state.agendas.map(codeOf), ['07057', '07059'])
  assert.equal(state.agendas[1].doomThreshold, 7, '侵略性阈值来自卡面数据')
  assert.equal(state.agendaIndex, 0, '指针不变')
  // 未知/越界不写状态。
  assert.equal(transaction(state, draft => scenarioRuntime(draft, []).setAgendaDeckCards(1, ['NO_CARD'])), false)
  assert.equal(transaction(state, draft => scenarioRuntime(draft, []).setAgendaDeckCards(9, ['07059'])), false)
  assert.deepEqual(state.agendas.map(codeOf), ['07057', '07059'])
})
