// 食梦者（第五循环）M2 玩家卡 · M2-3 分片逐卡验收 —— P7。
//
// 本文件覆盖 `artifacts/migration/tde/shards.json` 的 M2-3 分片（22 张，06196–06245）。
// 每张卡至少一条真实行为测试，测试名以 `TDE <code> <中文名>` 开头；纯数据通道的卡
// 也至少有一条可执行断言（见 P7-WORKER-BRIEF §3）。
//
// 约定：
//   · 每次 applyMove 后引擎替换调查员对象，断言前重新从 state 读取；
//   · 需要直接发起检定/触发描述子（不走 action 入口）时用 runTest 在规则事务里执行，
//     与 tests/card-lifecycle.test.mjs / tests/tcu-player-m2-1.test.mjs 的骨架一致。

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fixture, move, asset, enemy, settle, use, decisionSeat, legalMoves, validateMove,
} from './core-fixture.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { registeredEntry, descriptorsInEntry } from '../src/engine/ability.js'
import {
  applyMove, commitIcons, enemyAttack, executeDescriptor, getStat, performTest,
} from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'

const codes = [
  '06196', '06197', '06198', '06199', '06200', '06201', '06202', '06203', '06204', '06205', '06234',
  '06235', '06236', '06237', '06238', '06239', '06240', '06241', '06242', '06243', '06244', '06245',
]
assert.equal(codes.length, 22, 'M2-3 分片固定 22 张')

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

// 在规则事务里执行一段直接调用引擎的代码，并把待决选择走完。
function runTest(state, execute, choose = () => null) {
  resolveTransaction(state, decisionSeat(state) ?? 0, { action: 'lifecycleProbe' }, execute)
  for (let index = 0; state.pendingChoice && index < 150; index++) {
    const pending = state.pendingChoice
    const chosen = choose(pending)
      ?? ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    assert.ok(chosen != null, `待决选择没有可选项：${JSON.stringify(pending)}`)
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: chosen }, execute)
  }
}

// 把待决选择逐个点掉（可自定义选择）。
function resolveChoices(state, choose = () => null, limit = 150) {
  for (let index = 0; state.pendingChoice && index < limit; index++) {
    const pending = state.pendingChoice
    const chosen = choose(pending)
      ?? ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    assert.ok(chosen != null, `待决选择没有可选项：${JSON.stringify(pending)}`)
    move(state, { action: 'choose', choiceId: pending.id, optionId: chosen })
  }
}

// 直接执行一条描述子（引擎窗口里的同一入口），用于把窗口上下文喂给 resolve 型能力。
function runDescriptor(state, code, { kind = 'reaction', windowId, context = {}, choose = () => null, invIndex = 0, source = null } = {}) {
  const entry = registeredEntry(code)
  assert.ok(entry, `${code} 未注册`)
  const descriptor = descriptorsInEntry(entry, windowId, kind)[0]
  assert.ok(descriptor, `${code} 没有窗口 ${windowId} 的 ${kind} 描述子`)
  let executed = null
  runTest(state, draft => {
    const inv = draft.investigators[invIndex]
    executed = executeDescriptor(draft, {
      inv, source, descriptor, context, events: [], windowId,
    })
  }, choose)
  return { executed, descriptor }
}

// 一张技能卡投入一次检定，返回检定结果（用于 commit 档案类的卡）。
function commitCardOnce(code, skill, { testerSeat = 0, helpers = 0, chaos = ['0'] } = {}) {
  const state = fixture('01001', helpers ? 2 : 1)
  state.humanSeats = Array.from({ length: helpers ? 2 : 1 }, (_, seat) => seat)
  state.investigators[0].hand = [code]
  state.chaosBag = chaos
  let result = null
  runTest(state, draft => { result = performTest(draft, testerSeat, skill, 0, {}) }, pending => {
    if (pending.kind === 'commit') {
      const help = pending.options.find(option => option.id === 'help')
      if (help && helpers > 0 && pending.seat !== testerSeat) return null
      if (help) return 'help'
      const card = pending.options.find(option => String(option.label).includes(ALL_CARDS[code].nameZh))
      if (card) return card.id
      const done = pending.options.find(option => option.id === 'done')
      if (done) return 'done'
    }
    return null
  })
  return { state, result }
}

