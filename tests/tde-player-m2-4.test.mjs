// 食梦者（第五循环）M2 玩家卡 · M2-4 分片逐卡验收 —— P7。
//
// 本文件覆盖 `artifacts/migration/tde/shards.json` 的 M2-4 分片（21 张，06246–06332）。
// 每张卡至少一条真实行为测试，测试名以 `TDE <code> <中文名>` 开头；纯数据/显式简化的卡
// 也至少有一条可执行断言（见 P7-WORKER-BRIEF §3/§7）。
//
// 约定：
//   · 每次 move/applyMove 后引擎替换调查员对象，断言前重新从 state 读取；
//   · 需要直接发起检定/伤害（不走 action 入口）时用 runTest 在规则事务里执行，
//     与 tests/card-lifecycle.test.mjs 的骨架一致。

import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, asset, enemy, settle, use, decisionSeat, legalMoves, validateMove } from './core-fixture.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { registeredEntry } from '../src/engine/ability.js'
import {
  commitIcons, drawCards, getStat, lookAt, performTest, slotUsage,
} from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'

const codes = [
  '06246', '06276', '06277', '06278', '06279', '06280', '06281', '06282', '06283', '06284', '06285',
  '06323', '06324', '06325', '06326', '06327', '06328', '06329', '06330', '06331', '06332',
]
assert.equal(codes.length, 21, 'M2-4 分片固定 21 张')

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

// 用一张技能卡做一次投入，返回检定结果（用于 commit 档案类的卡）。
function commitCardOnce(code, skill, difficulty = 0) {
  const state = fixture('01001')
  state.investigators[0].hand = [code]
  state.chaosBag = ['0']
  let result = null
  runTest(state, draft => { result = performTest(draft, 0, skill, difficulty, {}) }, pending => {
    if (pending.kind !== 'commit') return null
    const option = pending.options.find(item => String(item.label).startsWith('投入：'))
    return option ? option.id : pending.options.find(item => item.id === 'done')?.id ?? null
  })
  return { state, result }
}

// 触发一次神话/战斗等「旧式反应」窗口时，按提示里的卡名选择「触发」。
function chooseReactionByPrompt(pattern) {
  return pending => {
    if (pending.kind !== 'reaction') return null
    if (!pattern.test(String(pending.prompt || ''))) return null
    const trigger = pending.options.find(option => option.id === 'trigger')
    return trigger ? trigger.id : null
  }
}

// 组合选择函数：按顺序尝试多个选择器。
const choices = (...selectors) => pending => {
  for (const select of selectors) {
    const result = select?.(pending)
    if (result != null) return result
  }
  return null
}

// 选择窗口选项：按标签/卡号匹配。
const pickOption = (pattern, id = null) => pending => {
  const option = pending.options.find(item =>
    (item.cardCode && pattern.test(String(item.cardCode))) || pattern.test(String(item.label || '')))
  if (!option) return null
  if (id && option.id !== id) return pending.options.some(item => item.id === id) ? id : option.id
  return option.id
}

// ---------------------------------------------------------------------------
// 06246 迅速撤退（技能卡：避免「基础躲避条件图标」无读点，显式简化）
// ---------------------------------------------------------------------------

test('TDE 06246 迅速撤退 投入档案：+2 敏捷条件图标与「每次检定最多投入1张」', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  const entry = registeredEntry('06246')
  assert.ok(entry, '06246 已注册')
  // 印刷 1 个敏捷图标 + 条件近似 2 个 = 投入时 3 个敏捷图标。
  assert.equal(commitIcons(state, inv, '06246', 'agility'), 3)
  assert.equal(entry.abilities[0].skill.maxPerTest, 1, '每次技能检定最多投入 1 张')
  assert.equal(entry.simplified, true)
  assert.match(entry.note, /自动躲避|基础躲避/)
  // 真实投入：敏捷 2 + 图标 3 = 5。
  const { result } = commitCardOnce('06246', 'agility')
  assert.equal(result?.value, 5, '投入后检定值 = 敏捷 2 + 3 个敏捷图标')
})

