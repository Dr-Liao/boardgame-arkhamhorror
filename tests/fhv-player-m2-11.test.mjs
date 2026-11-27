// 九循环《铁杉谷盛宴》P6 一般玩家卡 · M2-11 分片（10119–10128）逐卡验收。
//
// 分片共 10 张；每张都有 `src/cards/entries/<code>.js` 与一条 `P6 <code> …` 真实行为测试。
// 近似实现（缺引擎读点）在条目 note 里披露，并在
// `artifacts/migration/fhv/primitive-requests/<code>.json` 登记：
//   · 10123 模式 1（地点附属 → 手牌）缺写入口；
//
// 约定：
//   · 事件/支援能力走真实 legalMoves / move 管线；需要直接发起伤害/检定（不走 action 入口）时用
//     runTest 在规则事务里执行（与 tests/tde-player-m2-2.test.mjs 的 runTest 同一骨架）；
//   · 引擎在每次 applyMove 后替换调查员对象 —— 断言前从 state 重新读取。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, move, settle, asset, enemy, legalMoves, decisionSeat } from './core-fixture.mjs'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { getStat, applyHarm, turnBeginningWindow } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'

import card10119 from '../src/cards/entries/10119.js'
import card10120 from '../src/cards/entries/10120.js'
import card10121 from '../src/cards/entries/10121.js'
import card10122 from '../src/cards/entries/10122.js'
import card10123 from '../src/cards/entries/10123.js'
import card10124 from '../src/cards/entries/10124.js'
import card10125 from '../src/cards/entries/10125.js'
import card10126 from '../src/cards/entries/10126.js'
import card10127 from '../src/cards/entries/10127.js'
import card10128 from '../src/cards/entries/10128.js'

const ENTRIES = [card10119, card10120, card10121, card10122, card10123,
  card10124, card10125, card10126, card10127, card10128]
const missingEntries = ENTRIES.filter(entry => !registeredEntry(entry.code))
if (missingEntries.length) registerCardAbilities(missingEntries)

const me = (state, seat = 0) => state.investigators[seat]
const fresh = (state, id) => state.investigators.flatMap(inv => inv.assets).find(card => card.id === id)
const freshLocation = state => state.locations.find(location => location.id === me(state).location)
const blessings = state => state.chaosBag.filter(token => token === 'bless').length
const skills = ['willpower', 'intellect', 'combat', 'agility']
const pick = (pending, pattern) => (pending.options.find(option => pattern.test(String(option.label))) || {}).id ?? null
const defaultOption = pending => ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
  ?? pending.options[0]?.id

// 在规则事务里执行一段直接调用引擎的代码，并把待决选择走完。
function runTest(state, execute, choose = () => null) {
  resolveTransaction(state, decisionSeat(state) ?? 0, { action: 'lifecycleProbe' }, execute)
  for (let index = 0; state.pendingChoice && index < 150; index++) {
    const pending = state.pendingChoice
    const chosen = choose(pending)
      ?? defaultOption(pending)
    assert.ok(chosen != null, `待决选择没有可选项：${JSON.stringify(pending)}`)
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: chosen }, execute)
  }
}

// ── 10119 “恶魔” ────────────────────────────────────────────────────────────
test('P6 10119 “恶魔” 回合开始移动 1 点伤害；被击败时对地点每个敌人与调查员各造成 2 点伤害', () => {
  const state = fixture('01001', 2)
  me(state).assets = []
  me(state, 1).assets = []
  const devil = asset(state, '10119', { damage: 2 })
  me(state).damage = 2
  const foe = enemy(state, { health: 30, engagedSeat: null })
  runTest(state, draft => turnBeginningWindow(draft, []))
  const owner = state.investigators[0]
  assert.equal(owner.damage, 3, '移动 1 点伤害后又被“恶魔”的死亡反噬造成 2 点伤害')
  assert.equal(state.investigators[1].damage, 2, '同地点每位调查员各受 2 点伤害')
  assert.equal(state.enemies.find(item => item.id === foe.id).damageTaken, 2, '同地点每个敌人各受 2 点伤害')
  assert.equal(state.investigators.flatMap(inv => inv.assets).some(card => card.id === devil.id), false, '“恶魔”被击败并离场')
  assert.ok(owner.discard.includes('10119'), '“恶魔”进入弃牌堆')
})

