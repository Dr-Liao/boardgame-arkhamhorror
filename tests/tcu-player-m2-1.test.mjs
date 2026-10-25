// 万象无终（第四循环）M2 玩家卡 · M2-1 分片逐卡验收 —— P7。
//
// 本文件覆盖 `artifacts/migration/tcu/shards.json` 的 M2-1 分片（22 张，05020–05041）。
// 每张卡至少一条真实行为测试，测试名以 `TCU <code> <中文名>` 开头；纯数据通道的卡
// 也至少有一条可执行断言（见 P7-WORKER-BRIEF §3）。
//
// 约定：
//   · 每次 applyMove 后引擎替换调查员对象，断言前重新从 state 读取；
//   · 需要直接发起检定/伤害（不走 action 入口）时用 runTest 在规则事务里执行，
//     与 tests/card-lifecycle.test.mjs 的骨架一致。

import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, asset, enemy, settle, use, decisionSeat, legalMoves, validateMove } from './core-fixture.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { registeredEntry, descriptorsInEntry } from '../src/engine/ability.js'
import {
  actionPreview, applyHarm, commitIcons, descriptorUsable, drawCards, enterOpeningHandCards, executeDescriptor,
  getMaxHealth, getMaxSanity, getStat, performTest,
} from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { tarotSlotUsage, TAROT_SLOT } from '../src/engine/tarot-slot.js'

const codes = [
  '05020', '05021', '05022', '05023', '05024', '05025', '05026', '05027', '05028', '05029', '05030',
  '05031', '05032', '05033', '05034', '05035', '05036', '05037', '05038', '05039', '05040', '05041',
]
assert.equal(codes.length, 22, 'M2-1 分片固定 22 张')

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

// 在规则事务里执行一段直接调用引擎的代码，并把待决选择走完。
function runTest(state, execute, choose = () => null) {
  resolveTransaction(state, decisionSeat(state) ?? 0, { action: 'lifecycleProbe' }, execute)
  for (let index = 0; state.pendingChoice && index < 80; index++) {
    const pending = state.pendingChoice
    const chosen = choose(pending)
      ?? ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    assert.ok(chosen != null, `待决选择没有可选项：${JSON.stringify(pending)}`)
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: chosen }, execute)
  }
}

// 把待决选择逐个点掉（可自定义选择）。
function resolveChoices(state, choose = () => null, limit = 80) {
  for (let index = 0; state.pendingChoice && index < limit; index++) {
    const pending = state.pendingChoice
    const chosen = choose(pending)
      ?? ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    assert.ok(chosen != null, `待决选择没有可选项：${JSON.stringify(pending)}`)
    move(state, { action: 'choose', choiceId: pending.id, optionId: chosen })
  }
}

// study(默认地点) + 阁楼。
function twoLocations(state) {
  state.locations[0].connections = ['attic']
  state.locations.push({ id: 'attic', name: '阁楼', clues: 2, shroud: 1, connections: ['study'], revealed: true })
  return [state.locations[0], state.locations.find(location => location.id === 'attic')]
}

// study + 阁楼 + 地窖（阁楼两边连通）。
function threeLocations(state) {
  const [study, attic] = twoLocations(state)
  attic.connections = ['study', 'cellar']
  state.locations.push({ id: 'cellar', name: '地窖', clues: 0, shroud: 1, connections: ['attic'], revealed: true })
  return [study, attic, state.locations.find(location => location.id === 'cellar')]
}

// 用一张技能卡做一次投入，返回检定结果（用于 commit 档案类的卡）。
function commitCardOnce(code, skill) {
  const state = fixture('01001')
  state.investigators[0].hand = [code]
  state.chaosBag = ['0']
  let result = null
  runTest(state, draft => { result = performTest(draft, 0, skill, 0, {}) }, pending => {
    if (pending.kind !== 'commit') return null
    const option = pending.options.find(item => String(item.label).startsWith('投入：'))
    return option ? option.id : pending.options.find(item => item.id === 'done')?.id ?? null
  })
  return { state, result }
}

// 旧的 P2.9 自动放置钩子：审计 R2 后塔罗条目不再声明 entersPlayFromOpeningHand，
// 这个读点必须返回空（自动放置发生在 scenarioStarts 窗口之前，会吞掉可选性）。
function openingHandAutoPlacement(code) {
  const state = fixture('01001')
  state.investigators[0].hand = [code, '01088']
  const placed = enterOpeningHandCards(state, state.investigators[0], {
    lookup: target => registeredEntry(target),
    createAsset: (target, owner, placedCode) => ({ id: 'placed-' + placedCode, code: placedCode, exhausted: false }),
  })
  return { state, placed }
}

// 开局入场的真实读点：setup 在 scenarioStarts 用 openAbilityWindow 询问手牌里的 [reaction]。
// 这里复用同一份窗口收集读点（descriptorsInEntry + descriptorUsable）后执行该描述子；
// placed 记录「确实结算了」，offered 记录「窗口会提供这个反应」。skip=true 时只验证提供、不结算。
function scenarioStartsPlacement(code, { preplaced = [], skip = false } = {}) {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.hand = [code, '01088']
  inv.assets = []
  for (const target of preplaced) asset(state, target)
  const placed = []
  let offered = false
  runTest(state, draft => {
    const current = draft.investigators[0]
    const context = { when: 'scenarioStarts' }
    const candidates = descriptorsInEntry(registeredEntry(code), 'scenarioStarts', 'reaction')
      .filter(descriptor => descriptor.fromHand
        && descriptorUsable(draft, current, null, descriptor, { windowId: 'scenarioStarts', context }))
    offered = candidates.length > 0
    if (!candidates.length || skip) return
    placed.push(code)
    executeDescriptor(draft, { inv: current, source: null, descriptor: candidates[0], context,
      events: [], windowId: 'scenarioStarts', fromHandIndex: current.hand.indexOf(code) })
  })
  return { state, placed, offered }
}

