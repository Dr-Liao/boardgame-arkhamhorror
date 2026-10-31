// 06296 冰封荒土（Cold Wastes）
// 卡面：强制 - 你调查冰封荒土时揭示[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]
//       混乱标记后：你必须受到 1 点伤害或失去 1 个行动。
//
// 行为位置：`locationRule.tokenPenalty` 由章节 behavior.afterTest 读取
// （检定结果带本次揭示的 tokens；用 result._tokenPenaltyHandled 幂等标记，避免 afterTest 双调重复结算）。
export default {
  code: '06296',
  scope: 'location',
  implemented: true,
  locationRule: {
    tokenPenalty: {
      tokens: ['skull', 'cultist', 'tablet', 'elder_thing', 'autofail'],
      damage: 1,
      loseAction: 1,
    },
  },
}