// study(默认地点) + 阁楼（互相连接）。
function twoLocations(state) {
  state.locations[0].connections = ['attic']
  state.locations.push({ id: 'attic', name: '阁楼', clues: 1, shroud: 1, connections: ['study'], revealed: true })
  return [state.locations[0], state.locations.find(location => location.id === 'attic')]
}

// 在提交窗口里按卡名/卡号选牌，选满 count 张后返回 done。
function commitPicker(count) {
  let picked = 0
  return pending => {
    if (pending.kind !== 'commit') return null
    const done = pending.options.find(option => option.id === 'done')
    if (picked >= count) return done ? done.id : null
    const card = pending.options.find(option => /投入：/.test(String(option.label)))
    if (!card) return done ? done.id : null
    picked++
    return card.id
  }
}

// ---------------------------------------------------------------------------
// 06196 安全护卫
// ---------------------------------------------------------------------------

test('TDE 06196 安全护卫 其他调查员移动到连接地点时横置跟随移动', () => {
  const state = fixture('01001', 2)
  const [study, attic] = twoLocations(state)
  const guard = asset(state, '06196', {}, 0)
  state.humanSeats = [0, 1]
  state.phase = 'investigation'
  state.currentSeat = 1
  assert.equal(state.investigators[1].location, study.id, '另一名调查员在安全护卫持有者所在地点')
  move(state, { action: 'move', locationId: 'attic' })
  resolveChoices(state, pending => {
    if (pending.kind !== 'reaction') return null
    const option = pending.options.find(item => /安全护卫/.test(String(item.label)))
    return option ? option.id : null
  })
  const inv = state.investigators[0]
  assert.equal(state.investigators[1].location, 'attic', '另一名调查员移动到阁楼')
  assert.equal(inv.location, 'attic', '安全护卫持有者跟随移动到阁楼')
  assert.equal(inv.assets.find(item => item.id === guard.id).exhausted, true, '费用：横置安全护卫')
  // 不是「其他调查员」时不触发（criteria 只对他人移动生效）。
  const criteria = registeredEntry('06196').abilities[0].criteria[0]
  assert.equal(criteria({ state, inv, context: { seat: inv.seat, location: 'attic' } }), false,
    '自己回合的移动不触发安全护卫')
})

// ---------------------------------------------------------------------------
// 06197 熟能生巧
// ---------------------------------------------------------------------------

test('TDE 06197 熟能生巧 快速：查牌库顶 9 张找出[[精通]]技能并投入本次检定', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.hand = ['06197']
  inv.deck = ['01088', '01089', '06199'] // 06199：技能卡，特性 [[精通]]
  state.chaosBag = ['0']
  const resourcesBefore = inv.resources
  let result = null
  runTest(state, draft => { result = performTest(draft, 0, 'willpower', 0, {}) }, pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => item.cardCode === '06197')
      if (option) return option.id
    }
    if (pending.kind === 'commit') {
      const done = pending.options.find(option => option.id === 'done')
      if (done) return done.id
    }
    return null
  })
  assert.ok(result, '检定应有结果')
  const after = state.investigators[0]
  // 01001 意志 3 + 投入的 1 个万能图标 = 4。
  assert.equal(result.value, getStat(state, after, 'willpower') + 1, '找出的[[精通]]技能被投入本次检定')
  assert.ok(after.discard.includes('06199'), '投入的[[精通]]技能随检定收尾进入弃牌堆')
  assert.equal(after.hand.includes('06197'), false, '快速事件已打出')
  assert.ok(after.discard.includes('06197'), '事件结算后进弃牌堆')
  assert.equal(after.resources, resourcesBefore - 1, '打出费用 1 资源')
})

