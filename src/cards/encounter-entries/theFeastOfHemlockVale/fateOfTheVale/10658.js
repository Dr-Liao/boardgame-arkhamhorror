// 10658 山谷的命运（版本二） Fate of the Vale (v.II) · 幕（3a）（fateOfTheVale · 山谷的命运 P7）
// 归属：关卡专用 · theFeastOfHemlockVale/fateOfTheVale（遭遇组 fate_of_the_vale）。
// 卡面：[action] 选择并弃掉 1 张手牌：谈判。检定[意志]或[智识](3)。成功则把你地点底下敌人面朝上的[[居民]]卡抽走；可花费 1/人 线索使其以横置状态入场。目标 - 若地点底下与场上都没有[[居民]]敌人，可共同支付 3/人 线索推进。
//
// 一张卡一个文件：条目只声明身份与规则数据（flags），行为接线在章节 behavior：
//   · flags.parley → behavior.actions / performAction（fateResidentParley 读难度与弃牌数）
//   · flags.back = 'resolution3' → behavior.actReveal / resolutionOf
// 背面「To the Lighthouse!」→ 结局 3。
export default {
  code: '10658',
  scope: 'act',
  implemented: true,
  flags: {
    parley: {
      discardFromHand: 1,
      skills: ['willpower', 'intellect'],
      difficulty: 3,
      clueCostPerInvestigator: 1,
    },
    back: 'resolution3',
  },
  note: '近似：谈判成功用 behavior.residentParley（api.test）；「可花费 1/人 线索使其横置入场」简化为谈判成功即横置入场。',
  abilities: [],
}
