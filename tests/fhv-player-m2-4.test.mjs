// 《铁杉谷盛宴》（The Feast of Hemlock Vale）P6 M2-4 分片逐卡验收（10049–10058）。
//
// 每张卡至少一条真实行为断言；缺引擎读点的子句以现有原语近似实现，并在单卡文件 note /
// artifacts/migration/fhv/primitive-requests/<code>.json 逐条披露。
//
// 约定：
//   · 直接 import 单卡条目 + registerCardAbilities，不依赖 entries/index.js（索引由主进程统一重建）；
//   · 真实打出用 core-fixture 的 move('play')，窗口/强制时机用 resolveTransaction 直接派发窗口；
//   · 每次 move / 结算后引擎可能替换调查员对象，断言前重新从 state 读取。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, asset, enemy, decisionSeat } from './core-fixture.mjs'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import {
  commitIcons, executeDescriptor, getStat, performTest, reactionWindow,
} from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'

import entry10049 from '../src/cards/entries/10049.js'
import entry10050 from '../src/cards/entries/10050.js'
import entry10051 from '../src/cards/entries/10051.js'
import entry10052 from '../src/cards/entries/10052.js'
import entry10053 from '../src/cards/entries/10053.js'
import entry10054 from '../src/cards/entries/10054.js'
import entry10055 from '../src/cards/entries/10055.js'
import entry10056 from '../src/cards/entries/10056.js'
import entry10057 from '../src/cards/entries/10057.js'
import entry10058 from '../src/cards/entries/10058.js'

const ENTRIES = [entry10049, entry10050, entry10051, entry10052, entry10053,
  entry10054, entry10055, entry10056, entry10057, entry10058]

for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

const descriptorOf = (code, kind) => {
  const descriptor = registeredEntry(code)?.abilities?.find(ability => ability.kind === kind)
  assert.ok(descriptor, `${code} 缺少 ${kind} 描述符`)
  return descriptor
}
// 牌桌「能力」入口用的是 abilityShim 的下标（只含 action/free），不是注册条目里的下标。
const abilityIndexOf = (code, kind) => registeredEntry(code).abilities
  .filter(ability => ['action', 'free'].includes(ability.kind))
  .findIndex(ability => ability.kind === kind)

function drainChoices(state, choose, step, limit = 120) {
  for (let index = 0; state.pendingChoice && index < limit; index++) {
    const pending = state.pendingChoice
    const chosen = choose(pending)
      ?? ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    assert.ok(chosen != null, `待决选择没有可选项：${JSON.stringify(pending)}`)
    step(pending, chosen)
  }
  assert.equal(state.pendingChoice, null, '选择链未结束')
}

// 真实动作（move/applyMove）留下的待决选择：继续走 dispatch 的同一事务。
function answerChoices(state, choose = () => null) {
  drainChoices(state, choose, (pending, chosen) =>
    move(state, { action: 'choose', choiceId: pending.id, optionId: chosen }))
}

// 直接派发窗口 / 结算（与 tests/tsk-player-m2-4.test.mjs 的 runTest 同一写法）：
// 续算必须用同一个 execute 重放，不能走 dispatch（事务里记的是 lifecycleProbe）。
function runProbe(state, execute, choose = () => null) {
  resolveTransaction(state, decisionSeat(state) ?? 0, { action: 'lifecycleProbe' }, execute)
  drainChoices(state, choose, (pending, chosen) =>
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: chosen }, execute))
}

const pickOption = pattern => pending => {
  const option = pending.options.find(item => pattern.test(String(item.label || '')))
  return option ? option.id : null
}
const choices = (...selectors) => pending => {
  for (const select of selectors) {
    const result = select?.(pending)
    if (result != null) return result
  }
  return null
}

// 单人牌局：把所在地点换成可控的测试地点。
function testLocation(state, { clues = 0, shroud = 0 } = {}) {
  state.locations = [{ id: 'probe-location', name: '测试地点', revealed: true, connections: [], clues, shroud }]
  state.investigators[0].location = 'probe-location'
  return state.locations[0]
}

const runPlayed = (state, code, choose = () => null) => runProbe(state, draft => executeDescriptor(draft, {
  inv: draft.investigators[0],
  source: { id: `probe:${code}`, code },
  descriptor: descriptorOf(code, 'played'),
  events: [],
  context: {},
  silent: false,
}), choose)

