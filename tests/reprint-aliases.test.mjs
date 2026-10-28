// P2-4（2026-10-28）重印别名 + 快速事件统一通道。
//
// 两条约定：
//   1. 同一张印刷卡只保留 canonical（01xx）实现；015xx/60xxx 重印号在注册期生成
//      「只改 code 的别名条目」（数据在 src/cards/entries/_reprint-aliases.js，
//      事实源是 cards-data 的 duplicateOfCode）。
//   2. 快速事件只有一条通道：played+fast 与 reaction+fromHand+quickEvent 都由
//      ability.js#quickEventView 归一，reactionWindow 枚举、assets.js#playReactionCard 执行。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { fixture } from './core-fixture.mjs'
import { runtimeCardAvailable } from '../src/engine/engine.js'
import {
  quickEventView, registerCardAbilities, registeredEntry,
} from '../src/engine/ability.js'
import { playAccess } from '../src/engine/play-condition.js'
import { REPRINT_ALIASES, reprintAliasesFor } from '../src/cards/card-identity.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const entryFile = code => `${ROOT}src/cards/entries/${code}.js`

test('P2-4 重印别名表与 cards-data 的双向关系一致，且别名号没有自己的条目文件', () => {
  const pairs = Object.entries(REPRINT_ALIASES)
  assert.ok(pairs.length > 0, '重印别名表不能为空')
  for (const [canonical, aliases] of pairs) {
    assert.ok(existsSync(entryFile(canonical)), `${canonical} 必须有自己的 canonical 条目文件`)
    assert.ok(registeredEntry(canonical), `${canonical} 必须已注册`)
    for (const alias of aliases) {
      assert.equal(ALL_CARDS[alias]?.duplicateOfCode, canonical,
        `cards-data 里 ${alias} 的 duplicateOfCode 必须指向 ${canonical}`)
      assert.equal(ALL_CARDS[canonical]?.duplicatedBy?.includes(alias), true,
        `cards-data 里 ${canonical} 的 duplicatedBy 必须包含 ${alias}`)
      assert.equal(existsSync(entryFile(alias)), false, `${alias} 是别名，不能有自己的条目文件`)
    }
  }
  assert.equal(reprintAliasesFor('01022').includes('01522'), true)
  assert.equal(reprintAliasesFor('02080'), null)
})

test('P2-4 重印别名在注册期生成与 canonical 相同的能力形状', () => {
  for (const [canonical, aliases] of Object.entries(REPRINT_ALIASES)) {
    const canonicalEntry = registeredEntry(canonical)
    for (const alias of aliases) {
      const aliasEntry = registeredEntry(alias)
      assert.ok(aliasEntry, `${alias} 必须通过注册期别名生成`)
      assert.equal(aliasEntry.kind, canonicalEntry.kind)
      const shape = entry => entry.abilities.map(ability => [
        ability.kind, ability.trigger.join(','), ability.fast === true, ability.legacyReaction === true,
        ability.target ? ability.target.kind : null,
      ])
      assert.deepEqual(shape(aliasEntry), shape(canonicalEntry), `${alias} 的能力形状必须与 ${canonical} 相同`)
      assert.deepEqual(aliasEntry.modifiers.length, canonicalEntry.modifiers.length)
    }
  }
})

test('P2-4 重印别名沿 canonical 的运行时可用性；构筑可用性仍在 deck 层', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  // 015xx 在 deck/牌池层是 catalog-only；运行时按 canonical 的可用性放行，
  // 否则重印号在反应窗口里会被 runtimeCardAvailable 过滤掉。
  for (const [canonical, aliases] of Object.entries(REPRINT_ALIASES)) {
    assert.equal(runtimeCardAvailable(state, inv, canonical), true, `${canonical} 运行时可用`)
    for (const alias of aliases) assert.equal(runtimeCardAvailable(state, inv, alias), true, `${alias} 沿 canonical 运行时可用`)
  }
})

test('P2-4 快速事件统一通道：两种写法归一到同一份候选视图', () => {
  // 旧写法（played+fast）：01022/01023 等 40+ 张 A 支卡；golden 13 局锁定了它的展示方言。
  const played = quickEventView('01022')
  assert.equal(played?.style, 'played')
  assert.deepEqual(played.descriptor.trigger, ['defeatEnemy'])
  assert.equal(playAccess('01022').reactionOnly, true, '快速事件不能当普通行动打出')

  // 新写法（reaction+fromHand+quickEvent）：统一通道接受的第二种数据形状。
  const testCode = 'test-p24-quick-event'
  if (!registeredEntry(testCode)) {
    registerCardAbilities({
      code: testCode,
      abilities: [{
        kind: 'reaction', label: '测试快速事件', trigger: 'defeatEnemy',
        fromHand: true, quickEvent: true, resolve: () => {},
      }],
    })
  }
  const reaction = quickEventView(testCode)
  assert.equal(reaction?.style, 'reaction')
  assert.equal(reaction.descriptor.quickEvent, true)
  assert.deepEqual(reaction.descriptor.trigger, ['defeatEnemy'])
  assert.equal(reaction.descriptor.fromHand, true, 'quickEvent 隐式 fromHand')
  assert.equal(playAccess(testCode).reactionOnly, true, '新写法同样不算普通出牌')
  assert.equal(quickEventView('01018'), null, '普通能力不会进入快速事件候选视图')

  // 声明即接线：quickEvent 只能写在 reaction 描述子上。
  assert.throws(() => registerCardAbilities({
    code: 'test-p24-quick-event-bad',
    abilities: [{ kind: 'action', quickEvent: true, resolve() {} }],
  }), /quickEvent 只能写在 reaction/)
  assert.throws(() => registerCardAbilities({
    code: 'test-p24-quick-event-bad2',
    abilities: [{ kind: 'reaction', trigger: 'defeatEnemy', fromHand: true, quickEvent: 'yes', resolve() {} }],
  }), /quickEvent 必须是布尔值/)
})
