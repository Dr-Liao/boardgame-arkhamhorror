// 沉睡 / 觉醒古神（印斯茅斯）的真实卡牌行为。
//
// 07292a/07292b（达贡，达贡密教巢穴）与 07330a/07330b、07331a/07331b（进入漩涡的两组古神）：
//   · 07292a：检定失败上资源、达到阈值翻面、花钥匙移除资源；
//   · 07292b：+6[per_investigator] 生命值、本地检定失败后重整并攻击；
//   · 07330a/07331a：调查阶段结束时按条件放置毁灭、印刷意志(4) 行动的成功/大失败分支；
//   · 07330b/07331b：圣堂钥匙减攻击、被躲避或受伤后对子嗣执行相同操作、无生命值不自动击败。
//
// 免疫/不能攻击/不能交战由 effect-provenance 统一执行，这里只验证卡面自己的能力与真实数值。
//
// 注意：`resolveTransaction` 成功后会用草稿替换 state 内容，事务前拿到的敌人引用会失效，
// 所以每个事务之后都按 id 从 state 重新取实例。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { enemy, legalMoves, move, settle, validateMove } from './core-fixture.mjs'
import { enemyFightValue, enemyHealth, scenarioRuntime } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { keysAt } from '../src/engine/scenario-keys.js'
import { enemyIsSlumbering } from '../src/engine/effect-provenance.js'
import { registeredEntry } from '../src/engine/ability.js'

function transaction(s, execute, select = () => null) {
  resolveTransaction(s, 0, { action: 'testTicSlumberingBoss' }, execute)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 60, `choice loop ${s.pendingChoice.source}`)
    const choice = s.pendingChoice
    const id = select(choice, s) ?? ['done', 'skip', 'self'].find(id => choice.options.some(option => option.id === id))
      ?? choice.options[0].id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}
const failTest = (s, seat = 0) => transaction(s, draft => scenarioRuntime(draft, []).test(seat, 'willpower', 20, () => {}))
const bossIn = (s, id) => s.enemies.find(item => item.id === id)

// 「进入漩涡」的巢穴与圣堂地点：关卡设置时它们还在一边，按真实定义放到场上再生成古神。
function placeLocation(s, code) {
  const found = s.locations.find(location => (location.originalCode || location.code) === code)
  if (found) return found
  const definition = Object.entries(s.scenario.locations).find(([, location]) => (location.originalCode || location.code) === code)
  assert.ok(definition, `未知地点 ${code}`)
  scenarioRuntime(s, []).place(definition[0])
  return s.locations.find(location => (location.originalCode || location.code) === code)
}
// 一条真实敌人实例：直接生成（不经过遭遇牌库），并把场上原有的敌人清掉，避免遭遇牌干扰。
function bossScenario(count = 2) {
  const s = chapterFixture('intoTheMaelstrom', count)
  s.enemies = []
  for (const inv of s.investigators) { inv.engaged = []; inv.assets = [] }
  return s
}
// 结束本轮所有调查员的回合，让调查阶段真正结束（2 人局要连结束两次）。
function endInvestigationPhase(s) {
  for (let guard = 0; guard < 8 && s.status === 'playing'; guard++) {
    for (const inv of s.investigators) inv.actionsLeft = 0
    const command = legalMoves(s).find(move => move.action === 'endTurn')
    if (!command) break
    const roundBefore = s.round
    move(s, command)
    settle(s)
    if (s.round !== roundBefore) return
  }
}
// 沉睡古神的印刷 [action]：目标地点必须是自己所在位置，且不受「免疫调查员行动」影响。
function printedAction(s, boss) {
  const command = legalMoves(s).find(move => move.action === 'entityAbility' && move.entityId === boss.id)
  assert.ok(command, '沉睡古神的印刷行动应当仍可选择')
  move(s, command)
}

test('07292a 沉睡达贡：本地点的调查员检定失败后上资源，达到 1[per_investigator]+2 才翻面', () => {
  const s = chapterFixture('theLairOfDagon', 2)
  const bossId = enemy(s, { code: '07292a', engagedSeat: null, location: s.investigators[0].location }).id
  assert.equal(enemyIsSlumbering(s, bossIn(s, bossId), { entryOf: registeredEntry }), true)
  s.chaosBag = ['autofail']
  const threshold = s.numInvestigators + 2
  const enemiesBefore = s.enemies.length
  for (let index = 1; index < threshold; index++) {
    failTest(s)
    assert.equal(bossIn(s, bossId).resources, index, `第 ${index} 次失败后资源数`)
    assert.equal(bossIn(s, bossId).code, '07292a', '未达阈值不翻面')
  }
  failTest(s)
  assert.equal(bossIn(s, bossId).code, '07292b', '达到阈值翻到清醒面')
  assert.equal(s.enemies.length, enemiesBefore, '翻面只换同一张物理卡的面，不产生第二个敌人')
  assert.equal(enemyIsSlumbering(s, bossIn(s, bossId), { entryOf: registeredEntry }), false)
})

