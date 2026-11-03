import { join } from 'node:path'
import { replayHashes } from '../src/engine/replay.js'
import { MOD, readJson, writeJson } from './tic-migration-lib.mjs'
const index = process.argv.indexOf('--output')
if (index < 0 || !process.argv[index + 1]) throw new Error('需要 --output <文件>')
const baseline = readJson(join(MOD, 'tests/fixtures/replay/tic-baseline.json'))
const fixtures = baseline.fixtures.map(fixture => {
  const hashes = replayHashes(fixture.log)
  return { id: fixture.id, hashes, matchesOriginalBaseline: JSON.stringify(hashes) === JSON.stringify(fixture.hashes) }
})
writeJson(process.argv[index + 1], { schemaVersion: 1, fixtures })
console.log(`采集 ${fixtures.length} 局的逐步指纹；原始基线未改写。`)
