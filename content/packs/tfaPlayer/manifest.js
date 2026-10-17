import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

const playerTypes = new Set(['asset', 'event', 'skill', 'treachery', 'enemy'])

// M0: every non-encounter card outside the investigator box is a player card.
// Level-0 cards live in the deluxe, upgrades are spread over the six mythos
// packs; the pack stays catalog-only until M2.
const playerCards = Object.values(ALL_CARDS)
  .filter(card => /^04\d{3}$/.test(card.code) && !card.encounterCode
    && !card.signatureFor && card.type !== 'investigator' && playerTypes.has(card.type))
  .sort((left, right) => left.code.localeCompare(right.code))

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'tfaPlayer',
  name: '失落的时代 · 玩家卡',
  contentVersion: '0.1.0',
  minRulesVersion: 'n4.2',
  status: 'catalog-only',
  dependencies: ['core'],
  description: 'M0 目录基线：玩家卡与两张基础弱点已登记，逐卡效果尚未实现。',
  cardRanges: [{ from: '04001', to: '04347' }],
  basicWeaknessCodes: ['04038', '04040'],
  cards: playerCards.map(card => ({
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