// ---------------------------------------------------------------------------
// 05020 拷问
// ---------------------------------------------------------------------------

test('TCU 05020 拷问 谈判战斗检定：难度=3+敌人伤害，成功发现两处线索', () => {
  const state = fixture('01001')
  const [study, attic] = twoLocations(state)
  study.clues = 1
  attic.shroud = 0
  attic.clues = 1
  // 类人敌人，伤害 2 → 难度 3+2=5；战斗 4 + 符号 +2 = 6 成功。
  enemy(state, { traits: ['Humanoid'], damage: 2 })
  state.chaosBag = ['+2']
  const resourcesBefore = state.investigators[0].resources
  state.investigators[0].hand = ['05020']
  // 「谈判」不引发借机攻击：打出预览里不应列出已交战敌人的借机攻击。
  const preview = actionPreview(state, 0, { action: 'play', cardId: '05020' })
  assert.deepEqual(preview.opportunityAttacks, [], '谈判事件不引发借机攻击')
  move(state, { action: 'play', cardId: '05020' })
  resolveChoices(state, pending => {
    const enemyOption = pending.options.find(item => /测试敌人/.test(String(item.label)))
    return enemyOption ? enemyOption.id : null
  })
  const inv = state.investigators[0]
  assert.equal(state.lastTestResult?.difficulty, 5, '难度应为 3 + 敌人伤害值')
  assert.equal(state.lastTestResult?.success, true)
  assert.equal(state.locations.find(location => location.id === 'study').clues, 0, '发现所在地点 1 个线索')
  assert.equal(state.locations.find(location => location.id === 'attic').clues, 0, '发现任意另一个地点 1 个线索')
  assert.equal(inv.clues, 2)
  assert.equal(inv.resources, resourcesBefore - 2, '打出费用 2 资源')
  // 修复（审计 R2）：没有合法[[类人]]目标时不能打出。
  const bare = fixture('01001')
  bare.investigators[0].hand = ['05020']
  enemy(bare, { traits: ['Humanoid'], location: 'attic' })
  assert.match(String(validateMove(bare, 0, { action: 'play', cardId: '05020' })), /类人/,
    '同地点没有[[类人]]敌人时打出被拒绝')
})

// ---------------------------------------------------------------------------
// 05021 劫数延后（显式简化：只附属自己 / 神话结束直接弃置；investigator 附属待引擎修通）
// ---------------------------------------------------------------------------

// 神话阶段结束窗口：直接开窗驱动 forced mythosEnd（turn.js 只在有候选时开同一窗口）：
// 门控同时扫 inv.assets 与 inv.attachments（R7 修复），source 也按两处查找。
function runMythosEndWindow(state, choose, seat = 0) {
  runTest(state, draft => {
    const inv = draft.investigators[seat]
    const descriptor = descriptorsInEntry(registeredEntry('05021'), 'mythosEnd', 'forced')[0]
    const source = [...(inv.assets || []), ...(inv.attachments || [])].find(item => item.code === '05021')
    executeDescriptor(draft, {
      inv, source, descriptor, events: [],
      context: { when: 'mythosEnd', seat, location: inv.location },
    })
  }, choose)
}

test('TCU 05021 劫数延后 快速打出可附属同地点队友；受伤害/恐惧时弃掉并真实离场', () => {
  const state = fixture('01001', 2)
  // 两个座位都设为「人类」座位：否则非当前座位的可选反应会被引擎按 AI 自动跳过。
  state.humanSeats = [0, 1]
  const [first] = state.investigators
  first.hand = ['05021']
  move(state, { action: 'play', cardId: '05021' })
  resolveChoices(state, pending => {
    const option = pending.options.find(item => String(item.id) === 'seat:1')
    if (option) return option.id
    return null
  })
  const host = state.investigators[1]
  const attachment = (host.attachments || []).find(item => item.code === '05021')
  assert.ok(attachment, '可附属到同地点队友')
  assert.equal(attachment.ownerSeat, 0, '置于打出者拥有、宿主控制')
  assert.equal(host.assets.some(item => item.code === '05021'), false, '不在宿主的 assets 区')

  // 宿主受到 2 伤害 + 1 恐惧：反应弃掉自身并取消该次全部伤害/恐惧。
  runTest(state, draft => { applyHarm(draft, draft.investigators[1], 2, 1, []) }, pending => {
    const option = pending.options.find(item => /劫数延后/.test(String(item.label)))
    return option ? option.id : null
  })
  const after = state.investigators[1]
  assert.equal(after.damage, 0, '刚受到的伤害被取消')
  assert.equal(after.horror, 0, '刚受到的恐惧被取消')
  assert.equal((after.attachments || []).some(item => item.code === '05021'), false, '反应后真实从附属离场')
  assert.ok(state.investigators.some(item => item.discard.includes('05021')), '进所有者弃牌堆')
})

