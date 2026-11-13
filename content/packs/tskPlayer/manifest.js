// 绯红密钥 · 一般玩家卡包（P6 生产：playable）。
//
// 内容：tskp 里除 6 位调查员与 14 张专属依赖之外的 108 条记录（09021–09128，含 16 张
// 定制升级卡与 5 张基础弱点 09124–09128）。逐卡 rulesImplemented/deckbuilding 来自
// tools/audit-tsk-player.mjs 的生成物（src/cards/tsk-player-acceptance.js），这里不手写实现清单。
// 跨循环重印 canonical 映射见 audit/tsk-scope.json：只保留一份实现，本循环号走别名。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CARD_PARTITIONS } from '../../campaigns/theScarletKeys/shared.js'
import {
  TSK_PLAYER_ACCEPTANCE_PROFILE, TSK_PLAYER_BASIC_WEAKNESS_CODES,
  TSK_PLAYER_BUILDABLE_CODES, TSK_PLAYER_VERIFIED_CODES, tskPlayerBuildable, tskPlayerCardVerified,
} from '../../../src/cards/tsk-player-acceptance.js'

export const PLAYER_CARD_CODES = Object.freeze([...CARD_PARTITIONS.tskPlayer])
export {
  TSK_PLAYER_ACCEPTANCE_PROFILE, TSK_PLAYER_BASIC_WEAKNESS_CODES, TSK_PLAYER_BUILDABLE_CODES,
  TSK_PLAYER_VERIFIED_CODES, tskPlayerBuildable, tskPlayerCardVerified,
}

const basicWeaknessCodes = new Set(TSK_PLAYER_BASIC_WEAKNESS_CODES)
const playerCards = PLAYER_CARD_CODES.map(code => ALL_CARDS[code])

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'tskPlayer',
  name: '绯红密钥 · 玩家卡',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  dependencies: ['core'],
  description: 'P6 一般玩家卡 108 条记录（含 16 张定制升级卡与 5 张基础弱点）逐卡主要印刷效果验收；可构筑 103 张，09124–09128 只作基础弱点依赖。',
  cardRanges: [{ from: '09021', to: '09128' }],
  basicWeaknessCodes: [...TSK_PLAYER_BASIC_WEAKNESS_CODES],
  cards: playerCards.map(card => ({
    code: card.code,
    name: card.nameZh || card.name,
    type: 'player',
    cataloged: true,
    imageAvailable: !!card.imagesrc,
    rulesImplemented: tskPlayerCardVerified(card.code),
    deckbuilding: tskPlayerBuildable(card.code),
    ...(basicWeaknessCodes.has(card.code) ? { dependencyOnly: true } : {}),
  })),
  encounterGroupIds: [],
  behaviorIds: [...TSK_PLAYER_VERIFIED_CODES].map(code => `tskPlayerCard${code}`),
}
