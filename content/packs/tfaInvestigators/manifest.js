import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

export const INVESTIGATOR_CODES = Object.freeze(['04001', '04002', '04003', '04004', '04005'])

// M0: five investigators plus their eleven signature/weakness cards stay
// catalog-only. Availability opens per investigator in M1.
const investigatorCards = Object.values(ALL_CARDS)
  .filter(card => /^04\d{3}$/.test(card.code) && !card.encounterCode
    && (card.type === 'investigator' || card.signatureFor))
  .sort((left, right) => left.code.localeCompare(right.code))

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'tfaInvestigators',
  name: '失落的时代 · 调查员',
  contentVersion: '0.1.0',
  minRulesVersion: 'n4.2',
  status: 'catalog-only',
  dependencies: ['core'],
  description: 'M0 目录基线：五位调查员与专属卡已登记，构筑规则与能力尚未实现。',
  cardRanges: [{ from: '04001', to: '04016' }],
  cards: investigatorCards.map(card => ({
    code: card.code,
    name: card.nameZh || card.name,
    type: 'player',
    cataloged: true,
    imageAvailable: !!card.imagesrc,
    rulesImplemented: false,
    deckbuilding: false,
  })),
  encounterGroupIds: [],
  behaviorIds: [],
}
