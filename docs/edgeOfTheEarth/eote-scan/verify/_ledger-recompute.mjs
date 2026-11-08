// Independent re-computation of the P8 all-card ledger evidence validity.
// Verifier: does NOT import or reuse games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/ledger-*.mjs logic.
// Reads: games/arkhamhorror/audit/eote-all-card-acceptance.json + tests/*.test.mjs
// Writes: games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/_ledger-recompute.json (raw numbers for the report)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'

const MOD = 'G:/boardgame-hall-ai/games/arkhamhorror'
const LEDGER = `${MOD}/audit/eote-all-card-acceptance.json`
const OUT = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/_ledger-recompute.json'
const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'))

const testFiles = readdirSync(`${MOD}/tests`).filter(f => f.endsWith('.test.mjs')).map(f => `tests/${f}`)
const cache = new Map()
const text = f => {
  if (!cache.has(f)) cache.set(f, existsSync(`${MOD}/${f}`) ? readFileSync(`${MOD}/${f}`, 'utf8') : null)
  return cache.get(f)
}
// code token: 5 digits + optional lowercase suffix letter(s); no letter/digit adjacent.
const codeRe = code => new RegExp(`(?<![0-9A-Za-z])${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![0-9A-Za-z])`)
const hasCode = (file, code) => {
  const t = text(file)
  if (t == null) return { exists: false, match: false }
  return { exists: true, match: codeRe(code).test(t) }
}

const rows = []
for (const r of ledger.records) {
  const e = (r.evidence || [])[0] || null
  const kind = e?.kind || 'none'
  const file = e?.file || null
  const title = e?.test || null
  const fileHit = file ? hasCode(file, r.code) : { exists: null, match: false }
  const titleHit = title ? title.includes(r.code) : false
  // The task's stated standard: cited test file contains the card code, OR strong title contains the code.
  const valid = fileHit.match || titleHit
  // Locate the code in ANY test file (to distinguish mis-citation from no evidence at all).
  const otherHits = []
  if (!valid) {
    for (const f of testFiles) {
      if (f === file) continue
      if (hasCode(f, r.code).match) otherHits.push(f)
    }
  }
  rows.push({
    code: r.code, canonicalCode: r.canonicalCode, name: r.name, nameEn: r.nameEn,
    partition: r.partition, type: r.type, status: r.status, reason: r.reason || null,
    entryFile: r.entry?.file || null,
    evidenceKind: kind,
    evidenceFile: file, evidenceChapter: e?.chapter || null, evidenceTitle: title,
    ledgerMatched: e?.ledgerMatched ?? null, titleMatched: e?.titleMatched ?? null,
    citedFileExists: fileHit.exists, codeInCitedFile: fileHit.match,
    strongTitleHasCode: titleHit,
    valid, otherTestFilesWithCode: otherHits,
  })
}

