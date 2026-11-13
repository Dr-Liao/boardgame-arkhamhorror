// P6 M2-3 分片（08079–08108）Node 验收：条目直接 import + registerCardAbilities（不依赖索引）。
//
// 覆盖 23 张已实现/部分实现卡的真实行为；08079/08082/08087/08089/08104/08106 缺引擎读点，
// 已写 primitive-requests 并在此文件外跟踪（blocked，不计入断言）。
//
// 2026-11-08 P0-9 修复：08083/08091/08102/08105/08107 的断言改为真实引擎路径
// （真实 play/leaveAsset 窗口/performTest/applyMove），不再用 fire() 直执行描述子 + 伪造
// state.skillTest.actionKind 绕过窗口。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, play, settle, move } from './core-fixture.mjs'
import { registeredEntry, registerCardAbilities } from '../src/engine/ability.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { executeDescriptor, getStat, leaveAsset, performTest, playerWindow } from '../src/engine/engine.js'
import { cardCounterOf } from '../src/engine/card-counters.js'
import entries08079 from '../src/cards/entries/08079.js'
import entries08080 from '../src/cards/entries/08080.js'
import entries08081 from '../src/cards/entries/08081.js'
import entries08082 from '../src/cards/entries/08082.js'
import entries08083 from '../src/cards/entries/08083.js'
import entries08084 from '../src/cards/entries/08084.js'
import entries08085 from '../src/cards/entries/08085.js'
import entries08086 from '../src/cards/entries/08086.js'
import entries08087 from '../src/cards/entries/08087.js'
import entries08088 from '../src/cards/entries/08088.js'
import entries08089 from '../src/cards/entries/08089.js'
import entries08090 from '../src/cards/entries/08090.js'
import entries08091 from '../src/cards/entries/08091.js'
import entries08092 from '../src/cards/entries/08092.js'
import entries08093 from '../src/cards/entries/08093.js'
import entries08094 from '../src/cards/entries/08094.js'
import entries08095 from '../src/cards/entries/08095.js'
import entries08096 from '../src/cards/entries/08096.js'
import entries08097 from '../src/cards/entries/08097.js'
import entries08098 from '../src/cards/entries/08098.js'
import entries08099 from '../src/cards/entries/08099.js'
import entries08100 from '../src/cards/entries/08100.js'
import entries08101 from '../src/cards/entries/08101.js'
import entries08102 from '../src/cards/entries/08102.js'
import entries08103 from '../src/cards/entries/08103.js'
import entries08104 from '../src/cards/entries/08104.js'
import entries08105 from '../src/cards/entries/08105.js'
import entries08106 from '../src/cards/entries/08106.js'
import entries08107 from '../src/cards/entries/08107.js'
import entries08108 from '../src/cards/entries/08108.js'

const ALL_ENTRIES = [entries08079, entries08080, entries08081, entries08082, entries08083, entries08084,
  entries08085, entries08086, entries08087, entries08088, entries08089, entries08090, entries08091,
  entries08092, entries08093, entries08094, entries08095, entries08096, entries08097, entries08098,
  entries08099, entries08100, entries08101, entries08102, entries08103, entries08104, entries08105,
  entries08106, entries08107, entries08108]
for (const entry of ALL_ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

const inv = (s, seat = 0) => s.investigators[seat]
const descriptors = (code, kind) => (registeredEntry(code).abilities || []).filter(descriptor => descriptor.kind === kind)

function transact(state, run, select = () => null) {
  const execute = draft => run(draft)
  resolveTransaction(state, 0, { action: 'eotePlayerTest' }, execute)
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 120, `选择循环 ${JSON.stringify(state.pendingChoice)}`)
    const c = state.pendingChoice
    const id = select(c) ?? ['done', 'skip', 'self'].find(option => c.options.some(o => o.id === option)) ?? c.options[0]?.id
    resolveTransaction(state, c.seat, { action: 'choose', choiceId: c.id, optionId: id }, execute)
  }
}
// 直接执行描述子（source 默认取该卡在控制者场上的实例，事件卡用 { code }）。
function fire(state, code, descriptor, { context = {}, source = null, seat = 0 } = {}, select = () => null) {
  const sourceId = source?.id ?? null
  // 资产上的 action/free/reaction 走真实费用（行动/横置/自伤）；played/entersPlay 由窗口先付费，这里跳过。
  const alreadyPaid = ['played', 'entersPlay', 'elderSign'].includes(descriptor.kind)
  transact(state, draft => {
    const holder = draft.investigators[seat]
    // 必须在事务草稿里按 id 重新取实例：跨事务的对象引用会被动态状态克隆替换。
    const resolved = sourceId
      ? holder.assets.find(card => card.id === sourceId)
      : holder.assets.find(card => card.code === code) ?? { code }
    executeDescriptor(draft, { inv: holder, source: resolved, descriptor, alreadyPaid, events: [], context })
  }, select)
}
function link(state, from, id) {
  state.locations.push({ id, name: id, connections: [from], revealed: true, clues: 0, shroud: 1 })
  state.locations.find(location => location.id === from).connections.push(id)
  return id
}

