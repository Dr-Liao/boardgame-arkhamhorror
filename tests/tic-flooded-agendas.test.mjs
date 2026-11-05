// 印斯茅斯「深陷其中」的四张压迫议程（07124–07127）与「不能谈判」读点。
//
// 印刷：四张议程同文不同潮——
//   「每个[[嫌犯]]敌人失去冷漠，并且不能与之谈判。
//     强制 - 在你回合结束时，如果你位于完全淹没的地点：受到1点伤害[和1点恐惧][，并随机弃掉N张手牌]。」
//
// 引擎侧新增两条实体规则目标：`loses:aloof`（冷漠读点 enemyIsAloof 消费）与 `cannot:parley`
// （parley.js 的 parleyForbidden 消费，合法性枚举与执行前校验共用）；调查员侧的
// 「不能谈判」走既有的 `capability:parley`。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { enemy, legalMoves, move, settle, validateMove } from './core-fixture.mjs'
import { aloofPreventsAttack, scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { entityRuleActive } from '../src/engine/modifiers.js'
import { parleyForbidden } from '../src/engine/parley.js'

// 真实事务推进（内容层 agendaReveal → 条目 agendaRule.onReveal）。
function run(state, execute) {
  const executeOnce = draft => {
    try { return execute(draft) } catch (error) {
      if (error.constructor?.name !== 'ScenarioEnded') throw error
    }
  }
  resolveTransaction(state, 0, { action: 'testTicFloodedAgendas' }, executeOnce)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 150, 'TIC 深陷危局议程 choice loop')
    const choice = state.pendingChoice
    const optionId = ['done', 'skip', 'self'].find(id => choice.options.some(option => option.id === id))
      ?? choice.options[0].id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, executeOnce)
  }
}

// 只在测试进程登记的「可谈判敌人」与「调查员不能谈判」的威胁卡。
const parleyProbe = {
  code: 'ticParleyProbe', scope: 'enemy',
  abilities: [{ kind: 'action', actionKind: 'parley', label: '谈判：测试用', cost: { action: 1 }, resolve: () => {} }],
}
const noParleyThreat = {
  code: 'ticNoParleyThreat', scope: 'treachery',
  modifiers: [{ target: 'capability:parley' }], abilities: [],
}
for (const entry of [parleyProbe, noParleyThreat]) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

function scene(count = 1, agendaCode = null) {
  const s = chapterFixture('inTooDeep', count)
  s.enemies = []
  for (const inv of s.investigators) { inv.engaged = []; inv.assets = [] }
  if (agendaCode) s.agendas[s.agendaIndex] = { ...s.agendas[s.agendaIndex], code: agendaCode, originalCode: agendaCode }
  return s
}
const suspect = (s, extra = {}) => enemy(s, { code: '07076', aloof: true, printedAloof: true, engagedSeat: null,
  clues: 2, traits: ['Humanoid', 'Monster', 'Suspect'], health: 6, ...extra })
const notSuspect = (s, extra = {}) => enemy(s, { code: 'ticParleyProbe', aloof: true, printedAloof: true,
  engagedSeat: null, traits: ['Humanoid', 'Monster'], health: 6, ...extra })

test('07124 路障重重：只有[[嫌犯]]敌人失去冷漠，其他人保持冷漠', () => {
  const s = scene()
  const target = suspect(s)
  const other = notSuspect(s)
  const inv = s.investigators[0]
  assert.equal(entityRuleActive(s, target, 'loses:aloof'), true)
  assert.equal(aloofPreventsAttack(s, inv, target), false, '嫌犯失去冷漠后可以被攻击')
  assert.equal(entityRuleActive(s, other, 'loses:aloof'), false)
  assert.equal(aloofPreventsAttack(s, inv, other), true, '非嫌犯仍然冷漠')
})

test('07124 路障重重：[[嫌犯]]敌人不能与之谈判（合法行动与提交校验同一读点）', () => {
  const s = scene()
  const target = suspect(s)
  const inv = s.investigators[0]
  assert.equal(entityRuleActive(s, target, 'cannot:parley'), true)
  assert.equal(parleyForbidden(s, inv, target), true)
  assert.equal(legalMoves(s).some(command => command.action === 'entityAbility' && command.entityId === target.id), false)
  const forged = validateMove(s, 0, { action: 'entityAbility', entityType: 'enemy', entityId: target.id, abilityIndex: 0 })
  assert.match(String(forged), /谈判/, '伪造的谈判命令必须被拒绝')
  // 对照：可谈判的敌人仍然出现行动。
  const other = notSuspect(s)
  assert.ok(legalMoves(s).some(command => command.action === 'entityAbility' && command.entityId === other.id))
})

test('capability:parley：调查员「不能谈判」时所有谈判行动都不再合法', () => {
  const s = scene()
  const other = notSuspect(s)
  s.investigators[0].threat.push({ id: 'c1', code: 'ticNoParleyThreat' })
  assert.equal(legalMoves(s).some(command => command.action === 'entityAbility' && command.entityId === other.id), false)
  const forged = validateMove(s, 0, { action: 'entityAbility', entityType: 'enemy', entityId: other.id, abilityIndex: 0 })
  assert.match(String(forged), /谈判/)
})

