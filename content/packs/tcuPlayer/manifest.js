// 万象无终 · 玩家卡包（M2：87 张 = 85 张普通玩家卡 + 2 张基础弱点）。
//
// P7 起本包状态为 verified：87 张逐卡主要印刷效果由 4 个分片测试实跑验收，
// 逐卡 rulesImplemented 来自 tools/audit-tcu-player.mjs 的生成物
// （src/cards/tcu-player-acceptance.js），这里不手写实现清单。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import {
  TCU_PLAYER_ACCEPTANCE_PROFILE, TCU_PLAYER_BASIC_WEAKNESS_CODES,
  TCU_PLAYER_VERIFIED_CODES, tcuPlayerCardVerified,
} from '../../../src/cards/tcu-player-acceptance.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

const mainCodes = Object.keys(ALL_CARDS).filter(code => /^05\d{3}$/.test(code)).sort()
const playerCards = mainCodes
  .filter(code => !ALL_CARDS[code].encounterCode
    && !(ALL_CARDS[code].type === 'investigator' || ALL_CARDS[code].signatureFor)
    && (['asset', 'event', 'skill'].includes(ALL_CARDS[code].type)
      || ['weakness', 'basicweakness'].includes(ALL_CARDS[code].subtype)))
  .map(code => ALL_CARDS[code])

export const PLAYER_CARD_CODES = Object.freeze(playerCards.map(card => card.code))
const basicWeaknessCodes = new Set(TCU_PLAYER_BASIC_WEAKNESS_CODES)
// 可构筑 = 已验证且不是基础弱点（85 张）。基础弱点只作依赖，不进构筑池。
export const TCU_PLAYER_BUILDABLE_CODES = Object.freeze(
  PLAYER_CARD_CODES.filter(code => tcuPlayerCardVerified(code) && !basicWeaknessCodes.has(code)))
export { TCU_PLAYER_ACCEPTANCE_PROFILE, TCU_PLAYER_BASIC_WEAKNESS_CODES, tcuPlayerCardVerified }
export const tcuPlayerBuildable = code => tcuPlayerCardVerified(code) && !basicWeaknessCodes.has(code)

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'tcuPlayer',
  name: '万象无终 · 玩家卡',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  dependencies: ['core'],
  description: 'M2 87 张玩家卡（含 2 张基础弱点）已全部完成逐卡主要印刷效果验收；85 张可构筑，05041/05042 只作基础弱点依赖。',
  cardRanges: [{ from: '05020', to: '05324' }],
  basicWeaknessCodes: [...TCU_PLAYER_BASIC_WEAKNESS_CODES],
  cards: playerCards.map(card => ({
    code: card.code,
    name: card.nameZh || card.name,
    type: 'player',
    cataloged: true,
    imageAvailable: !!card.imagesrc,
    rulesImplemented: tcuPlayerCardVerified(card.code),
    deckbuilding: tcuPlayerBuildable(card.code),
    ...(basicWeaknessCodes.has(card.code) ? { dependencyOnly: true } : {}),
  })),
  encounterGroupIds: [],
  behaviorIds: [...TCU_PLAYER_VERIFIED_CODES].map(code => `tcuPlayerCard${code}`),
}
