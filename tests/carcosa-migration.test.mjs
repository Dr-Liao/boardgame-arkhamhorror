import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { contentRegistry } from '../content/registered.js'
import { campaignListForUi } from '../content/registry.js'
import { assertMigrationConfirmations } from '../content/migration-confirmation.js'
import { manifest } from '../content/campaigns/thePathToCarcosa/manifest.js'
import { CHAOS_BAGS, chapters, recordTypes } from '../content/campaigns/thePathToCarcosa/shared.js'
import { manifest as campaignPack } from '../content/packs/carcosaCampaign/manifest.js'
import { manifest as investigatorPack } from '../content/packs/carcosaInvestigators/manifest.js'
import { manifest as playerPack } from '../content/packs/carcosaPlayer/manifest.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { getAvailability } from '../src/deck/availability.js'
import { imageDescriptor } from '../presentation/images.js'

test('C4 exposes all eight verified Carcosa chapters as a launchable campaign', async () => {
  assert.deepEqual(contentRegistry.listScenarios(manifest.id).map(scenario => scenario.id),
    chapters.map(chapter => chapter.id))
  assert.equal(contentRegistry.getCampaign(manifest.id).status, 'playable')
  assert.doesNotThrow(() => contentRegistry.assertLaunchable(manifest.id))
  assert.equal(campaignListForUi(contentRegistry).some(campaign => campaign.id === manifest.id), true)
  for (const chapter of chapters) {
    const registered = contentRegistry.getScenario(chapter.id)
    assert.equal(registered.catalogReferenceOnly, undefined)
    assert.equal(registered.status, 'verified')
    assert.ok(registered.locations.length > 0)
    assert.ok(registered.acts.length > 0)
    assert.ok(registered.agendas.length > 0)
    assert.ok(registered.zones.encounterDeck.length > 0)
    const module = await import(`../content/campaigns/thePathToCarcosa/scenarios/${chapter.id}/index.js`)
    assert.equal(module.manifest.id, chapter.id)
    assert.equal(module.scenario.originalCode, chapter.code)
    assert.equal(module.behavior.id, chapter.id)
  }
})

test('C2 partitions every 03-cycle card exactly once and opens verified investigator and player boundaries', () => {
  const cycleCodes = Object.keys(ALL_CARDS).filter(code => /^03\d{3}$/.test(code)).sort()
  const packs = [campaignPack, investigatorPack, playerPack]
  const packedCodes = packs.flatMap(pack => pack.cards.map(card => card.code))
  assert.equal(cycleCodes.length, 329)
  assert.deepEqual([...packedCodes].sort(), cycleCodes)
  assert.equal(new Set(packedCodes).size, packedCodes.length)
  assert.deepEqual(packs.map(pack => pack.cards.length), [215, 19, 95])
  assert.deepEqual(packs.map(pack => pack.status), ['playable', 'verified', 'verified'])
  assert.ok(packs.every(pack => pack.cards.every(card => card.cataloged)))
  assert.equal(playerPack.cards.filter(card => card.deckbuilding).length, 92)
  assert.deepEqual(playerPack.cards.filter(card => !card.deckbuilding).map(card => card.code), ['03040', '03041', '03042'])
  assert.deepEqual(investigatorPack.cards.filter(card => card.rulesImplemented).map(card => card.code),
    Array.from({ length: 19 }, (_, index) => String(3001 + index).padStart(5, '0')))
  const investigatorCodes = new Set(investigatorPack.cards.map(card => card.code))
  const playerCodes = new Set(playerPack.cards.map(card => card.code))
  for (const code of cycleCodes) {
    assert.equal(getAvailability(code).availability,
      investigatorCodes.has(code) || playerCodes.has(code) ? 'strict' : 'catalog-only')
    assert.equal(getAvailability(code).deckbuilding,
      playerCodes.has(code) && !playerPack.basicWeaknessCodes.includes(code))
  }
})

test('C0 preserves six investigator identities, signatures, and three basic weaknesses', () => {
  assert.deepEqual(investigatorPack.cards.filter(card => ALL_CARDS[card.code].type === 'investigator')
    .map(card => card.code), ['03001', '03002', '03003', '03004', '03005', '03006'])
  assert.equal(investigatorPack.cards.filter(card => ALL_CARDS[card.code].signatureFor).length, 13)
  assert.deepEqual(playerPack.basicWeaknessCodes, ['03040', '03041', '03042'])
  for (const code of playerPack.basicWeaknessCodes) {
    assert.equal(ALL_CARDS[code].subtype, 'basicweakness')
  }
})

