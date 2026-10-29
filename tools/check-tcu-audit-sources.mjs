#!/usr/bin/env node
// 快速检查 TCU 审计账本锁定的来源字节，不重新运行账本里的证据测试。
// 完整取证仍由 `node tools/audit-tcu.mjs --check` 负责。

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const TARGET = path.join(ROOT, 'audit', 'tcu-migration.json')
const audit = JSON.parse(readFileSync(TARGET, 'utf8'))
const expectedFiles = audit.evidence?.files

if (!expectedFiles || typeof expectedFiles !== 'object' || Array.isArray(expectedFiles)) {
  console.error('audit/tcu-migration.json 缺少 evidence.files')
  process.exit(1)
}

const sha256File = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const mismatches = []

for (const [relativePath, expected] of Object.entries(expectedFiles)) {
  const file = path.resolve(ROOT, relativePath)
  const insideRoot = file === ROOT || file.startsWith(ROOT + path.sep)
  if (!insideRoot) {
    mismatches.push(`${relativePath}: 路径越出游戏目录`)
    continue
  }
  const actual = existsSync(file) ? sha256File(file) : null
  if (actual !== expected) {
    mismatches.push(`${relativePath}: ${expected ?? 'missing'} -> ${actual ?? 'missing'}`)
  }
}

if (mismatches.length) {
  console.error(`TCU 审计来源已漂移（${mismatches.length} 项）；请运行 audit:tcu:check 或重新 --write 并审阅：`)
  for (const mismatch of mismatches) console.error(`  ${mismatch}`)
  process.exit(1)
}

console.log(`TCU 审计来源一致：${Object.keys(expectedFiles).length} 个文件`)
