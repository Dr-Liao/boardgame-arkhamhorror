// EotE P2 原语 A：寒霜（frost）物理池与揭示规则读点的 Node 验收。
//
// 覆盖 P1 原语目录的 `chaos.frost`（extend）与 `chaos.tokenEffects`（extend）：
//   · 8 枚寒霜与祝福/诅咒共用同一套有限池读点（袋内＋已揭示＋封印区），满池不凭空加入；
//   · 支付不足不产生部分写入；非法标记名/数量抛错；祝福/诅咒上限保持 10/10；
//   · 「揭示 frost 追加揭示 1 枚」「同检定第 2 枚 frost 立即自动失败」两个读点与真实检定管线一致；
//   · 「将本标记视为 frost」经 setTokenTreatment({ as: 'frost' }) 生效并被揭示管线读取；
//   · frost 无新增持久状态：EOTE_FROST_STATE === null，JSON 往返只靠既有混乱区。
import test from 'node:test'
import assert from 'node:assert/strict'
import { beginChaosTest, drawChaosToken } from '../src/engine/chaos-bag.js'
import { POOL_LIMITS, addPoolTokens, payablePoolTokens, payPoolTokens, poolTokenCount, poolTokenRoom,
  releasePoolTokens, replacePoolTokens, schedulePoolReplacement, sealPoolTokens } from '../src/engine/chaos-token-pool.js'
import { setTokenTreatment, tokenEffect } from '../src/engine/chaos-token-effects.js'
import { createCombatOdds } from '../src/engine/combat-odds.js'
import { registerCardAbilities } from '../src/engine/ability.js'
import { performTest } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { EOTE_FROST_STATE, FROST_POOL_LIMIT, addFrost, extraRevealForFrost, frostPoolCount,
  frostPoolRoom, payFrost, shouldAutoFailForFrost } from '../src/engine/frost.js'
import { asset, fixture } from './core-fixture.mjs'

const copy = value => structuredClone(value)
const plain = () => ({ chaosBag: [], chaos: { revealed: [], sealed: [], frames: [], removed: [] } })

// 「视为 frost」的真实检定读点：一个把 skull 视为 frost 的测试条目，证明白名单不是死声明。
registerCardAbilities([
  { code: 'testEoteFrostTreat', abilities: [{ kind: 'forced', trigger: 'tokenReveal',
    criteria: ({ context }) => context.token === 'skull',
    resolve: ({ api }) => api.chaosTokens.treat({ as: 'frost' }) }] },
])

function transaction(state, execute) {
  resolveTransaction(state, 0, { action: 'eoteFrostTest' }, execute)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 80, '检定期间的待决选择过多')
    const pending = state.pendingChoice
    const optionId = pending.options.find(option => ['done', 'skip', 'self'].includes(option.id))?.id ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
}
function skillTest(state, skill, difficulty) {
  let result
  transaction(state, draft => { result = performTest(draft, 0, skill, difficulty, { resolve: () => {} }) })
  return result
}
function frostScene(bag, forced) {
  const state = fixture('01002')
  const base = state.investigators[0].willpower
  state.chaosBag = bag
  if (forced) state.debugNextTokens = forced
  return { state, base }
}

test('有限池上限：寒霜 8 枚，祝福/诅咒各 10 枚且保持不变', () => {
  assert.equal(FROST_POOL_LIMIT, 8)
  assert.ok(Object.isFrozen(POOL_LIMITS))
  assert.deepEqual({ ...POOL_LIMITS }, { bless: 10, curse: 10, frost: 8 })
  const s = plain()
  assert.equal(frostPoolCount(s), 0)
  assert.equal(frostPoolRoom(s), 8)
  assert.equal(addFrost(s, 3), 3)
  assert.equal(frostPoolCount(s), 3)
  assert.equal(frostPoolRoom(s), 5)
  assert.equal(addFrost(s, 5, { exact: true }), 5, '余量足够时 exact 完整加入')
  assert.equal(frostPoolCount(s), 8)
  assert.equal(addFrost(s, 1), 0, '满池普通加入返回 0')
  assert.equal(addFrost(s, 1, { exact: true }), false, '满池 exact 加入返回 false')
  assert.equal(frostPoolCount(s), 8)
  assert.equal(addFrost(s, 0), 0, '加入 0 枚不写入')
  assert.equal(frostPoolCount(s), 8)
  const bless = plain()
  assert.equal(addPoolTokens(bless, 'bless', 12), 10)
  assert.equal(addPoolTokens(bless, 'curse', 11), 10)
  assert.equal(poolTokenCount(bless, 'bless'), 10)
  assert.equal(poolTokenCount(bless, 'curse'), 10)
})

