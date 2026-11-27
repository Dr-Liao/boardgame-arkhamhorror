// 10656 失落自我 Lost Self · 幕（2a）（fateOfTheVale · 山谷的命运 P7）
// 归属：关卡专用 · theFeastOfHemlockVale/fateOfTheVale（遭遇组 fate_of_the_vale）。
// 卡面：[reaction] 你在自己回合于[[巢穴]]地点检定成功后：按超过难度点数从深渊底部揭示，抽 1 张、其余放到深渊顶部。[fast] 花费 1 线索：本次检定 +2。目标 - 一轮结束时，若场上有 3 个或更多已揭示且没有线索的[[洞穴]]地点，推进。
//
// 一张卡一个文件：条目只声明身份与规则数据（flags），行为接线在章节 behavior：
//   · flags.lairReaction → behavior.afterTest / revealFromAbyssReaction
//   · flags.interlude → behavior.act2Back / resolveInterlude（命运的选择四选项）
//   · 目标 caves ≥3 由 definition 的 objective 与 behavior.objectiveStatus / roundEnded 读取
export default {
  code: '10656',
  scope: 'act',
  implemented: true,
  flags: {
    lairReaction: {
      trait: 'Lair',
      mode: 'revealBottomThenDrawOne',
    },
    interlude: 'fateOfTheVale',
  },
  note: '洞穴目标和四项幕间分支由章节结算。',
  abilities: [{
    kind: 'free',
    actionKind: 'activate',
    range: 'anywhere',
    trigger: ['test.beforeCommit', 'test.afterCommit'],
    label: '花费 1 个线索：本次技能检定得到 +2 技能值',
    cost: { action: false, clues: 1 },
    duringOwnSkillTest: true,
    resolve: ({ api }) => api.addTestPendingBonus(2),
  }],
}
