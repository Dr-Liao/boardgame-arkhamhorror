#!/usr/bin/env node
// P7（M2 玩家卡）期间的串行索引同步 —— 主进程批准的唯一 worker 侧索引写入口。
//
//   node tools/tde-p7-index-sync.mjs
//
// 为什么需要它：逐卡测试通过 `src/engine/ability.js` 的注册表读条目，注册表来自
// `src/cards/entries/index.js` 的静态 import 清单；worker 新写的单卡文件必须先进入索引，
// 测试才能看到。协议要求索引只由主进程维护，但 4 个 worker 各自迭代会频繁需要同步。
// 本工具用目录锁把「目录扫描 + 重建索引」串行化：同一时刻只有一个进程在写 index.js，
// 其余等待；锁超过 120s 视为陈旧锁自动清理。语义与 `node tools/build-card-index.mjs --write`
// 完全相同（直接复用其 buildCardIndex），不改变索引顺序与内容。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCardIndex } from './build-card-index.mjs'

const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lockDir = path.join(gameRoot, 'artifacts/migration/tde/.index-sync.lock')
const STALE_MS = 120_000
const WAIT_MS = 90_000
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

fs.mkdirSync(path.dirname(lockDir), { recursive: true })
const startedAt = Date.now()
let locked = false
while (!locked) {
  try {
    fs.mkdirSync(lockDir)
    locked = true
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    let stat = null
    try { stat = fs.statSync(lockDir) } catch { /* 另一个进程刚删掉 */ }
    if (stat && Date.now() - stat.mtimeMs > STALE_MS) {
      fs.rmSync(lockDir, { recursive: true, force: true })
      continue
    }
    if (Date.now() - startedAt > WAIT_MS) throw new Error(`等待索引锁超时：${lockDir}`)
    await sleep(250)
  }
}
try {
  const result = await buildCardIndex({ write: true })
  console.log(JSON.stringify({ ok: true, changed: result.changed, cards: result.order.length }))
} finally {
  fs.rmSync(lockDir, { recursive: true, force: true })
}
