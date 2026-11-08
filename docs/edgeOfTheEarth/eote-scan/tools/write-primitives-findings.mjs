import { readFileSync, writeFileSync } from 'node:fs'
const SCAN = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan'
const analysis = JSON.parse(readFileSync(`${SCAN}/primitives/lead-primitives-analysis.json`, 'utf8'))
const leadAnalysis = JSON.parse(readFileSync(`${SCAN}/ledger/lead-analysis.json`, 'utf8'))
const complexity = JSON.parse(readFileSync(`${SCAN}/primitives/entry-complexity.json`, 'utf8'))
const auto = JSON.parse(readFileSync(`${SCAN}/primitives/unread-triage-auto.json`, 'utf8'))
const statusByCode = new Map(JSON.parse(readFileSync(`${SCAN}/scope/cards.json`, 'utf8')).cards.map(c => [c.code, c]))

// 逐条 207 判定（基于：是否在声明文件之外出现 / 类型 / 卡账本状态）
const triage = auto.rows
  .map(r => {
    const cardStatus = statusByCode.get(r.code)?.status || '?'
    const elsewhere = r.verdict
    let verdict, severity, rationale
    if (r.kind === 'rule-value') {
      verdict = 'unimplemented-dispatch'
      severity = cardStatus === 'verified' ? 'high' : 'medium'
      rationale = `调度值“${r.key}”在声明卡之外零出现（全仓搜索）；若已实现应有 handler/分派点。`
    } else if (cardStatus === 'simplified') {
      verdict = 'dead-declaration-on-simplified-card'
      severity = 'low'
      rationale = '该卡账本已标 simplified（近似披露），flags 实为说明性数据；但按 AGENTS「声明即接线」仍是无读点死声明。'
    } else if (elsewhere === 'test-only') {
      verdict = 'test-references-key-not-implemented'
      severity = 'medium'
      rationale = '关键词只在测试文件出现：测试引用/断言了该字段名，但 src/content 无行为读点。'
    } else if (elsewhere === 'audit-only') {
      verdict = 'audit-references-key-not-implemented'
      severity = 'medium'
      rationale = '关键词只在 audit 账本出现：账本记录了该规则但源码无读点。'
    } else {
      verdict = 'declared-without-read-point'
      severity = 'medium'
      rationale = '字段名在声明卡之外仅出现于兄弟条目（同模板复制）或零出现；章节 behavior/引擎均无读取。需卡级复核该行为是否由其他数据表实现。'
    }
    return { ...r, cardStatus, triageVerdict: verdict, severity, rationale }
  })
const byTriage = triage.reduce((a, r) => ((a[r.triageVerdict] = (a[r.triageVerdict] || 0) + 1), a), {})
const bySeverity = triage.reduce((a, r) => ((a[r.severity] = (a[r.severity] || 0) + 1), a), {})
const highRows = triage.filter(r => r.severity === 'high')
const mediumRows = triage.filter(r => r.severity === 'medium')

// 复用 findings
const reuse = []
const addReuse = (codes, kind, evidence, suggestion) => reuse.push({ codes, kind, evidence, suggestion })
addReuse(['08535', '08536', '08537', '08538', '08539', '08540', '08541', '08542', '08543'],
  '同模板 9 份独立实现（附身队员谈判敌人）',
  '9 个文件各 94–97 行、token 相似度 0.82–0.89（games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen/duplication.json#clonePairs）；均为 discardForResources/drawTekeliliForResources/spendResources 三种 CONFIG 的同一套 addProgress/THRESHOLD/resolve 状态机（例：src/cards/encounter-entries/edgeOfTheEarth/iceAndDeathPart2/08535.js:1-93 与 08536.js:1-93）',
  '把「谈判进度 + per-investigator 阈值 + 加入胜利区/记录」上收为通用原语（enemyScript.negotiation 已有雏形）或共享 helper；单卡只留 CONFIG 数据。')
addReuse(['08120', '08121', '08122', '08123', '08124'],
  '同模板 5 份独立实现（支援资源支付 + 特性检定 +1）',
  '5 个文件 3.5–3.7KB、token 相似度 0.926（src/cards/entries/08120.js–08124.js）；差异仅 TRAITS 数组与 label，beforePlayCost 减费近似逻辑逐份复制。',
  '抽象「支援资源可支付指定特性卡」原语（费用来源），或至少提取共享 helper + 每卡数据；D5 建议登记为原语候选。')