// ---------------------------------------------------------------------------
// 10049 “用书砸它！”
// ---------------------------------------------------------------------------

test('P6 10049 用书砸它：用[[书籍]]攻击得到 +X[战斗]（X=印刷费用），成功后结算书籍上的 [action] 能力', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].hand = ['10049']
  testLocation(state, { clues: 1 })
  const tome = asset(state, '01031') // 智慧古书：印刷费用 3，[action] 横置检索牌库顶 3 张
  const target = enemy(state, { fight: 1, health: 30, engagedSeat: 0 })
  state.chaosBag = ['0']
  move(state, { action: 'play', cardId: '10049' })
  answerChoices(state, pickOption(/结算.*能力/))
  const inv = state.investigators[0]
  const after = state.enemies.find(item => item.id === target.id)
  assert.equal(after.damageTaken, 1, '攻击命中造成基础 1 点伤害')
  assert.equal(state.lastTestResult?.value, getStat(state, inv, 'combat') + 3, '+3[战斗]（智慧古书印刷费用 3）')
  assert.equal(inv.assets.find(item => item.id === tome.id).exhausted, true, '结算了书籍的 [action] 能力（横置费用照付）')
  assert.equal(inv.discard.includes('10049'), true, '事件结算后进入弃牌堆')
})

test('P6 10049 用书砸它：成功后也可以改为自动躲避被攻击的敌人', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].hand = ['10049']
  testLocation(state, { clues: 1 })
  const tome = asset(state, '01031')
  const target = enemy(state, { fight: 1, health: 30, engagedSeat: 0 })
  state.chaosBag = ['0']
  move(state, { action: 'play', cardId: '10049' })
  answerChoices(state, pickOption(/自动躲避/))
  const inv = state.investigators[0]
  const after = state.enemies.find(item => item.id === target.id)
  assert.equal(after.exhausted, true, '被攻击的敌人被自动躲避（横置）')
  assert.equal(after.engagedSeat, null, '自动躲避后解除交战')
  assert.equal(inv.assets.find(item => item.id === tome.id).exhausted, false, '没有结算书籍能力，书籍保持重整')
})

test('P6 10049 用书砸它：检定失败时既不躲避也不结算书籍能力', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].hand = ['10049']
  testLocation(state, { clues: 1 })
  const tome = asset(state, '01031')
  const target = enemy(state, { fight: 1, health: 30, engagedSeat: 0 })
  state.chaosBag = ['autofail']
  move(state, { action: 'play', cardId: '10049' })
  answerChoices(state)
  const inv = state.investigators[0]
  const after = state.enemies.find(item => item.id === target.id)
  assert.equal(after.damageTaken, 0, '攻击失败不造成伤害')
  assert.ok(!after.exhausted, '没有自动躲避')
  assert.equal(inv.assets.find(item => item.id === tome.id).exhausted, false, '没有结算书籍能力')
  assert.equal(inv.discard.includes('10049'), true, '事件进入弃牌堆')
})

// ---------------------------------------------------------------------------
// 10050 原型惊变
// ---------------------------------------------------------------------------

test('P6 10050 原型惊变：可用[智力]代替[敏捷]躲避，成功后附属到非精英敌人并留在场上', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].hand = ['10050']
  testLocation(state, { clues: 1 })
  const target = enemy(state, { evade: 2, health: 10, engagedSeat: 0, elite: false })
  state.chaosBag = ['0']
  move(state, { action: 'play', cardId: '10050' })
  answerChoices(state, pickOption(/智力/))
  const inv = state.investigators[0]
  const after = state.enemies.find(item => item.id === target.id)
  assert.equal(state.lastTestResult?.skill, 'intellect', '本次躲避使用[智力]')
  assert.equal(state.lastTestResult?.success, true)
  assert.equal(after.exhausted, true, '躲避成功横置敌人')
  assert.deepEqual((after.attachments || []).map(item => item.code), ['10050'], '原型惊变附属到该敌人')
  assert.equal(inv.hand.includes('10050'), false, '事件已离手')
  assert.equal(inv.discard.includes('10050'), false, '附属形态不进入弃牌堆（keepOnPlay）')
})