test('P6 10119 “恶魔” 被普通伤害分配击败时，assetDefeated 窗口同样结算死亡反噬', () => {
  const state = fixture('01001', 2)
  me(state).assets = []
  me(state, 1).assets = []
  asset(state, '10119')
  const foe = enemy(state, { health: 30, engagedSeat: null })
  runTest(state, draft => applyHarm(draft, draft.investigators[0], 3, 0, [], false, null, true), pending => {
    if (pending.kind !== 'assign-damage') return null
    return pick(pending, /恶魔|Devil/)
  })
  assert.equal(state.investigators[0].damage, 2, '伤害先由“恶魔”吸收 3 点，反噬造成 2 点')
  assert.equal(state.investigators[1].damage, 2)
  assert.equal(state.enemies.find(item => item.id === foe.id).damageTaken, 2)
  assert.equal(state.investigators.flatMap(inv => inv.assets).some(card => card.code === '10119'), false)
  assert.ok(state.investigators[0].discard.includes('10119'))
})

// ── 10120 消防斧 ────────────────────────────────────────────────────────────
test('P6 10120 消防斧 资源池为空时攻击 +1 伤害；[fast] 花资源 +2[combat]（每次攻击限三次）', () => {
  const state = fixture('01001')
  me(state).assets = []
  const axe = asset(state, '10120')
  const foe = enemy(state, { fight: 0, health: 30, engagedSeat: 0 })
  state.chaosBag = ['0']
  me(state).resources = 0
  const attack = legalMoves(state).find(option => option.action === 'ability'
    && option.assetId === axe.id && option.targetId === foe.id)
  assert.ok(attack, '消防斧有攻击行动')
  move(state, attack)
  settle(state)
  assert.equal(state.lastTestResult.success, true)
  assert.equal(state.enemies.find(item => item.id === foe.id).damageTaken, 2, '基础 1 + 无资源 1 = 2 点伤害')
  assert.equal(fresh(state, axe.id).exhausted, false, '攻击不横置消防斧')

  // [fast]：攻击期间花 1 资源 +2[combat]；每次攻击最多 3 次。
  const boosted = fixture('01001')
  boosted.investigators[0].assets = []
  const axe2 = asset(boosted, '10120')
  const foe2 = enemy(boosted, { fight: 0, health: 30, engagedSeat: 0 })
  const base = getStat(boosted, boosted.investigators[0], 'combat')
  boosted.investigators[0].resources = 5
  boosted.chaosBag = ['0']
  move(boosted, { action: 'ability', assetId: axe2.id, abilityIndex: 0, targetId: foe2.id })
  let used = 0
  let extraOffered = false
  settle(boosted, pending => {
    if (pending.kind !== 'playerWindow') return null
    const option = pending.options.find(row => /消防斧/.test(String(row.label)))
    if (!option) return null
    if (used >= 3) { extraOffered = true; return null }
    used += 1
    return option.id
  })
  assert.equal(used, 3, '攻击期间可以使用 3 次')
  assert.equal(extraOffered, false, '第 4 次不再提供（每次攻击限三次）')
  assert.equal(boosted.lastTestResult.value, base + 6, '3 次共 +6[combat]')
  assert.equal(boosted.investigators[0].resources, 2, '花费 3 资源')
  assert.equal(boosted.enemies.find(item => item.id === foe2.id).damageTaken, 1, '仍有资源时没有 +1 伤害')

  // 快速：行动点用尽也以 0 行动打出。
  const quick = fixture('01001')
  quick.investigators[0].assets = []
  quick.investigators[0].hand = ['10120']
  quick.investigators[0].resources = 2
  quick.investigators[0].actionsLeft = 0
  const quickPlay = legalMoves(quick).find(option => option.action === 'play' && option.cardId === '10120')
  assert.ok(quickPlay, '消防斧是快速资产，行动点用尽也能打出')
  move(quick, quickPlay)
  settle(quick)
  assert.equal(quick.investigators[0].actionsLeft, 0, '快速资产不花行动点')
  assert.ok(quick.investigators[0].assets.some(card => card.code === '10120'))
  assert.equal(quick.investigators[0].resources, 1, '仍支付 1 资源')
})