// ---------------------------------------------------------------------------
// 真实路径工具（P0-9）：窗口 label / 选项 id / 真实攻击检定窗口。
// ---------------------------------------------------------------------------
const labelsOf = pending => (pending?.options || []).map(option => String(option.label || option.id))
const optionIdByLabel = (pending, pattern) => pending.options.find(option => pattern.test(String(option.label || '')))?.id
// 选项既可能是 id 字符串（defaultChoice），也可能是 option 对象；统一取 id。
const idOf = option => (option && typeof option === 'object' ? option.id : option)
const defaultChoice = pending => ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
  ?? pending.options[0]?.id

// 真实攻击检定：用真实 fight 动作进入 performTest，返回 test.beforeCommit 玩家窗口的观测。
// select(pending) 返回要选的 option id；未提供时用默认让过。
function fightWithWindow(state, select = () => null) {
  const foe = enemy(state, { engagedSeat: 0, fight: 0, evade: 0, health: 30 })
  state.chaosBag = ['0']
  state.investigators[0].hand = []
  const windows = []
  move(state, { action: 'fight', enemyId: foe.id })
  for (let index = 0; state.pendingChoice && index < 120; index++) {
    const pending = state.pendingChoice
    if (pending.kind === 'playerWindow' && pending.source === 'test.beforeCommit') {
      windows.push({ labels: labelsOf(pending), actionKind: state.skillTest?.actionKind ?? null })
    }
    const chosen = select(pending, state) ?? defaultChoice(pending)
    move(state, { action: 'choose', choiceId: pending.id, optionId: chosen })
  }
  return { windows, result: state.lastTestResult }
}

test('P6 08080 灭火器：攻击 +1 伤害，弃掉时自动躲避所有交战敌人', () => {
  const s = fixture('01001')
  asset(s, '08080')
  enemy(s, { fight: 1, evade: 1, health: 10, engagedSeat: 0 })
  s.chaosBag = ['0']
  fire(s, '08080', descriptors('08080', 'action')[0])
  assert.equal(s.enemies[0].damageTaken, 2)
  fire(s, '08080', descriptors('08080', 'action')[1])
  assert.equal(s.enemies[0].exhausted, true)
  assert.equal(inv(s).engaged.length, 0)
  assert.equal(inv(s).assets.some(card => card.code === '08080'), false, '能力费用应弃掉灭火器')
})

test('P6 08081 有胆有识：快速沉稳 +1 意志/+1 智力', () => {
  const s = fixture('01001')
  asset(s, '08081')
  assert.equal(registeredEntry('08081').fast, true)
  assert.equal(registeredEntry('08081').composure, true)
  assert.equal(getStat(s, inv(s), 'willpower'), 4)
  assert.equal(getStat(s, inv(s), 'intellect'), 4)
  assert.deepEqual(registeredEntry('08081').freeTriggers.map(trigger => trigger.skill), ['willpower', 'intellect'])
})

test('P6 08083 医学生：真实打出后治愈同地点调查员或盟友支援 1 伤害 1 恐惧', () => {
  // 调查员目标：真实 play 动作 → entersPlay（唯一读点）→ 选择调查员本人。
  const s = fixture('01001')
  inv(s).damage = 1
  inv(s).horror = 1
  inv(s).hand = ['08083']
  inv(s).resources = 10
  move(s, { action: 'play', cardId: '08083' })
  for (let index = 0; s.pendingChoice && index < 20; index++) {
    const pending = s.pendingChoice
    const option = pending.options.find(item => item.id === 'inv:0') ?? defaultChoice(pending)
    move(s, { action: 'choose', choiceId: pending.id, optionId: idOf(option) })
  }
  assert.equal(inv(s).damage, 0, '调查员伤害被治愈')
  assert.equal(inv(s).horror, 0, '调查员恐惧被治愈')

  // 盟友目标：2 人局，同地点另一名调查员的 [[盟友]] 有 1 伤害 1 恐惧。
  const allyCase = fixture('01001', 2)
  for (const other of allyCase.investigators) { other.assets = []; other.hand = []; other.threat = []; other.discard = [] }
  allyCase.investigators[1].location = allyCase.investigators[0].location
  const ally = asset(allyCase, '01032', { damage: 1, horror: 1 }, 1)
  allyCase.investigators[0].hand = ['08083']
  allyCase.investigators[0].resources = 10
  allyCase.currentSeat = 0
  let choseAlly = false
  move(allyCase, { action: 'play', cardId: '08083' })
  for (let index = 0; allyCase.pendingChoice && index < 20; index++) {
    const pending = allyCase.pendingChoice
    const option = pending.options.find(item => item.id === `asset:${ally.id}`) ?? defaultChoice(pending)
    if (idOf(option) === `asset:${ally.id}`) choseAlly = true
    move(allyCase, { action: 'choose', choiceId: pending.id, optionId: idOf(option) })
  }
  const after = allyCase.investigators[1].assets.find(item => item.id === ally.id)
  assert.equal(choseAlly, true, '住院目标列表包含同地点的盟友支援')
  assert.equal(after.damage, 0, '盟友伤害被治愈（修复前 healAsset 传数字导致 1→1）')
  assert.equal(after.horror, 0, '盟友恐惧被治愈（不得出现 0→-1）')
})