test('TCU 05021 劫数延后 神话阶段结束：资源≥2 可支付保留（附属来源）', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.attachments = [{ id: 'att-5021', code: '05021', ownerSeat: 0 }]
  inv.resources = 5
  let asked = false
  runMythosEndWindow(state, pending => {
    if (pending.options.some(option => option.id === 'pay')) { asked = true; return 'pay' }
    return null
  })
  assert.equal(asked, true, '资源≥2 时应询问「花费 2 资源 / 弃掉」')
  assert.equal(state.investigators[0].resources, 3, '花费 2 资源')
  assert.ok((state.investigators[0].attachments || []).some(item => item.code === '05021'), '劫数延后留在场上')
})

test('TCU 05021 劫数延后 神话阶段结束：资源不足或选择弃掉时弃掉附属', () => {
  const poor = fixture('01001')
  poor.investigators[0].attachments = [{ id: 'att-poor', code: '05021', ownerSeat: 0 }]
  poor.investigators[0].resources = 1
  runMythosEndWindow(poor, () => null)
  assert.equal((poor.investigators[0].attachments || []).some(item => item.code === '05021'), false, '资源<2 直接弃掉')
  assert.ok(poor.investigators[0].discard.includes('05021'))

  const choose = fixture('01001')
  choose.investigators[0].attachments = [{ id: 'att-choose', code: '05021', ownerSeat: 0 }]
  choose.investigators[0].resources = 5
  runMythosEndWindow(choose, pending => (pending.options.some(option => option.id === 'discard') ? 'discard' : null))
  assert.equal((choose.investigators[0].attachments || []).some(item => item.code === '05021'), false, '选择弃掉时弃掉')
  assert.equal(choose.investigators[0].resources, 5, '选择弃掉不花资源')
})

// ---------------------------------------------------------------------------
// 05022 / 05026 / 05030 / 05034 / 05038 条件技能图标（P7 条件图标原语）
// ---------------------------------------------------------------------------

test('TCU 05022 坚定不移 剩余生命+神志 ≥5 / ≥10 时追加意志与战斗图标', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  // 满血满神志：9+5=14 ≥10 → 印刷 1/1 + 条件 2/2。
  assert.equal(commitIcons(state, inv, '05022', 'willpower'), 3)
  assert.equal(commitIcons(state, inv, '05022', 'combat'), 3)
  inv.damage = 6 // 剩 3+5=8：≥5 但 <10 → 印刷 1 + 条件 1
  assert.equal(commitIcons(state, inv, '05022', 'willpower'), 2)
  inv.damage = 8
  inv.horror = 4 // 剩 1+1=2：<5 → 只有印刷 1 个图标
  assert.equal(commitIcons(state, inv, '05022', 'willpower'), 1)
  // 真实投入：满状态下投入，检定值 = 意志 3 + 印刷 1 + 条件 2 = 6。
  const { result } = commitCardOnce('05022', 'willpower')
  assert.equal(result?.value, 6)
})

test('TCU 05026 好奇心 手牌 ≥4 / ≥7 时追加意志与智识图标', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.hand = []
  assert.equal(commitIcons(state, inv, '05026', 'willpower'), 1)
  inv.hand = Array(4).fill('01088')
  assert.equal(commitIcons(state, inv, '05026', 'willpower'), 2)
  inv.hand = Array(7).fill('01088')
  assert.equal(commitIcons(state, inv, '05026', 'willpower'), 3)
  assert.equal(commitIcons(state, inv, '05026', 'intellect'), 3)
})

test('TCU 05030 狡猾 资源 ≥5 / ≥10 时追加智识与敏捷图标', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.resources = 0
  assert.equal(commitIcons(state, inv, '05030', 'intellect'), 1)
  inv.resources = 5
  assert.equal(commitIcons(state, inv, '05030', 'intellect'), 2)
  inv.resources = 10
  assert.equal(commitIcons(state, inv, '05030', 'agility'), 3)
})

test('TCU 05034 预见未来 场上毁灭 ≥3 / ≥6 时追加万能图标', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  state.doom = 0
  assert.equal(commitIcons(state, inv, '05034', 'willpower'), 1)
  state.doom = 3
  assert.equal(commitIcons(state, inv, '05034', 'willpower'), 2)
  state.doom = 6
  assert.equal(commitIcons(state, inv, '05034', 'combat'), 3)
})

test('TCU 05038 体格强健 控制[[道具]] ≤2 / ≤1 时追加战斗与敏捷图标', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  assert.equal(commitIcons(state, inv, '05038', 'combat'), 3, '没有道具：≤1 档')
  asset(state, '01020') // 砍刀 [[道具]]
  asset(state, '01016') // .45 自动手枪 [[道具]]
  assert.equal(commitIcons(state, state.investigators[0], '05038', 'combat'), 2, '2 张道具：≤2 档')
  asset(state, '01044') // 弹簧刀 [[道具]]
  assert.equal(commitIcons(state, state.investigators[0], '05038', 'combat'), 1, '3 张道具：只有印刷图标')
})

// ---------------------------------------------------------------------------
// 05023 宝剑王牌（塔罗槽；已有样本复核）
// ---------------------------------------------------------------------------