// ---------------------------------------------------------------------------
// 06276 空虚项链 / 06277 食愿项链（绑定交换）
// ---------------------------------------------------------------------------

test('TDE 06276 空虚项链 击败敌人后放置 1 充能', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  asset(state, '06276')
  const target = enemy(state, { health: 1, fight: 1 })
  state.investigators[0].combat = 20
  state.chaosBag = ['+1']
  const before = state.investigators[0].assets.find(item => item.code === '06276')
  assert.equal(before.uses, 0, '使用(0 充能)')
  move(state, { action: 'fight', enemyId: target.id })
  settle(state, chooseReactionByPrompt(/空虚项链/))
  const after = state.investigators[0].assets.find(item => item.code === '06276')
  assert.equal(after.uses, 1, '击败敌人后放置 1 充能（不是反复点击累积）')
  assert.equal(state.enemies.some(item => item.id === target.id), false, '敌人被击败')
})

test('TDE 06276 空虚项链 至少3充能时与食愿项链交换并转移全部充能', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const vessel = asset(state, '06276', { uses: 2 })
  // 少于 3 充能时能力不可用。
  assert.match(String(validateMove(state, 0, { action: 'ability', assetId: vessel.id, abilityIndex: 0 })), /能力/,
    '少于 3 充能不能交换')
  vessel.uses = 3
  move(state, { action: 'ability', assetId: vessel.id, abilityIndex: 0 })
  resolveChoices(state)
  const inv = state.investigators[0]
  const wishEater = inv.assets.find(item => item.code === '06277')
  assert.ok(wishEater, '食愿项链进入场上')
  assert.equal(wishEater.uses, 3, '空虚项链的 3 个充能全部转移到食愿项链')
  assert.equal(inv.assets.some(item => item.code === '06276'), false, '空虚项链离开场上')
  assert.ok((state.setAside || []).includes('06276'), '空虚项链放到一边（场外）')
})

test('TDE 06277 食愿项链 花费1充能取消符号标记并治愈1伤害1恐惧', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const wish = asset(state, '06277', { uses: 2 })
  state.investigators[0].damage = 2
  state.investigators[0].horror = 2
  state.chaosBag = ['tablet']
  let result = null
  runTest(state, draft => { result = performTest(draft, 0, 'willpower', 3) })
  assert.equal(result?.success, true, '符号标记被取消：意志 3 对难度 3 成功（未取消时 tablet -3 会失败）')
  assert.equal(result?.value, 3, '被取消的标记不提供修正值')
  assert.equal(state.investigators[0].assets.find(item => item.id === wish.id).uses, 1, '花费 1 充能')
  assert.equal(state.investigators[0].damage, 1, '治愈 1 点伤害')
  assert.equal(state.investigators[0].horror, 1, '治愈 1 点恐惧')
})

test('TDE 06277 食愿项链 充能耗尽后强制交换回空虚项链', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  // 先用 06276 的交换能力自然进入「食愿项链在场、空虚项链在场外」的状态。
  const vessel = asset(state, '06276', { uses: 3 })
  move(state, { action: 'ability', assetId: vessel.id, abilityIndex: 0 })
  resolveChoices(state)
  assert.ok(state.investigators[0].assets.some(item => item.code === '06277'), '先交换到食愿项链')
  assert.ok((state.setAside || []).includes('06276'), '空虚项链放到一边')
  // 揭示 3 个符号标记：每次花 1 充能取消，第 3 次后充能耗尽 → 强制交换回空虚项链。
  for (const token of ['skull', 'tablet', 'cultist']) {
    state.chaosBag = [token]
    runTest(state, draft => { performTest(draft, 0, 'willpower', 2) })
  }
  const inv = state.investigators[0]
  assert.equal(inv.assets.some(item => item.code === '06277'), false, '食愿项链收回场外')
  const back = inv.assets.find(item => item.code === '06276')
  assert.ok(back, '空虚项链回到场上')
  assert.equal(back.uses, 0, '交换回来的空虚项链没有充能')
  assert.deepEqual(state.bondedSets?.['06276']?.cards, ['06277'], '食愿项链退回绑定集合')
})

