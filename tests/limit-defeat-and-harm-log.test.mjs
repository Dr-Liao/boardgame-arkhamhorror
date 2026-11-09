import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyHarm, getMaxHealth, getMaxSanity, leaveAsset, scenarioRuntime,
} from '../src/engine/engine.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { viewState } from '../src/integration/observation.js'
import { timelineEntries } from '../web/table-timeline.js'
import { encounterRules } from '../content/campaigns/theForgottenAge/encounter-rules.js'
import { asset, fixture } from './core-fixture.mjs'

// 2026-11-09 实机问题：「卢克·罗宾逊」在神话阶段抽到 04085 伊格的诅咒（-1 生命）时，
// 伤害 4 已经等于新上限 4，但引擎没有立即判负；拖到自己的行动里才在时间线显示
// 「盟友吃了 1 点恐惧 → 卢克被击败」。同时落入陷阱的 3 点自身伤害在日志里完全不可见。
//
// 本文件锁定两件事：
//   1. 生命/神智上限变化（威胁区入场、支援离场）后立即 checkDefeated；
//   2. 非攻击来源的自身伤害/恐惧在时间线里有数字（纯展示 cue，不进重放状态）；
//      以及威胁区行动检定的日志来源名。
const me = state => state.investigators[0]

test('威胁区卡改变生命上限（04085 伊格的诅咒）时立即判定被击败', () => {
  // 双人局：调查员被击败会进入退场流程，但不会直接结束剧本（单人会触发本关结局）。
  const state = fixture('01001', 2)
  const inv = me(state)
  inv.damage = getMaxHealth(inv) - 1
  assert.equal(inv.defeated, false)

  const events = []
  const handled = encounterRules.resolveEncounter(state, inv, { code: '04085', originalCode: '04085' },
    scenarioRuntime(state, events))

  assert.equal(handled, true)
  const after = me(state)
  assert.equal(getMaxHealth(after), after.damage, '-1 生命后伤害必须已经等于有效上限')
  assert.equal(after.defeated, true, '上限变化后必须当次立即被击败，而不是等下一次行动')
  assert.equal(after.defeatCause, 'damage')
  assert.ok(state.log.some(line => line.includes('被击败')), '日志里必须有被击败记录')
})

test('威胁区卡改变神智上限（01182 拉莱耶之梦）时立即判定被击败', () => {
  const state = fixture('01001', 2)
  const inv = me(state)
  inv.horror = getMaxSanity(inv) - 1
  assert.equal(inv.defeated, false)

  // 威胁区效果通道：sanityModifier -1（getMaxSanity 的直接读点）。
  scenarioRuntime(state, []).threat(0, '01182', { threatEffect: { sanityModifier: -1 } })

  const after = me(state)
  assert.equal(getMaxSanity(after), after.horror)
  assert.equal(after.defeated, true, '神智上限下降后恐惧已等于上限，必须当场被击败')
  assert.equal(after.defeatCause, 'horror')
})

test('支援离场导致生命上限下降时立即判定被击败', () => {
  const state = fixture('01001', 2)
  const inv = me(state)
  const baseHealth = getMaxHealth(inv)
  // 05039 星币五：生命上限 +1 / 神智上限 +1（passive healthBonus/sanityBonus）。
  const card = asset(state, '05039')
  assert.equal(getMaxHealth(inv), baseHealth + 1)
  inv.damage = baseHealth
  assert.equal(inv.defeated, false, '带 +1 生命上限的支援在场时还活着')

  leaveAsset(state, inv, card, [])
  const after = me(state)
  assert.equal(getMaxHealth(after), baseHealth)
  assert.equal(after.defeated, true, '支援离场让上限降回伤害值，必须当场被击败')
  assert.equal(after.defeatCause, 'damage')
})

test('非攻击来源的自身伤害/恐惧发出时间线 cue，并渲染成带数字的日志行', () => {
  const state = fixture('01001')
  const inv = me(state)
  const events = []
  applyHarm(state, inv, 2, 1, events)

  const cue = events.map(event => event.presentation || event).find(event => event.kind === 'harm')
  assert.ok(cue, 'applyHarm 必须为非攻击自身伤害/恐惧发 kind:harm 的展示 cue')
  assert.equal(cue.seat, 0)
  assert.equal(cue.name, inv.name)
  assert.equal(cue.damage, 2)
  assert.equal(cue.horror, 1)
  // 纯展示 cue 不写 state.log（不改重放指纹）：时间线从 session.events 渲染。
  assert.ok(!state.log.some(line => line.includes('受到 2 点伤害')))
  assert.equal(inv.damage, 2)
  assert.equal(inv.horror, 1)

  const entries = timelineEntries({ events: [{ ...cue, seq: 0 }], state })
  assert.equal(entries.length, 1)
  assert.ok(entries[0].text.includes(inv.name), '日志行必须带调查员名')
  assert.ok(entries[0].text.includes('受到 2 点伤害'), '日志行必须带伤害数字')
  assert.ok(entries[0].text.includes('1 点恐惧'), '日志行必须带恐惧数字')
})

test('攻击演出里的伤害不会重复产生 harm cue（攻击已有 attack / enemyHarm 演出）', () => {
  const state = fixture('01001', 2)
  const inv = me(state)
  const events = []
  // 剧本「无敌人实体攻击」走 presentAttack：第 10 参 presentationOrigin 会标记为攻击伤害。
  applyHarm(state, inv, 1, 0, events, false, null, false, null,
    { code: 'ghoulMinion', name: '食尸鬼', seat: inv.seat, location: inv.location })
  assert.equal(events.some(event => (event.presentation || event).kind === 'harm'), false)
})

test('威胁区行动检定的来源名由服务端按卡号解析（时间线显示在摆脱哪张卡）', () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.threat.push({ id: 't-curse', code: '04085', originalCode: '04085' })
  const calls = []
  const api = {
    info: () => {},
    test: (seat, skill, difficulty, resolve, skillBonus, source) => {
      calls.push({ seat, skill, difficulty, source })
    },
  }
  const handled = encounterRules.performEncounterAction(state, inv,
    { action: 'encounterAction', rule: 'endCurseOfYig', threatId: 't-curse' }, api)

  assert.equal(handled, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].skill, 'willpower')
  assert.equal(calls[0].difficulty, 2, '没有复仇点数时难度是印刷的 2')
  const curse = ALL_CARDS['04085']
  assert.equal(calls[0].source?.name, curse.nameZh || curse.name)
  assert.equal(calls[0].source?.code, '04085')
  // 时间线用 source.name 渲染检定行。
  const entries = timelineEntries({ events: [{
    seq: 0, type: 'presentation', kind: 'test', name: '卢克·罗宾逊',
    source: calls[0].source, success: false, value: 2, difficulty: 3,
  }], state })
  assert.ok(entries[0].text.includes(curse.nameZh || curse.name), '时间线要显示检定来源卡名')
})

test('观察数据的 maxHealth 是有效上限（生命条不会把 -1 生命藏起来）', () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.threat.push({ id: 't-curse', code: '04085', originalCode: '04085',
    threatEffect: { statModifiers: { combat: -1 }, healthModifier: -1 } })
  assert.equal(getMaxHealth(inv), inv.maxHealth - 1)

  const view = viewState(structuredClone(state), 0)
  assert.equal(view.investigators[0].maxHealth, getMaxHealth(inv), '下发的 maxHealth 必须是有效上限')
  assert.equal(view.investigators[0].maxHealth, inv.maxHealth - 1)
})
