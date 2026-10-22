// 生成 src/cards/encounter-entries/index.js（非玩家条目：一条目一个文件的静态索引）。
//
// 用法（在 games/arkhamhorror/ 下）：
//   node tools/build-encounter-index.mjs --check   校验索引与目录一致（不写文件）
//   node tools/build-encounter-index.mjs --write   重写索引（新增/删除条目文件后运行）
//
// 顺序规则：
//   · 已有索引里的顺序原样保留（拆分时由 tools/split-encounter-entries.mjs 写入旧数组顺序）；
//   · 新增文件按相对路径排序追加，避免每次重建都漂移。
// 目录里只允许条目文件与根部的 index.js / _shared.js / _lookup.js；
// 下划线开头的模块是共享模块，不进索引。

import { readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ENTRY_DIR = path.join(ROOT, 'src/cards/encounter-entries')
const INDEX_FILE = path.join(ENTRY_DIR, 'index.js')

export async function encounterEntryFiles() {
  if (!existsSync(ENTRY_DIR)) return []
  const files = []
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) { await walk(full); continue }
      if (!entry.name.endsWith('.js') || entry.name.startsWith('_')) continue
      if (full === INDEX_FILE) continue
      const relative = path.relative(ENTRY_DIR, full).split(path.sep).join('/')
      files.push({ code: path.basename(entry.name, '.js'), relative, file: full })
    }
  }
  await walk(ENTRY_DIR)
  return files.sort((left, right) => left.relative.localeCompare(right.relative))
}

async function existingOrder() {
  if (!existsSync(INDEX_FILE)) return []
  const text = await readFile(INDEX_FILE, 'utf8')
  return [...text.matchAll(/^import e([A-Za-z0-9_]+) from '\.\/([^']+\.js)'$/gm)]
    .map(match => match[1])
}

export function renderEncounterIndex(entries) {
  const lines = [
    '// 由 tools/build-encounter-index.mjs 生成，不要手改。',
    '// 顺序 = 拆分前 encounter-abilities.js 的数组顺序（首次出现）；新增条目追加在末尾。',
    '',
    "import { registerNonPlayerEntries } from './_lookup.js'",
    '',
  ]
  for (const entry of entries) lines.push(`import e${entry.code} from './${entry.relative}'`)
  lines.push('', 'export const NON_PLAYER_ENTRY_LIST = [')
  for (const entry of entries) lines.push(`  e${entry.code},`)
  lines.push(']', '')
  // _lookup.js 不能在初始化时 import 本文件（ESM 循环会让单独 import 条目踩 TDZ）；
  // 本文件求值完成后把列表注册给它，跨条目查询在运行时再惰性建表。
  lines.push('registerNonPlayerEntries(NON_PLAYER_ENTRY_LIST)', '')
  return lines.join('\n')
}

export async function renderCurrentIndex() {
  const files = await encounterEntryFiles()
  const byCode = new Map(files.map(file => [file.code, file]))
  if (byCode.size !== files.length) throw new Error('encounter-entries 里出现重复 code（文件名必须唯一）')
  if (!existsSync(INDEX_FILE) && files.length) {
    throw new Error('src/cards/encounter-entries/index.js 缺失。不要按文件名排序重建（会改变注册顺序）；'
      + '请从 git 恢复索引，或明确接受重排后再手工生成。')
  }
  const order = []
  for (const code of await existingOrder()) {
    if (byCode.has(code) && !order.includes(code)) order.push(code)
  }
  for (const file of files) if (!order.includes(file.code)) order.push(file.code)
  return {
    text: renderEncounterIndex(order.map(code => byCode.get(code))),
    order,
    files,
  }
}

export async function buildEncounterIndex({ write = false } = {}) {
  const current = await renderCurrentIndex()
  const oldText = existsSync(INDEX_FILE) ? await readFile(INDEX_FILE, 'utf8') : ''
  const changed = oldText !== current.text
  if (write && changed) await writeFile(INDEX_FILE, current.text, 'utf8')
  return { ...current, changed }
}

async function main() {
  const write = process.argv.includes('--write')
  if (!write && !process.argv.includes('--check')) {
    console.error('用法：node tools/build-encounter-index.mjs --check | --write')
    process.exit(2)
  }
  const result = await buildEncounterIndex({ write })
  if (!result.changed) {
    console.log(`✔ encounter-entries/index.js 与目录一致（${result.order.length} 个条目）`)
    return
  }
  if (write) {
    console.log(`写入 encounter-entries/index.js（${result.order.length} 个条目）`)
    return
  }
  console.error(`✖ encounter-entries/index.js 与目录不一致（目录 ${result.files.length} 个，索引 ${result.order.length} 个）`)
  console.error('  运行 node tools/build-encounter-index.mjs --write')
  process.exit(1)
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (invokedDirectly) {
  await main().catch(error => {
    console.error(error?.stack || String(error))
    process.exit(1)
  })
}