// ---------------------------------------------------------------------------
// 06198 海量研究
// ---------------------------------------------------------------------------

test('TDE 06198 海量研究 每有一张其它手牌费用 -1；发现所在地点 2 个线索', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.hand = ['06198', '01088', '01089']
  inv.resources = 8
  state.locations[0].clues = 4
  move(state, { action: 'play', cardId: '06198' })
  resolveChoices(state, pending => {
    if (pending.kind !== 'reaction') return null
    const option = pending.options.find(item => /海量研究/.test(String(item.label)))
    return option ? option.id : null
  })
  const after = state.investigators[0]
  assert.equal(after.resources, 0, '10 费用 - 2 张其它手牌 = 8 资源')
  assert.equal(after.clues, 2, '发现所在地点的 2 个线索')
  assert.equal(state.locations[0].clues, 2)
  assert.ok(after.discard.includes('06198'))
  // 可用性预览与折后费用同源：资源 7 时打不出（折后仍需 8）。
  const poor = fixture('01001')
  poor.investigators[0].hand = ['06198', '01088', '01089']
  poor.investigators[0].resources = 7
  poor.locations[0].clues = 4
  assert.match(String(validateMove(poor, 0, { action: 'play', cardId: '06198' })), /资源不足/)
})

// ---------------------------------------------------------------------------
// 06199 三条A
// ---------------------------------------------------------------------------

test('TDE 06199 三条A 同名多张可同时投入同一次技能检定（每张 1 个万能图标）', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.hand = ['06199', '06199', '06199']
  state.chaosBag = ['0']
  inv.actionsLeft = 20
  let result = null
  let picked = 0
  runTest(state, draft => { result = performTest(draft, 0, 'willpower', 0, {}) }, pending => {
    if (pending.kind !== 'commit') return null
    if (picked < 2) {
      const option = pending.options.find(item => /三条A/.test(String(item.label)))
      if (option) { picked++; return option.id }
    }
    return pending.options.find(option => option.id === 'done')?.id ?? null
  })
  assert.ok(result, '检定应有结果')
  const after = state.investigators[0]
  assert.equal(picked, 2, '同一次检定里投入了 2 张三条A')
  assert.equal(result.value, getStat(state, after, 'willpower') + 2, '每张三条A 提供 1 个万能图标')
  assert.equal(result.committed.filter(code => code === '06199').length, 2)
})

// ---------------------------------------------------------------------------
// 06200 夜盗
// ---------------------------------------------------------------------------

test('TDE 06200 夜盗 横置调查：成功改为获得 2 资源，每超过难度 1 点 +1（最多 +3）', () => {
  const state = fixture('01001')
  const burglary = asset(state, '06200')
  state.locations[0].clues = 1
  state.locations[0].shroud = 2
  state.chaosBag = ['0']
  const resourcesBefore = state.investigators[0].resources
  use(state, burglary)
  resolveChoices(state)
  const inv = state.investigators[0]
  // 01001 智识 3 vs 隐藏值 2：成功超出 1 点 → 2 + 1 = 3 资源。
  assert.equal(inv.resources, resourcesBefore + 3, '成功超出 1 点：获得 2+1 资源')
  assert.equal(state.locations[0].clues, 1, '不发现线索')
  assert.equal(inv.clues, 0)
  const after = inv.assets.find(item => item.code === '06200')
  assert.equal(after.exhausted, true, '费用：横置夜盗')
  // 失败不给资源。
  const fail = fixture('01001')
  const tool = asset(fail, '06200')
  fail.locations[0].clues = 1
  fail.locations[0].shroud = 8
  fail.chaosBag = ['0']
  const before = fail.investigators[0].resources
  use(fail, tool)
  resolveChoices(fail)
  assert.equal(fail.investigators[0].resources, before, '检定失败不获得资源')
  assert.equal(fail.locations[0].clues, 1, '失败也不发现线索')
})

// ---------------------------------------------------------------------------
// 06201 幽灵利刃
// ---------------------------------------------------------------------------