// ── 10121 猎装 ──────────────────────────────────────────────────────────────
test('P6 10121 猎装 [fast] 横置附属手牌（最多 3 张，每张 +1 资源）；被击败时抽回全部附属', () => {
  const state = fixture('01001')
  me(state).assets = []
  const jacket = asset(state, '10121')
  me(state).hand = ['01020', '01089', '01090']
  me(state).resources = 0
  const attach = code => {
    const option = legalMoves(state).find(row => row.action === 'ability'
      && row.assetId === jacket.id && row.targetId === code)
    assert.ok(option, `猎装可以附属 ${code}`)
    move(state, option)
    settle(state)
    fresh(state, jacket.id).exhausted = false
  }
  attach('01020')
  attach('01089')
  attach('01090')
  const host = fresh(state, jacket.id)
  assert.equal(host.attachments.length, 3, '最多附属 3 张')
  assert.deepEqual(host.attachments.map(card => [card.code, card.facedown]), [['01020', true], ['01089', true], ['01090', true]])
  assert.equal(me(state).resources, 6, '每张附属 1 资源：1 + 2 + 3')
  me(state).hand.push('01091')
  assert.equal(legalMoves(state).some(row => row.action === 'ability' && row.assetId === jacket.id), false,
    '已有 3 张附属时不再提供附属能力')

  // 被击败：伤害 2（生命 2）→ 击败窗口 → 抽回全部附属。
  runTest(state, draft => applyHarm(draft, draft.investigators[0], 2, 0, [], false, null, true), pending => {
    if (pending.kind === 'assign-damage') return pick(pending, /猎装/)
    if (pending.kind === 'reaction') return pick(pending, /猎装/) ?? 'skip'
    return null
  })
  const owner = me(state)
  for (const code of ['01020', '01089', '01090']) assert.ok(owner.hand.includes(code), `附属的 ${code} 被抽回手牌`)
  assert.ok(owner.discard.includes('10121'), '猎装被击败后进入弃牌堆')
})

// ── 10122 水手的罗盘 ────────────────────────────────────────────────────────
test('P6 10122 水手的罗盘 无资源调查成功额外发现 1 线索；失败重整；[fast] 花资源 +1[intellect]', () => {
  const state = fixture('01001')
  me(state).assets = []
  const compass = asset(state, '10122')
  const here = freshLocation(state)
  here.clues = 3
  here.shroud = 2
  me(state).resources = 0
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: compass.id, abilityIndex: 0 })
  settle(state)
  assert.equal(state.lastTestResult.success, true)
  assert.equal(me(state).clues, 2, '基础 1 + 无资源 1 = 2 个线索')
  assert.equal(freshLocation(state).clues, 1)
  assert.equal(fresh(state, compass.id).exhausted, true, '调查后横置')

  // 失败：重整罗盘。
  fresh(state, compass.id).exhausted = false
  me(state).resources = 0
  state.chaosBag = ['-8']
  move(state, { action: 'ability', assetId: compass.id, abilityIndex: 0 })
  settle(state)
  assert.equal(state.lastTestResult.success, false)
  assert.equal(fresh(state, compass.id).exhausted, false, '检定失败后重整水手的罗盘')

  // [fast]：调查期间花 1 资源 +1[intellect]，每次调查最多 3 次。
  fresh(state, compass.id).exhausted = false
  me(state).resources = 5
  state.chaosBag = ['0']
  const base = getStat(state, me(state), 'intellect')
  move(state, { action: 'ability', assetId: compass.id, abilityIndex: 0 })
  let used = 0
  let extraOffered = false
  settle(state, pending => {
    if (pending.kind !== 'playerWindow') return null
    const option = pending.options.find(row => /水手的罗盘/.test(String(row.label)))
    if (!option) return null
    if (used >= 3) { extraOffered = true; return null }
    used += 1
    return option.id
  })
  assert.equal(used, 3, '调查期间可以使用 3 次')
  assert.equal(extraOffered, false, '第 4 次不再提供（每次调查限三次）')
  assert.equal(state.lastTestResult.value, base + 3, '3 次共 +3[intellect]')
  assert.equal(me(state).resources, 2, '花费 3 资源')
})

