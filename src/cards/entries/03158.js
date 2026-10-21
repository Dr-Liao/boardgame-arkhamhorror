// 03158 施恩求报
// 卡面：选择一张你控制的[[盟友]]支援并将其返回你的手牌。然后，查找你牌库顶9张卡牌，找出1张[[盟友]]支援并将其打出，其费用减少X点。X为返回你手牌的[[盟友]]支援的费用。混洗你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03158 求助盟友：把一个盟友拿回手牌，再从牌库顶 9 张找一张盟友（费用按返回那张减免）。

export default {
  code: '03158',
  abilities: [
    {
      kind: 'played', label: '把盟友返回手牌，再从牌库顶 9 张免费打出 1 张盟友',
      resolve: ({ inv, api }) => {
        const allies = inv.assets.filter(card => api.cardTraits(card.code).includes('ally'))
        if (!allies.length) return
        const chosenId = allies.length === 1 ? allies[0].id : api.choice({ kind: 'target', source: '03158',
          seat: inv.seat, prompt: '选择返回手牌的盟友。',
          options: allies.map(card => ({ id: card.id, cardCode: card.code, label: api.cardName(card.code) })) })
        const ally = allies.find(card => card.id === chosenId)
        if (!ally) return
        const discount = api.cardCost(ally.code)
        api.returnAssetToHand(inv.seat, ally)
        const before = inv.hand.length
        api.searchTop(inv.seat, { amount: 9, trait: 'Ally', source: '03158' })
        if (inv.hand.length > before) {
          api.playCard(inv.seat, inv.hand.at(-1), { discount, noAction: true })
        }
      },
    },
  ],
  modifiers: [

  ],
}