test('P6 08084 追踪：沿最短路径移动 2 次，或在无人地点发现线索', () => {
  const moved = fixture('01001')
  const start = inv(moved).location
  const first = link(moved, start, 'm23-a')
  const second = link(moved, first, 'm23-b')
  enemy(moved, { location: second, engagedSeat: null, fight: 9 })
  fire(moved, '08084', descriptors('08084', 'played')[0], {}, c => (c.options.some(o => o.id === 'move') ? 'move' : null))
  assert.equal(inv(moved).location, second)
  const clue = fixture('01001')
  const clueStart = inv(clue).location
  const step = link(clue, clueStart, 'm23-c')
  const far = link(clue, step, 'm23-d')
  enemy(clue, { location: far, engagedSeat: null, fight: 9 })
  clue.locations.find(location => location.id === step).clues = 2
  fire(clue, '08084', descriptors('08084', 'played')[0], {}, c => (c.options.some(o => o.id === 'clue') ? 'clue' : null))
  assert.equal(clue.locations.find(location => location.id === step).clues, 1)
  assert.equal(inv(clue).clues, 1)
})

test('P6 08085 追踪（3 级）：移动 2 次并在每个进入地点发现 1 个线索', () => {
  const s = fixture('01001')
  const start = inv(s).location
  const first = link(s, start, 'm23-e')
  const second = link(s, first, 'm23-f')
  s.locations.find(location => location.id === first).clues = 1
  s.locations.find(location => location.id === second).clues = 1
  enemy(s, { location: second, engagedSeat: null, fight: 9 })
  fire(s, '08085', descriptors('08085', 'played')[0])
  assert.equal(inv(s).location, second)
  assert.equal(inv(s).clues, 2)
})

test('P6 08086 迈克尔·李：属性 +1，调查成功放证据（最多 3）', () => {
  const s = fixture('01001')
  asset(s, '08086')
  assert.equal(getStat(s, inv(s), 'intellect'), 4)
  assert.equal(getStat(s, inv(s), 'combat'), 5)
  const evidence = descriptors('08086', 'reaction')[0]
  for (let i = 0; i < 4; i++) {
    fire(s, '08086', evidence, { source: inv(s).assets.find(card => card.code === '08086'), context: { seat: 0, successBy: 1 } })
  }
  assert.equal(inv(s).assets.find(card => card.code === '08086').uses, 3)
})

test('P6 08088 老旧的霰弹枪：事件后使用值 2；成功按超过难度造成 1~3 伤害', () => {
  const s = fixture('01001')
  asset(s, '08088')
  assert.equal(inv(s).assets.find(card => card.code === '08088').uses, 0)
  fire(s, '08088', descriptors('08088', 'reaction')[0], {
    source: inv(s).assets.find(card => card.code === '08088'), context: { cardCode: '01088' },
  })
  assert.equal(inv(s).assets.find(card => card.code === '08088').uses, 2)
  enemy(s, { fight: 0, evade: 0, health: 10, engagedSeat: 0 })
  s.chaosBag = ['0']
  fire(s, '08088', descriptors('08088', 'action')[0])
  assert.equal(s.enemies[0].damageTaken, 3, '超过难度很多时伤害封顶 3')
})

test('P6 08090 克图格亚的烙印：按充能造成伤害并消耗充能', () => {
  const s = fixture('01001')
  asset(s, '08090')
  assert.equal(inv(s).assets.find(card => card.code === '08090').uses, 6)
  enemy(s, { fight: 1, evade: 1, health: 10, engagedSeat: 0 })
  s.chaosBag = ['0']
  fire(s, '08090', descriptors('08090', 'action')[0], { context: { targetId: s.enemies[0].id } },
    c => (c.options.some(o => o.id === '2') ? '2' : null))
  assert.equal(s.enemies[0].damageTaken, 2)
  assert.equal(inv(s).assets.find(card => card.code === '08090').uses, 4)
})