// ── 10123 求生技术 ──────────────────────────────────────────────────────────
test('P6 10123 求生技术 地点上的检定 +2 技能值；敌人检定不提供（模式 1 为简化项）', () => {
  const state = fixture('01001')
  me(state).assets = []
  const technique = asset(state, '10123')
  const here = freshLocation(state)
  here.shroud = 0
  state.chaosBag = ['0']
  const base = getStat(state, me(state), 'intellect')
  move(state, { action: 'investigate' })
  let offered = false
  settle(state, pending => {
    if (pending.kind !== 'playerWindow') return null
    const option = pending.options.find(row => /求生技术/.test(String(row.label)))
    if (!option) return null
    offered = true
    return option.id
  })
  assert.equal(offered, true, '地点上的调查检定提供该能力')
  assert.equal(state.lastTestResult.value, base + 2, '本次检定 +2 技能值')
  assert.equal(fresh(state, technique.id).exhausted, true, '横置求生技术')

  // 敌人上的攻击检定不是「地点上的检定」，不提供该能力。
  fresh(state, technique.id).exhausted = false
  const foe = enemy(state, { fight: 0, health: 30, engagedSeat: 0 })
  move(state, { action: 'fight', enemyId: foe.id })
  let offeredOnFight = false
  settle(state, pending => {
    if (pending.kind !== 'playerWindow') return null
    if (pending.options.some(row => /求生技术/.test(String(row.label)))) offeredOnFight = true
    return null
  })
  assert.equal(offeredOnFight, false, '敌人检定不提供求生技术')
})

// ── 10124 坚守信念 ──────────────────────────────────────────────────────────
test('P6 10124 坚守信念 快速（不花行动）加入 4 个祝福标记，受实体标记池上限限制', () => {
  const state = fixture('01001')
  me(state).assets = []
  me(state).hand = ['10124']
  me(state).actionsLeft = 0
  const play = legalMoves(state).find(option => option.action === 'play' && option.cardId === '10124')
  assert.ok(play, '行动点用尽的空档期也能直接打出快速事件')
  move(state, play)
  settle(state)
  assert.equal(blessings(state), 4, '加入 4 个祝福标记')
  assert.equal(me(state).actionsLeft, 0, '快速事件不花行动点')
  assert.ok(me(state).discard.includes('10124'), '结算后进弃牌堆')

  const capped = fixture('01001')
  capped.investigators[0].assets = []
  capped.investigators[0].hand = ['10124']
  capped.chaosBag = [...Array(8).fill('bless'), '0']
  move(capped, { action: 'play', cardId: '10124' })
  settle(capped)
  assert.equal(blessings(capped), 10, '实体标记池上限 10：只补到 10 个')
})

// ── 10125 天命护佑 ──────────────────────────────────────────────────────────
test('P6 10125 天命护佑 检定成功时按伤害/恐惧较少者加入祝福标记', () => {
  const state = fixture('01001')
  me(state).assets = []
  me(state).hand = ['10125']
  me(state).damage = 2
  me(state).horror = 3
  const here = freshLocation(state)
  here.shroud = 0
  here.clues = 2
  state.chaosBag = ['0']
  move(state, { action: 'investigate' })
  let committed = false
  settle(state, pending => {
    if (pending.kind !== 'commit' || committed) return null
    const option = pending.options.find(row => String(row.cardCode || '') === '10125' || /天命护佑/.test(String(row.label)))
    if (!option) return null
    committed = true
    return option.id
  })
  assert.equal(committed, true, '天命护佑进入投入区')
  assert.equal(state.lastTestResult.success, true)
  assert.equal(blessings(state), 2, '伤害 2 / 恐惧 3 → 取较少者 2 个祝福标记')
  assert.ok(me(state).discard.includes('10125'), '技能牌结算后进弃牌堆')
})

