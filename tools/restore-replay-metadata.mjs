import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { replayHashes } from '../src/engine/replay.js'

// Restore the flags stripped by the old fixture compactor only when a trusted
// capture proves the same setup, commands and every historical state hash.
const [archivePath, capturePath, outputPath, mode] = process.argv.slice(2)
assert(archivePath && capturePath && outputPath && (mode == null || mode === '--check'),
  '用法：node tools/restore-replay-metadata.mjs <原始基线> <完整采集> <修复副本> [--check]')
const read = path => JSON.parse(readFileSync(path, 'utf8'))
const archive = read(archivePath)
const capture = read(capturePath)
assert.deepEqual(archive.fixtures.map(row => row.id), capture.fixtures.map(row => row.id))

const legacyMeta = ({ sharedFreeWindowsAtSetup, ...meta }) => meta
const legacyEntry = ({ startingDeckConfirmation, sharedFreeWindows, ...entry }) => entry
let restoredFlags = 0
const fixtures = archive.fixtures.map((row, index) => {
  const trusted = capture.fixtures[index]
  const { meta, moves, ...setup } = row.log
  const { meta: trustedMeta, moves: trustedMoves, ...trustedSetup } = trusted.log
  assert.deepEqual(setup, trustedSetup, `${row.id} 建局参数不一致`)
  assert.deepEqual(legacyMeta(meta), legacyMeta(trustedMeta), `${row.id} 日志版本不一致`)
  assert.deepEqual(moves.map(legacyEntry), trustedMoves.map(legacyEntry), `${row.id} 动作不一致`)
  assert.deepEqual(row.hashes, trusted.hashes, `${row.id} 逐步指纹不一致`)
  assert.deepEqual(row.final, trusted.final, `${row.id} 终态不一致`)
  if (meta.sharedFreeWindowsAtSetup != null) assert.equal(meta.sharedFreeWindowsAtSetup, trustedMeta.sharedFreeWindowsAtSetup)
  const restoredMeta = { ...meta, ...(trustedMeta.sharedFreeWindowsAtSetup === true ? { sharedFreeWindowsAtSetup: true } : {}) }
  restoredFlags += Object.keys(restoredMeta).length - Object.keys(meta).length
  const restoredMoves = moves.map((entry, step) => {
    const recovered = { ...entry }
    for (const flag of ['startingDeckConfirmation', 'sharedFreeWindows']) {
      if (Object.hasOwn(entry, flag)) assert.equal(entry[flag], trustedMoves[step][flag])
      else if (trustedMoves[step][flag] === true) {
        recovered[flag] = true
        restoredFlags++
      }
    }
    return recovered
  })
  const log = { ...row.log, meta: restoredMeta, moves: restoredMoves }
  assert.deepEqual(replayHashes(log), row.hashes, `${row.id} 恢复后的严格回放不一致`)
  return { ...row, log }
})
const output = { ...archive, fixtures }
if (mode === '--check') assert.deepEqual(read(outputPath), output)
else writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n', { flag: 'wx' })
console.log(`replay metadata ${mode || '--write'}: ${fixtures.length} 局，恢复 ${restoredFlags} 个标记，逐步指纹一致`)