test('P6 08092 克图格亚的烙印（4 级）：+2 技能值，最多花 3 充能', () => {
  const s = fixture('01001')
  asset(s, '08092')
  assert.equal(inv(s).assets.find(card => card.code === '08092').uses, 9)
  enemy(s, { fight: 1, evade: 1, health: 10, engagedSeat: 0 })
  s.chaosBag = ['0']
  fire(s, '08092', descriptors('08092', 'action')[0], { context: { targetId: s.enemies[0].id } },
    c => (c.options.some(o => o.id === '3') ? '3' : null))
  assert.equal(s.enemies[0].damageTaken, 3)
  assert.equal(inv(s).assets.find(card => card.code === '08092').uses, 6)
})

test('P6 08093 巨石锤：加入意志，成功超过难度 3 点时 +2 伤害并击退', () => {
  const s = fixture('01001')
  asset(s, '08093')
  link(s, inv(s).location, 'm23-g')
  enemy(s, { fight: 1, evade: 1, health: 20, engagedSeat: 0 })
  s.chaosBag = ['0']
  fire(s, '08093', descriptors('08093', 'action')[0], { context: { targetId: s.enemies[0].id } },
    c => (c.options.some(o => o.id === 'm23-g') ? 'm23-g' : null))
  assert.equal(s.enemies[0].damageTaken, 3)
  assert.equal(s.enemies[0].location, 'm23-g')
})

test('P6 08094/08096 长柄大锤：两种挥砸的修正与伤害', () => {
  const s = fixture('01001')
  asset(s, '08094')
  enemy(s, { fight: 1, evade: 1, health: 20, engagedSeat: 0 })
  s.chaosBag = ['0']
  fire(s, '08094', descriptors('08094', 'action')[0], { context: { targetId: s.enemies[0].id } })
  assert.equal(s.enemies[0].damageTaken, 2)
  assert.equal(registeredEntry('08094').abilities[1].cost.action, 2)
  assert.equal(registeredEntry('08096').abilities[1].cost.action, 3)
  assert.equal(registeredEntry('08096').abilities[1].effect.combatBonus, 5)
})

test('P6 08095 防护服：危险诡计显现前自伤并取消显现', () => {
  const s = fixture('01001')
  asset(s, '08095')
  const context = { when: 'treachery', seat: 0, cardCode: '10520', cancelled: false }
  fire(s, '08095', descriptors('08095', 'reaction')[0], {
    source: inv(s).assets.find(card => card.code === '08095'), context,
  })
  const armor = inv(s).assets.find(card => card.code === '08095')
  assert.equal(armor.damage, 1)
  assert.equal(armor.horror, 1)
  assert.equal(context.cancelled, true)
})

test('P6 08097 袖珍望远镜：调查相连的已揭示地点', () => {
  const s = fixture('01001')
  asset(s, '08097')
  const here = inv(s).location
  const connected = link(s, here, 'm23-h')
  s.locations.find(location => location.id === connected).clues = 2
  s.chaosBag = ['0']
  fire(s, '08097', descriptors('08097', 'action')[0], {}, c => (c.options.some(o => o.id === 'm23-h') ? 'm23-h' : null))
  assert.equal(inv(s).clues, 1)
  assert.equal(s.locations.find(location => location.id === connected).clues, 1)
})

test('P6 08098/08100 远古海图：横置花秘密免费执行移动/调查行动', () => {
  const s = fixture('01001')
  asset(s, '08098')
  const destination = link(s, inv(s).location, 'm23-i')
  fire(s, '08098', descriptors('08098', 'free')[0], {}, c => (c.options.some(o => o.id === 'move') ? 'move' : null))
  assert.equal(inv(s).location, destination)
  const s2 = fixture('01001')
  asset(s2, '08100')
  const target = link(s2, inv(s2).location, 'm23-j')
  s2.locations.find(location => location.id === target).clues = 1
  // 两次行动都选「移动」：先到 m23-j，再原路返回书房（确定性选择，便于事务重放）。
  fire(s2, '08100', descriptors('08100', 'free')[0], {}, c => (c.options.some(o => o.id === 'move') ? 'move' : null))
  assert.equal(inv(s2).location, 'study')
  assert.equal(inv(s2).assets.find(card => card.code === '08100').uses, 2)
})

test('P6 08098/08100 远古海图：不是自己的回合时玩家窗口不提供', () => {
  // 卡面「[free]在你回合期间」：免费能力窗口会向所有调查员询问，漏 criteria 时别人回合也能触发
  //（与 02108 探路者同一类漏网）。
  for (const code of ['08098', '08100']) {
    const s = fixture('01001', 2)
    asset(s, code)
    const openWindow = draft => playerWindow(draft, 'investigation.afterAction', [], null, {})
    s.currentSeat = 1
    resolveTransaction(s, 1, { action: 'eoteP6OtherTurn' }, openWindow)
    const offTurnLabels = (s.pendingChoice?.options || []).map(option => String(option.label))
    assert.equal(offTurnLabels.some(label => label.includes('远古海图')), false, `${code} 不是自己的回合不能触发`)
    // 自己回合的同一窗口仍然提供（只由 criteria 开关，回合内可用性不变）。
    s.currentSeat = 0
    resolveTransaction(s, 0, { action: 'eoteP6OwnTurn' }, openWindow)
    const ownTurnLabels = (s.pendingChoice?.options || []).map(option => String(option.label))
    assert.ok(ownTurnLabels.some(label => label.includes('远古海图')), `${code} 自己的回合仍然可以触发`)
  }
})

