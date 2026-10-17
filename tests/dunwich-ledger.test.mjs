import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import {
  DUNWICH_ACCEPTANCE_PROFILE,
  DUNWICH_ACCEPTANCE_SHA256,
  dunwichCardVerified,
} from '../src/cards/dunwich-acceptance.js'

const packs = new Set(['dwl', 'tmm', 'tece', 'bota', 'uau', 'wda', 'litas'])

test('敦威治验收账本严格对应周期333个卡号、行为证据与目录状态', () => {
  const url = new URL('../audit/dunwich-acceptance.json', import.meta.url)
  const bytes = fs.readFileSync(url)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), DUNWICH_ACCEPTANCE_SHA256)
  const ledger = JSON.parse(bytes)
  const expected = Object.values(ALL_CARDS)
    .filter(card => packs.has(card.pack))
    .map(card => card.code)
    .sort()
  assert.equal(expected.length, 333)
  assert.deepEqual(ledger.entries.map(entry => entry.code).sort(), expected)
  assert.deepEqual(ledger.summary, {
    total: 333,
    verified: 333,
    unverified: 0,
    unimplemented: 0,
    testsPassed: 333,
  })
  for (const entry of ledger.entries) {
    assert.ok(entry.evidence.length, `${entry.code} has no evidence`)
    assert.ok(entry.evidence.every(item => item.test.startsWith(`Dunwich ${entry.code} `)))
    assert.ok(dunwichCardVerified(entry.code))
    assert.equal(ALL_CARDS[entry.code].effectStatus, 'verified')
    assert.equal(ALL_CARDS[entry.code].acceptanceProfile, DUNWICH_ACCEPTANCE_PROFILE.id)
  }
  for (const file of ledger.testFiles) {
    const evidence = fs.readFileSync(new URL(`../../../${file.file}`, import.meta.url))
    assert.equal(createHash('sha256').update(evidence).digest('hex'), file.sha256, `Stale evidence: ${file.file}`)
  }
  assert.ok(!dunwichCardVerified('01001'))
  assert.ok(!dunwichCardVerified('03001'))
})