test('压迫议程的规则只在它是当前幕/议程时生效', () => {
  // 2026-11-04 合并后修正：达贡巢穴的当前幕 07280「第一誓约」印刷就带
  // 「每个[[嫌犯]]敌人…失去冷漠、不能谈判」，因此在那里应生效；
  // 换到没有该规则的章节（绝望深坑）后，嫌犯不再「失去冷漠 / 不能谈判」。
  const lair = chapterFixture('theLairOfDagon')
  lair.enemies = []
  for (const inv of lair.investigators) { inv.engaged = []; inv.assets = [] }
  const lairTarget = suspect(lair)
  assert.equal(entityRuleActive(lair, lairTarget, 'loses:aloof'), true, '07280 当前幕的嫌犯规则应生效')
  assert.equal(entityRuleActive(lair, lairTarget, 'cannot:parley'), true, '07280 当前幕的嫌犯规则应生效')

  const s = chapterFixture('thePitOfDespair')
  s.enemies = []
  for (const inv of s.investigators) { inv.engaged = []; inv.assets = [] }
  const target = suspect(s)
  assert.equal(entityRuleActive(s, target, 'loses:aloof'), false)
  assert.equal(entityRuleActive(s, target, 'cannot:parley'), false)
  assert.equal(aloofPreventsAttack(s, s.investigators[0], target), true)
})

test('07124：完全淹没地点的回合结束受到 1 点伤害，部分淹没不触发', () => {
  const s = scene(1)
  const inv = s.investigators[0]
  createMechanicsApi(s).water.set(inv.location, 2)
  const damage = inv.damage, horror = inv.horror
  for (const each of s.investigators) each.actionsLeft = 0
  move(s, legalMoves(s).find(command => command.action === 'endTurn'))
  settle(s)
  assert.equal(s.investigators[0].damage - damage, 1)
  assert.equal(s.investigators[0].horror - horror, 0, '07124 只有伤害')

  const partial = scene(1)
  const partialInv = partial.investigators[0]
  createMechanicsApi(partial).water.set(partialInv.location, 1)
  const partialDamage = partialInv.damage
  for (const each of partial.investigators) each.actionsLeft = 0
  move(partial, legalMoves(partial).find(command => command.action === 'endTurn'))
  settle(partial)
  assert.equal(partial.investigators[0].damage - partialDamage, 0, '部分淹没不触发')
})

test('07125–07127：伤害/恐惧逐张递增，随机弃牌数量按印刷', () => {
  for (const [code, expectedHorror, expectedDiscards] of [['07125', 1, 0], ['07126', 1, 1], ['07127', 1, 2]]) {
    const s = scene(1, code)
    const inv = s.investigators[0]
    createMechanicsApi(s).water.set(inv.location, 2)
    inv.hand = ['01032', '01033', '01034', '01035']
    const damage = inv.damage, horror = inv.horror, hand = inv.hand.length
    for (const each of s.investigators) each.actionsLeft = 0
    move(s, legalMoves(s).find(command => command.action === 'endTurn'))
    settle(s)
    const after = s.investigators[0]
    assert.equal(after.damage - damage, 1, `${code} 伤害`)
    assert.equal(after.horror - horror, expectedHorror, `${code} 恐惧`)
    // 维持阶段会补抽 1 张，所以净变化 = 抽牌 - 随机弃牌。
    assert.equal(hand + 1 - after.hand.length, expectedDiscards, `${code} 随机弃牌数量`)
  }
})

test('07125 无情浪潮背面：愤怒暴民生成在印斯茅斯广场 07139 并携带 1 把未揭示钥匙（审计 H8 回归）', () => {
  const s = chapterFixture('inTooDeep', 1)
  s.enemies = []
  s.agendaIndex = 1
  assert.equal((s.agendas[1].originalCode || s.agendas[1].code), '07125')
  const square = s.locations.find(location => (location.originalCode || location.code) === '07139')
  assert.ok(square, '《深陷危局》的印斯茅斯广场是 07139（修复前硬编码哈珀章的 07065，整段失效）')
  assert.ok(s.scenarioZones.setAside.includes('07062b'), '愤怒暴民在旁置区')
  run(s, draft => scenarioRuntime(draft, []).advanceAgenda())
  const mob = s.enemies.find(entity => (entity.originalCode || entity.code) === '07062b')
  assert.ok(mob, '愤怒暴民真实生成')
  assert.equal(mob.location, square.id, '生成在印斯茅斯广场')
  assert.equal(s.scenarioZones.setAside.includes('07062b'), false, '旁置区取走该卡（区域守恒）')
  const held = Object.entries(s.scenarioFlags.mechanics.keys)
    .filter(([, key]) => key.holder === `enemy:${mob.id}`)
  assert.equal(held.length, 1, '在暴民上随机放置 1 把钥匙')
  assert.equal(held[0][1].revealed, false, '放置的钥匙未揭示')
})