test('TDE 06201 幽灵利刃 攻击加入意志值，非精英敌人 +2 伤害', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  const target = enemy(state, { fight: 2, evade: 2, health: 20, damage: 0, horror: 0, engagedSeat: null })
  inv.hand = ['06201']
  state.chaosBag = ['0']
  move(state, { action: 'play', cardId: '06201' })
  resolveChoices(state, pending => {
    if (pending.kind === 'effect') {
      const engage = pending.options.find(option => option.id === 'engage')
      if (engage) return engage.id
    }
    return null
  })
  const after = state.investigators[0]
  const hit = state.enemies.find(item => item.id === target.id)
  assert.equal(hit.engagedSeat, 0, '攻击前可以立即与被攻击的敌人交战')
  // 战斗 4 + 意志 3 = 7 vs 战斗值 2：命中；基础 1 + 非精英 +2 = 3 伤害。
  assert.equal(hit.damageTaken, 3, '非精英敌人造成 +2 伤害（合计 3）')
  assert.ok(after.discard.includes('06201'), '事件结算后进弃牌堆')

  // 精英敌人：改为 +1 伤害（合计 2）。
  const eliteState = fixture('01001')
  const eliteTarget = enemy(eliteState, { fight: 2, evade: 2, health: 20, damage: 0, horror: 0, elite: true, engagedSeat: null })
  eliteState.investigators[0].hand = ['06201']
  eliteState.chaosBag = ['0']
  move(eliteState, { action: 'play', cardId: '06201' })
  resolveChoices(eliteState, pending => (pending.kind === 'effect'
    ? pending.options.find(option => option.id === 'skip')?.id ?? null
    : null))
  assert.equal(eliteState.enemies.find(item => item.id === eliteTarget.id).damageTaken, 2,
    '精英敌人只 +1 伤害（合计 2）')
})

// ---------------------------------------------------------------------------
// 06202 命令真言
// ---------------------------------------------------------------------------

test('TDE 06202 命令真言 指定一张法术卡：从牌库检索并抽取，其余洗回', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.hand = ['06202']
  inv.deck = ['01088', '01089', '01060', '01091'] // 01060 皱缩术：[[法术]]
  state.chaosBag = ['0']
  const resourcesBefore = inv.resources
  move(state, { action: 'play', cardId: '06202' })
  resolveChoices(state)
  const after = state.investigators[0]
  assert.equal(after.hand.includes('01060'), true, '找出的[[法术]]卡加入手牌')
  assert.equal(after.deck.length, 3, '牌库剩余 3 张（检索后洗回）')
  assert.equal(after.deck.includes('01060'), false, '找出的卡离开牌库')
  assert.ok(after.discard.includes('06202'), '事件结算后进弃牌堆')
  assert.equal(after.resources, resourcesBefore - 2, '打出费用 2 资源')
})

// ---------------------------------------------------------------------------
// 06203 月石
// ---------------------------------------------------------------------------

test('TDE 06203 月石 不能从手牌打出；弃牌前改为打出月石并取消该次弃牌', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.hand = ['06203']
  inv.resources = 10
  assert.match(String(validateMove(state, 0, { action: 'play', cardId: '06203' })), /月石不能从手牌中打出/,
    '普通出牌路径被拒绝')
  const context = { when: 'wouldDiscardFromHand', seat: 0, amount: 1, what: 'discard', location: inv.location }
  runDescriptor(state, '06203', { windowId: 'wouldDiscardFromHand', context })
  assert.equal(context.cancelled, true, '取消这次弃牌效果')
  const after = state.investigators[0]
  const stone = after.assets.find(item => item.code === '06203')
  assert.ok(stone, '月石被从手牌打出进入场上')
  assert.equal(after.resources, 7, '打出费用 3 资源')
  assert.equal(getStat(state, after, 'willpower'), 4, '月石：+1 意志')
  assert.equal(getStat(state, after, 'agility'), 3, '月石：+1 敏捷')
  // 无技能图标 → 不能投入检定。
  assert.equal(commitIcons(state, after, '06203', 'willpower'), 0)
})