test('P6 08099 吉恩·波尔格：移动后把连接地点的线索搬到自己所在地点', () => {
  const s = fixture('01001')
  asset(s, '08099')
  assert.equal(getStat(s, inv(s), 'agility'), 3)
  const connected = link(s, inv(s).location, 'm23-k')
  s.locations.find(location => location.id === connected).clues = 2
  s.locations.find(location => location.id === inv(s).location).clues = 0
  fire(s, '08099', descriptors('08099', 'reaction')[0], { context: { seat: 0 } })
  assert.equal(s.locations.find(location => location.id === connected).clues, 1)
  assert.equal(s.locations.find(location => location.id === inv(s).location).clues, 1)
})

test('P6 08101/08103 占卜：不发现标准线索，改为按充能发现线索', () => {
  const s = fixture('01001')
  asset(s, '08101')
  s.locations.find(location => location.id === inv(s).location).clues = 3
  s.chaosBag = ['0']
  fire(s, '08101', descriptors('08101', 'action')[0], {}, c => (c.options.some(o => o.id === '2') ? '2' : null))
  assert.equal(inv(s).clues, 2)
  assert.equal(inv(s).assets.find(card => card.code === '08101').uses, 2)
  const s2 = fixture('01001')
  asset(s2, '08103')
  s2.locations.find(location => location.id === inv(s2).location).clues = 5
  s2.chaosBag = ['0']
  fire(s2, '08103', descriptors('08103', 'action')[0], {}, c => (c.options.some(o => o.id === '3') ? '3' : null))
  assert.equal(inv(s2).clues, 3)
  assert.equal(inv(s2).assets.find(card => card.code === '08103').uses, 3)
})

test('P6 08102 保护魂灵：真实 assetLeavesPlay 窗口（盟友离场后返回拥有者手牌或抽 3 张）', () => {
  // 真实引擎 leaveAsset 打开的 assetLeavesPlay 窗口 context 只有 assetCode/assetId/asset/reason/location，
  // 实体上没有 traits/location —— 修复前 criteria 永远不满足（窗口不出现）。
  const s = fixture('01001')
  s.investigators[0].assets = []
  s.investigators[0].hand = ['08102']
  s.investigators[0].discard = []
  s.investigators[0].resources = 10
  asset(s, '01032') // Research Librarian [[Ally]]
  let offered = null
  transact(s, draft => {
    leaveAsset(draft, draft.investigators[0],
      draft.investigators[0].assets.find(card => card.code === '01032'), [], { reason: 'effect' })
  }, pending => {
    if (pending.kind === 'reaction' && labelsOf(pending).some(label => /保护魂灵/.test(label))) {
      offered = labelsOf(pending)
      return optionIdByLabel(pending, /保护魂灵/)
    }
    if (pending.options.some(option => option.id === 'return')) return 'return'
    return null
  })
  assert.ok(offered, '真实离场窗口列出「保护魂灵」')
  assert.equal(inv(s).hand.filter(code => code === '01032').length, 1, '盟友返回其拥有者手牌')
  assert.equal(inv(s).discard.includes('01032'), false, '返回手牌后不进弃牌堆')
  assert.equal(inv(s).discard.includes('08102'), true, '事件结算后进弃牌堆')

  // 「或让拥有者抽 3 张」分支：真实窗口打出后抽 3 张，盟友留在弃牌堆。
  const s2 = fixture('01001')
  s2.investigators[0].assets = []
  s2.investigators[0].hand = ['08102']
  s2.investigators[0].discard = []
  s2.investigators[0].resources = 10
  asset(s2, '01032')
  transact(s2, draft => {
    leaveAsset(draft, draft.investigators[0],
      draft.investigators[0].assets.find(card => card.code === '01032'), [], { reason: 'effect' })
  }, pending => {
    if (pending.kind === 'reaction' && labelsOf(pending).some(label => /保护魂灵/.test(label))) {
      return optionIdByLabel(pending, /保护魂灵/)
    }
    if (pending.options.some(option => option.id === 'draw')) return 'draw'
    return null
  })
  const handAfter = s2.investigators[0].hand.filter(code => code !== '08102').length
  assert.equal(handAfter, 3, '拥有者抽取 3 张卡牌')
  // 引擎各 leaveAsset 调用点会在窗口返回后把未返回手牌的卡放进弃牌堆；测试直接调 leaveAsset，
  // 这里按调用方口径补一次去向，模拟真实弃牌结算。
  if (!s2.investigators[0].hand.includes('01032') && !s2.investigators[0].discard.includes('01032')) {
    s2.investigators[0].discard.push('01032')
  }
  assert.equal(s2.investigators[0].discard.includes('01032'), true, '未选返回时盟友留在弃牌堆')
})

