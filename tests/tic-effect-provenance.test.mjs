// 效果来源 provenance 与沉睡敌人免疫（P7 交接优先顺序第 3 条的引擎底座）。
//
// 权威口径（参考实现 Arkham/Helpers/Source.hs）：
//   · AssetSource / EventSource / SkillSource / InvestigatorSource 都是玩家卡来源，
//     与阵营无关；**无人控制的剧情资产（story）也算玩家卡来源**；
//   · 不能拿 actor 座位、敌人检定里的展示卡或外层动作当来源；
//   · 沉睡（enemyRule.slumbering）的敌人免疫玩家卡效果与调查员行动，剧本/遭遇来源照常，
//     来源未知时 fail-closed。
//
// 这些用例只验证引擎判定与进程内帧，不写 state 字段，因此不改存档/重放指纹。

import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, enemy, legalMoves, validateMove } from './core-fixture.mjs'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { executeDescriptor, scenarioRuntime } from '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import {
  cardEffectSource, currentEffectSource, effectSourceKindOfType, enemyEffectAllowed, enemyIsSlumbering,
  normalizeEffectSource, scopedScenarioBehavior, withEffectSource,
} from '../src/engine/effect-provenance.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const slumberingProbe = {
  code: '07292a', scope: 'enemy', enemyRule: { slumbering: true }, abilities: [],
}
if (!registeredEntry(slumberingProbe.code)) registerCardAbilities([slumberingProbe])

const defOf = code => ALL_CARDS[code] || null
const deps = { entryOf: registeredEntry, isBlanked: () => false, cardDef: defOf }

test('来源类别：玩家卡（含无人控制的剧情资产）与遭遇/剧本来源分开，未知类型不猜', () => {
  for (const type of ['asset', 'event', 'skill', 'investigator', 'story']) {
    assert.equal(effectSourceKindOfType(type), 'playerCard', `${type} 属于玩家卡来源`)
  }
  for (const type of ['enemy', 'location', 'act', 'agenda', 'treachery', 'scenario', 'enemy_location']) {
    assert.equal(effectSourceKindOfType(type), 'encounterCard', `${type} 属于遭遇来源`)
  }
  assert.equal(effectSourceKindOfType('key'), null)
  assert.equal(effectSourceKindOfType(undefined), null)
  assert.equal(ALL_CARDS['07083'].type, 'asset', 'Harper 是玩家卡来源（即使无人控制）')
  assert.equal(effectSourceKindOfType(ALL_CARDS['07083'].type), 'playerCard')
})

test('来源规范化：缺 kind 或未知 kind 直接拒绝，合法字段被固化', () => {
  assert.throws(() => normalizeEffectSource(null), /effect source/)
  assert.throws(() => normalizeEffectSource({ code: '01016' }), /effect source/)
  assert.throws(() => normalizeEffectSource({ kind: 'guess', code: '01016' }), /effect source/)
  const source = normalizeEffectSource({ kind: 'playerCard', code: '01016', sourceId: 'a1', controllerSeat: 1 })
  assert.deepEqual({ ...source }, { kind: 'playerCard', code: '01016', sourceId: 'a1', controllerSeat: 1 })
  assert.equal(Object.isFrozen(source), true)
})

test('cardEffectSource：按卡面 type 分类；剧情资产无控制者为 null；未知卡号返回 null', () => {
  const state = fixture('01001', 2)
  assert.deepEqual({ ...cardEffectSource(state, null, { code: '01016' }, state.investigators[0], { cardDef: defOf }) },
    { kind: 'playerCard', code: '01016', sourceId: null, controllerSeat: 0 })
  // 无人控制的剧情资产也必须是 playerCard，且不能拿座位顶替控制者。
  assert.deepEqual({ ...cardEffectSource(state, { code: '07083' }, null, null, { cardDef: defOf }) },
    { kind: 'playerCard', code: '07083', sourceId: null, controllerSeat: null })
  assert.deepEqual({ ...cardEffectSource(state, { id: 'boss', code: '07292a' }, null, null, { cardDef: defOf }) },
    { kind: 'encounterCard', code: '07292a', sourceId: 'boss', controllerSeat: null })
  assert.equal(cardEffectSource(state, { code: '99999' }, null, null, { cardDef: defOf }), null)
  // 显式来源优先（嵌套原语可以把真实来源带下来）。
  assert.deepEqual({ ...cardEffectSource(state, { code: '01016', effectSource: { kind: 'scenarioRule', code: 'theLairOfDagon' } }, { code: '01016' }, state.investigators[0], { cardDef: defOf }) },
    { kind: 'scenarioRule', code: 'theLairOfDagon', sourceId: null, controllerSeat: null })
})