// ---------------------------------------------------------------------------
// 06278 惊喜的发现（显式简化：searchedCardRule take 近似「放入游戏区域」）
// ---------------------------------------------------------------------------

test('TDE 06278 惊喜的发现 查找牌库翻到时可选择加入手牌（简化口径）', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.deck = ['01088', '01088', '06278']
  inv.hand = []
  let taken = null
  runTest(state, draft => {
    taken = lookAt(draft, 0, { zone: 'deck', count: 3, choose: 1, returnStrategy: 'shuffle', source: '06278' })
  }, pending => {
    if (pending.kind === 'reaction' && String(pending.prompt || '').includes('惊喜的发现')) return 'trigger'
    if (pending.kind === 'search') {
      const option = pending.options.find(item => String(item.cardCode) === '06278')
      return option ? option.id : null
    }
    return null
  })
  const after = state.investigators[0]
  assert.ok(after.hand.includes('06278'), '查找翻到后进入手牌（「放入游戏区域」的显式简化）')
  assert.equal(after.deck.includes('06278'), false, '不再留在牌库')
  assert.equal(registeredEntry('06278').simplified, true)
  assert.match(registeredEntry('06278').note, /强制投入/)
})

// ---------------------------------------------------------------------------
// 06279 智慧古书
// ---------------------------------------------------------------------------

test('TDE 06279 智慧古书 横置搜索牌库顶3张并可花1秘密让该调查员费用-2立即打出', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const book = asset(state, '06279')
  state.investigators[0].deck = ['01088', '01088', '01020']
  state.investigators[0].resources = 5
  move(state, { action: 'ability', assetId: book.id, abilityIndex: 0, targetId: '0' })
  resolveChoices(state, choices(
    pending => {
      if (pending.kind !== 'search') return null
      const option = pending.options.find(item => String(item.cardCode) === '01020')
      return option ? option.id : null
    },
    pending => {
      if (pending.kind !== 'effect') return null
      const option = pending.options.find(item => item.id === 'pay')
      return option ? option.id : null
    },
  ))
  const inv = state.investigators[0]
  assert.ok(inv.assets.some(item => item.code === '01020'), '找到的道具被立即打出（进入场上）')
  assert.equal(inv.resources, 4, '大砍刀印刷费用 3，费用 -2 后支付 1')
  assert.equal(inv.assets.find(item => item.id === book.id).uses, 1, '花费 1 秘密')
})

// ---------------------------------------------------------------------------
// 06280 绞喉索
// ---------------------------------------------------------------------------

test('TDE 06280 绞喉索 只能攻击剩余生命值为1的敌人，攻击+2战斗', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const wire = asset(state, '06280')
  const dying = enemy(state, { health: 2, damageTaken: 1, fight: 1, id: 'dying' })
  const healthy = enemy(state, { health: 3, damageTaken: 0, fight: 1, id: 'healthy' })
  state.chaosBag = ['0']
  const targets = legalMoves(state)
    .filter(item => item.action === 'ability' && item.assetId === wire.id)
    .map(item => item.targetId)
  assert.deepEqual(targets, ['dying'], '只有剩余 1 点生命的敌人是合法目标')
  assert.match(String(validateMove(state, 0, { action: 'ability', assetId: wire.id, abilityIndex: 0, targetId: healthy.id })), /目标|没有/,
    '剩余生命不是 1 的敌人被拒绝')
  move(state, { action: 'ability', assetId: wire.id, abilityIndex: 0, targetId: dying.id })
  settle(state)
  const after = state.investigators[0]
  assert.equal(after.assets.find(item => item.id === wire.id).exhausted, true, '横置绞喉索')
  assert.equal(state.enemies.some(item => item.id === dying.id), false, '造成 1 点伤害并击败（剩余 1 点生命）')
  assert.equal(state.lastTestResult?.value, getStat(state, after, 'combat') + 2, '本次攻击 +2 战斗')
})