test('P6 10050 原型惊变：检定失败时不附属，事件进入弃牌堆', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].hand = ['10050']
  testLocation(state, { clues: 1 })
  const target = enemy(state, { evade: 2, health: 10, engagedSeat: 0, elite: false })
  state.chaosBag = ['autofail']
  move(state, { action: 'play', cardId: '10050' })
  answerChoices(state, pickOption(/智力/))
  const inv = state.investigators[0]
  const after = state.enemies.find(item => item.id === target.id)
  assert.equal((after.attachments || []).length, 0, '失败不附属')
  assert.ok(!after.exhausted, '失败不横置敌人')
  assert.equal(inv.discard.includes('10050'), true, '未附属的事件进入弃牌堆')
})

// ---------------------------------------------------------------------------
// 10051 资金充裕
// ---------------------------------------------------------------------------

test('P6 10051 资金充裕：控制[[科学]]/[[工具]]支援时获得[wild]，3 个以上改为 2 个[wild]', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.assets = []
  assert.equal(commitIcons(state, inv, '10051', 'willpower'), 1, '没有[[科学]]/[[工具]]支援时只有印刷 1 个[wild]')
  asset(state, '01030') // 放大镜：道具/工具
  assert.equal(commitIcons(state, inv, '10051', 'willpower'), 2, '控制 1 个[[工具]]支援：+1[wild]')
  asset(state, '09117') // 陈旧的钥匙圈：道具/工具
  asset(state, '09045') // 研究笔记：道具/书籍/科学
  assert.equal(commitIcons(state, inv, '10051', 'willpower'), 3, '控制 3 个[[科学]]/[[工具]]支援：+2[wild]')
})

// ---------------------------------------------------------------------------
// 10052 加布里埃尔·卡里洛
// ---------------------------------------------------------------------------

test('P6 10052 加布里埃尔·卡里洛：回合开始加入 1 个[curse]并抽 1 张，+1[智力]', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.assets = []
  inv.hand = []
  inv.deck = ['01088', '01088', '01088']
  asset(state, '10052')
  state.chaosBag = ['0']
  assert.equal(getStat(state, inv, 'intellect'), inv.intellect + 1, '+1[智力]')
  // 同一窗口可以连续发动多次（没有横置/次数费用），真实玩家会发动一次后让过。
  let triggered = false
  runProbe(state, draft => reactionWindow(draft, 'turnBegins',
    { when: 'turnBegins', seat: 0, location: draft.investigators[0].location, prompt: '回合开始' }, []),
  pending => {
    if (triggered) return null
    const option = pending.options.find(item => /卡里洛/.test(String(item.label || '')))
    if (!option) return null
    triggered = true
    return option.id
  })
  const after = state.investigators[0]
  assert.equal((state.chaosBag || []).filter(token => token === 'curse').length, 1, '混乱袋加入 1 个[curse]')
  assert.equal(after.hand.length, 1, '抽取 1 张牌')
})

test('P6 10052 加布里埃尔·卡里洛：混乱袋已满 10 个[curse]时不提供反应', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.assets = []
  inv.hand = []
  asset(state, '10052')
  state.chaosBag = Array(10).fill('curse')
  let offered = false
  runProbe(state, draft => reactionWindow(draft, 'turnBegins',
    { when: 'turnBegins', seat: 0, location: draft.investigators[0].location, prompt: '回合开始' }, []),
  pending => {
    if (pending.options.some(option => /卡里洛/.test(String(option.label || '')))) offered = true
    return null
  })
  assert.equal(offered, false, '袋满时无法支付诅咒费用，反应不出现')
  assert.equal(state.investigators[0].hand.length, 0, '没有抽牌')
  assert.equal((state.chaosBag || []).filter(token => token === 'curse').length, 10, '混乱袋不变')
})

// ---------------------------------------------------------------------------
// 10053 手法稳当
// ---------------------------------------------------------------------------

