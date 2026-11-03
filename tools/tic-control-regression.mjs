// Reproduce concurrent worktree failures without activating this migration's catalog/API/trait wiring.
// Copy-only: never resets, checks out or overwrites the user's working tree.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'
import { spawnSync } from 'node:child_process'
import { MOD, RUN, readJson, writeJson, json, sha } from './tic-migration-lib.mjs'
import { evidenceHashes } from './tic-evidence.mjs'
const before = evidenceHashes()
const sourceLog = join(RUN, 'reports', process.argv[2] || 'fast-after.log')
const log = readFileSync(sourceLog, 'utf8')
const initial = new Set(readJson(join(MOD, 'audit/tic-baseline.json')).fastFailures)
const cases = [...log.matchAll(/test at tests[\\/]([^:\r\n]+):\d+:\d+\r?\n✖ (.+?) \([\d.]+ms\)/g)]
  .map(match => ({ file: match[1], title: match[2] })).filter(row => !initial.has(row.title))
const files = [...new Set(cases.map(row => row.file))].sort()
const target = resolve(RUN, 'control/games/arkhamhorror')
if (!target.startsWith(resolve(RUN) + '\\')) throw new Error('Control target escaped the migration workspace')
mkdirSync(target, { recursive: true })
for (const dir of ['src', 'content', 'tests', 'tools', 'audit', 'catalog']) cpSync(join(MOD, dir), join(target, dir), { recursive: true })
cpSync(join(MOD, 'web'), join(target, 'web'), { recursive: true, filter: path => {
  const rel = relative(join(MOD, 'web'), path).replaceAll('\\', '/')
  return !/^(img|audio|fonts)(\/|$)/.test(rel) && (statSync(path).isDirectory() || /\.(js|json)$/.test(path))
} })
cpSync(join(MOD, 'package.json'), join(target, 'package.json'))
const disabled = []
function edit(path, transform) {
  const file = join(target, path), original = readFileSync(file, 'utf8'), next = transform(original)
  if (original === next) throw new Error(`Control isolation failed: ${path}`)
  writeFileSync(file, next); disabled.push({ path, before: sha(original), after: sha(next) })
}
edit('src/engine/engine.js', text => text.replace(/\r?\n    \.\.\.createMechanicsApi\(state, \{[\s\S]*?\r?\n    \}\),/, ''))
edit('content/registered.js', text => text.replace(/import \{ manifest as tic\w+ \} from '\.\/packs\/tic\w+\/manifest\.js'\r?\n/g, '')
  .replace(/,\r?\n    ticCampaignPack, ticInvestigators, ticPlayer/, ''))
edit('web/deck-rules.js', text => text.replace('const errors = validateTraitLimits(codes, cards)', 'const errors = []'))
const result = files.length ? spawnSync(process.execPath, ['--test', ...files.map(file => `tests/${file}`)], {
  cwd: target, encoding: 'utf8', maxBuffer: 30 * 1024 * 1024,
}) : { status: 0, stdout: '', stderr: '' }
const output = (result.stdout || '') + (result.stderr || '')
writeFileSync(join(RUN, 'reports/control.log'), output)
const replayOutput = join(RUN, 'reports/control-replay-hashes.json')
const replay = spawnSync(process.execPath, ['tools/tic-replay-snapshot.mjs', '--output', replayOutput], {
  cwd: target, encoding: 'utf8', maxBuffer: 5 * 1024 * 1024,
})
writeFileSync(join(RUN, 'reports/control-replay.log'), (replay.stdout || '') + (replay.stderr || ''))
const failures = [...new Set([...output.matchAll(/^✖ (.+?) \([\d.]+ms\)/gm)].map(match => match[1]))].sort()
const stable = json(before) === json(evidenceHashes())
const report = { schemaVersion: 1, generatedBy: 'node tools/tic-control-regression.mjs',
  status: stable && replay.status === 0 && (result.status === 0 || (result.status === 1 && failures.length > 0)) ? 'passed' : 'failed',
  purpose: 'Contemporaneous control for failures introduced by concurrent workspace edits; not a replacement for the original baseline.',
  sourceStableDuringRun: stable, isolation: 'TIC API composition, catalog pack registration and trait-limit reader disabled in a copy.',
  snapshot: 'artifacts/migration/tic/control/games/arkhamhorror', disabled, files, exitCode: result.status,
  observedSinceInitialBaseline: cases.map(row => row.title).sort(), failures,
  log: 'artifacts/migration/tic/reports/control.log', logSha256: sha(output), sourceFiles: before }
report.replay = replay.status === 0 ? readJson(replayOutput) : { error: replay.stderr }
writeJson(join(MOD, 'audit/tic-control-regression.json'), report)
console.log(json({ status: report.status, files, reproduced: cases.filter(row => failures.includes(row.title)).map(row => row.title),
  notReproduced: cases.filter(row => !failures.includes(row.title)).map(row => row.title) }))
process.exitCode = report.status === 'passed' ? 0 : 1
