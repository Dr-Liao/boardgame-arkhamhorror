#!/usr/bin/env node
// FHV P7 自译层校验：把 story-source/ 的分段文件深合并后与 en 指南逐叶比对。
//   node tools/check-fhv-translations.mjs            # 全量校验（缺译即非零退出）
//   node tools/check-fhv-translations.mjs --file base.json
//   node tools/check-fhv-translations.mjs --json     # 机器可读报告
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { EN_GUIDE_FILES, STORY_SOURCE_DIR, enGuidePath, json, readText } from './fhv-campaign-lib.mjs'

const CJK = /[\u3400-\u9fff]/
const flatten = (value, prefix = '', out = []) => {
  if (typeof value === 'string') out.push([prefix, value])
  else if (Array.isArray(value)) value.forEach((item, index) => flatten(item, `${prefix}[${index}]`, out))
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) flatten(item, prefix ? `${prefix}.${key}` : key, out)
  return out
}
const pathSegments = path => String(path).replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)
const pathOf = (root, path) => pathSegments(path).reduce((parent, key) => parent?.[key], root)
function deepMerge(base, extra) {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return extra === undefined ? base : extra
  const out = (base && typeof base === 'object' && !Array.isArray(base)) ? { ...base } : {}
  for (const [key, value] of Object.entries(extra)) out[key] = deepMerge(out[key], value)
  return out
}
export function translatedTree(file) {
  if (!existsSync(STORY_SOURCE_DIR)) return null
  const names = readdirSync(STORY_SOURCE_DIR).filter(name => name.endsWith('.json'))
  const stem = file.replace(/\.json$/, '')
  const whole = names.includes(file) ? [file] : []
  const parts = names
    .filter(name => new RegExp(`^${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.part\\d+\\.json$`).test(name))
    .sort((left, right) => Number(left.match(/\.part(\d+)\.json$/)[1]) - Number(right.match(/\.part(\d+)\.json$/)[1]))
  let tree = null
  for (const name of [...whole, ...parts]) tree = deepMerge(tree, JSON.parse(readText(join(STORY_SOURCE_DIR, name))))
  return tree
}

export function checkFile(file) {
  const enTree = JSON.parse(readText(enGuidePath(file)))
  const zhTree = translatedTree(file)
  const enLeaves = flatten(enTree)
  const gaps = []
  let translated = 0
  for (const [key, text] of enLeaves) {
    const zh = zhTree ? pathOf(zhTree, key) : null
    if (typeof zh === 'string' && zh.trim() && CJK.test(zh)) translated += 1
    else gaps.push(key)
  }
  // 额外键/结构漂移：允许分段里暂不存在的键，但存在时必须结构一致。
  const extras = []
  if (zhTree) {
    const enKeys = new Set(flatten(enTree).map(([key]) => key))
    for (const [key] of flatten(zhTree)) if (!enKeys.has(key) && !/\[\d+\]/.test(key)) extras.push(key)
  }
  return { file, leaves: enLeaves.length, translated, gaps, extras }
}

if (process.argv[1] && process.argv[1].endsWith('check-fhv-translations.mjs')) {
  const requested = process.argv.includes('--file') ? process.argv[process.argv.indexOf('--file') + 1] : null
  const files = requested ? [requested] : EN_GUIDE_FILES
  const reports = files.filter(file => EN_GUIDE_FILES.includes(file)).map(checkFile)
  const totals = reports.reduce((sum, row) => ({
    leaves: sum.leaves + row.leaves, translated: sum.translated + row.translated, gaps: sum.gaps + row.gaps.length,
  }), { leaves: 0, translated: 0, gaps: 0 })
  const report = { status: totals.gaps === 0 ? 'complete' : 'incomplete', totals, files: reports }
  if (process.argv.includes('--json')) console.log(json(report))
  else {
    for (const row of reports) {
      console.log(`${row.file}: ${row.translated}/${row.leaves}${row.gaps.length ? `（缺 ${row.gaps.length}）` : ''}`)
      if (row.gaps.length && row.gaps.length <= 8) console.log(`  缺译：${row.gaps.join(', ')}`)
      if (row.extras.length) console.log(`  多余键：${row.extras.slice(0, 5).join(', ')}`)
    }
    console.log(`总计：${totals.translated}/${totals.leaves}，缺译 ${totals.gaps}，status=${report.status}`)
  }
  if (totals.gaps > 0) process.exitCode = 1
}
