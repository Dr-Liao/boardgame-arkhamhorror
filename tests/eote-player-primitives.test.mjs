// P6 地球边缘玩家卡原语（群 E）的 Node 验收。
//
// 覆盖：next-test bonus、威胁区伤害汇点、沉静伤害侧、actionTaken 窗口、
// lookAt 排列 >4、跨座位手牌代打、放逐手牌、咒印标记、查看未揭示地点面、
// 下一次攻击 +1 伤害（testInitiated）、额外揭示取反、基础行动技能替代。
// 说明：新条目字段一律走 `flags.*`（注册表白名单通用透传），因此测试里用
// registerCardAbilities 注册合成条目来验证引擎读点，不依赖任何真实卡号行为。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, asset } from './core-fixture.mjs'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { resolveTransaction, choiceError } from '../src/engine/resolution.js'
import {
  applyHarm, executeAction, executeDescriptor, getStat, legalMoves, performTest,
} from '../src/engine/engine.js'

const clone = value => JSON.parse(JSON.stringify(value))

function transact (state, run, select = () => null) {
  // 同一 execute 闭包必须贯穿整段事务（choice 恢复凭据按函数身份校验）。
  const execute = draft => run(draft)
  resolveTransaction(state, 0, { action: 'eotePlayerPrimitivesTest' }, execute)
  for (let index = 0; state.pendingChoice; index += 1) {
    assert.ok(index < 120, `选择循环 ${JSON.stringify(state.pendingChoice)}`)
    const choice = state.pendingChoice
    const id = select(choice, state)
      ?? ['trigger', 'done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId))
      ?? choice.options[0]?.id
    assert.ok(id != null, JSON.stringify(choice))
    const command = { action: 'choose', choiceId: choice.id, optionId: id }
    assert.equal(choiceError(state, choice.seat, command), null)
    resolveTransaction(state, choice.seat, command, execute)
  }
}

function game (count = 1) {
  const state = fixture('01001', count)
  state.abilityLimits = {}
  for (const inv of state.investigators) {
    inv.hand = []; inv.assets = []; inv.threat = []; inv.engaged = []
    inv.damage = 0; inv.horror = 0; inv.resources = 30; inv.actionsLeft = 10
  }
  return state
}

// 用合成描述子拿到 api 实例：resolve 里把结果写回闭包变量。
function withApi (state, run, { seat = 0, select = () => null, source = null } = {}) {
  let result
  transact(state, draft => {
    const inv = draft.investigators[seat]
    executeDescriptor(draft, {
      inv, source: source || { code: 'primitives-test' },
      descriptor: { code: 'primitives-test', label: '原语测试', kind: 'played', resolve: params => { result = run(params) } },
      context: {}, events: [], windowId: null, ignoreCosts: true,
    })
  }, select)
  return result
}

// 合成条目：flags 透传字段 + 可选能力。用于验证引擎读点，不写任何卡号分支。
let syntheticSeq = 0
function entryOf (patch = {}) {
  const code = `eote-test-${++syntheticSeq}`
  const entry = { code, abilities: [], modifiers: [], ...patch }
  if (!registeredEntry(code)) registerCardAbilities(entry)
  return entry
}

test('P6 原语 addNextTestBonus：写 inv.testBonus，下一次技能检定消费并清零', () => {
  const state = game()
  const total = withApi(state, ({ api }) => api.playerTools.addNextTestBonus(0, 3))
  assert.equal(total, 3)
  const inv = state.investigators[0]
  assert.equal(inv.testBonus, 3)
  assert.equal(inv.testBonus, clone(state).investigators[0].testBonus, '纯 JSON 随存档往返')
  const base = getStat(state, inv, 'willpower')
  let result
  transact(state, draft => { result = performTest(draft, 0, 'willpower', 0, {}) })
  assert.equal(result.success, true)
  assert.equal(result.value, base + 3, '下一次检定 +3 生效')
  assert.equal(state.investigators[0].testBonus, 0, '消费后清零')
})

test('P6 原语 threatDamageSink：威胁区弱点承接伤害治疗，归零时弃卡', () => {
  const entry = entryOf({ flags: { threatDamageSink: true } })
  const state = game()
  const inv = state.investigators[0]
  inv.threat.push({ id: 'sink-1', code: entry.code, counters: 1 })
  inv.damage = 0
  const healed = withApi(state, ({ api }) => api.healDamage(0, 1))
  assert.equal(healed, 1)
  const fresh = state.investigators[0]
  assert.equal(fresh.threat.length, 0, '治疗归零后威胁卡离场')
  assert.equal(fresh.damage, 0)
  // 没有汇点时退回普通伤害治疗。
  const plain = game()
  plain.investigators[0].damage = 2
  const healedPlain = withApi(plain, ({ api }) => api.healDamage(0, 1))
  assert.equal(healedPlain, 1)
  assert.equal(plain.investigators[0].damage, 1)
})

test('P6 原语 composureDamage：非直接伤害必须先分配给声明 flags.composureDamage 的支援', () => {
  // 未注册的真实支援卡号（有生命可承接伤害）保证 cardDef 生命/神智可承接伤害；
  // flags 由原语读取（worker 条目同口径）。
  const code = '10061'
  if (!registeredEntry(code)) {
    registerCardAbilities([{ code, flags: { composureDamage: true }, composure: true, fast: true, abilities: [], modifiers: [] }])
  }
  const state = game()
  const moxie = asset(state, code)
  let seen = null
  let picked = null
  transact(state, draft => {
    const owner = draft.investigators[0]
    applyHarm(draft, owner, 1, 0, [])
  }, choice => {
    seen = choice
    const option = choice.options.find(item => item.id === moxie.id)
    if (option) picked = moxie.id
    return option ? moxie.id : null
  })
  assert.ok(seen, '出现伤害分配选择')
  assert.equal(seen.options.some(option => option.id === 'self'), false, '沉静伤害侧不提供「由调查员承受」')
  assert.equal(picked, moxie.id)
  const fresh = state.investigators[0]
  assert.equal(fresh.assets.find(item => item.code === code).damage, 1)
  assert.equal(fresh.damage, 0)
})

test('P6 原语 actionTaken：行动完成后开窗，context.actionKinds 带行动类型', () => {
  const entry = entryOf({
    abilities: [{
      kind: 'forced', trigger: 'actionTaken', label: '行动后记录',
      resolve: ({ state, context }) => {
        state.testedActionKinds = [...(state.testedActionKinds || []), ...(context.actionKinds || [])]
      },
    }],
  })
  const state = game()
  asset(state, entry.code)
  const inv = state.investigators[0]
  state.pendingChoice = null
  const move = legalMoves(state).find(item => item.action === 'move')
    || legalMoves(state).find(item => !['choose', 'endTurn'].includes(item.action))
  assert.ok(move, `存在可执行的行动：${JSON.stringify(legalMoves(state).map(item => item.action).slice(0, 12))}`)
  transact(state, draft => executeAction(draft, inv.seat, move, []), {})
  assert.ok((state.testedActionKinds || []).length > 0, `actionKinds=${JSON.stringify(state.testedActionKinds)}`)
})

test('P6 原语 lookAt 排列 >4：6 张按逐张选择放回，顺序保留且不丢牌', () => {
  const state = game()
  const inv = state.investigators[0]
  inv.deck = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8']
  const before = [...inv.deck]
  withApi(state, ({ api }) => api.lookAt(0, {
    zone: 'deck', count: 6, arrange: true, returnStrategy: 'top', source: 'test',
  }), { select: choice => choice.options[0]?.id ?? null })
  assert.deepEqual(inv.deck, before, '按原顺序放回：牌库顺序不变')
})

test('P6 原语 giveHandCard/playCardForSeat：跨座位移手牌并按自己手牌代打', () => {
  const itemCode = '01030' // 已有的 Item 支援（非本轮新卡）

  // 1) 手牌转移：同地点才允许，归属记录为纯 JSON。
  const moved = game(2)
  moved.investigators[0].hand = [itemCode]
  const given = withApi(moved, ({ api }) => api.playerTools.giveHandCard(0, 1, itemCode))
  assert.equal(given, true)
  assert.equal(moved.investigators[0].hand.includes(itemCode), false)
  assert.equal(moved.investigators[1].hand.includes(itemCode), true)
  assert.deepEqual(moved.handCardTransfers.map(item => item.code), [itemCode], '纯 JSON 归属记录随存档往返')
  assert.deepEqual(clone(moved).handCardTransfers, moved.handCardTransfers)

  // 2) 如同自己手牌代打：卡仍留在牌主手中，由代打座位走完整打出管线。
  const playedState = game(2)
  playedState.investigators[0].hand = [itemCode]
  const played = withApi(playedState, ({ api }) => api.playerTools.playCardForSeat(1, 0, itemCode))
  assert.equal(played, true, '代打成功')
  assert.equal(playedState.investigators[1].assets.some(item => item.code === itemCode), true, '置于代打者控制下')
  assert.equal(playedState.investigators[1].hand.includes(itemCode), false)
})

test('P6 原语 exileHandCard：校验手牌与等级后走唯一放逐账本', () => {
  const state = game()
  state.investigators[0].hand = ['01088']
  const exiled = withApi(state, ({ api }) => api.playerTools.exileHandCard(0, '01088'))
  assert.equal(exiled, true)
  assert.equal(state.investigators[0].hand.includes('01088'), false)
  assert.ok(state.exiled.includes('01088'))
  assert.deepEqual(state.exiledBySeat, [{ seat: 0, code: '01088' }])
  assert.equal(withApi(state, ({ api }) => api.playerTools.exileHandCard(0, '01088')), false, '不在手牌时失败')
  assert.throws(() => withApi(state, ({ api }) => api.playerTools.exileHandCard(0, '')), /放逐需要/)
})

test('P6 原语咒印：符号标记记在支援上；tokenReveal 窗口可改为揭示咒印', () => {
  const state = game()
  asset(state, '01030')
  const token = withApi(state, ({ api }) => api.playerTools.setSigilToken(0, 'cultist', { assetCode: '01030' }))
  assert.equal(token, 'cultist')
  assert.equal(state.investigators[0].assets.find(item => item.code === '01030').sigilToken, 'cultist', '随支援实例保存（离场即消失）')
  assert.throws(() => withApi(state, ({ api }) => api.playerTools.setSigilToken(0, 'eldersign', { assetCode: '01030' })), /咒印/)
  state.chaosBag = ['cultist', '0', 'skull']
  state.skillTest = { seat: 0, skill: 'willpower', difficulty: 2, committed: [] }
  const replaced = withApi(state, ({ api }) => {
    const context = { when: 'tokenReveal', seat: 0, token: 'skull' }
    const result = api.playerTools.replaceRevealedToken(context, 'cultist')
    return { result, context }
  })
  assert.equal(replaced.result, 'cultist')
  assert.equal(replaced.context.replacementToken, 'cultist')
  const missing = withApi(state, ({ api }) => api.playerTools.replaceRevealedToken({ when: 'tokenReveal' }, 'tablet'))
  assert.equal(missing, false, '袋中没有该标记时失败')
})

test('P6 原语 lookAtLocation：只读返回相连未揭示地点的揭示面，不改变状态', () => {
  const state = game()
  const inv = state.investigators[0]
  const here = state.locations[0]
  const hidden = {
    id: 'hidden-loc', code: 'back-code', originalCode: 'real-code',
    name: '公开背面', unrevealedActualName: '揭示面名称', nameEn: 'Revealed Name',
    shroud: 2, clues: 0, maxClues: 3, revealed: false, connections: [here.id],
  }
  here.connections = [hidden.id]
  state.locations.push(hidden)
  const face = withApi(state, ({ api }) => api.playerTools.lookAtLocation(inv.seat, hidden.id))
  assert.equal(face.name, '揭示面名称')
  assert.equal(face.code, 'real-code')
  assert.equal(face.clues, 3)
  assert.equal(hidden.revealed, false, '查看不改变揭示状态')
  assert.equal(JSON.stringify(hidden).includes('revealed:true'), false)
  const notConnected = withApi(state, ({ api }) => api.playerTools.lookAtLocation(inv.seat, 'not-connected'))
  assert.equal(notConnected, null)
})

test('P6 原语 attackDamageBonus 读点：testInitiated 窗口写入本次攻击伤害（08086）', () => {
  const state = game()
  state.skillTest = { seat: 0, skill: 'combat', difficulty: 0, committed: [] }
  const total = withApi(state, ({ api }) => api.playerTools.addAttackDamageBonus(1))
  assert.equal(total, 1)
  assert.equal(state.skillTest.attackDamageBonus, 1, 'combat.js 的成功伤害公式读同一字段')
  assert.throws(() => withApi(state, ({ api }) => api.playerTools.addAttackDamageBonus(0)), /正整数/)
  // 不在检定中（例如攻击窗口外）不出错，但返回 false。
  const idle = game()
  assert.equal(withApi(idle, ({ api }) => api.playerTools.addAttackDamageBonus(1)), false)
})

test('P6 原语 revealAdditionalTestToken：登记额外揭示并把负修正取反（08112）', () => {
  const state = game()
  state.skillTest = { seat: 0, skill: 'willpower', difficulty: 0, committed: [] }
  const armed = withApi(state, ({ api }) => api.playerTools.revealAdditionalTestToken({ flipSign: true, autoFailOn: ['skull'] }))
  assert.equal(armed, true)
  assert.deepEqual(state.skillTest.pendingExtraReveals, [{ flipSign: true, autoFailOn: ['skull'] }])
  assert.equal(withApi(game(), ({ api }) => api.playerTools.revealAdditionalTestToken({})), false, '不在检定中返回 false')
})

test('P6 原语 takeBasicActionWithSubstitution：执行基础行动期间技能替代，行动后恢复', () => {
  const state = game()
  const inv = state.investigators[0]
  let result
  withApi(state, ({ api }) => {
    const value = api.playerTools.takeBasicActionWithSubstitution(0, { from: ['combat'], to: 'willpower', source: 'test' })
    result = { value, substitute: inv.skillSubstitute ?? null }
  }, { select: choice => choice.options.find(option => /investigate|调查/.test(option.label || ''))?.id ?? choice.options[0]?.id })
  assert.equal(result.value, true, '执行了一次基础行动')
  assert.equal(result.substitute, null, '行动结束后技能替代被摘除')
  assert.equal(inv.skillSubstitute, null)
})

test('P6 原语 onTestSuccess 注册读点：检定中登记后由成功结算消费', () => {
  const state = game()
  const inv = state.investigators[0]
  const pick = asset(state, '01030')
  state.skillTest = { seat: 0, skill: 'willpower', difficulty: 2, committed: [], tokenTreatments: {} }
  const registered = withApi(state, ({ api }) => api.playerTools.onTestSuccess(0, {
    sourceId: pick.id, attackDamageBonus: 1, discardSelf: true,
  }))
  assert.equal(registered, true)
  assert.equal(state.skillTest.customOnSuccess.length, 1)
  assert.equal(state.skillTest.customOnSuccess[0].discardSelf, true)
  assert.equal(withApi(state, ({ api }) => api.playerTools.onTestSuccess(0, { sourceId: pick.id })), false, '没有加值时拒绝登记')
  void inv
})
