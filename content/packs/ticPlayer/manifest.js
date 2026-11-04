// 印斯茅斯暗潮 · 玩家卡包（P8 生产：playable）。
//
// 93 条玩家包印刷记录 = 90 张可入牌组卡（asset/event/skill）+ 3 张基础弱点
// （07038/07039/07040）。逐卡验收账本 audit/tic-player-acceptance.json：
// total 93 / verified 93 / missing 0 / buildable 90 / dependencyOnly 3。
//
// 旗标口径：rulesImplemented 全部 true（93 条均已逐卡验收）；deckbuilding 只给
// 可构筑的 90 张；3 张基础弱点 deckbuilding=false + dependencyOnly=true
// （只会由引擎的基础弱点流程发放，不作为构筑卡购买/替换）。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CARD_PARTITIONS } from '../../campaigns/theInnsmouthConspiracy/shared.js'
import {
  TIC_PLAYER_VERIFIED_CODES, TIC_PLAYER_BUILDABLE_CODES, TIC_PLAYER_BASIC_WEAKNESS_CODES,
  ticPlayerCardVerified,
} from '../../../src/cards/tic-player-acceptance.js'

// 兼容导出：src/deck/availability.js 与审计工具按这些名字读取玩家包事实源。
export { TIC_PLAYER_VERIFIED_CODES, TIC_PLAYER_BUILDABLE_CODES, TIC_PLAYER_BASIC_WEAKNESS_CODES, ticPlayerCardVerified }

export const PLAYER_CARD_CODES = Object.freeze([...CARD_PARTITIONS.ticPlayer])
const buildableCodes = new Set(TIC_PLAYER_BUILDABLE_CODES)
const basicWeaknessCodes = new Set(TIC_PLAYER_BASIC_WEAKNESS_CODES)

// 连续卡号区间（只用于主卡号；本包没有 a/b 关联面）。
function contiguousRanges(codes) {
  const sorted = [...codes].sort()
  const ranges = []
  for (const code of sorted) {
    const last = ranges.at(-1)
    if (last && Number(code) === Number(last.to) + 1) last.to = code
    else ranges.push({ from: code, to: code })
  }
  return ranges
}

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'ticPlayer',
  name: '印斯茅斯暗潮 · 玩家卡',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  dependencies: ['core'],
  description: 'P6 验收的 93 条玩家包记录：90 张可入牌组卡 + 3 张基础弱点（只作依赖）。逐卡账本 verified 93 / missing 0。',
  cardRanges: contiguousRanges(PLAYER_CARD_CODES),
  basicWeaknessCodes: [...TIC_PLAYER_BASIC_WEAKNESS_CODES],
  cards: PLAYER_CARD_CODES.map(code => {
    const card = ALL_CARDS[code]
    const buildable = buildableCodes.has(code)
    return {
      code,
      name: card.nameZh || card.name,
      type: 'player',
      cataloged: true,
      imageAvailable: !!card.imagesrc,
      rulesImplemented: ticPlayerCardVerified(code) || basicWeaknessCodes.has(code),
      deckbuilding: buildable,
      ...(buildable ? {} : { dependencyOnly: true }),
    }
  }),
  encounterGroupIds: [],
  behaviorIds: TIC_PLAYER_VERIFIED_CODES.map(code => `ticPlayerCard${code}`),
}
