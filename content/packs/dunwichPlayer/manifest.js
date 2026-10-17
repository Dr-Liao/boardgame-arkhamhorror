import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { dunwichCardVerified } from '../../../src/cards/dunwich-acceptance.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { effects } from './effects.js'
export { effects }

const pilot = new Set(['02020', '02021', '02030'])
export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION, id: 'dunwichPlayer', name: '敦威治遗产 · 玩家卡',
  contentVersion: '0.3.0', minRulesVersion: 'n4.2', status: 'playable', dependencies: ['core'],
  description: '按逐卡规则开放；敦威治周期玩家卡已完成逐卡验收。',
  cardRanges: [{ from: '02016', to: '02310' }],
  cards: Object.values(ALL_CARDS).filter(c => /^02\d{3}$/.test(c.code) && !c.encounterCode
    && ['asset', 'event', 'skill', 'treachery'].includes(c.type) && !c.signatureFor && !pilot.has(c.code)
    && c.code !== '02040').map(card => ({
      code: card.code, name: card.nameZh || card.name, type: 'player', cataloged: true, imageAvailable: !!card.imagesrc,
      rulesImplemented: dunwichCardVerified(card.code), deckbuilding: !!effects[card.code], requiredMechanicIds: [],
    })),
  encounterGroupIds: [], behaviorIds: [],
}
