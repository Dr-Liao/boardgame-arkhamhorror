// 非玩家卡一卡一文件守卫（fast tier）。
//
// 规矩（见 ARCHITECTURE.md §3.3 与 docs/card-entry-files.md）：
//   · 每个非玩家条目一个 src/cards/encounter-entries/<归属>/<code>.js，export default 一个条目；
//   · 文件路径 = tools/encounter-entry-placement.mjs 按当前 content/ 算出的归属；
//   · encounter-abilities.js 只做聚合（facade），不再放条目；
//   · encounter-entries/index.js 是生成物，必须与目录一致，顺序 = 拆分前数组顺序；
//   · 条目只 import _shared.js / _lookup.js，不 import 引擎装配点、聚合入口或 content/。
//
// 这些断言故意不依赖具体卡号：新增/移动卡片只改文件与索引，守卫仍然成立。

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  NON_PLAYER_ABILITY_ENTRIES, NON_PLAYER_ABILITY_CODES, nonPlayerEntryFor,
} from '../src/cards/encounter-abilities.js'
import { buildEncounterIndex, encounterEntryFiles } from '../tools/build-encounter-index.mjs'
import { ENTRY_SCOPES, loadPlacementIndex, resolvePlacements } from '../tools/encounter-entry-placement.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ENTRY_DIR = path.join(ROOT, 'src/cards/encounter-entries')
const SHARED_MODULES = new Set(['_shared.js', '_lookup.js'])
const TOP_LEVEL = new Set(['shared', 'nightOfTheZealot', 'theDunwichLegacy', 'thePathToCarcosa', 'theForgottenAge', 'theCircleUndone'])
const SCOPED_DIRECTORIES = new Set(['enemies', 'treacheries', 'locations', 'acts', 'agendas', 'storyAssets', 'threats', 'all'])

const relativeOf = file => path.relative(ENTRY_DIR, file).split(path.sep).join('/')

async function entryFiles() {
  return encounterEntryFiles()
}

test('每个非玩家条目一个文件：文件名 = code，单一 default，scope 合法', async () => {
  const files = await entryFiles()
  assert.equal(files.length, NON_PLAYER_ABILITY_ENTRIES.length, '条目文件数必须等于 NON_PLAYER_ABILITY_ENTRIES 条数')
  assert.ok(files.length > 0, 'encounter-entries 目录里没有条目文件')
  for (const file of files) {
    const source = await readFile(file.file, 'utf8')
    assert.equal((source.match(/export default/g) || []).length, 1, `${file.relative} 必须恰好有一个 export default`)
    const module = await import(pathToFileURL(file.file).href)
    const entry = module.default
    assert.ok(entry && typeof entry === 'object', `${file.relative} 没有 default 条目`)
    assert.equal(entry.code, file.code, `${file.relative} 的 code 必须等于文件名`)
    assert.ok(ENTRY_SCOPES.includes(entry.scope), `${file.relative} 的 scope 非法：${entry.scope}`)
  }
})

test('文件路径 = 归属算法结果，且 0 unresolved', async () => {
  const placements = resolvePlacements(NON_PLAYER_ABILITY_ENTRIES, loadPlacementIndex())
  const unresolved = placements.filter(placement => placement.unresolved)
  assert.deepEqual(unresolved.map(placement => placement.code), [], '存在无法归属的条目')
  const files = await entryFiles()
  const byCode = new Map(files.map(file => [file.code, file.relative]))
  for (const placement of placements) {
    assert.equal(byCode.get(placement.code), placement.targetPath,
      `${placement.code} 的文件路径与归属算法不一致：${byCode.get(placement.code)} != ${placement.targetPath}`)
  }
  assert.equal(placements.length, NON_PLAYER_ABILITY_ENTRIES.length, '归属结果数必须等于条目数')
})

test('encounter-entries/index.js 与目录一致，NON_PLAYER_ABILITY_ENTRIES 顺序与索引一致', async () => {
  const index = await buildEncounterIndex({ write: false })
  assert.equal(index.changed, false, 'encounter-entries/index.js 过期：运行 node tools/build-encounter-index.mjs --write')
  assert.deepEqual(NON_PLAYER_ABILITY_ENTRIES.map(entry => entry.code), index.order,
    'NON_PLAYER_ABILITY_ENTRIES 的顺序必须等于 encounter-entries/index.js 的顺序')
  assert.equal(NON_PLAYER_ABILITY_CODES.size, NON_PLAYER_ABILITY_ENTRIES.length, '条目 code 不能重复')
  assert.equal(NON_PLAYER_ABILITY_ENTRIES.length, index.files.length, '索引条数必须等于目录文件数')
  assert.equal(nonPlayerEntryFor(index.order[0])?.code, index.order[0], 'nonPlayerEntryFor 必须能按 code 取到条目')
  assert.equal(nonPlayerEntryFor('__missing__'), null, 'nonPlayerEntryFor 对未知 code 返回 null')
})

