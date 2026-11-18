// 10657 山谷的命运（版本一） Fate of the Vale (v.I) · 幕（3a）（fateOfTheVale · 山谷的命运 P7）
// 归属：关卡专用 · theFeastOfHemlockVale/fateOfTheVale（遭遇组 fate_of_the_vale）。
// 卡面：[reaction] 于[[巢穴]]检定成功：按超过难度点数从深渊底部揭示，抽取其中所有单面敌人卡，其余移出游戏。[fast] 花费 1 线索：+2。目标 - 轮末，若每位幸存调查员都在深渊，可共同支付 2/人 线索推进。
//
// 一张卡一个文件：条目只声明身份与规则数据（flags），行为接线在章节 behavior：
//   · flags.back → behavior.resolutionOf（choices + 棱柱碎片条件 → 结局 1/2）
//   · 目标 abyssClues 由 definition 的 objective 与 behavior.objectiveStatus 读取
// 背面「Ad Nihilum」：让马奎兹博士执行她的计划（→R1）／自己动手（→R2，需控制棱柱碎片剧情支援）。
export default {
  code: '10657',
  scope: 'act',
  implemented: true,
  flags: {
    back: {
      choices: ['resolution1', 'resolution2'],
      requiresPrismaticShard: '10522',
    },
  },
  note: '近似：v.I 的 [reaction]（抽走单面敌人、其余移出游戏）由 behavior.afterTest 的深渊揭示结算；「自己动手」条件读引擎既有支援区（棱柱碎片 10522）。',
  abilities: [],
}
