// 一卡一文件守卫（fast tier）。
//
// 规矩（见 ARCHITECTURE.md §3.3 与 docs/card-entry-files.md）：
//   · 每张有行为的卡一个 src/cards/entries/<code>.js，export default 一个条目；
//   · card-abilities.js 只做聚合，不再放条目；
//   · 不存在 BATCH_* / MIGRATED_* 批次大数组；
//   · entries/index.js 是生成物，必须与目录一致。
//
// 这些断言故意不依赖具体卡号：新增/删除卡只改文件与索引，守卫仍然成立。

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { CARD_ABILITY_ENTRIES, CARD_ABILITY_CODES } from '../src/cards/card-abilities.js'
import { buildCardIndex, entryFiles } from '../tools/build-card-index.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ENTRY_DIR = path.join(ROOT, 'src/cards/entries')
const IGNORED = new Set(['index.js', '_shared.js'])

test('每张卡一个文件：文件名 = 条目 code，且只 export default 一个条目', async () => {
  const files = await readdir(ENTRY_DIR)
  const cards = files.filter(file => file.endsWith('.js') && !IGNORED.has(file))
  assert.ok(cards.length > 0, 'entries 目录里没有卡牌文件')

  for (const file of cards) {
    const source = await readFile(path.join(ENTRY_DIR, file), 'utf8')
    assert.equal((source.match(/export default/g) || []).length, 1, `${file} 必须恰好有一个 export default`)
    const module = await import(pathToFileURL(path.join(ENTRY_DIR, file)).href)
    const entry = module.default
    assert.ok(entry && typeof entry === 'object', `${file} 没有 default 条目`)
    assert.equal(entry.code, path.basename(file, '.js'), `${file} 的 code 必须等于文件名`)
  }
})

test('entries/index.js 与目录一致，CARD_ABILITY_ENTRIES 顺序与索引一致', async () => {
  const index = await buildCardIndex({ write: false })
  assert.equal(index.changed, false, 'entries/index.js 过期：运行 node tools/build-card-index.mjs --write')
  assert.deepEqual(CARD_ABILITY_ENTRIES.map(entry => entry.code), index.order,
    'CARD_ABILITY_ENTRIES 的顺序必须等于 entries/index.js 的顺序')
  assert.equal(CARD_ABILITY_CODES.size, CARD_ABILITY_ENTRIES.length, '卡号不能重复')
  assert.equal(CARD_ABILITY_ENTRIES.length, index.files.length, '索引卡数必须等于目录卡数')
})

test('卡牌文件不 import 引擎装配点 / 聚合入口 / 批次大文件', async () => {
  const files = await readdir(ENTRY_DIR)
  const forbidden = [
    { pattern: /from\s+['"][^'"]*card-abilities\.js['"]/, label: 'card-abilities.js' },
    { pattern: /from\s+['"][^'"]*ability-migration-batches\.js['"]/, label: '批次大文件' },
    { pattern: /from\s+['"][^'"]*engine\.js['"]/, label: 'engine.js' },
    { pattern: /from\s+['"][^'"]*content\//, label: 'content/' },
  ]
  for (const file of files) {
    if (!file.endsWith('.js') || file === 'index.js') continue
    const source = await readFile(path.join(ENTRY_DIR, file), 'utf8')
    for (const { pattern, label } of forbidden) {
      assert.doesNotMatch(source, pattern, `${file} 不允许 import ${label}；卡只能经 ctx.api 结算`)
    }
  }
})

test('不存在批次大文件：ability-migration-batches.js 已删除', () => {
  assert.equal(existsSync(path.join(ROOT, 'src/cards/ability-migration-batches.js')), false,
    '不允许恢复 ability-migration-batches.js；一张卡一个文件')
})

test('card-abilities.js 只聚合，不再含条目', async () => {
  const source = await readFile(path.join(ROOT, 'src/cards/card-abilities.js'), 'utf8')
  assert.match(source, /CARD_ENTRY_LIST/, '聚合入口必须 import entries/index.js')
  assert.doesNotMatch(source, /\babilities\s*:/, 'card-abilities.js 不允许再写 abilities 条目')
  assert.doesNotMatch(source, /\bcode\s*:/, 'card-abilities.js 不允许再写卡号条目')
})
