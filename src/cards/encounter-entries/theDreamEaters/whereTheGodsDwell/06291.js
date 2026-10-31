// 06291 袍下之人（The Thing in the Robes，幕 2）
// 正面：[action] 如果调查员「靠近了祭司」，并且调查员「打晕了祭司」：击败不可描述的高阶祭司。
//       目标 - 如果不可描述的高阶祭司被击败，推进。
// 背面（A Foul Fate）：按击败方式阅读的剧情文本（无规则效果）。
//
// 行为位置：
//   · [action] 击败祭司 → actRule.defeatPriestAction 数据，章节 behavior.actions / performAction 读取执行
//     （条件读 scenarioFlags.maneuveredThePriestCloser / stunnedThePriest，击败走 api.banish 之前的
//     正常击败判定由引擎处理——本行动是「直接击败」，用 api.damageEnemy + api.banish 的组合表达见 behavior）；
//   · 目标（祭司被击败则推进）由章节 behavior.checkObjectives 读 definition 的 objectiveRule 处理。
export default {
  code: '06291',
  scope: 'act',
  implemented: true,
  actRule: {
    defeatPriestAction: {
      rule: 'defeatHighPriest',
      requiresRemembered: ['maneuveredThePriestCloser', 'stunnedThePriest'],
      targetCode: '06311',
    },
  },
}
