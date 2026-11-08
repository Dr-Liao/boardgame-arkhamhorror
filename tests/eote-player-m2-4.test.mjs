// 地球边缘（Edge of the Earth）M2-4 分片逐卡验收 —— P6。
//
// 本文件覆盖 `08109–08133` 共 25 张一般玩家卡（含基础弱点 08130–08133 与场外/绑定卡）。
// 每张卡至少一条真实行为断言；缺引擎读点的子句以现有原语近似实现，并在对应单卡文件头
// 注释与测试标题中标注 approximation（详见各条目 `note`/注释）。
//
// 约定（与 tests/tde-player-m2-4.test.mjs 相同）：
//   · 直接 import 单卡条目 + registerCardAbilities，不依赖 entries/index.js；
//   · 每次 move/applyMove 后引擎替换调查员对象，断言前重新从 state 读取；
//   · 需要直接发起检定/伤害时用 runTest 在规则事务里执行。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, asset, enemy, settle, decisionSeat, legalMoves, validateMove } from './core-fixture.mjs'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import {
  applyHarm, canEquip, drawCards, executeDescriptor, getStat, healDamageFrom, healHorrorFrom, performTest, reactionWindow, slotUsage,
} from '../src/engine/engine.js'
import { capabilityBlocked, playCostDelta } from '../src/engine/modifiers.js'
import { resolveTransaction } from '../src/engine/resolution.js'

import entry08109 from '../src/cards/entries/08109.js'
import entry08110 from '../src/cards/entries/08110.js'
import entry08111 from '../src/cards/entries/08111.js'
import entry08112 from '../src/cards/entries/08112.js'
import entry08113 from '../src/cards/entries/08113.js'
import entry08114 from '../src/cards/entries/08114.js'
import entry08115 from '../src/cards/entries/08115.js'
import entry08116 from '../src/cards/entries/08116.js'
import entry08117 from '../src/cards/entries/08117.js'
import entry08118 from '../src/cards/entries/08118.js'
import entry08119 from '../src/cards/entries/08119.js'
import entry08120 from '../src/cards/entries/08120.js'
import entry08121 from '../src/cards/entries/08121.js'
import entry08122 from '../src/cards/entries/08122.js'
import entry08123 from '../src/cards/entries/08123.js'
import entry08124 from '../src/cards/entries/08124.js'
import entry08125 from '../src/cards/entries/08125.js'
import entry08126 from '../src/cards/entries/08126.js'
import entry08127 from '../src/cards/entries/08127.js'
import entry08128 from '../src/cards/entries/08128.js'
import entry08129 from '../src/cards/entries/08129.js'
import entry08130 from '../src/cards/entries/08130.js'
import entry08131 from '../src/cards/entries/08131.js'
import entry08132 from '../src/cards/entries/08132.js'
import entry08133 from '../src/cards/entries/08133.js'

const ENTRIES = [
  entry08109, entry08110, entry08111, entry08112, entry08113, entry08114, entry08115, entry08116,
  entry08117, entry08118, entry08119, entry08120, entry08121, entry08122, entry08123, entry08124,
  entry08125, entry08126, entry08127, entry08128, entry08129, entry08130, entry08131, entry08132, entry08133,
]
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

// 25 张分片全集；第二轮起不再有 blocked 卡（缺读点的子句均以现有原语近似实现，见条目注释）。
const CODES = []
for (let index = 109; index <= 133; index++) CODES.push(`08${index}`)
const BLOCKED = []

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

// 在规则事务里执行一段直接调用引擎的代码，并把待决选择走完。
function runTest(state, execute, choose = () => null) {
  resolveTransaction(state, decisionSeat(state) ?? 0, { action: 'lifecycleProbe' }, execute)
  for (let index = 0; state.pendingChoice && index < 120; index++) {
    const pending = state.pendingChoice
    const chosen = choose(pending)
      ?? ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    assert.ok(chosen != null, `待决选择没有可选项：${JSON.stringify(pending)}`)
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: chosen }, execute)
  }
}

// 把待决选择逐个点掉（可自定义选择）。
function resolveChoices(state, choose = () => null, limit = 120) {
  for (let index = 0; state.pendingChoice && index < limit; index++) {
    const pending = state.pendingChoice
    const chosen = choose(pending)
      ?? ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    assert.ok(chosen != null, `待决选择没有可选项：${JSON.stringify(pending)}`)
    move(state, { action: 'choose', choiceId: pending.id, optionId: chosen })
  }
}

// 选择窗口里 label 匹配给定正则的选项。
const pickOption = pattern => pending => {
  const option = pending.options.find(item => pattern.test(String(item.label || '')))
  return option ? option.id : null
}