// wouldSucceedTest 的「横置→多 1 点/少 1 点」与 testEnds 的「治愈」是两次独立询问。
const steadyHandedChoices = pending => {
  if (pending.options.some(option => /手法稳当/.test(String(option.label || '')) && /多 1 点|少 1 点/.test(String(option.label || '')))) {
    return pickOption(/手法稳当/)(pending)
  }
  if (pending.options.some(option => String(option.label || '') === '成功且超过难度多 1 点')) {
    return pickOption(/^成功且超过难度多 1 点$/)(pending)
  }
  if (pending.options.some(option => /手法稳当/.test(String(option.label || '')) && /治愈/.test(String(option.label || '')))) {
    return pickOption(/治愈/)(pending)
  }
  return null
}

test('P6 10053 手法稳当：检定将要成功时横置，成功点数多 1 点，正好差值 2 时治愈 1 点恐惧', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.assets = []
  inv.horror = 1
  const card = asset(state, '10053')
  state.chaosBag = ['0']
  const base = getStat(state, inv, 'willpower')
  runProbe(state, draft => performTest(draft, 0, 'willpower', base - 1, {}), steadyHandedChoices)
  const after = state.investigators[0]
  assert.equal(after.assets.find(item => item.id === card.id).exhausted, true, '手法稳当横置')
  assert.equal(state.lastTestResult?.success, true, '仍然是成功')
  assert.equal(state.lastTestResult?.successBy, 2, '成功且超过难度正好 2 点')
  assert.equal(after.horror, 0, '治愈 1 点恐惧')
})

test('P6 10053 手法稳当：也可以选择成功点数少 1 点（治愈不触发）', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.assets = []
  inv.horror = 1
  const card = asset(state, '10053')
  state.chaosBag = ['0']
  const base = getStat(state, inv, 'willpower')
  runProbe(state, draft => performTest(draft, 0, 'willpower', base - 2, {}), pending => {
    if (pending.options.some(option => /手法稳当/.test(String(option.label || '')))) {
      return pickOption(/手法稳当/)(pending)
    }
    if (pending.options.some(option => String(option.label || '') === '成功且超过难度少 1 点')) {
      return pickOption(/^成功且超过难度少 1 点$/)(pending)
    }
    return null
  })
  const after = state.investigators[0]
  assert.equal(after.assets.find(item => item.id === card.id).exhausted, true)
  assert.equal(state.lastTestResult?.success, true, '少 1 点后仍是成功')
  assert.equal(state.lastTestResult?.successBy, 1, '成功差值从 2 变为 1')
  assert.equal(after.horror, 1, '差值不是 2，不治愈恐惧')
})

// ---------------------------------------------------------------------------
// 10054 精准调配
// ---------------------------------------------------------------------------

test('P6 10054 精准调配：附属到[[工具]]支援，事件留在场上', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.assets = []
  inv.hand = ['10054']
  const hostId = asset(state, '01030').id // 放大镜：[[工具]]
  move(state, { action: 'play', cardId: '10054' })
  answerChoices(state)
  const holder = state.investigators[0]
  const host = holder.assets.find(item => item.id === hostId)
  assert.deepEqual((host.attachments || []).map(item => item.code), ['10054'], '精准调配附属到[[工具]]支援')
  assert.equal(holder.hand.includes('10054'), false, '事件已离手')
  assert.equal(holder.discard.includes('10054'), false, '附属形态不进入弃牌堆（keepOnPlay）')
})

test('P6 10054 精准调配：所附属支援横置后，横置自身并重整该支援', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.assets = []
  inv.hand = ['10054']
  const hostId = asset(state, '01030').id
  move(state, { action: 'play', cardId: '10054' })
  answerChoices(state)
  const host = state.investigators[0].assets.find(item => item.id === hostId)
  host.exhausted = true
  runProbe(state, draft => reactionWindow(draft, 'assetExhausted',
    { when: 'assetExhausted', seat: 0, assetId: hostId, assetCode: host.code, location: draft.investigators[0].location }, []),
  pickOption(/精准调配/))
  const after = state.investigators[0].assets.find(item => item.id === hostId)
  const tuned = (after.attachments || []).find(item => item.code === '10054')
  assert.equal(after.exhausted, false, '所附属支援被重整')
  assert.equal(tuned?.exhausted, true, '精准调配横置')
})

// ---------------------------------------------------------------------------
// 10055 绝密手段
// ---------------------------------------------------------------------------