test('寒霜物理池：袋内＋已揭示＋封印区共用 8 枚上限，满池拒绝写入', () => {
  const s = plain()
  assert.equal(addFrost(s, 8), 8)
  beginChaosTest(s)
  s.debugNextTokens = ['frost']
  assert.equal(drawChaosToken(s), 'frost')
  assert.equal(sealPoolTokens(s, 'frostSource', 'frost', 1), 1)
  assert.equal(frostPoolCount(s), 8, '揭示区与封印区占用同一物理池')
  assert.equal(frostPoolRoom(s), 0)
  assert.equal(payablePoolTokens(s, 'frost').length, 6, '默认只看袋内')
  assert.equal(payablePoolTokens(s, 'frost', { sealed: true }).length, 7, '支付可显式包含封印区')

  const before = copy(s)
  assert.equal(addFrost(s, 1), 0, '满池时普通加入返回 0 且不写入')
  assert.deepEqual(s, before)
  assert.equal(addFrost(s, 1, { exact: true }), false, '满池时 exact 加入返回 false 且不写入')
  assert.deepEqual(s, before)

  assert.equal(payFrost(s, 1), 1, '移除 1 枚寒霜腾出位置')
  assert.equal(frostPoolCount(s), 7)
  assert.equal(releasePoolTokens(s, 'frostSource', 'frost', 1), 1, '默认释放回袋')
  assert.equal(frostPoolCount(s), 7, '封印解封回袋只换区域，不改变物理总数')
  assert.equal(addFrost(s, 1), 1)
  assert.equal(frostPoolCount(s), 8)
  assert.equal(sealPoolTokens(s, 'secondSource', 'frost', 1), 1)
  assert.equal(releasePoolTokens(s, 'secondSource', 'frost', 1, { toPool: true }), 1)
  assert.equal(frostPoolCount(s), 7, 'toPool 把寒霜交还有限池（离开袋／揭示区／封印区）')
  assert.equal(addFrost(s, 1), 1, '交还的寒霜可再次加入')
  assert.equal(frostPoolCount(s), 8)
  assert.deepEqual(replacePoolTokens(s, 'frost', 'curse', 2), { removed: 2, added: 2 })
  assert.equal(frostPoolCount(s), 6)
  assert.equal(poolTokenCount(s, 'curse'), 2)
})

test('加入/支付：非法数量与未知标记名拒绝，不足支付保持原状', () => {
  const s = plain()
  addFrost(s, 2)
  const before = copy(s)
  assert.throws(() => addFrost(s, -1), /需要合法整数/)
  assert.throws(() => addFrost(s, 1.5), /需要合法整数/)
  assert.throws(() => payFrost(s, -2), /需要合法整数/)
  assert.throws(() => addPoolTokens(s, 'unknown', 1), /无效有限池标记/)
  assert.throws(() => poolTokenCount(s, 'fros'), /无效有限池标记/, '标记名校验口径不变')
  assert.deepEqual(s, before)
  assert.equal(payFrost(s, 3), false, '不足支付返回 false')
  assert.deepEqual(s, before, '不足支付不得部分扣费')
  assert.equal(payFrost(s, 2), 2)
  assert.equal(frostPoolCount(s), 0)
  assert.equal(payFrost(s, 1), false, '空池再次支付仍返回 false')
  // 寒霜不参与轮末替换表；祝福/诅咒的延迟替换行为不变（存档校验同口径）。
  const scheduler = { ...plain(), round: 1 }
  assert.equal(schedulePoolReplacement(scheduler, 'bless', 'curse'), true)
  assert.throws(() => schedulePoolReplacement(scheduler, 'frost', 'curse'), /无效轮末替换标记/)
})

test('JSON 往返：寒霜只存在既有混乱区，无新状态容器', () => {
  assert.equal(EOTE_FROST_STATE, null)
  const s = plain()
  addFrost(s, 4)
  beginChaosTest(s)
  s.debugNextTokens = ['frost']
  drawChaosToken(s)
  sealPoolTokens(s, 'src', 'frost', 1)
  const restored = structuredClone(s)
  assert.equal(frostPoolCount(restored), frostPoolCount(s))
  assert.equal(frostPoolRoom(restored), frostPoolRoom(s))
  assert.equal('scenarioFlags' in restored, false, '不创建新容器')
  assert.equal('eote' in restored, false)
  assert.equal(payFrost(restored, 2), 2)
  assert.equal(payFrost(s, 2), 2)
  assert.equal(frostPoolCount(restored), frostPoolCount(s))
  assert.equal(addFrost(restored, 8), 6, '恢复后上限行为一致')
  assert.equal(frostPoolRoom(restored), 0)
})

test('揭示规则读点：frost 追加揭示，同检定第 2 枚自动失败', () => {
  assert.equal(extraRevealForFrost('frost'), true)
  assert.equal(extraRevealForFrost('bless'), false)
  assert.equal(extraRevealForFrost('-2'), false)
  assert.equal(extraRevealForFrost(undefined), false)
  assert.equal(shouldAutoFailForFrost([]), false)
  assert.equal(shouldAutoFailForFrost(['frost']), false)
  assert.equal(shouldAutoFailForFrost(['frost', '0']), false)
  assert.equal(shouldAutoFailForFrost(['0']), false)
  assert.equal(shouldAutoFailForFrost(['frost', 'frost']), true)
  assert.equal(shouldAutoFailForFrost(['0', 'frost', 'frost']), true)
  assert.equal(shouldAutoFailForFrost(['frost', 'autofail']), false, '其它标记不算第二枚 frost')
  assert.throws(() => shouldAutoFailForFrost('frost'), /必须为数组/)
})

