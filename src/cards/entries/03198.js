// 03198 拉布兰奇夫人
// 卡面：[free]如果你没有手牌，横置拉布兰奇夫人：抽取1张卡牌。
// 卡面：[free]如果你没有资源，横置拉布兰奇夫人：获得1资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03198 夫人：横置时，空手抽 1 张 / 无资源获得 1 资源。

export default {
  code: '03198',
  abilities: [
    {
      kind: 'free', label: '空手时抽 1 张牌', cost: { action: false, exhaust: true },
      resolve: ({ inv, api }) => { if (!inv.hand.length) api.drawCards(inv.seat, 1) },
    },
    {
      kind: 'free', label: '无资源时获得 1 资源', cost: { action: false, exhaust: true },
      resolve: ({ inv, api }) => { if (!inv.resources) api.gainResources(inv.seat, 1) },
    },
  ],
  modifiers: [

  ],
}
