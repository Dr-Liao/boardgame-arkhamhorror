import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { artifactRoot, modRoot, sha256 } from './tdc-p8-evidence.mjs'

const fullOnly = process.argv[2] === '--full-only'
const baselineFile = (fullOnly ? null : process.argv[2]) || join(artifactRoot, 'full-before.log')
const baseline = readFileSync(baselineFile)
const reportFile = join(modRoot, 'audit/tdc-p8-regression.json')
const recovered = '../../artifacts/migration/tdc/replay-before-recovered.json'
const checks = {
  playerIndex: ['tools/build-card-index.mjs', '--check'],
  encounterIndex: ['tools/build-encounter-index.mjs', '--check'],
  compliance: ['tools/audit-card-entry-compliance.mjs', '--check'],
  story: ['tools/import-tdc-story.mjs', '--check'],
  guides: ['tools/build-tdc-guides.mjs', '--check'],
  guideCoverage: ['tools/import-scenario-guides.mjs', '--check'],
  presentation: ['tools/build-presentation.mjs', '--check'],
  docs: ['tools/check-doc-links.mjs'],
  replay: ['tools/replay-fixtures.mjs', '--compare', recovered],
  campaign: ['--test', 'tests/tdc-p8-campaign.test.mjs'],
  full: ['tools/run-tests.mjs', 'all', '--test-concurrency=12'],
}

function parseFull(raw) {
  const output = raw.toString('utf8')
  const counts = Object.fromEntries([...output.matchAll(/^ℹ (tests|pass|fail|cancelled|skipped) (\d+)\r?$/gm)]
    .map(([, key, count]) => [key, Number(count)]))
  assert.ok(counts.tests > 0, '全量测试缺少最终汇总')
  const failures = [...output.matchAll(/^✖ (.+) \([\d.]+ms\)\r?$/gm)].map(([, title]) => title)
  return { ...counts, failures: [...new Set(failures)].sort() }
}

async function run(id, args) {
  const file = join(artifactRoot, `regression-${id}.log`)
  const fd = openSync(file, 'w')
  let exitCode
  try {
    exitCode = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, args, { cwd: modRoot, stdio: ['ignore', fd, fd], windowsHide: true })
      child.once('error', reject)
      child.once('exit', code => resolve(code ?? 1))
    })
  } finally {
    closeSync(fd)
  }
  const raw = readFileSync(file)
  console.log(`[TDC P8] ${id} → ${exitCode}`)
  return { command: ['node', ...args].join(' '), exitCode, sha256: sha256(raw),
    report: `artifacts/migration/tdc/p8/regression-${id}.log`, ...(id === 'full' ? { counts: parseFull(raw) } : {}) }
}

mkdirSync(artifactRoot, { recursive: true })
writeFileSync(join(artifactRoot, 'full-before.log'), baseline)
const before = parseFull(baseline)
const previous = fullOnly ? JSON.parse(readFileSync(reportFile, 'utf8')) : null
const results = previous?.results ?? {}
if (previous) {
  assert.equal(previous.before.sha256, sha256(baseline), '全量对照基线已变更')
  for (const id of Object.keys(checks).filter(id => id !== 'full')) {
    assert.equal(results[id]?.exitCode, 0, `${id} 须先通过专项检查`)
    assert.equal(sha256(readFileSync(join(artifactRoot, `regression-${id}.log`))), results[id].sha256)
  }
}
for (const [id, args] of Object.entries(checks)) {
  if (!fullOnly || id === 'full') results[id] = await run(id, args)
}
const remainingFailures = results.full.counts.failures
const newFailures = remainingFailures.filter(title => !before.failures.includes(title))
const passed = Object.entries(results).every(([id, { exitCode }]) => id === 'full' || exitCode === 0)
  && results.full.counts.cancelled === 0 && newFailures.length === 0
  && (results.full.exitCode === 0 || (results.full.counts.fail > 0 && remainingFailures.length > 0))
writeFileSync(reportFile, JSON.stringify({ schemaVersion: 1,
  status: passed ? 'passed' : 'failed', before: { ...before, sha256: sha256(baseline), report: 'artifacts/migration/tdc/p8/full-before.log' },
  results, newFailures, remainingFailures }, null, 2) + '\n')
if (!passed) process.exitCode = 1
