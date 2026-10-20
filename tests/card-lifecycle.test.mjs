// 生命周期通道试点（重构路线 §10 第 3 项 / Phase 1 前置）：
// played（事件打出）与 commit（投入技能检定）两个新 kind，各 3 张卡从 EFFECTS 迁过来。
//
// 这个文件同时是"测试骨架"：后面的卡按同样的三段写——
//   1. 通道断言：数据已离开 EFFECTS、读点能取到它；
//   2. 注册校验：缺 payload 的描述子在加载时就失败；
//   3. 行为断言：真实引擎跑一遍，结果与卡面一致（这才是迁移完成的证据）。
//
// 注意：applyMove 会克隆嵌套对象，断言必须从 state 重新读取，不能缓存 inv 引用。
// settle 里投入选项的 id 是手牌下标（手牌只有这一张时就是 '0'）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, settle } from './core-fixture.mjs'
import { decisionSeat, performTest } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { EFFECTS } from '../src/cards/card-effects.js'
import { ABILITY_KINDS, normalizeDescriptor } from '../src/engine/ability.js'
import { commitProfile, entersPlayEffect, leavesPlayEffect, lifecycleChannel, playedEffect, weaknessProfile } from '../src/engine/lifecycle.js'
import { isPlayable } from '../src/deck/deckbuilding.js'
import { getAvailability } from '../src/deck/availability.js'

// Phase 1 门禁：先迁 10 张 event/skill 卡（6 张 played + 4 张 commit），
// 以及三个新生命周期钩子的试点卡（weakness / entersPlay / leavesPlay）。
const PLAYED = ['01088', '02008', '02194', '02105', '02186', '02273']
const COMMIT = ['02150', '02268', '02299', '02271']
const WEAKNESS = ['01096', '01097']
// 签名卡（02008）不进构筑池，但仍是玩家卡；只对它断言"可用"。
const BUILDABLE = ['01088', '02150', '02194', '02268', '02299', '02105', '02186', '02273', '02271']

// 复用同一段执行函数把待决选择走完（与 dunwich-player-gaps 的 runTest 同构）：
// 某些检定（如只有意志图标的技能卡）必须由 performTest 直接发起，不能用行动触发。
function runTest(state, execute, choose = () => null) {
  resolveTransaction(state, decisionSeat(state) ?? 0, { action: 'lifecycleProbe' }, execute)
  for (let index = 0; state.pendingChoice && index < 80; index++) {
    const pending = state.pendingChoice
    const chosen = choose(pending)
      ?? ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: chosen }, execute)
  }
}

test('五个生命周期 kind 已进入枚举，且缺 payload 的描述子注册即失败', () => {
  const lifecycleKinds = [...ABILITY_KINDS].filter(kind =>
    ['played', 'commit', 'weakness', 'entersPlay', 'leavesPlay'].includes(kind))
  assert.deepEqual(lifecycleKinds, ['played', 'commit', 'weakness', 'entersPlay', 'leavesPlay'])
  assert.throws(() => normalizeDescriptor({ kind: 'played' }, { code: '99001', index: 0 }),
    /played 必须提供 effect/)
  assert.throws(() => normalizeDescriptor({ kind: 'commit' }, { code: '99002', index: 0 }),
    /commit 必须提供 skill/)
  assert.throws(() => normalizeDescriptor({ kind: 'weakness' }, { code: '99005', index: 0 }),
    /weakness 必须提供 weakness/)
  assert.throws(() => normalizeDescriptor({ kind: 'entersPlay' }, { code: '99006', index: 0 }),
    /entersPlay 必须提供 entersPlay/)
  assert.throws(() => normalizeDescriptor({ kind: 'leavesPlay' }, { code: '99007', index: 0 }),
    /leavesPlay 必须提供 leavesPlay/)
  assert.throws(() => normalizeDescriptor({ kind: 'played', effect: { type: 'draw' }, trigger: 'clueDiscovered' },
    { code: '99003', index: 0 }), /不声明 trigger/)
  assert.throws(() => normalizeDescriptor({ kind: 'weakness', weakness: { type: 'threat' }, trigger: 'treachery' },
    { code: '99008', index: 0 }), /不声明 trigger/)
  const ok = normalizeDescriptor({ kind: 'commit', skill: { onSuccess: { clueBonus: 1 } } }, { code: '99004', index: 0 })
  assert.deepEqual(ok.skill, { onSuccess: { clueBonus: 1 } })
  assert.equal(ok.trigger.length, 0)
})

