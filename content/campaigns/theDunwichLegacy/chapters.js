import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { location, stages, printed, encounterCards, encounterDefinitions, encounterDeck, identitiesFor } from './card-data.js'
import { chapters } from './shared.js'
import { locationSymbols } from './location-symbols.js'
import { scenarioManifest, layoutFor } from '../../scenario-manifest.js'

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i).padStart(5, '0'))
// Original campaign only. Random variants are selected at setup, never globally.
export const chapterSpecs = {
  theMiskatonicMuseum: {
    group: 'the_miskatonic_museum', groups: ['bad_luck', 'sorcery', 'the_beyond', 'chilling_cold', 'locked_doors'],
    acts: range(2122, 2125), agendas: range(2119, 2121), locations: range(2126, 2137),
    start: '02126', initial: ['02126', '02127', '02128', '02130'], aside: ['02138', '02139', '02140', '02142'],
    resolutions: ['noResolution', 'r1', 'r2'], mechanics: ['museumExhibitDeck', 'huntingHorrorVoid', 'museumLocationEffects'],
  },
  theEssexCountyExpress: {
    group: 'essex_county_express', groups: ['the_beyond', 'striking_fear', 'ancient_evils', 'pentagram'],
    acts: range(2165, 2166), agendas: range(2160, 2164), locations: range(2167, 2177),
    start: '02167', initial: range(2167, 2172).concat('02175'), aside: Array(4).fill('02178'),
    resolutions: ['noResolution', 'r1', 'r2'], mechanics: ['devouredTrainCars', 'trainCarEffects'],
  },
  bloodOnTheAltar: {
    group: 'blood_on_the_altar', groups: ['dunwich', 'whippoorwills', 'nightgaunts', 'ancient_evils'],
    acts: range(2199, 2200), agendas: range(2196, 2198), locations: range(2201, 2214),
    start: '02201', initial: ['02201', '02202', '02204', '02206', '02208', '02210'],
    aside: ['02215', '02216', '02217', '02218', '02219'],
    resolutions: ['noResolution', 'r1', 'r2', 'r3'], mechanics: ['hiddenChamber', 'potentialSacrifices', 'altarLocationEffects'],
  },
  undimensionedAndUnseen: {
    group: 'undimensioned_and_unseen', groups: ['whippoorwills', 'beast_thralls', 'dunwich', 'striking_fear'],
    acts: range(2240, 2241), agendas: range(2237, 2239), locations: range(2242, 2253),
    start: '02242', initial: ['02242', '02244', '02246', '02248', '02250', '02252'],
    aside: [...Array(4).fill('02254'), ...Array(5).fill('02255')],
    resolutions: ['noResolution', 'r1', 'r2'], mechanics: ['broodHunt', 'esotericFormula', 'broodLocationEffects'],
  },
  whereDoomAwaits: {
    group: 'where_doom_awaits', groups: ['beast_thralls', 'sorcery', 'bishops_thralls', 'striking_fear', 'ancient_evils', 'chilling_cold'],
    acts: range(2277, 2281), agendas: range(2275, 2276), locations: range(2282, 2292),
    start: '02282', initial: ['02282', '02283', '02284'], aside: ['02293'],
    resolutions: ['noResolution', 'r1', 'r2'], mechanics: ['divergingPaths', 'hillLocationEffects'],
  },
  lostInTimeAndSpace: {
    group: 'lost_in_time_and_space', groups: ['sorcery', 'the_beyond', 'hideous_abominations', 'agents_of_yog'],
    acts: range(2316, 2319), agendas: range(2312, 2315), locations: ['02320', '02321', '02322', ...range(2324, 2328)],
    start: '02320', initial: ['02320'], aside: ['02323'],
    resolutions: ['noResolution', 'r1', 'r2', 'r3', 'r4'], mechanics: ['encounterLocations', 'dimensionalLocationEffects', 'yogSothoth'],
  },
}

export const locationId = code => `location${code}`
export function buildChapter(id) {
  const spec = chapterSpecs[id], chapter = chapters.find(c => c.id === id)
  const cards = encounterCards([spec.group, ...spec.groups])
  const active = cards.filter(c => !spec.aside.includes(c.code))
  const optionalGroups = { bloodOnTheAltar: ['naomis_crew'], whereDoomAwaits: ['hideous_abominations'] }[id] || []
  const definitions = encounterDefinitions([...cards, ...encounterCards(optionalGroups)])
  // Dynamic Train / Path / Exhibit connections are installed by their rules.
  const locations = Object.fromEntries(spec.locations.map(code => {
    const symbols = locationSymbols[code]
    const connections = spec.locations.filter(other => other !== code && symbols.front.links.includes(locationSymbols[other].front.symbol))
    return [locationId(code), location(locationId(code), code, connections.map(locationId), {
      symbols, ...(ALL_CARDS[code].text?.includes('Resign.') ? { resign: true } : {}),
    })]
  }))
  const scenario = { id, originalCode: chapter.code, name: chapter.name,
    intro: `敦威治遗产：${chapter.name}`, startLocation: locationId(spec.start), locations,
    acts: stages(spec.acts, 'act').map(act => ({ ...act, reveal: { type: 'campaignRule' } })),
    agendas: stages(spec.agendas, 'agenda').map(agenda => ({ ...agenda, reveal: { type: 'campaignRule' } })),
    ...definitions, encounterDeck: encounterDeck(active),
    storyAssets: Object.fromEntries(spec.aside.filter(code => ALL_CARDS[code]?.type === 'asset').map(code => [code, printed(code)])),
    setAsideLocations: spec.locations.filter(code => !spec.initial.includes(code)).map(locationId),
    resolutions: Object.fromEntries(spec.resolutions.map(key => [key, `${chapter.name} · ${key === 'noResolution' ? '未达成结局' : `结局 ${key.slice(1)}`}`])),
  }
  if (id === 'theEssexCountyExpress') {
    scenario.storyAssets['02179'] = printed('02179')
    scenario.encounterDeck.push(...Array(ALL_CARDS['02179'].quantity).fill('02179'))
  }
  if (id === 'lostInTimeAndSpace') {
    scenario.locations[locationId('02322')].resign = false
    scenario.encounterDeck.push(...range(2324, 2328).flatMap(code => Array(ALL_CARDS[code].quantity).fill(code)))
    scenario.setAsideLocations = ['02321', '02322'].map(locationId)
  }
  const identities = identitiesFor(scenario)
  if (id === 'bloodOnTheAltar') scenario.locations[locationId('02201')].central = true
  const layout = layoutFor(scenario, Object.fromEntries(spec.locations.map((code, index) =>
    [locationId(code), { x: index % 4, y: Math.floor(index / 4) }])))
  const manifest = scenarioManifest(scenario, identities, {
    campaignId: 'theDunwichLegacy', status: 'playable', requiredPackIds: ['core', 'dunwichCampaign'],
    requiredEncounterGroupIds: [id], requiredMechanicIds: [...spec.mechanics, 'dunwichEncounterEffects', 'dunwichChaosEffects'],
    behaviorIds: [id], setAsideAliases: spec.aside, layout,
  })
  manifest.contentVersion = '1.0.0'
  return { scenario, identities, layout, manifest }
}

