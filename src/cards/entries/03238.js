// 03238 不期而遇
// 卡面：选择任意玩家弃牌堆中的一个印刷资源费用为X的[[盟友]]支援。将该支援放置入场，放到你的控制之下。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03238 幸运邂逅：从弃牌堆把一名盟友放进场。

export default {
  code: '03238',
  abilities: [
    {
      kind: 'played', id: 'chanceEncounter2', label: '从弃牌堆招募一名盟友',
      resolve: ({ inv, api }) => { api.recruitAllyFromDiscard(inv.seat, '03238') },
    },
  ],
  modifiers: [

  ],
}