const commitSecretMethod = pending => {
  if (pending.kind !== 'commit') return null
  const option = pending.options.find(item => /绝密手段/.test(String(item.label || '')))
  if (option) return option.id
  const done = pending.options.find(item => item.id === 'done')
  return done ? done.id : null
}

test('P6 10055 绝密手段：检定结束后按成功差值在混乱袋加入[curse]', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.assets = []
  inv.hand = ['10055']
  state.chaosBag = ['0']
  const base = getStat(state, inv, 'willpower')
  // 印刷 4 个[wild]：值 = base + 4 + 0；难度 base + 2 → 成功差值 2。
  runProbe(state, draft => performTest(draft, 0, 'willpower', base + 2, {}), commitSecretMethod)
  assert.equal(state.lastTestResult?.successBy, 2, '成功且超过难度 2 点')
  assert.equal((state.chaosBag || []).filter(token => token === 'curse').length, 2, '加入 2 个[curse]')
  assert.equal(state.investigators[0].discard.includes('10055'), true, '投入的技能牌结算后进入弃牌堆')
})

test('P6 10055 绝密手段：检定失败时按失败差值加入[curse]', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.assets = []
  inv.hand = ['10055']
  state.chaosBag = ['autofail']
  const base = getStat(state, inv, 'willpower')
  runProbe(state, draft => performTest(draft, 0, 'willpower', base + 2, {}), commitSecretMethod)
  const failedBy = Number(state.lastTestResult?.failedBy) || 0
  assert.ok(failedBy > 0, '本次检定失败')
  assert.equal((state.chaosBag || []).filter(token => token === 'curse').length, failedBy, '加入等于失败差值的[curse]')
})

// ---------------------------------------------------------------------------
// 10056 棱相眼镜
// ---------------------------------------------------------------------------

test('P6 10056 棱相眼镜：行动费用加入[curse]，调查 +2；揭示了[curse]时横置并额外发现 1 个线索', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.assets = []
  const glassesId = asset(state, '10056').id
  // 隐藏值 3：没有 +2 时（智识 3、诅咒 -2）会失败；+2 后 3 恰好成功 —— 顺带证明 +2 生效。
  testLocation(state, { clues: 3, shroud: 3 })
  state.chaosBag = ['0']
  state.debugNextTokens = ['curse', '0']
  move(state, { action: 'ability', assetId: glassesId, abilityIndex: abilityIndexOf('10056', 'action') })
  answerChoices(state, pickOption(/横置棱相眼镜/))
  const after = state.investigators[0]
  assert.equal(state.lastTestResult?.success, true, '智识 3 +2 -2（诅咒）= 3，恰好达到难度 3')
  assert.equal(state.lastTestResult?.value, getStat(state, after, 'intellect'), '本次调查 +2 技能值（抵掉诅咒修正后等于基础智识）')
  assert.ok((state.lastTestResult?.drawn || []).includes('curse'), '本次调查揭示了[curse]标记')
  assert.equal(state.locations[0].clues, 1, '发现基础 1 个 + 额外 1 个线索')
  assert.equal(after.assets.find(item => item.id === glassesId).exhausted, true, '棱相眼镜横置')
})

test('P6 10056 棱相眼镜：没有揭示[curse]时不提供额外线索', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.assets = []
  const glassesId = asset(state, '10056').id
  testLocation(state, { clues: 2, shroud: 0 })
  state.chaosBag = ['0']
  state.debugNextTokens = ['0']
  move(state, { action: 'ability', assetId: glassesId, abilityIndex: abilityIndexOf('10056', 'action') })
  answerChoices(state)
  const after = state.investigators[0]
  assert.equal(state.lastTestResult?.success, true)
  assert.equal(state.locations[0].clues, 1, '只发现基础 1 个线索')
  assert.ok(!after.assets.find(item => item.id === glassesId).exhausted, '没有横置')
})

// ---------------------------------------------------------------------------
// 10057 云山雾罩
// ---------------------------------------------------------------------------