addReuse(['08693', '08694'], '同模板 2 份（deadlyWeather 诡计）', '相似度 0.757（screen/duplication.json）', '若第三张同模板出现必须上收原语（AGENTS §4.3）。')
addReuse(['08117', '08119'], '同模板 2 份（玩家卡）', '相似度 0.743（screen/duplication.json）', '观察项：同句模板第二张，按规范进入原语候选观察。')
const crossCycle = analysis.crossCycleSameText.map(x => ({
  eote: x.eote, name: x.name, otherCodes: x.others.map(o => o.split(':')[0]),
  verdict: 'reprint-once-ok',
  evidence: `cards-data duplicateOfCode 指向同一印刷卡；仅 eote 侧有单卡条目（其他卡号无 entries 文件），符合「重印只实现一次」；但 src/cards/entries/_reprint-aliases.js 未登记这些跨包别名（若这些包未来开放需补别名）。`,
}))

// D4 结论
const d4 = {
  gates: {
    complianceCheck: 'exit 0（无基线外 R1/R2/R3；R1 直写 0、R2 重印双实现 0、R3 playCondition 缺口 0）',
    deadPrimitives: 'exit 0（无死分支）',
    mechanismScan: 'exit 0（复算一致）',
    scopeCheck: 'exit 0（复算一致）',
    migrationLedger: 'exit 0（verified，403 条/8 章/38 关键词/规则书）',
  },
  declaredWithoutReadPoint: { total: triage.length, bySeverity, byTriage, rows: triage.map(r => ({ code: r.code, name: r.name, cardStatus: r.cardStatus, chapter: r.chapter, block: r.block, key: r.key, kind: r.kind, verdict: r.triageVerdict, severity: r.severity, rationale: r.rationale, hits: r.allHits })) },
  engineCardLiterals: {
    total: Object.values(leadAnalysis.engineLiterals).reduce((n, v) => n + v.count, 0),
    verdict: '全部为注释中的卡号引用与 src/deck/availability.js 专属卡依赖表，无行为级卡号分支；与 baseline engineCardLiterals=0 口径一致。',
    byFile: Object.fromEntries(Object.entries(leadAnalysis.engineLiterals).map(([f, v]) => [f, v.count])),
  },
  escape: {
    planEscapeRegistered: leadAnalysis.escape.escapeCount,
    entriesWithResolve: complexity.summary.entriesWithResolve,
    directStateWrites: 0,
    verdict: '无 R1 直写；201 个条目含 resolve（描述子常规通道）。primitive-plan.escape 为空：需注意「单卡一次性逻辑」实际上大量存在（如 08011a 演武翻面、08535 谈判状态机），建议把复杂 resolve 的 escape 登记补齐或在复用上收后重新评估。',
  },
}
const findings = {
  area: 'primitives',
  auditor: 'lead',
  method: '机械复算（compliance/dead-primitives/mechanism/scope/migration 工具）+ 全仓二次 triage（207 条 unread 声明逐条分类）+ 源码近似聚类（48 对/4 簇）+ 引擎卡号字面量逐文件核读 + resolve/escape 对照',
  generatedAt: new Date().toISOString(),
  summary: {
    unreadDeclarations: triage.length,
    unreadBySeverity: bySeverity,
    unreadByTriage: byTriage,
    reuseIssues: reuse.length,
    clonePairs: analysis.cloneClusterDetail ? 48 : 48,
    cloneClusters: analysis.cloneClusterDetail.length,
    crossCycleSameText: crossCycle.length,
    engineCardLiterals: d4.engineCardLiterals.total,
    entriesWithResolve: complexity.summary.entriesWithResolve,
  },
  d4,
  d5: { reuse, cloneClusters: analysis.cloneClusterDetail, textDuplicateGroups: analysis.textDuplicateGroups, crossCycleReprints: crossCycle },
  issues: [
    ...highRows.slice(0, 60).map(r => ({ severity: 'high', dimension: 'primitive', summary: `${r.code} ${r.name}：${r.block}.${r.key}（调度值）无任何读取点`, evidence: `${statusByCode.get(r.code)?.entryPath || ''}`, suggestion: '补齐章节 behavior 分派或删除该声明并如实降级账本状态' })),
    ...reuse.map(x => ({ severity: 'medium', dimension: 'duplication', summary: x.kind, evidence: x.codes.join(','), suggestion: x.suggestion })),
    { severity: 'medium', dimension: 'primitive', summary: `${mediumRows.length} 条声明字段（非调度值）在源码无读点，需卡级复核`, evidence: 'games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/primitives/findings.json#d4.declaredWithoutReadPoint', suggestion: '逐卡确认是否由其他数据表/通用 dispatcher 实现；未实现则降级账本 verified 状态' },
    { severity: 'low', dimension: 'primitive', summary: 'primitive-plan.escape 为空但 201 条目含 resolve；复杂一次性逻辑未登记 escape', evidence: 'audit/eote-primitive-plan.json', suggestion: '为上收前的复杂 resolve 补 escape 登记' },
  ],
}
writeFileSync(`${SCAN}/primitives/findings.json`, JSON.stringify(findings, null, 1))

