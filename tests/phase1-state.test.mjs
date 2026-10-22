// Phase 1 状态基础回归：A1（持续效果实体）、B1（目标枚举）、playCondition 单一读点、
// 以及 store schema v7 的迁移。
//
// 这三件事的共同点：它们都新增了「读点」，因此测试要同时覆盖
//   1. 读点本身（纯函数 / 校验 / 过期顺序）；
//   2. 引擎接线（legalMoves、validateMove、applyMove 真的走同一份数据）。
//
// 注意：applyMove 会克隆整个 state，断言必须从 state 重新读取，不能缓存旧引用。

import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, move, settle, use, legalMoves, validateMove } from './core-fixture.mjs'
import { getStat } from '../src/engine/engine.js'
import { stateHash } from '../src/engine/replay.js'
import { modifierTotal } from '../src/engine/modifiers.js'
import {
  EFFECT_DURATIONS, activeEffects, createEffect, describeEffects, expireEffects, removeEffectsFromSource,
} from '../src/engine/effect-state.js'
import { TARGET_KINDS, enumerateTargets, normalizeTarget } from '../src/engine/targets.js'
import { LEGACY_PLAY_CONDITION_FIELDS, describePlayCondition, playAccess, playConditionError } from '../src/engine/play-condition.js'
import { migrateState } from '../src/engine/save-migration.js'
import { STATE_SCHEMA_VERSION, RULES_VERSION } from '../src/engine/rules-state.js'

test('A1：效果实体校验时长、按统一过期点清理，并进入 state', () => {
  const s = fixture()
  assert.deepEqual(s.effects, [], '新对局必须带 state.effects 空数组')
  assert.ok(EFFECT_DURATIONS.includes('endOfPhase'))
  assert.throws(() => createEffect(s, { duration: 'forever' }), /未知 duration/)

  const phase = createEffect(s, {
    duration: 'endOfPhase', controllerSeat: 0, label: '本阶段战斗 +2',
    modifiers: [{ target: 'skill:combat', amount: 2 }],
  })
  createEffect(s, {
    duration: 'endOfRound', controllerSeat: 0, label: '本轮意志 +1',
    modifiers: [{ target: 'skill:willpower', amount: 1 }],
  })
  assert.equal(activeEffects(s).length, 2)
  // 修正读点：效果的 modifiers 与卡面修正走同一条管线。
  assert.ok(modifierTotal(s, s.investigators[0], 'skill:combat') >= 2)
  assert.ok(modifierTotal(s, s.investigators[0], 'skill:willpower') >= 1)

  // 时长链：endOfPhase 到期时清掉更短的（endOfTest/endOfTurn），保留 endOfRound。
  createEffect(s, { duration: 'endOfTest', controllerSeat: 0, modifiers: [{ target: 'skill:agility', amount: 1 }] })
  const removed = expireEffects(s, 'endOfPhase')
  assert.deepEqual(removed.map(effect => effect.duration).sort(), ['endOfPhase', 'endOfTest'])
  assert.deepEqual(s.effects.map(effect => effect.duration), ['endOfRound'])
  assert.equal(describeEffects(s)[0].label, '本轮意志 +1')
  expireEffects(s, 'endOfRound')
  assert.deepEqual(s.effects, [])
  void phase
})

test('A1：来源离场时绑定效果一起消失', () => {
  const s = fixture()
  const card = asset(s, '01518')
  createEffect(s, { duration: 'whilstAttached', sourceInstanceId: card.id, controllerSeat: 0,
    modifiers: [{ target: 'skill:combat', amount: 1 }] })
  assert.equal(s.effects.length, 1)
  removeEffectsFromSource(s, card.id)
  assert.equal(s.effects.length, 0)
})

test('A1 引擎接线：02185 的本阶段修正写进 state.effects，阶段结束自动过期', () => {
  const s = fixture()
  const card = asset(s, '02185')
  const before = getStat(s, s.investigators[0], 'intellect')
  move(s, { action: 'ability', assetId: card.id, abilityIndex: 0 })
  settle(s)
  assert.equal(s.effects.length, 1, '「本阶段 +1」必须是一条效果记录')
  assert.equal(s.effects[0].duration, 'endOfPhase')
  assert.equal(getStat(s, s.investigators[0], 'intellect'), before + 1)

  // 结束回合 → 敌人阶段开始（阶段切换）→ endOfPhase 效果到期。
  move(s, { action: 'endTurn' })
  settle(s)
  assert.deepEqual(s.effects, [], '阶段结束应清掉本阶段效果')
  assert.equal(getStat(s, s.investigators[0], 'intellect'), before)
})