test('TCU 05023 宝剑王牌 塔罗槽 +1 战斗；开局 [reaction] 可选放置入场', () => {
  const state = fixture('01001')
  const combatBefore = getStat(state, state.investigators[0], 'combat')
  asset(state, '05023')
  assert.equal(getStat(state, state.investigators[0], 'combat'), combatBefore + 1, '卡面：你得到 +1[combat]')
  assert.equal(tarotSlotUsage(state.investigators[0], code => ALL_CARDS[code]), 1, '宝剑王牌占 1 个塔罗槽')
  assert.equal(TAROT_SLOT, 'tarot')
  // 审计 R2：不再保留引擎自动放置钩子（自动放置会吞掉 [reaction] 的可选性、也不校验槽位）。
  assert.notEqual(registeredEntry('05023').entersPlayFromOpeningHand, true, '条目不再声明自动放置')
  assert.deepEqual(openingHandAutoPlacement('05023').placed, [], '旧自动放置读点不再放任何牌')

  // 开局窗口里的 [reaction]：可以选择放置入场。
  const { state: opening, placed } = scenarioStartsPlacement('05023')
  assert.deepEqual(placed, ['05023'], '开局窗口提供并结算放置入场')
  assert.deepEqual(opening.investigators[0].hand, ['01088'], '放置后离开起始手牌')
  assert.deepEqual(opening.investigators[0].assets.map(item => item.code), ['05023'], '放入场上')

  // 「可以」= 可选：跳过反应时保留在起始手牌。
  const { state: kept, offered } = scenarioStartsPlacement('05023', { skip: true })
  assert.equal(offered, true, '窗口会询问 [reaction]')
  assert.deepEqual(kept.investigators[0].hand, ['05023', '01088'], '跳过反应时保留在手牌')
  assert.equal(kept.investigators[0].assets.length, 0, '没有自动入场')
})

test('TCU 05023 宝剑王牌 塔罗槽已满时开局 [reaction] 不放置入场（保留手牌）', () => {
  // 场上已有 1 张塔罗（capacity=1、usage=1 → free=0）。
  const { state, placed } = scenarioStartsPlacement('05023', { preplaced: ['05027'] })
  assert.deepEqual(placed, ['05023'], '窗口仍询问 [reaction]')
  const inv = state.investigators[0]
  assert.equal(inv.hand.includes('05023'), true, '槽满：保留在手牌')
  assert.equal(inv.assets.some(item => item.code === '05023'), false, '槽满：不放入场')
  assert.ok(state.log.some(line => String(line).includes('塔罗槽已满')), '给出槽满提示')
})

// ---------------------------------------------------------------------------
// 05024 指纹采集工具
// ---------------------------------------------------------------------------

test('TCU 05024 指纹采集工具 横置花补给调查：+1 智识且成功额外发现 1 线索', () => {
  const state = fixture('01001')
  const kit = asset(state, '05024')
  assert.equal(kit.uses, 3, '使用(3 补给)')
  state.locations[0].clues = 2
  // 01001 的智识为 3：帷幕设 4，只有本次调查的 +1 智识才能让检定成功。
  state.locations[0].shroud = 4
  state.chaosBag = ['0']
  use(state, kit)
  resolveChoices(state)

  const inv = state.investigators[0]
  assert.equal(state.lastTestResult?.success, true, '3+1 智识对难度 4 应成功')
  assert.equal(state.locations[0].clues, 0, '两个线索都被发现')
  assert.equal(inv.clues, 2, '基础 1 个 + 卡面额外 1 个')
  const after = inv.assets.find(item => item.code === '05024')
  assert.equal(after.uses, 2, '消耗 1 补给')
  assert.equal(after.exhausted, true, '调查需要横置')
})

test('TCU 05024 指纹采集工具 补给耗尽后弃置且不能再使用', () => {
  const state = fixture('01001')
  const kit = asset(state, '05024', { uses: 1 })
  state.locations[0].clues = 1
  state.chaosBag = ['0']
  use(state, kit)
  resolveChoices(state)
  const inv = state.investigators[0]
  assert.equal(inv.assets.some(item => item.code === '05024'), false, '用尽后弃置')
  assert.ok(inv.discard.includes('05024'))
})

// ---------------------------------------------------------------------------
// 05025 串联线索（已有样本复核）
// ---------------------------------------------------------------------------

test('TCU 05025 串联线索 发现最后线索后从手牌反应：发现低隐藏值地点 2 线索', () => {
  const state = fixture('01001')
  const [study, attic] = twoLocations(state)
  study.clues = 1
  study.shroud = 2
  attic.shroud = 0
  attic.clues = 2
  // 隐藏值更高的第三个地点：不应被选中。
  state.locations.push({ id: 'cellar', name: '地窖', clues: 1, shroud: 5, connections: [], revealed: true })
  state.investigators[0].hand = ['05025']
  state.chaosBag = ['0']
  const resourcesBefore = state.investigators[0].resources
  move(state, { action: 'investigate' })
  resolveChoices(state, pending => {
    if (pending.kind === 'commit') return pending.options.find(option => option.id === 'done')?.id
    const ability = pending.options.find(option => /串联线索/.test(String(option.label)))
    return ability ? ability.id : null
  })
  const inv = state.investigators[0]
  assert.equal(state.locations.find(location => location.id === 'study').clues, 0, '发现所在地点最后一个线索')
  assert.equal(state.locations.find(location => location.id === 'attic').clues, 0, '低隐藏值地点的 2 个线索被全部发现')
  assert.equal(state.locations.find(location => location.id === 'cellar').clues, 1, '隐藏值更高的地点不受影响')
  assert.equal(inv.clues, 3)
  assert.equal(inv.resources, resourcesBefore - 4, '打出费用 4 资源')
  assert.ok(inv.discard.includes('05025'))
  // 修复（审计 R2）：只能在发现最后线索后的反应窗口打出，不能当普通事件用行动打出。
  state.investigators[0].hand = ['05025']
  assert.match(String(validateMove(state, 0, { action: 'play', cardId: '05025' })), /反应窗口/,
    '普通出牌路径被拒绝（0 行动快速事件只能走反应窗口）')
})