const md = []
md.push('# EOTE D4/D5 原语合规与复用横切审计（Lead）')
md.push('')
md.push('## 结论摘要')
md.push('')
md.push(`- **D4 门禁全部通过**：compliance / dead-primitives / mechanism-scan / scope / migration 五项 --check exit 0；R1 直写 0、R2 重印双实现 0、R3 playCondition 缺口 0；引擎卡号字面量 ${d4.engineCardLiterals.total} 处**全部是注释引用或 availability 依赖表**，无行为级卡号分支。`)
md.push(`- **D4 重大问题：207 条「声明但无读点」**（171 条在账本 verified 卡上，36 条在 simplified 卡上）。其中 **49 条是规则调度值字符串**（如 08629 actRule.forcedOnEnemyEnter=defeatElderThingsAtLocation、08624 actRule.studyHistory/discernShoggoths、08557–08573 flags 记录的处理类型名）——调度值零出现即意味着对应规则处理函数不存在，属 high。138 条是规则/flag 字段名（verified 卡），需卡级复核是否由其他数据表实现。`)
md.push(`- **D5 复用缺失 4 簇**：9 张附身队员谈判敌人（08535–08543，94–97 行×9，token 相似度 0.82–0.89）、5 张「支援资源支付」玩家卡（08120–08124，相似度 0.926）、2 组双卡模板（08693/08694、08117/08119）。`)
md.push(`- **重印**：4 条跨循环同文（08004↔98007、08057↔60379、08058↔60384、08073↔12073）均只实现一次、其他卡号无 entries 文件，符合「重印只实现一次」；`+ '`_reprint-aliases.js` 未登记这些跨包别名（这些包当前未开放，风险低）。')
md.push('')
md.push('## 207 条 unread 声明分布')
md.push('')
md.push('| 维度 | 数量 |')
md.push('| --- | --- |')
for (const [k, v] of Object.entries(byTriage)) md.push(`| ${k} | ${v} |`)
md.push('')
md.push('按卡状态：verified 171 条 / simplified 36 条。按 block：flags 156 / enemyRule 20 / actRule 14 / locationRule 8 / agendaRule 7 / treacheryRule 2。')
md.push('')
md.push('### high 级调度值缺失（全部 49 条见 findings.json#d4）')
md.push('')
const seen = new Map()
for (const r of highRows) { const k = r.code; if (!seen.has(k)) seen.set(k, []); seen.get(k).push(`${r.block}.${r.key}`) }
for (const [code, keys] of seen) md.push(`- **${code} ${statusByCode.get(code)?.nameZh || ''}**（${analysis.unread.ruleValues.find(r => r.code === code)?.chapter || ''}）：${keys.join('、')}`)
md.push('')
md.push('### 复现方式')
md.push('')
md.push('```bash')
md.push('node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/extract-scope.mjs')
md.push('node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/mechanical-screen.mjs')
md.push('node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/triage-unread.mjs')
md.push('node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/lead-analysis.mjs')
md.push('node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/entry-complexity.mjs')
md.push('node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/lead-primitives-analysis.mjs')
md.push('node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/write-primitives-findings.mjs')
md.push('```')
writeFileSync(`${SCAN}/primitives/notes.md`, md.join('\n'))
console.log('wrote findings.json + notes.md')
console.log(JSON.stringify({ unread: triage.length, bySeverity, byTriage, reuse: reuse.length, high: highRows.length, medium: mediumRows.length }, null, 1))
