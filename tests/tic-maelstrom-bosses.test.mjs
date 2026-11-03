// P7 沉睡 boss 五面：07292b（达贡苏醒面）、07330a/07330b（达贡双面）、07331a/07331b（海德拉双面）。
//
// 分工：
//   · 沉睡的「不能攻击 / 不能与调查员交战 / 免疫调查员行动和玩家卡牌效果」由
//     enemyRule.slumbering + src/engine/effect-provenance.js 统一执行（见 tic-effect-provenance）；
//   · 本文件验证五张卡自己的印刷能力：苏醒面生命值/攻击值修正、失败检定后的重整与攻击、
//     调查阶段结束放毁灭、意志检定行动、对子嗣复制躲避/伤害；
//   · 另外验证两个新接线的引擎读点：条目级 enemyDamaged 窗口、investigationPhaseEnds 窗口，
//     以及持久修正行的来源过滤（enemyModifierAllowed，沉睡目标拒绝玩家卡来源的行）。
//
// 事务约定：resolveTransaction 成功后会用草稿替换 state 内容，事务前拿到的敌人引用会失效，
// 所以每次事务之后都按 id 从 state 重新取实例（与 tests/tic-slumbering-bosses.test.mjs 同一写法）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { asset, enemy, legalMoves, move, settle, validateMove } from './core-fixture.mjs'
import { enemyFightValue, enemyHealth, reactionWindow, scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { enemyIsSlumbering, enemyModifierAllowed } from '../src/engine/effect-provenance.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

function transaction(s, execute, select = () => null) {
  resolveTransaction(s, 0, { action: 'testTicMaelstromBoss' }, execute)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 80, `choice loop ${s.pendingChoice.source}`)
    const choice = s.pendingChoice
    const id = select(choice, s) ?? ['done', 'skip', 'self'].find(id => choice.options.some(option => option.id === id))
      ?? choice.options[0].id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}
const bossIn = (s, id) => s.enemies.find(item => item.id === id)
const spawn = (s, code, location) => scenarioRuntime(s, []).spawn(code, location)
// 暗潮之下把巢穴放在 scenarioZones.setAside，定义键是 innyLocationN；按印刷卡号找定义键后实际放入。
function placeLocation(s, code) {
  const definitionKey = Object.entries(s.scenario.locations)
    .find(([, definition]) => (definition.code || definition.originalCode) === code)?.[0]
  assert.ok(definitionKey, `scenario has no location ${code}`)
  transaction(s, draft => { scenarioRuntime(draft, []).place(definitionKey) })
  const placed = s.locations.find(location => (location.originalCode || location.code) === code)
  assert.ok(placed, `location ${code} not placed`)
  return placed
}
const damageEnemy = (s, enemyId, amount, seat = 0, source = 'test-source') => transaction(s,
  draft => { scenarioRuntime(draft, []).damageEnemy(enemyId, amount, seat, source) })
const evadeEnemy = (s, enemyId) => transaction(s,
  draft => { scenarioRuntime(draft, []).evadeEnemy(draft.enemies.find(item => item.id === enemyId)) })
const failTest = (s, seat = 0) => transaction(s, draft => { scenarioRuntime(draft, []).test(seat, 'willpower', 20, () => {}) })
const setStats = (s, stats = { willpower: 20, intellect: 20, combat: 20, agility: 20 }) => {
  for (const inv of s.investigators) Object.assign(inv, stats)
}

// 测试用监听条目：只把窗口事实写进 scenarioFlags，不碰任何源码路径。
const damageProbe = {
  code: 'testTicBossDamageProbe', scope: 'card',
  abilities: [{
    kind: 'forced', trigger: 'enemyDamaged',
    limit: { scope: 'perWindow', owner: 'instance' },
    resolve: ({ state, context, api }) => {
      const previous = state.scenarioFlags.bossDamageProbe || { count: 0, amounts: [], enemies: [] }
      api.setScenarioFlag('bossDamageProbe', {
        count: previous.count + 1,
        amounts: [...previous.amounts, context.damage],
        enemies: [...previous.enemies, context.enemy?.id ?? null],
      })
    },
  }],
}
if (!registeredEntry(damageProbe.code)) registerCardAbilities([damageProbe])

// ---------------------------------------------------------------------------
// 07292b 达贡（苏醒狂怒）· 达贡密教巢穴
// ---------------------------------------------------------------------------

