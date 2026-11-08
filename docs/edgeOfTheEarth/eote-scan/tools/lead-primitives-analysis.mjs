import { readFileSync, writeFileSync } from 'node:fs'
const SCAN = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan'
const scope = JSON.parse(readFileSync(`${SCAN}/scope/cards.json`, 'utf8'))
const cardByCode = new Map(scope.cards.map(c => [c.code, c]))
const triage = JSON.parse(readFileSync(`${SCAN}/primitives/unread-triage-auto.json`, 'utf8'))
const dup = JSON.parse(readFileSync(`${SCAN}/screen/duplication.json`, 'utf8'))
const complexity = JSON.parse(readFileSync(`${SCAN}/primitives/entry-complexity.json`, 'utf8'))
const analysis = JSON.parse(readFileSync(`${SCAN}/ledger/lead-analysis.json`, 'utf8'))
const status = code => cardByCode.get(code)?.status || '?'
const chapter = code => cardByCode.get(code)?.chapter || cardByCode.get(code)?.group || '?'

// unread 分类
const rows = triage.rows.map(r => ({ ...r, cardStatus: status(r.code), chapter: chapter(r.code) }))
const byStatus = {}
for (const r of rows) {
  byStatus[r.cardStatus] = byStatus[r.cardStatus] || { total: 0, byVerdict: {}, byBlock: {} }
  byStatus[r.cardStatus].total += 1
  byStatus[r.cardStatus].byVerdict[r.verdict] = (byStatus[r.cardStatus].byVerdict[r.verdict] || 0) + 1
}
const ruleValueRows = rows.filter(r => r.kind === 'rule-value')
const verifiedKeyRows = rows.filter(r => r.kind !== 'rule-value' && r.cardStatus === 'verified')
const simplifiedRows = rows.filter(r => r.cardStatus === 'simplified')
const byChapter = {}
for (const r of rows) byChapter[r.chapter] = (byChapter[r.chapter] || 0) + 1

// clone 聚类（并查集）
const parent = new Map()
const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))) ; x = parent.get(x) } return x }
const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb) }
const pairs = dup.clonePairs
for (const p of pairs) { for (const c of [p.a, p.b]) if (!parent.has(c)) parent.set(c, c); union(p.a, p.b) }
const clusters = new Map()
for (const p of pairs) { const root = find(p.a); if (!clusters.has(root)) clusters.set(root, new Set()); clusters.get(root).add(p.a).add(p.b) }
const clusterRows = [...clusters.values()].map(set => {
  const codes = [...set]
  return {
    codes,
    count: codes.length,
    lines: codes.reduce((n, c) => n + (complexity.topLines.find(x => x.code === c)?.lines || 0), 0),
    name: codes.map(c => `${c}:${cardByCode.get(c)?.nameZh || ''}`).join('；'),
    chapters: [...new Set(codes.map(chapter))],
    statuses: [...new Set(codes.map(status))],
    maxJaccard: Math.max(...pairs.filter(p => codes.includes(p.a) && codes.includes(p.b)).map(p => p.jaccard)),
  }
}).sort((a, b) => b.count - a.count)

const out = {
  generatedAt: new Date().toISOString(),
  unread: {
    total: rows.length,
    byStatus,
    byChapter,
    ruleValues: ruleValueRows,
    verifiedKeys: verifiedKeyRows,
    simplified: simplifiedRows,
  },
  cloneClusters: clusterRows.map(c => ({ ...c, lines: undefined })),
  cloneClusterDetail: clusterRows,
  textDuplicateGroups: dup.textDuplicateGroups,
  reprint: analysis.duplication.reprint,
  crossCycleSameText: analysis.duplication.crossCycleSameText,
  complexity: complexity.summary,
}
writeFileSync(`${SCAN}/primitives/lead-primitives-analysis.json`, JSON.stringify(out, null, 1))
console.log(JSON.stringify({
  unreadByStatus: Object.fromEntries(Object.entries(byStatus).map(([k, v]) => [k, v.total])),
  ruleValues: ruleValueRows.length,
  verifiedKeys: verifiedKeyRows.length,
  simplified: simplifiedRows.length,
  clusters: clusterRows.map(c => `${c.codes.join(',')} (${c.count}卡, maxJac ${c.maxJaccard})`),
  crossCycle: dup.crossCycleSameText,
}, null, 1))