// ---------------------------------------------------------------------------
// 06281 黛利拉·欧鲁尔克
// ---------------------------------------------------------------------------

test('TDE 06281 黛利拉·欧鲁尔克 花X资源（X=躲避值）造成1伤害，已横置敌人则2伤害', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  asset(state, '06281')
  const inv0 = state.investigators[0]
  assert.equal(getStat(state, inv0, 'combat'), 5, '+1 战斗（01001 基础 4）')
  assert.equal(getStat(state, inv0, 'agility'), 3, '+1 敏捷（01001 基础 2）')
  const ready = enemy(state, { evade: 2, health: 20, exhausted: false, id: 'ready-enemy' })
  const exhausted = enemy(state, { evade: 3, health: 20, exhausted: true, id: 'exhausted-enemy' })
  state.investigators[0].resources = 5
  const delilah = state.investigators[0].assets.find(item => item.code === '06281')
  move(state, { action: 'ability', assetId: delilah.id, abilityIndex: 0, targetId: ready.id })
  settle(state)
  assert.equal(state.investigators[0].resources, 3, 'X = 躲避值 2，扣除 2 资源')
  assert.equal(state.enemies.find(item => item.id === ready.id).damageTaken, 1, '未横置：1 点伤害')
  // 已横置敌人：X = 3，伤害 2。
  const delilah2 = state.investigators[0].assets.find(item => item.code === '06281')
  state.investigators[0].resources = 5
  delilah2.exhausted = false
  move(state, { action: 'ability', assetId: delilah2.id, abilityIndex: 0, targetId: exhausted.id })
  settle(state)
  assert.equal(state.investigators[0].resources, 2, 'X = 躲避值 3')
  assert.equal(state.enemies.find(item => item.id === exhausted.id).damageTaken, 2, '已横置：改为 2 点伤害')
})

// ---------------------------------------------------------------------------
// 06282 受召猎犬
// ---------------------------------------------------------------------------

test('TDE 06282 受召猎犬 打出时把脱缰野兽洗入牌库，横置以基础值5攻击', () => {
  const state = fixture('01001')
  state.investigators[0].hand = ['06282']
  state.investigators[0].resources = 10
  move(state, { action: 'play', cardId: '06282' })
  settle(state)
  const hound = state.investigators[0].assets.find(item => item.code === '06282')
  assert.ok(hound, '受召猎犬入场')
  assert.ok(state.investigators[0].deck.includes('06283'), '额外费用：脱缰野兽洗入牌库')
  assert.equal(state.investigators[0].hand.includes('06283'), false, '不加入手牌（handCount:0）')
  const target = enemy(state, { fight: 1, health: 20, id: 'hound-target' })
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: hound.id, abilityIndex: 0, targetId: target.id })
  settle(state)
  assert.equal(state.investigators[0].assets.find(item => item.id === hound.id).exhausted, true, '横置受召猎犬')
  assert.equal(state.lastTestResult?.value, 5, '攻击使用基础战斗值 5')
  assert.equal(state.lastTestResult?.success, true)
})

test('TDE 06282 受召猎犬 横置以基础智识值5调查', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const hound = asset(state, '06282')
  state.locations[0].clues = 1
  state.locations[0].shroud = 2
  state.investigators[0].intellect = 1
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: hound.id, abilityIndex: 1 })
  settle(state)
  assert.equal(state.lastTestResult?.value, 5, '调查使用基础智识值 5')
  assert.equal(state.lastTestResult?.success, true)
  assert.equal(state.locations[0].clues, 0, '成功发现 1 个线索')
})

// ---------------------------------------------------------------------------
// 06283 脱缰野兽（玩家弱点·敌人形态）
// ---------------------------------------------------------------------------

