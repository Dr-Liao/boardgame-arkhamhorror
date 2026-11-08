// 汇总所有 area findings + Lead 分析 → 全量扫描总账本与统计表。
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
const SCAN = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan'
const readJson = p => JSON.parse(readFileSync(`${SCAN}/${p}`, 'utf8'))
const scope = readJson('scope/cards.json')
const cardByCode = new Map(scope.cards.map(c => [c.code, c]))
const areas = [
  ['investigators', 'investigators/findings.json'],
  ['player-a', 'player-a/findings.json'],
  ['player-b', 'player-b/findings.json'],
  ['campaign-a', 'campaign/a/findings.json'],
  ['campaign-b', 'campaign/b/findings.json'],
  ['campaign-c', 'campaign/c/findings.json'],
  ['campaign-d', 'campaign/d/findings.json'],
  ['scenarios', 'scenarios/findings.json'],
  ['interactions', 'interactions/findings.json'],
  ['primitives', 'primitives/findings.json'],
]
const loaded = []
const missing = []
for (const [area, path] of areas) {
  if (!existsSync(`${SCAN}/${path}`)) { missing.push({ area, path }); continue }
  try {
    const j = readJson(path)
    loaded.push({ area, path, data: j })
  } catch (e) { missing.push({ area, path, error: String(e.message) }) }
}
// 归一化每卡
const cards = []
const areaSummaries = []
for (const { area, path, data } of loaded) {
  const records = data.cards || []
  const summary = data.summary || {}
  const issuesTop = []
  const collectIssue = (issue, code) => {
    if (!issue || typeof issue !== 'object') return
    issuesTop.push({ area, code: code || issue.code || null, severity: issue.severity || 'medium', dimension: issue.dimension || 'impl-vs-text', summary: String(issue.summary || issue.note || '').slice(0, 240), evidence: String(issue.evidence || '').slice(0, 400), suggestion: String(issue.suggestion || '').slice(0, 240) })
  }
  for (const r of records) {
    for (const issue of r.issues || []) collectIssue(issue, r.code)
    const sev = { high: 0, medium: 0, low: 0 }
    for (const issue of r.issues || []) sev[issue.severity] = (sev[issue.severity] || 0) + 1
    cards.push({
      area, code: r.code, name: r.nameZh || r.name || cardByCode.get(r.code)?.nameZh || '',
      partition: cardByCode.get(r.code)?.partition || null,
      chapter: cardByCode.get(r.code)?.chapter || cardByCode.get(r.code)?.group || null,
      ledgerStatus: cardByCode.get(r.code)?.status || null,
      verdict: r.verdict || r.status || 'unknown',
      accepted: r.accepted === true,
      issues: sev, totalIssues: (r.issues || []).length,
      topIssue: (r.issues || [])[0] ? String((r.issues || [])[0].summary || '').slice(0, 200) : null,
    })
  }
  for (const issue of data.issues || []) collectIssue(issue)
  for (const s of data.scenarios || []) for (const issue of s.issues || []) collectIssue(issue, s.chapterId || s.id)
  areaSummaries.push({
    area, file: `${SCAN}/${path}`.replace(SCAN + '/', ''), summary,
    cardRecords: records.length,
    issueCount: issuesTop.length,
    issuesBySeverity: issuesTop.reduce((a, i) => ((a[i.severity] = (a[i.severity] || 0) + 1), a), {}),
  })
  data._issuesTop = issuesTop
  loaded.find(x => x.area === area)._issues = issuesTop
}
// 场景/章节级 issue
const scenarioIssues = []
for (const { area, data } of loaded) {
  for (const s of data.scenarios || []) {
    for (const issue of s.issues || []) scenarioIssues.push({ area, chapterId: s.chapterId || s.id, ...issue })
  }
}
const allIssues = loaded.flatMap(l => l._issues || []).filter(Boolean)
const seen = new Set()
const uniqueIssues = []
for (const i of allIssues) {
  const key = `${i.code || ''}|${i.summary}|${i.evidence}`
  if (seen.has(key)) continue
  seen.add(key)
  uniqueIssues.push(i)
}
uniqueIssues.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.severity] ?? 3) - ({ high: 0, medium: 1, low: 2 }[b.severity] ?? 3))
// 账本有效性
const ledgerValidity = existsSync(`${SCAN}/screen/ledger-validity.json`) ? readJson('screen/ledger-validity.json') : null
const deadHooks = existsSync(`${SCAN}/screen/dead-hooks-exact.json`) ? readJson('screen/dead-hooks-exact.json') : null
// verdict 统计
const verdictBy = {}
for (const c of cards) {
  const key = `${c.partition || '?'}|${c.chapter || '-'}`
  verdictBy[key] = verdictBy[key] || { total: 0, match: 0, approximation: 0, gap: 0, blocked: 0, 'not-applicable': 0, other: 0 }
  const slot = verdictBy[key]
  slot.total += 1
  if (slot[c.verdict] != null) slot[c.verdict] += 1
  else slot.other += 1
}
const severityTotals = uniqueIssues.reduce((a, i) => ((a[i.severity] = (a[i.severity] || 0) + 1), a), {})
const dimensionTotals = uniqueIssues.reduce((a, i) => ((a[i.dimension] = (a[i.dimension] || 0) + 1), a), {})
const ledger = {
  schemaVersion: 1,
  cycle: 'eote',
  campaignId: 'edgeOfTheEarth',
  generatedAt: new Date().toISOString(),
  scanner: 'lead + 8 auditors + 3 verifiers (deepseek-flash Team)',
  scope: {
    records: scope.cards.length,
    partitions: { eoteInvestigators: 22, eotePlayer: 115, eoteCampaign: 266 },
    chapters: 8,
    sources: 'games/arkhamhorror/audit/eote-*.json, src/cards/cards-data.js, content/campaigns/edgeOfTheEarth/**',
  },
  areas: areaSummaries,
  missingAreas: missing,
  cards,
  verdictBy,
  issues: uniqueIssues,
  issueTotals: { bySeverity: severityTotals, byDimension: dimensionTotals, total: uniqueIssues.length, scenarioIssues: scenarioIssues.length },
  scenarioIssues,
  ledgerValidity: ledgerValidity ? ledgerValidity.summary : null,
  deadHooks: deadHooks ? deadHooks.summary : null,
  gates: {
    eoteTestSuite: { tests: 477, pass: 474, fail: 3, failures: ['P8 all-cards 账本 hash 漂移（真实）', 'eote-story story 生成物 --check（沙箱 spawn 伪失败）', 'eote-story guides 幂等 --check（沙箱 spawn 伪失败）'] },
    auditChecks: { 'audit-eote.mjs': 0, 'scan-eote-mechanisms': 0, 'scan-eote-scope': 0, 'audit-card-entry-compliance': 0, 'audit-dead-primitives': 0, 'audit-eote-rules': 0, 'audit-eote-interactions': 0, 'audit-eote-primitives': 0 },
    nonEote: { buildCardIndex: 0, buildEncounterIndex: 0, checkDocLinks: 1 },
  },
  limitations: [
    '浏览器/Playwright 无法在本沙箱运行（spawn EPERM），浏览器证据只做账本+截图+spec 断言存在性核验，未重跑。',
    'verify-eote / audit-eote-all-cards / audit-eote-player / audit-eote-investigators 等内部 spawn 的工具无法运行，以其账本+自写复算替代。',
    '沙箱对 mod 目录只读、跨目录写入受限，工作区与原始日志存于 games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/。',
    '逐卡 verdict 来自 8 名审计员人工核对 cards-data 卡面中英文，非官方逐字等价声明。',
  ],
  reproducibility: [
    'node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/extract-scope.mjs',
    'node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/mechanical-screen.mjs',
    'node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/triage-unread.mjs',
    'node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/lead-analysis.mjs',
    'node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/ledger-evidence-check.mjs && node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/ledger-validity.mjs',
    'node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/dead-hooks-exact.mjs',
    'node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/merge-findings.mjs',
  ],
}
writeFileSync(`${SCAN}/ledger/eote-full-scan.json`, JSON.stringify(ledger, null, 1))
// 统计表 markdown
const md = []
md.push('# EOTE 全量扫描统计汇总（自动生成）')
md.push('')
md.push(`生成时间：${ledger.generatedAt}`)
md.push('')
md.push('## 覆盖与 verdict')
md.push('')
md.push('| 分区 / 章节 | total | match | approximation | gap | blocked |')
md.push('| --- | --- | --- | --- | --- | --- |')
for (const [key, v] of Object.entries(verdictBy)) md.push(`| ${key} | ${v.total} | ${v.match} | ${v.approximation} | ${v.gap} | ${v.blocked} |`)
md.push('')
md.push('## issue 统计')
md.push('')
md.push(`- 总 issue（去重）：${uniqueIssues.length}；按 severity：${JSON.stringify(severityTotals)}`)
md.push(`- 按维度：${JSON.stringify(dimensionTotals)}`)
md.push(`- 场景级 issue：${scenarioIssues.length}`)
md.push('')
md.push('## 各 area 覆盖')
md.push('')
md.push('| area | 卡数 | issue | severity |')
md.push('| --- | --- | --- | --- |')
for (const a of areaSummaries) md.push(`| ${a.area} | ${a.cardRecords} | ${a.issueCount} | ${JSON.stringify(a.issuesBySeverity)} |`)
md.push('')
md.push('## 账本有效性 / 死钩子')
md.push('')
md.push('```json')
md.push(JSON.stringify({ ledgerValidity: ledger.ledgerValidity, deadHooks: ledger.deadHooks }, null, 1))
md.push('```')
writeFileSync(`${SCAN}/ledger/summary-tables.md`, md.join('\n'))
console.log(JSON.stringify({ loadedAreas: areaSummaries.map(a => a.area), missing, cards: cards.length, issues: uniqueIssues.length, severityTotals, dimensionTotals, scenarioIssues: scenarioIssues.length }, null, 1))