// ── 10126 宗教信物 ──────────────────────────────────────────────────────────
test('P6 10126 宗教信物 检定结束后把诅咒转为祝福；失败后可由执行者再次尝试', () => {
  const state = fixture('01001')
  me(state).assets = []
  const token = asset(state, '10126')
  const here = freshLocation(state)
  here.shroud = 8
  state.chaosBag = ['curse', '0', '-5']
  // 外层检定先强制揭示 curse/0；剩下的 -5 强制留给重试，避免随机抽到刚加入的祝福。
  state.debugNextTokens = ['curse', '0', '-5']
  move(state, { action: 'investigate' })
  let triggered = false
  let retried = false
  settle(state, pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(row => /宗教信物/.test(String(row.label)))
      if (option) { triggered = true; return option.id }
      return null
    }
    if (pending.kind === 'effect') {
      const option = pending.options.find(row => String(row.id) === 'retry')
      if (option) { retried = true; return option.id }
    }
    return null
  })
  assert.equal(triggered, true, '揭示了诅咒标记后提供反应')
  assert.equal(retried, true, '检定失败后询问是否再次尝试')
  assert.equal(fresh(state, token.id).exhausted, true, '横置宗教信物')
  assert.equal(blessings(state), 1, '1 个诅咒标记 → 1 个祝福标记')
  assert.deepEqual(state.lastTestResult.drawn, ['-5'], '重试的检定使用新标记并成为最近一次结果')
})

// ── 10127 黑马 ──────────────────────────────────────────────────────────────
test('P6 10127 黑马 无资源时四项技能 +1；补给阶段可以选择不获得资源', () => {
  const state = fixture('01001')
  me(state).assets = []
  asset(state, '10127')
  const inv = me(state)
  const base = Object.fromEntries(skills.map(skill => [skill, getStat(state, inv, skill)]))
  inv.resources = 0
  for (const skill of skills) assert.equal(getStat(state, inv, skill), base[skill] + 1, `无资源时 ${skill} +1`)
  inv.resources = 1
  for (const skill of skills) assert.equal(getStat(state, inv, skill), base[skill], `有资源时 ${skill} 不加值`)

  // 补给阶段：选择不获得资源 → 资源保持 0；没有黑马时照常 +1。
  inv.resources = 0
  move(state, { action: 'endTurn' })
  settle(state, pending => {
    if (pending.kind === 'upkeep' && pending.options.some(option => option.id === 'skip')) return 'skip'
    return null
  })
  assert.equal(me(state).resources, 0, '选择放弃后没有获得补给阶段资源')

  const plain = fixture('01001')
  plain.investigators[0].assets = []
  plain.investigators[0].resources = 0
  move(plain, { action: 'endTurn' })
  settle(plain)
  assert.equal(me(plain).resources, 1, '没有黑马时补给阶段照常获得 1 资源')
})

// ── 10128 惊世巧舌 ──────────────────────────────────────────────────────────
test('P6 10128 惊世巧舌 从弃牌堆打出带谈判的事件，花 1 充能并移出游戏', () => {
  const state = fixture('01001')
  me(state).assets = []
  const tongue = asset(state, '10128')
  assert.deepEqual([fresh(state, tongue.id).uses, fresh(state, tongue.id).usesType], [4, 'charges'], '使用（4 充能）')
  me(state).discard = ['04105']
  enemy(state, { traits: ['Humanoid'], fight: 2, health: 30, engagedSeat: 0 })
  state.chaosBag = ['0']
  const option = legalMoves(state).find(row => row.action === 'play' && row.cardId === '04105'
    && row.fromDiscardProviderId === tongue.id)
  assert.ok(option, '惊世巧舌把弃牌堆的谈判事件变成可打出的候选')
  move(state, option)
  settle(state)
  assert.equal(fresh(state, tongue.id).uses, 3, '以此方式打出事件花费 1 充能')
  assert.ok((state.removedFromGame || []).includes('04105'), '事件结算后移出游戏')
  assert.equal(me(state).discard.includes('04105'), false, '事件没有回到弃牌堆')
})
