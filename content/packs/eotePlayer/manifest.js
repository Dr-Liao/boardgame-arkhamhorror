// 地球边缘 · 一般玩家卡包（P6：115 条记录 = 111 张可构筑玩家卡 + 4 张基础弱点）。
//
// P6 起本包状态为 playable：115 张逐卡主要印刷效果由 4 个分片测试实跑验收，
// 逐卡 rulesImplemented/deckbuilding 来自 tools/audit-eote-player.mjs 的生成物
// （src/cards/eote-player-acceptance.js），这里不手写实现清单。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CARD_PARTITIONS } from '../../campaigns/edgeOfTheEarth/shared.js'
import {
  EOTE_PLAYER_ACCEPTANCE_PROFILE, EOTE_PLAYER_BASIC_WEAKNESS_CODES,
  EOTE_PLAYER_BUILDABLE_CODES, EOTE_PLAYER_VERIFIED_CODES, eotePlayerBuildable, eotePlayerCardVerified,
} from '../../../src/cards/eote-player-acceptance.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

export const PLAYER_CARD_CODES = Object.freeze([...CARD_PARTITIONS.eotePlayer])
export { EOTE_PLAYER_ACCEPTANCE_PROFILE, EOTE_PLAYER_BASIC_WEAKNESS_CODES, EOTE_PLAYER_BUILDABLE_CODES, eotePlayerBuildable, eotePlayerCardVerified }

const basicWeaknessCodes = new Set(EOTE_PLAYER_BASIC_WEAKNESS_CODES)
const playerCards = PLAYER_CARD_CODES.map(code => ALL_CARDS[code])

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'eotePlayer',
  name: '地球边缘 · 玩家卡',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  dependencies: ['core'],
  description: 'P6 115 条一般玩家卡记录（含 4 张基础弱点）已全部完成逐卡主要印刷效果验收；111 张可构筑，08130–08133 只作基础弱点依赖。',
  cardRanges: [{ from: '08019', to: '08133' }, { from: '08019a', to: '08133z' }],
  basicWeaknessCodes: [...EOTE_PLAYER_BASIC_WEAKNESS_CODES],
  cards: playerCards.map(card => ({
    code: card.code,
    name: card.nameZh || card.name,
    type: 'player',
    cataloged: true,
    imageAvailable: !!card.imagesrc,
    rulesImplemented: eotePlayerCardVerified(card.code),
    deckbuilding: eotePlayerBuildable(card.code),
    ...(basicWeaknessCodes.has(card.code) ? { dependencyOnly: true } : {}),
  })),
  encounterGroupIds: [],
  behaviorIds: [...EOTE_PLAYER_VERIFIED_CODES].map(code => `eotePlayerCard${code}`),
}