test('07292a 沉睡达贡：远处地点的检定失败不放置资源', () => {
  const s = chapterFixture('theLairOfDagon', 2)
  const elsewhere = s.locations.find(location => location.id !== s.investigators[0].location).id
  const bossId = enemy(s, { code: '07292a', engagedSeat: null, location: elsewhere }).id
  s.chaosBag = ['autofail']
  failTest(s)
  assert.equal(bossIn(s, bossId).resources ?? 0, 0, '达贡不在检定者所在地点时不触发')
})

test('07292a 沉睡达贡：花1把钥匙移除1资源，资源为0时该行动不出现', () => {
  const s = chapterFixture('theLairOfDagon', 2)
  const bossId = enemy(s, { code: '07292a', engagedSeat: null, location: s.investigators[0].location }).id
  const actionFor = () => legalMoves(s).find(command => command.action === 'entityAbility'
    && command.entityId === bossId && command.actionKind === 'activate')
  assert.equal(actionFor(), undefined, '没有资源时没有可用的「花钥匙移除资源」行动')
  bossIn(s, bossId).resources = 2
  const api = createMechanicsApi(s)
  assert.equal(api.keys.transfer('green', s.scenarioFlags.mechanics.keys.green.holder, 'investigator:0', { reveal: true }), true)
  const command = actionFor()
  assert.ok(command, '有资源且有钥匙时行动出现')
  move(s, command)
  settle(s)
  assert.equal(bossIn(s, bossId).resources, 1)
  assert.equal(keysAt(s, 'reference').includes('green'), true, '钥匙进了当前场景')
  assert.equal(keysAt(s, 'investigator:0').includes('green'), false)
})

test('07292b 觉醒达贡：6 点生命值加每名调查员 6 点，本地检定失败后重整并攻击', () => {
  const s = bossScenario(2)
  const bossId = scenarioRuntime(s, []).spawn('07292a', s.investigators[0].location).id
  s.chaosBag = ['autofail']
  // 恰好达到 1[per_investigator]+2 的那次失败完成翻面；新面的能力不会回头结算这一次检定。
  const threshold = s.numInvestigators + 2
  for (let index = 1; index < threshold; index++) failTest(s)
  const harmBeforeFlip = { damage: s.investigators[0].damage, horror: s.investigators[0].horror }
  failTest(s)
  assert.equal(bossIn(s, bossId).code, '07292b')
  assert.deepEqual({ damage: s.investigators[0].damage, horror: s.investigators[0].horror }, harmBeforeFlip,
    '翻面的那次失败不触发新面攻击')
  // 印刷 6 点 + 6×2 人 = 18；翻面不改实例，伤害计数从 0 开始。
  assert.equal(enemyHealth(s, bossIn(s, bossId)), 18)
  const damageBefore = s.investigators[0].damage
  const horrorBefore = s.investigators[0].horror
  bossIn(s, bossId).exhausted = true
  failTest(s)
  assert.equal(bossIn(s, bossId).exhausted, false, '本地检定失败后达贡重整')
  // resolveTransaction 会用草稿替换 state，事务前的调查员引用会失效——这里从 state 重新取。
  assert.ok(s.investigators[0].damage > damageBefore && s.investigators[0].horror > horrorBefore,
    '重整后的同一次失败会让达贡攻击该调查员')
})

test('07330a 沉睡达贡：印刷意志(4) 行动成功后可横置或移除 1 个毁灭', () => {
  const s = bossScenario(2)
  const boss = scenarioRuntime(s, []).spawn('07330a', s.investigators[0].location)
  s.chaosBag = ['+5']
  printedAction(s, boss)
  settle(s, choice => choice.options.some(option => option.id === 'exhaust') ? 'exhaust' : null)
  assert.equal(bossIn(s, boss.id).exhausted, true, '选择横置古神')
  assert.equal(bossIn(s, boss.id).doom ?? 0, 0, '横置分支不放置毁灭')

  const s2 = bossScenario(2)
  const boss2 = scenarioRuntime(s2, []).spawn('07330a', s2.investigators[0].location)
  boss2.doom = 2
  s2.chaosBag = ['+5']
  printedAction(s2, boss2)
  settle(s2, choice => choice.options.some(option => option.id === 'doom') ? 'doom' : null)
  assert.equal(bossIn(s2, boss2.id).doom, 1, '选择移除 1 个毁灭')
  assert.equal(bossIn(s2, boss2.id).exhausted, false, '移除毁灭分支不横置')
})

