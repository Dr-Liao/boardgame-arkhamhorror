// 03149 查尔斯·罗斯大人
// 卡面：你可以花费资源来支付你所在地点的其他调查员打出的[[道具]]支援。
// 卡面：[free]横置查尔斯·罗斯大人：下一张你所在地点的调查员打出的[[道具]]支援的费用减少1点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03149 查尔斯·罗斯大人：横置，本地点下一件物品费用 -1。

export default {
  code: '03149',
  charlesRoss: true,
  abilities: [
    {
      kind: 'action', label: '横置：本地点下一件物品费用 -1', cost: { action: false, exhaust: true },
      resolve: ({ inv, source, api }) => {
        api.setLocationItemDiscount(inv.seat, source, 1)
      },
    },
  ],
  modifiers: [

  ],
}