test('TDE 06283 脱缰野兽 显现：有受召猎犬则猎犬离场且野兽与持有者交战', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  asset(state, '06282')
  state.investigators[0].deck = ['06283']
  drawCards(state, state.investigators[0], 1, [])
  settle(state)
  const inv = state.investigators[0]
  assert.equal(inv.assets.some(item => item.code === '06282'), false, '受召猎犬被放在一边')
  assert.ok((state.setAside || []).includes('06282'), '受召猎犬进入 setAside（场外）')
  const beast = state.enemies.find(item => item.code === '06283')
  assert.ok(beast, '脱缰野兽生成')
  assert.equal(beast.engagedSeat, 0, '与受召猎犬的持有者交战')
  assert.equal(beast.hunter, true, '猎手（enemyWeakness 数据）')
  assert.equal(beast.retaliate, true, '反击（enemyWeakness 数据）')
})

test('TDE 06283 脱缰野兽 显现：场上没有受召猎犬时放在一边、不生成', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].deck = ['06283']
  drawCards(state, state.investigators[0], 1, [])
  settle(state)
  assert.equal(state.enemies.some(item => item.code === '06283'), false, '没有猎犬时不生成敌人')
  assert.ok(state.log.some(line => String(line).includes('放在一边')), '日志记录放在一边')
})

// ---------------------------------------------------------------------------
// 06284 背水一战
// ---------------------------------------------------------------------------

test('TDE 06284 背水一战 资源与手牌补至5并从游戏中移除', () => {
  const state = fixture('01001')
  state.investigators[0].hand = ['06284']
  state.investigators[0].resources = 0
  move(state, { action: 'play', cardId: '06284' })
  settle(state)
  const inv = state.investigators[0]
  assert.equal(inv.resources, 5, '资源补到 5')
  assert.equal(inv.hand.length, 5, '手牌补到 5')
  assert.ok((state.exiled || []).includes('06284'), '从游戏中移除')
  assert.equal(inv.discard.includes('06284'), false, '不进弃牌堆')
})

test('TDE 06284 背水一战 资源与手牌都不少于5时不能打出', () => {
  const state = fixture('01001')
  state.investigators[0].hand = Array(5).fill('01088')
  state.investigators[0].resources = 5
  assert.match(String(validateMove(state, 0, { action: 'play', cardId: '06284' })), /背水一战/,
    '打出条件不满足时被拒绝')
})

// ---------------------------------------------------------------------------
// 06285 黑猫（纯数据 + 显式简化：符号替换无读点）
// ---------------------------------------------------------------------------

test('TDE 06285 黑猫 数据通道：盟友槽位/2个万能图标，符号替换主效果显式简化', () => {
  const state = fixture('01001')
  const def = ALL_CARDS['06285']
  assert.equal(def.type, 'asset')
  assert.equal(String(def.slot).toLowerCase(), 'ally')
  assert.equal(def.icons.wild, 2)
  assert.ok((def.traits || []).includes('Dreamlands'))
  asset(state, '06285')
  assert.equal(slotUsage(state.investigators[0]).ally, 1, '占用 1 个盟友槽位')
  const entry = registeredEntry('06285')
  assert.equal(entry.simplified, true)
  assert.match(entry.note, /符号/)
  // 黑猫没有任何常驻属性修正（印刷只有图标的「数据卡」）。
  assert.equal(getStat(state, state.investigators[0], 'willpower'), 3, '不改变调查员属性')
})

// ---------------------------------------------------------------------------
// 06323 摒绝杂念
// ---------------------------------------------------------------------------

test('TDE 06323 摒绝杂念 弃掉手中一张同名卡，治愈本拷贝全部伤害与恐惧', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const resolve = asset(state, '06323', { damage: 2, horror: 2 })
  state.investigators[0].hand = ['06323']
  move(state, { action: 'ability', assetId: resolve.id, abilityIndex: 0 })
  settle(state)
  const inv = state.investigators[0]
  const after = inv.assets.find(item => item.id === resolve.id)
  assert.equal(after.damage, 0, '治愈本拷贝的全部伤害')
  assert.equal(after.horror, 0, '治愈本拷贝的全部恐惧')
  assert.ok(inv.discard.includes('06323'), '弃掉手中的同名卡')
  assert.equal(inv.hand.includes('06323'), false)
})

