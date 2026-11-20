import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { CARD_ABILITY_CODES } from '../src/cards/card-abilities.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { getAvailability } from '../src/deck/availability.js'
import { manifest, TDC_PLAYER_ACCEPTED_CODES, TDC_PLAYER_BUILDABLE_CODES } from '../content/packs/tdcPlayer/manifest.js'
import { mod, sha, writeOrCheck } from './scan-tdc-scope.mjs'

const read = file => readFileSync(join(mod, file))
const scope = JSON.parse(read('audit/tdc-scope.json'))
const codes = [...scope.partitions.player, ...scope.partitions.basicWeaknesses].sort()
assert.deepEqual(manifest.cards.map(card => card.code).sort(), codes)
const accepted = new Set(TDC_PLAYER_ACCEPTED_CODES)
assert.equal(manifest.status, accepted.size === codes.length ? 'playable' : 'development')
assert.deepEqual(manifest.basicWeaknessCodes.slice().sort(), scope.partitions.basicWeaknesses.filter(code => accepted.has(code)).sort())
const tests = ['player', 'player-guardian', 'player-seeker', 'player-survivor'].map(name => `tests/tdc-${name}.test.mjs`)
const env = { ...process.env }
delete env.NODE_TEST_CONTEXT
const run = spawnSync(process.execPath, ['--test', '--test-reporter=./tools/core-test-reporter.mjs', ...tests], {
  cwd: mod, env, encoding: 'utf8',
})
assert.equal(run.status, 0, run.stderr || run.stdout || String(run.error))
const evidence = new Map()
const results = run.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
for (const row of results) {
  assert.equal(row.type, 'test:pass', row.name)
  assert.ok(!row.skipped && !row.todo, row.name)
  const file = tests.find(file => row.file?.replaceAll('\\', '/').endsWith(file))
  assert.ok(file, row.file)
  for (const code of new Set(row.name.match(/\b11\d{3}[ab]?\b/g) || [])) {
    if (!evidence.has(code)) evidence.set(code, [])
    evidence.get(code).push({ file, name: row.name })
  }
}
const categories = new Map([
  ['11068a', 'identitySource'], ['11068b', 'identitySuccessor'],
  ...scope.partitions.basicWeaknesses.map(code => [code, 'basicWeakness']),
])
const missingEvidence = [...accepted].filter(code => !evidence.has(code))
assert.deepEqual(missingEvidence, [], '已开放卡缺少通过的行为验收')
const rows = codes.map(code => {
  const entry = `src/cards/entries/${code}.js`
  const implemented = existsSync(join(mod, entry))
  const card = ALL_CARDS[code]
  assert.equal(CARD_ABILITY_CODES.has(code), implemented, `卡牌索引缺失或过期 ${code}`)
  const availability = getAvailability(code)
  assert.equal(availability.availability, accepted.has(code) ? 'strict' : 'catalog-only', code)
  assert.equal(availability.deckbuilding, TDC_PLAYER_BUILDABLE_CODES.includes(code), code)
  const behavior = evidence.get(code) || []
  if (accepted.has(code)) assert.ok(implemented && behavior.length, `已开放卡缺少通过的行为验收 ${code}`)
  return {
    code, type: card.type, category: categories.get(code) || 'ordinary',
    ...(card.xp != null ? { level: card.xp } : {}),
    status: accepted.has(code) ? 'verified' : implemented ? 'entry-written' : 'pending',
    ...(implemented ? { entry, sha256: sha(read(entry)) } : {}),
    ...(behavior.length ? { behavior } : {}),
  }
})
const files = rows.filter(row => row.entry).length
const verified = rows.filter(row => row.status === 'verified').length
const browserPath = 'artifacts/migration/tdc/p6/browser.json'
const browserReport = read('../../' + browserPath)
const browserStats = JSON.parse(browserReport).stats
assert.equal(browserStats.expected, 2)
assert.equal(browserStats.unexpected + browserStats.flaky + browserStats.skipped, 0)
const screenshots = [['desktop', 1440, 900], ['mobile', 390, 844]].map(([device, width, height]) => {
  const path = `artifacts/migration/tdc/p6/screenshots/${device}-manual-deck.png`
  const png = read('../../' + path)
  assert.equal(png.subarray(1, 4).toString(), 'PNG')
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [width, height])
  return { device, path, size: [width, height], sha256: sha(png) }
})
const baseline = JSON.parse(read('audit/tdc-baseline.json')).replay
const recovered = baseline.metadataRecovery
assert.equal(sha(read('../../' + baseline.baseline)), baseline.baselineSha256)
assert.equal(sha(read('../../' + recovered.recovered)), recovered.recoveredSha256)
const strictReplayPath = 'artifacts/migration/tdc/reports/p6-replay-final.log'
const strictReplay = read('../../' + strictReplayPath)
const replayReport = strictReplay.toString('utf8')
assert.equal((replayReport.match(/^  ✔ /gm) || []).length, baseline.cases)
assert.match(replayReport, /与基线逐条一致/)
const fastPath = 'artifacts/migration/tdc/reports/p6-fast.log'
const fastReport = read('../../' + fastPath)
const fastCounts = Object.fromEntries([...fastReport.toString('utf8').matchAll(/^ℹ (tests|pass|fail|cancelled|skipped) (\d+)\s*$/gm)]
  .map(([, name, count]) => [name, Number(count)]))