test('进程内帧：嵌套结算压栈并在退出时逐层还原，结算完不残留', () => {
  const state = fixture('01001')
  assert.equal(currentEffectSource(state), null)
  const seen = []
  withEffectSource(state, { kind: 'playerCard', code: '01016' }, () => {
    seen.push(currentEffectSource(state).kind)
    withEffectSource(state, { kind: 'scenarioRule', code: 'theLairOfDagon' }, () => {
      seen.push(currentEffectSource(state).kind)
      withEffectSource(state, null, () => seen.push(currentEffectSource(state).kind))
    })
    seen.push(currentEffectSource(state).kind)
  })
  assert.deepEqual(seen, ['playerCard', 'scenarioRule', 'scenarioRule', 'playerCard'])
  assert.equal(currentEffectSource(state), null)
})

test('真实描述子结算：帧覆盖整段 resolve，退出后还原', () => {
  const state = fixture('01001')
  const seen = []
  executeDescriptor(state, {
    inv: state.investigators[0], source: null, events: [],
    descriptor: { code: '01016', label: '来源探针', resolve: ({ api }) => {
      seen.push(currentEffectSource(state))
      // 描述子内部再结算另一张卡：内层必须有自己的来源，外层随后恢复。
      executeDescriptor(state, {
        inv: state.investigators[0], source: null, events: [],
        descriptor: { code: '01156', label: '内层探针', resolve: () => seen.push(currentEffectSource(state)) },
      })
      seen.push(currentEffectSource(state))
      void api
    } },
  })
  assert.equal(seen[0].code, '01016')
  assert.equal(seen[0].kind, 'playerCard')
  assert.equal(seen[0].controllerSeat, 0)
  assert.equal(seen[1].code, '01156')
  assert.equal(seen[2].code, '01016', '内层退出后外层来源必须还原')
  assert.equal(currentEffectSource(state), null)
})

test('沉睡敌人：玩家卡效果与无来源伤害都不生效，剧本/遭遇来源照常', () => {
  const state = fixture('01001')
  const boss = enemy(state, { code: '07292a', health: 99, fight: 6, evade: 6, location: state.investigators[0].location })
  boss.engagedSeat = null
  state.investigators[0].engaged = []
  assert.equal(enemyIsSlumbering(state, boss, deps), true)
  // 没有来源帧（例如基础行动的伤害）：fail-closed。
  assert.equal(scenarioRuntime(state, []).damageEnemy(boss.id, 2, 0), false)
  assert.equal(boss.damageTaken, 0)
  // 玩家卡描述子：不允许。
  executeDescriptor(state, {
    inv: state.investigators[0], source: null, events: [],
    descriptor: { code: '01016', label: '玩家卡伤害', resolve: ({ api }) => {
      assert.equal(api.damageEnemy(boss.id, 2, 0), false)
    } },
  })
  assert.equal(boss.damageTaken, 0)
  // 剧本/遭遇来源（例如圣堂地点的印刷效果）：允许。
  withEffectSource(state, { kind: 'encounterCard', code: '07292a', sourceId: boss.id }, () => {
    assert.equal(scenarioRuntime(state, []).damageEnemy(boss.id, 3, 0), true)
  })
  assert.equal(boss.damageTaken, 3)
  // 调查员行动一律不允许，即使来源帧缺失。
  for (const operation of ['initiateAttack', 'engage', 'fightAction', 'evadeAction']) {
    assert.equal(enemyEffectAllowed(state, boss, operation, deps), false, operation)
  }
})