// 引擎窗口探针：在规则事务里直接开一次反应窗口（真实 openAbilityWindow 路径）。
function reactWindowProbe(draft, context) {
  return reactionWindow(draft, context.when, context, [])
}

// catalog-only 阶段事件卡不能走真实 play 入口；直接执行已注册的 played 描述符
// （仍是引擎 executeDescriptor + ctx.api，不伪造效果），与 M2-1 分片测试同一口径。
const resolvePlayed = (state, code, extra = {}) => {
  const descriptor = registeredEntry(code).abilities.find(ability => ability.kind === 'played')
  assert.ok(descriptor, `${code} 缺少 played 描述符`)
  runTest(state, draft => executeDescriptor(draft, {
    inv: draft.investigators[0], source: { id: `probe:${code}`, code }, descriptor, events: [],
    context: extra.context || {}, silent: false,
  }), extra.choose)
}

// 组合选择函数：按顺序尝试多个选择器。
const choices = (...selectors) => pending => {
  for (const select of selectors) {
    const result = select?.(pending)
    if (result != null) return result
  }
  return null
}

// ---------------------------------------------------------------------------
// 08109 身形虚化（0–1 级）
// ---------------------------------------------------------------------------

test('P6 08109 身形虚化 成功躲避：花 1 充能并获得 1 个额外行动', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const blur = asset(state, '08109')
  const target = enemy(state, { fight: 1, evade: 1 })
  state.chaosBag = ['0']
  const before = state.investigators[0].actionsLeft
  move(state, { action: 'ability', assetId: blur.id, abilityIndex: 0, targetId: target.id })
  resolveChoices(state, pickOption(/改用意志/))
  const inv = state.investigators[0]
  assert.equal(state.lastTestResult?.success, true, '意志 3 + 1 + 0 对躲避 1 成功')
  assert.equal(state.lastTestResult?.value, getStat(state, inv, 'willpower') + 1, '本次躲避 +1 技能值')
  assert.equal(inv.assets.find(item => item.id === blur.id).uses, 2, '成功花费 1 充能')
  assert.equal(inv.actionsLeft, before, '花 1 行动并返还 1 个额外行动')
  assert.equal(state.enemies.find(item => item.id === target.id).exhausted, true)
})

test('P6 08109 身形虚化 没有充能时能力不可用', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const blur = asset(state, '08109', { uses: 0 })
  const target = enemy(state, { fight: 1, evade: 1 })
  state.chaosBag = ['0']
  const offers = legalMoves(state).filter(item => item.action === 'ability' && item.assetId === blur.id)
  assert.deepEqual(offers, [], '没有充能时不提供能力')
  assert.match(String(validateMove(state, 0, { action: 'ability', assetId: blur.id, abilityIndex: 0, targetId: target.id })),
    /能力|充能|没有/)
})

// ---------------------------------------------------------------------------
// 08111 身形虚化（4 级）
// ---------------------------------------------------------------------------

test('P6 08111 身形虚化 成功后可花 2 充能获得 2 个额外行动', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const blur = asset(state, '08111')
  const target = enemy(state, { fight: 1, evade: 1 })
  state.chaosBag = ['+3']
  const before = state.investigators[0].actionsLeft
  move(state, { action: 'ability', assetId: blur.id, abilityIndex: 0, targetId: target.id })
  resolveChoices(state, choices(pickOption(/改用意志/), pickOption(/花费 2 充能/)))
  const inv = state.investigators[0]
  assert.equal(state.lastTestResult?.success, true)
  assert.equal(state.lastTestResult?.value, getStat(state, inv, 'willpower') + 2 + 3, '本次躲避 +2 技能值（+3 标记）')
  assert.equal(inv.assets.find(item => item.id === blur.id).uses, 2, '成功花费 2 充能')
  assert.equal(inv.actionsLeft, before + 1, '花 1 行动并返还 2 个额外行动')
})

// ---------------------------------------------------------------------------
// 08110 虚影易位
// ---------------------------------------------------------------------------

test('P6 08110 虚影易位 与已揭示地点的非精英敌人交换位置', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.locations = [{ id: 'a', name: 'A', revealed: true, connections: ['b'] },
    { id: 'b', name: 'B', revealed: true, connections: ['a'] }]
  state.investigators[0].location = 'a'
  const target = enemy(state, { location: 'b', elite: false, engagedSeat: null, fight: 1 })
  resolvePlayed(state, '08110')
  const inv = state.investigators[0]
  assert.equal(inv.location, 'b', '调查员移动到敌人原来的地点')
  assert.equal(state.enemies.find(item => item.id === target.id).location, 'a', '敌人移动到调查员原来的地点')
})

