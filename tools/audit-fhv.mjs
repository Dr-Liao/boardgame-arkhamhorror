import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertMigrationConfirmations, KEYWORD_MIGRATION_CHECKS, RULEBOOK_MIGRATION_CHECKS, SCENARIO_MIGRATION_CHECKS,
} from '../content/migration-confirmation.js'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const RUN = join(MOD, '../../artifacts/migration/fhv')
const REPORTS = join(RUN, 'reports')
const SCOPE = 'audit/fhv-scope.json'
const BASELINE = 'audit/fhv-baseline.json'
const MIGRATION = 'audit/fhv-migration.json'
const MECHANISMS = 'audit/fhv-mechanism-scan.json'
const PRIMITIVES = 'audit/fhv-primitive-plan.json'
const FIXTURE = 'tests/fixtures/replay/golden-replays.json'
const REPLAY = join(RUN, 'replay-before.json')
const readText = path => readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
const readJson = path => JSON.parse(readText(path))
const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const json = value => JSON.stringify(value, null, 2) + '\n'
const lines = value => value.split(/\r?\n/).filter(Boolean)

function run(tool, ...args) {
  const result = spawnSync(process.execPath, [`tools/${tool}`, ...args], { cwd: MOD, stdio: 'inherit' })
  if (result.error) throw result.error
  assert.equal(result.status, 0, `${tool} 执行失败`)
}

