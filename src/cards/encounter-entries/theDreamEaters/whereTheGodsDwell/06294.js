// 06294 食梦者（The Dream-Eaters，幕 5）
// 正面：调查员每共同拥有 1 个线索，奈亚拉托提普的真形生命值 -1。
//       目标 - 如果奈亚拉托提普的真形被击败，推进。
// 背面（The Black Cat）：(→R2) 进入结局 2。
//
// 行为位置：
//   · 真形生命 -1/线索 → actRule.trueShapeHealthPerClue，章节 behavior.enemyStatModifier('health') 读取
//     （rules-state.js 的生命值统一读点）；
//   · 推进 = 结局 2 → 本文件 actRule.onReveal 调 api.finish('resolution2')；
//   · 目标（真形被击败）→ 章节 behavior.checkObjectives 读 definition 的 objectiveRule。
export default {
  code: '06294',
  scope: 'act',
  implemented: true,
  actRule: {
    trueShapeHealthPerClue: 1,
    onReveal(state, act, api) {
      api.info?.('🌌 「食梦者」：奈亚拉托提普的真形被击败，黑猫的故事走向结局 2。')
      api.finish?.('resolution2')
      return true
    },
  },
}
