// 10672 升华 Sublimation · 诡计（fateOfTheVale · 山谷的命运 P7）
// 归属：关卡专用 · theFeastOfHemlockVale/fateOfTheVale（遭遇组 fate_of_the_vale）。
// 卡面：显现 - 检定[意志](4)。若失败，你必须决定（选择一项）：按失败点数把手牌放到深渊顶；或最近的宇宙密使攻击你（即使它不在你所在地点）。
//
// 一张卡一个文件：条目只声明身份与规则数据（flags），行为接线在章节 behavior：
//   · flags.test → behavior 的 fateOfTheValeSublimation 处理器（技能/难度）
//   · encounterResolve → api.resolveScenarioEvent('fateOfTheValeSublimation') → behavior.events.fateOfTheValeSublimation
export default {
  code: '10672',
  scope: 'treachery',
  implemented: true,
  flags: {
    test: {
      skill: 'willpower',
      difficulty: 4,
    },
  },
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('fateOfTheValeSublimation', { seat: inv.seat }) === true
  },
  note: 'approximation: 失败点数用 api.test 回传的 difficulty - value 计算（下限 1）；「最近的密使」按 behavior.nearestEmissaryTo（同地点优先，否则取第一个）；二选用 api.choose。',
}