const invalid = rows.filter(r => !r.valid)
const summary = {
  records: rows.length,
  valid: rows.length - invalid.length,
  invalid: invalid.length,
  invalidByPartition: invalid.reduce((m, r) => (m[r.partition] = (m[r.partition] || 0) + 1, m), {}),
  invalidByEvidenceKind: invalid.reduce((m, r) => (m[r.evidenceKind] = (m[r.evidenceKind] || 0) + 1, m), {}),
  invalidByStatus: invalid.reduce((m, r) => (m[r.status] = (m[r.status] || 0) + 1, m), {}),
  invalidByEntryDir: invalid.reduce((m, r) => {
    const key = (r.entryFile || 'none').replace(/^src\/cards\//, '').replace(/\/[^/]+$/, '')
    m[key] = (m[key] || 0) + 1
    return m
  }, {}),
  invalidWithCodeInSomeOtherTestFile: invalid.filter(r => r.otherTestFilesWithCode.length).length,
  invalidWithCodeNowhereInTests: invalid.filter(r => r.otherTestFilesWithCode.length === 0).length,
  evidenceKindTotals: rows.reduce((m, r) => (m[r.evidenceKind] = (m[r.evidenceKind] || 0) + 1, m), {}),
  statusTotals: rows.reduce((m, r) => (m[r.status] = (m[r.status] || 0) + 1, m), {}),
}
const byKind = {}
for (const k of ['strong', 'file', 'scenario-ledger']) {
  const set = rows.filter(r => r.evidenceKind === k)
  byKind[k] = {
    total: set.length,
    valid: set.filter(r => r.valid).length,
    invalid: set.filter(r => !r.valid).length,
  }
}
summary.byEvidenceKind = byKind

const sl = rows.filter(r => r.evidenceKind === 'scenario-ledger')
const slDetail = {
  total: sl.length,
  files: sl.reduce((m, r) => (m[r.evidenceFile] = (m[r.evidenceFile] || 0) + 1, m), {}),
  chapters: sl.reduce((m, r) => (m[r.evidenceChapter] = (m[r.evidenceChapter] || 0) + 1, m), {}),
  codeInCitedHeartFile: sl.filter(r => r.codeInCitedFile).length,
  codeInSomeOtherTest: sl.filter(r => r.otherTestFilesWithCode.length).length,
  codeNowhereInTests: sl.filter(r => r.otherTestFilesWithCode.length === 0 && !r.codeInCitedFile).length,
  expectedChapterFromEntryPath: sl.reduce((m, r) => {
    const p = r.entryFile || ''
    const mm = p.match(/encounter-entries\/edgeOfTheEarth\/([^/]+)\/([^/]+)\/?([^/]*)$/)
    const key = mm ? (mm[1] === '_shared' ? `_shared/${mm[2]}` : mm[1]) : 'unknown'
    m[key] = (m[key] || 0) + 1
    return m
  }, {}),
  codes: sl.map(r => r.code),
}

// Does the cited Heart test mention any of these codes at all?
const heartText = text('tests/eote-scenario-theHeartOfMadnessPart2.test.mjs') || ''
const allCodes = [...new Set(sl.map(r => r.code))]
const heartMentions = allCodes.filter(c => codeRe(c).test(heartText))
summary.scenarioLedgerAllPointToHeart = Object.keys(slDetail.files).length === 1
  && Object.keys(slDetail.files)[0] === 'tests/eote-scenario-theHeartOfMadnessPart2.test.mjs'
summary.heartTestMentionsAnyOf129Codes = heartMentions.length
summary.heartTestLength = heartText.length

const strong = rows.filter(r => r.evidenceKind === 'strong')
const strongInvalid = strong.filter(r => !r.valid)
summary.strongInvalid = strongInvalid.map(r => ({ code: r.code, partition: r.partition, title: r.evidenceTitle, entryFile: r.entryFile }))

// Better standard for strong evidence: the ledger's testRun.passRecords maps the exact
// test title to its file. If that file contains the code, the behavior test exists even
// when the title itself omits the code (e.g. 08011b is covered by 08011a's title test).
const passByTitle = new Map()
for (const p of ledger.testRun?.passRecords || []) {
  if (p && p.test && p.file && !passByTitle.has(p.test)) passByTitle.set(p.test, p)
}
for (const r of rows) {
  if (r.evidenceKind !== 'strong' || !r.evidenceTitle) { r.strongResolvedFile = null; r.codeInResolvedFile = false; continue }
  const p = passByTitle.get(r.evidenceTitle)
  r.strongResolvedFile = p?.file || null
  r.codeInResolvedFile = p?.file ? hasCode(p.file, r.code).match : false
}
const validAfterResolve = r => r.valid || r.codeInResolvedFile
const invalidResolved = rows.filter(r => !validAfterResolve(r))
summary.validAfterStrongFileResolve = rows.length - invalidResolved.length
summary.invalidAfterStrongFileResolve = invalidResolved.length
summary.invalidAfterStrongFileResolveByKind = invalidResolved.reduce((m, r) => (m[r.evidenceKind] = (m[r.evidenceKind] || 0) + 1, m), {})
summary.strongInvalidAfterResolve = rows.filter(r => r.evidenceKind === 'strong' && !validAfterResolve(r)).map(r => r.code)
summary.strongInvalidResolvedExamples = rows.filter(r => r.evidenceKind === 'strong' && !r.valid && r.codeInResolvedFile)
  .map(r => ({ code: r.code, title: r.evidenceTitle, file: r.strongResolvedFile }))


const twoFatalMirage = rows.filter(r => r.evidenceFile === 'tests/eote-scenario-fatalMirage.test.mjs' && !r.valid)
summary.fatalMirageInvalid = twoFatalMirage.map(r => ({
  code: r.code, name: r.name, status: r.status, entryFile: r.entryFile,
  otherTestFilesWithCode: r.otherTestFilesWithCode,
}))

// Variant-side analysis: b-side cards whose title-only evidence points at the a-side test.
const invalidVariants = invalid.filter(r => /[a-z]$/.test(r.code))
const variantStats = invalidVariants.map(r => {
  const stem = r.code.slice(0, -1)
  const aSideCandidates = [stem, `${stem}a`]
  const aSideHits = testFiles.filter(f => aSideCandidates.some(c => hasCode(f, c).match))
  return { code: r.code, aSideCandidates, aSideInTests: aSideHits, evidenceTitle: r.evidenceTitle }
})
summary.invalidVariantCount = invalidVariants.length
summary.invalidVariantA_SideInTests = variantStats.filter(v => v.aSideInTests.length).length
summary.invalidVariants = variantStats

// Per-entry expected scenario test (for scenario-ledger rows only).
const chapterTestOfEntry = entryFile => {
  const p = entryFile || ''
  const mm = p.match(/encounter-entries\/edgeOfTheEarth\/([^/]+)\/([^/]+)\/?([^/]*)$/)
  if (!mm) return null
  if (mm[1] !== '_shared') return `tests/eote-scenario-${mm[1]}.test.mjs`
  const group = mm[2]
  const chapterMap = {
    ice_and_death: 'tests/eote-scenario-iceAndDeathPart1.test.mjs',
    the_heart_of_madness: 'tests/eote-scenario-theHeartOfMadnessPart2.test.mjs',
    left_behind: 'tests/eote-scenario-shared.test.mjs',
    nameless_horrors: 'tests/eote-scenario-shared.test.mjs',
    shoggoths: 'tests/eote-scenario-shared.test.mjs',
    tekelili: 'tests/eote-scenario-shared.test.mjs',
    memorials_of_the_lost: 'tests/eote-scenario-shared.test.mjs',
  }
  return chapterMap[group] || 'tests/eote-scenario-shared.test.mjs'
}
const slExpected = sl.map(r => {
  const expected = chapterTestOfEntry(r.entryFile)
  const expectedHasCode = expected ? hasCode(expected, r.code).match : null
  return { code: r.code, expectedTest: expected, expectedTestHasCode: expectedHasCode, citedHeartHasCode: r.codeInCitedFile }
})
summary.scenarioLedgerExpectedTestHasCode = slExpected.filter(x => x.expectedTestHasCode).length
summary.scenarioLedgerExpectedTestHasNoCode = slExpected.filter(x => x.expectedTestHasCode === false).length
summary.scenarioLedgerExpectedTestUnknown = slExpected.filter(x => x.expectedTestHasCode == null).length
summary.scenarioLedgerExpectedSample = slExpected.slice(0, 12)

// Independent read of audit/eote-scenario-acceptance.json: chapter cardCodes contamination.
let scenarioAcceptance = null
try {
  const S = JSON.parse(readFileSync(`${MOD}/audit/eote-scenario-acceptance.json`, 'utf8'))
  const arrays = (S.chapters || []).map(c => ({ id: c.id, len: (c.cardCodes || []).length, unique: new Set(c.cardCodes || []).size }))
  const identical = arrays.length > 1 && JSON.stringify((S.chapters[0] || {}).cardCodes) === JSON.stringify((S.chapters[arrays.length - 1] || {}).cardCodes)
  scenarioAcceptance = {
    chapters: arrays,
    allChapterCardCodeArraysIdentical: identical,
    unionOfChapterCodes: new Set((S.chapters || []).flatMap(c => c.cardCodes || [])).size,
    evidenceFiles: S.evidence,
  }
} catch (e) { scenarioAcceptance = { error: String(e) } }
summary.scenarioAcceptanceChapterCardCodes = scenarioAcceptance


writeFileSync(OUT, JSON.stringify({
  generatedAt: new Date().toISOString(),
  ledgerPath: 'audit/eote-all-card-acceptance.json',
  method: 'independent: cited test file must contain code as a delimited token; strong evidence title must contain code; also scan all tests/*.test.mjs for the code',
  summary, scenarioLedger: slDetail, invalidRecords: invalid, strongInvalid, rows,
}, null, 1))
console.log(JSON.stringify({ summary, scenarioLedger: { ...slDetail, codes: slDetail.codes.length }, heartMentions }, null, 1))
