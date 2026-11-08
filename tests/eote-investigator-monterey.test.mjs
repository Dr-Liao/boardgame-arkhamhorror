// P5 08007 蒙特雷·杰克（含专属 08008 可靠的长鞭 / 08009 被埋葬的秘密）的 Node 验收。
//
// 覆盖：专属条目注册、旧印 +1 与移动奖励、回合结束距离 0/1/≥2 分支、
// 长鞭敏捷攻击与成功横置二选一、被埋葬的秘密威胁区/移动锁/调查成功与失败分支、JSON 往返。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy } from './core-fixture.mjs'
import { registeredEntry, registerCardAbilities } from '../src/engine/ability.js'
import { resolveTransaction, choiceError } from '../src/engine/resolution.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { performTest, reactionWindow, relocateInvestigator, drawCards, legalMoves,
  executeDescriptor, getStat, movementError } from '../src/engine/engine.js'
import { migrateState } from '../src/engine/save-migration.js'
import montereyEntry from '../src/cards/entries/08007.js'
import bullwhipEntry from '../src/cards/entries/08008.js'
import buriedSecretsEntry from '../src/cards/entries/08009.js'

// 索引重建前由测试直接注册；索引重建后引擎已注册，跳过（避免重复注册抛错）。
for (const entry of [montereyEntry, bullwhipEntry, buriedSecretsEntry]) {
  if (!registeredEntry(entry.code)) registerCardAbilities([entry])
}

const clone = value => JSON.parse(JSON.stringify(value))
const pick = id => c => c.options.some(option => option.id === id) ? id : null
// 反应能力窗口先选「desc:…」触发，再在该能力内部的选择里取指定分支。
const abilityThen = id => c => c.options.find(option => option.id.startsWith('desc:'))?.id
  ?? (c.options.some(option => option.id === id) ? id : null)

function transact(state, run, select = () => null, { save = false } = {}) {
  const execute = draft => run(draft)
  resolveTransaction(state, 0, { action: 'eoteInvestigatorTest' }, execute)
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 100, `选择循环 ${JSON.stringify(state.pendingChoice)}`)
    if (save) Object.assign(state, clone(state))
    const c = state.pendingChoice
    const id = select(c, state) ?? ['done', 'skip', 'self'].find(option => c.options.some(o => o.id === option)) ?? c.options[0]?.id
    const command = { action: 'choose', choiceId: c.id, optionId: id }
    assert.equal(choiceError(state, c.seat, command), null)
    resolveTransaction(state, c.seat, command, execute)
  }
}
function setup(code, count = 1) {
  const s = fixture('01001', count)
  s.abilityLimits = {}
  s.investigators[0].code = code
  s.investigators[0].originalCode = code
  s.investigators[0].beneath = []
  return s
}
const investigator = s => s.investigators[0]
// 在当前位置旁加一个已揭示地点并双向连接（距离 1）。
function linkLocation(s, from, id) {
  s.locations.push({ id, name: id, connections: [from], revealed: true, clues: 0, shroud: 1 })
  s.locations.find(location => location.id === from).connections.push(id)
  return id
}
const roundStarts = state => reactionWindow(state, 'roundStarts', { when: 'roundStarts' }, [])
const turnEnded = state => reactionWindow(state, 'turnEnded',
  { when: 'turnEnded', seat: 0, location: state.investigators[0].location }, [])
const rewardChoice = id => c => c.options.find(option => option.id.startsWith('desc:'))?.id
  ?? (c.source === '08007' && c.options.some(option => option.id === id) ? id : null)

test('P5 08007/08008/08009 专属条目注册与旧印 +1', () => {
  assert.ok(registeredEntry('08007'))
  assert.ok(registeredEntry('08008')); assert.equal(registeredEntry('08008').fast, true)
  assert.ok(registeredEntry('08009'))
  assert.deepEqual(registeredEntry('08007').investigator.elderSign, { bonus: 1 })
  const s = setup('08007')
  s.chaosBag = ['eldersign']
  let result
  transact(s, draft => { result = performTest(draft, 0, 'willpower', 0, {}) })
  assert.equal(result.value, getStat(s, investigator(s), 'willpower') + 1)
})