test('目录结构：顶层只有 shared + 4 个战役，不按 scope 建大目录', async () => {
  const top = await readdir(ENTRY_DIR, { withFileTypes: true })
  for (const entry of top) {
    if (!entry.isDirectory()) continue
    assert.ok(TOP_LEVEL.has(entry.name), `顶层出现未知目录 ${entry.name}（禁止按 scope 建 enemies/ 之类的大目录）`)
    assert.ok(!SCOPED_DIRECTORIES.has(entry.name), `顶层出现按 scope 的大目录 ${entry.name}`)
  }
  assert.ok(existsSync(path.join(ENTRY_DIR, 'shared')), '缺少 shared/')
  for (const campaign of TOP_LEVEL) {
    if (campaign === 'shared') continue
    assert.ok(existsSync(path.join(ENTRY_DIR, campaign)), `缺少战役目录 ${campaign}/`)
  }
})

test('条目文件不 import 聚合入口 / 引擎装配点 / content/ / 其它条目', async () => {
  const forbidden = [
    { pattern: /from\s+['"][^'"]*encounter-abilities\.js['"]/, label: 'encounter-abilities.js' },
    { pattern: /from\s+['"][^'"]*card-abilities\.js['"]/, label: 'card-abilities.js' },
    { pattern: /from\s+['"][^'"]*ability-migration-batches\.js['"]/, label: '批次大文件' },
    { pattern: /from\s+['"][^'"]*engine\.js['"]/, label: 'engine.js' },
    { pattern: /from\s+['"][^'"]*content\//, label: 'content/' },
    { pattern: /from\s+['"][^'"]*encounter-entries\/index\.js['"]/, label: 'encounter-entries/index.js' },
  ]
  const entries = await entryFiles()
  const codes = new Set(entries.map(entry => entry.code))
  for (const file of entries) {
    const source = await readFile(file.file, 'utf8')
    for (const { pattern, label } of forbidden) {
      assert.doesNotMatch(source, pattern, `${file.relative} 不允许 import ${label}；跨条目查询走 _lookup.js`)
    }
    const specifiers = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(match => match[1])
    for (const specifier of specifiers) {
      const target = path.basename(specifier)
      if (SHARED_MODULES.has(target)) continue
      assert.match(specifier, /engine\/matcher\.js$/, `${file.relative} 只允许 import _shared.js / _lookup.js / engine\/matcher.js，实际 ${specifier}`)
      const stem = path.basename(specifier, '.js')
      assert.ok(!codes.has(stem), `${file.relative} 直接 import 了另一个条目 ${specifier}；请改走 _lookup.js`)
    }
  }
})

test('encounter-abilities.js 只聚合，不再含条目', async () => {
  const source = await readFile(path.join(ROOT, 'src/cards/encounter-abilities.js'), 'utf8')
  assert.match(source, /NON_PLAYER_ENTRY_LIST/, 'facade 必须 import encounter-entries/index.js')
  assert.doesNotMatch(source, /\bcode\s*:/, 'encounter-abilities.js 不允许再写卡号条目')
  assert.doesNotMatch(source, /\babilities\s*:/, 'encounter-abilities.js 不允许再写 abilities 条目')
  assert.doesNotMatch(source, /\bscope\s*:/, 'encounter-abilities.js 不允许再写条目级 scope')
})

test('跨条目查询的条目可在新进程里单独 import（ESM 循环不踩 TDZ）', async () => {
  const entries = await entryFiles()
  const crossEntry = []
  for (const file of entries) {
    const source = await readFile(file.file, 'utf8')
    if (/_lookup\.js['"]/.test(source)) crossEntry.push(file)
  }
  assert.ok(crossEntry.length >= 4, `应至少有 4 个条目走 _lookup.js，实际 ${crossEntry.length}`)
  for (const file of crossEntry) {
    const script = `const m = await import(${JSON.stringify(pathToFileURL(file.file).href)});`
      + ` if (!m.default || !m.default.code) { console.error('bad default'); process.exit(1) }`
    execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: ROOT, stdio: 'pipe' })
  }
})