test('07292b 苏醒达贡：生命值 = 印刷 6 + 6×调查员人数，苏醒面不再是 slumbering', () => {
  for (const count of [1, 2, 3, 4]) {
    const s = chapterFixture('theLairOfDagon', count)
    s.enemies = []
    const boss = spawn(s, '07292b', s.investigators[0].location)
    assert.ok(boss)
    assert.equal(enemyHealth(s, bossIn(s, boss.id)), 6 + 6 * count, `${count} 人时生命值`)
    assert.equal(enemyIsSlumbering(s, bossIn(s, boss.id), { entryOf: registeredEntry }), false)
    assert.equal(bossIn(s, boss.id).massive, true, '庞大由印刷文本解析')
  }
})

test('07292b 苏醒达贡：本地点的调查员检定失败后重整并攻击该调查员', () => {
  const s = chapterFixture('theLairOfDagon', 2)
  s.enemies = []
  const boss = spawn(s, '07292b', s.investigators[0].location)
  boss.exhausted = true
  const damageBefore = s.investigators[0].damage
  s.chaosBag = ['autofail']
  failTest(s)
  const current = bossIn(s, boss.id)
  assert.equal(current.exhausted, false, '失败检定后重整')
  assert.equal(s.investigators[0].damage, damageBefore + 2, '达贡攻击失败的调查员（伤害 2）')
})

test('07292b 苏醒达贡：远处地点的检定失败不触发强制', () => {
  const s = chapterFixture('theLairOfDagon', 2)
  s.enemies = []
  const elsewhere = s.locations.find(location => location.id !== s.investigators[0].location).id
  const boss = spawn(s, '07292b', elsewhere)
  boss.exhausted = true
  const damageBefore = s.investigators[0].damage
  s.chaosBag = ['autofail']
  failTest(s)
  assert.equal(bossIn(s, boss.id).exhausted, true, '不在达贡所在地点，不重整')
  assert.equal(s.investigators[0].damage, damageBefore, '不攻击')
})

// ---------------------------------------------------------------------------
// 07330a / 07331a 达贡、海德拉（深入沉睡）
// ---------------------------------------------------------------------------

test('07330a/07331a 沉睡面：注册为 slumbering，玩家战斗/躲避/交战/攻击都被拒绝', () => {
  for (const [code, lairCode] of [['07330a', '07328'], ['07331a', '07329']]) {
    const s = chapterFixture('intoTheMaelstrom', 1)
    s.enemies = []
    const lair = placeLocation(s, lairCode)
    s.investigators[0].location = lair.id
    setStats(s)
    const boss = spawn(s, code, lair.id)
    assert.equal(registeredEntry(code).enemyRule.slumbering, true, `${code} 是沉睡面`)
    assert.equal(enemyIsSlumbering(s, bossIn(s, boss.id), { entryOf: registeredEntry }), true)
    const moves = legalMoves(s)
    assert.equal(moves.some(command => command.action === 'fight' && command.enemyId === boss.id), false)
    assert.equal(moves.some(command => command.action === 'evade' && command.enemyId === boss.id), false)
    assert.equal(moves.some(command => command.action === 'engage' && command.enemyId === boss.id), false)
    assert.match(String(validateMove(s, 0, { action: 'fight', enemyId: boss.id })), /沉睡/)
    // 剧本/遭遇来源的「攻击」也不能让沉睡的它攻击（"不能攻击"是无条件的）。
    const damageBefore = s.investigators[0].damage
    transaction(s, draft => { scenarioRuntime(draft, []).attack(draft.enemies.find(item => item.id === boss.id), draft.investigators[0]) })
    assert.equal(s.investigators[0].damage, damageBefore, '沉睡的它不能攻击')
    // 自己的 [action] 仍然可用（印刷写在这张沉睡面上）。
    assert.equal(moves.some(command => command.action === 'entityAbility' && command.entityId === boss.id
      && command.actionKind === 'activate'), true, `${code} 的意志检定行动可见`)
  }
})

test('07330a 沉睡达贡：调查阶段结束时，调查员在达贡巢穴且它未横置 → 放置 1 个毁灭', () => {
  const s = chapterFixture('intoTheMaelstrom', 1)
  s.enemies = []
  const lair = placeLocation(s, '07328')
  s.investigators[0].location = lair.id
  const boss = spawn(s, '07330a', lair.id)
  assert.equal(legalMoves(s).some(command => command.action === 'endTurn'), true)
  move(s, { action: 'endTurn' })
  settle(s)
  assert.equal(bossIn(s, boss.id).doom, 1, '调查阶段结束窗口在真实回合流程里派发')
})

