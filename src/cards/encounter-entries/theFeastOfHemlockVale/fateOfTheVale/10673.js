// 10673 碎裂 Fragmentation · 诡计（fateOfTheVale · 山谷的命运 P7）
// 归属：关卡专用 · theFeastOfHemlockVale/fateOfTheVale（遭遇组 fate_of_the_vale）。
// 卡面：显现 - 检定[敏捷](4)。若失败，你必须决定（选择一项）：选择你场上印刷费用最高的支援放到深渊顶；或最近的宇宙密使攻击你（即使它不在你所在地点）。
//
// 一张卡一个文件：条目只声明身份与规则数据（flags），行为接线在章节 behavior：
//   · flags.test → behavior 的 fateOfTheValeFragmentation 处理器（技能/难度）
//   · encounterResolve → api.resolveScenarioEvent('fateOfTheValeFragmentation') → behavior.events.fateOfTheValeFragmentation
export default {
  code: '10673',
  scope: 'treachery',
  implemented: true,
  flags: {
    test: {
      skill: 'agility',
      difficulty: 4,
    },
  },
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('fateOfTheValeFragmentation', { seat: inv.seat }) === true
  },
  note: 'approximation: 「印刷费用最高」按 cards-data 的 cost 排序取第一张；并列时取支援区顺序靠前者；二选用 api.choose。',
}
