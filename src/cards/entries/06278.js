// 06278 惊喜的发现
// 卡面：多重。
//       [reaction]在你查找牌库，并且查找过的卡牌中有惊喜的发现时：将其放置入场，放到你的游戏区域。
//       在你执行的能够投入该卡牌的下一次技能检定中，你必须投入该卡牌。如果该技能检定成功，抽取1张卡牌。
//       (每次查找最多使用1次[[研究]]能力。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06278 惊喜的发现（技能卡，多重）：被「查找牌库」翻到时结算的效果由条目级 searchedCardRule 声明
// （读点 src/engine/deck-ops.js 的 searchedCardsWindow——牌还在牌库里时能力源枚举看不到它）。
// 查找命中后转入游戏区；commitFromPlay 使下一次可投入的本人检定强制投入。
// 投入来源通道标记用于限定成功后的抽牌奖励。

export default {
  code: '06278',
  commitFromPlay: true,
  searchedCardRule: {
    mode: 'reaction',
    condition: ({ inv, owner }) => Boolean(inv && owner && inv.seat === owner.seat),
    label: '查找牌库找到「惊喜的发现」：将其放入游戏区域',
    resolve: ({ inv, api, search }) => {
      search.take()
      api.moveCard({ code: '06278', from: 'hand', to: 'play', ownerSeat: inv.seat })
    },
  },
  abilities: [{
    kind: 'commit',
    label: '从游戏区域强制投入下一次符合条件的检定',
    skill: {
      afterTest: ({ inv, source, result, api }) => {
        if (source?.sourceChannel === 'playCommit' && result?.success) api.drawCards(inv.seat, 1)
      },
    },
  }],
  modifiers: [],
}