// ---------------------------------------------------------------------------
// 05027 / 05031 / 05035 / 05039 塔罗槽（+1 属性 / 开局入场）
// ---------------------------------------------------------------------------

test('TCU 05027 死神·XIII 塔罗槽 +1 智识并在开局入场', () => {
  const state = fixture('01001')
  const before = getStat(state, state.investigators[0], 'intellect')
  asset(state, '05027')
  assert.equal(getStat(state, state.investigators[0], 'intellect'), before + 1)
  const { placed } = scenarioStartsPlacement('05027')
  assert.deepEqual(placed, ['05027'], '开局窗口可选放置入场')
})

test('TCU 05031 月亮·XVIII 塔罗槽 +1 敏捷并在开局入场', () => {
  const state = fixture('01001')
  const before = getStat(state, state.investigators[0], 'agility')
  asset(state, '05031')
  assert.equal(getStat(state, state.investigators[0], 'agility'), before + 1)
  const { placed } = scenarioStartsPlacement('05031')
  assert.deepEqual(placed, ['05031'], '开局窗口可选放置入场')
})

test('TCU 05035 圣杯四 塔罗槽 +1 意志并在开局入场', () => {
  const state = fixture('01001')
  const before = getStat(state, state.investigators[0], 'willpower')
  asset(state, '05035')
  assert.equal(getStat(state, state.investigators[0], 'willpower'), before + 1)
  const { placed } = scenarioStartsPlacement('05035')
  assert.deepEqual(placed, ['05035'], '开局窗口可选放置入场')
})

test('TCU 05039 星币五 塔罗槽 +1 生命上限 +1 神智上限并在开局入场', () => {
  const state = fixture('01001')
  const healthBefore = getMaxHealth(state.investigators[0])
  const sanityBefore = getMaxSanity(state.investigators[0])
  asset(state, '05039')
  assert.equal(getMaxHealth(state.investigators[0]), healthBefore + 1)
  assert.equal(getMaxSanity(state.investigators[0]), sanityBefore + 1)
  const { placed } = scenarioStartsPlacement('05039')
  assert.deepEqual(placed, ['05039'], '开局窗口可选放置入场')
})

// ---------------------------------------------------------------------------
// 05028 良好人脉（已有样本复核）
// ---------------------------------------------------------------------------

test('TCU 05028 良好人脉 横置获得每 5 资源 +1 技能值，且每位调查员仅限 1 张', () => {
  const state = fixture('01001')
  asset(state, '05028')
  state.investigators[0].resources = 12
  state.locations[0].clues = 1
  state.chaosBag = ['0']
  move(state, { action: 'investigate' })
  resolveChoices(state, pending => {
    const option = pending.options.find(item => /良好人脉/.test(String(item.label)))
    return option ? option.id : null
  })
  assert.equal(state.lastTestResult?.value, 5, '智识 3 + floor(12/5)=2')
  assert.equal(state.lastTestResult?.success, true)
  assert.equal(state.investigators[0].assets.find(item => item.code === '05028').exhausted, true)
  // 每位调查员仅限 1 张：控制着同名卡时不能再打出第二张。
  state.investigators[0].hand = ['05028']
  assert.match(String(validateMove(state, 0, { action: 'play', cardId: '05028' })), /每位调查员仅限/)
})

// ---------------------------------------------------------------------------
// 05029 金钱万能（R7：资源技能检定）
// ---------------------------------------------------------------------------

test('TCU 05029 金钱万能 检定开始时打出：改为资源技能检定（基础值 floor(资源/2)，只吃万能图标）', () => {
  const state = fixture('01001')
  // 01090 洞察力（2 个智力图标，普通图标）；01053 机会主义者（1 个万能图标，技能卡）。
  state.investigators[0].hand = ['05029', '01090', '01053']
  state.investigators[0].resources = 14
  state.chaosBag = ['0']
  let result = null
  let commitCards = null
  runTest(state, draft => { result = performTest(draft, 0, 'willpower', 6, {}) }, pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => item.cardCode === '05029')
      if (option) return option.id
    }
    if (pending.kind === 'commit') {
      const options = pending.options.filter(item => item.id !== 'done')
      if (commitCards == null && options.length) commitCards = options
      const wild = options.find(item => /机会主义者|01053/.test(String(item.label)))
      if (wild) return wild.id
    }
    return null
  })
  assert.ok(result, '检定应有结果')
  assert.equal(result.value, 7 + 1, 'floor(14/2)=7 + 投入的 1 个万能图标')
  assert.equal(result.success, true, '8 对难度 6：原本意志 3 不可能成功')
  assert.ok(state.investigators[0].discard.includes('05029'), '事件结算后进弃牌堆')
  // 普通图标（01090 洞察力）不进投入候选：只能投入万能图标。
  assert.ok(Array.isArray(commitCards), '应有投入窗口')
  assert.equal(commitCards.length, 1, '只有万能图标卡可以投入')
  assert.ok(/机会主义者|01053/.test(String(commitCards[0].label)), '可投入的是万能图标卡')
  assert.ok(!commitCards.some(item => /洞察力|01090/.test(String(item.label))), '普通智力图标不可投入')
})

