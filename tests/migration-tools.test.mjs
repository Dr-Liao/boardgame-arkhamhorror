// Phase 5 · 迁移工具与批次产物的回归（fast tier）。
//
// 这里守四件事：
//   1. audit/migration-batches.json 的每张卡都真的迁完了（旧条目消失、能力层有条目）；
//   2. 读点返回的数据体与描述子声明逐字一致（防止"改了条目忘了改卡"）；
//   3. migrate-card.mjs 的判定/源码手术是纯函数、可复用，且不会把不可迁移的字段写进仓库；
//   4. 迁移批次的文件格式（标记块、聚合清单）能被工具稳定读回。

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { EFFECTS } from '../src/cards/card-effects.js'
import { CARD_ABILITY_ENTRIES } from '../src/cards/card-abilities.js'
import { MIGRATED_CARD_ENTRIES } from '../src/cards/ability-migration-batches.js'
import { registerCardAbilities, registeredCodes } from '../src/engine/ability.js'
import {
  playedEffect, commitProfile, weaknessProfile, entersPlayEffect, leavesPlayEffect,
} from '../src/engine/lifecycle.js'
import {
  analyzeCard, applyMigration, locateEntry, removeEntry, parseBatchFile, renderBatchFile, renderEntry,
  isPlainData, collectEscapePrimitives,
} from '../tools/migrate-card.mjs'

// 引擎装配点负责注册；纯内容测试要自己注册一次（与 architecture-guard 的口径一致）。
if (!registeredCodes().length) registerCardAbilities(CARD_ABILITY_ENTRIES)

const LEDGER_URL = new URL('../audit/migration-batches.json', import.meta.url)
const BATCH_FILE_URL = new URL('../src/cards/ability-migration-batches.js', import.meta.url)
const READ_POINTS = {
  played: { fn: playedEffect, field: 'effect' },
  commit: { fn: commitProfile, field: 'skill' },
  weakness: { fn: weaknessProfile, field: 'weakness' },
  entersPlay: { fn: entersPlayEffect, field: 'entersPlay' },
  leavesPlay: { fn: leavesPlayEffect, field: 'leavesPlay' },
}

const ledger = JSON.parse(await readFile(LEDGER_URL, 'utf8'))
const batchCodes = Object.entries(ledger.batches || {}).flatMap(([batch, codes]) => codes.map(code => ({ batch, code })))

test('迁移账本非空，且每张卡都在能力层注册、都离开了旧 DSL', () => {
  assert.ok(batchCodes.length > 0, 'migration-batches.json 里没有批次')
  const registered = new Set(CARD_ABILITY_ENTRIES.map(entry => entry.code))
  for (const { batch, code } of batchCodes) {
    assert.equal(EFFECTS[code], undefined, `${batch} 的 ${code} 仍有旧 DSL 条目`)
    assert.ok(registered.has(code), `${batch} 的 ${code} 没有能力层条目`)
  }
})

test('读点返回的数据体与描述子声明一致（描述子优先、旧 DSL 回落）', () => {
  for (const entry of MIGRATED_CARD_ENTRIES) {
    for (const descriptor of entry.abilities || []) {
      const point = READ_POINTS[descriptor.kind]
      if (!point) continue
      assert.deepEqual(point.fn(entry.code), descriptor[point.field],
        `${entry.code} 的 ${descriptor.kind} 读点与描述子不一致`)
    }
  }
})

test('迁移条目的字段都在能力层模型内（注册不抛错，describeRegistry 可枚举）', () => {
  const allowed = new Set(['code', 'uses', 'usesType', 'playCondition', 'modifiers', 'abilities',
    'elderSign', 'name', 'kind', 'scope', 'source', 'text', 'simplified', 'note', 'discardWhenEmpty'])
  for (const entry of MIGRATED_CARD_ENTRIES) {
    for (const key of Object.keys(entry)) assert.ok(allowed.has(key), `${entry.code} 的条目字段 ${key} 不在模型内`)
    for (const descriptor of entry.abilities || []) {
      assert.ok(['played', 'commit', 'weakness', 'entersPlay', 'leavesPlay', 'action', 'free',
        'reaction', 'forced', 'constant', 'elderSign'].includes(descriptor.kind), `${entry.code} 的 kind 非法`)
      assert.equal(descriptor.trigger, undefined, '生命周期钩子不能声明 trigger')
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

test('migrate-card.mjs：批次文件块可以读回并保持聚合清单', async () => {
  const text = await readFile(BATCH_FILE_URL, 'utf8')
  const blocks = parseBatchFile(text)
  // 手写批次（5c 逃生卡改写）登记在账本里但直接写在 card-abilities.js，
  // 所以生成文件只覆盖机械迁移的批次；两边都必须是账本的子集。
  const manual = new Set(ledger.manual || [])
  const ledgerBatches = Object.keys(ledger.batches || {})
  for (const name of blocks.keys()) assert.ok(ledgerBatches.includes(name), `${name} 不在迁移账本里`)
  for (const name of ledgerBatches) {
    assert.ok(blocks.has(name) || manual.has(name), `${name} 既没有生成块也没标记为手写批次`)
  }
  const rewritten = renderBatchFile(blocks, new Set())
  const reparsed = parseBatchFile(rewritten)
  assert.deepEqual([...reparsed.keys()].sort(), [...blocks.keys()].sort())
  for (const name of reparsed.keys()) {
    const constName = `BATCH_${name.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`
    assert.ok(rewritten.includes(`export const ${constName} = [`), `${name} 的常量名应当是 ${constName}`)
    assert.ok(rewritten.includes(`...${constName},`), `聚合清单应当展开 ${constName}`)
  }
})

test('migrate-card.mjs：渲染出的条目是合法 JS 数据（无函数、无逃生原语）', () => {
  const plan = analyzeCard('90007', { '90007': { firstActionOnly: true, event: { type: 'discoverClue' } } },
    { registered: new Set(), cardData: {} })
  const rendered = renderEntry(plan, new Set())
  assert.match(rendered, /code: '90007'/)
  assert.match(rendered, /when: ownFirstAction\(\)/)
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
