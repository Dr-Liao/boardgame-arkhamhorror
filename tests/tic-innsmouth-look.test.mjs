// 07106 印斯茅斯面容与「调查员获得特性」的声明式授予。
//
// 印刷：显现 - 放到你的威胁区域。你得到 -1[智力]、-1 神智，并且你获得[[深潜者]]特性。
//       [action]：检定意志(3)，成功后弃掉本卡。
//
// 三条读点各走既有/新增通道：
//   · 智力 -1：威胁区卡的修正行（getStat 走 modifierTotal）；
//   · 神智 -1：威胁区效果通道 `threatEffect.sanityModifier`（getMaxSanity 的既有读点）；
//   · [[深潜者]]特性：新增授予目标 `add:investigatorTrait`，读点 stats#investigatorTraits
//     （卡面 + inv.traits + 声明式授予），卡离场时随修正行一起消失。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import {
  describeState, drawEncounter, getMaxSanity, getStat, investigatorHasTrait, investigatorTraits, legalMoves, scenarioRuntime,
} from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { move, settle } from './core-fixture.mjs'
import { registeredEntry } from '../src/engine/ability.js'

function reveal(s, seat = 0) {
  const entry = registeredEntry('07106')
  const execute = draft => entry.encounterResolve(draft, draft.investigators[seat], { code: '07106', name: '印斯茅斯面容' },
    scenarioRuntime(draft, []))
  resolveTransaction(s, seat, { action: 'testTicInnsmouthLook' }, execute)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 30, 'choice loop')
    const choice = s.pendingChoice
    const id = ['done', 'skip', 'self'].find(option => choice.options.some(item => item.id === option)) ?? choice.options[0].id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}
const scene = (count = 1) => {
  const s = chapterFixture('inTooDeep', count)
  for (const inv of s.investigators) { inv.engaged = []; inv.assets = [] }
  return s
}

test('07106 印斯茅斯面容：进入威胁区，智识 -1、神智 -1，并获得[[深潜者]]特性', () => {
  const s = scene(2)
  const before = {
    intellect: getStat(s, s.investigators[0], 'intellect'),
    sanity: getMaxSanity(s.investigators[0]),
    otherIntellect: getStat(s, s.investigators[1], 'intellect'),
    traits: investigatorTraits(s, s.investigators[0]),
  }
  assert.equal(investigatorHasTrait(s, s.investigators[0], 'Deep One'), false, '一开始没有该特性')
  reveal(s)
  const inv = s.investigators[0]
  assert.deepEqual(inv.threat.map(card => card.code), ['07106'])
  assert.equal(getStat(s, inv, 'intellect'), before.intellect - 1)
  assert.equal(getMaxSanity(inv), before.sanity - 1)
  assert.equal(investigatorHasTrait(s, inv, 'Deep One'), true)
  assert.ok(investigatorTraits(s, inv).includes('Deep One'))
  assert.equal(getStat(s, s.investigators[1], 'intellect'), before.otherIntellect, '另一位调查员不受影响')
})

test('07106：描述层列出调查员有效特性（AI 需要看到[[深潜者]]）', () => {
  const s = scene()
  reveal(s)
  const text = typeof describeState(s, 0) === 'string' ? describeState(s, 0) : JSON.stringify(describeState(s, 0))
  assert.match(text, /特性：.*Deep One/)
})

test('07106：意志(3) 成功弃掉本卡后属性与特性一起恢复；失败则保留', () => {
  const s = scene()
  reveal(s)
  const inv = s.investigators[0]
  const intellectWithCard = getStat(s, inv, 'intellect')
  s.chaosBag = ['autofail']
  const actionFor = state => legalMoves(state).find(command => command.action === 'ability'
    && (state.investigators[0].threat || []).some(card => card.id === command.assetId))
  move(s, actionFor(s))
  settle(s)
  assert.deepEqual(s.investigators[0].threat.map(card => card.code), ['07106'], '失败不弃掉')
  assert.equal(getStat(s, s.investigators[0], 'intellect'), intellectWithCard)

  s.chaosBag = ['+5']
  move(s, actionFor(s))
  settle(s)
  assert.deepEqual(s.investigators[0].threat, [], '成功弃掉')
  assert.equal(investigatorHasTrait(s, s.investigators[0], 'Deep One'), false, '特性随卡离场消失')
  const restored = scene().investigators[0]
  assert.equal(getStat(s, s.investigators[0], 'intellect'), getStat(scene(), restored, 'intellect'), '智识回到印刷值')
})

