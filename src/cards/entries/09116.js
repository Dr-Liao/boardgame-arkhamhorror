// 09116 修旧利废（Salvage）· 幸存者事件 · 2 经验
// 卡面：选择你弃牌堆的一个[[道具]]支援。选择一项：
//       · 将该支援从游戏中移除，并获得等于其费用的资源。
//       · 打出该支援（支付其费用）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 候选：inv.discard 里 cards-data type==='asset' 且带 [[Item]] 特性的卡（只读）；
//   · 移出游戏：api.takeDiscardCard（把牌移出弃牌堆）+ api.exileCard（放逐记账）；
//   · 打出：api.playCardFromDiscard（真实 doPlay 管线，支付印刷费用；exileAfter:false 阻止「结算后移出」）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const code = '09116'

const isItemAsset = cardCode => {
  const def = ALL_CARDS[cardCode]
  return def?.type === 'asset' && (def.traits || []).some(trait => String(trait).toLowerCase() === 'item')
}

export default {
  code,
  abilities: [
    {
      kind: 'played',
      label: '选择一个弃牌堆的[[道具]]支援：移出游戏换资源，或支付费用打出',
      resolve: ({ inv, api }) => {
        const candidates = [...new Set((inv.discard || []).filter(isItemAsset))]
        if (!candidates.length) { api.info('「修旧利废」：弃牌堆里没有[[道具]]支援。'); return }
        const chosen = candidates.length === 1 ? candidates[0] : api.choice({
          kind: 'card', source: code, seat: inv.seat,
          prompt: '「修旧利废」：选择弃牌堆中的一个[[道具]]支援。',
          options: candidates.map(cardCode => ({ id: cardCode, cardCode, label: api.cardName(cardCode) })),
        })
        if (!chosen) return
        const printedCost = Math.max(0, Number(ALL_CARDS[chosen]?.cost) || 0)
        const actualCost = api.playCost(inv.seat, chosen)
        const canPlay = (inv.resources || 0) >= actualCost
        const options = [{ id: 'remove', label: `将该支援移出游戏，获得 ${printedCost} 资源` }]
        if (canPlay) options.push({ id: 'play', label: `支付 ${actualCost} 资源打出该支援` })
        const choice = options.length === 1 ? options[0].id : api.choice({
          kind: 'effect', source: code, seat: inv.seat,
          prompt: `「修旧利废」：${api.cardName(chosen)} 要如何处理？`, options,
        })
        if (choice === 'remove') {
          api.takeDiscardCard(inv.seat, chosen)
          api.exileCard(chosen, { seat: inv.seat })
          api.gainResources(inv.seat, printedCost)
          api.info(`♻️ 「修旧利废」：${api.cardName(chosen)} 被移出游戏，${inv.name} 获得 ${printedCost} 资源。`)
          return
        }
        if (api.playCardFromDiscard(inv.seat, chosen, { exileAfter: false })) {
          api.info(`♻️ 「修旧利废」：${inv.name} 支付 ${actualCost} 资源打出弃牌堆的「${api.cardName(chosen)}」。`)
        } else {
          api.info(`「修旧利废」：无法打出「${api.cardName(chosen)}」。`)
        }
      },
    },
  ],
  modifiers: [],
}
