// Phase 5 · 迁移工具与批次产物的回归（fast tier）。
//
// 这里守四件事：
//   1. audit/migration-batches.json 的每张卡都真的迁完了（旧条目消失、能力层有条目）；
//   2. 读点返回的数据体与描述子声明逐字一致（防止"改了条目忘了改卡"）；
//   3. migrate-card.mjs 的判定/源码手术是纯函数、可复用，且不会把不可迁移的字段写进仓库；
//   4. 迁移落盘为单卡文件：账本每张卡都有 entries/<code>.js，索引与目录一致。

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { EFFECTS } from '../src/cards/card-effects.js'
import { CARD_ABILITY_ENTRIES } from '../src/cards/card-abilities.js'
import { registerCardAbilities, registeredCodes } from '../src/engine/ability.js'
import {
  playedEffect, commitProfile, weaknessProfile, entersPlayEffect, leavesPlayEffect,
} from '../src/engine/lifecycle.js'
import { buildCardIndex, entryFiles } from '../tools/build-card-index.mjs'
import {
  analyzeCard, applyMigration, entryObjectSource, locateEntry, removeEntry, renderEntry,
  isPlainData, collectEscapePrimitives,
} from '../tools/migrate-card.mjs'

// 引擎装配点负责注册；纯内容测试要自己注册一次（与 architecture-guard 的口径一致）。
if (!registeredCodes().length) registerCardAbilities(CARD_ABILITY_ENTRIES)

const LEDGER_URL = new URL('../audit/migration-batches.json', import.meta.url)
const READ_POINTS = {
  played: { fn: playedEffect, field: 'effect' },
  commit: { fn: commitProfile, field: 'skill' },
  weakness: { fn: weaknessProfile, field: 'weakness' },
  entersPlay: { fn: entersPlayEffect, field: 'entersPlay' },
  leavesPlay: { fn: leavesPlayEffect, field: 'leavesPlay' },
}

const ledger = JSON.parse(await readFile(LEDGER_URL, 'utf8'))
const batchCodes = Object.entries(ledger.batches || {}).flatMap(([batch, codes]) => codes.map(code => ({ batch, code })))
const entriesByCode = new Map(CARD_ABILITY_ENTRIES.map(entry => [entry.code, entry]))
const migratedEntries = batchCodes.map(({ code }) => entriesByCode.get(code)).filter(Boolean)

test('迁移账本非空，且每张卡都在能力层注册、都离开了旧 DSL', () => {
  assert.ok(batchCodes.length > 0, 'migration-batches.json 里没有批次')
  const registered = new Set(CARD_ABILITY_ENTRIES.map(entry => entry.code))
  for (const { batch, code } of batchCodes) {
    assert.equal(EFFECTS[code], undefined, `${batch} 的 ${code} 仍有旧 DSL 条目`)
    assert.ok(registered.has(code), `${batch} 的 ${code} 没有能力层条目`)
  }
})

test('读点返回的数据体与描述子声明一致（描述子优先、旧 DSL 回落）', () => {
  for (const entry of migratedEntries) {
    for (const descriptor of entry.abilities || []) {
      const point = READ_POINTS[descriptor.kind]
      // resolve 型描述子没有数据体，读点是 null；只核对带数据体的。
      if (!point || descriptor[point.field] == null) continue
      assert.deepEqual(point.fn(entry.code), descriptor[point.field],
        `${entry.code} 的 ${descriptor.kind} 读点与描述子不一致`)
    }
  }
})

test('迁移条目的描述子都在能力层模型内（注册不抛错，describeRegistry 可枚举）', () => {
  const kinds = new Set(['played', 'commit', 'weakness', 'entersPlay', 'leavesPlay', 'setup', 'action', 'free',
    'reaction', 'forced', 'constant', 'elderSign'])
  for (const entry of migratedEntries) {
    assert.equal(typeof entry.code, 'string', '条目必须有 code')
    for (const descriptor of entry.abilities || []) {
      assert.ok(kinds.has(descriptor.kind), `${entry.code} 的 kind 非法：${descriptor.kind}`)
      // `played` 可以是「快速反应事件」，允许带 trigger；其余四个纯生命周期钩子不允许。
      if (['commit', 'weakness', 'entersPlay', 'leavesPlay'].includes(descriptor.kind)) {
        assert.equal(descriptor.trigger, undefined, `${entry.code} 的生命周期钩子不能声明 trigger`)
      }
    }
  }
})

