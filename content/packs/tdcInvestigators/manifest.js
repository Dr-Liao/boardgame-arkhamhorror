import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { ALL_CARDS, INVESTIGATORS } from '../../../src/cards/cards-data.js'

export const TDC_INVESTIGATOR_CODES = Object.freeze([
  '11001', '11004', '11007', '11008', '11011', '11014', '11017', '98019',
])
export const TDC_SIGNATURES_BY_INVESTIGATOR = Object.freeze(Object.fromEntries(
  TDC_INVESTIGATOR_CODES.map(code => [code, Object.freeze([...INVESTIGATORS[code].deckRequirements.signatureCards])]),
))
export const TDC_DEPENDENCY_CODES = Object.freeze([...new Set(TDC_INVESTIGATOR_CODES.flatMap(code =>
  Object.values(INVESTIGATORS[code].deckRequirements.card).flatMap(Object.keys)))].sort())

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'tdcInvestigators',
  name: '沉没之城 · 调查员',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  dependencies: ['core'],
  cardRanges: [{ from: '11001', to: '11019' }, { from: '98019', to: '98021' }],
  cards: [...TDC_INVESTIGATOR_CODES, ...TDC_DEPENDENCY_CODES].sort().map(code => ({
    code,
    name: ALL_CARDS[code].nameZh || ALL_CARDS[code].name,
    type: 'player',
    cataloged: true,
    imageAvailable: Boolean(ALL_CARDS[code].imagesrc),
    rulesImplemented: true,
    deckbuilding: false,
    ...(TDC_INVESTIGATOR_CODES.includes(code) ? { investigator: true } : { dependencyOnly: true }),
  })),
  encounterGroupIds: [],
  behaviorIds: [],
  docs: ['docs/campaign/theDrownedCity/investigators.md'],
}
