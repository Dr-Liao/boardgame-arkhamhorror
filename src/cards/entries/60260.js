// 60260 大学档案员（University Archivist）
// 卡面：你拥有额外 1 个手部槽位，只可携带[[书籍]]支援。
// [reaction] 大学档案员入场后：查找牌库顶 6 张中的一张[[书籍]]支援加入手牌，洗回牌库。
// 读点：restrictedSlots（assets.js occupiedSlots 唯一读点）；reaction trigger assetEnteredPlay + api.searchTop trait。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60260',
  restrictedSlots: [{ slot: 'hand', traitsAny: ['Tome'], count: 1 }],
  abilities: [{
    kind: 'reaction',
    trigger: 'assetEnteredPlay',
    label: '入场后：查找牌库顶 6 张中的一张[[书籍]]加入手牌',
    criteria: [({ inv, context }) => context?.seat === inv.seat && context?.assetCode === '60260'],
    resolve: ({ inv, api }) => api.searchTop(inv.seat, {
      amount: 6, trait: 'Tome', choose: 1, source: '60260',
      prompt: '查找牌库顶 6 张，选择 1 张[[书籍]]支援加入手牌。',
    }),
  }],
  modifiers: [],
}