test('07330a 沉睡达贡：调查员不在巢穴或达贡已横置时不放置毁灭', () => {
  // a) 调查员不在巢穴
  {
    const s = chapterFixture('intoTheMaelstrom', 1)
    s.enemies = []
    const lair = placeLocation(s, '07328')
    s.investigators[0].location = s.scenario.startLocation
    const boss = spawn(s, '07330a', lair.id)
    move(s, { action: 'endTurn' })
    settle(s)
    assert.equal(bossIn(s, boss.id).doom ?? 0, 0, '调查员不在巢穴，不放置')
  }
  // b) 达贡已横置
  {
    const s = chapterFixture('intoTheMaelstrom', 1)
    s.enemies = []
    const lair = placeLocation(s, '07328')
    s.investigators[0].location = lair.id
    const boss = spawn(s, '07330a', lair.id)
    bossIn(s, boss.id).exhausted = true
    move(s, { action: 'endTurn' })
    settle(s)
    assert.equal(bossIn(s, boss.id).doom ?? 0, 0, '已横置，不放置')
  }
})

test('07331a 沉睡海德拉：调查阶段结束时按「海德拉巢穴」判定放置毁灭', () => {
  const s = chapterFixture('intoTheMaelstrom', 1)
  s.enemies = []
  const hydraLair = placeLocation(s, '07329')
  s.investigators[0].location = hydraLair.id
  const hydra = spawn(s, '07331a', hydraLair.id)
  move(s, { action: 'endTurn' })
  settle(s)
  assert.equal(bossIn(s, hydra.id).doom, 1)
})

test('07330a 意志检定行动：成功时横置达贡；再次成功时移除 1 个毁灭', () => {
  const s = chapterFixture('intoTheMaelstrom', 1)
  s.enemies = []
  const lair = placeLocation(s, '07328')
  s.investigators[0].location = lair.id
  setStats(s)
  const boss = spawn(s, '07330a', lair.id)
  const actionOf = () => legalMoves(s).find(command => command.action === 'entityAbility'
    && command.entityId === boss.id && command.actionKind === 'activate')
  s.chaosBag = ['0']
  move(s, actionOf())
  settle(s, choice => (choice.options.some(option => option.id === 'exhaust') ? 'exhaust' : null))
  assert.equal(bossIn(s, boss.id).exhausted, true, '成功选项：横置达贡')
  // 印刷只给「横置 / 移除 1 个毁灭」两个选项，没有可做的事时行动仍可检定（参考实现只限制
  // OnSameLocation），成功且无选项时安全结算、不产生任何写入。
  assert.ok(actionOf(), '没有可做的事时行动仍然可用（与参考实现的 OnlySameLocation 一致）')
  move(s, actionOf())
  settle(s)
  assert.equal(bossIn(s, boss.id).exhausted, true)
  assert.equal(bossIn(s, boss.id).doom ?? 0, 0)
  // 给 1 个毁灭后「移除毁灭」是唯一选项。
  bossIn(s, boss.id).doom = 1
  move(s, actionOf())
  settle(s)
  assert.equal(bossIn(s, boss.id).doom, 0, '成功选项：移除 1 个毁灭')
})

test('07330a 意志检定行动：失败至少 3 点放置 1 个毁灭，失败不足 3 点不放置', () => {
  // a) 自动失败：失败差额 >= 3
  {
    const s = chapterFixture('intoTheMaelstrom', 1)
    s.enemies = []
    const lair = placeLocation(s, '07328')
    s.investigators[0].location = lair.id
    setStats(s)
    const boss = spawn(s, '07330a', lair.id)
    s.chaosBag = ['autofail']
    move(s, legalMoves(s).find(command => command.action === 'entityAbility' && command.entityId === boss.id))
    settle(s)
    assert.equal(bossIn(s, boss.id).doom, 1, '失败差额 >= 3 → 放 1 个毁灭')
  }
  // b) 意志 4 + 混乱标记 -2：失败差额 2，不放置
  {
    const s = chapterFixture('intoTheMaelstrom', 1)
    s.enemies = []
    const lair = placeLocation(s, '07328')
    s.investigators[0].location = lair.id
    setStats(s, { willpower: 4, intellect: 20, combat: 20, agility: 20 })
    const boss = spawn(s, '07330a', lair.id)
    s.chaosBag = ['-2']
    move(s, legalMoves(s).find(command => command.action === 'entityAbility' && command.entityId === boss.id))
    settle(s)
    assert.equal(bossIn(s, boss.id).doom ?? 0, 0, '失败差额 < 3 → 不放置')
  }
})