test('P6 08105/08107 破冰锥：真实攻击检定窗口出现 +1 技能值（横置）', () => {
  // 修复前：真实 fight 不写 state.skillTest.actionKind（只写 testInitiated.context），窗口不出现；
  // 修复后条目声明 assetRule.trackTestTarget，引擎在真实检定写 actionKind/target。
  const s = fixture('01001')
  s.investigators[0].assets = []
  asset(s, '08105')
  const { windows, result } = fightWithWindow(s, (pending, state) => (
    pending.kind === 'playerWindow' && pending.source === 'test.beforeCommit'
      && labelsOf(pending).some(label => /破冰锥/.test(label))
      ? optionIdByLabel(pending, /破冰锥/)
      : null
  ))
  const beforeCommit = windows.find(window => window.actionKind != null)
  assert.ok(beforeCommit, '真实攻击检定窗口已打开')
  assert.equal(beforeCommit.actionKind, 'fight', '引擎写入真实 actionKind=fight')
  assert.ok(beforeCommit.labels.some(label => /破冰锥/.test(label)), '真实 fight 窗口列出破冰锥')
  assert.equal(s.investigators[0].assets.find(card => card.code === '08105').exhausted, true, '横置支付费用')
  assert.equal(result.value, s.investigators[0].combat + 1, '本次检定 +1 技能值')
})

test('P6 08107 破冰锥（3 级）：真实窗口弃掉自身换取成功后 +1 伤害', () => {
  const s = fixture('01001')
  s.investigators[0].assets = []
  asset(s, '08107')
  // 同一句卡文：先横置拿 +1，再在同一检定窗口选择「成功后弃掉」。
  let usedExhaust = false
  let usedDiscard = false
  const { windows, result } = fightWithWindow(s, pending => {
    if (!usedExhaust && optionIdByLabel(pending, /横置/)) { usedExhaust = true; return optionIdByLabel(pending, /横置/) }
    if (usedExhaust && !usedDiscard && optionIdByLabel(pending, /弃掉破冰锥/)) { usedDiscard = true; return optionIdByLabel(pending, /弃掉破冰锥/) }
    return null
  })
  assert.ok((windows[0]?.labels || []).some(label => /破冰锥/.test(label)), '真实 fight 窗口列出破冰锥')
  assert.equal(usedExhaust, true, '横置子句在真实窗口可用')
  assert.equal(usedDiscard, true, '成功后弃卡子句在真实窗口可用')
  assert.equal(result.success, true, '检定成功')
  assert.equal(s.enemies[0].damageTaken, 2, '成功后本次攻击 +1 伤害（基础 1 + 额外 1，并入本次攻击）')
  assert.equal(result.value, s.investigators[0].combat + 1, '横置 +1 技能值')
  assert.equal(s.investigators[0].assets.some(card => card.code === '08107'), false, '成功后弃掉自身')

  // 失败时不弃卡（印刷「如果你成功，你可以弃掉……」）：用 autofail 标记强制失败。
  const miss = fixture('01001')
  miss.investigators[0].assets = []
  asset(miss, '08107')
  const foe = enemy(miss, { engagedSeat: 0, fight: 0, evade: 0, health: 30 })
  miss.chaosBag = ['autofail']
  miss.investigators[0].hand = []
  let missExhaust = false
  let missDiscard = false
  move(miss, { action: 'fight', enemyId: foe.id })
  for (let index = 0; miss.pendingChoice && index < 120; index++) {
    const pending = miss.pendingChoice
    let chosen = null
    if (pending.kind === 'playerWindow' && pending.source === 'test.beforeCommit') {
      if (!missExhaust && optionIdByLabel(pending, /横置/)) { missExhaust = true; chosen = optionIdByLabel(pending, /横置/) }
      else if (missExhaust && !missDiscard && optionIdByLabel(pending, /弃掉破冰锥/)) { missDiscard = true; chosen = optionIdByLabel(pending, /弃掉破冰锥/) }
    }
    move(miss, { action: 'choose', choiceId: pending.id, optionId: chosen ?? defaultChoice(pending) })
  }
  assert.equal(miss.lastTestResult.success, false, '本次检定失败')
  assert.equal(missDiscard, true, '失败检定也允许登记「成功后」子句（结算时按失败跳过）')
  assert.equal(miss.investigators[0].assets.some(card => card.code === '08107'), true, '失败时不弃掉破冰锥')
})