// ---------------------------------------------------------------------------
// 05032 否决存在（显式简化：只实现伤害/恐惧的取消）
// ---------------------------------------------------------------------------

test('TCU 05032 否决存在 遭遇卡伤害/恐惧可取消', () => {
  const state = fixture('01001')
  state.investigators[0].hand = ['05032']
  runTest(state, draft => {
    draft._treacheryResolving = '01165'
    try { applyHarm(draft, draft.investigators[0], 2, 1, []) } finally { delete draft._treacheryResolving }
  }, pending => {
    const cardOption = pending.options.find(item => item.cardCode === '05032')
    if (cardOption) return cardOption.id
    const cancel = pending.options.find(item => /取消 2 伤害、1 恐惧/.test(String(item.label)))
    return cancel ? cancel.id : null
  })
  const inv = state.investigators[0]
  assert.equal(inv.damage, 0, '取消刚受到的 2 点伤害')
  assert.equal(inv.horror, 0, '取消刚受到的 1 点恐惧')
  assert.ok(inv.discard.includes('05032'))
})

test('TCU 05032 否决存在 敌人攻击的伤害可取消', () => {
  const state = fixture('01001')
  state.investigators[0].hand = ['05032']
  runTest(state, draft => {
    draft._enemyAttackResolving = true
    try { applyHarm(draft, draft.investigators[0], 2, 0, []) } finally { delete draft._enemyAttackResolving }
  }, pending => {
    const cardOption = pending.options.find(item => item.cardCode === '05032')
    if (cardOption) return cardOption.id
    const cancel = pending.options.find(item => /取消 2 伤害/.test(String(item.label)))
    return cancel ? cancel.id : null
  })
  assert.equal(state.investigators[0].damage, 0, '敌人攻击的伤害被取消')
})

test('TCU 05032 否决存在 玩家卡自伤不能取消（source=other）', () => {
  const state = fixture('01001')
  state.investigators[0].hand = ['05032']
  let offered = false
  runTest(state, draft => { applyHarm(draft, draft.investigators[0], 2, 0, []) }, pending => {
    if (pending.options.some(item => item.cardCode === '05032')) offered = true
    return null
  })
  assert.equal(offered, false, '非遭遇/敌人攻击来源不提供')
  assert.equal(state.investigators[0].damage, 2, '自伤照常结算')
  assert.ok(state.investigators[0].hand.includes('05032'), '卡仍在手牌')
})

// ---------------------------------------------------------------------------
// 05033 恐怖灵感（R7：取消 / 额外结算 Mystic 卡的符号效果）
// ---------------------------------------------------------------------------

test('TCU 05033 恐怖灵感 取消凋零术的符号效果', () => {
  const state = fixture('01001')
  state.investigators[0].hand = ['05033']
  const wither = asset(state, '05157')
  const target = enemy(state, { id: 'inspire-target', fight: 3, evade: 3, health: 20 })
  state.chaosBag = ['skull']
  let offered = false
  move(state, { action: 'ability', assetId: wither.id, abilityIndex: 0, targetId: target.id })
  settle(state, pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => item.cardCode === '05033')
      if (option) { offered = true; return option.id }
    }
    if (pending.kind === 'effect') {
      const option = pending.options.find(item => item.id === 'cancel')
      if (option) return option.id
    }
    return null
  })
  assert.equal(offered, true, '符号揭示窗口可打出恐怖灵感')
  const after = state.enemies.find(item => item.id === target.id)
  assert.equal((after.statMods || []).length, 0, '凋零术的符号效果被取消：敌人没有获得修正')
})

test('TCU 05033 恐怖灵感 让凋零术的符号效果再结算一次', () => {
  const state = fixture('01001')
  state.investigators[0].hand = ['05033']
  const wither = asset(state, '05157')
  const target = enemy(state, { id: 'inspire-repeat', fight: 3, evade: 3, health: 20 })
  state.chaosBag = ['skull']
  let offered = false
  let pickedWither = false
  move(state, { action: 'ability', assetId: wither.id, abilityIndex: 0, targetId: target.id })
  settle(state, pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => item.cardCode === '05033')
      if (option) { offered = true; return option.id }
    }
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => /凋零术/.test(String(item.label)))
      if (option && !pickedWither) { pickedWither = true; return option.id }
    }
    if (pending.kind === 'effect') {
      const option = pending.options.find(item => item.id === 'repeat')
      if (option) return option.id
    }
    return null
  })
  assert.equal(offered, true, '符号揭示窗口可打出恐怖灵感')
  const after = state.enemies.find(item => item.id === target.id)
  const mods = (after.statMods || []).filter(item => item.fight === -1)
  assert.equal(mods.length, 2, '凋零术的 -1 攻击值效果结算了两次（额外结算一次，免费）')
})

