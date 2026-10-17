import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { contentRegistry } from '../content/registered.js'
import { campaignListForUi } from '../content/registry.js'
import { assertMigrationConfirmations } from '../content/migration-confirmation.js'
import { manifest } from '../content/campaigns/theForgottenAge/manifest.js'
import { CHAOS_BAGS, chapters, recordTypes, SUPPLIES } from '../content/campaigns/theForgottenAge/shared.js'
import { manifest as campaignPack } from '../content/packs/tfaCampaign/manifest.js'
import { manifest as investigatorPack } from '../content/packs/tfaInvestigators/manifest.js'
import { manifest as playerPack } from '../content/packs/tfaPlayer/manifest.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { getAvailability } from '../src/deck/availability.js'
import { imageDescriptor } from '../presentation/images.js'
import { validateCampaignGraph } from '../src/campaign/campaign-flow.js'

const mainCodes = Object.keys(ALL_CARDS).filter(code => /^04\d{3}$/.test(code)).sort()
const linkedFaces = Object.keys(ALL_CARDS).filter(code => /^04\d{3}[a-z]$/.test(code)).sort()

test('M0 registers ten catalogue-only Forgotten Age chapters and keeps the campaign closed', async () => {
  assert.deepEqual(contentRegistry.listScenarios(manifest.id).map(scenario => scenario.id),
    chapters.map(chapter => chapter.id))
  assert.equal(contentRegistry.getCampaign(manifest.id).status, 'catalog-only')
  assert.throws(() => contentRegistry.assertLaunchable(manifest.id))
  assert.equal(campaignListForUi(contentRegistry).some(campaign => campaign.id === manifest.id), false)
  for (const chapter of chapters) {
    const registered = contentRegistry.getScenario(chapter.id)
    assert.equal(registered.status, 'catalog-only')
    assert.equal(registered.catalogReferenceOnly, true)
    assert.equal(registered.referenceCode, chapter.code)
    assert.deepEqual(registered.locations, [])
    assert.deepEqual(registered.acts, [])
    assert.deepEqual(registered.agendas, [])
    const module = await import(`../content/campaigns/theForgottenAge/scenarios/${chapter.id}/index.js`)
    assert.equal(module.manifest.id, chapter.id)
    assert.equal(module.scenario.originalCode, chapter.code)
    assert.equal(module.behavior.id, chapter.id)
  }
})

test('M0 partitions every 04-cycle main code exactly once and keeps all 361 records catalog-only', () => {
  const packs = [campaignPack, investigatorPack, playerPack]
  const packedCodes = packs.flatMap(pack => pack.cards.map(card => card.code))
  assert.equal(mainCodes.length, 338)
  assert.equal(linkedFaces.length, 23)
  assert.deepEqual([...packedCodes].sort(), mainCodes)
  assert.equal(new Set(packedCodes).size, packedCodes.length)
  assert.deepEqual(packs.map(pack => pack.cards.length), [231, 16, 91])
  assert.deepEqual(packs.map(pack => pack.status), ['catalog-only', 'catalog-only', 'catalog-only'])
  assert.ok(packs.every(pack => pack.cards.every(card => card.cataloged && !card.rulesImplemented && !card.deckbuilding)))
  assert.equal(investigatorPack.cards.filter(card => ALL_CARDS[card.code].type === 'investigator').length, 5)
  assert.equal(investigatorPack.cards.filter(card => ALL_CARDS[card.code].signatureFor).length, 11)
  assert.deepEqual(playerPack.basicWeaknessCodes, ['04038', '04040'])
  assert.deepEqual(playerPack.cards.filter(card => ALL_CARDS[card.code].subtype === 'basicweakness').map(card => card.code),
    ['04038', '04040'])
  assert.equal(campaignPack.cards.some(card => card.code === '04244'), true)
  for (const code of mainCodes) {
    const availability = getAvailability(code)
    assert.equal(availability.availability, 'catalog-only', code)
    assert.equal(availability.strictAccepted, false, code)
    assert.equal(availability.selectable, false, code)
    assert.equal(availability.deckbuilding, false, code)
  }
})

