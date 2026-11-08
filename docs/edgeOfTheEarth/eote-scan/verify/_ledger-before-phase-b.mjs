// 阶段 B 前快照（只读）：记录旧账本的关键统计，供 audit-fix.md 的「重建前后」对照。
// 用法：node docs/edgeOfTheEarth/eote-scan/verify/_ledger-before-phase-b.mjs [--write]
import fs from 'node:fs'

const MOD = 'G:/boardgame-hall-ai/games/arkhamhorror'
const readJson = path => JSON.parse(fs.readFileSync(`${MOD}/${path}`, 'utf8').replace(/^\uFEFF/, ''))
const exists = path => fs.existsSync(`${MOD}/${path}`)

const allCards = readJson('audit/eote-all-card-acceptance.json')
const scenario = readJson('audit/eote-scenario-acceptance.json')
const player = readJson('audit/eote-player-acceptance.json')
const investigators = readJson('audit/eote-investigators.json')
const release = readJson('audit/eote-release-acceptance.json')
const migration = readJson('audit/eote-migration.json')
const compliance = readJson('audit/card-entry-compliance.json')
const nodeAcceptance = exists('audit/eote-node-acceptance.json') ? readJson('audit/eote-node-acceptance.json') : null
const regression = exists('audit/eote-regression.json') ? readJson('audit/eote-regression.json') : null

const scenarioLedgerRecords = allCards.records.filter(record => record.evidence.some(item => item.kind === 'scenario-ledger'))
const chapterPools = scenario.chapters.map(chapter => ({
  id: chapter.id,
  assigned: chapter.cardCodes.length,
  unique: new Set(chapter.cardCodes).size,
  status: chapter.status,
}))

const snapshot = {
  generatedBy: 'docs/edgeOfTheEarth/eote-scan/verify/_ledger-before-phase-b.mjs',
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
    scenarioLedgerEvidenceCount: scenarioLedgerRecords.length,
    scenarioLedgerAttribution: scenarioLedgerRecords.reduce((map, record) => {
      const chapter = record.evidence.find(item => item.kind === 'scenario-ledger')?.chapter
      map[chapter] = (map[chapter] || 0) + 1
      return map
    }, {}),
  },
  scenario: {
    status: scenario.status,
    gates: scenario.gates,
    summary: scenario.summary,
    chapterPools,
    allChapterPoolsIdentical: new Set(scenario.chapters.map(chapter => JSON.stringify([...new Set(chapter.cardCodes)].sort()))).size === 1,
  },
  player: {
    status: player.status,
    gates: player.gates,
    summary: player.summary,
    simplifiedFlags: player.entries.filter(entry => entry.simplified).length,
  },
  investigators: { status: investigators.status, checks: investigators.checks },
  release: { status: release.status, gate: release.gate, equivalence: release.equivalence ?? null },
  migration: {
    status: migration.status,
    gates: migration.gates,
    releaseAcceptanceStatus: migration.releaseAcceptance.status,
    deferred: migration.releaseAcceptance.deferred.length,
    remaining: migration.releaseAcceptance.remaining.length,
    equivalenceCertified: migration.releaseAcceptance.equivalenceCertified ?? null,
  },
  compliance: { counts: compliance.counts, baselineR1: compliance.baseline.directStateWrite.length },
  nodeAcceptance: nodeAcceptance ? { status: nodeAcceptance.status, summary: nodeAcceptance.summary, sourceStableDuringRun: nodeAcceptance.sourceStableDuringRun } : null,
  regression: regression ? { status: regression.status, replayMatches: regression.replay?.matches, fastFailures: regression.fast?.failures?.length ?? null, additions: regression.fast?.additionsSinceInitialBaseline?.length ?? null } : null,
}
if (process.argv.includes('--write')) {
  fs.writeFileSync(new URL('./_ledger-before-phase-b.json', import.meta.url), JSON.stringify(snapshot, null, 1) + '\n')
}
console.log(JSON.stringify(snapshot, null, 1))