test('TCU 05033 恐怖灵感 auto_fail 窗口也能打出（凋零术不因 auto_fail 产生修正）', () => {
  const state = fixture('01001')
  state.investigators[0].hand = ['05033']
  const wither = asset(state, '05157')
  const target = enemy(state, { id: 'inspire-autofail', fight: 3, evade: 3, health: 20 })
  state.chaosBag = ['autofail']
  let offered = false
  move(state, { action: 'ability', assetId: wither.id, abilityIndex: 0, targetId: target.id })
  settle(state, pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => item.cardCode === '05033')
      if (option) { offered = true; return option.id }
    }
    if (pending.kind === 'effect') {
      const option = pending.options.find(item => item.id === 'cancel')
      if (option) return option.id
    }
    return null
  })
  assert.equal(offered, true, 'auto_fail 也在 symbolRevealed 窗口内')
  const after = state.enemies.find(item => item.id === target.id)
  assert.equal((after.statMods || []).length, 0, '凋零术不因 auto_fail 触发符号效果')
})
// ---------------------------------------------------------------------------
// 05036 钉鞋
// ---------------------------------------------------------------------------

test('TCU 05036 钉鞋 +1 敏捷；移动后横置敏捷(3)检定，成功再移动到连接地点', () => {
  const state = fixture('01001')
  const agilityBefore = getStat(state, state.investigators[0], 'agility')
  const shoes = asset(state, '05036')
  assert.equal(getStat(state, state.investigators[0], 'agility'), agilityBefore + 1)
  threeLocations(state)
  // moveBeforeEngage 窗口只在「新地点有敌人、即将自动交战」时开（卡面场景即此）。
  enemy(state, { id: 'shoes-blocker', fight: 1, evade: 1, health: 9, location: 'attic', engagedSeat: null })
  state.chaosBag = ['0']
  move(state, { action: 'move', locationId: 'attic' })
  resolveChoices(state, pending => {
    const ability = pending.options.find(item => /【能力】/.test(String(item.label)) && /钉鞋/.test(String(item.label)))
    if (ability) return ability.id
    const destination = pending.options.find(item => /地窖/.test(String(item.label)))
    return destination ? destination.id : null
  })
  const inv = state.investigators[0]
  assert.equal(inv.location, 'cellar', '成功后再移动到连接地点')
  assert.equal(inv.assets.find(item => item.code === '05036').exhausted, true, '能力费用：横置钉鞋')
})

// ---------------------------------------------------------------------------
// 05037 绝望之举
// ---------------------------------------------------------------------------

test('TCU 05037 绝望之举 弃掉场上的手部道具：+X 战斗 +1 伤害，成功获得 X 资源', () => {
  const state = fixture('01001')
  asset(state, '01020') // 砍刀：[[道具]]，占用 1 个手部槽位，印刷费用 3
  const target = enemy(state, { fight: 2, health: 10, engagedSeat: null })
  state.investigators[0].hand = ['05037']
  state.chaosBag = ['0']
  const resourcesBefore = state.investigators[0].resources
  move(state, { action: 'play', cardId: '05037' })
  resolveChoices(state)
  const inv = state.investigators[0]
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 2, '基础 1 + 卡面 +1 伤害')
  assert.equal(inv.resources, resourcesBefore + 3 - 0, '成功且弃掉场上支援：获得 X=印刷费用 3 资源')
  assert.equal(inv.assets.some(item => item.code === '01020'), false, '额外费用：弃掉道具支援')
  assert.ok(inv.discard.includes('01020'))
  assert.ok(inv.discard.includes('05037'))
})

test('TCU 05037 绝望之举 从手牌弃掉手部道具：获得 +X 战斗但不返还资源', () => {
  const state = fixture('01001')
  const target = enemy(state, { fight: 2, health: 10, engagedSeat: null })
  state.investigators[0].hand = ['05037', '01020'] // 手牌里的砍刀同样可作为额外费用
  state.chaosBag = ['0']
  const resourcesBefore = state.investigators[0].resources
  move(state, { action: 'play', cardId: '05037' })
  resolveChoices(state)
  const inv = state.investigators[0]
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 2, '+X 战斗仍按印刷费用 3 生效')
  assert.equal(inv.resources, resourcesBefore, '从手牌弃掉时没有「成功获得 X 资源」')
  assert.ok(inv.discard.includes('01020'))
  assert.equal(inv.hand.includes('01020'), false)
})

// ---------------------------------------------------------------------------
// 05040 权杖王牌（塔罗槽；额外行动 + 技能加值）
// ---------------------------------------------------------------------------