test('P5 08007 回合结束：距离 0 不触发、距离 1 二选一、距离 ≥2 两项都做', () => {
  const zero = setup('08007')
  linkLocation(zero, investigator(zero).location, 'eote-near-0')
  transact(zero, draft => roundStarts(draft))
  transact(zero, draft => turnEnded(draft))
  assert.equal(investigator(zero).resources, 30)
  assert.equal(investigator(zero).hand.length, 0)
  // 距离 1：抽牌分支。
  const one = setup('08007')
  const oneAdjacent = linkLocation(one, investigator(one).location, 'eote-near-1')
  transact(one, draft => roundStarts(draft))
  transact(one, draft => relocateInvestigator(draft, 0, oneAdjacent, []))
  const oneHand = investigator(one).hand.length
  transact(one, draft => turnEnded(draft), rewardChoice('draw'))
  assert.equal(investigator(one).hand.length, oneHand + 1)
  assert.equal(investigator(one).resources, 30)
  // 距离 1：资源分支。
  const res = setup('08007')
  const resAdjacent = linkLocation(res, investigator(res).location, 'eote-near-2')
  transact(res, draft => roundStarts(draft))
  transact(res, draft => relocateInvestigator(draft, 0, resAdjacent, []))
  transact(res, draft => turnEnded(draft), rewardChoice('resource'))
  assert.equal(investigator(res).resources, 31)
  // 距离 ≥2：两项都做（无选择）。
  const far = setup('08007')
  const hop1 = linkLocation(far, investigator(far).location, 'eote-hop-1')
  const hop2 = linkLocation(far, hop1, 'eote-hop-2')
  transact(far, draft => roundStarts(draft))
  transact(far, draft => relocateInvestigator(draft, 0, hop1, []))
  transact(far, draft => relocateInvestigator(draft, 0, hop2, []))
  const farHand = investigator(far).hand.length
  transact(far, draft => turnEnded(draft), rewardChoice('draw'))
  assert.equal(investigator(far).resources, 31)
  assert.equal(investigator(far).hand.length, farHand + 1)
})

test('P5 08007 旧印：本轮移动过则获得 1 资源或抽 1 张牌；未移动只有 +1', () => {
  const still = setup('08007')
  still.chaosBag = ['eldersign']
  let stillResult
  transact(still, draft => { stillResult = performTest(draft, 0, 'willpower', 0, {}) })
  assert.equal(stillResult.value, getStat(still, investigator(still), 'willpower') + 1)
  assert.equal(stillResult.success, true)
  for (const [choice, verify] of [
    ['draw', state => assert.equal(state.investigators[0].hand.length, 1)],
    ['resource', state => assert.equal(state.investigators[0].resources, 31)],
  ]) {
    const s = setup('08007')
    const inv = investigator(s)
    const adjacent = linkLocation(s, inv.location, `eote-elder-${choice}`)
    transact(s, draft => roundStarts(draft))
    transact(s, draft => relocateInvestigator(draft, 0, adjacent, []))
    s.chaosBag = ['eldersign']
    let result
    transact(s, draft => { result = performTest(draft, 0, 'willpower', 0, {}) }, c => (c.source === '08007' ? choice : null))
    assert.equal(result.value, getStat(s, inv, 'willpower') + 1)
    verify(s)
  }
})

test('P5 08007 轮初记录起始地点并经 JSON 往返', () => {
  const s = setup('08007')
  const here = investigator(s).location
  transact(s, draft => roundStarts(draft))
  const restored = migrateState(clone(s)).state
  assert.equal(createMechanicsApi(restored).roundDistance.startLocation(0), here)
  assert.equal(createMechanicsApi(restored).roundDistance.distance(0), 0)
})