test('P6 08110 虚影易位 已揭示地点没有非精英敌人时不能打出', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.locations = [{ id: 'a', name: 'A', revealed: true, connections: [] }]
  state.investigators[0].location = 'a'
  const elite = enemy(state, { location: 'a', elite: true })
  state.investigators[0].hand = ['08110']
  state.investigators[0].resources = 5
  const condition = registeredEntry('08110').playCondition[0]
  assert.equal(condition.when({ state, inv: state.investigators[0] }), false, '没有合法目标时打出条件不满足')
  assert.match(condition.message, /虚影易位/)
  assert.equal(state.enemies.find(item => item.id === elite.id).location, 'a')
})

// ---------------------------------------------------------------------------
// 08114 / 08115 珍贵记忆
// ---------------------------------------------------------------------------

test('P6 08114 珍贵记忆（来自前世）：失败且低于难度 2+ 后横置治愈自身 1 伤害', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const memento = asset(state, '08114', { damage: 1, horror: 1 })
  state.chaosBag = ['0']
  // 意志 3 对难度 5：失败且低于难度 2 点 → 触发治愈伤害的反应。
  runTest(state, draft => { performTest(draft, 0, 'willpower', 5) },
    pickOption(/珍贵记忆.*伤害|治愈/))
  const after = state.investigators[0].assets.find(item => item.id === memento.id)
  assert.equal(after.exhausted, true, '横置珍贵记忆')
  assert.equal(after.damage, 0, '治愈自身 1 点伤害')
  assert.equal(after.horror, 1, '不治愈恐惧')
})

test('P6 08114 珍贵记忆（来自前世）：成功且超过难度 2+ 后横置治愈自身 1 恐惧', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const memento = asset(state, '08114', { damage: 0, horror: 1 })
  state.chaosBag = ['0']
  // 意志 3 对难度 1：成功且超过难度 2 点 → 触发治愈恐惧的反应。
  runTest(state, draft => { performTest(draft, 0, 'willpower', 1) },
    pickOption(/珍贵记忆.*恐惧|治愈/))
  const after = state.investigators[0].assets.find(item => item.id === memento.id)
  assert.equal(after.exhausted, true)
  assert.equal(after.horror, 0, '治愈自身 1 点恐惧')
})

test('P6 08115 珍贵记忆（来自后世）：失败治愈恐惧、成功治愈伤害（与前世互换）', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const memento = asset(state, '08115', { damage: 1, horror: 1 })
  state.chaosBag = ['0']
  runTest(state, draft => { performTest(draft, 0, 'willpower', 5) }, pickOption(/珍贵记忆.*恐惧|治愈/))
  const after = state.investigators[0].assets.find(item => item.id === memento.id)
  assert.equal(after.horror, 0, '失败分支治愈恐惧')
  assert.equal(after.damage, 1, '不治愈伤害')
})

// ---------------------------------------------------------------------------
// 08116 护身法宝
// ---------------------------------------------------------------------------

test('P6 08116 护身法宝 将被击败时弃掉并取消最多 2 点伤害', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const talisman = asset(state, '08116')
  state.investigators[0].damage = 8
  runTest(state, draft => { applyHarm(draft, draft.investigators[0], 2, 0, []) },
    choices(pickOption(/【能力】护身法宝/), pickOption(/取消 2 伤害/)))
  const inv = state.investigators[0]
  assert.equal(inv.damage, 8, '2 点伤害全部被取消（未受到伤害）')
  assert.equal(inv.assets.some(item => item.id === talisman.id), false, '护身法宝被弃掉')
  assert.ok(inv.discard.includes('08116'), '进入弃牌堆')
})

test('P6 08116 护身法宝 伤害不足以击败你时不提供反应', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  asset(state, '08116')
  state.investigators[0].damage = 0
  let offered = false
  runTest(state, draft => { applyHarm(draft, draft.investigators[0], 1, 0, []) }, pending => {
    if (pending.kind !== 'reaction') return null
    if (/护身法宝/.test(String(pending.prompt || ''))) { offered = true; return 'trigger' }
    return null
  })
  assert.equal(offered, false, '伤害不足以击败时不提供护身法宝反应')
  assert.equal(state.investigators[0].damage, 1, '伤害正常结算')
})

// ---------------------------------------------------------------------------
// 08117 / 08119 尘世宁静
// ---------------------------------------------------------------------------

test('P6 08117 尘世宁静 每超过难度 1 点可花 1 充能治愈 1 伤害', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const serenity = asset(state, '08117', { uses: 4, usesType: 'charges' })
  state.investigators[0].damage = 3
  state.chaosBag = ['+3']
  move(state, { action: 'ability', assetId: serenity.id, abilityIndex: 0 })
  resolveChoices(state, pickOption(/治愈.+伤害/))
  const inv = state.investigators[0]
  assert.equal(inv.damage, 0, '治愈 3 点伤害')
  assert.equal(inv.assets.find(item => item.id === serenity.id).uses, 1, '每次治疗花费 1 充能')
})

