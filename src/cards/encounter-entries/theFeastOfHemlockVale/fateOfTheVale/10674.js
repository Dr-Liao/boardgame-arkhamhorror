// 10674 狂喜 Euphoria · 诡计（fateOfTheVale · 山谷的命运 P7）
// 归属：关卡专用 · theFeastOfHemlockVale/fateOfTheVale（遭遇组 fate_of_the_vale）。
// 卡面：显现 - 检定[智识](4)。你必须要么承受 2 点恐惧，要么把你控制的一个非剧情支援放到深渊顶。若失败，两者都做。
//
// 一张卡一个文件：条目只声明身份与规则数据（flags），行为接线在章节 behavior：
//   · flags.test → behavior 的 fateOfTheValeEuphoria 处理器（技能/难度）
//   · encounterResolve → api.resolveScenarioEvent('fateOfTheValeEuphoria') → behavior.events.fateOfTheValeEuphoria
export default {
  code: '10674',
  scope: 'treachery',
  implemented: true,
  flags: {
    test: {
      skill: 'intellect',
      difficulty: 4,
    },
  },
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('fateOfTheValeEuphoria', { seat: inv.seat }) === true
  },
  note: 'approximation: 成功的「二选一」用 api.choose 询问；失败时两个效果都结算（放支援取支援区第一张非剧情支援）。',
}
