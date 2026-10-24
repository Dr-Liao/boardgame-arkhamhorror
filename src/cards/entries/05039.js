// 05039 星币五
// 卡面：你得到+1生命值和+1神智值。
// 卡面：[reaction]在游戏开始时，如果星币五在你起始手牌中：将其放置入场。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05039 星币五：塔罗槽支援；生命上限 +1、神智上限 +1（读点是 assetEffect 的 passive
// healthBonus/sanityBonus，与 03143/03269 同一条被动数据通道）；开局起始手牌中放置入场。

export default {
  code: '05039',
  entersPlayFromOpeningHand: true,
  passive: {
    healthBonus: 1,
    sanityBonus: 1,
  },
  abilities: [
    {
      kind: 'reaction', trigger: 'scenarioStarts', label: '游戏开始时放置入场',
      fromHand: true, noPlayCost: true,
      resolve: ({ inv, api }) => {
        if (!inv.hand.includes('05039')) return
        api.putIntoPlay(inv.seat, '05039')
      },
    },
  ],
  modifiers: [

  ],
}