test('真实检定：frost -1 并追加揭示；同检定第 2 枚 frost 立即自动失败', () => {
  const single = frostScene(['frost', '0'], ['frost'])
  const result = skillTest(single.state, 'willpower', single.base)
  assert.equal(result.autoFail, false)
  assert.deepEqual(result.drawn, ['frost', '0'], 'frost 追加揭示 1 枚')
  assert.equal(extraRevealForFrost(result.drawn[0]), true)
  assert.equal(shouldAutoFailForFrost(result.drawn), false)
  assert.equal(result.value, single.base - 1, 'frost 修正值 -1 已在既有检定管线生效')
  assert.equal(result.success, false)
  assert.equal(single.state.skillTest, null)

  const double = frostScene(['frost', 'frost'], ['frost'])
  const failed = skillTest(double.state, 'willpower', 99)
  assert.equal(failed.autoFail, true)
  assert.deepEqual(failed.drawn, ['frost', 'frost'])
  assert.equal(shouldAutoFailForFrost(failed.drawn), true)
  assert.equal(failed.value, 0, '自动失败按 0 结算')
  assert.deepEqual(double.state.chaos.revealed, [], '检定结束归还实物标记')
})

test('视为 frost：setTokenTreatment 白名单放行，未知目标仍抛错', () => {
  const s = { chaos: { revealed: ['skull'], frames: [0] }, skillTest: {} }
  assert.equal(setTokenTreatment(s, { as: 'frost' }), true)
  assert.deepEqual(s.skillTest.tokenTreatments[0], { as: 'frost', index: 0 })
  assert.equal(tokenEffect(s, 'skull', 0).face, 'frost')
  assert.throws(() => setTokenTreatment(s, { as: 'unknown' }), /无效替换符号/, '未知替换目标仍被拒绝')
  assert.throws(() => setTokenTreatment(s, { as: 'frost', fake: true }), /未知机制字段/)
  assert.throws(() => setTokenTreatment(s, { as: 'frost', modifier: Infinity }), /有限数值/)
  // 既有祝福/诅咒读取口径逐字不变。
  const plainEffect = { chaos: { revealed: ['bless', 'curse'], frames: [0] }, skillTest: {} }
  assert.deepEqual(tokenEffect(plainEffect, 'bless', 0), { face: 'bless', modifier: 2, drawAnother: true, autoSuccess: false, retain: false, cancelled: false })
  assert.deepEqual(tokenEffect(plainEffect, 'curse', 1), { face: 'curse', modifier: -2, drawAnother: true, autoSuccess: false, retain: false, cancelled: false })
})

test('真实检定：把 skull 视为 frost 后按寒霜结算并追加揭示', () => {
  const scene = frostScene(['skull', '0'], ['skull'])
  asset(scene.state, 'testEoteFrostTreat')
  const result = skillTest(scene.state, 'willpower', scene.base)
  assert.deepEqual(result.drawn, ['frost', '0'], '视为 frost 后走寒霜的追加揭示读点')
  assert.equal(result.value, scene.base - 1)
  assert.equal(result.success, false)
  assert.deepEqual(scene.state.chaosBag, ['skull', '0'], '实物标记按原面归还，不被改成 frost')
})

test('combat-odds 预览：寒霜按 -1 计入成功率且只读', () => {
  const makeOdds = createCombatOdds({
    abilityOfMove: () => null, assetEffect: () => null,
    enemyEvadeValue: () => 3, enemyFightValue: () => 3, enemyHealth: () => 3,
    enemyTextBlanked: () => false, getStat: () => 3, playedEffect: () => null, scenarioBehavior: () => null,
  })
  const state = { status: 'playing', pendingChoice: null, round: 1,
    investigators: [{ seat: 0, defeated: false, resigned: false, location: 'a', assets: [] }],
    enemies: [{ id: 'testEnemy', name: '测试敌人', code: 'testEnemy', location: 'a', fight: 3 }],
    locations: [{ id: 'a', clues: 0 }], chaosBag: ['frost', '0'] }
  const before = copy(state)
  const odds = makeOdds(state, 0, { action: 'fight', enemyId: 'testEnemy' })
  assert.equal(odds.value, 3)
  assert.equal(odds.target, 3)
  assert.equal(odds.tokens, 2)
  assert.equal(odds.chance, 0.5, 'frost 按 -1 计：只有 "0" 成功')
  assert.deepEqual(state, before, '预估只读，不写状态')
})
