import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { createGameState, applyMove, validateMove } from '../src/engine/engine.js'
import { registeredEntry } from '../src/engine/ability.js'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { chapterSpecs, locationId as L } from '../content/campaigns/theDunwichLegacy/chapters.js'
import { chapters, CHAOS_BAGS } from '../content/campaigns/theDunwichLegacy/shared.js'
import { scenarioZoneReport } from '../content/scenario-manifest.js'

const sequence = (from, to) => Array.from({ length: to - from + 1 }, (_, index) =>
  String(from + index).padStart(5, '0'))

// This is intentionally an independent, literal inventory. A range error in a
// production chapter definition must not silently change the acceptance set.
const EXPECTED = {
  extracurricularActivity: {
    encounter: 'extracurricular_activity',
    scenario: '02041',
    agendas: sequence(2042, 2044),
    acts: sequence(2045, 2047),
    locations: sequence(2048, 2057),
    aliases: { '02048': 'miskatonicQuad', '02050': 'orneLibrary' },
  },
  theHouseAlwaysWins: {
    encounter: 'the_house_always_wins',
    scenario: '02062',
    agendas: sequence(2063, 2065),
    acts: sequence(2066, 2069),
    locations: sequence(2070, 2077),
    aliases: {
      '02070': 'laBellaLuna', '02071': 'cloverClubLounge', '02072': 'cloverClubBar',
      '02073': 'cloverClubCardroom',
    },
  },
  theMiskatonicMuseum: {
    encounter: 'the_miskatonic_museum',
    scenario: '02118',
    agendas: sequence(2119, 2121),
    acts: sequence(2122, 2125),
    locations: sequence(2126, 2137),
  },
  theEssexCountyExpress: {
    encounter: 'essex_county_express',
    scenario: '02159',
    agendas: sequence(2160, 2164),
    acts: sequence(2165, 2166),
    locations: sequence(2167, 2177),
  },
  bloodOnTheAltar: {
    encounter: 'blood_on_the_altar',
    scenario: '02195',
    agendas: sequence(2196, 2198),
    acts: sequence(2199, 2200),
    locations: sequence(2201, 2214),
  },
  undimensionedAndUnseen: {
    encounter: 'undimensioned_and_unseen',
    scenario: '02236',
    agendas: sequence(2237, 2239),
    acts: sequence(2240, 2241),
    locations: sequence(2242, 2253),
  },
  whereDoomAwaits: {
    encounter: 'where_doom_awaits',
    scenario: '02274',
    agendas: sequence(2275, 2276),
    acts: sequence(2277, 2281),
    locations: sequence(2282, 2292),
  },
  lostInTimeAndSpace: {
    encounter: 'lost_in_time_and_space',
    scenario: '02311',
    agendas: sequence(2312, 2315),
    acts: sequence(2316, 2319),
    locations: ['02320', '02321', '02322', ...sequence(2324, 2328)],
  },
}

const allExpected = Object.entries(EXPECTED).flatMap(([chapterId, spec]) => [
  { chapterId, code: spec.scenario, type: 'scenario' },
  ...spec.agendas.map(code => ({ chapterId, code, type: 'agenda' })),
  ...spec.acts.map(code => ({ chapterId, code, type: 'act' })),
  ...spec.locations.map(code => ({ chapterId, code, type: 'location' })),
])
const SINGLE_SIDED_LOCATIONS = new Set(['02214', ...sequence(2324, 2328)])

assert.equal(allExpected.length, 146)
assert.deepEqual(
  Object.fromEntries(['location', 'act', 'agenda', 'scenario'].map(type =>
    [type, allExpected.filter(card => card.type === type).length])),
  { location: 86, act: 26, agenda: 26, scenario: 8 },
)

const clone = value => structuredClone(value)
function settle(state) {
  for (let count = 0; state.pendingChoice; count++) {
    assert.ok(count < 100, 'choice loop during deterministic setup')
    const pending = state.pendingChoice
    const optionId = pending.options.find(option => ['done', 'skip'].includes(option.id))?.id
      || pending.options[0].id
    const seat = pending.seat ?? state.currentSeat
    const move = { action: 'choose', choiceId: pending.id, optionId }
    assert.equal(validateMove(state, seat, move), null)
    applyMove(state, seat, move)
  }
}