test('沉睡判定只认当前印刷面：没有 slumbering 的敌人照常受伤，抹除文本后恢复', () => {
  const state = fixture('01001')
  const ghoul = enemy(state, { code: '01101', health: 99 })
  assert.equal(enemyIsSlumbering(state, ghoul, deps), false)
  assert.equal(scenarioRuntime(state, []).damageEnemy(ghoul.id, 2, 0), true)
  assert.equal(ghoul.damageTaken, 2)
  const boss = enemy(state, { code: '07292a', health: 99 })
  assert.equal(enemyIsSlumbering(state, boss, { ...deps, isBlanked: () => true }), false,
    '文本被抹除的敌人不再按沉睡结算')
})

test('沉睡敌人：攻击/躲避/交战既不出现在合法行动里，提交也会被拒绝', () => {
  const state = fixture('01001')
  const boss = enemy(state, { code: '07292a', health: 99, fight: 6, evade: 6 })
  boss.engagedSeat = 0
  state.investigators[0].engaged = [boss.id]
  const moves = legalMoves(state)
  assert.equal(moves.some(move => move.action === 'fight' && move.enemyId === boss.id), false, '不能攻击沉睡的达贡')
  assert.equal(moves.some(move => move.action === 'evade' && move.enemyId === boss.id), false, '不能躲避沉睡的达贡')
  assert.equal(validateMove(state, 0, { action: 'fight', enemyId: boss.id }), '沉睡的目标免疫调查员行动')
  assert.equal(validateMove(state, 0, { action: 'evade', enemyId: boss.id }), '沉睡的目标免疫调查员行动')
  const unengaged = enemy(state, { code: '07292a', health: 99, fight: 6, evade: 6, engagedSeat: null })
  unengaged.location = state.investigators[0].location
  assert.equal(legalMoves(state).some(move => move.action === 'engage' && move.enemyId === unengaged.id), false, '不能与沉睡的达贡交战')
  assert.equal(validateMove(state, 0, { action: 'engage', enemyId: unengaged.id }), '沉睡的目标免疫调查员行动')
  // 同一局面里的普通敌人照常可攻击/交战。
  const ghoul = enemy(state, { code: '01101', fight: 1, evade: 1, health: 30 })
  ghoul.engagedSeat = 0
  state.investigators[0].engaged.push(ghoul.id)
  assert.equal(legalMoves(state).some(move => move.action === 'fight' && move.enemyId === ghoul.id), true)
  assert.equal(validateMove(state, 0, { action: 'fight', enemyId: ghoul.id }), null)
})

test('章节钩子来源帧：冻结的 behavior 也能包装，钩子内来源是剧本而不是外层卡', () => {
  const state = fixture('01001')
  state.scenario = { ...(state.scenario || {}), id: 'theLairOfDagon' }
  const seen = []
  const behavior = Object.freeze({
    probe: state => seen.push(currentEffectSource(state)),
    label: 'theLairOfDagon',
  })
  const scoped = scopedScenarioBehavior(state, behavior)
  assert.equal(scoped.label, 'theLairOfDagon')
  assert.equal(scopedScenarioBehavior(state, behavior), scoped, '同一 state+behavior 复用包装')
  // 从玩家卡描述子内部调到剧本钩子：钩子自己的帧覆盖外层卡。
  executeDescriptor(state, {
    inv: state.investigators[0], source: null, events: [],
    descriptor: { code: '01016', label: '外层玩家卡', resolve: () => {
      assert.equal(currentEffectSource(state).kind, 'playerCard')
      scoped.probe(state)
      assert.equal(currentEffectSource(state).kind, 'playerCard', '钩子返回后恢复外层卡来源')
    } },
  })
  assert.deepEqual(seen.map(source => source.kind), ['scenarioRule'])
  assert.equal(seen[0].code, 'theLairOfDagon')
  assert.equal(currentEffectSource(state), null)
})