test('TDE 06323 摒绝杂念 手中没有同名卡时能力不可用', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const resolve = asset(state, '06323')
  state.investigators[0].hand = []
  assert.match(String(validateMove(state, 0, { action: 'ability', assetId: resolve.id, abilityIndex: 0 })), /能力/,
    '手中没有同名卡时不能使用')
})

// ---------------------------------------------------------------------------
// 06324 阿比盖尔·福尔曼（显式简化：互换 / 再结算未实现）
// ---------------------------------------------------------------------------

test('TDE 06324 阿比盖尔·福尔曼 附属一张书籍支援后不占手部槽位', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const abigail = asset(state, '06324')
  asset(state, '01035') // 医学教科书：[[书籍]]，占 1 个手部槽位
  assert.equal(slotUsage(state.investigators[0]).hand, 1, '附属前书籍占用 1 个手部槽位')
  move(state, { action: 'ability', assetId: abigail.id, abilityIndex: 0, targetId: state.investigators[0].assets.find(item => item.code === '01035').id })
  settle(state)
  const inv = state.investigators[0]
  assert.equal(inv.assets.some(item => item.code === '01035'), false, '书籍被附属（离开支援区）')
  const host = inv.assets.find(item => item.id === abigail.id)
  assert.ok((host.attachments || []).some(item => item.code === '01035'), '书籍附属到阿比盖尔')
  assert.equal(slotUsage(inv).hand || 0, 0, '附属后不占手部槽位')
  assert.equal(registeredEntry('06324').simplified, true)
})

// ---------------------------------------------------------------------------
// 06325 真理之眼（显式简化：成功后胜利区/附属未实现）
// ---------------------------------------------------------------------------

test('TDE 06325 真理之眼 投入时提供 4 个万能图标（主效果显式简化）', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  assert.equal(commitIcons(state, inv, '06325', 'willpower'), 4, '4 个万能图标')
  const { result } = commitCardOnce('06325', 'willpower')
  assert.equal(result?.value, 3 + 4, '意志 3 + 4 个图标 = 7')
  const entry = registeredEntry('06325')
  assert.equal(entry.simplified, true)
  assert.match(entry.note, /胜利区/)
})

// ---------------------------------------------------------------------------
// 06326 乔伊“老鼠”弗吉尔
// ---------------------------------------------------------------------------

test('TDE 06326 乔伊“老鼠”弗吉尔 花1资源打出手中道具支援', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  asset(state, '06326')
  const joey = state.investigators[0].assets.find(item => item.code === '06326')
  state.investigators[0].hand = ['01020']
  state.investigators[0].resources = 10
  move(state, { action: 'ability', assetId: joey.id, abilityIndex: 0, targetId: '01020' })
  settle(state)
  const inv = state.investigators[0]
  assert.ok(inv.assets.some(item => item.code === '01020'), '大砍刀被打出到场上')
  assert.equal(inv.resources, 6, '1 资源能力费 + 大砍刀费用 3 = 4')
})

test('TDE 06326 乔伊“老鼠”弗吉尔 弃掉场上一个道具支援获得2资源', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  asset(state, '06326')
  const joey = state.investigators[0].assets.find(item => item.code === '06326')
  const machete = asset(state, '01020')
  state.investigators[0].resources = 1
  move(state, { action: 'ability', assetId: joey.id, abilityIndex: 1, targetId: machete.id })
  settle(state)
  const inv = state.investigators[0]
  assert.equal(inv.assets.some(item => item.id === machete.id), false, '道具支援被弃掉')
  assert.ok(inv.discard.includes('01020'))
  assert.equal(inv.resources, 3, '获得 2 资源')
})

// ---------------------------------------------------------------------------
// 06327 短管霰弹枪
// ---------------------------------------------------------------------------

