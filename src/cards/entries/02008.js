// 02008 寻找真相
// 卡面：雷克斯·墨菲牌库专用。
// 卡面：抽取X张卡牌，其中X为雷克斯·墨菲的线索数(最多为5)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02008 寻找真相：你每有 1 个线索，抽 1 张牌（最多 5 张）。

export default {
  code: '02008',
  abilities: [
    {
      kind: 'played', label: '按线索数抽牌（最多 5 张）',
      resolve: ({ api, inv }) => {
        const amount = Math.min(5, inv.clues || 0)
        if (amount > 0) api.drawCardsLogged(inv.seat, amount)
      },
    },
  ],
  modifiers: [

  ],
}