test('C0 imports the original chaos bags and campaign record schema', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(CHAOS_BAGS).map(([difficulty, tokens]) =>
    [difficulty, tokens.length])), { easy: 15, standard: 15, hard: 16, expert: 17 })
  for (const tokens of Object.values(CHAOS_BAGS)) {
    assert.equal(tokens.filter(token => token === 'skull').length, 3)
    assert.equal(tokens.includes('cultist'), false)
    assert.equal(tokens.includes('tablet'), false)
    assert.equal(tokens.includes('elderthing'), false)
  }
  assert.equal(recordTypes.doubt, 'number')
  assert.equal(recordTypes.conviction, 'number')
  assert.equal(recordTypes.vipsInterviewed, 'string[]')
  assert.equal(recordTypes.possessed, 'string[]')
})

test('C0 uses the same shared card-art resource layout as the first cycle', () => {
  for (const code of ['03001', ...chapters.map(chapter => chapter.code)]) {
    const descriptor = imageDescriptor(code)
    assert.equal(descriptor.front.candidates[0].path, `cards/${code}.avif`)
    assert.equal(descriptor.front.candidates[0].localized, true)
    assert.ok(descriptor.back.candidates[0].path.startsWith('cards/'))
    assert.equal(JSON.stringify(descriptor).includes('carcosa/'), false)
  }
})

test('C4 records all-card acceptance while M5 browser certification remains pending', () => {
  const report = JSON.parse(readFileSync(new URL('../audit/carcosa-migration.json', import.meta.url)))
  assert.equal(report.milestone, 'C4')
  assert.equal(assertMigrationConfirmations(report, chapters.map(chapter => chapter.id)), report)
  assert.equal(report.playable, true)
  assert.equal(report.launchEnabled, true)
  assert.equal(report.earlyAccess, true)
  assert.equal(report.equivalenceCertified, false)
  assert.equal(report.confirmations.scenarios.status, 'pending')
  assert.ok(report.confirmations.scenarios.items.every(item =>
    item.checks.sourceLocked && item.checks.identityRegistered && item.checks.saveReplay
      && !item.checks.browserAcceptance && item.status === 'pending'))
  const hidden = report.confirmations.keywords.items.find(item => item.id === 'hidden')
  assert.equal(report.confirmations.keywords.status, 'verified')
  assert.ok(report.confirmations.keywords.items.every(item =>
    item.status === 'verified' && item.cardCodes.length > 0 && Object.values(item.checks).every(Boolean)))
  const keyword = id => report.confirmations.keywords.items.find(item => item.id === id)
  assert.ok(keyword('aloof').cardCodes.includes('03221b'))
  assert.ok(keyword('forced').cardCodes.includes('03327a'))
  assert.ok(keyword('parley').cardCodes.includes('03076a'))
  assert.ok(keyword('parley').cardCodes.includes('03301'))
  assert.ok(keyword('peril').cardCodes.includes('03084a'))
  assert.ok(keyword('revelation').cardCodes.includes('03084d'))
  assert.equal(hidden.status, 'verified')
  assert.deepEqual(hidden.cardCodes,
    ['03084a', '03084b', '03084c', '03084d', '03186', '03187', '03340', '03341', '03342'])
  assert.deepEqual(report.confirmations.rulebook.requiredRuleIds,
    ['hidden', 'carcosaCampaign', 'carcosaDoubtConviction', 'carcosaGuests',
      'carcosaAsylum', 'carcosaCatacombs', 'carcosaChaos', 'carcosaFinale'])
  assert.equal(report.confirmations.rulebook.status, 'verified')
  assert.ok(Object.values(report.confirmations.rulebook.checks).every(Boolean))
  assert.equal(report.confirmations.allCards.status, 'verified')
  assert.equal(report.confirmations.allCards.total, 383)
  assert.equal(report.confirmations.allCards.verified, 383)
  assert.equal(report.confirmations.allCards.pending, 0)
  assert.equal(report.confirmations.allCards.pendingCodes.length, 0)
  assert.deepEqual(report.catalog,
    { total: 329, campaign: 215, investigatorsAndSignatures: 19, playerCards: 95,
      printedRecords: 383, linkedFaces: 54, verified: 383, pending: 0 })

  const premature = structuredClone(report)
  premature.playable = true
  delete premature.earlyAccess
  assert.throws(() => assertMigrationConfirmations(premature, chapters.map(chapter => chapter.id)),
    /不可.*playable/)
  const forged = structuredClone(report)
  forged.confirmations.scenarios.items[0].status = 'verified'
  assert.throws(() => assertMigrationConfirmations(forged, chapters.map(chapter => chapter.id)),
    /status 应为 pending/)
})
