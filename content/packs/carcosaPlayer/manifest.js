import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { carcosaPlayerCardVerified } from '../../../src/cards/carcosa-player-acceptance.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { effects } from './effects.js'
export { effects }

const playerTypes = new Set(['asset', 'event', 'skill', 'treachery', 'enemy'])
const basicWeaknessCodes = ['03040', '03041', '03042']
const playerCards = Object.values(ALL_CARDS)
  .filter(card => /^03\d{3}$/.test(card.code) && !card.encounterCode && !card.signatureFor
    && card.type !== 'investigator' && playerTypes.has(card.type))
  .sort((left, right) => left.code.localeCompare(right.code))

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'carcosaPlayer',
  name: '卡尔克萨之路 · 玩家卡',
  contentVersion: '1.0.0',
  minRulesVersion: 'n4.2',
  status: 'verified',
  dependencies: ['core'],
  description: 'C2 卡尔克萨玩家卡与基础弱点已完成逐卡主要印刷效果验收。',
  cardRanges: [{ from: '03001', to: '03342' }],
  cards: playerCards.map(card => ({
    code: card.code,
    name: card.nameZh || card.name,
    type: 'player',
    cataloged: true,
    imageAvailable: !!card.imagesrc,
    rulesImplemented: carcosaPlayerCardVerified(card.code) && !!effects[card.code],
    deckbuilding: !basicWeaknessCodes.includes(card.code),
  })),
  encounterGroupIds: [],
  behaviorIds: [],
  basicWeaknessCodes,
}
