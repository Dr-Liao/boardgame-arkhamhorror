import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chapters } from '../content/campaigns/thePathToCarcosa/shared.js'
import { manifest as campaign } from '../content/campaigns/thePathToCarcosa/manifest.js'

const ledger = JSON.parse(readFileSync(new URL('../audit/carcosa-scenario-acceptance.json', import.meta.url)))

test('M3 ledger inventories every original Carcosa chapter independently', () => {
  assert.equal(ledger.milestone, 'M3')
  assert.equal(ledger.generatedFrom, 'original-campaign-only')
  assert.deepEqual(ledger.items.map(item => item.id), chapters.map(chapter => chapter.id))
  for (const item of ledger.items) {
    assert.equal(item.status, 'verified')
    assert.ok(item.inventory.locations > 0)
    assert.ok(item.inventory.acts > 0)
    assert.ok(item.inventory.agendas > 0)
    assert.ok(item.inventory.encounterCards > 0)
    assert.ok(item.inventory.resolutions.length > 0)
    assert.deepEqual(Object.keys(item.fileHashes), ['definition.js', 'layout.js', 'behavior.js', 'index.js'])
    assert.ok(Object.values(item.fileHashes).every(value => /^[a-f0-9]{64}$/.test(value)))
    assert.equal(item.checks.browserAcceptance, false)
    assert.ok(Object.entries(item.checks).filter(([key]) => key !== 'browserAcceptance')
      .every(([, value]) => value))
  }
})

test('M4 opens the production campaign while M5 browser acceptance remains pending', () => {
  assert.equal(ledger.status, 'verified')
  assert.equal(ledger.productionGate, 'playable')
  assert.equal(campaign.status, 'playable')
})
