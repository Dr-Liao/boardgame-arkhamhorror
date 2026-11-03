import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { chapters } from '../content/campaigns/theForgottenAge/shared.js'
import { manifest as campaign } from '../content/campaigns/theForgottenAge/manifest.js'
import { contentRegistry } from '../content/registered.js'
import { campaignListForUi } from '../content/registry.js'

const ledger = JSON.parse(readFileSync(new URL('../audit/tfa-scenario-acceptance.json', import.meta.url)))

test('M3 账本按章登记失落的时代十个剧本，并附文件哈希与检测项', () => {
  assert.equal(ledger.milestone, 'M3')
  assert.equal(ledger.generatedFrom, 'original-campaign-only')
  assert.deepEqual(ledger.items.map(item => item.id), chapters.map(chapter => chapter.id))
  for (const item of ledger.items) {
    assert.ok(item.inventory.locations > 0, item.id)
    assert.ok(item.inventory.acts > 0, item.id)
    assert.ok(item.inventory.agendas > 0, item.id)
    assert.ok(item.inventory.encounterCards > 0, item.id)
    assert.ok(item.inventory.resolutions.length > 0, item.id)
    assert.deepEqual(Object.keys(item.fileHashes), ['definition.js', 'layout.js', 'behavior.js', 'index.js'])
    assert.ok(Object.values(item.fileHashes).every(value => /^[a-f0-9]{64}$/.test(value)))
    assert.equal(item.checks.browserAcceptance, true)
    assert.ok(Array.isArray(item.gaps))
    assert.ok(existsSync(new URL(`../${item.testFile}`, import.meta.url)), item.testFile)
  }
})

test('M5 十章通关项与逐条核对全部通过', () => {
  for (const item of ledger.items) {
    assert.equal(contentRegistry.getScenario(item.id).status, 'playable', item.id)
    assert.ok(Object.values(item.checks).every(Boolean), `${item.id} 仍有未完成的迁移项`)
    assert.equal(item.checks.browserAcceptance, true)
    assert.equal(item.status, 'verified')
    assert.equal(item.checks.literalCardBehavior, item.inventory.pendingEncounterCodes.length === 0 && item.gaps.length === 0)
  }
  assert.equal(ledger.status, 'verified')
  assert.equal(ledger.productionGate, 'playable')
})

test('M5 入口开放：战役可启动且不显示提前体验', () => {
  assert.equal(campaign.status, 'playable')
  assert.equal(contentRegistry.assertLaunchable('theForgottenAge').id, 'theForgottenAge')
  const entry = campaignListForUi(contentRegistry).find(item => item.id === 'theForgottenAge')
  assert.ok(entry)
  assert.equal(entry.earlyAccess, false)
  assert.equal(campaignListForUi(contentRegistry).find(item => item.id === 'theCircleUndone')?.earlyAccess, false)
  for (const id of ['theDreamEaters']) {
    assert.equal(campaignListForUi(contentRegistry).find(item => item.id === id)?.earlyAccess, false, id)
  }
  assert.equal(ledger.status, 'verified')
})