// ---------------------------------------------------------------------------
// 06204 目力敏锐
// ---------------------------------------------------------------------------

test('TDE 06204 目力敏锐 调查检定成功超过 2 点：额外发现 1 个线索', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.hand = ['06204']
  state.locations[0].clues = 3
  state.locations[0].shroud = 1
  state.chaosBag = ['0']
  move(state, { action: 'investigate' })
  resolveChoices(state, pending => {
    if (pending.kind !== 'commit') return null
    const card = pending.options.find(option => /目力敏锐/.test(String(option.label)))
    if (card) return card.id
    return pending.options.find(option => option.id === 'done')?.id ?? null
  })
  const after = state.investigators[0]
  // 智识 3 + 投入 1 个图标 = 4 vs 隐藏值 1：成功超出 3 点（≥2）→ 基础 1 + 额外 1 = 2 个线索。
  assert.equal(state.lastTestResult?.success, true)
  assert.equal(after.clues, 2, '基础 1 个 + 卡面额外 1 个线索')
  assert.equal(state.locations[0].clues, 1)
})

// ---------------------------------------------------------------------------
// 06205 清醒梦
// ---------------------------------------------------------------------------

test('TDE 06205 清醒梦 选择手牌/场上一张卡，检索牌库中另一张同名卡并抽取', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.hand = ['06205', '01088']
  inv.deck = ['01060', '01088'] // 牌库里有另一张 01088
  state.chaosBag = ['0']
  const resourcesBefore = inv.resources
  move(state, { action: 'play', cardId: '06205' })
  resolveChoices(state)
  const after = state.investigators[0]
  assert.equal(after.hand.filter(code => code === '01088').length, 2, '另一张同名卡加入手牌')
  assert.equal(after.deck.includes('01088'), false, '同名卡离开牌库')
  assert.equal(after.deck.length, 1, '其余牌洗回牌库')
  assert.ok(after.discard.includes('06205'))
  assert.equal(after.resources, resourcesBefore - 1, '打出费用 1 资源')
})

// ---------------------------------------------------------------------------
// 06234 英勇救援
// ---------------------------------------------------------------------------

test('TDE 06234 英勇救援 快速：代替另一位调查员承受非精英敌人的攻击，然后对其造成 1 点伤害', () => {
  const state = fixture('01001', 2)
  state.humanSeats = [0, 1]
  const victim = state.investigators[1]
  const attacker = enemy(state, { damage: 2, horror: 0, engagedSeat: 1 })
  state.investigators[0].hand = ['06234']
  let offered = false
  runTest(state, draft => {
    enemyAttack(draft, draft.enemies.find(item => item.id === attacker.id), draft.investigators[1], [], '测试攻击')
  }, pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => item.cardCode === '06234')
      if (option) { offered = true; return option.id }
    }
    return null
  })
  assert.equal(offered, true, '敌人攻击另一位调查员时可以提供英勇救援')
  const rescuer = state.investigators[0]
  assert.equal(victim.damage, 0, '原目标没有受到攻击伤害')
  assert.equal(rescuer.damage, 2, '改为对救援者结算该次攻击')
  const after = state.enemies.find(item => item.id === attacker.id)
  assert.equal(after.engagedSeat, 0, '救援者与敌人交战')
  assert.equal(after.damageTaken, 1, '然后对敌人造成 1 点伤害')
  assert.ok(rescuer.discard.includes('06234'), '事件结算后进弃牌堆')
})

// ---------------------------------------------------------------------------
// 06235 领导力
// ---------------------------------------------------------------------------

