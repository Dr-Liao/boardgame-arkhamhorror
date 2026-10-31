// 06321 无眠之旅 · 谎言（Restless Journey · Lies）
// 卡面：险境。隐私。
//       显现 - 秘密地将本卡牌加入你的手牌。
//       每轮你不能投入超过 1 张卡牌到技能检定中。
//       [fast]：弃掉无眠之旅并检定[agility](3)。如果你检定失败，在当前密谋上放置 1 个毁灭标记。
//       本效果能导致当前密谋推进。
//
// 行为位置：
//   · 「秘密加入手牌」由引擎 Hidden 分支自动完成；
//   · 「每轮投入 ≤1 张」→ `hiddenRule.maxCommitsPerRound: 1`（引擎 P8 新增读点）；
//   · [fast] 行动由章节 behavior 统一实现（读 flags.restlessJourney），弃牌/失败放毁灭同 06319。
export default {
  code: '06321',
  scope: 'treachery',
  implemented: true,
  hiddenRule: { maxCommitsPerRound: 1 },
  flags: { restlessJourney: { skill: 'agility', difficulty: 3 } },
}
