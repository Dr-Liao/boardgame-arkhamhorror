// 铁杉谷盛宴 · 一般玩家卡包（P6 生产：playable）。
//
// 内容：fhvp 里除 5 位调查员与 15 张专属/绑定依赖之外的 120 条记录
// （10019–10138，含 4 张基础弱点 10135–10138、11 张绑定/场外依赖、3 张 Research 卡）。
// 逐卡 rulesImplemented/deckbuilding 来自 tools/audit-fhv-player.mjs 的生成物
// （src/cards/fhv-player-acceptance.js），这里不手写实现清单。
// 跨循环重印 canonical 映射见 audit/fhv-scope.json：FHV 玩家卡没有跨循环重印别名。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { partitions } from '../../campaigns/theFeastOfHemlockVale/shared.js'
import {
  FHV_PLAYER_ACCEPTANCE_PROFILE, FHV_PLAYER_BASIC_WEAKNESS_CODES,
  FHV_PLAYER_BUILDABLE_CODES, FHV_PLAYER_DEPENDENCY_CODES, FHV_PLAYER_RESEARCHED_CODES,
  FHV_PLAYER_VERIFIED_CODES, fhvPlayerBuildable, fhvPlayerCardVerified,
} from '../../../src/cards/fhv-player-acceptance.js'

export const PLAYER_CARD_CODES = Object.freeze([...partitions.fhvPlayer])
export {
  FHV_PLAYER_ACCEPTANCE_PROFILE, FHV_PLAYER_BASIC_WEAKNESS_CODES, FHV_PLAYER_BUILDABLE_CODES,
  FHV_PLAYER_DEPENDENCY_CODES, FHV_PLAYER_RESEARCHED_CODES,
  FHV_PLAYER_VERIFIED_CODES, fhvPlayerBuildable, fhvPlayerCardVerified,
}

const basicWeaknessCodes = new Set(FHV_PLAYER_BASIC_WEAKNESS_CODES)
const dependencyCodes = new Set(FHV_PLAYER_DEPENDENCY_CODES)
const researchedCodes = new Set(FHV_PLAYER_RESEARCHED_CODES)
const playerCards = PLAYER_CARD_CODES.map(code => ALL_CARDS[code])

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'fhvPlayer',
  name: '铁杉谷盛宴 · 玩家卡',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  dependencies: ['core'],
  description: 'P6 一般玩家卡 120 条记录（含 4 张基础弱点与 11 张绑定/场外依赖）逐卡主要印刷效果验收；可构筑卡进入大厅构筑池，基础弱点只作随机基础弱点依赖。',
  cardRanges: [{ from: '10019', to: '10138' }],
  basicWeaknessCodes: [...FHV_PLAYER_BASIC_WEAKNESS_CODES],
  cards: playerCards.map(card => ({
    code: card.code,
    name: card.nameZh || card.name,
    type: 'player',
    cataloged: true,
    imageAvailable: !!card.imagesrc,
    rulesImplemented: fhvPlayerCardVerified(card.code),
    deckbuilding: fhvPlayerBuildable(card.code),
    ...(basicWeaknessCodes.has(card.code) || dependencyCodes.has(card.code) ? { dependencyOnly: true } : {}),
    ...(researchedCodes.has(card.code) ? { researchGated: true } : {}),
  })),
  encounterGroupIds: [],
  behaviorIds: [...FHV_PLAYER_VERIFIED_CODES].map(code => `fhvPlayerCard${code}`),
  docs: ['docs/campaign/theFeastOfHemlockVale/player-cards.md'],
}