test('migrate-card.mjs：可机械迁移的判定与拒绝理由', () => {
  const effects = {
    '90001': { skill: { onSuccess: { draw: 1 } } },
    '90002': { event: { type: 'gainResource', amount: 3 } },
    '90003': { event: { type: 'tfaPlayer', action: 'x' } },
    '90004': { abilities: [{ label: 'a', cost: { action: true, discardSelf: true }, effect: { type: 'draw' } }] },
    '90005': { passive: { stats: { willpower: 1 } } },
    '90006': { fast: true, reaction: { when: 'move' }, event: { type: 'draw' } },
    '90007': { firstActionOnly: true, event: { type: 'discoverClue' } },
  }
  const plan = code => analyzeCard(code, effects, { registered: new Set(), cardData: {} })

  assert.equal(plan('90001').mechanical, true)
  assert.equal(plan('90001').entry.abilities[0].kind, 'commit')
  assert.equal(plan('90002').entry.abilities[0].kind, 'played')
  assert.equal(plan('90002').entry.abilities[0].effect.type, 'gainResource')
  assert.equal(plan('90003').mechanical, false, '逃生原语必须拒绝')
  assert.match(plan('90003').residual[0].reason, /逃生原语/)
  assert.equal(plan('90004').mechanical, false, 'discardSelf 会改变日志顺序')
  assert.match(plan('90004').residual[0].reason, /日志顺序/)
  assert.deepEqual(plan('90005').entry.modifiers, [{ target: 'skill:willpower', amount: 1 }])
  assert.equal(plan('90006').mechanical, false, 'reaction 没有描述子读点')
  assert.equal(plan('90007').entry.playCondition.length, 1)
  assert.equal(plan('90007').entry.playCondition[0].message, '只能作为本回合的第一个行动打出')
  // playCondition 的 predicate 在源码里是 matcher 组合子的调用文本（生成文件按需 import）。
  assert.equal(plan('90007').entry.playCondition[0].when, 'ownFirstAction()')
})

test('migrate-card.mjs：源码手术只删目标条目，且能看见"找不到/重复"', () => {
  const source = [
    'export const EFFECTS = {',
    "  '01001': { skill: { onSuccess: { draw: 1 } } }, // 保留",
    "  '01002': { // 要删的卡",
    "    event: { type: 'draw', amount: 2 },",
    '  },',
    "  '01003': { passive: { stats: { combat: 1 } } },",
    '}',
  ].join('\n')
  const located = locateEntry(source, '01002')
  assert.ok(located, '应当能定位条目')
  const removed = removeEntry(source, '01002')
  assert.ok(!removed.text.includes("'01002'"))
  assert.ok(removed.text.includes("'01001'") && removed.text.includes("'01003'"), '其它条目必须保留')
  assert.equal(locateEntry(source, '09999'), null)
  const duplicated = `export const EFFECTS = {\n  '01004': { skill: {} },\n  '01004': { skill: {} },\n}\n`
  assert.throws(() => locateEntry(duplicated, '01004'), /出现了 2 次/)
})

test('迁移落盘为单卡文件：账本每张卡都有 entries/<code>.js，索引与目录一致', async () => {
  const files = await entryFiles()
  const codes = new Set(files.map(file => file.code))
  for (const { batch, code } of batchCodes) {
    assert.ok(codes.has(code), `${batch} 的 ${code} 没有单卡行为文件 src/cards/entries/${code}.js`)
  }
  assert.equal(files.length, CARD_ABILITY_ENTRIES.length, 'entries 目录的卡数必须等于 CARD_ABILITY_ENTRIES')
  const index = await buildCardIndex({ write: false })
  assert.equal(index.changed, false, 'entries/index.js 与目录不一致：运行 node tools/build-card-index.mjs --write')
})

test('migrate-card.mjs：渲染出的条目是合法 JS 数据（无函数、无逃生原语）', () => {
  const plan = analyzeCard('90007', { '90007': { firstActionOnly: true, event: { type: 'discoverClue' } } },
    { registered: new Set(), cardData: {} })
  const rendered = renderEntry(plan, new Set())
  assert.match(rendered, /code: '90007'/)
  assert.match(rendered, /when: ownFirstAction\(\)/)
  // 单卡文件用的是同一份数据的「无外层缩进」版本。
  assert.match(entryObjectSource(plan), /code: '90007'/)
  assert.match(entryObjectSource(plan), /when: ownFirstAction\(\)/)
  assert.equal(isPlainData({ a: 1, b: [true, null] }), true)
  assert.match(isPlainData({ fn: () => 1 }), /是函数/)
  assert.equal(collectEscapePrimitives({ effect: { type: 'carcosaPlayer', action: 'x' } }).size, 1)
})

test('applyMigration 拒绝在没有旧条目的卡上开工（防止空迁移污染批次）', async () => {
  await assert.rejects(
    () => applyMigration([{ code: '09998', entry: { code: '09998', abilities: [{ kind: 'played', effect: {} }] } }],
      { batch: 'never' }),
    /前置条件不成立/,
  )
})
