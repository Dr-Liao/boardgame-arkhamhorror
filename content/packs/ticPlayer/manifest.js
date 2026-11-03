import { catalogPack } from '../../campaigns/theInnsmouthConspiracy/shared.js'
import { TIC_PLAYER_VERIFIED_CODES, TIC_PLAYER_BUILDABLE_CODES, TIC_PLAYER_BASIC_WEAKNESS_CODES, ticPlayerCardVerified } from '../../../src/cards/tic-player-acceptance.js'
export { TIC_PLAYER_VERIFIED_CODES, TIC_PLAYER_BUILDABLE_CODES, TIC_PLAYER_BASIC_WEAKNESS_CODES, ticPlayerCardVerified }
const buildable = new Set(TIC_PLAYER_BUILDABLE_CODES)
const catalog = catalogPack('ticPlayer', '印斯茅斯暗潮 · 玩家卡')
export const manifest = { ...catalog, contentVersion: '1.0.0', status: 'playable',
  description: '一般玩家卡逐卡行为验收已完成；基础弱点只作依赖，战役章节仍待迁移。',
  basicWeaknessCodes: [...TIC_PLAYER_BASIC_WEAKNESS_CODES],
  behaviorIds: TIC_PLAYER_VERIFIED_CODES.map(code => `ticPlayerCard${code}`),
  cards: catalog.cards.map(card => ({ ...card, rulesImplemented: ticPlayerCardVerified(card.code),
    deckbuilding: buildable.has(card.code), ...(!buildable.has(card.code) ? { dependencyOnly: true } : {}) })),
}
