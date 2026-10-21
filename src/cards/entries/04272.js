// 04272 将就一下
// 卡面：你可以从你的弃牌堆中打出将就一下。如果你这么做，结算效果后将其洗入你的牌库。
// 卡面：调查。本次调查你所在地点隐藏值-1。(如果你从弃牌堆中打出了将就一下，并且调查成功，发现额外1个线索。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04272 应急处理：调查（帷幕 -1）；从弃牌堆打出时 +1 线索，然后洗回牌库。

export default {
  code: '04272',
  playableFromDiscard: true,
  shuffleBackAfterPlay: true,
  abilities: [
    {
      kind: 'played', label: '应急处理',
      resolve: ({ inv, api }) => {
        const fromDiscard = api.fromDiscardCode() === '04272'
        api.investigate(inv.seat, { shroudMod: -1, clueBonus: fromDiscard ? 1 : 0 })
      },
    },
  ],
  modifiers: [

  ],
}
