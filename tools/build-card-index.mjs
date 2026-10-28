// 生成 src/cards/entries/index.js（一张卡一个文件的静态索引）。
//
// 为什么需要它：
//   · Node ESM 没有目录导入，运行时必须有一份静态 import 清单；
//   · 项目零构建，所以索引是**签入仓库的生成物**，由本工具维护；
//   · 顺序沿用旧 card-abilities.js 的合并顺序（首次出现），避免注册/枚举顺序变化。
//
// 用法（在 games/arkhamhorror/ 下）：
//   node tools/build-card-index.mjs --check   校验索引与目录一致（不写文件）
//   node tools/build-card-index.mjs --write   重写索引（新增/删除卡牌文件后运行）
//
// 新卡流程：先创建 src/cards/entries/<code>.js，再运行 --write。
// 工具只按文件名排序/追加，不解析条目内容；条目本身由各卡文件负责。

import { readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderIndexModule } from './card-entry-source.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ENTRY_DIR = path.join(ROOT, 'src/cards/entries')
const INDEX_FILE = path.join(ENTRY_DIR, 'index.js')
// `_reprint-aliases.js` 是卡号数据表（entries/ 下允许出现卡号），不是卡条目。
const IGNORED = new Set(['index.js', '_shared.js', '_reprint-aliases.js'])

export async function entryFiles() {
  if (!existsSync(ENTRY_DIR)) return []
  const files = await readdir(ENTRY_DIR)
  return files
    .filter(file => file.endsWith('.js') && !IGNORED.has(file))
    .map(file => ({ code: path.basename(file, '.js'), file }))
    .sort((left, right) => left.code.localeCompare(right.code))
}

async function existingOrder() {
  if (!existsSync(INDEX_FILE)) return []
  const text = await readFile(INDEX_FILE, 'utf8')
  return [...text.matchAll(/^import e([A-Za-z0-9_]+) from '\.\/[^']+\.js'$/gm)].map(match => match[1])
}

export async function renderCurrentIndex() {
  const files = await entryFiles()
  // 索引是顺序的唯一来源。缺失时按文件名排序会改变注册/枚举顺序，宁可报错让人从 git 恢复。
  if (!existsSync(INDEX_FILE) && files.length) {
    throw new Error('src/cards/entries/index.js 缺失。不要按文件名排序重建（会改变注册顺序）；请从 git 恢复索引，或明确接受重排后再手工生成。')
  }
  const available = new Set(files.map(entry => entry.code))
  const order = []
  for (const code of await existingOrder()) {
    if (available.has(code) && !order.includes(code)) order.push(code)
  }
  for (const entry of files) if (!order.includes(entry.code)) order.push(entry.code)
  return {
    text: renderIndexModule(order.map(code => ({ code }))),
    order,
    files,
  }
}

export async function buildCardIndex({ write = false } = {}) {
  const current = await renderCurrentIndex()
  const oldText = existsSync(INDEX_FILE) ? await readFile(INDEX_FILE, 'utf8') : ''
  const changed = oldText !== current.text
  if (write && changed) await writeFile(INDEX_FILE, current.text, 'utf8')
  return { ...current, changed }
}

async function main() {
  const write = process.argv.includes('--write')
  if (!write && !process.argv.includes('--check')) {
    console.error('用法：node tools/build-card-index.mjs --check | --write')
    process.exit(2)
  }
  const result = await buildCardIndex({ write })
  if (!result.changed) {
    console.log(`✔ entries/index.js 与目录一致（${result.order.length} 张卡）`)
    return
  }
  if (write) {
    console.log(`写入 entries/index.js（${result.order.length} 张卡）`)
    return
  }
  console.error(`✖ entries/index.js 与目录不一致（目录 ${result.files.length} 张，索引 ${result.order.length} 张）`)
  console.error('  运行 node tools/build-card-index.mjs --write')
  process.exit(1)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main().catch(error => {
    console.error(error?.stack || String(error))
    process.exit(1)
  })
}