const trialCampaigns = {}
registerContentBundle({
  packs: [{ ...contentRegistry.getPack('dunwichCampaign'), id: 'dunwichScenarioAcceptancePack', status: 'playable' }],
})
for (const chapter of chapters) {
  const scenarioId = `${chapter.id}ScenarioAcceptance`
  const campaignId = `${chapter.id}ScenarioAcceptanceCampaign`
  const production = contentRegistry.getBehavior(chapter.id)
  trialCampaigns[chapter.id] = campaignId
  registerContentBundle({
    campaigns: [{
      ...contentRegistry.getCampaign('theDunwichLegacy'),
      id: campaignId,
      status: 'playable',
      chaosBags: CHAOS_BAGS,
      scenarioIds: [scenarioId],
      unlock: { [scenarioId]: [] },
      requiredPackIds: ['core', 'dunwichScenarioAcceptancePack'],
      flow: {
        start: scenarioId,
        nodes: {
          [scenarioId]: { type: 'scenario', scenarioId, next: 'end' },
          end: { type: 'end' },
        },
      },
    }],
    scenarios: [{
      scenario: { ...contentRegistry.getScenarioData(chapter.id), id: scenarioId },
      behavior: { ...production, id: scenarioId },
      manifest: {
        ...contentRegistry.getScenario(chapter.id),
        id: scenarioId,
        campaignId,
        status: 'playable',
        requiredMechanicIds: [],
        requiredEncounterGroupIds: [],
        requiredPackIds: ['core', 'dunwichScenarioAcceptancePack'],
        behaviorIds: [scenarioId],
      },
    }],
  })
}

function fixture(chapterId) {
  const state = createGameState(
    { campaignId: trialCampaigns[chapterId], seed: `dunwich-scenario-acceptance-${chapterId}`, playerInvestigator: '01001' },
    [{ seat: 0 }, { seat: 1 }],
  )
  settle(state)
  return state
}

function locationDefinitions(scenario) {
  return [
    ...Object.values(scenario.locations || {}),
    ...Object.values(scenario.locationVariants || {}).flat(),
  ]
}

function definitionFor(scenario, type, code) {
  if (type === 'scenario') return scenario
  if (type === 'act') return scenario.acts.find(card => card.originalCode === code)
  if (type === 'agenda') return scenario.agendas.find(card => card.originalCode === code)
  return locationDefinitions(scenario).find(card => card.originalCode === code)
}

function localized(card, key) {
  return card[`${key}Zh`] || card[key] || ''
}

function behaviorSurface(behavior) {
  return Object.values(behavior)
    .filter(value => typeof value === 'function')
    .map(value => Function.prototype.toString.call(value))
    .join('\n')
}

