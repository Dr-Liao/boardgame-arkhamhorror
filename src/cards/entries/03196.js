// 03196 量子通量
// 卡面：将你的弃牌堆洗入你的牌库并抽取1张卡牌。将量子通量从游戏中移除。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03196 量子通量：把弃牌堆洗回牌库，然后抽 1 张（打出后移出游戏）。

export default {
  code: '03196',
  removeAfterPlay: true,
  abilities: [
    {
      kind: 'played', label: '量子通量',
      resolve: ({ inv, api }) => {
        api.shuffleDiscardIntoDeck(inv.seat)
        api.drawCards(inv.seat, 1)
      },
    },
  ],
  modifiers: [

  ],
}