test('P6 08117 尘世宁静 成功且等于难度时失去 1 资源', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const serenity = asset(state, '08117', { uses: 4, usesType: 'charges' })
  state.chaosBag = ['-2']
  const before = state.investigators[0].resources
  move(state, { action: 'ability', assetId: serenity.id, abilityIndex: 0 })
  resolveChoices(state)
  assert.equal(state.lastTestResult?.value, 1, '意志 3 - 2 = 1，成功且等于难度 1')
  assert.equal(state.investigators[0].resources, before - 1, '失去 1 资源')
})

test('P6 08119 尘世宁静 意志(0) 成功且等于难度时失去 2 资源', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const serenity = asset(state, '08119', { uses: 6, usesType: 'charges' })
  state.chaosBag = ['-3']
  const before = state.investigators[0].resources
  move(state, { action: 'ability', assetId: serenity.id, abilityIndex: 0 })
  resolveChoices(state)
  assert.equal(state.lastTestResult?.value, 0, '意志 3 - 3 = 0，成功且等于难度 0')
  assert.equal(state.investigators[0].resources, before - 2, '失去 2 资源')
})

// ---------------------------------------------------------------------------
// 08118 附魔弓
// ---------------------------------------------------------------------------

test('P6 08118 附魔弓 意志替代战斗：+1 技能值、+1 伤害并横置', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const bow = asset(state, '08118')
  enemy(state, { fight: 1, health: 20 })
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: bow.id, abilityIndex: 0 })
  resolveChoices(state, pickOption(/使用意志/))
  const inv = state.investigators[0]
  assert.equal(state.lastTestResult?.success, true)
  assert.equal(state.lastTestResult?.value, getStat(state, inv, 'willpower') + 1, '用意志代替战斗且 +1 技能值')
  assert.equal(state.enemies[0].damageTaken, 2, '本次攻击 +1 伤害（基础 1 + 1）')
  assert.equal(inv.assets.find(item => item.id === bow.id).exhausted, true, '横置附魔弓')
  assert.equal(inv.assets.find(item => item.id === bow.id).uses, 3, '同地点攻击不花费充能')
})

test('P6 08118 附魔弓 花 1 充能攻击连接地点的非精英敌人', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const bow = asset(state, '08118')
  state.locations = [{ id: 'a', name: 'A', revealed: true, connections: ['b'] },
    { id: 'b', name: 'B', revealed: true, connections: ['a'] }]
  state.investigators[0].location = 'a'
  const nearby = enemy(state, { location: 'b', elite: false, engagedSeat: null, fight: 1, health: 20 })
  const elite = enemy(state, { location: 'b', elite: true, engagedSeat: null, fight: 1, health: 20 })
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: bow.id, abilityIndex: 0 })
  resolveChoices(state, choices(pickOption(/测试敌人.*B|B/), pickOption(/使用敏捷/)))
  const inv = state.investigators[0]
  assert.equal(inv.assets.find(item => item.id === bow.id).uses, 2, '额外费用：花费 1 充能')
  assert.equal(state.enemies.find(item => item.id === nearby.id).damageTaken, 2, '+1 伤害')
  assert.equal(state.enemies.find(item => item.id === elite.id).damageTaken, 0, '精英不能作为连接目标')
})

// ---------------------------------------------------------------------------
// 08126 厚重皮衣
// ---------------------------------------------------------------------------

test('P6 08126 厚重皮衣 揭示符号标记后：自身受 1 伤害，取消并重抽', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const furs = asset(state, '08126')
  let context = null
  runTest(state, draft => {
    // 厚重皮衣的重抽发生在技能检定期间：给探针补一个进行中的检定上下文。
    draft.skillTest = { seat: 0, skill: 'willpower', difficulty: 1, committed: [], stage: 'ST.4', drawn: [] }
    context = { when: 'tokenEffectWouldResolve', seat: 0, location: draft.investigators[0].location, token: 'skull' }
    reactWindowProbe(draft, context)
  }, pickOption(/厚重皮衣/))
  const after = state.investigators[0].assets.find(item => item.id === furs.id)
  assert.equal(after.damage, 1, '对厚重皮衣造成 1 点伤害')
  assert.equal(context.rerollToken, true, '取消该标记并重抽')
})

