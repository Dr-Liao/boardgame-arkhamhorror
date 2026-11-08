// 从 eote-full-scan.json 生成：紧凑账本（可写入 mod audit/）、报告表格、per-card 表。
import { readFileSync, writeFileSync } from 'node:fs'
const SCAN = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan'
const j = JSON.parse(readFileSync(`${SCAN}/ledger/eote-full-scan.json`, 'utf8'))
// 1) 紧凑账本
const compact = {
  schemaVersion: 1,
  cycle: 'eote',
  campaignId: 'edgeOfTheEarth',
  generatedAt: j.generatedAt,
  scanner: j.scanner,
  method: '人工逐卡/逐章独立复核（cards-data 卡面 vs 条目/章节 behavior/引擎读点/测试）+ 机械筛查（范围提取、声明读点、账本有效性、克隆、死钩子）+ 3 组对抗式复核。完整数据见工作区 games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/（bundles/、screen/、各 area findings.json、verify/）。',
  scope: j.scope,
  areaSummaries: j.areas.map(a => ({ area: a.area, cards: a.cardRecords, issues: a.issueCount, bySeverity: a.issuesBySeverity })),
  verdictBy: j.verdictBy,
  issueTotals: j.issueTotals,
  topIssues: j.issues.slice(0, 60).map(i => ({ severity: i.severity, dimension: i.dimension, code: i.code, area: i.area, summary: i.summary, evidence: (i.evidence || '').slice(0, 240) })),
  scenarioIssues: j.scenarioIssues.slice(0, 40).map(i => ({ chapterId: i.chapterId, severity: i.severity, dimension: i.dimension, summary: i.summary, evidence: (i.evidence || '').slice(0, 240) })),
  ledgerValidity: j.ledgerValidity,
  deadHooks: j.deadHooks,
  gates: j.gates,
  limitations: j.limitations,
  missingAreas: j.missingAreas,
  reproducibility: j.reproducibility,
}
writeFileSync(`${SCAN}/ledger/eote-full-scan-compact.json`, JSON.stringify(compact, null, 1))

// 2) 报告表格
const md = []
md.push('## 附录 A：各 area 覆盖与 issue 统计')
md.push('')
md.push('| area | 卡数 | issue | high | medium | low | 结论摘要 |')
md.push('| --- | --- | --- | --- | --- | --- | --- |')
for (const a of j.areas) {
  const s = a.summary || {}
  const v = s.verdicts || s.verdict || null
  const vText = v ? JSON.stringify(v) : (s.match != null ? `match=${s.match}/approx=${s.approximation}/gap=${s.gap}` : '')
  md.push(`| ${a.area} | ${a.cardRecords} | ${a.issueCount} | ${a.issuesBySeverity.high || 0} | ${a.issuesBySeverity.medium || 0} | ${a.issuesBySeverity.low || 0} | ${vText} |`)
}
md.push('')
md.push('## 附录 B：逐章 verdict 分布')
md.push('')
md.push('| 分区/章节 | total | match | approximation | gap | blocked |')
md.push('| --- | --- | --- | --- | --- | --- |')
for (const [k, v] of Object.entries(j.verdictBy)) md.push(`| ${k} | ${v.total} | ${v.match} | ${v.approximation} | ${v.gap} | ${v.blocked} |`)
md.push('')
md.push('## 附录 C：P0/P1 候选（按 high issue 排序，前 120 条）')
md.push('')
md.push('| # | severity | dimension | 卡/章 | summary | evidence |')
md.push('| --- | --- | --- | --- | --- | --- |')
j.issues.filter(i => i.severity === 'high').slice(0, 120).forEach((i, idx) => {
  md.push(`| ${idx + 1} | ${i.severity} | ${i.dimension} | ${i.code || ''} | ${String(i.summary || '').replace(/\|/g, '/').slice(0, 160)} | ${String(i.evidence || '').replace(/\|/g, '/').slice(0, 200)} |`)
})
md.push('')
md.push('## 附录 D：逐卡 verdict（403 条）')
md.push('')
md.push('| code | name | partition | 章节/组 | 账本状态 | 独立 verdict | high | medium | low |')
md.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |')
for (const c of j.cards) md.push(`| ${c.code} | ${String(c.name || '').replace(/\|/g, '/')} | ${c.partition || ''} | ${c.chapter || ''} | ${c.ledgerStatus || ''} | ${c.verdict} | ${c.issues.high || 0} | ${c.issues.medium || 0} | ${c.issues.low || 0} |`)
writeFileSync(`${SCAN}/ledger/report-appendix.md`, md.join('\n'))
console.log(JSON.stringify({ compactBytes: JSON.stringify(compact).length, appendixBytes: md.join('\n').length, issues: j.issues.length, high: j.issueTotals.bySeverity.high }))
