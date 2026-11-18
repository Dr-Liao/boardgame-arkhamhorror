// 10655 破碎记忆 Shattered Memories · 幕（1a）（fateOfTheVale · 山谷的命运 P7）
// 归属：关卡专用 · theFeastOfHemlockVale/fateOfTheVale（遭遇组 fate_of_the_vale）。
// 卡面：[reaction] 你在自己回合于[[巢穴]]地点检定成功后：按超过难度点数从深渊底部揭示，抽 1 张、其余放到深渊顶部。[fast] 花费 1 线索：本次检定 +2。目标 - 每位玩家都拿到自己「真正的」调查员卡时推进。
//
// 一张卡一个文件：条目只声明身份与规则数据（flags），行为接线在章节 behavior：
//   · flags.lairReaction → behavior.afterTest / revealFromAbyssReaction
//   · flags.backEffect = 'exNihilo' → behavior.actReveal / act1Back
//   · 目标 trueSelves 由 definition 的 objective 与 behavior.objectiveStatus 读取
// 背面「Ex Nihilo」：地点补线索、划掉蕾切尔嬷嬷、把被划掉的居民与洞穴洗入深渊、可选控制关系 ≥4 的居民。
export default {
  code: '10655',
  scope: 'act',
  implemented: true,
  flags: {
    lairReaction: {
      trait: 'Lair',
      mode: 'revealBottomThenDrawOne',
    },
    backEffect: 'exNihilo',
  },
  note: 'approximation: [reaction] 在 behavior.afterTest 里自动结算（引擎没有条目级反应窗口）；[fast] 花费 1 线索 +2 没有免费触发读点，未接线（披露）。',
  abilities: [],
}