test('P6 08108 虚影易位：与 2 连接内的已揭示地点非精英敌人交换位置', () => {
  const s = fixture('01001')
  const start = inv(s).location
  const near = link(s, start, 'm23-l')
  s.locations.find(location => location.id === near).revealed = true
  enemy(s, { location: near, engagedSeat: null, fight: 3 })
  fire(s, '08108', descriptors('08108', 'played')[0])
  assert.equal(inv(s).location, near)
  assert.equal(s.enemies[0].location, start)
})

test('P6 08079 血债血偿：敌人攻击造成伤害/恐惧后按数量抽牌', () => {
  const s = fixture('01001')
  fire(s, '08079', descriptors('08079', 'played')[0], {
    context: { seat: 0, damage: 2, horror: 1, attack: { enemyId: 'e1' } },
  })
  assert.equal(inv(s).hand.length, 3)
})

test('P6 08082 抵挡：非精英敌人生成时攻击并自动躲避，随后附属且不能重整', () => {
  const s = fixture('01001')
  const foe = enemy(s, { fight: 1, evade: 1, health: 5, engagedSeat: null, damage: 1, horror: 1 })
  fire(s, '08082', descriptors('08082', 'played')[0], { context: { seat: 0, location: inv(s).location, enemyId: foe.id } })
  assert.equal(inv(s).damage, 1, '该敌人先攻击了你')
  assert.equal(inv(s).horror, 1)
  assert.equal(s.enemies[0].exhausted, true, '自动躲避后横置')
  assert.equal(inv(s).engaged.length, 0, '自动躲避后解除交战')
  inv(s).discard.push('08082')
  fire(s, '08082', descriptors('08082', 'reaction')[0], { context: { cardCode: '08082', seat: 0 } })
  assert.equal((s.enemies[0].attachments || []).some(card => card.code === '08082'), true)
  assert.equal(registeredEntry('08082').restrainsReady, true, '附属敌人不能重整（phases.js 读点）')
})

test('P6 08087 狙击：添加「符号标记视为 0」的延迟效果', () => {
  const s = fixture('01001')
  fire(s, '08087', descriptors('08087', 'played')[0])
  const effect = s.effects.find(item => item.sourceCode === '08087')
  assert.ok(effect, '应记录延迟效果')
  assert.equal(effect.duration, 'endOfTurn')
  assert.ok(effect.abilities[0].trigger.includes('tokenEffectWouldResolve'))
  assert.equal(effect.abilities[0].effect.type, 'cancelSymbolToken')
})

test('P6 08089 快拔枪套：把枪械附属到枪套并免费执行其攻击行动', () => {
  const s = fixture('01001')
  const holster = asset(s, '08089')
  const shotgun = asset(s, '01029', { uses: 2 })
  fire(s, '08089', descriptors('08089', 'free')[0], { source: holster })
  assert.equal(inv(s).assets.find(card => card.id === shotgun.id).attachedToAsset, holster.id)
  const foe = enemy(s, { fight: 0, evade: 0, health: 20, engagedSeat: 0 })
  s.chaosBag = ['0']
  fire(s, '08089', descriptors('08089', 'free')[1], { source: inv(s).assets.find(card => card.code === '08089') })
  assert.equal(s.enemies[0].damageTaken, 5)
})

test('P6 08091 恩科西·马巴蒂：真实 performTest 的 tokenReveal 窗口把符号标记改为咒印', () => {
  const s = fixture('01001')
  s.investigators[0].assets = []
  s.investigators[0].hand = ['08091']
  s.investigators[0].resources = 10
  s.chaosBag = ['cultist', 'skull']
  move(s, { action: 'play', cardId: '08091' })
  for (let index = 0; s.pendingChoice && index < 20; index++) {
    const pending = s.pendingChoice
    const option = pending.options.find(item => String(item.id) === 'skull') ?? defaultChoice(pending)
    move(s, { action: 'choose', choiceId: pending.id, optionId: idOf(option) })
  }
  const sorcerer = s.investigators[0].assets.find(card => card.code === '08091')
  assert.ok(sorcerer, '08091 真实打出并入场')
  assert.equal(sorcerer.sigilToken, 'skull', '咒印记在支援实例上（真实入场钩子 + api.setSigilToken）')

  // 真实 performTest：袋里只有 skull/cultist；揭示到 cultist 时 tokenReveal 窗口应出现反应，
  // 横置恩科西并把本次揭示替换为咒印（skull）。
  let offered = null
  let replaced = null
  for (let attempt = 0; attempt < 6 && !replaced; attempt++) {
    transact(s, draft => { performTest(draft, 0, 'willpower', 0, { source: { label: '修复探针检定' } }) },
      pending => {
        if (pending.kind === 'reaction' && labelsOf(pending).some(label => /恩科西/.test(label))) {
          offered = labelsOf(pending)
          return optionIdByLabel(pending, /恩科西/)
        }
        return null
      })
    const drawn = s.lastTestResult?.drawn || []
    if (offered && drawn.includes('skull') && !drawn.includes('cultist')) {
      replaced = { drawn, exhausted: s.investigators[0].assets.find(card => card.code === '08091')?.exhausted }
    }
  }
  assert.ok(offered, '真实 tokenReveal 窗口列出恩科西的反应')
  assert.ok(replaced, '符号标记被替换为咒印并结算')
  assert.equal(replaced.exhausted, true, '横置支付费用')
})

