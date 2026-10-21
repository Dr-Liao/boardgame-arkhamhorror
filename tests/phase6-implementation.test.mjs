// Phase 6 · 6e-1：卡牌实现账本（src/cards/card-implementation.js）
//
// 这一层的契约只有三条：
//   1. 「有没有实现」与「实现走哪条通道」与 EFFECTS 条目的形状解耦；
//   2. 摘要形状固定、纯 JSON、不暴露原始条目对象（AI 上下文与图鉴共用）；
//   3. 纯登记条目（printedSoak / 空占位）仍算已实现 —— 这是删除它们的前提。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DATA_IMPLEMENTED_CODES, implementation, implementationChannel, implementationSummary,
  isRegistrationOnly, legacyEntry,
} from '../src/cards/card-implementation.js'
import { PLAYER_CARD_CODES, isCardAvailable } from '../src/deck/availability.js'
import { isPlayable } from '../src/deck/deckbuilding.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

test('实现账本：通道分类覆盖描述子 / 旧 DSL / 混合 / 数据 / 未实现', () => {
  assert.equal(implementationChannel('01022'), 'descriptor') // 6e-8 起快速反应事件走 played 描述子
  assert.equal(implementationChannel('01086'), 'legacy') // 仍是旧 DSL 的 abilities 条目
  assert.equal(implementationChannel('01001'), 'descriptor') // 调查员旧印（描述子）
  assert.equal(implementationChannel('03009'), 'hybrid') // 已迁走的被动 + 旧 DSL 残留字段
  assert.equal(implementationChannel('01094'), 'data') // 印刷承伤：卡面数据即实现
  assert.equal(implementation('01094').implemented, true)
  assert.equal(implementationChannel('01666'), 'none') // 数据里没有这张卡
  assert.equal(implementation('01666').implemented, false)
  assert.equal(implementationSummary('01666'), null)
})

test('实现账本：纯登记条目仍算已实现（删除前的前提）', () => {
  assert.equal(isRegistrationOnly({ engine: 'printedSoak' }), true)
  assert.equal(isRegistrationOnly({}), true)
  assert.equal(isRegistrationOnly({ fast: true }), false)
  assert.equal(isRegistrationOnly({ reaction: { when: 'treasure' } }), false)
  for (const code of DATA_IMPLEMENTED_CODES) {
    assert.equal(implementation(code).implemented, true, `${code} 应仍然算已实现`)
  }
})

test('实现账本：摘要形状固定、纯 JSON、不含原始条目引用', () => {
  const codes = ['01001', '01022', '03009', '01014', '01117', '01094', '04230']
  for (const code of codes) {
    const summary = implementationSummary(code)
    assert.ok(summary, `${code} 应有摘要`)
    assert.deepEqual(Object.keys(summary), [
      'channel', 'abilities', 'modifiers', 'playCondition', 'elderSign', 'uses', 'rules', 'simplified', 'note',
    ], `${code} 的键序必须固定`)
    assert.deepEqual(JSON.parse(JSON.stringify(summary)), summary, `${code} 的摘要必须可 JSON 往返`)
    // AI 侧只应拿到重建后的结构，而不是 EFFECTS 条目的引用。
    if (legacyEntry(code)) assert.notEqual(summary, legacyEntry(code))
  }
})

test('实现账本：旧 DSL 摘要按能力规则重建，不泄漏 engine 登记标记', () => {
  // 6e-8 之后 01022 是描述子通道；旧 DSL 的摘要仍按同形状重建（01086 刀子）。
  const migrated = implementationSummary('01022')
  assert.equal(migrated.channel, 'descriptor')
  assert.deepEqual(migrated.abilities.map(ability => ability.effects), [['discoverClue']])
  assert.deepEqual(migrated.abilities[0].trigger, ['defeatEnemy'])
  assert.equal(migrated.abilities[0].rules.includes('fast'), true)
  const legacy = implementationSummary('01086')
  assert.equal(legacy.channel, 'legacy')
  assert.deepEqual(legacy.abilities.map(ability => ability.effects), [['fight'], ['fight']])
  for (const code of ['01014', '01094', '01117']) {
    const value = implementationSummary(code)
    assert.equal(Object.prototype.hasOwnProperty.call(value.rules || {}, 'engine'), false,
      `${code} 的摘要不应再暴露 engine 标记`)
  }
})

test('实现账本：isPlayable 与账本判定一致（玩家卡全量）', () => {
  for (const code of PLAYER_CARD_CODES) {
    const card = ALL_CARDS[code]
    if (!card) continue
    const expected = card.dataStatus !== 'quarantined' && isCardAvailable(code) && implementation(code).implemented
    assert.equal(isPlayable(card), Boolean(expected), `${code} 的可用性判定与账本不一致`)
  }
})

test('实现账本：规则字段从条目搬走后仍能读出（混合通道）', () => {
  const summary = implementationSummary('03009')
  assert.equal(summary.channel, 'hybrid')
  assert.equal(summary.rules.cannotLeavePlay, true)
  assert.deepEqual(summary.modifiers, [{ target: 'skill:*', amount: -1 }])
  const stone = implementationSummary('04230')
  assert.equal(stone.rules.usesFromStoneRecord, true)
  assert.equal(stone.rules.usesType, 'secrets')
})