test('十张 event/skill 卡的行为数据已离开旧 DSL，走能力层读点', () => {
  assert.equal(PLAYED.length + COMMIT.length, 10, 'Phase 1 门禁：至少 10 张 event/skill 卡完成迁移')
  for (const code of PLAYED) {
    assert.equal(EFFECTS[code], undefined, `${code} 仍有 EFFECTS 条目`)
    assert.equal(lifecycleChannel(code).played, 'descriptor', `${code} 未走 played 描述子`)
    assert.ok(playedEffect(code), `${code} 的 played 数据为空`)
  }
  for (const code of COMMIT) {
    assert.equal(EFFECTS[code], undefined, `${code} 仍有 EFFECTS 条目`)
    assert.equal(lifecycleChannel(code).commit, 'descriptor', `${code} 未走 commit 描述子`)
    assert.ok(commitProfile(code), `${code} 的 commit 数据为空`)
  }
  // 数据必须原样保留：迁移只改通道，不改行为。
  assert.deepEqual(playedEffect('01088'), { type: 'gainResource', amount: 3 })
  assert.deepEqual(playedEffect('02008'), { type: 'drawPerClue', maximum: 5 })
  assert.deepEqual(playedEffect('02194'), {
    type: 'sequence', effects: [{ type: 'gainResource', amount: 3 }, { type: 'draw', amount: 1 }],
  })
  assert.deepEqual(playedEffect('02105'), { type: 'healDamageAtLocation', amount: 2 })
  assert.deepEqual(playedEffect('02186'), { type: 'draw', amount: 3 })
  assert.deepEqual(playedEffect('02273'), {
    type: 'sequence', effects: [{ type: 'heal', amount: 3, what: 'horror' }, { type: 'draw', amount: 1 }],
  })
  assert.deepEqual(commitProfile('02150'), { onSuccess: { clueBonus: 1 }, successBy: { threshold: 2, clueBonus: 1 } })
  assert.deepEqual(commitProfile('02271'), { selfTestOnly: true })
})

test('三个新生命周期钩子：数据已离开旧 DSL，读点可用', () => {
  for (const code of WEAKNESS) {
    assert.equal(EFFECTS[code], undefined, `${code} 仍有 EFFECTS 条目`)
    assert.equal(lifecycleChannel(code).weakness, 'descriptor', `${code} 未走 weakness 描述子`)
    assert.ok(weaknessProfile(code), `${code} 的弱点数据为空`)
  }
  assert.deepEqual(weaknessProfile('01096'), { type: 'discardHandTo', keep: 1 })
  assert.deepEqual(weaknessProfile('01097'), { type: 'loseResource', all: true })

  // 04021：原 EFFECTS.onEnter 已搬进 entersPlay 描述子。
  // 5c-19 起描述子只带 resolve（牌库顶检索 + 附属的整套结算），读点仍是 lifecycle 的
  // entersPlay——`entersPlayEffect` 对 resolve 型返回 null，引擎在 doPlay 的入场段
  // 优先用 resolve、否则回落数据体（与弱点 resolve 同形）。
  assert.equal(EFFECTS['04021'], undefined)
  assert.equal(lifecycleChannel('04021').entersPlay, 'descriptor')
  assert.equal(entersPlayEffect('04021'), null)
  const horowitz = normalizeDescriptor({ kind: 'entersPlay', resolve: () => {} }, { code: '99009', index: 0 })
  assert.equal(typeof horowitz.resolve, 'function')

  // 03315：原引擎内联的 millOnLeave 特判改成 leavesPlay 数据（旧条目只剩被动修正）。
  // Phase 5（5b-9）：03315 的旧条目已整体迁走（条目在能力层）。
  assert.equal(EFFECTS['03315'], undefined)
  assert.equal(lifecycleChannel('03315').leavesPlay, 'descriptor')
  assert.deepEqual(leavesPlayEffect('03315'), { type: 'mill', amount: 10 })
})

test('行为实现与构筑许可不再依赖 EFFECTS 条目', () => {
  for (const code of [...PLAYED, ...COMMIT]) {
    assert.equal(isPlayable(ALL_CARDS[code]), true, `${code} 被判为不可用`)
  }
  for (const code of BUILDABLE) {
    assert.equal(getAvailability(code).deckbuilding, true, `${code} 不在可构筑列表`)
  }
})

test('played：01088 获得 3 资源', () => {
  const s = fixture()
  const before = s.investigators[0].resources
  s.investigators[0].hand = ['01088']
  move(s, { action: 'play', cardId: '01088' })
  settle(s)
  const after = s.investigators[0]
  assert.equal(after.resources, before - Number(ALL_CARDS['01088'].cost || 0) + 3)
  assert.deepEqual(after.hand, [])
})

