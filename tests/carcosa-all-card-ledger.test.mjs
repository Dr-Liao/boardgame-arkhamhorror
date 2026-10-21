import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { manifest as campaignPack } from '../content/packs/carcosaCampaign/manifest.js'
import {
  CARCOSA_ALL_CARD_ACCEPTANCE_SHA256,
  CARCOSA_CAMPAIGN_ACCEPTANCE_PROFILE,
  carcosaCampaignCardPending,
  carcosaCampaignCardVerified,
} from '../src/cards/carcosa-campaign-acceptance.js'

const packs = new Set(['ptc', 'eotp', 'tuo', 'apot', 'tpm', 'bsr', 'dca'])

test('C4 全卡账本逐条驱动383条03循环记录的“已验收”标记', () => {
  const url = new URL('../audit/carcosa-all-card-acceptance.json', import.meta.url)
  const bytes = fs.readFileSync(url)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), CARCOSA_ALL_CARD_ACCEPTANCE_SHA256)
  const ledger = JSON.parse(bytes)
  const expected = Object.values(ALL_CARDS)
    .filter(card => packs.has(card.pack))
    .map(card => card.code)
    .sort()
  assert.equal(expected.length, 383)
  assert.deepEqual(ledger.entries.map(entry => entry.code).sort(), expected)
  assert.deepEqual(ledger.summary, {
    total: 383,
    verified: 383,
    pending: 0,
    investigator: 20,
    player: 95,
    campaign: 268,
    testsPassed: 421,
  })

  for (const entry of ledger.entries) {
    const card = ALL_CARDS[entry.code]
    assert.ok(entry.evidence.length, `${entry.code} 缺少验收证据`)
    if (entry.status === 'verified') {
      assert.equal(card.effectStatus, 'verified', `${entry.code} 未显示已验收`)
      assert.ok(card.acceptanceProfile)
    } else {
      assert.equal(entry.status, 'pending')
      assert.notEqual(card.effectStatus, 'verified', `${entry.code} 被错误标记为已验收`)
      assert.equal(card.acceptanceProfile, undefined)
    }
    if (entry.partition === 'campaign') {
      assert.equal(carcosaCampaignCardVerified(entry.code), entry.status === 'verified')
      assert.equal(carcosaCampaignCardPending(entry.code), entry.status === 'pending')
      if (entry.status === 'verified') {
        assert.equal(card.acceptanceProfile, CARCOSA_CAMPAIGN_ACCEPTANCE_PROFILE.id)
      }
    }
  }
})

test('C4 战役包逐卡规则状态来自验收账本并已开放', () => {
  assert.equal(campaignPack.status, 'playable')
  assert.equal(campaignPack.cards.length, 215)
  for (const card of campaignPack.cards) {
    assert.equal(card.rulesImplemented, carcosaCampaignCardVerified(card.code), card.code)
    assert.equal(ALL_CARDS[card.code].availability, 'catalog-only')
  }
  assert.equal(campaignPack.cards.filter(card => card.rulesImplemented).length, 215)
})

test('C4 账本锁定生成时实际执行的验收文件', () => {
  const ledger = JSON.parse(fs.readFileSync(
    new URL('../audit/carcosa-all-card-acceptance.json', import.meta.url)))
  for (const file of ledger.testFiles) {
    const evidence = fs.readFileSync(new URL(`../../../${file.file}`, import.meta.url))
    assert.equal(createHash('sha256').update(evidence).digest('hex'), file.sha256,
      `验收证据已漂移：${file.file}`)
  }
})
