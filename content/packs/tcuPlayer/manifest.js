// 万象无终 · 玩家卡包（M0：87 张 = 85 张普通玩家卡 + 2 张基础弱点）。
//
// 全部 catalog-only：M2（P7）逐卡验收后才会按波次进入构筑池；塔罗/绑定/谈判等原语
// 已在第 2 步落地，但卡面实现仍在 P7。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

const mainCodes = Object.keys(ALL_CARDS).filter(code => /^05\d{3}$/.test(code)).sort()
const playerCards = mainCodes
  .filter(code => !ALL_CARDS[code].encounterCode
    && !(ALL_CARDS[code].type === 'investigator' || ALL_CARDS[code].signatureFor)
    && (['asset', 'event', 'skill'].includes(ALL_CARDS[code].type)
      || ['weakness', 'basicweakness'].includes(ALL_CARDS[code].subtype)))
  .map(code => ALL_CARDS[code])

export const PLAYER_CARD_CODES = Object.freeze(playerCards.map(card => card.code))

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'tcuPlayer',
  name: '万象无终 · 玩家卡',
  contentVersion: '0.1.0',
  minRulesVersion: 'n6.0',
  status: 'catalog-only',
  dependencies: ['core'],
  description: '87 张玩家卡（含 2 张基础弱点）按原卡号登记；M2 逐卡验收前保持 catalog-only，不可构筑。',
  cardRanges: [{ from: '05020', to: '05324' }],
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