test('TDE 06235 领导力 投入到另一位调查员的检定时获得 [willpower][wild]', () => {
  const { state, result } = commitCardOnce('06235', 'willpower', { testerSeat: 1, helpers: 1 })
  assert.ok(result, '检定应有结果')
  const committed = state.investigators[0]
  // 领导力印刷 1 个万能图标 + 投入他人检定时的 [willpower][wild] 2 个 = 3 个。
  const testerWillpower = getStat(state, state.investigators[1], 'willpower')
  assert.equal(result.value, testerWillpower + 3, '领导力在他人检定上提供 3 个图标')
  assert.equal(result.committed.includes('06235'), true, '领导力确实被投入')
  assert.equal(committed.hand.includes('06235'), false, '投入后离开手牌')
  // 投给自己：只有印刷的 1 个万能图标（trigger 句只对「另一位调查员」生效）。
  const self = commitCardOnce('06235', 'willpower', { testerSeat: 0 })
  assert.equal(self.result.value, getStat(self.state, self.state.investigators[0], 'willpower') + 1,
    '投给自己时只有印刷的 1 个万能图标')
})

// ---------------------------------------------------------------------------
// 06236 / 06237 / 06238 梦境日记（研究完成）
// ---------------------------------------------------------------------------

for (const [code, condition] of [
  ['06236', '隐藏值至少为 4 的地点'],
  ['06237', '与敌人交战'],
  ['06238', '至少 8 张手牌'],
]) {
  test(`TDE ${code} 梦境日记 回合开始检索绑定卡「梦的本质」入手（研究完成门控）`, () => {
    const state = fixture('01001')
    const inv = state.investigators[0]
    inv.hand = []
    asset(state, code)
    // 研究完成：升级池按 youHaveInterpretedTheDreams 记录门控（通用读点）。
    assert.equal(registeredEntry(code).researchRequirement, 'youHaveInterpretedTheDreams',
      `${code} 声明研究记录门控`)
    // 条件句（${condition} 时梦的本质获得[wild][wild]）是跨卡图标修正，显式简化。
    assert.equal(registeredEntry(code).simplified, true, `${code} 的跨卡图标修正按 simplified 登记`)
    runDescriptor(state, code, {
      kind: 'reaction',
      windowId: 'turnBegins',
      context: { seat: 0, location: inv.location },
    })
    const after = state.investigators[0]
    assert.equal(after.hand.includes('06113'), true, '回合开始把「梦的本质」加入手牌')
    const bonded = state.bondedSets[code]
    assert.ok(bonded, '建立绑定卡场外集合')
    assert.equal(bonded.retrieved, true)
    // 只在持有者的回合开始触发。
    const criteria = registeredEntry(code).abilities[0].criteria[0]
    assert.equal(criteria({ state, inv: after, context: { seat: 1 } }), false, '别人的回合开始不触发')
  })
}

// ---------------------------------------------------------------------------
// 06239 快手
// ---------------------------------------------------------------------------

test('TDE 06239 快手 每位调查员仅限 1 张', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.hand = ['06239']
  move(state, { action: 'play', cardId: '06239' })
  assert.ok(state.investigators[0].assets.some(item => item.code === '06239'), '快手入场')
  state.investigators[0].hand = ['06239']
  assert.match(String(validateMove(state, 0, { action: 'play', cardId: '06239' })), /每位调查员仅限/,
    '控制着快手时不能再打出第二张')
})

// ---------------------------------------------------------------------------
// 06240 虎口拔牙
// ---------------------------------------------------------------------------

test('TDE 06240 虎口拔牙 作为技能卡的投入图标', () => {
  const { state, result } = commitCardOnce('06240', 'willpower')
  assert.ok(result, '检定应有结果')
  assert.equal(result.value, getStat(state, state.investigators[0], 'willpower') + 1, '印刷 1 个万能图标')
  assert.equal(result.committed.includes('06240'), true)
})

// ---------------------------------------------------------------------------
// 06241 / 06242 / 06243 增强自我
// ---------------------------------------------------------------------------

