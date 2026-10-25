// 第三轮重审结果质量抽查（只报警，不做硬门禁）：
// 1) 同一张卡所有子句 evidence 完全相同 → 高度疑似「一个模板套全部」（重审未逐子句核对）；
// 2) evidence 只指向条目文件 `:1-N（当前条目实现）` 而没有 behavior/engine/测试行号 → 证据过弱；
// 3) 上一轮非 match、本轮 match，但 note 或 evidence 未更新 → 疑似照抄旧结论。
import { readFileSync, readdirSync, existsSync } from 'node:fs'

const RESULTS = 'artifacts/tcu-audit/results'
const ROUND2 = 'artifacts/tcu-audit/results-round2'
const load = dir => {
  const map = new Map()
  if (!existsSync(dir)) return map
  for (const file of readdirSync(dir).filter(name => name.endsWith('.json'))) {
    const doc = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8'))
    for (const card of doc.cards || []) map.set(card.code, { ...card, file })
  }
  return map
}
const r2 = load(ROUND2)
const results = load(RESULTS)
const generic = /^\S+:1-\d+（当前条目实现）；\S+:3/
const problems = []
for (const [code, card] of results) {
  const evid = (card.clauses || []).map(clause => String(clause.evidence || ''))
  const unique = new Set(evid)
  if (card.clauses?.length >= 2 && unique.size === 1) {
    problems.push({ code, file: card.file, kind: 'same-evidence', verdict: card.verdict, sample: evid[0]?.slice(0, 80) })
    continue
  }
  if (evid.some(text => generic.test(text))) {
    problems.push({ code, file: card.file, kind: 'generic-entry-evidence', verdict: card.verdict, sample: evid.find(text => generic.test(text))?.slice(0, 80) })
  }
  const before = r2.get(code)
  if (before && before.verdict !== 'match' && card.verdict === 'match') {
    const sameEvidence = JSON.stringify(before.clauses?.map(c => c.evidence)) === JSON.stringify(evid)
    const sameNote = (before.note || '') === (card.note || '')
    if (sameEvidence && sameNote) problems.push({ code, file: card.file, kind: 'stale-upgrade', verdict: card.verdict, sample: '升级但 evidence/note 与上一轮完全相同' })
  }
}
const byFile = {}
for (const item of problems) (byFile[item.file] ??= []).push(item)
for (const [file, list] of Object.entries(byFile).sort()) {
  console.log(`\n== ${file}（${list.length} 条可疑）`)
  for (const item of list.slice(0, 6)) console.log(`  ${item.code} [${item.kind}] ${item.verdict} ${item.sample}`)
  if (list.length > 6) console.log(`  … 另 ${list.length - 6} 条`)
}
console.log(`\n合计可疑 ${problems.length} 条`)
