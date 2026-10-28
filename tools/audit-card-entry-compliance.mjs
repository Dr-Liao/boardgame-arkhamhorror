// 卡条目合规审计：把「卡只能经 ctx.api 改状态」等迁移规矩固化成可复算的账本。
//
// 规则（阻断，基线只减不增）：
//   R1 directStateWrite   条目文件直接写运行时状态（state / inv / location / enemy / act / agenda /
//                         asset / target / card 的字段或数组）。
//   R2 reprintDuplicate   同一张印刷卡（cards-data 的 duplicateOfCode）两个卡号都写了条目。
//   R3 playConditionGap   卡文要求「只能在你回合打出」，但条目没有 playCondition。
//
// 观察项（不阻断，只记数）：
//   R4 singleCardField    只被 1 个条目写的状态字段——原语缺口信号。
//   R5 testWrapper        「显现 - 检定」条目整体只是 api.test(...) + return false 的包装。
//
// 用法：
//   node tools/audit-card-entry-compliance.mjs --write    # 重写 audit/card-entry-compliance.json
//   node tools/audit-card-entry-compliance.mjs --check    # 复算：出现基线外的新违规即失败
//
// 口径：基线只允许收紧（修复后跑 --write）。批量迁移合并前必须 --check 通过。

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const LEDGER = path.join(ROOT, 'audit', 'card-entry-compliance.json')
const ENTRY_DIR = path.join(ROOT, 'src', 'cards', 'entries')
const ENCOUNTER_DIR = path.join(ROOT, 'src', 'cards', 'encounter-entries')
const IGNORED = new Set(['index.js', '_shared.js', '_lookup.js'])

const { ALL_CARDS } = await import(pathToFileURL(path.join(ROOT, 'src', 'cards', 'cards-data.js')).href)

function walk(dir, out = []) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name)
    if (item.isDirectory()) walk(full, out)
    else if (item.name.endsWith('.js') && !IGNORED.has(item.name)) out.push(full)
  }
  return out
}

// 去掉注释再扫，避免把说明文字当成写状态；行号仍按原文计。
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, block => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (line, prefix) => prefix + ' '.repeat(Math.max(0, line.length - prefix.length)))
}

const STATE_ROOTS = ['state', 'inv', 'location', 'enemy', 'act', 'agenda', 'asset', 'target', 'card']
const WRITE_RE = new RegExp(
  `(?:^|[^.\\w$])(${STATE_ROOTS.join('|')})\\.([A-Za-z_$][\\w$]*)\\s*(=(?!=)|\\+=|-=|\\*=|\\|=|\\|\\|=|\\.push\\(|\\.splice\\()`,
  'g',
)

