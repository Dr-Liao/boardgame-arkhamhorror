// 02265 乔伊“老鼠”弗吉尔
// 卡面：[free]花费1资源：选择你手中的一个[[道具]]支援并将其打出(支付其费用)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02265',
  abilities: [
    {
      kind: 'action',
      label: '从手牌打出一件物品',
      cost: { action: false, resources: 1 },
      resolve: ({ inv, api }) => {
        const items = inv.hand.map((code, index) => ({ code, index }))
          .filter(item => api.cardTraits(item.code).some(trait => String(trait).toLowerCase() === 'item'))
        if (!items.length) return
        const chosen = items.length === 1 ? items[0] : items.find(item => String(item.index) === api.choice({
          kind: 'card', seat: inv.seat, prompt: '选择要打出的道具支援（支付其费用）。',
          options: items.map(item => ({ id: String(item.index), cardCode: item.code, label: api.cardName(item.code) })),
        }))
        if (chosen) api.playCard(inv.seat, chosen.code)
      },
    },
  ],
  modifiers: [

  ],
}