test('A1 效果能力：state.effects 上的反应能力进入窗口枚举并可结算', () => {
  const s = fixture()
  const inv = s.investigators[0]
  const handBefore = inv.hand.length
  // 效果能力必须是纯数据（state.effects 随存档往返）；resolve 闭包在事务克隆里会丢。
  createEffect(s, {
    duration: 'endOfPhase', controllerSeat: 0, sourceCode: '02105', label: '本阶段：击败敌人后抽 1',
    abilities: [{
      kind: 'reaction', trigger: 'defeatEnemy', label: '抽 1 张牌', limit: 'oncePerPhase',
      effect: { type: 'draw', amount: 1 },
    }],
  })
  assert.throws(() => createEffect(s, {
    duration: 'endOfPhase', controllerSeat: 0,
    abilities: [{ kind: 'reaction', trigger: 'defeatEnemy', label: '闭包', resolve: () => {} }],
  }), /不能带 resolve/)
  s.chaosBag = ['0']
  inv.combat = 8
  const target = enemy(s, { health: 1, fight: 0 })
  move(s, { action: 'fight', enemyId: target.id })
  settle(s, pending => pending.options.find(option => option.id.startsWith('desc:'))?.id ?? null)
  assert.equal(s.enemies.some(item => item.id === target.id), false, '敌人应被击败')
  assert.equal(s.investigators[0].hand.length, handBefore + 1, '效果上的反应能力应已结算')
})

test('B1：目标枚举按 kind 给出候选，query 只能收窄', () => {
  const s = fixture('01001', 2)
  const here = enemy(s, { health: 5 })
  const inv = s.investigators[0]

  const enemies = enumerateTargets(s, inv, { kind: 'enemy' })
  assert.deepEqual(enemies.map(item => item.id), [here.id])
  assert.deepEqual(enumerateTargets(s, inv, { kind: 'enemy', query: () => false }), [])
  assert.deepEqual(
    enumerateTargets(s, inv, { kind: 'enemy', query: ({ candidate }) => candidate.entity.id === here.id }).map(item => item.id),
    [here.id],
  )

  const investigators = enumerateTargets(s, inv, { kind: 'investigator' })
  assert.deepEqual(investigators.map(item => item.id), ['0', '1'])

  const locations = enumerateTargets(s, inv, { kind: 'location' })
  assert.ok(locations.some(item => item.id === inv.location))

  inv.hand = ['01088', '01088', '02105']
  const hand = enumerateTargets(s, inv, { kind: 'cardInHand' })
  assert.deepEqual(hand.map(item => item.id).sort(), ['01088', '02105'])

  const held = asset(s, '01518')
  assert.ok(enumerateTargets(s, inv, { kind: 'asset' }).some(item => item.id === held.id))

  assert.throws(() => normalizeTarget({ kind: 'monster' }), /target.kind/)
  assert.throws(() => normalizeTarget({ kind: 'enemy', extra: 1 }), /未知字段/)
  assert.deepEqual([...TARGET_KINDS], ['enemy', 'investigator', 'location', 'asset', 'cardInHand'])
})

test('B1 引擎接线：01518 的目标进入合法动作、校验与 ctx.target', () => {
  const s = fixture()
  const cop = asset(s, '01518')
  // 没有敌人：带必需目标的能力不出现在合法动作里。
  assert.deepEqual(legalMoves(s).filter(command => command.assetId === cop.id), [])
  const first = enemy(s, { health: 5 })
  const second = enemy(s, { health: 5 })
  const offered = legalMoves(s).filter(command => command.assetId === cop.id)
  assert.deepEqual(offered.map(command => command.targetId).sort(), [first.id, second.id].sort())
  assert.ok(offered.every(command => command.label.includes('→')))

  assert.equal(validateMove(s, 0, { action: 'ability', assetId: cop.id, abilityIndex: 0 }),
    '该能力需要选择目标')
  assert.ok(validateMove(s, 0, { action: 'ability', assetId: cop.id, abilityIndex: 0, targetId: 'missing-enemy' }))

  use(s, cop, { targetId: first.id })
  assert.equal(s.enemies.find(item => item.id === first.id).damageTaken, 1)
  assert.equal(s.enemies.find(item => item.id === second.id).damageTaken, 0)
})

