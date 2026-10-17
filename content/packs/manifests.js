import { ALL_CARDS } from '../../src/cards/cards-data.js'
import { getAvailability } from '../../src/deck/availability.js'
import { CONTENT_SCHEMA_VERSION } from '../schema.js'

const encounterTypes = new Set(['enemy', 'treachery'])
const playerTypes = new Set(['investigator', 'asset', 'event', 'skill'])
const allCoreCodes = Object.keys(ALL_CARDS).filter(code => code.startsWith('01')).sort()
const notzCode = code => code >= '01105' && code <= '01141' || code === '01121a' || code === '01121b'

function cardEntry(code) {
  const card = ALL_CARDS[code]
  const availability = getAvailability(code)
  const type = encounterTypes.has(card.type) ? 'encounter' : playerTypes.has(card.type) ? 'player' : 'other'
  return { code, type, cataloged: true, imageAvailable: !!card.imagesrc,
    rulesImplemented: availability.strictAccepted, deckbuilding: type === 'player' && availability.deckbuilding }
}

export const packs = Object.freeze([
  {
    schemaVersion: CONTENT_SCHEMA_VERSION, id: 'core', name: '核心包', contentVersion: '1.0.0',
    minRulesVersion: 'n4.2', status: 'playable', dependencies: [],
    cardRanges: [{ from: '01000', to: '01104' }, { from: '01142', to: '01695' }],
    cards: allCoreCodes.filter(code => !notzCode(code)).map(cardEntry),
    encounterGroupIds: ['rats', 'ghouls', 'strikingFear', 'ancientEvils', 'chillingCold',
      'darkCult', 'nightgaunts', 'lockedDoors', 'agentsOfYogSothoth', 'agentsOfHastur', 'pentagram'],
    behaviorIds: [],
  },
  {
    schemaVersion: CONTENT_SCHEMA_VERSION, id: 'notz', name: '夜之狂热', contentVersion: '1.0.0',
    minRulesVersion: 'n4.2', status: 'playable', dependencies: ['core'],
    cardRanges: [{ from: '01105', to: '01141' }, { from: '01121a', to: '01121b' }],
    cards: allCoreCodes.filter(notzCode).map(cardEntry),
    encounterGroupIds: ['theGathering', 'theMidnightMasks', 'theDevourerBelow'], behaviorIds: [],
  },
])