// ---------------------------------------------------------------------------
// 07330b / 07331b 达贡、海德拉（苏醒狂怒）
// ---------------------------------------------------------------------------

test('07330b 苏醒达贡：攻击值 -1/有钥匙的圣堂地点，非圣堂或没钥匙的地点不计数', () => {
  const s = chapterFixture('intoTheMaelstrom', 1)
  s.enemies = []
  const boss = spawn(s, '07330b', s.investigators[0].location)
  const api = createMechanicsApi(s)
  assert.equal(enemyFightValue(s, bossIn(s, boss.id), s.investigators[0]), 7, '无钥匙圣堂时攻击 7')
  const sanctumOne = placeLocation(s, '07324')
  const sanctumTwo = placeLocation(s, '07325')
  api.keys.transfer('red', 'setAside', `location:${sanctumOne.id}`, { reveal: true })
  api.keys.transfer('yellow', 'setAside', `location:${sanctumTwo.id}`, { reveal: true })
  assert.equal(enemyFightValue(s, bossIn(s, boss.id), s.investigators[0]), 5, '两个有钥匙的圣堂 → 攻击 5')
  // 同一个圣堂上多放一把未揭示的钥匙仍然只算 1 个地点。
  api.keys.transfer('green', 'setAside', `location:${sanctumOne.id}`, { reveal: false })
  assert.equal(enemyFightValue(s, bossIn(s, boss.id), s.investigators[0]), 5, '同地点多钥匙只算一个地点')
  // 非圣堂地点上的钥匙不计数。
  const start = s.locations.find(location => location.id === s.scenario.startLocation)
  api.keys.transfer('blue', 'setAside', `location:${start.id}`, { reveal: true })
  assert.equal(enemyFightValue(s, bossIn(s, boss.id), s.investigators[0]), 5)
  assert.equal(bossIn(s, boss.id).hunter, true, '猎手由印刷文本解析')
  assert.equal(bossIn(s, boss.id).retaliate, true, '反击由印刷文本解析')
})

test('07331b 苏醒海德拉：同样的圣堂钥匙攻击值修正', () => {
  const s = chapterFixture('intoTheMaelstrom', 1)
  s.enemies = []
  const hydra = spawn(s, '07331b', s.investigators[0].location)
  const sanctum = placeLocation(s, '07326')
  createMechanicsApi(s).keys.transfer('red', 'setAside', `location:${sanctum.id}`, { reveal: true })
  assert.equal(enemyFightValue(s, bossIn(s, hydra.id), s.investigators[0]), 6)
})

test('07330b 苏醒达贡：受到伤害后对场上唯一一张达贡的子嗣造成等量伤害', () => {
  const s = chapterFixture('intoTheMaelstrom', 1)
  s.enemies = []
  const boss = spawn(s, '07330b', s.investigators[0].location)
  const brood = spawn(s, '07333', s.investigators[0].location)
  damageEnemy(s, boss.id, 2)
  assert.equal(bossIn(s, boss.id).damageTaken, 2)
  assert.equal(bossIn(s, brood.id).damageTaken, 2, '子嗣也受到同样的 2 点伤害')
  // 伤害子嗣不会反过来触发达贡（印刷只写达贡被伤害/躲避）。
  damageEnemy(s, brood.id, 1)
  assert.equal(bossIn(s, boss.id).damageTaken, 2)
})

test('07330b 苏醒达贡：多张子嗣时由触发者选择，未选中的不受伤', () => {
  const s = chapterFixture('intoTheMaelstrom', 1)
  s.enemies = []
  const boss = spawn(s, '07330b', s.investigators[0].location)
  const first = spawn(s, '07333', s.investigators[0].location)
  const second = spawn(s, '07333', s.investigators[0].location)
  transaction(s, draft => { scenarioRuntime(draft, []).damageEnemy(boss.id, 3, 0, 'test-source') },
    choice => (choice.options.length >= 2 ? choice.options[0].id : null))
  const damaged = [bossIn(s, first.id).damageTaken || 0, bossIn(s, second.id).damageTaken || 0]
  assert.deepEqual(damaged.sort(), [0, 3], '只有一张子嗣受到同样伤害')
})

