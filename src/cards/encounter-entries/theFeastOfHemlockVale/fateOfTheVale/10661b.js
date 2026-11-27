// 10661b 旧时记忆 Old Memory · 剧情资产（fateOfTheVale · 山谷的命运 P7）
// 归属：关卡专用 · theFeastOfHemlockVale/fateOfTheVale（遭遇组 fate_of_the_vale）。
// 卡面：[reaction] 当一张卡牌从深渊被揭示或抽取时：共同花费 1/人 线索，并将旧时记忆移出游戏——选择一位调查员抽取该卡牌；或取消该卡牌的显现效果并将其移出游戏。
//
// 一张卡一个文件：条目只声明身份与规则数据（flags），行为接线在章节 behavior：
//   · flags.oldMemory / trueSelfCode → behavior.returnToTrueSelf（真身回归时入场）
//   · 从深渊揭示或抽取前，章节读取共同线索费用，结算改派调查员或取消显现并移出游戏。
export default {
  code: '10661b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    oldMemory: true,
    trueSelfCode: '10661',
    groupClueCost: {
      perInvestigator: 1,
    },
  },
  abilities: [],
}