for (const { chapterId, code, type } of allExpected) {
  const expected = EXPECTED[chapterId]
  const catalog = ALL_CARDS[code]
  const titleName = catalog?.nameEn || catalog?.name || type

  test(`Dunwich ${code} ${titleName} strictly matches its ${type} contract`, () => {
    assert.ok(catalog, `${code} is absent from card data`)
    assert.equal(catalog.code, code)
    assert.equal(catalog.originalCode, code)
    assert.equal(catalog.type, type)
    assert.equal(catalog.encounterCode, expected.encounter)
    assert.equal(catalog.availability, 'catalog-only')

    const scenario = contentRegistry.getScenarioData(chapterId)
    const behavior = contentRegistry.getBehavior(chapterId)
    const manifest = contentRegistry.getScenario(chapterId)
    const definition = definitionFor(scenario, type, code)
    assert.ok(definition, `${code} is not represented by ${chapterId}`)
    assert.equal(definition.originalCode, code)

    // Every card checks its own printed face(s), not merely membership in a
    // global catalog. Acts/agendas additionally preserve their advancement side.
    if (type === 'scenario') {
      const chapterName = chapters.find(chapter => chapter.id === chapterId)?.name
      assert.ok(chapterName)
      assert.ok(definition.name.includes(chapterName), `${definition.name} does not identify ${chapterName}`)
    } else {
      assert.equal(definition.name, localized(catalog, 'name'))
    }
    if (type === 'location') {
      assert.equal(definition.text, localized(catalog, 'text'))
      assert.deepEqual(definition.traits, catalog.traits)
      assert.equal(definition.shroud, catalog.shroud)
      assert.equal(definition.cluesPerInvestigator, catalog.clues || 0)
      assert.equal(definition.victory, catalog.victory || 0)
      if (catalog.cluesFixed) assert.equal(definition.cluesFixed, catalog.clues)
      if (catalog.doubleSided) {
        assert.ok(catalog.backimagesrc, `${code} lacks its unrevealed face`)
        assert.ok(localized(catalog, 'backName') || localized(catalog, 'name'))
      } else {
        assert.ok(SINGLE_SIDED_LOCATIONS.has(code), `${code} unexpectedly lacks a reverse face`)
      }
    } else if (type === 'act' || type === 'agenda') {
      assert.equal(definition.text, localized(catalog, 'text'))
      assert.equal(definition.advanceText, localized(catalog, 'backText'))
      assert.deepEqual(definition.reveal, { type: 'campaignRule' })
      assert.ok(catalog.doubleSided)
      assert.ok(catalog.backimagesrc)
      assert.ok(localized(catalog, 'backName'))
      if (type === 'agenda') assert.equal(definition.doomThreshold, catalog.doom)
      assert.equal(typeof behavior[type === 'act' ? 'actReveal' : 'agendaReveal'], 'function')
    } else {
      assert.equal(scenario.originalCode, code)
      assert.equal(scenario.id, chapterId)
      assert.ok(localized(catalog, 'text'))
      assert.ok(localized(catalog, 'backText'))
      assert.equal(typeof behavior.resolveChaosToken, 'function')
    }

    const hasPrintedBehavior = Boolean(localized(catalog, 'text') || localized(catalog, 'backText'))
    if (hasPrintedBehavior && type !== 'scenario') {
      const alias = expected.aliases?.[code]
      const entry = registeredEntry(code)
      const entryLinked = Boolean(entry && (entry.actRule || entry.agendaRule || entry.locationRule
        || entry.enemyScript || entry.enemyRule || entry.treacheryRule || entry.relocateDestination))
      const linked = behaviorSurface(behavior).includes(code)
        || entryLinked
        || (alias && behaviorSurface(behavior).includes(alias))
        || (type === 'location' && definition.resign === true && /\bResign\./.test(catalog.text))
      assert.ok(linked, `${code} has printed behavior but no chapter behavior linkage`)
    }

    // Setup-only cards still prove deterministic placement/identity and zone
    // conservation through the production scenario manifest.
    if (!hasPrintedBehavior || type === 'scenario') {
      const before = clone(scenario)
      const first = fixture(chapterId)
      const second = fixture(chapterId)
      assert.deepEqual(clone(first), clone(second), `${chapterId} setup is not deterministic`)
      assert.deepEqual(clone(contentRegistry.getScenarioData(chapterId)), before, 'setup mutated registered card data')
      assert.ok(first.locations.some(location => location.id === first.investigators[0].location))
      scenarioZoneReport(before, manifest)
    }

    // Literal chapter lists prevent substitutions, omissions and duplicates.
    assert.equal(new Set(allExpected.map(card => card.code)).size, 146)
    assert.deepEqual(chapterSpecs[chapterId]?.acts || expected.acts, expected.acts)
    assert.deepEqual(chapterSpecs[chapterId]?.agendas || expected.agendas, expected.agendas)
    assert.deepEqual(chapterSpecs[chapterId]?.locations || expected.locations, expected.locations)
    assert.equal(chapters.find(chapter => chapter.id === chapterId)?.code, expected.scenario)

    if (type === 'location' && chapterSpecs[chapterId]) {
      const identity = manifest.locations.find(item => item.id === definition.id)
      assert.equal(identity?.frontCode, code)
      assert.equal(identity?.backCode, code)
      assert.equal(definition.id.startsWith('location') ? definition.id : L(code), definition.id)
    }
  })
}