for (const [code, skill] of [['06241', 'combat'], ['06242', 'agility'], ['06243', 'intellect']]) {
  test(`TDE ${code} 增强自我 横置：本次检定 +2 ${{ combat: '战斗', agility: '敏捷', intellect: '智识' }[skill]}`, () => {
    const state = fixture('01001')
    const inv = state.investigators[0]
    const empower = asset(state, code)
    state.chaosBag = ['0']
    let result = null
    let used = false
    runTest(state, draft => { result = performTest(draft, 0, skill, 0, {}) }, pending => {
      if (pending.kind === 'playerWindow') {
        const option = pending.options.find(item => /增强自我/.test(String(item.label)))
        if (option) { used = true; return option.id }
      }
      if (pending.kind === 'commit') {
        return pending.options.find(option => option.id === 'done')?.id ?? null
      }
      return null
    })
    assert.equal(used, true, '检定投入前的玩家窗口可以提供增强自我的免费能力')
    const after = state.investigators[0]
    assert.equal(result.value, getStat(state, after, skill) + 2, '本次检定 +2 技能值')
    assert.equal(after.assets.find(item => item.id === empower.id).exhausted, true, '费用：横置增强自我')
    // 「最多 3 张增强自我共占一个法术槽位」的近似：三张同名变体可以同时入场。
    const slotState = fixture('01001')
    slotState.investigators[0].hand = ['06241', '06242', '06243']
    for (const variant of ['06241', '06242', '06243']) {
      move(slotState, { action: 'play', cardId: variant })
      resolveChoices(slotState, pending => {
        const replace = pending.options.find(option => /弃置|替换/.test(String(option.label)))
        return replace ? replace.id : null
      })
    }
    assert.deepEqual(slotState.investigators[0].assets.map(item => item.code).sort(), ['06241', '06242', '06243'],
      '三张增强自我可以同时在场（共占一个法术槽位的近似实现）')
  })
}

// ---------------------------------------------------------------------------
// 06244 特薇拉·凯瑟琳·普莱斯
// ---------------------------------------------------------------------------

test('TDE 06244 特薇拉 作为[[盟友]]支援入场（充能回收反应显式简化）', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.hand = ['06244']
  const resourcesBefore = inv.resources
  assert.equal(ALL_CARDS['06244'].type, 'asset')
  assert.ok((ALL_CARDS['06244'].traits || []).includes('Ally'), '印刷[[盟友]]特性')
  move(state, { action: 'play', cardId: '06244' })
  const after = state.investigators[0]
  assert.ok(after.assets.some(item => item.code === '06244'), '特薇拉入场')
  assert.equal(after.resources, resourcesBefore - 3, '打出费用 3 资源')
  assert.equal(registeredEntry('06244').simplified, true, '「花费充能后」的反应按 simplified 登记')
})

// ---------------------------------------------------------------------------
// 06245 希望微光
// ---------------------------------------------------------------------------

test('TDE 06245 希望微光 只能从弃牌堆打出：把弃牌堆中其余希望微光加入手牌', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.hand = []
  inv.discard = ['06245', '06245', '01088']
  inv.resources = 10
  assert.equal(registeredEntry('06245').playableFromDiscard, true, '声明可从弃牌堆打出')
  const playMove = legalMoves(state).find(item => item.action === 'play' && item.cardId === '06245' && item.fromDiscard)
  assert.ok(playMove, '弃牌堆里的希望微光提供可打出的行动')
  applyMove(state, 0, { action: 'play', cardId: '06245', fromDiscard: true })
  resolveChoices(state)
  const after = state.investigators[0]
  assert.equal(after.hand.filter(code => code === '06245').length, 1, '弃牌堆中的另一张希望微光加入手牌')
  assert.equal(after.discard.filter(code => code === '06245').length, 1, '正在打出的这一张结算后进弃牌堆')
  assert.equal(after.resources, 9, '打出费用 1 资源')
})

// ---------------------------------------------------------------------------
// 分片完整性守卫（不属于逐卡证据，只防止漏文件）
// ---------------------------------------------------------------------------

test('TDE M2-3 分片 22 张条目全部注册且 code 与文件名一致', () => {
  for (const code of codes) {
    const entry = registeredEntry(code)
    assert.ok(entry, `${code} 未注册（entries/index.js 需要重建）`)
    assert.equal(entry.code, code)
  }
})
