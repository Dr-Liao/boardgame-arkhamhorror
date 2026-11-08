// 阶段 B 后快照（只读）：记录重建后的账本统计 + 逐条证据可追溯性复核（独立于生成器实现）。
// 用法：node docs/edgeOfTheEarth/eote-scan/verify/_ledger-after-phase-b.mjs [--write]
import fs from 'node:fs'

const MOD = 'G:/boardgame-hall-ai/games/arkhamhorror'
const readJson = path => JSON.parse(fs.readFileSync(`${MOD}/${path}`, 'utf8').replace(/^\uFEFF/, ''))
const exists = path => fs.existsSync(`${MOD}/${path}`)
const textCache = new Map()
const fileText = path => {
  if (!textCache.has(path)) textCache.set(path, exists(path) ? fs.readFileSync(`${MOD}/${path}`, 'utf8') : null)
  return textCache.get(path)
}
// 与生成器同口径：5 位卡号可选 a-z 面后缀，两侧不得紧邻字母数字。
const tokenPattern = code => {
  const escaped = String(code).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const face = /^(\d{5})[a-z]$/.exec(String(code))
  const body = face ? `${face[1]}[a-z]?` : escaped
  return new RegExp(`(?:^|[^A-Za-z0-9])${body}(?:$|[^A-Za-z0-9])`)
}
const containsToken = (text, code) => text != null && tokenPattern(code).test(String(text))

const allCards = readJson('audit/eote-all-card-acceptance.json')
const scenario = readJson('audit/eote-scenario-acceptance.json')
const player = readJson('audit/eote-player-acceptance.json')
const investigators = readJson('audit/eote-investigators.json')
const release = readJson('audit/eote-release-acceptance.json')
const migration = readJson('audit/eote-migration.json')
const compliance = readJson('audit/card-entry-compliance.json')
const nodeAcceptance = readJson('audit/eote-node-acceptance.json')
const regression = readJson('audit/eote-regression.json')
const scope = readJson('audit/eote-scope.json')

const passTitles = new Set(allCards.testRun.passRecords.map(record => record.test))
const evidenceKindCounts = {}
const traceability = { evidenceItems: 0, invalid: [], byKind: {} }
const scenarioLedgerEvidence = []
for (const record of allCards.records) {
  const tokens = [record.code, record.canonicalCode].filter(Boolean)
  for (const item of record.evidence) {
    evidenceKindCounts[item.kind] = (evidenceKindCounts[item.kind] || 0) + 1
    traceability.evidenceItems += 1
    const kindStat = traceability.byKind[item.kind] || (traceability.byKind[item.kind] = { total: 0, valid: 0 })
    kindStat.total += 1
    let valid = false
    let reason = ''
    if (item.kind === 'strong' || item.kind === 'player-ledger') {
      valid = passTitles.has(item.test)
        && (tokens.some(token => containsToken(item.test, token)))
      reason = valid ? '' : '标题不在本次实跑 passRecords 或标题不含卡号 token'
    } else {
      valid = Boolean(item.file) && tokens.some(token => containsToken(fileText(item.file), token))
      reason = valid ? '' : `引用文件 ${item.file} 不存在或不含卡号 token`
    }
    if (valid) kindStat.valid += 1
    else traceability.invalid.push({ code: record.code, kind: item.kind, file: item.file ?? null, test: item.test ?? null, reason })
    if (item.kind === 'scenario-ledger') scenarioLedgerEvidence.push({ code: record.code, chapter: item.chapter, file: item.file })
  }
}
const scenarioLedgerAttribution = scenarioLedgerEvidence.reduce((map, item) => {
  map[item.chapter] = (map[item.chapter] || 0) + 1
  return map
}, {})

const snapshot = {
  generatedBy: 'docs/edgeOfTheEarth/eote-scan/verify/_ledger-after-phase-b.mjs',
  scope: { status: scope.status, gates: scope.gates, records: scope.counts?.records },
  allCards: {
    status: allCards.status,
    summary: {
      total: allCards.summary.total,
      verified: allCards.summary.verified,
      simplified: allCards.summary.simplified,
      noBehavior: allCards.summary['no-behavior'],
      missing: allCards.summary.missing,
      blocked: allCards.summary.blocked,
      gateComplete: allCards.summary.gateComplete,
    },
    gates: allCards.gates,
    evidence: allCards.summary.evidence,
    evidenceKindCounts,
    scenarioLedgerEvidenceCount: scenarioLedgerEvidence.length,
    scenarioLedgerAttribution,
    traceability,
    recordsWithEvidence: allCards.records.filter(record => record.evidence.length > 0).length,
    recordsWithoutEvidence: allCards.records.filter(record => record.status !== 'no-behavior' && record.evidence.length === 0).length,
  },
  scenario: {
    status: scenario.status,
    gates: scenario.gates,
    summary: scenario.summary,
    chapterPools: scenario.chapters.map(chapter => ({
      id: chapter.id,
      assigned: chapter.cardCodes.length,
      unique: new Set(chapter.cardCodes).size,
      status: chapter.status,
    })),
    allChapterPoolsIdentical: new Set(scenario.chapters.map(chapter => JSON.stringify([...new Set(chapter.cardCodes)].sort()))).size === 1,
  },
  player: {
    status: player.status,
    gates: player.gates,
    summary: player.summary,
    simplifiedEntries: player.entries.filter(entry => entry.simplified).length,
    simplificationsWithDisclosure: player.entries.filter(entry => entry.simplification?.disclosures?.length).length,
  },
  investigators: { status: investigators.status, checks: investigators.checks },
  release: {
    status: release.status, gate: release.gate, missing: release.missing,
    equivalence: release.equivalence ? { certified: release.equivalence.certified, allCards: release.equivalence.allCards } : null,
  },
  migration: {
    status: migration.status,
    gates: migration.gates,
    releaseAcceptanceStatus: migration.releaseAcceptance.status,
    equivalenceCertified: migration.releaseAcceptance.equivalenceCertified,
    deferred: migration.releaseAcceptance.deferred.length,
    newP7RequestIds: migration.releaseAcceptance.deferred
      .map(entry => entry.id)
      .filter(id => /primitiveRequest:p7-(08544|08546|08560|08587|08673|08679|08681|08682)$/.test(id)),
    remaining: migration.releaseAcceptance.remaining.map(entry => entry.id),
    requests: migration.primitives?.requests ?? null,
  },
  compliance: { counts: compliance.counts, baselineR1: compliance.baseline.directStateWrite.length },
  nodeAcceptance: { status: nodeAcceptance.status, summary: nodeAcceptance.summary, sourceStableDuringRun: nodeAcceptance.sourceStableDuringRun },
  regression: {
    status: regression.status, replayMatches: regression.replay?.matches,
    fastSummary: regression.fast?.summary,
    fastFailures: regression.fast?.failures,
    additions: regression.fast?.additionsSinceInitialBaseline,
  },
}
if (process.argv.includes('--write')) {
  fs.writeFileSync(new URL('./_ledger-after-phase-b.json', import.meta.url), JSON.stringify(snapshot, null, 1) + '\n')
}
console.log(JSON.stringify(snapshot, null, 1))