test('P5 08008 长鞭：使用敏捷攻击；成功可横置自动躲避或 +1 伤害；已横置不再询问', () => {
  const descriptor = () => registeredEntry('08008').abilities[0]
  const attack = (s, select) => transact(s, draft => executeDescriptor(draft, {
    inv: draft.investigators[0], source: draft.investigators[0].assets.find(item => item.code === '08008'),
    descriptor: descriptor(), alreadyPaid: true, context: { targetId: draft.enemies[0].id }, events: [],
  }), select)
  // 敏捷而非战斗：Roland 战斗 4 / 敏捷 2；难度 3 → 只有按战斗结算才会成功。
  const agility = setup('08007')
  asset(agility, '08008', { exhausted: false })
  enemy(agility, { fight: 3, evade: 3, health: 5, engagedSeat: 0 })
  agility.chaosBag = ['0']
  attack(agility)
  assert.equal(agility.enemies[0].damageTaken, 0, '使用敏捷（2）时对战斗值 3 的攻击应失败')
  // 成功 +1 伤害分支。
  const damage = setup('08007')
  asset(damage, '08008', { exhausted: false })
  enemy(damage, { fight: 2, evade: 2, health: 5, engagedSeat: 0 })
  damage.chaosBag = ['0']
  attack(damage, c => (c.kind === 'effect' ? 'damage' : null))
  assert.equal(damage.enemies[0].damageTaken, 2)
  assert.equal(damage.investigators[0].assets.find(item => item.code === '08008').exhausted, true)
  // 成功自动躲避分支。
  const evade = setup('08007')
  asset(evade, '08008', { exhausted: false })
  enemy(evade, { fight: 2, evade: 2, health: 5, engagedSeat: 0 })
  evade.chaosBag = ['0']
  attack(evade, c => (c.kind === 'effect' ? 'evade' : null))
  assert.equal(evade.enemies[0].damageTaken, 1)
  assert.equal(evade.enemies[0].exhausted, true)
  // 已横置：不再询问、不加伤害。
  const spent = setup('08007')
  asset(spent, '08008', { exhausted: true })
  enemy(spent, { fight: 2, evade: 2, health: 5, engagedSeat: 0 })
  spent.chaosBag = ['0']
  attack(spent, c => (c.kind === 'effect' ? 'damage' : null))
  assert.equal(spent.enemies[0].damageTaken, 1)
})

test('P5 08009 被埋葬的秘密：威胁区、可调查地点移动锁、调查成功弃掉', () => {
  const s = setup('08007')
  s.investigators[0].deck.push('08009')
  transact(s, draft => drawCards(draft, draft.investigators[0], 1, []))
  const inv = investigator(s)
  const threat = inv.threat.find(card => card.code === '08009')
  assert.ok(threat, '显现后应进入威胁区')
  // 可调查地点：不能移动。
  const adjacent = linkLocation(s, inv.location, 'eote-buried-adjacent')
  assert.ok(movementError(s, inv, adjacent), '可调查地点应禁止移动')
  assert.equal(legalMoves(s).some(move => move.action === 'move'), false)
  // [action] 调查成功：弃掉本卡而不是发现线索。
  const cluesBefore = s.locations.find(location => location.id === inv.location).clues
  s.chaosBag = ['0']
  const investigateDescriptor = registeredEntry('08009').abilities.find(descriptor => descriptor.kind === 'action')
  transact(s, draft => executeDescriptor(draft, {
    inv: draft.investigators[0], source: draft.investigators[0].threat.find(card => card.code === '08009'),
    descriptor: investigateDescriptor, events: [],
  }))
  const after = investigator(s)
  assert.equal(s.locations.find(location => location.id === after.location).clues, cluesBefore, '成功时不发现线索')
  assert.equal(after.threat.some(card => card.code === '08009'), false)
  assert.ok(after.discard.includes('08009'))
})

test('P5 08009 调查失败：可选 2 恐惧洗回牌库；JSON 往返保留威胁区', () => {
  const s = setup('08007')
  s.investigators[0].deck.push('08009')
  transact(s, draft => drawCards(draft, draft.investigators[0], 1, []))
  const threat = investigator(s).threat.find(card => card.code === '08009')
  const restored = migrateState(clone(s)).state
  assert.ok(restored.investigators[0].threat.some(card => card.code === '08009'), 'JSON 往返后仍在威胁区')
  s.chaosBag = ['autofail']
  transact(s, draft => executeDescriptor(draft, {
    inv: draft.investigators[0], source: draft.investigators[0].threat.find(card => card.code === '08009'),
    descriptor: registeredEntry('08009').abilities.find(descriptor => descriptor.kind === 'action'), events: [],
  }), c => (c.source === '08009' ? 'horror' : null))
  const inv = investigator(s)
  assert.equal(inv.horror, 2)
  assert.equal(inv.threat.some(card => card.code === '08009'), false)
  assert.ok(inv.deck.includes('08009'), '失败分支应洗回牌库')
})
