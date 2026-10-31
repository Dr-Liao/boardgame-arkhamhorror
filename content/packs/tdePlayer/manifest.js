// 食梦者 · 玩家卡包（M2 / P7：87 条玩家包记录 = 72 张可入牌组卡 + 11 张场外绑定卡/绑定弱点 + 4 张基础弱点）。
//
// P7 起本包状态为 playable：87 张逐卡主要印刷效果由 4 个分片测试实跑验收，
// 逐卡 rulesImplemented 来自 tools/audit-tde-player.mjs 的生成物
// （src/cards/tde-player-acceptance.js），这里不手写实现清单。
// 基础弱点（06035–06038）与 deckLimit=0 的场外绑定卡（06019/06022/06025/06028/06031/06032/
// 06033/06113/06277/06283/06331）只作依赖，不进入构筑池。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import {
  TDE_PLAYER_ACCEPTANCE_PROFILE, TDE_PLAYER_BASIC_WEAKNESS_CODES,
  TDE_PLAYER_VERIFIED_CODES, tdePlayerCardVerified,
} from '../../../src/cards/tde-player-acceptance.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

const mainCodes = Object.keys(ALL_CARDS).filter(code => /^06\d{3}$/.test(code)).sort()
const playerCards = mainCodes
  .filter(code => !ALL_CARDS[code].encounterCode
    && !(ALL_CARDS[code].type === 'investigator' || ALL_CARDS[code].signatureFor)
    && (['asset', 'event', 'skill'].includes(ALL_CARDS[code].type)
      || ['weakness', 'basicweakness'].includes(ALL_CARDS[code].subtype)))
  .map(code => ALL_CARDS[code])

export const PLAYER_CARD_CODES = Object.freeze(playerCards.map(card => card.code))
const basicWeaknessCodes = new Set(TDE_PLAYER_BASIC_WEAKNESS_CODES)
const deckLimitOf = code => Number(ALL_CARDS[code]?.deckLimit ?? 0)
// 可入牌组 = 已验证 + 非基础弱点 + 印刷 deckLimit>0（72 张）。
// deckLimit=0 的绑定副本/绑定弱点（11 张）与 4 张基础弱点只作依赖，不进构筑池。
export const TDE_PLAYER_BUILDABLE_CODES = Object.freeze(
  PLAYER_CARD_CODES.filter(code => tdePlayerCardVerified(code) && !basicWeaknessCodes.has(code) && deckLimitOf(code) > 0))
export const TDE_PLAYER_DEPENDENCY_CODES = Object.freeze(
  PLAYER_CARD_CODES.filter(code => tdePlayerCardVerified(code) && !TDE_PLAYER_BUILDABLE_CODES.includes(code)))
const buildableSet = new Set(TDE_PLAYER_BUILDABLE_CODES)
const dependencySet = new Set(TDE_PLAYER_DEPENDENCY_CODES)
export { TDE_PLAYER_ACCEPTANCE_PROFILE, TDE_PLAYER_BASIC_WEAKNESS_CODES, tdePlayerCardVerified }
export const tdePlayerBuildable = code => buildableSet.has(code)
export const tdePlayerDependencyOnly = code => dependencySet.has(code)

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'tdePlayer',
  name: '食梦者 · 玩家卡',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  dependencies: ['core'],
  description: 'M2 87 条玩家包记录已全部完成逐卡主要印刷效果验收；72 张可入牌组，11 张场外绑定卡/绑定弱点与 06035–06038 基础弱点只作依赖。',
  cardRanges: [{ from: '06018', to: '06332' }],
  basicWeaknessCodes: [...TDE_PLAYER_BASIC_WEAKNESS_CODES],
  cards: playerCards.map(card => ({
    code: card.code,
    name: card.nameZh || card.name,
    type: 'player',
    cataloged: true,
    imageAvailable: !!card.imagesrc,
    rulesImplemented: tdePlayerCardVerified(card.code),
    deckbuilding: tdePlayerBuildable(card.code),
    ...(tdePlayerDependencyOnly(card.code) ? { dependencyOnly: true } : {}),
  })),
  encounterGroupIds: [],
  behaviorIds: [...TDE_PLAYER_VERIFIED_CODES].map(code => `tdePlayerCard${code}`),
}
