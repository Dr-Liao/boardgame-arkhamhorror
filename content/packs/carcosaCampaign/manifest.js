import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { carcosaCampaignCardVerified } from '../../../src/cards/carcosa-campaign-acceptance.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

const encounterTypes = new Set(['enemy', 'treachery'])
const campaignCards = Object.values(ALL_CARDS)
  .filter(card => /^03\d{3}$/.test(card.code) && card.encounterCode)
  .sort((left, right) => left.code.localeCompare(right.code))

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'carcosaCampaign',
  name: '卡尔克萨之路 · 战役内容',
  contentVersion: '0.5.0',
  minRulesVersion: 'n4.2',
  status: 'playable',
  dependencies: ['core'],
  description: '原版循环逐卡验收已完成，战役内容现已开放；M5 大厅、联机与浏览器端到端认证仍待完成。',
  cardRanges: [{ from: '03001', to: '03342' }],
  cards: campaignCards.map(card => ({
    code: card.code,
    name: card.nameZh || card.name,
    type: encounterTypes.has(card.type) ? 'encounter' : card.type === 'asset' ? 'player' : 'other',
    cataloged: true,
    imageAvailable: !!card.imagesrc,
    rulesImplemented: carcosaCampaignCardVerified(card.code),
    deckbuilding: false,
  })),
  encounterGroupIds: [
    'curtainCall', 'theLastKing', 'delusions', 'byakhee', 'inhabitantsOfCarcosa',
    'evilPortents', 'hauntings', 'hastursGift', 'cultOfTheYellowSign', 'decay',
    'stranger', 'echoesOfThePast', 'theUnspeakableOath', 'aPhantomOfTruth',
    'thePallidMask', 'blackStarsRise', 'flood', 'vortex', 'dimCarcosa',
  ],
  behaviorIds: [
    'carcosaEncounterEffects', 'carcosaChaosEffects', 'carcosaCampaignFlow',
    'curtainCall', 'theLastKing', 'echoesOfThePast', 'theUnspeakableOath',
    'aPhantomOfTruth', 'thePallidMask', 'blackStarsRise', 'dimCarcosa',
  ],
}
