import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { MOD, RUN, readJson, writeJson, sha, json } from './tic-migration-lib.mjs'
import { evidenceHashes, currentEvidence } from './tic-evidence.mjs'
const mode = process.argv[2]
function run(args, logName) {
  const result = spawnSync(process.execPath, args, { cwd: MOD, encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 })
  const output = (result.stdout || '') + (result.stderr || '')
  const log = join(RUN, `reports/${logName}.log`)
  mkdirSync(join(RUN, 'reports'), { recursive: true }); writeFileSync(log, output)
  return { command: 'node ' + args.join(' '), exitCode: result.status, log: `artifacts/migration/tic/reports/${logName}.log`, logSha256: sha(output), output }
}
export const failureTitles = output => [...new Set([...output.matchAll(/^✖ (.+?) \([\d.]+ms\)/gm)].map(match => match[1]))].sort()
const sourceFiles = evidenceHashes()
if (mode === '--node') {
  const result = run(['--test', 'tests/tic-migration.test.mjs', 'tests/tic-primitives.test.mjs', 'tests/tic-rules.test.mjs', 'tests/tic-interactions.test.mjs', 'tests/tic-investigators.test.mjs',
    'tests/tic-player-primitives.test.mjs', 'tests/tic-player-guardian-seeker.test.mjs', 'tests/tic-player-rogue-mystic.test.mjs', 'tests/tic-player-survivor-neutral.test.mjs'], 'node-acceptance')
  const stable = json(sourceFiles) === json(evidenceHashes())
  const { output, ...evidence } = result
  const report = { schemaVersion: 1, generatedBy: 'node tools/verify-tic.mjs --node',
    status: result.exitCode === 0 && stable ? 'passed' : 'failed', sourceStableDuringRun: stable,
    ...evidence, summary: Object.fromEntries([...output.matchAll(/ℹ (tests|pass|fail|skipped) (\d+)/g)].map(m => [m[1], Number(m[2])])),
    testTitles: [...output.matchAll(/^✔ (.+?) \([\d.]+ms\)/gm)].map(match => match[1]), sourceFiles }
  writeJson(join(MOD, 'audit/tic-node-acceptance.json'), report)
  console.log(json({ status: report.status, summary: report.summary, sourceStableDuringRun: stable }))
  process.exitCode = report.status === 'passed' ? 0 : 1
} else if (mode === '--p5-replay' || mode === '--p6-replay') {
  const stage = mode === '--p6-replay' ? 'p6' : 'p5'
  const replay = run(['tools/replay-fixtures.mjs', '--compare', `tests/fixtures/replay/tic-${stage}-baseline.json`], `${stage}-replay-final`)
  const stable = json(sourceFiles) === json(evidenceHashes())
  const { output, ...evidence } = replay
  const report = { schemaVersion: 1, generatedBy: `node tools/verify-tic.mjs --${stage}-replay`,
    status: replay.exitCode === 0 && stable ? 'passed' : 'failed', sourceStableDuringRun: stable, replay: evidence, sourceFiles }
  writeJson(join(MOD, stage === 'p6' ? 'audit/tic-player-replay.json' : 'audit/tic-investigator-replay.json'), report)
  console.log(json({ status: report.status, replayExitCode: replay.exitCode, sourceStableDuringRun: stable }))
  process.exitCode = report.status === 'passed' ? 0 : 1
} else if (mode === '--p4-regression') {
  const fast = run(['tools/run-tests.mjs', 'fast', '--test-concurrency=6'], 'p4-fast-final')
  const replay = run(['tools/replay-fixtures.mjs', '--compare', 'tests/fixtures/replay/tic-p4-baseline.json'], 'p4-replay-final')
  const stable = json(sourceFiles) === json(evidenceHashes())
  const summarize = ({ output, ...result }) => result
  const report = { schemaVersion: 1, generatedBy: 'node tools/verify-tic.mjs --p4-regression',
    status: fast.exitCode === 0 && replay.exitCode === 0 && stable ? 'passed' : 'failed', sourceStableDuringRun: stable,
    fast: { ...summarize(fast), failures: failureTitles(fast.output) }, replay: summarize(replay), sourceFiles }
  writeJson(join(MOD, 'audit/tic-interaction-regression.json'), report)
  console.log(json({ status: report.status, fastExitCode: fast.exitCode, replayExitCode: replay.exitCode, sourceStableDuringRun: stable }))
  process.exitCode = report.status === 'passed' ? 0 : 1
} else if (mode === '--regression') {
  const fast = run(['tools/run-tests.mjs', 'fast'], 'fast-final')
  const replay = run(['tools/replay-fixtures.mjs', '--compare', 'tests/fixtures/replay/tic-baseline.json'], 'replay-final')
  const replayOutput = join(RUN, 'reports/current-replay-hashes.json')
  const replaySnapshot = run(['tools/tic-replay-snapshot.mjs', '--output', replayOutput], 'replay-snapshot')
  const baseline = readJson(join(MOD, 'audit/tic-baseline.json'))
  const failures = failureTitles(fast.output)
  const additions = failures.filter(title => !baseline.fastFailures.includes(title))
  const control = currentEvidence('control-regression')
  const replayData = replaySnapshot.exitCode === 0 ? readJson(replayOutput) : null
  const controlReplayMatch = !!replayData && !!control?.replay?.fixtures
    && json(replayData.fixtures.map(({ id, hashes }) => ({ id, hashes }))) === json(control.replay.fixtures.map(({ id, hashes }) => ({ id, hashes })))
  const introduced = additions.filter(title => !control?.failures.includes(title))
  const stable = json(sourceFiles) === json(evidenceHashes())
  const summarize = ({ output, ...result }) => result
  const report = { schemaVersion: 1, generatedBy: 'node tools/verify-tic.mjs --regression',
    status: stable && !introduced.length && (replay.exitCode === 0 || controlReplayMatch) ? 'passed' : 'failed', sourceStableDuringRun: stable,
    fast: { ...summarize(fast), failures, additionsSinceInitialBaseline: additions, introduced, controlEvidence: control ? 'audit/tic-control-regression.json' : null },
    replay: { ...summarize(replay), matchesOriginalBaseline: replay.exitCode === 0,
      matchesContemporaneousControl: controlReplayMatch,
      baselineDrift: replayData?.fixtures.filter(fixture => !fixture.matchesOriginalBaseline).map(fixture => fixture.id) || [],
      evidence: 'artifacts/migration/tic/reports/current-replay-hashes.json' }, sourceFiles }
  writeJson(join(MOD, 'audit/tic-regression.json'), report)
  console.log(json({ status: report.status, failures: failures.length, additions, introduced, replay: report.replay, sourceStableDuringRun: stable }))
  process.exitCode = report.status === 'passed' ? 0 : 1
} else throw new Error('用法：node tools/verify-tic.mjs --node | --regression | --p4-regression | --p5-replay | --p6-replay')
