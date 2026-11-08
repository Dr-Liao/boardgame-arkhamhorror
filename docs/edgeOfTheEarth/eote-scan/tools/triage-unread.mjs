// 对 screen/flags-readpoints.json 的 unread 声明做全仓二次分类（Lead/subagent 共用）。
// 输出 games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/primitives/unread-triage-auto.json（若目录可写）+ 控制台摘要。
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MODS = join(OUT, '..', '..', '..')
const read = p => readFileSync(join(MODS, p), 'utf8')
const scope = JSON.parse(readFileSync(join(OUT, 'scope', 'cards.json'), 'utf8'))
const cardByCode = new Map(scope.cards.map(c => [c.code, c]))
const unread = JSON.parse(readFileSync(join(OUT, 'screen', 'flags-readpoints.json'), 'utf8')).unread

// 收集全仓可搜索文本
const files = []
function walk(dir, filt) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name)
    if (e.isDirectory()) { if (!e.name.startsWith('.') && e.name !== 'node_modules') walk(f, filt) }
    else if (filt(f)) files.push(f)
  }
}
const JS = f => /\.(js|mjs)$/.test(f)
walk(join(MODS, 'src'), JS)
walk(join(MODS, 'content'), JS)
walk(join(MODS, 'web'), JS)
walk(join(MODS, 'tests'), JS)
walk(join(MODS, 'docs'), f => /\.(md|json)$/.test(f))
if (existsSync(join(MODS, 'audit'))) walk(join(MODS, 'audit'), f => /\.(json|md)$/.test(f) && statSync(f).size < 3_000_000)
const textIndex = files.map(f => ({ path: relative(MODS, f).split('\\').join('/'), text: readFileSync(f, 'utf8') }))
const categoryOf = p => p.startsWith('src/') ? 'src' : p.startsWith('content/') ? 'content' : p.startsWith('web/') ? 'web' : p.startsWith('tests/') ? 'tests' : p.startsWith('docs/') ? 'docs' : p.startsWith('audit/') ? 'audit' : 'other'

const rows = []
for (const u of unread) {
  const token = u.key
  const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
  const declaringEntry = cardByCode.get(u.code)?.entryPath || null
  const hits = []
  for (const f of textIndex) if (re.test(f.text)) hits.push(f.path)
  const byCat = hits.reduce((a, h) => ((a[categoryOf(h)] = (a[categoryOf(h)] || 0) + 1), a), {})
  const outsideDeclaring = hits.filter(h => h !== declaringEntry)
  // 只看行为消费可能的目录，排除所有条目文件（同 token 在兄弟卡里重复声明不算读点）
  const isEntryFile = h => h.includes('/entries/') || h.includes('/encounter-entries/') || h.endsWith('cards-data.js')
  const consumerHits = outsideDeclaring.filter(h => !isEntryFile(h) && (categoryOf(h) === 'src' || categoryOf(h) === 'content' || categoryOf(h) === 'web'))
  let verdict
  if (!outsideDeclaring.length) verdict = 'nowhere-outside-declaration'
  else if (!consumerHits.length) {
    if (byCat.tests) verdict = 'test-only'
    else if (byCat.docs) verdict = 'docs-only'
    else if (byCat.audit) verdict = 'audit-only'
    else verdict = 'unclassified'
  } else {
    // 有出现，但机械筛查时未在 engine/content 命中（可能只在 web 或命名冲突）
    verdict = byCat.web && !byCat.src && !byCat.content ? 'web-only' : 'consumer-hit-review'
  }
  rows.push({
    code: u.code, name: u.name, block: u.block, key: u.key, kind: u.kind || 'key',
    verdict, categories: byCat, consumerHits: consumerHits.slice(0, 6), allHits: [...new Set(outsideDeclaring)].slice(0, 10),
    entry: declaringEntry, chapter: cardByCode.get(u.code)?.chapter || null, group: cardByCode.get(u.code)?.group || null,
    entryContainsToken: declaringEntry ? new RegExp(`\\b${token}\\b`).test(read(declaringEntry)) : false,
  })
}
const byVerdict = rows.reduce((a, r) => ((a[r.verdict] = (a[r.verdict] || 0) + 1), a), {})
const byBlock = rows.reduce((a, r) => ((a[`${r.block}`] = (a[`${r.block}`] || 0) + 1), a), {})
const outDir = join(OUT, 'primitives')
const out = { generatedAt: new Date().toISOString(), summary: { total: rows.length, byVerdict, byBlock }, rows }
try {
  writeFileSync(join(outDir, 'unread-triage-auto.json'), JSON.stringify(out, null, 1))
  console.log('wrote', join(outDir, 'unread-triage-auto.json'))
} catch (e) {
  writeFileSync(join(OUT, 'screen', 'unread-triage-auto.json'), JSON.stringify(out, null, 1))
  console.log('fallback wrote screen/unread-triage-auto.json', e.message)
}
console.log(JSON.stringify({ total: rows.length, byVerdict, byBlock }, null, 1))
console.log('\n-- nowhere-outside-declaration sample --')
for (const r of rows.filter(r => r.verdict === 'nowhere-outside-declaration').slice(0, 40)) console.log(`${r.code}\t${r.block}.${r.key}\t${r.kind}`)
console.log('\n-- test-only sample --')
for (const r of rows.filter(r => r.verdict === 'test-only').slice(0, 30)) console.log(`${r.code}\t${r.block}.${r.key}\t${r.kind}\t${r.allHits.join(',')}`)
console.log('\n-- consumer-hit-review sample --')
for (const r of rows.filter(r => r.verdict === 'consumer-hit-review').slice(0, 20)) console.log(`${r.code}\t${r.block}.${r.key}\t${r.allHits.join(',')}`)