function entryCode(source, file) {
  const match = source.match(/["']?code["']?\s*:\s*['"]([^'"]+)['"]/)
  return match ? match[1] : path.basename(file, '.js')
}

function scanEntry(file, area) {
  const raw = readFileSync(file, 'utf8')
  const code = entryCode(raw, file)
  const source = stripComments(raw)
  const writes = []
  const lines = source.split('\n')
  lines.forEach((line, index) => {
    WRITE_RE.lastIndex = 0
    let match
    while ((match = WRITE_RE.exec(line))) {
      writes.push({ root: match[1], field: match[2], line: index + 1, text: raw.split('\n')[index].trim().slice(0, 140) })
    }
  })
  return {
    code,
    area,
    file: path.relative(ROOT, file).replace(/\\/g, '/'),
    source,
    raw,
    writes,
    hasPlayCondition: /\bplayCondition\s*:/.test(source),
    hasTest: /\bapi\.test\s*\(/.test(source),
    pureTestWrapper: /encounterResolve\s*\([^)]*\)\s*\{\s*api\.test\([\s\S]*?\)\s*return false\s*\}/.test(source.replace(/\s+/g, ' ')),
  }
}

const entries = [
  ...readdirSync(ENTRY_DIR)
    .filter(name => name.endsWith('.js') && !IGNORED.has(name))
    .map(name => scanEntry(path.join(ENTRY_DIR, name), 'player')),
  ...walk(ENCOUNTER_DIR).map(file => scanEntry(file, 'encounter')),
]

const byCode = new Map()
for (const entry of entries) byCode.set(entry.code, entry)

// R1
const directStateWrite = entries.filter(entry => entry.writes.length > 0)

// R4
const fieldWriters = new Map()
for (const entry of entries) {
  for (const write of entry.writes) {
    const key = `${write.root}.${write.field}`
    if (!fieldWriters.has(key)) fieldWriters.set(key, new Set())
    fieldWriters.get(key).add(entry.code)
  }
}
const singleCardField = [...fieldWriters.entries()]
  .filter(([, codes]) => codes.size === 1)
  .map(([field, codes]) => ({ field, code: [...codes][0] }))
  .sort((a, b) => a.field.localeCompare(b.field))

// R2
const reprintDuplicate = []
for (const entry of entries) {
  const card = ALL_CARDS[entry.code]
  const original = card?.duplicateOfCode
  if (original && byCode.has(original)) {
    reprintDuplicate.push({ code: entry.code, original, file: entry.file })
  }
}

// R3
const playConditionGap = entries.filter(entry => {
  const text = String(ALL_CARDS[entry.code]?.text || '')
  const requiresOwnTurn = /^Fast\.\s*\n?.*Play only during your turn/i.test(text) || /^Play only during your turn/i.test(text)
  return requiresOwnTurn && !entry.hasPlayCondition
})

// R5（观察项）
const testWrappers = entries.filter(entry => entry.pureTestWrapper)
const revelationTest = entries.filter(entry => /Revelation\s*[-–]\s*Test\b/i.test(String(ALL_CARDS[entry.code]?.text || '')))

const packageScope = entries.filter(entry => {
  const prefix = String(entry.code).slice(0, 2)
  return ['01', '02', '03', '04', '05'].includes(prefix)
})

const report = {
  schemaVersion: 1,
  generatedBy: 'tools/audit-card-entry-compliance.mjs',
  note: '阻断项基线只减不增：baseline 里的卡号是 2026-10-28 扫描时的存量违规；修复后跑 --write 收紧。出现基线外的新违规，--check 失败。',
  rules: [
    { id: 'R1', name: 'directStateWrite', blocking: true, description: '条目文件直接写运行时状态（state/inv/location/enemy/act/agenda/asset/target/card 的字段或数组）' },
    { id: 'R2', name: 'reprintDuplicate', blocking: true, description: '同一张印刷卡（duplicateOfCode）两个卡号都写了条目' },
    { id: 'R3', name: 'playConditionGap', blocking: true, description: '卡文要求「只能在你回合打出」但条目没有 playCondition' },
    { id: 'R4', name: 'singleCardField', blocking: false, description: '只被 1 个条目写的状态字段（原语缺口信号）' },
    { id: 'R5', name: 'testWrapper', blocking: false, description: '「显现 - 检定」条目整体只是 api.test(...) + return false 的包装' },
  ],
  scope: {
    entries: entries.length,
    player: entries.filter(entry => entry.area === 'player').length,
    encounter: entries.filter(entry => entry.area === 'encounter').length,
    cycles01to05: packageScope.length,
  },
  counts: {
    directStateWrite: directStateWrite.length,
    singleCardField: singleCardField.length,
    reprintDuplicate: reprintDuplicate.length,
    playConditionGap: playConditionGap.length,
    testWrapper: testWrappers.length,
    revelationTestCards: revelationTest.length,
  },
  // 阻断项基线：这些卡号允许保留现状（存量债），新增违规会让 --check 失败。
  baseline: {
    directStateWrite: directStateWrite.map(entry => entry.code).sort(),
    reprintDuplicate: reprintDuplicate.map(item => item.code).sort(),
    playConditionGap: playConditionGap.map(entry => entry.code).sort(),
  },
  // 观察项：只记数，便于下一轮原语拆分排期。
  watch: {
    singleCardField,
    testWrapperCodes: testWrappers.map(entry => entry.code).sort(),
    revelationTestWrappers: revelationTest.filter(entry => entry.hasTest).map(entry => entry.code).sort(),
    revelationTestStubs: revelationTest.filter(entry => !entry.hasTest).map(entry => entry.code).sort(),
  },
  fields: Object.fromEntries([...fieldWriters.entries()].map(([field, codes]) => [field, [...codes].sort()]).sort(([a], [b]) => a.localeCompare(b))),
}

const mode = process.argv.slice(2).find(arg => arg.startsWith('--')) || '--check'

if (mode === '--write') {
  writeFileSync(LEDGER, JSON.stringify(report, null, 1) + '\n', 'utf8')
  console.log(`写入 ${path.relative(ROOT, LEDGER)}`)
  console.log(JSON.stringify(report.counts, null, 1))
  process.exit(0)
}

if (!existsSync(LEDGER)) {
  console.error('缺少 audit/card-entry-compliance.json：先运行 node tools/audit-card-entry-compliance.mjs --write')
  process.exit(1)
}

const baseline = JSON.parse(readFileSync(LEDGER, 'utf8'))
const problems = []
const remaining = []

const compareSet = (rule, current, recorded) => {
  const known = new Set(recorded || [])
  const now = new Set(current)
  for (const code of now) {
    if (!known.has(code)) problems.push(`${rule} 新增违规：${code}`)
  }
  for (const code of known) {
    if (!now.has(code)) remaining.push(`${rule} 已修复（可 --write 收紧基线）：${code}`)
  }
}

compareSet('R1 directStateWrite', report.baseline.directStateWrite, baseline.baseline?.directStateWrite)
compareSet('R2 reprintDuplicate', report.baseline.reprintDuplicate, baseline.baseline?.reprintDuplicate)
compareSet('R3 playConditionGap', report.baseline.playConditionGap, baseline.baseline?.playConditionGap)

for (const line of remaining) console.log(`ℹ️  ${line}`)

if (problems.length) {
  console.error('卡条目合规审计失败：')
  for (const line of problems) console.error(`  ✗ ${line}`)
  console.error('规则见 docs/arkham-content-migration.md §4.6.10 与 AGENTS.md「不可协商」。')
  process.exit(1)
}

console.log('卡条目合规审计通过（无基线外新增违规）')
console.log(JSON.stringify(report.counts, null, 1))
