// 卡条目合规审计：把「卡只能经 ctx.api 改状态」等迁移规矩固化成可复算的账本。
//
// 规则（阻断，基线只减不增）：
//   R1 directStateWrite   条目文件直接写运行时状态（state / inv / location / enemy / act / agenda /
//                         asset / target / card 的字段或数组），含经 context.<stateField> 表达式
//                         或同文件局部变量别名（如 `const whip = inv.assets.find(...); whip.exhausted = true`）
//                         的间接直写（P0-11 补漏：旧正则只认字面 STATE_ROOTS 前缀）。
//   R2 reprintDuplicate   同一张印刷卡（cards-data 的 duplicateOfCode）两个卡号都写了条目。
//   R3 playConditionGap   卡文要求「只能在你回合打出」，但条目没有 playCondition。
//
// 观察项（不阻断，只记数）：
//   R4 singleCardField    只被 1 个条目写的状态字段——原语缺口信号。
//   R5 testWrapper        「显现 - 检定」条目整体只是 api.test(...) + return false 的包装。
//   R6 selfCodeInstanceLookup  把自身卡号当实例身份做 find/filter/some/every——同名多份
//                         （05154 鹰眼相机、06279 智慧古书）只结算第一张的静态信号。
//                         同名多份统计语义的多重卡（06021/06034/06199/06245 等）在此登记为白名单。
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
const IGNORED = new Set(['index.js', '_shared.js', '_lookup.js', '_reprint-aliases.js'])

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
const CONTEXT_STATE_FIELDS = [...STATE_ROOTS, 'source']
const IDENT = '[A-Za-z_$][\\w$]*'
const WRITE_OPS = '=(?!=)|\\+=|-=|\\*=|\\|=|\\|\\|=|\\.push\\(|\\.splice\\('
const WRITE_RE = new RegExp(
  `(?:^|[^.\\w$])(${STATE_ROOTS.join('|')})\\.(${IDENT})\\s*(${WRITE_OPS})`,
  'g',
)
// context 直接成员写：`context.asset.exhausted = true` 这类（旧正则的 [^.\w$] 前缀会漏掉）。
const CONTEXT_WRITE_RE = new RegExp(
  `(?:^|[^.\\w$])((?:context|ctx)\\.(${CONTEXT_STATE_FIELDS.join('|')}))\\.(${IDENT})\\s*(${WRITE_OPS})`,
  'g',
)
const escapeRe = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// R1 补漏（P0-11）：局部变量直写。例：08008.js 把 inv.assets.find(...) 的结果存进 whip，
// 再 `whip.exhausted = true`；旧 STATE_ROOTS 正则只认 state/inv/... 字面前缀，漏检这类写法。
// 做法：从直接状态根 / `context.<stateField>` 表达式出发做一次轻量污点传播（只跟同文件内
// const/let/var 声明与 context 解构），再对「被污染的标识符.字段 = ...」计为 R1。
function collectTaintedIdentifiers(source) {
  const tainted = new Set(STATE_ROOTS)
  const rhsLooksState = rhs => {
    for (const name of tainted) {
      const pattern = new RegExp(`(?:^|[^.\\w$])${escapeRe(name)}\\s*(?:\\.[A-Za-z_$]|\\[|\\?\\.)`)
      if (pattern.test(rhs)) return true
    }
    const contextPattern = new RegExp(
      `(?:^|[^.\\w$])(?:context|ctx)\\.(?:${CONTEXT_STATE_FIELDS.join('|')})\\b`)
    return contextPattern.test(rhs)
  }
  // const { source: alias, asset } = context  // 解构别名也视作状态对象。
  for (const match of source.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:context|ctx)\b/g)) {
    for (const part of match[1].split(',')) {
      const [rawKey, rawAlias] = part.split(':').map(piece => piece?.trim() ?? '')
      const key = rawKey?.replace(/=.*$/, '').trim()
      const name = (rawAlias || key)?.replace(/=.*$/, '').trim()
      if (name && /^[A-Za-z_$][\w$]*$/.test(name) && CONTEXT_STATE_FIELDS.includes(key)) tainted.add(name)
    }
  }
  const declRe = /(?:^|\n)\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^\n]*)/g
  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false
    declRe.lastIndex = 0
    let match
    while ((match = declRe.exec(source))) {
      const [, name, rhs] = match
      if (tainted.has(name)) continue
      if (rhsLooksState(rhs)) {
        tainted.add(name)
        changed = true
      }
    }
    if (!changed) break
  }
  return tainted
}
function scanStateWrites(source) {
  const writes = []
  const lines = source.split('\n')
  const push = (root, field, lineIndex, matchText) => {
    writes.push({ root, field, line: lineIndex + 1, text: matchText.trim().slice(0, 140) })
  }
  lines.forEach((line, index) => {
    WRITE_RE.lastIndex = 0
    let match
    while ((match = WRITE_RE.exec(line))) push(match[1], match[2], index, line)
    CONTEXT_WRITE_RE.lastIndex = 0
    while ((match = CONTEXT_WRITE_RE.exec(line))) push(match[1], match[3], index, line)
  })
  const tainted = collectTaintedIdentifiers(source)
  const localWriteRe = new RegExp(
    `(?:^|[^.\\w$])(${[...tainted].sort((left, right) => right.length - left.length).map(escapeRe).join('|')})`
    + `\\.(${IDENT})\\s*(${WRITE_OPS})`, 'g')
  lines.forEach((line, index) => {
    localWriteRe.lastIndex = 0
    let match
    while ((match = localWriteRe.exec(line))) push(match[1], match[2], index, line)
  })
  // 同一行可能被多条规则命中（如 `inv.assets = ...`），按 root+field+line 去重。
  const seen = new Set()
  return writes.filter(write => {
    const key = `${write.root}.${write.field}:${write.line}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// R6（观察项）：把「自身卡号」当成实例身份做集合查找。
// 触发式: `... .find/filter/some/every/flatMap(... code === '<自身卡号>' / selfCode ...)`。
// 同名多份时应使用 ctx.source / context.assetId 等实例指代；按卡号查只适用于
// 「按同名张数统计」的多重卡（06021/06034/06199/06245 等），进 watch 白名单，不阻断。
const LOOKUP_CALL_RE = /\.(?:find|filter|some|every|flatMap)\(/
const selfCodePatterns = code => [
  new RegExp(`(?:^|[^\\w$])code\\s*[!=]==?\\s*['"]${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`),
  /(?:^|[^\w$])code\s*[!=]==?\s*selfCode\b/,
]
function scanSelfCodeLookups(lines, rawLines, code) {
  const patterns = selfCodePatterns(code)
  const hits = []
  for (let index = 0; index < lines.length; index++) {
    // 允许跨一行（`find(asset =>` 换行后写 `asset.code === '...'`）。
    const text = `${lines[index]} ${lines[index + 1] || ''}`
    if (!LOOKUP_CALL_RE.test(lines[index]) && !LOOKUP_CALL_RE.test(lines[index + 1] || '')) continue
    if (!patterns.some(pattern => pattern.test(text))) continue
    hits.push({ line: index + 1, text: rawLines[index].trim().slice(0, 140) })
  }
  return hits
}

function entryCode(source, file) {
  const match = source.match(/["']?code["']?\s*:\s*['"]([^'"]+)['"]/)
  return match ? match[1] : path.basename(file, '.js')
}

function scanEntry(file, area) {
  const raw = readFileSync(file, 'utf8')
  const code = entryCode(raw, file)
  const source = stripComments(raw)
  const rawLines = raw.split('\n')
  const lines = source.split('\n')
  const writes = scanStateWrites(source)
  return {
    code,
    area,
    file: path.relative(ROOT, file).replace(/\\/g, '/'),
    source,
    raw,
    writes,
    selfCodeLookups: scanSelfCodeLookups(lines, rawLines, code),
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

// R6（观察项）：把自身卡号当实例身份做集合查找。06279/05154 这类同名多份 bug 的静态信号。
const selfCodeLookup = entries.filter(entry => entry.selfCodeLookups.length > 0)

const packageScope = entries.filter(entry => {
  const prefix = String(entry.code).slice(0, 2)
  return ['01', '02', '03', '04', '05'].includes(prefix)
})

const report = {
  schemaVersion: 1,
  generatedBy: 'tools/audit-card-entry-compliance.mjs',
  note: '阻断项基线只减不增：baseline 里的卡号是 2026-10-28 扫描时的存量违规；修复后跑 --write 收紧。出现基线外的新违规，--check 失败。2026-11-08 P0-11：R1 补检局部变量/context 直写后新识别 15 条存量违规（08008 等），属检测范围扩大而非新增债务，随 --write 记入基线。',
  rules: [
    { id: 'R1', name: 'directStateWrite', blocking: true, description: '条目文件直接写运行时状态（state/inv/location/enemy/act/agenda/asset/target/card 的字段或数组），含经 context.<stateField> 或同文件局部变量别名的间接直写' },
    { id: 'R2', name: 'reprintDuplicate', blocking: true, description: '同一张印刷卡（duplicateOfCode）两个卡号都写了条目' },
    { id: 'R3', name: 'playConditionGap', blocking: true, description: '卡文要求「只能在你回合打出」但条目没有 playCondition' },
    { id: 'R4', name: 'singleCardField', blocking: false, description: '只被 1 个条目写的状态字段（原语缺口信号）' },
    { id: 'R5', name: 'testWrapper', blocking: false, description: '「显现 - 检定」条目整体只是 api.test(...) + return false 的包装' },
    { id: 'R6', name: 'selfCodeInstanceLookup', blocking: false, description: '把自身卡号当实例身份做 find/filter/some/every（同名多份时应使用 ctx.source / context.assetId 等实例指代；按同名张数统计的多重卡属白名单）' },
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
    selfCodeInstanceLookup: selfCodeLookup.length,
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
    // R6：卡号 → 命中行；同名多份统计语义的卡在此登记为白名单（清掉真 bug 后基线只减不增）。
    selfCodeInstanceLookup: selfCodeLookup
      .map(entry => ({ code: entry.code, file: entry.file, hits: entry.selfCodeLookups }))
      .sort((a, b) => a.code.localeCompare(b.code)),
  },
  fields: Object.fromEntries([...fieldWriters.entries()].map(([field, codes]) => [field, [...codes].sort()]).sort(([a], [b]) => a.localeCompare(b))),
}

export { entries, report, scanStateWrites, collectTaintedIdentifiers }

function main() {
  const mode = process.argv.slice(2).find(arg => arg.startsWith('--')) || '--check'

  if (mode === '--write') {
    writeFileSync(LEDGER, JSON.stringify(report, null, 1) + '\n', 'utf8')
    console.log(`写入 ${path.relative(ROOT, LEDGER)}`)
    console.log(JSON.stringify(report.counts, null, 1))
    return
  }

  if (!existsSync(LEDGER)) {
    console.error('缺少 audit/card-entry-compliance.json：先运行 node tools/audit-card-entry-compliance.mjs --write')
    process.exitCode = 1
    return
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
    process.exitCode = 1
    return
  }

  console.log('卡条目合规审计通过（无基线外新增违规）')
  console.log(JSON.stringify(report.counts, null, 1))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