test('playCondition：描述子与旧字段都由单一读点判定，文案不变', () => {
  const s = fixture()
  const inv = s.investigators[0]
  assert.deepEqual([...LEGACY_PLAY_CONDITION_FIELDS], [
    'ownTurnOnly', 'duringOwnTurn', 'firstActionOnly', 'requiresClue', 'requiresClueAtLocation',
    'requiresNoEnemies', 'requiresRemainingSanity', 'requiresResign', 'playableFromDiscard', 'playableWeakness',
  ])

  // 描述子化卡牌（02186）：条件写在条目上，不再有 EFFECTS 顶层字段。
  s.locations[0].clues = 0
  inv.hand = ['02186']
  assert.equal(validateMove(s, 0, { action: 'play', cardId: '02186' }), '当前地点没有线索')
  s.locations[0].clues = 2
  move(s, { action: 'play', cardId: '02186' })
  settle(s)
  assert.equal(s.investigators[0].hand.length, 3, '抽取 3 张卡牌')

  // 旧 DSL 字段的读点（第 126 轮：`EFFECTS` 旧通道已清空并删除所有 `EFFECTS[` 读取）。
  // 读点仍保留 `LEGACY_PLAY_CONDITION_FIELDS` 这些字段名用于存档兼容，但不再有任何数据来源：
  // 传进来的旧卡号既没有条件错误、也不会被描述成 legacy 记录。
  const legacy = fixture()
  legacy.phase = 'mythos'
  assert.equal(playConditionError(legacy, legacy.investigators[0], '__legacyPlayConditionSample'), null)
  assert.deepEqual(describePlayCondition('__legacyPlayConditionSample'), [])
  // 区域许可与条件分开：03315 不是「弃牌堆可打出」的卡。
  assert.deepEqual(playAccess('03315'), {
    fromDiscard: false, playableWeakness: false, reactionOnly: false, limitPerInvestigator: false,
  })
})

test('schema v7：旧存档迁移补出 state.effects（含旧临时修正折算）', () => {
  const s = fixture()
  assert.equal(s.schemaVersion, STATE_SCHEMA_VERSION)
  assert.equal(RULES_VERSION, 'n6.0')

  const legacy = structuredClone(s)
  legacy.schemaVersion = 6
  legacy.rulesVersion = 'n5.5'
  delete legacy.effects
  legacy.investigators[0].phaseStatBonus = { skill: 'intellect', amount: 1 }

  const { state: migrated, changes } = migrateState(legacy)
  assert.equal(migrated.schemaVersion, STATE_SCHEMA_VERSION)
  assert.ok(Array.isArray(migrated.effects), '迁移后必须补出 effects 数组')
  assert.ok(migrated.effects.some(effect => effect.duration === 'endOfPhase'
    && effect.modifiers.some(modifier => modifier.target === 'skill:intellect')))
  assert.ok(changes.some(change => change.includes('n5.5')), '迁移说明应记录版本变化')
  assert.equal(migrated.investigators[0].phaseStatBonus, null, '旧字段应被折算并清空')
})

test('A1：state.effects 参与存档与 stateHash（重放可见）', () => {
  const s = fixture()
  const before = stateHash(s)
  createEffect(s, { duration: 'endOfPhase', controllerSeat: 0, modifiers: [{ target: 'skill:combat', amount: 1 }] })
  const after = stateHash(s)
  assert.notEqual(before, after, '效果记录必须进入稳定指纹，否则重放无法覆盖临时修正')
  const roundTrip = JSON.parse(JSON.stringify(s))
  assert.equal(stateHash(roundTrip), after, 'state.effects 必须能 JSON 往返')
  // 新对局的空效果数组与迁移后的形状一致（不是 undefined）。
  const fresh = fixture()
  assert.ok(Array.isArray(fresh.effects))
  assert.deepEqual(fresh.effects, [])
})
