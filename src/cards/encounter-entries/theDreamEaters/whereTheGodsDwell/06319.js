// 06319 无眠之旅 · 谬论（Restless Journey · Fallacy）
// 卡面：险境。隐私。
//       显现 - 秘密地将本卡牌加入你的手牌。
//       每轮你不能投入超过 1 张卡牌到技能检定中。
//       [fast]：弃掉无眠之旅并检定[intellect](3)。如果你检定失败，在当前密谋上放置 1 个毁灭标记。
//       本效果能导致当前密谋推进。
//
// 行为位置：
//   · 「秘密加入手牌」由引擎 Hidden 分支自动完成；
//   · 「每轮投入 ≤1 张」→ `hiddenRule.maxCommitsPerRound: 1`（引擎 P8 新增读点，计数在
//     state.scenarioFlags.hiddenCommitCounts，按 (座位, 轮次) 重置）；
//   · [fast] 行动由章节 behavior 统一实现（三张无眠之旅共用同一流程）：读
//     `flags.restlessJourney = { skill, difficulty }` 生成行动，弃牌走 hidden 手牌原语，
//     失败放 1 毁灭（api.addDoom 在当前密谋上放毁灭并检查推进）。
export default {
  code: '06319',
  scope: 'treachery',
  implemented: true,
  hiddenRule: { maxCommitsPerRound: 1 },
  flags: { restlessJourney: { skill: 'intellect', difficulty: 3 } },
}
