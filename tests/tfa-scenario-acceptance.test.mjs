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

test('M5 章节全部进入 playable，但通关项与逐条核对保持诚实', () => {
  for (const item of ledger.items) {
    assert.equal(contentRegistry.getScenario(item.id).status, 'playable', item.id)
    const productive = Object.entries(item.checks).filter(([key]) => !['literalCardBehavior', 'browserAcceptance'].includes(key))
    assert.ok(productive.every(([, value]) => value), `${item.id} 仍有未完成的迁移项`)
    // 逐条核对（literalCardBehavior）完成的章节才可标记 verified；浏览器验收已全部通过。
    assert.equal(item.checks.browserAcceptance, true)
    assert.equal(item.status, item.checks.literalCardBehavior ? 'verified' : 'pending')
    assert.equal(item.checks.literalCardBehavior, item.inventory.pendingEncounterCodes.length === 0 && item.gaps.length === 0)
  }
  assert.equal(ledger.status, 'pending')
  assert.equal(ledger.productionGate, 'playable')
})

test('M5 入口开放：战役可启动并出现在大厅列表，账本仍是 earlyAccess', () => {
  assert.equal(campaign.status, 'playable')
  assert.equal(contentRegistry.assertLaunchable('theForgottenAge').id, 'theForgottenAge')
  assert.equal(campaignListForUi(contentRegistry).some(entry => entry.id === 'theForgottenAge'), true)
  // 开放入口不等于宣称规则等价：逐条核对仍未通过。
  assert.equal(ledger.status, 'pending')
})