test('P6 10057 云山雾罩：智识(X=敌人躲避值)检定成功，发现 2 线索并自动躲避非精英敌人（下个补给阶段不重整）', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].hand = ['10057']
  testLocation(state, { clues: 3, shroud: 0 })
  const target = enemy(state, { evade: 2, health: 10, engagedSeat: 0, elite: false })
  state.chaosBag = ['0']
  move(state, { action: 'play', cardId: '10057' })
  answerChoices(state)
  const after = state.enemies.find(item => item.id === target.id)
  assert.equal(state.lastTestResult?.difficulty, 2, '检定难度 = 敌人躲避值 2')
  assert.equal(state.lastTestResult?.success, true)
  assert.equal(state.locations[0].clues, 1, '发现 2 个线索')
  assert.equal(after.exhausted, true, '非精英敌人被自动躲避')
  assert.deepEqual(after.preventReady, { from: state.round, rounds: 1 }, '下个补给阶段不重整')
})

test('P6 10057 云山雾罩：精英敌人仍发现线索，但不会被自动躲避', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].hand = ['10057']
  testLocation(state, { clues: 3, shroud: 0 })
  const target = enemy(state, { evade: 2, health: 20, engagedSeat: 0, elite: true })
  state.chaosBag = ['0']
  move(state, { action: 'play', cardId: '10057' })
  answerChoices(state)
  const after = state.enemies.find(item => item.id === target.id)
  assert.equal(state.locations[0].clues, 1, '仍然发现 2 个线索')
  assert.ok(!after.exhausted, '精英敌人不被自动躲避')
  assert.equal(after.preventReady, undefined, '精英敌人没有不重整标记')
})

// ---------------------------------------------------------------------------
// 10058 显微镜
// ---------------------------------------------------------------------------

test('P6 10058 显微镜：你所在地点的敌人被击败后放置 1 资源作为证据', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.assets = []
  const scopeId = asset(state, '10058').id
  testLocation(state, { clues: 1 })
  const target = enemy(state, { health: 1, engagedSeat: 0 })
  let triggered = false
  runProbe(state, draft => reactionWindow(draft, 'defeatEnemy',
    { when: 'defeatEnemy', seat: 0, location: draft.investigators[0].location, enemy: target, prompt: '敌人被击败后' }, []),
  pending => {
    if (triggered) return null
    const option = pending.options.find(item => /显微镜/.test(String(item.label || '')))
    if (!option) return null
    triggered = true
    return option.id
  })
  const after = state.investigators[0].assets.find(item => item.id === scopeId)
  assert.equal(after.uses, 1, '放置 1 证据')
  assert.equal(after.usesType, 'evidence', '证据计数类型')
})

test('P6 10058 显微镜：[action][action] 调查每证据 +2[智力]（最多 +6），成功后花证据额外发现线索', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.assets = []
  const scopeId = asset(state, '10058', { uses: 5 }).id
  testLocation(state, { clues: 4, shroud: 0 })
  state.chaosBag = ['0']
  const actionsBefore = inv.actionsLeft
  move(state, { action: 'ability', assetId: scopeId, abilityIndex: abilityIndexOf('10058', 'action') })
  answerChoices(state, pickOption(/花费 2 证据/))
  const after = state.investigators[0]
  assert.equal(state.lastTestResult?.value, getStat(state, after, 'intellect') + 6, '证据 5 个 → +6[智力]（封顶）')
  assert.equal(after.assets.find(item => item.id === scopeId).uses, 3, '花费 2 证据')
  assert.equal(state.locations[0].clues, 1, '发现基础 1 个 + 额外 2 个线索')
  assert.equal(after.actionsLeft, actionsBefore - 2, '[action][action] 消耗 2 个行动')
})

test('P6 10058 显微镜：不在你所在地点的敌人被躲避时不放置证据', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.assets = []
  const scopeId = asset(state, '10058').id
  testLocation(state, { clues: 1 })
  const elsewhere = enemy(state, { location: 'other-place', engagedSeat: null })
  let offered = false
  runProbe(state, draft => reactionWindow(draft, 'evadeSuccess',
    { when: 'evadeSuccess', seat: 0, location: 'other-place', enemy: elsewhere, prompt: '敌人被躲避后' }, []),
  pending => {
    if (pending.options.some(option => /显微镜/.test(String(option.label || '')))) offered = true
    return null
  })
  assert.equal(offered, false, '异地点的敌人不触发')
  assert.equal(state.investigators[0].assets.find(item => item.id === scopeId).uses, 0, '没有放置证据')
})
