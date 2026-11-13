#!/usr/bin/env node
// TSK P6：从 cards-data 提取 16 张定制升级卡的勾选面板契约（供条目静态声明与 worker 输入）。
//
//   node tools/tsk-player-options.mjs            打印 JSON（code → options）
//   node tools/tsk-player-options.mjs --write    同时写运行目录 artifacts/migration/tsk/workers/options.json
//
// 数据口径与 P0 scope 账本一致：□ 数量 = 该选项勾选格数（每格 1 经验），选项名来自
// customizationText 行首「□… 名称. 效果」。条目把该表原样放进 `customizationOptions` 字段，
// ability.js 注册期把它登记给 src/engine/tsk-customizable.js。
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { RUN } from './tsk-migration-lib.mjs'

const PLAYER_CODES = Object.keys(ALL_CARDS)
  .filter(code => ALL_CARDS[code]?.pack === 'tskp' && /^09\d{3}$/.test(code) && code >= '09021')
  .sort()

export function parseCustomizationOptions(text) {
  return String(text || '').split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const match = line.match(/^(□+)\s*([^.(]+)[.]?\s*(.*)$/)
    if (!match) return null
    return { name: match[2].trim(), checks: match[1].length, text: match[3].trim() }
  }).filter(Boolean)
}

export function customizationTables(codes = PLAYER_CODES) {
  const table = {}
  for (const code of codes) {
    const card = ALL_CARDS[code]
    if (!card?.customizationText) continue
    table[code] = parseCustomizationOptions(card.customizationText)
  }
  return table
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const table = customizationTables()
  const body = JSON.stringify(table, null, 2)
  if (process.argv.includes('--write')) {
    mkdirSync(join(RUN, 'workers'), { recursive: true })
    writeFileSync(join(RUN, 'workers', 'options.json'), body + '\n')
    console.log(`tsk player options: 已写入 ${Object.keys(table).length} 张定制卡到 artifacts/migration/tsk/workers/options.json`)
  } else {
    console.log(body)
  }
}