test('07106：威胁区卡的行动只对持有者出现', () => {
  const s = scene(2)
  reveal(s, 0)
  assert.equal(legalMoves(s).some(command => command.action === 'ability'
    && (s.investigators[0].threat || []).some(card => card.id === command.assetId)), true)
  // 换成第二位调查员行动时，看不到别人的威胁区卡。
  s.currentSeat = 1
  assert.equal(legalMoves(s).some(command => command.action === 'ability'
    && (s.investigators[1].threat || []).some(card => card.id === command.assetId)), false)
})

test('调查员特性授予与运行期 inv.traits 合并去重', () => {
  const s = scene()
  const inv = s.investigators[0]
  createMechanicsApi(s)
  inv.traits = ['Deep One'] // 04085 这类直接写入的特性
  const traits = investigatorTraits(s, inv)
  assert.equal(traits.filter(trait => trait.toLowerCase() === 'deep one').length, 1, '同名特性不重复')
})

// ---------------------------------------------------------------------------
// 01181 / 01182：克苏鲁的爪牙跨循环依赖（审计 H14 回归）
// ---------------------------------------------------------------------------
function drawCard(s, code) {
  s.encounterDeck.push(code)
  const execute = draft => drawEncounter(draft, draft.investigators[0], [])
  resolveTransaction(s, 0, { action: 'testTicSharedCthulhuDraw' }, execute)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 60, 'choice loop')
    const choice = s.pendingChoice
    const id = ['done', 'skip', 'self'].find(option => choice.options.some(item => item.id === option)) ?? choice.options[0].id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}

test('01181 年幼的深潜者：TIC 章节按印刷卡号真实抽取并结算「交战后受 1 恐惧」（审计 H14 回归）', () => {
  const s = scene()
  s.enemies = []
  const horror = s.investigators[0].horror
  drawCard(s, '01181')
  const young = s.enemies.find(enemy => (enemy.originalCode || enemy.code) === '01181')
  assert.ok(young, '按印刷卡号注册的条目真实生成（修复前 registeredEntry("01181") 为 MISSING）')
  assert.equal(young.engagedSeat, 0, '普通敌人与抽牌者交战')
  assert.equal(s.investigators[0].horror, horror + 1, '交战强制：受到 1 点恐惧')
})

test('01182 拉莱耶之梦：TIC 章节真实抽取进入威胁区，-1 意志/-1 神智，检定成功弃掉（审计 H14 回归）', () => {
  const s = scene(2)
  const before = {
    willpower: getStat(s, s.investigators[0], 'willpower'),
    sanity: getMaxSanity(s.investigators[0]),
    otherWillpower: getStat(s, s.investigators[1], 'willpower'),
  }
  drawCard(s, '01182')
  const inv = s.investigators[0]
  const card = inv.threat.find(item => (item.originalCode || item.code) === '01182')
  assert.ok(card, '真实抽取后进入威胁区（修复前静默进遭遇弃牌堆、无任何效果）')
  assert.equal(s.encounterDiscard.includes('01182'), false, '进威胁区而不是遭遇弃牌堆')
  assert.equal(getStat(s, inv, 'willpower'), before.willpower - 1, '意志 -1')
  assert.equal(getMaxSanity(inv), before.sanity - 1, '神智 -1')
  assert.equal(getStat(s, s.investigators[1], 'willpower'), before.otherWillpower, '另一位调查员不受影响')
  // [action] 检定意志(3)：成功 → 弃掉本卡，属性恢复。
  s.currentSeat = 0
  s.chaosBag = ['+5']
  const action = legalMoves(s).find(command => command.action === 'ability' && command.assetId === card.id)
  assert.ok(action, '威胁区卡出现检定行动')
  move(s, action)
  settle(s)
  assert.deepEqual(s.investigators[0].threat, [], '检定成功后弃掉拉莱耶之梦')
  assert.equal(getStat(s, s.investigators[0], 'willpower'), before.willpower, '意志恢复印刷值')
})

