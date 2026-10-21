// 01073 拾荒
// 卡面：[reaction]在你成功调查，且超过难度至少2点后，横置拾荒：在你的弃牌堆中选择一张[[道具]]卡牌，将其加入你的手中。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01073 拾荒：调查成功超出 2 点时横置，从弃牌堆检索 1 张物品。

export default {
  code: '01073',
  abilities: [
    {
      kind: 'reaction', trigger: 'investigateSuccess', id: 'scavenging', legacyReaction: true,
      criteria: { successByAtLeast: 2 }, label: '调查成功超出 2 点时检索物品',
      cost: { exhaust: true }, effect: { type: 'searchDiscard', trait: 'Item', choose: 1 },
    },
  ],
  modifiers: [

  ],
}
