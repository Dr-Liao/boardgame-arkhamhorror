// 02270 不期而遇
// 卡面：选择任意玩家弃牌堆的一个[[盟友]]支援。将该支援放置入场，放到你的控制之下。当一轮结束时，如果该支援仍在场上，将其弃掉。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02270',
  abilities: [
    { kind: 'played', label: '不期而遇', resolve: ({ inv, api }) => api.recruitTemporaryAllyFromDiscard(inv.seat, '02270') },
  ],
  modifiers: [

  ],
}
