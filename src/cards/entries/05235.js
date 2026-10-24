// 05235 蠕虫的秘密（神秘学家 · 2 经验 · 独特）
// 卡面：[action]横置蠕虫的秘密并在其上放置1个毁灭标记：从你的弃牌堆打出一张[[法术]]或[[洞察]]事件，
//       其资源费用减少1点。该事件结算后，将其从游戏中移除。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05235 蠕虫的秘密：[行动]横置 + 放 1 毁灭：从弃牌堆免费-1 费打出 1 张[[法术]]/[[洞察]]事件，之后移出游戏。
//
// 实现备注：
//   · 费用降低用 api.playCard 的折扣读数（playCost 会扣掉折扣）。
//   · 引擎的「从弃牌堆打出」通道只覆盖弃牌堆顶/标记 playableFromDiscard 的卡，因此先把选中的事件
//     移动到手里再按普通事件打出（对「费用 -1、结算后移出游戏」的净效果一致；差异是被打出的牌在
//     结算期间位于手牌区）。结算后事件进弃牌堆，再从弃牌堆移出游戏。

const isSpellOrInsightEvent = (api, code) => {
  if (api.cardType(code) !== 'event') return false
  const traits = api.cardTraits(code) || []
  return traits.some(trait => ['spell', 'insight'].includes(String(trait).toLowerCase()))
}

export default {
  code: '05235',
  abilities: [
    {
      kind: 'action',
      label: '横置并放 1 毁灭：从弃牌堆打出 1 张法术/洞察事件（费用 -1），之后移出游戏',
      cost: { exhaust: true },
      resolve: ({ state, inv, api, source }) => {
        const candidates = [...new Set((inv.discard || []).filter(code => isSpellOrInsightEvent(api, code)))]
          .filter(code => api.playCostOf(inv.seat, code) - 1 <= (inv.resources || 0))
        if (!candidates.length) {
          api.info('弃牌堆里没有可支付的法术/洞察事件（或资源不足）。')
          return
        }
        const chosen = candidates.length === 1 ? candidates[0] : api.choice({
          kind: 'card', source: '05235', seat: inv.seat,
          prompt: '选择要从弃牌堆打出的[[法术]]或[[洞察]]事件（费用 -1）。',
          options: candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
        })
        const code = candidates.includes(chosen) ? chosen : candidates[0]
        // 额外费用：横置（engine 已付）+ 在这张支援上放 1 毁灭。
        api.placeDoomOnCard(source, 1)
        api.info(`🌑 「蠕虫的秘密」放置 1 毁灭（当前 ${source.doom || 0}）。`)
        // 引擎的从弃牌堆打出通道只认弃牌堆顶/playableFromDiscard；先移入手中再打出。
        api.moveCard({ code, from: 'discard', to: 'hand' })
        api.playCard(inv.seat, code, { discount: 1 })
        // 事件结算后移出游戏（doPlay 会先把它放回弃牌堆）。
        api.exileFromDiscard(inv.seat, code)
        api.info(`🗑️ 「${api.cardName(code)}」结算后被移出游戏。`)
      },
    },
  ],
}