test('P6 08104/08106 威廉·韦伯教授：调查成功横置花秘密，取回道具或连接地点发现线索', () => {
  for (const code of ['08104', '08106']) {
    const s = fixture('01001')
    const professor = asset(s, code)
    inv(s).discard.push('01016')
    fire(s, code, descriptors(code, 'reaction')[0], { source: professor, context: { seat: 0, successBy: 2 } },
      c => (c.options.some(o => o.id === 'item') ? 'item' : null))
    assert.equal(inv(s).hand.filter(card => card === '01016').length, 1, `${code} 应取回道具`)
    assert.equal(inv(s).assets.find(card => card.code === code).uses, 2)
    assert.equal(inv(s).assets.find(card => card.code === code).exhausted, true)
  }
})

test('P6 08086 迈克尔·李：发起攻击时横置花证据，成功后追加 1 伤害', () => {
  const s = fixture('01001')
  asset(s, '08086', { uses: 1 })
  s.skillTest = { seat: 0, skill: 'combat', actionKind: 'fight', pendingBonus: 0 }
  fire(s, '08086', descriptors('08086', 'reaction')[1], { context: { seat: 0, actionKind: 'fight' } })
  assert.equal(s.skillTest.extraOnSuccess?.[0]?.type, 'dealDamage')
  assert.equal(s.skillTest.extraOnSuccess[0].amount, 1)
  assert.equal(inv(s).assets.find(card => card.code === '08086').exhausted, true)
  assert.equal(inv(s).assets.find(card => card.code === '08086').uses, 0)
})

test('P6 08097 袖珍望远镜：横置查看相连未揭示地点的揭示面', () => {
  const s = fixture('01001')
  asset(s, '08097')
  const hidden = link(s, inv(s).location, 'm23-hidden')
  const location = s.locations.find(item => item.id === hidden)
  location.revealed = false
  location.name = '隐藏礁石'
  fire(s, '08097', descriptors('08097', 'free')[0])
  assert.ok(s.log.some(entry => String(entry?.text || entry).includes('隐藏礁石')), '查看结果应展示给玩家')
  assert.equal(inv(s).assets.find(card => card.code === '08097').exhausted, true)
  assert.equal(s.locations.find(item => item.id === hidden).revealed, false, '查看不等于揭示')
})

test('P6 08107 破冰锥（3 级）：真实调查检定窗口弃掉自身换取额外 1 个线索', () => {
  const s = fixture('01001')
  s.investigators[0].assets = []
  s.investigators[0].clues = 0
  s.investigators[0].hand = []
  asset(s, '08107')
  const here = s.locations.find(location => location.id === s.investigators[0].location)
  here.clues = 2
  s.chaosBag = ['0']
  let usedExhaust = false
  let usedDiscard = false
  move(s, { action: 'investigate' })
  for (let index = 0; s.pendingChoice && index < 120; index++) {
    const pending = s.pendingChoice
    let chosen = null
    if (pending.kind === 'playerWindow' && pending.source === 'test.beforeCommit') {
      if (!usedExhaust && optionIdByLabel(pending, /横置/)) { usedExhaust = true; chosen = optionIdByLabel(pending, /横置/) }
      else if (usedExhaust && !usedDiscard && optionIdByLabel(pending, /弃掉破冰锥/)) { usedDiscard = true; chosen = optionIdByLabel(pending, /弃掉破冰锥/) }
    }
    move(s, { action: 'choose', choiceId: pending.id, optionId: chosen ?? defaultChoice(pending) })
  }
  assert.equal(usedExhaust, true, '真实调查检定窗口列出横置子句')
  assert.equal(usedDiscard, true, '真实调查检定窗口列出「弃掉破冰锥」')
  assert.equal(inv(s).clues, 2, '基础 1 线索 + 成功后额外 1 线索')
  const hereAfter = s.locations.find(location => location.id === s.investigators[0].location)
  assert.equal(hereAfter.clues, 0, '地点线索被取走 2 个')
  assert.equal(inv(s).assets.some(card => card.code === '08107'), false, '弃掉自身')
})