test('07330a 沉睡达贡：行动失败低于难度 3 点才放置 1 个毁灭', () => {
  const s = bossScenario(2)
  const boss = scenarioRuntime(s, []).spawn('07330a', s.investigators[0].location)
  // 意志 3 + (-1) = 2，难度 4，低于 2 点：不放置毁灭。
  s.chaosBag = ['-1']
  printedAction(s, boss)
  settle(s)
  assert.equal(s.lastTestResult?.success, false)
  assert.equal(bossIn(s, boss.id).doom ?? 0, 0, '失败不足 3 点不放置毁灭')

  const s2 = bossScenario(2)
  const boss2 = scenarioRuntime(s2, []).spawn('07330a', s2.investigators[0].location)
  s2.chaosBag = ['autofail']
  printedAction(s2, boss2)
  settle(s2)
  assert.equal(bossIn(s2, boss2.id).doom, 1, '失败至少 3 点放置 1 个毁灭')
})

test('07331a 沉睡海德拉：同一条管线（巢穴换成海德拉巢穴，行动同样可用）', () => {
  const s = bossScenario(2)
  const lair = placeLocation(s, '07329')
  s.investigators[0].location = lair.id
  const boss = scenarioRuntime(s, []).spawn('07331a', lair.id)
  assert.equal(enemyIsSlumbering(s, boss, { entryOf: registeredEntry }), true)
  boss.doom = 1
  s.chaosBag = ['+5']
  printedAction(s, boss)
  settle(s, choice => choice.options.some(option => option.id === 'doom') ? 'doom' : null)
  assert.equal(bossIn(s, boss.id).doom, 0, '海德拉同样能移除毁灭')
})

test('07330a/07331a：调查阶段结束时，在巢穴且有调查员且处于重整才放置毁灭', () => {
  const ready = bossScenario(2)
  const readyLair = placeLocation(ready, '07328')
  ready.investigators[0].location = readyLair.id
  const readyBoss = scenarioRuntime(ready, []).spawn('07330a', readyLair.id)
  endInvestigationPhase(ready)
  assert.equal(bossIn(ready, readyBoss.id).doom, 1, '调查阶段结束：达贡巢穴里的重整达贡放置 1 个毁灭')

  const exhausted = bossScenario(2)
  const exhaustedLair = placeLocation(exhausted, '07328')
  exhausted.investigators[0].location = exhaustedLair.id
  const exhaustedBoss = scenarioRuntime(exhausted, []).spawn('07330a', exhaustedLair.id)
  exhaustedBoss.exhausted = true
  endInvestigationPhase(exhausted)
  assert.equal(bossIn(exhausted, exhaustedBoss.id).doom ?? 0, 0, '横置的古神不放置毁灭')

  const absent = bossScenario(2)
  const absentLair = placeLocation(absent, '07329')
  const absentBoss = scenarioRuntime(absent, []).spawn('07331a', absentLair.id)
  endInvestigationPhase(absent)
  assert.equal(bossIn(absent, absentBoss.id).doom ?? 0, 0, '巢穴里没有调查员时不放置毁灭')
})

test('07330a→07330b 物理换面：保留 id/伤害/毁灭/钥匙，觉醒面具备猎手庞大反击且无生命值', () => {
  const s = bossScenario(2)
  const lair = placeLocation(s, '07328')
  s.investigators[0].location = lair.id
  const boss = scenarioRuntime(s, []).spawn('07330a', lair.id)
  Object.assign(boss, { exhausted: true, damageTaken: 2, doom: 3 })
  createMechanicsApi(s).keys.transfer('blue', 'setAside', `enemy:${boss.id}`, { reveal: true })
  assert.equal(enemyHealth(s, boss), null, '沉睡面没有生命值')

  scenarioRuntime(s, []).flipEnemy(bossIn(s, boss.id), '07330b')
  const awake = bossIn(s, boss.id)
  assert.equal(awake.code, '07330b')
  assert.equal(s.enemies.length, 1, '换面不产生第二个敌人')
  assert.equal(enemyHealth(s, awake), null, '觉醒面同样没有生命值')
  assert.deepEqual({ hunter: awake.hunter, massive: awake.massive, retaliate: awake.retaliate },
    { hunter: true, massive: true, retaliate: true }, '印刷关键词随新面生效')
  assert.deepEqual({ exhausted: awake.exhausted, damageTaken: awake.damageTaken, doom: awake.doom },
    { exhausted: true, damageTaken: 2, doom: 3 }, '横置/伤害/毁灭计数保留')
  assert.deepEqual(keysAt(s, `enemy:${awake.id}`), ['blue'], '钥匙留在同一物理敌人上')

  scenarioRuntime(s, []).flipEnemy(bossIn(s, boss.id), '07330a')
  const sleeping = bossIn(s, boss.id)
  assert.equal(sleeping.code, '07330a')
  assert.deepEqual({ hunter: sleeping.hunter, massive: sleeping.massive }, { hunter: false, massive: false },
    '翻回沉睡面时重置关键词')
  assert.equal(enemyIsSlumbering(s, sleeping, { entryOf: registeredEntry }), true)
})