test('P6 08126 厚重皮衣 自动失败与数字标记不提供反应', () => {
  for (const token of ['autofail', '+1']) {
    const state = fixture('01001')
    state.investigators[0].assets = []
    asset(state, '08126')
    let offered = false
    runTest(state, draft => {
      reactWindowProbe(draft, { when: 'tokenEffectWouldResolve', seat: 0, location: draft.investigators[0].location, token })
    }, pending => {
      if (/厚重皮衣/.test(JSON.stringify(pending.options))) { offered = true; return pending.options.find(item => /厚重皮衣/.test(String(item.label)))?.id }
      return null
    })
    assert.equal(offered, false, `${token} 不触发厚重皮衣`)
  }
})

// ---------------------------------------------------------------------------
// 08127 雪橇犬
// ---------------------------------------------------------------------------

test('P6 08127 雪橇犬 2 张共占 1 个盟友槽', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  asset(state, '08127')
  asset(state, '08127')
  assert.equal(slotUsage(state.investigators[0]).ally || 0, 1, '2 张雪橇犬只占 1 个盟友槽')
  asset(state, '08127')
  assert.equal(slotUsage(state.investigators[0]).ally || 0, 2, '3 张雪橇犬占 2 个盟友槽')
  assert.equal(registeredEntry('08127').sharedSlotGroup.upTo, 2)
})

test('P6 08127 雪橇犬 横置 X 张：移动 X 次', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const first = asset(state, '08127')
  const second = asset(state, '08127')
  state.locations = [{ id: 'a', name: 'A', revealed: true, connections: ['b'] },
    { id: 'b', name: 'B', revealed: true, connections: ['a'] }]
  state.investigators[0].location = 'a'
  move(state, { action: 'ability', assetId: first.id, abilityIndex: 0 })
  resolveChoices(state, choices(
    pickOption(/横置 2 张/),
    pickOption(/^B$|B/),
  ))
  const inv = state.investigators[0]
  assert.equal(inv.location, 'a', '移动 2 次（A→B→A）')
  assert.equal(inv.assets.filter(item => item.code === '08127').every(item => item.exhausted), true, '两张雪橇犬都横置')
})

test('P6 08127 雪橇犬 横置 X 张：攻击 +X 战斗并造成 X 点伤害', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  asset(state, '08127')
  asset(state, '08127')
  const target = enemy(state, { fight: 1, health: 20 })
  state.chaosBag = ['0']
  const combatBase = getStat(state, state.investigators[0], 'combat')
  move(state, { action: 'ability', assetId: state.investigators[0].assets[0].id, abilityIndex: 1, targetId: target.id })
  resolveChoices(state, pickOption(/横置 2 张/))
  assert.equal(state.lastTestResult?.value, combatBase + 2, '+2 战斗')
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 2, '不造成基础伤害，改为 2 点伤害')
})

// ---------------------------------------------------------------------------
// 08128 驯兽之杖
// ---------------------------------------------------------------------------

test('P6 08128 驯兽之杖 2 个生物专用盟友槽 + 自己回合打出生物费用 -1', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  asset(state, '08128')
  asset(state, '01076') // 野猫：[[盟友]]、[[生物]]
  asset(state, '01076')
  const inv = state.investigators[0]
  assert.deepEqual(registeredEntry('08128').restrictedSlots, [{ slot: 'ally', traitsAny: ['Creature'], count: 2 }])
  // 2 只生物占用 2 个专用盟友槽；普通盟友槽仍空，所以第 3 只生物可以进普通槽。
  assert.equal(canEquip(inv, ALL_CARDS['01076']), true, '第 3 只生物可用普通盟友槽')
  assert.equal(canEquip(inv, ALL_CARDS['10062']), true, '普通盟友槽仍然可用（非生物）')
  asset(state, '01076')
  assert.equal(canEquip(inv, ALL_CARDS['01076']), false, '2 专用槽 + 1 普通槽已满，第 4 只生物不能上场')
  assert.equal(canEquip(inv, ALL_CARDS['10062']), false, '非生物盟友槽已被生物占满')
  // 费用 -1：只在自己回合、只对[[生物]]支援。
  state.currentSeat = 0
  assert.equal(playCostDelta(state, inv, '08127'), -1, '自己回合打出生物支援费用 -1')
  assert.equal(playCostDelta(state, inv, '10062'), 0, '非生物支援不减费')
  state.currentSeat = 1
  assert.equal(playCostDelta(state, inv, '08127'), 0, '不是自己回合不减费')
})

// ---------------------------------------------------------------------------
// 08129 请求支援
// ---------------------------------------------------------------------------

