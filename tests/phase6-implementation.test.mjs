// Phase 6 · 6e-1：卡牌实现账本（src/cards/card-implementation.js）
//
// 这一层的契约只有三条：
//   1. 「有没有实现」与「实现走哪条通道」与 EFFECTS 条目的形状解耦；
//   2. 摘要形状固定、纯 JSON、不暴露原始条目对象（AI 上下文与图鉴共用）；
//   3. 纯登记条目 / 卡面数据即实现的卡（data 通道）仍算已实现。
//
// Phase 6 收尾（6e-16）之后 EFFECTS 已经清空，所以「旧 DSL / 混合」两条通道改用
// **临时注入的合成条目**来验证账本本身（生产内容不会再有 legacy 条目）。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DATA_IMPLEMENTED_CODES, implementation, implementationChannel, implementationSummary,
  isRegistrationOnly, legacyEntry,
} from '../src/cards/card-implementation.js'
import { EFFECTS } from '../src/cards/card-effects.js'
import { PLAYER_CARD_CODES, isCardAvailable } from '../src/deck/availability.js'
import { isPlayable } from '../src/deck/deckbuilding.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

// 临时注入一条旧 DSL 条目，用完删除（验证账本的 legacy / hybrid 分支）。
function withLegacy(code, entry, run) {
  const previous = EFFECTS[code]
  EFFECTS[code] = entry
  try { return run() } finally {
    if (previous === undefined) delete EFFECTS[code]
    else EFFECTS[code] = previous
  }
}

test('实现账本：通道分类覆盖描述子 / 旧 DSL / 混合 / 数据 / 未实现', () => {
  assert.equal(implementationChannel('01022'), 'descriptor') // 6e-8 起快速反应事件走 played 描述子
  assert.equal(implementationChannel('01001'), 'descriptor') // 调查员旧印（描述子）
  assert.equal(implementationChannel('03009'), 'descriptor') // 6e-14 起能力与「不可离场」都在条目上
  assert.equal(implementationChannel('01094'), 'data') // 印刷承伤：卡面数据即实现
  assert.equal(implementation('01094').implemented, true)
  assert.equal(implementationChannel('01666'), 'none') // 数据里没有这张卡
  assert.equal(implementation('01666').implemented, false)
  assert.equal(implementationSummary('01666'), null)
  // 合成条目：只有旧 DSL ⇒ legacy；与描述子并存 ⇒ hybrid
  withLegacy('01666', { event: { type: 'gainResource', amount: 1 } }, () => {
    assert.equal(implementationChannel('01666'), 'legacy')
    assert.equal(implementation('01666').implemented, true)
    assert.equal(implementationSummary('01666').abilities[0].effects[0], 'gainResource')
  })
  withLegacy('01022', { event: { type: 'gainResource', amount: 1 } }, () => {
    assert.equal(implementationChannel('01022'), 'hybrid')
  })
  assert.equal(implementationChannel('01022'), 'descriptor')
  // 纯登记：条目只带 engine / note 标记时不改变实现判定
  withLegacy('01666', { engine: 'printedSoak' }, () => {
    assert.equal(implementationChannel('01666'), 'data')
  })
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
    if (legacyEntry(code)) assert.notEqual(summary, legacyEntry(code))
  }
})

test('实现账本：描述子摘要按能力规则重建，旧 DSL 摘要同形状', () => {
  const migrated = implementationSummary('01022')
  assert.equal(migrated.channel, 'descriptor')
  assert.deepEqual(migrated.abilities.map(ability => ability.effects), [['discoverClue']])
  assert.deepEqual(migrated.abilities[0].trigger, ['defeatEnemy'])
  assert.equal(migrated.abilities[0].rules.includes('fast'), true)
  // 旧 DSL 的合成条目产出同一形状（迁移前后 AI 看到的字段一致）
  withLegacy('01666', { fast: true, reaction: { when: 'defeatEnemy', selfOnly: true }, event: { type: 'discoverClue', amount: 1 } }, () => {
    const legacy = implementationSummary('01666')
    assert.equal(legacy.channel, 'legacy')
    assert.deepEqual(legacy.abilities.map(ability => ability.effects), [['discoverClue']])
    assert.deepEqual(legacy.abilities[0].trigger, ['defeatEnemy'])
    assert.deepEqual(legacy.abilities[0].rules, ['selfOnly:true'])
    assert.deepEqual(legacy.rules, { fast: true })
  })
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

test('实现账本：条目级规则字段仍进摘要（描述子通道）', () => {
  const summary = implementationSummary('03009')
  assert.equal(summary.channel, 'descriptor')
  assert.equal(summary.rules.cannotLeavePlay, true)
  assert.deepEqual(summary.modifiers, [{ target: 'skill:*', amount: -1 }])
  const stone = implementationSummary('04230')
  assert.equal(stone.rules.usesFromStoneRecord, true)
})
