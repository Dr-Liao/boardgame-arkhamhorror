// 08016 鲍勃·詹金斯（Bob Jenkins，地球边缘调查员）
//
// 卡面：
//   任何时刻，你所在地点的调查员可以向你揭示其手中的 [[道具]] 支援。
//   你可以在自己回合期间执行 1 个额外行动，该行动只能用于打出你所在地点一位调查员手中的
//   一张 [[道具]] 支援，打出后置于该调查员控制下（双方都可以为支付其费用花费资源）。
//   [elder_sign]：你每控制一张 [[道具]] 支援，+1。
//
// 读点（P2/P4 原语）：
//   · 揭示并授权：`api.interactions.crossSeat.grant` + play-channels 的 otherHand 通道，
//     只有授权后队友手牌中的 [[道具]] 支援才会出现在合法行动里（卡号由服务端枚举，不进公开标签）；
//   · 额外行动：`investigator.restrictedAction = { kind: 'itemPlay' }`——引擎在回合开始自动
//     发放「只能用于代打队友 [[道具]]」的受限行动（restricted-actions.js 的通用原语）；
//   · 归牌主控制 + 双方付费：由 `state._playedFromOtherHand` 上下文在 doPlay 结算（P5 引擎补全）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
import { ALL_CARDS } from '../../cards/cards-data.js'

const isItemAsset = code => {
  const def = ALL_CARDS[code]
  return Boolean(def) && def.type === 'asset'
    && (def.traits || []).some(trait => String(trait).toLowerCase() === 'item')
}
const itemCodesIn = inv => [...new Set((inv?.hand || []).filter(isItemAsset))]

export default {
  code: '08016', kind: 'investigator',
  // 「任何时刻……可以揭示」的授权交互；额外行动通过受限行动原语在回合开始发放。
  investigator: { restrictedAction: { kind: 'itemPlay' } },
  elderSign: { label: '旧印：每控制 1 张 [[道具]] 支援 +1', resolve: ({ inv }) => ({
    delta: (inv.assets || []).filter(asset => isItemAsset(asset.code)).length,
  }) },
  abilities: [
    { kind: 'free', label: '揭示同地点队友手中的道具并授权代打',
      criteria: ({ inv, state }) => state.phase === 'investigation' && state.currentSeat === inv.seat && !inv.turnEnded
        && (state.investigators || []).some(other => other !== inv && !other.defeated && !other.resigned
          && other.location === inv.location && itemCodesIn(other).length > 0),
      resolve: ({ inv, state, api }) => {
        const allies = state.investigators.filter(other => other !== inv && !other.defeated && !other.resigned
          && other.location === inv.location && itemCodesIn(other).length > 0)
        if (!allies.length) return
        const seat = allies.length === 1 ? allies[0].seat
          : Number(api.choice({ kind: 'investigator', source: '08016', seat: inv.seat,
            prompt: '选择向你揭示手中 [[道具]] 支援的调查员。',
            options: allies.map(other => ({ id: String(other.seat), label: other.name })) }))
        const owner = state.investigators[seat]
        if (!owner || owner === inv) return
        const codes = itemCodesIn(owner)
        if (!codes.length) return
        api.interactions.crossSeat.grant(inv.seat, { fromSeat: owner.seat, codes })
      } },
  ],
  modifiers: [],
}