test('07330b 苏醒达贡：被躲避后对子嗣也执行躲避；场上没有子嗣时安全结算', () => {
  const s = chapterFixture('intoTheMaelstrom', 1)
  s.enemies = []
  const boss = spawn(s, '07330b', s.investigators[0].location)
  evadeEnemy(s, boss.id)
  assert.equal(bossIn(s, boss.id).exhausted, true, '没有子嗣时正常躲避')
  const brood = spawn(s, '07333', s.investigators[0].location)
  bossIn(s, boss.id).exhausted = false
  evadeEnemy(s, boss.id)
  assert.equal(bossIn(s, brood.id).exhausted, true, '子嗣也被躲避')
})

test('07331b 苏醒海德拉：伤害复制到海德拉的子嗣', () => {
  const s = chapterFixture('intoTheMaelstrom', 1)
  s.enemies = []
  const hydra = spawn(s, '07331b', s.investigators[0].location)
  const brood = spawn(s, '07334', s.investigators[0].location)
  damageEnemy(s, hydra.id, 2)
  assert.equal(bossIn(s, brood.id).damageTaken, 2)
})

// ---------------------------------------------------------------------------
// 引擎读点：条目级 enemyDamaged 窗口 + 持久修正行的来源过滤
// ---------------------------------------------------------------------------

test('enemyDamaged 窗口：通用伤害入口按次派发，上下文带真实伤害量与敌人', () => {
  const s = chapterFixture('intoTheMaelstrom', 1)
  s.enemies = []
  asset(s, damageProbe.code)
  const target = enemy(s, { health: 99 })
  damageEnemy(s, target.id, 2, 0, 'probe-source')
  const probe = s.scenarioFlags.bossDamageProbe
  assert.equal(probe?.count, 1, 'damageEnemy 派发一次条目级窗口')
  assert.deepEqual(probe.amounts, [2])
  assert.deepEqual(probe.enemies, [target.id])
})

test('enemyDamaged 窗口：普通战斗攻击伤害路径也派发一次', () => {
  const s = chapterFixture('intoTheMaelstrom', 1)
  s.enemies = []
  asset(s, damageProbe.code)
  setStats(s)
  const target = enemy(s, { health: 99, fight: 1, evade: 1, engagedSeat: 0 })
  const before = target.damageTaken || 0
  s.chaosBag = ['0']
  move(s, { action: 'fight', enemyId: target.id })
  settle(s)
  const after = bossIn(s, target.id).damageTaken || 0
  const probe = s.scenarioFlags.bossDamageProbe
  assert.equal(after > before, true, '攻击造成了伤害')
  assert.equal(probe?.count, 1, '战斗伤害路径派发一次（不重复）')
  assert.deepEqual(probe.amounts, [after - before])
})

test('持久修正行读点：沉睡目标的修正行按来源过滤（玩家卡拒绝、遭遇来源放行）', () => {
  const s = chapterFixture('intoTheMaelstrom', 1)
  s.enemies = []
  const lair = placeLocation(s, '07328')
  const sleeping = spawn(s, '07330a', lair.id)
  const deps = { entryOf: registeredEntry, cardDef: code => ALL_CARDS[code] || null }
  assert.equal(enemyModifierAllowed(s, bossIn(s, sleeping.id), { source: { code: '01016' }, host: 'self' }, deps),
    false, '玩家卡来源的修正行被拒绝')
  assert.equal(enemyModifierAllowed(s, bossIn(s, sleeping.id), { source: { code: '07328' }, host: 'location' }, deps),
    true, '地点（遭遇来源）的修正行照常')
  assert.equal(enemyModifierAllowed(s, bossIn(s, sleeping.id), { source: bossIn(s, sleeping.id), host: 'self' }, deps),
    true, '自己的条目修正照常')
  const awake = spawn(s, '07330b', lair.id)
  assert.equal(enemyModifierAllowed(s, bossIn(s, awake.id), { source: { code: '01016' }, host: 'self' }, deps),
    true, '非沉睡敌人不过滤')
})

test('investigationPhaseEnds 窗口：没有监听者时开窗不改状态指纹字段', () => {
  const s = chapterFixture('intoTheMaelstrom', 1)
  s.enemies = []
  const before = JSON.stringify(s.abilityLimits ?? null)
  transaction(s, draft => reactionWindow(draft, 'investigationPhaseEnds',
    { when: 'investigationPhaseEnds', phase: 'investigation', round: draft.round }, []))
  assert.equal(JSON.stringify(s.abilityLimits ?? null), before)
})