function regression(path, exitPath) {
  const log = readText(path)
  const totals = Object.fromEntries([...log.matchAll(/^# (tests|pass|fail|cancelled|skipped|todo|duration_ms) ([\d.]+)\r?$/gm)]
    .map(([, key, value]) => [key, Number(value)]))
  assert(Number.isFinite(totals.tests), `回归尚未完成 ${path}`)
  const failures = [...log.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map(([, title]) => title.trim())
  const exitCode = Number(readText(exitPath).trim())
  assert.equal(exitCode, Number(totals.fail + totals.cancelled > 0), `回归退出码不一致 ${path}`)
  return { exitCode, totals, failures }
}

function replaySummary(path) {
  const replay = readJson(path)
  assert(replay.fixtures.length && replay.fixtures.every(fixture => fixture.hashes.length === fixture.log.moves.length + 1))
  return {
    sha256: digest(path),
    rulesVersion: replay.rulesVersion, stateSchemaVersion: replay.schemaVersion, hashVersion: replay.hashVersion,
    games: replay.fixtures.length,
    moves: replay.fixtures.reduce((total, fixture) => total + fixture.log.moves.length, 0),
    fingerprints: replay.fixtures.reduce((total, fixture) => total + fixture.hashes.length, 0),
  }
}

function captureBaseline() {
  const commit = prefix => {
    const head = readText(join(REPORTS, `${prefix}-head.txt`)).trim()
    assert.match(head, /^[0-9a-f]{40}$/)
    return { head, status: lines(readText(join(REPORTS, `${prefix}-status.txt`))) }
  }
  const checkNames = ['cards-check', 'encounter-check', 'entries-check', 'hardcode-check']
  const baseline = {
    schemaVersion: 1,
    campaignId: 'theFeastOfHemlockVale',
    start: { mod: commit('mod'), hall: commit('hall') },
    architecture: readJson(join(REPORTS, 'architecture-before.json')),
    checks: Object.fromEntries(checkNames.map(name => [name, Number(readText(join(REPORTS, `${name}-before.exit`)).trim())])),
    fast: regression(join(REPORTS, 'fast-before.log'), join(REPORTS, 'fast-before.exit')),
    replay: { ...replaySummary(REPLAY), fixture: FIXTURE },
  }
  assert.deepEqual(replaySummary(join(MOD, FIXTURE)), replaySummary(REPLAY), '版本库中的 golden replay 无法复算 P0 基线')
  writeFileSync(join(MOD, BASELINE), json(baseline), { flag: 'wx' })
  writeFileSync(join(RUN, 'fhv-baseline.json'), json(baseline))
  console.log(`fhv baseline: ${BASELINE}`)
}

function checkFast(baseline, phase) {
  assert([undefined, 'p1', 'p2', 'p2-followup'].includes(phase), '用法：node tools/audit-fhv.mjs --check-fast [p1|p2|p2-followup]')
  const stem = phase ? `${phase}-fast` : 'fast-after'
  const after = regression(join(REPORTS, `${stem}.log`), join(REPORTS, `${stem}.exit`))
  const remaining = [...baseline.fast.failures]
  const introduced = after.failures.filter(title => {
    const index = remaining.indexOf(title)
    if (index < 0) return true
    remaining.splice(index, 1)
    return false
  })
  const result = { ...after, newFailures: introduced, clearedBaselineFailures: remaining }
  writeFileSync(join(REPORTS, phase ? `${phase}-fast-compare.json` : 'fast-compare.json'), json(result))
  assert(!introduced.length && after.totals.cancelled <= baseline.fast.totals.cancelled, `新增回归失败：${introduced.join('、')}`)
  console.log(`fhv fast: ${after.totals.pass}/${after.totals.tests}，新增失败 0`)
}

function migrationReport(scope, scan, primitives) {
  const pending = (checks, completed = [], evidence = []) => ({
    status: 'pending', checks: Object.fromEntries(checks.map(key => [key, completed.includes(key)])), evidence,
  })
  return assertMigrationConfirmations({
    schemaVersion: 1,
    campaignId: scope.campaignId,
    status: scope.status,
    playable: false,
    earlyAccess: false,
    evidence: { scope: SCOPE, baseline: BASELINE, mechanisms: MECHANISMS, reports: scope.baseline.reports },
    mechanismScan: { complete: Object.values(scan.gates).every(Boolean), counts: scan.counts },
    ...(primitives ? { primitivePlan: { file: PRIMITIVES, status: primitives.status, pending: primitives.pending.map(row => row.id) } } : {}),
    confirmations: {
      scenarios: { status: 'pending', items: scope.scenarios.map(({ id }) => ({
        id, ...pending(SCENARIO_MIGRATION_CHECKS, ['sourceLocked', 'identityRegistered'], [SCOPE]),
      })) },
      keywords: { status: 'pending', items: ['elusive', 'dayNight', 'codex', 'patrol', 'alert', 'blessCurse']
        .map(id => {
          const mechanic = scan.mechanisms.find(row => row.id === (id === 'codex' ? 'rulebook.codex' : `keyword.${id}`))
          assert(mechanic?.cards.length, `关键词扫描证据缺失 ${id}`)
          return { id, ...pending(KEYWORD_MIGRATION_CHECKS, ['sourceInventoried'], [MECHANISMS]) }
        }) },
      rulebook: pending(RULEBOOK_MIGRATION_CHECKS),
    },
    releaseAcceptance: { status: 'pending', deferred: [] },
  }, scope.scenarios.map(({ id }) => id))
}

const mode = process.argv[2]
assert(['--capture-baseline', '--check-fast', '--write', '--check'].includes(mode),
  '用法：node tools/audit-fhv.mjs --capture-baseline | --check-fast [p1|p2|p2-followup] | --write | --check')
if (mode === '--capture-baseline') {
  captureBaseline()
} else {
  const baseline = readJson(join(MOD, BASELINE))
  if (mode === '--check-fast') {
    checkFast(baseline, process.argv[3])
  } else {
    run('scan-fhv-mechanisms.mjs', '--check')
    const primitives = existsSync(join(MOD, PRIMITIVES)) ? readJson(join(MOD, PRIMITIVES)) : null
    if (primitives) run('plan-fhv-primitives.mjs', '--check')
    const { fixture, ...expectedReplay } = baseline.replay
    const replay = existsSync(REPLAY) ? REPLAY : join(MOD, fixture)
    assert.deepEqual(replaySummary(replay), expectedReplay, 'FHV golden replay 基线文件漂移')
    const report = migrationReport(readJson(join(MOD, SCOPE)), readJson(join(MOD, MECHANISMS)), primitives)
    if (mode === '--write') {
      writeFileSync(join(MOD, MIGRATION), json(report))
    } else {
      assert.equal(json(readJson(join(MOD, MIGRATION))), json(report), 'FHV 迁移审计账本漂移')
      run('replay-fixtures.mjs', '--compare', replay)
    }
    console.log(`fhv audit ${mode}: ${report.status}`)
  }
}