test('TDE 06327 短管霰弹枪 按成功差值造成伤害（不造成标准伤害）', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const shotgun = asset(state, '06327')
  const target = enemy(state, { fight: 1, health: 20, id: 'shotgun-target' })
  state.chaosBag = ['+2']
  move(state, { action: 'ability', assetId: shotgun.id, abilityIndex: 0 })
  settle(state)
  // 战斗 4 + 2 = 6，难度 1 → 超过难度 5 点 → 造成 5 点伤害（不是标准 1 点）。
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 5, '按成功差值造成 5 点伤害')
  assert.equal(state.investigators[0].assets.find(item => item.id === shotgun.id).uses, 1, '花费 1 子弹')
})

// ---------------------------------------------------------------------------
// 06328 神识之眼
// ---------------------------------------------------------------------------

test('TDE 06328 神识之眼 检定开始花1秘密把本次检定改为按意志值结算', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const eye = asset(state, '06328', { uses: 3 })
  const inv = state.investigators[0]
  assert.equal(getStat(state, inv, 'agility'), 2)
  assert.equal(getStat(state, inv, 'willpower'), 3)
  state.chaosBag = ['0']
  let result = null
  runTest(state, draft => { result = performTest(draft, 0, 'agility', 3) }, pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => /神识之眼/.test(String(item.label || '')))
      if (option) return option.id
    }
    return null
  })
  assert.equal(result?.value, 3, '改为按意志值 3 结算（敏捷只有 2）')
  assert.equal(result?.success, true, '意志 3 对难度 3 成功')
  assert.equal(state.investigators[0].assets.find(item => item.id === eye.id).uses, 2, '花费 1 秘密')
})

test('TDE 06328 神识之眼 弃掉手中一张同名卡放置2秘密', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const eye = asset(state, '06328', { uses: 1 })
  state.investigators[0].hand = ['06328']
  move(state, { action: 'ability', assetId: eye.id, abilityIndex: 0 })
  settle(state)
  const inv = state.investigators[0]
  assert.equal(inv.assets.find(item => item.id === eye.id).uses, 3, '放置 2 秘密（1→3）')
  assert.equal(inv.hand.includes('06328'), false, '弃掉手中的同名卡')
  assert.ok(inv.discard.includes('06328'))
})

// ---------------------------------------------------------------------------
// 06329 闪耀的偏方三八面体（费用替代：成功分支）
// ---------------------------------------------------------------------------

test('TDE 06329 闪耀的偏方三八面体 意志(X)检定成功则法术费用视为已支付', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const stone = asset(state, '06329')
  state.investigators[0].hand = ['01061'] // 探知术：[[法术]]支援，费用 1
  state.investigators[0].resources = 1
  state.chaosBag = ['0']
  move(state, { action: 'play', cardId: '01061' })
  resolveChoices(state, pickOption(/闪耀的偏方三八面体/))
  const inv = state.investigators[0]
  assert.equal(inv.resources, 1, '意志检定成功：不支付资源费用')
  assert.equal(inv.assets.find(item => item.id === stone.id).exhausted, true, '横置闪耀的偏方三八面体')
  assert.ok(inv.assets.some(item => item.code === '01061'), '法术支援正常入场')
})

// ---------------------------------------------------------------------------
// 06330 噩梦球 / 06331 梦境寄生物
// ---------------------------------------------------------------------------

test('TDE 06330 噩梦球 入场取出3张梦境寄生物，揭示自动失败时取消标记并洗回1张', () => {
  const state = fixture('01001')
  state.investigators[0].hand = ['06330']
  state.investigators[0].assets = []
  state.investigators[0].resources = 5
  move(state, { action: 'play', cardId: '06330' })
  settle(state)
  const inv = state.investigators[0]
  assert.equal(inv.hand.filter(code => code === '06331').length, 3, '入场取出 3 张梦境寄生物')
  state.chaosBag = ['autofail']
  let result = null
  runTest(state, draft => { result = performTest(draft, 0, 'willpower', 2) })
  assert.equal(result?.autoFail, false, '[auto_fail] 标记被取消')
  assert.equal(result?.success, true, '取消后按意志 3 对难度 2 成功')
  assert.equal(state.investigators[0].hand.filter(code => code === '06331').length, 2, '洗回 1 张梦境寄生物')
  assert.ok(state.investigators[0].deck.includes('06331'), '混洗入牌库')
})

