import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildScope } from '../tools/scan-tic-scope.mjs'
import { buildScan } from '../tools/scan-tic-mechanisms.mjs'
import { json, readJson, sourceLock, MOD } from '../tools/tic-migration-lib.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { chapters, CYCLE_CODES, CARD_PARTITIONS, CHAOS_BAGS } from '../content/campaigns/theInnsmouthConspiracy/shared.js'
import { manifest } from '../content/campaigns/theInnsmouthConspiracy/manifest.js'
import { catalogChapters } from '../content/campaigns/theInnsmouthConspiracy/chapters.js'
import { createContentRegistry, campaignListForUi } from '../content/registry.js'
import { contentRegistry } from '../content/registered.js'
import { assertCampaignManifest, assertPackManifest } from '../content/schema.js'
import { getAvailability } from '../src/deck/availability.js'

test('P0 来源逐文件锁定，范围与章节身份可复算；关联面不遗漏、不重复分片', () => {
  const scope = buildScope()
  assert.ok(Object.values(scope.gates).every(Boolean), json(scope.gates))
  assert.equal(json(scope), readFileSync(new URL('../audit/tic-scope.json', import.meta.url), 'utf8'))
  const flat = Object.values(CARD_PARTITIONS).flat(); assert.equal(new Set(flat).size, flat.length)
  assert.deepEqual([...flat].sort(), [...CYCLE_CODES]); assert.ok(flat.some(code => /[a-z]$/.test(code)))
  assert.ok(scope.sources.every(lock => lock.sha256.length === 64 && lock.bytes > 0))
  for (const group of scope.reprintGroups) {
    assert.ok(group.codes.includes(group.canonicalCode))
    assert.ok(group.codes.every(code => ALL_CARDS[code]))
    for (const card of scope.cards.filter(card => group.codes.includes(card.code))) assert.equal(card.canonicalCode, group.canonicalCode)
  }
  for (const ch of chapters) {
    assert.ok(ALL_CARDS[ch.code].backText.includes('Hard'))
    assert.ok(scope.chapters.find(entry => entry.id === ch.id).guideSources.length === 2)
  }
  assert.equal(CHAOS_BAGS.easy.includes('bless'), false)
})
test('P0／P6 包边界：调查员与已验收玩家卡开放，战役继续仅收录', () => {
  const packs = ['ticCampaign', 'ticInvestigators', 'ticPlayer'].map(id => contentRegistry.getPack(id))
  for (const pack of packs) {
    assertPackManifest(pack)
    const accepted = pack.id !== 'ticCampaign'
    assert.equal(pack.status, accepted ? 'playable' : 'catalog-only')
    assert.ok(pack.cards.every(card => card.cataloged && card.rulesImplemented === accepted
      && card.deckbuilding === (accepted && !card.dependencyOnly)))
  }
  assertCampaignManifest(manifest)
  const registry = createContentRegistry({ packs: [contentRegistry.getPack('core'), ...packs], campaigns: [manifest], scenarios: catalogChapters })
  assert.throws(() => registry.assertLaunchable(manifest.id)); assert.deepEqual(campaignListForUi(registry), [])
  for (const code of CYCLE_CODES) assert.equal(getAvailability(code).deckbuilding,
    CARD_PARTITIONS.ticPlayer.includes(code) && ALL_CARDS[code].subtype !== 'basicweakness')
  for (const ch of chapters) {
    assert.equal(registry.getScenario(ch.id).referenceCode, ch.code)
    assert.equal(registry.getScenarioData(ch.id).migrationStatus, 'catalog-only')
  }
})
test('P0 原始基线保留提交、旧失败与 replay 指纹；源码或资源改变可检测', () => {
  const baseline = readJson(new URL('../audit/tic-baseline.json', import.meta.url))
  assert.match(baseline.gitHead, /^[0-9a-f]{40}$/)
  const before = sourceLock(baseline.replayFile, MOD)
  assert.equal(before.sha256, baseline.replaySha256)
  assert.ok(baseline.fastFailures.length > 0)
  assert.notEqual(before.sha256, '0'.repeat(64))
})
test('P1 每张卡的正背面需求都有分类，所有新增原语有计划，八章指南逐段盘点', () => {
  const scan = buildScan(); assert.ok(Object.values(scan.gates).every(Boolean), json(scan.gates))
  assert.equal(json(scan), readFileSync(new URL('../audit/tic-mechanism-scan.json', import.meta.url), 'utf8'))
  assert.deepEqual(scan.unclassified, [])
  assert.deepEqual(scan.cards.map(card => card.code), [...CYCLE_CODES])
  for (const guide of scan.guides) {
    assert.ok(guide.sections.some(row => row.specialRule))
    assert.ok(guide.sections.every(row => row.sourceSha256.length === 64 && row.chinese))
  }
  assert.ok(scan.guides.some(guide => guide.sections.some(section => ['missing', 'untranslated'].includes(section.chinese))))
  assert.ok(scan.cards.every(card => card.behaviorStatus === 'pending'), '分类不能冒充卡牌已迁移')
})