test('P6 08129 请求支援 按控制的职阶依次结算：伤害/线索/治疗', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  asset(state, '10019') // 守卫者
  asset(state, '10040') // 探求者
  asset(state, '10084') // 神秘学者
  // asset 帮助器用实例 code 读卡面；这里把真实职阶卡实例的 code 保持为卡号。
  const target = enemy(state, { health: 10 })
  state.locations.find(item => item.id === state.investigators[0].location).clues = 2
  state.investigators[0].horror = 1
  resolvePlayed(state, '08129', {
    choose: pending => {
      const option = pending.options.find(item => /guardian|seeker|mystic/.test(String(item.id)))
      if (option) return option.id
      return null
    },
  })
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 1, '守卫者：对敌人造成 1 点伤害')
  assert.equal(state.locations.find(item => item.id === state.investigators[0].location).clues, 1, '探求者：发现 1 个线索')
  assert.equal(state.investigators[0].horror, 0, '神秘学者：治愈任意卡牌 1 点恐惧')
})

// ---------------------------------------------------------------------------
// 08112 「再来一张！」
// ---------------------------------------------------------------------------

test('P6 08112 再来一张！ 额外揭示 1 枚标记：负值取正结算；骷髅则自动失败', () => {
  const resolveWithToken = token => {
    const state = fixture('01001')
    state.investigators[0].assets = []
    state.investigators[0].hand = ['08112']
    state.skillTest = { seat: 0, skill: 'willpower', difficulty: 1, committed: [], stage: 'ST.4', drawn: [] }
    state.chaosBag = [token]
    const context = { when: 'tokenReveal', seat: 0, token: '0' }
    const descriptor = registeredEntry('08112').abilities.find(ability => ability.kind === 'played')
    runTest(state, draft => executeDescriptor(draft, {
      inv: draft.investigators[0], source: { id: 'probe:08112', code: '08112' }, descriptor, events: [],
      context, silent: false,
    }))
    return context
  }
  // 额外揭示的标记为 -2：取正后作为替代标记（+2）。
  assert.equal(resolveWithToken('-2').replacementToken, '+2', '负值取正：-2 → +2')
  // 额外揭示的标记为骷髅：改为自动失败。
  assert.equal(resolveWithToken('skull').replacementToken, 'autofail', '骷髅 → 自动失败')
})

// ---------------------------------------------------------------------------
// 08113 大肆借贷
// ---------------------------------------------------------------------------

test('P6 08113 大肆借贷 打出后获得 10 资源；轮末资源 <10 时流放自身', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const loan = asset(state, '08113')
  state.investigators[0].resources = 0
  runTest(state, draft => reactWindowProbe(draft, {
    when: 'assetEnteredPlay', seat: 0, assetCode: '08113', assetId: loan.id,
  }), pickOption(/【能力】大肆借贷/))
  assert.equal(state.investigators[0].resources, 10, '打出后获得 10 资源')
  // 资源不足 10：轮末强制流放（近似窗口）。
  state.investigators[0].resources = 5
  runTest(state, draft => reactWindowProbe(draft, { when: 'roundEnds', round: draft.round }))
  const inv = state.investigators[0]
  assert.equal(inv.assets.some(item => item.id === loan.id), false, '大肆借贷已离场')
  assert.ok((state.removedFromGame || []).includes('08113'), '被流放（移出游戏）')
  // 资源足够 10 时轮末不流放。
  const rich = fixture('01001')
  rich.investigators[0].assets = []
  asset(rich, '08113')
  rich.investigators[0].resources = 10
  runTest(rich, draft => reactWindowProbe(draft, { when: 'roundEnds', round: draft.round }))
  assert.equal(rich.investigators[0].assets.some(item => item.code === '08113'), true, '资源 ≥10 时不流放')
})

// ---------------------------------------------------------------------------
// 08120–08124 天赋（轮初补满 + 特性检定 +1 + 支付近似）
// ---------------------------------------------------------------------------

// 五张天赋共用同一模板：轮初补满 2 资源；在指定特性卡的技能检定期间花 1 资源换 +1 技能值。
function talentBehavior(code, testSourceCode, cardName) {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const talent = asset(state, code)
  talent.uses = 0
  runTest(state, draft => reactWindowProbe(draft, { when: 'roundStarts', round: draft.round }))
  assert.equal(state.investigators[0].assets.find(item => item.id === talent.id).uses, 2, `${code} 轮初补满 2 资源`)
  state.chaosBag = ['0']
  const base = getStat(state, state.investigators[0], 'willpower')
  let usedOnce = false
  runTest(state, draft => {
    performTest(draft, 0, 'willpower', 1, { source: { code: testSourceCode, label: '特性检定' } })
  }, pending => {
    if (usedOnce) return null
    const option = pending.options.find(item => String(item.label || '').includes(cardName))
    if (!option) return null
    usedOnce = true
    return option.id
  })
  assert.equal(state.lastTestResult?.value, base + 1, `${code} 花 1 资源使本次检定 +1`)
  assert.equal(state.investigators[0].assets.find(item => item.id === talent.id).uses, 1, `${code} 花费 1 资源`)
}