test('07330b 觉醒达贡：每个有钥匙的圣堂地点 -1 攻击，非圣堂地点不计', () => {
  const s = bossScenario(2)
  const boss = scenarioRuntime(s, []).spawn('07330b', s.investigators[0].location)
  assert.equal(enemyFightValue(s, boss, s.investigators[0]), 7)
  const sanctum = placeLocation(s, '07324')
  createMechanicsApi(s).keys.transfer('blue', 'setAside', `location:${sanctum.id}`, { reveal: true })
  assert.equal(enemyFightValue(s, bossIn(s, boss.id), s.investigators[0]), 6)
  const sanctum2 = placeLocation(s, '07325')
  createMechanicsApi(s).keys.transfer('red', 'setAside', `location:${sanctum2.id}`, { reveal: true })
  assert.equal(enemyFightValue(s, bossIn(s, boss.id), s.investigators[0]), 5)
  // 非圣堂地点（伊哈·恩斯雷门扉）上的钥匙不减攻击。
  createMechanicsApi(s).keys.transfer('green', 'setAside',
    `location:${s.investigators[0].location}`, { reveal: true })
  assert.equal(enemyFightValue(s, bossIn(s, boss.id), s.investigators[0]), 5)
})

test('07330b 觉醒达贡：受到伤害后对一张达贡之子造成同量伤害；被躲避后同样躲避子嗣', () => {
  const s = bossScenario(2)
  const runtime = scenarioRuntime(s, [])
  const boss = runtime.spawn('07330b', s.investigators[0].location)
  const brood = runtime.spawn('07333', s.investigators[0].location)
  runtime.damageEnemy(boss.id, 3, 0)
  assert.equal(bossIn(s, boss.id).damageTaken, 3)
  assert.equal(bossIn(s, brood.id).damageTaken, 3, '子嗣受到同样的 3 点伤害')

  const evadeScenario = bossScenario(2)
  const evadeRuntime = scenarioRuntime(evadeScenario, [])
  const dagon = evadeRuntime.spawn('07330b', evadeScenario.investigators[0].location)
  const secondBrood = evadeRuntime.spawn('07333', evadeScenario.investigators[0].location)
  assert.equal(evadeRuntime.evadeEnemy(bossIn(evadeScenario, dagon.id)), true)
  assert.equal(bossIn(evadeScenario, dagon.id).exhausted, true)
  assert.equal(bossIn(evadeScenario, secondBrood.id).exhausted, true, '子嗣被同样躲避')
})

test('07330b/07331b：没有生命值的觉醒古神受到 100 点伤害也不会自动击败', () => {
  const s = bossScenario(2)
  const runtime = scenarioRuntime(s, [])
  const boss = runtime.spawn('07331b', s.investigators[0].location)
  runtime.damageEnemy(boss.id, 100, 0)
  assert.equal(s.enemies.some(card => card.id === boss.id), true, '无生命值的古神留在场上')
  assert.equal(bossIn(s, boss.id).damageTaken, 100, '伤害计数保留，供幕目标读取')
})

test('07331b 觉醒海德拉：只镜像到海德拉之子，不会命中达贡之子', () => {
  const s = bossScenario(2)
  const runtime = scenarioRuntime(s, [])
  const hydra = runtime.spawn('07331b', s.investigators[0].location)
  const hydraBrood = runtime.spawn('07334', s.investigators[0].location)
  const dagonBrood = runtime.spawn('07333', s.investigators[0].location)
  runtime.damageEnemy(hydra.id, 2, 0)
  assert.equal(bossIn(s, hydraBrood.id).damageTaken, 2)
  assert.equal(bossIn(s, dagonBrood.id).damageTaken ?? 0, 0)
})

test('07330a 沉睡达贡：真实卡牌仍不是基础攻击/躲避/交战目标，提交也会被拒绝', () => {
  const s = bossScenario(1)
  const boss = scenarioRuntime(s, []).spawn('07330a', s.investigators[0].location)
  for (const action of ['fight', 'evade', 'engage']) {
    assert.equal(legalMoves(s).some(command => command.action === action && command.enemyId === boss.id), false)
    assert.ok(validateMove(s, 0, { action, enemyId: boss.id }), `${action} 提交应被拒绝`)
  }
  assert.equal(enemyIsSlumbering(s, bossIn(s, boss.id), { entryOf: registeredEntry }), true)
})