test('M0 imports the original chaos bags, campaign records and supply list', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(CHAOS_BAGS).map(([difficulty, tokens]) =>
    [difficulty, tokens.length])), { easy: 14, standard: 14, hard: 14, expert: 15 })
  for (const tokens of Object.values(CHAOS_BAGS)) {
    assert.equal(tokens.filter(token => token === 'skull').length, 2)
    assert.equal(tokens.filter(token => token === 'elderthing').length, 1)
    assert.equal(tokens.filter(token => token === 'eldersign').length, 1)
    assert.equal(tokens.filter(token => token === 'autofail').length, 1)
    assert.equal(tokens.includes('cultist'), false)
    assert.equal(tokens.includes('tablet'), false)
  }
  assert.equal(Object.keys(recordTypes).length, 48)
  assert.equal(recordTypes.yigsFury, 'number')
  assert.equal(recordTypes.pathsAreKnownToYou, 'number')
  assert.equal(recordTypes.theHarbingerIsStillAlive, 'number')
  assert.equal(recordTypes.theJungleWatches, 'string[]')
  assert.equal(recordTypes.theInvestigatorsTurnedBackTime, 'boolean')
  assert.equal(SUPPLIES.length, 19)
  assert.equal(SUPPLIES.includes('provisions'), true)
  assert.equal(SUPPLIES.includes('keyOfEztli'), true)
})

test('M0 keeps the original chapter order and the prologue-to-epilogue flow', () => {
  assert.deepEqual(manifest.scenarioIds, [
    'theUntamedWilds', 'theDoomOfEztli', 'threadsOfFate', 'theBoundaryBeyond',
    'heartOfTheEldersPart1', 'heartOfTheEldersPart2', 'theCityOfArchives',
    'theDepthsOfYoth', 'shatteredAeons', 'turnBackTime',
  ])
  const graph = validateCampaignGraph(manifest)
  assert.equal(graph.start, 'prologue')
  const chain = []
  let id = graph.start
  for (let guard = 0; guard < 40 && id !== 'end'; guard++) {
    const node = graph.nodes[id]
    if (node.type === 'scenario') chain.push(node.scenarioId)
    id = node.next
  }
  assert.deepEqual(chain, manifest.scenarioIds)
  for (const chapter of chapters) {
    assert.deepEqual(manifest.unlock[chapter.id],
      chapter === chapters[0] ? [] : [chapters[chapters.indexOf(chapter) - 1].id])
  }
})

test('M0 uses the shared card-art layout as the earlier cycles', () => {
  for (const code of ['04001', ...chapters.map(chapter => chapter.code)]) {
    const descriptor = imageDescriptor(code)
    assert.equal(descriptor.art, code)
    assert.equal(descriptor.front.candidates[0].path, `cards/${code}.avif`)
    assert.equal(typeof descriptor.front.candidates[0].localized, 'boolean')
    assert.ok(descriptor.back.candidates[0].path.startsWith('cards/'))
    assert.equal(JSON.stringify(descriptor).includes('forgottenAge/'), false)
  }
  // 04277 ships without localized art; the fallback chain must stay explicit
  // instead of inventing a cycle-specific directory.
  assert.equal(imageDescriptor('04277').front.candidates[0].localized, false)
  assert.ok(imageDescriptor('04277').front.candidates.length > 1)
})

test('M0 records the catalogue baseline while every confirmation group stays pending', () => {
  const report = JSON.parse(readFileSync(new URL('../audit/tfa-migration.json', import.meta.url)))
  assert.equal(report.milestone, 'M0')
  assert.equal(assertMigrationConfirmations(report, chapters.map(chapter => chapter.id)), report)
  assert.equal(report.status, 'catalog-only')
  assert.equal(report.playable, false)
  assert.equal(report.launchEnabled, false)
  assert.equal(report.earlyAccess, false)
  assert.equal(report.equivalenceCertified, false)
  assert.deepEqual(report.catalog,
    { printedRecords: 361, mainCodes: 338, linkedFaces: 23, campaign: 231, investigatorsAndSignatures: 16, playerCards: 91 })
  assert.equal(report.confirmations.scenarios.status, 'pending')
  assert.equal(report.confirmations.scenarios.items.length, 10)
  assert.ok(report.confirmations.scenarios.items.every(item =>
    item.checks.sourceLocked && item.checks.identityRegistered && item.status === 'pending'
      && !item.checks.literalCardBehavior && !item.checks.browserAcceptance))
  assert.equal(report.confirmations.keywords.status, 'pending')
  assert.deepEqual(report.confirmations.keywords.items.map(item => item.id),
    ['explore', 'vengeance', 'yigsFury', 'supplies', 'poisoned', 'relicOfAges', 'expeditionLeader', 'elderThing'])
  assert.equal(report.confirmations.rulebook.status, 'pending')
  assert.ok(Object.values(report.confirmations.rulebook.checks).every(value => value === false))
  assert.equal(report.remaining.length > 0, true)
  const forged = structuredClone(report)
  forged.playable = true
  delete forged.earlyAccess
  assert.throws(() => assertMigrationConfirmations(forged, chapters.map(chapter => chapter.id)))
  const dishonest = structuredClone(report)
  dishonest.confirmations.scenarios.items[0].status = 'verified'
  assert.throws(() => assertMigrationConfirmations(dishonest, chapters.map(chapter => chapter.id)),
    /status 应为 pending/)
})