test('TDE 06331 梦境寄生物 投入档案（负图标/强制投入显式简化）', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  // 卡面 2 个万能图标：近似为普通 2 个图标（负图标无引擎读点）。
  assert.equal(commitIcons(state, inv, '06331', 'willpower'), 2)
  assert.equal(commitIcons(state, inv, '06331', 'agility'), 2)
  const entry = registeredEntry('06331')
  assert.equal(entry.code, '06331')
  assert.equal(entry.simplified, true)
  assert.match(entry.note, /负技能图标|减去/)
  assert.equal(ALL_CARDS['06331'].subtype, 'weakness')
  assert.equal(ALL_CARDS['06331'].bondedCount, 3, '绑定 3 张')
  // 弱点技能牌被引擎排除在正常投入之外（强制投入无读点，正是简化项）。
  assert.equal(state.investigators[0].hand.length, 0)
  state.investigators[0].hand = ['06331']
  let offered = false
  runTest(state, draft => { performTest(draft, 0, 'willpower', 1) }, pending => {
    if (pending.kind === 'commit' && pending.options.some(item => String(item.label).includes('梦境寄生物'))) offered = true
    return null
  })
  assert.equal(offered, false, '弱点技能牌不会作为普通投入候选（强制投入未实现）')
})

// ---------------------------------------------------------------------------
// 06332 拾荒
// ---------------------------------------------------------------------------

test('TDE 06332 拾荒 成功调查超过难度2点后横置，从弃牌堆取回道具', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const scavenging = asset(state, '06332')
  state.investigators[0].discard = ['01020']
  state.locations[0].clues = 1
  state.locations[0].shroud = 1
  state.chaosBag = ['0']
  move(state, { action: 'investigate' })
  resolveChoices(state, choices(
    chooseReactionByPrompt(/拾荒/),
    pending => {
      if (pending.kind === 'effect') {
        const option = pending.options.find(item => item.id === 'hand')
        return option ? option.id : null
      }
      if (pending.kind === 'card' || pending.kind === 'search') {
        const option = pending.options.find(item => String(item.cardCode) === '01020')
        return option ? option.id : pending.options[0]?.id
      }
      return null
    },
  ))
  const inv = state.investigators[0]
  assert.equal(state.lastTestResult?.success, true)
  assert.equal(state.lastTestResult.value - state.lastTestResult.difficulty >= 2, true, '超过难度至少 2 点')
  assert.ok(inv.hand.includes('01020'), '弃牌堆中的道具加入手牌')
  assert.equal(inv.discard.includes('01020'), false)
  assert.equal(inv.assets.find(item => item.id === scavenging.id).exhausted, true, '横置拾荒')
})

test('TDE 06332 拾荒 成功差值只有1点时不能触发', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  asset(state, '06332')
  state.investigators[0].discard = ['01020']
  state.locations[0].clues = 1
  // 智识 3 对隐藏值 2：成功差值 1，不满足「超过难度至少 2 点」。
  state.locations[0].shroud = 2
  state.chaosBag = ['0']
  let offered = false
  move(state, { action: 'investigate' })
  resolveChoices(state, pending => {
    if (pending.kind === 'reaction' && /拾荒/.test(String(pending.prompt || ''))) { offered = true; return 'trigger' }
    return null
  })
  assert.equal(offered, false, '成功差值不足 2 时不提供拾荒反应')
  assert.ok(state.investigators[0].discard.includes('01020'))
})

// ---------------------------------------------------------------------------
// 分片完整性守卫（不属于逐卡证据，只防止漏文件）
// ---------------------------------------------------------------------------

test('TDE M2-4 分片 21 张条目全部注册且 code 与文件名一致', () => {
  for (const code of codes) {
    const entry = registeredEntry(code)
    assert.ok(entry, `${code} 未注册（entries/index.js 需要重建）`)
    assert.equal(entry.code, code)
  }
})