test('played：02194 获得 3 资源并抽 1 张牌', () => {
  const s = fixture()
  const before = s.investigators[0].resources
  s.investigators[0].hand = ['02194']
  move(s, { action: 'play', cardId: '02194' })
  settle(s)
  const after = s.investigators[0]
  assert.equal(after.resources, before - Number(ALL_CARDS['02194'].cost || 0) + 3)
  assert.equal(after.hand.length, 1, '打出后应只剩抽到的那张')
})

test('played：02008 按线索数抽牌', () => {
  const s = fixture()
  s.investigators[0].clues = 3
  s.investigators[0].hand = ['02008']
  move(s, { action: 'play', cardId: '02008' })
  settle(s)
  assert.equal(s.investigators[0].hand.length, 3, '3 个线索应抽 3 张（打出的那张已离开手牌）')
})

test('commit：02150 成功额外发现线索（成功 2 点以上再 1 个）', () => {
  const s = fixture()
  s.investigators[0].intellect = 8
  s.locations[0].shroud = 1
  s.locations[0].clues = 3
  s.investigators[0].hand = ['02150']
  s.chaosBag = ['0']
  move(s, { action: 'investigate' })
  settle(s, pending => {
    const option = pending.kind === 'commit' ? pending.options.find(item => item.id === '0') : null
    return option ? option.id : null
  })
  // 1 个基础线索 + onSuccess 1 + successBy(≥2) 1
  assert.equal(s.investigators[0].clues, 3)
})

test('commit：02299 成功 +1 伤害，成功 2 点以上再 +1', () => {
  const s = fixture()
  s.investigators[0].combat = 8
  s.investigators[0].hand = ['02299']
  s.chaosBag = ['0']
  s.enemies = [{
    id: 'probe-target', code: 'ghoulMinion', name: '测试敌人', location: s.investigators[0].location,
    fight: 1, evade: 1, health: 20, damageTaken: 0, damage: 0, horror: 0, engagedSeat: 0,
  }]
  s.investigators[0].engaged = ['probe-target']
  move(s, { action: 'fight', enemyId: 'probe-target' })
  settle(s, pending => {
    const option = pending.kind === 'commit' ? pending.options.find(item => item.id === '0') : null
    return option ? option.id : null
  })
  // 空手基础伤害 1 + onSuccess 1 + successBy(≥2) 1
  assert.equal(s.enemies[0].damageTaken, 3)
})

test('commit：02268 成功治疗 1 点恐惧，成功 2 点以上再 1 点', () => {
  const s = fixture()
  s.investigators[0].willpower = 8
  s.investigators[0].horror = 3
  s.investigators[0].hand = ['02268']
  s.chaosBag = ['0']
  // 02268 只有意志图标，所以要开一次意志检定（用 performTest 直接驱动，与 investigate 等价）。
  runTest(s, state => performTest(state, 0, 'willpower', 1, { resolve: result => { state.result = result } }),
    pending => (pending.kind === 'commit' ? pending.options.find(option => option.id === '0')?.id : null))
  assert.equal(s.investigators[0].horror, 1)
})

// ---------------------------------------------------------------------------
// Phase 1：weakness / entersPlay / leavesPlay 三个新钩子的行为证据
// ---------------------------------------------------------------------------

test('weakness：01097 妄想症显现时弃掉全部资源', () => {
  const s = fixture()
  s.investigators[0].resources = 7
  s.investigators[0].deck = ['01097']
  move(s, { action: 'draw' })
  settle(s)
  assert.equal(s.investigators[0].resources, 0)
})

test('weakness：01096 失忆显现时弃手牌只剩 1 张', () => {
  const s = fixture()
  s.investigators[0].hand = ['01088', '01088', '01088', '01088']
  s.investigators[0].deck = ['01096']
  move(s, { action: 'draw' })
  settle(s)
  assert.equal(s.investigators[0].hand.length, 1)
})

test('leavesPlay：03315 离场时弃掉牌库顶 10 张（替换槽位触发离场）', () => {
  const s = fixture()
  s.investigators[0].hand = ['03315', '01075']
  move(s, { action: 'play', cardId: '03315' })
  settle(s)
  const keyId = s.investigators[0].assets.find(item => item.code === '03315').id
  move(s, { action: 'play', cardId: '01075' })
  settle(s, pending => (pending.kind === 'assetReplacement' && pending.options.some(option => option.id === keyId)
    ? keyId : null))
  const discard = s.investigators[0].discard
  assert.ok(discard.includes('03315'), '被替换的支援进入弃牌堆')
  assert.equal(discard.filter(code => code === '01088').length, 10, '离场钩子弃掉牌库顶 10 张')
})