assert.equal(fastCounts.fail, 0)
assert.equal(fastCounts.cancelled, 0)
assert.equal(fastCounts.tests, fastCounts.pass + fastCounts.skipped)
const requestsPath = 'artifacts/migration/tdc/primitive-requests'
const requestsRoot = join(mod, '../..', requestsPath)
const requests = readdirSync(requestsRoot).filter(name => /^(p6-guardian-rogue-|p6-survivor-|p6-main-|seeker-mystic-).+\.json$/.test(name))
  .sort().map(name => {
    const request = JSON.parse(readFileSync(join(requestsRoot, name), 'utf8'))
    const cards = Array.isArray(request.card) ? request.card : String(request.card || '').match(/\b11\d{3}[ab]?\b/g) || []
    const known = cards.filter(code => codes.includes(code))
    assert.ok(known.length, `缺少有效原语申请卡号 ${name}`)
    const status = known.every(code => accepted.has(code)) ? 'verified' : 'pending'
    if (process.argv[2] === '--write' && status !== request.status) {
      writeFileSync(join(requestsRoot, name), JSON.stringify({ ...request, status }, null, 2) + '\n')
    } else assert.equal(request.status, status, name)
    return { path: `${requestsPath}/${name}`, cards: known, status }
  })
writeOrCheck('audit/tdc-player.json', {
  schemaVersion: 2,
  campaignId: scope.campaignId,
  phase: 'P6',
  status: verified === rows.length ? 'verified' : 'verification-in-progress',
  pack: manifest.id,
  scope: 'audit/tdc-scope.json',
  counts: { total: rows.length, entryWritten: files, noEntry: rows.length - files, verified, pendingVerification: rows.length - verified },
  behaviorSpecs: tests.map(file => ({ file, sha256: sha(read(file)) })),
  scenariosPassed: results.length,
  browser: { report: browserPath, sha256: sha(browserReport), cases: browserStats.expected, screenshots },
  replay: { report: strictReplayPath, sha256: sha(strictReplay), cases: baseline.cases,
    baseline: recovered.recovered, baselineSha256: recovered.recoveredSha256 },
  fast: { report: fastPath, sha256: sha(fastReport), ...fastCounts },
  shards: 'artifacts/migration/tdc/p6/shards.json',
  workers: ['guardian_rogue', 'seeker_mystic', 'survivor_multiclass'].map(worker =>
    `artifacts/migration/tdc/p6/workers/${worker}.json`),
  requests,
  cards: rows,
}, process.argv[2])
console.log(`TDC P6 · ${files}/${rows.length} 个条目 · ${verified} 个通过行为验收 · ${results.length} 项测试通过`)