test('TCU 05040 权杖王牌 流放自身换额外 1 行动；该次行动期间每项技能 +2', () => {
  const state = fixture('01001')
  const ace = asset(state, '05040')
  const inv = state.investigators[0]
  const combatBefore = getStat(state, inv, 'combat')
  const actionsBefore = inv.actionsLeft
  use(state, ace)
  resolveChoices(state)
  assert.equal(state.investigators[0].actionsLeft, actionsBefore + 1, '本回合额外 1 次行动')
  assert.equal(getStat(state, state.investigators[0], 'combat'), combatBefore, '行动开始前 +2 尚未生效')
  assert.equal((state.pendingActionEffects || []).length, 1, '「该次行动期间」效果已排队到下一次行动')
  assert.equal(state.investigators[0].assets.some(item => item.code === '05040'), false, '费用：从游戏中移除自身')
  assert.ok((state.exiled || []).includes('05040'), '流放记账进 state.exiled')
  // 下一次行动：调查检定吃到 +2（智识 3 + 2 = 5）。
  state.locations[0].clues = 3
  state.chaosBag = ['0']
  move(state, { action: 'investigate' })
  resolveChoices(state)
  assert.equal(state.lastTestResult.value, 5, '该次行动期间：智识 3 + 2 = 5')
  assert.equal(getStat(state, state.investigators[0], 'combat'), combatBefore, '行动结束 +2 过期')
  // 再下一次行动：没有 +2。
  state.locations[0].clues = 2
  move(state, { action: 'investigate' })
  resolveChoices(state)
  assert.equal(state.lastTestResult.value, 3, '再下一次行动没有 +2')
  // 它同时是塔罗：开局 [reaction] 可选放置入场。
  const { placed } = scenarioStartsPlacement('05040')
  assert.deepEqual(placed, ['05040'], '开局窗口可选放置入场')
})
// ---------------------------------------------------------------------------
// 05041 第十三幻象（基础弱点）
// ---------------------------------------------------------------------------

test('TCU 05041 第十三幻象 显现进入威胁区域并用[action][action]弃掉', () => {
  const state = fixture('01001')
  state.investigators[0].deck = ['05041']
  drawCards(state, state.investigators[0], 1, [])
  const inv = state.investigators[0]
  const threat = inv.threat.find(item => item.code === '05041')
  assert.ok(threat, '显现后进入威胁区域')
  assert.ok(!inv.hand.includes('05041'), '弱点不会留在手里')

  const actionsBefore = inv.actionsLeft
  move(state, { action: 'discardThreat', threatId: threat.id })
  assert.equal(state.investigators[0].actionsLeft, actionsBefore - 2, '弃置要花 2 个行动')
  assert.equal(state.investigators[0].threat.some(item => item.code === '05041'), false)
  assert.ok(state.investigators[0].discard.includes('05041'))
})

test('TCU 05041 第十三幻象 技能值等于难度时检定改为失败（本人 + 同地点队友）', () => {
  // 本人：智识 3 对难度 3 的平局，原本成功，被光环改为失败。
  const state = fixture('01001')
  state.investigators[0].threat.push({ id: 'threat-05041', code: '05041' })
  state.locations[0].clues = 1
  state.locations[0].shroud = getStat(state, state.investigators[0], 'intellect')
  state.chaosBag = ['0']
  move(state, { action: 'investigate' })
  settle(state)
  assert.equal(state.lastTestResult?.success, false, '平局应改为失败')
  assert.equal(state.lastTestResult?.failedBy, 0, 'failTies：failedBy 记为 0（不再是被 -1 的近似的 1）')
  assert.equal(state.lastTestResult?.value, state.lastTestResult?.difficulty, '记录值仍等于难度')
  assert.equal(state.locations[0].clues, 1, '失败不发现线索')

  // 高于难度时仍成功（光环只影响平局）。
  const above = fixture('01001')
  above.investigators[0].threat.push({ id: 'threat-05041a', code: '05041' })
  above.locations[0].clues = 1
  above.locations[0].shroud = getStat(above, above.investigators[0], 'intellect') - 1
  above.chaosBag = ['0']
  move(above, { action: 'investigate' })
  settle(above)
  assert.equal(above.lastTestResult?.success, true, '高于难度仍成功')

  // 不同地点：光环只作用于持有者所在地点（持有者留在书房，队友在阁楼检定平局仍成功）。
  const far = fixture('01001', 2)
  const [bearer2, tester2] = far.investigators
  bearer2.threat.push({ id: 'threat-05041c', code: '05041' })
  twoLocations(far)
  tester2.location = 'attic'
  const tie2 = getStat(far, tester2, 'willpower')
  far.chaosBag = ['0']
  let result2 = null
  runTest(far, draft => { result2 = performTest(draft, tester2.seat, 'willpower', tie2, {}) })
  assert.ok(result2, '检定应有结果')
  assert.equal(result2?.success, true, '持有者在另一地点时，本地点的平局不受影响')

  // 同地点队友的检定同样失败（光环跨调查员）。
  const two = fixture('01001', 2)
  const [bearer, teammate] = two.investigators
  assert.equal(bearer.location, teammate.location, '两名调查员同地点')
  bearer.threat.push({ id: 'threat-05041b', code: '05041' })
  const tie = getStat(two, teammate, 'willpower')
  two.chaosBag = ['0']
  let result = null
  runTest(two, draft => { result = performTest(draft, teammate.seat, 'willpower', tie, {}) })
  assert.ok(result, '检定应有结果')
  assert.equal(result.success, false, '同地点队友的平局检定也应失败')
})

// ---------------------------------------------------------------------------
// 分片完整性守卫（不属于逐卡证据，只防止漏文件）
// ---------------------------------------------------------------------------

test('TCU M2-1 分片 22 张条目全部注册且 code 与文件名一致', () => {
  for (const code of codes) {
    const entry = registeredEntry(code)
    assert.ok(entry, `${code} 未注册（entries/index.js 需要重建）`)
    assert.equal(entry.code, code)
  }
})