test('P6 08120 先知先觉 轮初补满 + Spell 检定 +1；近似支付减费', () => {
  talentBehavior('08120', '01061', '先知先觉')
  // 近似支付：从本卡资源减费打出 [[Spell]] 支援（01061 探知术，费用 1）。
  const state = fixture('01001')
  state.investigators[0].assets = []
  const talent = asset(state, '08120')
  state.investigators[0].hand = ['01061']
  state.investigators[0].resources = 1
  move(state, { action: 'play', cardId: '01061' })
  resolveChoices(state, pending => {
    const spend = pending.options.find(option => String(option.label || '') === '花费 1 资源')
    if (spend) return spend.id
    return pending.options.find(option => String(option.label || '').includes('【能力】先知先觉'))?.id ?? null
  })
  const inv = state.investigators[0]
  assert.equal(inv.assets.find(item => item.id === talent.id).uses, 1, '支付时花费 1 点本卡资源')
  assert.equal(inv.resources, 1, '资源没有从资源池扣除（以本卡资源抵费）')
  assert.ok(inv.assets.some(item => item.code === '01061'), '探知术已打出')
})

test('P6 08121 一探究竟 轮初补满 + Tome 检定 +1', () => {
  talentBehavior('08121', '01035', '一探究竟')
})

test('P6 08122 好勇斗狠 轮初补满 + Melee 检定 +1', () => {
  talentBehavior('08122', '01020', '好勇斗狠')
})

test('P6 08123 技艺精湛 轮初补满 + Tool 检定 +1', () => {
  talentBehavior('08123', '10005', '技艺精湛')
})

test('P6 08124 古物藏家 轮初补满 + Favor 检定 +1', () => {
  talentBehavior('08124', '08046', '古物藏家')
})

// ---------------------------------------------------------------------------
// 08125 危险处境
// ---------------------------------------------------------------------------

test('P6 08125 危险处境 setup：一次性 2 点创伤 + 3 经验', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const descriptor = registeredEntry('08125').abilities.find(ability => ability.kind === 'setup')
  const resolveSetup = draft => executeDescriptor(draft, {
    inv: draft.investigators[0], source: { id: 'probe:08125', code: '08125' }, descriptor, events: [], silent: true,
  })
  runTest(state, resolveSetup, pickOption(/2 点肉体创伤/))
  const inv = state.investigators[0]
  assert.equal(state.campaign.trauma[0].physical, 2, '承受 2 点肉体创伤')
  assert.equal(inv.scenarioXpBonus || 0, 3, '取得 3 点额外经验')
  assert.ok((state.campaign.records?.inTheThickOfItPurchased || []).includes(inv.code), '购买记录写入战役记录集合')
  // 跨场不重复结算。
  runTest(state, resolveSetup)
  assert.equal(state.campaign.trauma[0].physical, 2, '第二次 setup 不重复创伤')
  assert.equal(inv.scenarioXpBonus || 0, 3, '第二次 setup 不重复经验')
})

// ---------------------------------------------------------------------------
// 08130–08133 基础弱点（威胁区 + 行动后锁；恐惧侧复用 threatHorrorSink）
// ---------------------------------------------------------------------------

// 从牌库顶抽取弱点 → 引擎走 resolveWeakness 放进威胁区。
function revealWeakness(state, code) {
  state.investigators[0].deck = [code]
  runTest(state, draft => { drawCards(draft, draft.investigators[0], 1, []) })
  return state.investigators[0].threat.find(card => card.code === code) || null
}

function lockAfterAction(state, code) {
  runTest(state, draft => reactWindowProbe(draft, {
    when: 'actionResolvedAtLocation', seat: 0, location: draft.investigators[0].location,
  }))
  const inv = state.investigators[0]
  assert.equal((state.effects || []).some(effect => effect.sourceCode === code && effect.duration === 'endOfTurn'), true,
    `${code} 写入回合末到期的锁定效果`)
  return inv
}

