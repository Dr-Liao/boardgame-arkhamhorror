// 卡牌范围（开局「游戏高级设置」的 cardPoolScope）· 服务端过滤层。
//
// 规则本身在 web/deck-rules.js（浏览器与服务器共用）：
//   all         全部：不限制卡牌来源；
//   progressive 渐进式：只允许当前循环及更早循环的卡牌。
// 本模块只负责把「一局的状态 / 建局参数」翻译成过滤上下文，并给卡号或卡定义做过滤。
// 传入 null 语境表示不限制（默认值、未知战役、旧存档都落在这一支）。
import { cardAllowedByScope, campaignCycle, normalizeCardPoolScope } from '../../web/deck-rules.js'

export {
  CARD_POOL_SCOPES, CARD_POOL_SCOPE_LABELS, CAMPAIGN_CYCLES, campaignCycle, cardCycle,
  cardAllowedByScope, normalizeCardPoolScope,
} from '../../web/deck-rules.js'

// 接受 createGameState 的 state、settings、或 { scope, campaignId } 形状。
// 未知循环（新战役尚未登记）不做限制：宁可放开，也不让渐进式静默少给卡。
export function cardPoolContext(source = null, campaignId = null) {
  if (!source) return null
  const scope = normalizeCardPoolScope(source.cardPoolScope ?? source.scope)
  const campaign = campaignId ?? source.campaign?.id ?? source.campaignId ?? null
  const cycle = campaignCycle(campaign)
  if (scope !== 'progressive' || !cycle) return null
  return { scope, campaignId: campaign, cycle }
}

export function allowsCard(code, context) {
  return !context || cardAllowedByScope(code, context.scope, context.cycle)
}

export function filterCardCodes(codes, context) {
  return !context ? [...codes] : codes.filter(code => allowsCard(code, context))
}

export function filterCardDefs(cards, context) {
  return !context ? [...cards] : cards.filter(card => allowsCard(card?.code, context))
}