test('沉睡敌人：被移动进调查员地点也不会自动交战，也不会攻击调查员', () => {
  const state = chapterFixture('theLairOfDagon')
  const inv = state.investigators[0]
  const elsewhere = state.locations.find(location => location.id !== inv.location).id
  const boss = enemy(state, { code: '07292a', health: 99, fight: 6, evade: 6, engagedSeat: null })
  boss.location = elsewhere
  // 真正走 relocateEnemy → autoEngageAt 的路径：沉睡的达贡不自动交战。
  scenarioRuntime(state, []).moveEnemy(boss, inv.location)
  assert.equal(boss.location, inv.location)
  assert.equal(boss.engagedSeat, null, '沉睡的达贡不自动交战')
  inv.damage = 0
  inv.horror = 0
  assert.equal(scenarioRuntime(state, []).attack(boss, inv), false, '沉睡的达贡不能攻击')
  assert.deepEqual([inv.damage, inv.horror], [0, 0])
  // 清醒的对照：同样的移动会交战（攻击结算会开窗口，伤害由既有敌人攻击专项覆盖）。
  const ghoul = enemy(state, { code: '01101', health: 99, engagedSeat: null })
  ghoul.location = elsewhere
  scenarioRuntime(state, []).moveEnemy(ghoul, inv.location)
  assert.equal(ghoul.engagedSeat, 0, '普通敌人移动到位后自动交战')
})

test('沉睡敌人：玩家卡效果不能横置/位移/交战/躲避/击败，遭遇来源与敌人阶段照常', () => {
  const state = chapterFixture('theLairOfDagon')
  const boss = enemy(state, { code: '07292a', health: 99, fight: 6, evade: 6, engagedSeat: null })
  const elsewhere = state.locations.find(location => location.id !== boss.location).id
  const runtime = scenarioRuntime(state, [])
  const blocked = []
  executeDescriptor(state, {
    inv: state.investigators[0], source: null, events: [],
    descriptor: { code: '01016', label: '玩家卡对沉睡目标动手', resolve: ({ api }) => {
      blocked.push(api.exhaust(boss), api.moveEnemy(boss, elsewhere), api.engage(boss, 0),
        api.autoEvade(boss), api.scenario.evadeEnemy(boss),
        api.scenario.defeatEnemy(boss), api.scenario.exhaustEnemy(boss))
    } },
  })
  assert.deepEqual(blocked, [false, false, false, false, false, false, false])
  assert.equal(boss.exhausted === true, false, '没有被横置')
  assert.equal(boss.location, state.investigators[0].location, '没有被位移')
  assert.equal(boss.engagedSeat, null, '没有被交战')
  assert.equal(state.enemies.includes(boss), true, '没有被击败')
  // 遭遇/剧本来源（例如圣堂地点的印刷自动躲避/横置）照常执行。
  withEffectSource(state, { kind: 'encounterCard', code: '07324', sourceId: 'sanctum' }, () => {
    assert.equal(runtime.exhaustEnemy(boss), true)
    assert.equal(boss.exhausted, true)
    assert.equal(runtime.evadeEnemy(boss), true)
  })
  // 敌人阶段/剧本自动结算没有来源帧：重整必须照常（沉睡达贡印着「处于重整状态」的前提）。
  boss.exhausted = true
  assert.equal(runtime.readyEnemy(boss), true)
  assert.equal(boss.exhausted, false)
  // 对照：普通敌人被玩家卡横置/位移都成功。
  const ghoul = enemy(state, { code: '01101', health: 99, engagedSeat: null })
  executeDescriptor(state, {
    inv: state.investigators[0], source: null, events: [],
    descriptor: { code: '01016', label: '玩家卡对普通敌人动手', resolve: ({ api }) => {
      assert.equal(api.exhaust(ghoul), true)
      assert.ok(api.moveEnemy(ghoul, elsewhere), '普通敌人可以被效果移动')
    } },
  })
  assert.equal(ghoul.exhausted, true)
  assert.equal(ghoul.location, elsewhere)
})

test('sleeping rule 只在条目上声明为布尔值；声明错误在注册期直接拒绝', () => {
  assert.throws(() => registerCardAbilities([{ code: '99092', scope: 'enemy', enemyRule: { slumbering: 'yes' }, abilities: [] }]),
    /slumbering/)
})

test('provenance 不写 state：存档往返不出现来源字段', () => {
  const state = fixture('01001')
  const boss = enemy(state, { code: '07292a', health: 99 })
  withEffectSource(state, { kind: 'playerCard', code: '01016' }, () => state.investigators[0].clues += 0)
  void boss
  const restored = JSON.parse(JSON.stringify(state))
  assert.equal(JSON.stringify(restored).includes('effectSource'), false)
  assert.equal(currentEffectSource(restored), null)
})