test('P6 08130 臂伤 显现入威胁区；如同 1 点伤害被治愈（threatDamageSink）；行动后本回合不能攻击/启动', () => {
  // 治愈：真实治疗伤害入口 healDamageFrom（api.healDamage 的统一实现）先扣威胁卡 counters，归零弃卡。
  const healState = fixture('01001')
  healState.investigators[0].assets = []
  const healCard = revealWeakness(healState, '08130')
  assert.ok(healCard, '臂伤进入威胁区')
  assert.equal(healCard.counters, 1, '1 点伤害计数器')
  assert.equal(registeredEntry('08130').flags?.threatDamageSink, true, '声明 threatDamageSink 读点')
  const invDamageBefore = healState.investigators[0].damage
  let healed = 0
  runTest(healState, draft => { healed = healDamageFrom(draft, draft.investigators[0], 1, [], { log: false }) })
  const healedInv = healState.investigators[0]
  assert.equal(healed, 1, '治疗 1 点伤害承接在臂伤上（修复前返回 0）')
  assert.equal(healedInv.threat.some(item => item.code === '08130'), false, '治满后弃掉臂伤')
  assert.equal(healedInv.discard.includes('08130'), true, '臂伤进入弃牌堆')
  assert.equal(healedInv.damage, invDamageBefore, '调查员自身伤害不受影响')

  // 行动后锁：另一份臂伤在场时，真实 actionResolvedAtLocation 窗口写回合末锁定效果。
  const state = fixture('01001')
  state.investigators[0].assets = []
  assert.ok(revealWeakness(state, '08130'), '臂伤进入威胁区')
  const inv = lockAfterAction(state, '08130')
  assert.equal(capabilityBlocked(state, inv, 'fight'), true, '本回合不能攻击')
  assert.equal(capabilityBlocked(state, inv, 'triggerAbilities'), true, '本回合不能启动能力')
})

test('P6 08131 腿伤 显现入威胁区；如同 1 点伤害被治愈（threatDamageSink）；行动后本回合不能移动/撤退/躲避', () => {
  const healState = fixture('01001')
  healState.investigators[0].assets = []
  assert.ok(revealWeakness(healState, '08131'), '腿伤进入威胁区')
  assert.equal(registeredEntry('08131').flags?.threatDamageSink, true, '声明 threatDamageSink 读点')
  const invDamageBefore = healState.investigators[0].damage
  let healed = 0
  runTest(healState, draft => { healed = healDamageFrom(draft, draft.investigators[0], 1, [], { log: false }) })
  const healedInv = healState.investigators[0]
  assert.equal(healed, 1, '治疗 1 点伤害承接在腿伤上')
  assert.equal(healedInv.threat.some(item => item.code === '08131'), false, '治满后弃掉腿伤')
  assert.equal(healedInv.damage, invDamageBefore, '调查员自身伤害不受影响')

  const state = fixture('01001')
  state.investigators[0].assets = []
  assert.ok(revealWeakness(state, '08131'), '腿伤进入威胁区')
  const inv = lockAfterAction(state, '08131')
  assert.equal(capabilityBlocked(state, inv, 'move'), true)
  assert.equal(capabilityBlocked(state, inv, 'resign'), true)
  assert.equal(capabilityBlocked(state, inv, 'evade'), true)
})

test('P6 08132 惊慌 显现入威胁区；可如同 1 点恐惧被治愈（threatHorrorSink）', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const card = revealWeakness(state, '08132')
  assert.ok(card, '惊慌进入威胁区')
  assert.equal(card.counters, 1, '1 点恐惧计数器')
  assert.equal(registeredEntry('08132').threatHorrorSink, true)
  // 行动后锁：本回合不能打出/获得资源/交战。
  const inv2 = lockAfterAction(state, '08132')
  assert.equal(capabilityBlocked(state, inv2, 'play'), true)
  assert.equal(capabilityBlocked(state, inv2, 'gainResources'), true)
  // 治疗自己 1 点恐惧时改为治愈本卡（可选），治满后弃掉。
  state.investigators[0].horror = 1
  runTest(state, draft => {
    healHorrorFrom(draft, draft.investigators[0], 1, [], { healerSeat: 0 })
  }, pending => pending.options.find(option => option.id === 'redirect')?.id ?? null)
  const inv = state.investigators[0]
  assert.equal(inv.horror, 1, '治疗被改道到惊慌上（未治疗调查员）')
  assert.equal(inv.threat.some(item => item.code === '08132'), false, '治满后弃掉惊慌')
})

test('P6 08133 麻木 显现入威胁区；可如同 1 点恐惧被治愈；行动后不能谈判/抽取/调查', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const card = revealWeakness(state, '08133')
  assert.ok(card, '麻木进入威胁区')
  const inv = lockAfterAction(state, '08133')
  assert.equal(capabilityBlocked(state, inv, 'parley'), true)
  assert.equal(capabilityBlocked(state, inv, 'draw'), true)
  assert.equal(capabilityBlocked(state, inv, 'investigate'), true)
})

// ---------------------------------------------------------------------------
// 分片完整性守卫
// ---------------------------------------------------------------------------

test('P6 M2-4 分片：已实现卡片全部注册且 code 与文件名一致', () => {
  assert.equal(CODES.length, 25, 'M2-4 分片固定 25 张')
  for (const code of CODES) {
    if (BLOCKED.includes(code)) continue
    const entry = registeredEntry(code)
    assert.ok(entry, `${code} 未注册`)
    assert.equal(entry.code, code)
  }
})
