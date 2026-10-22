// 04214 降入黑暗
// 归属：关卡专用 · heartOfTheEldersPart2（久远腹地（下））
// 遭遇组：knyan
// 卡面：目标 -  如果每位幸存的调查员均位于深入幽嘶，且该地点上没有毁灭标记，你可以推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04214', scope: 'treachery', treacheryRule: { threatArea: true },
  // 第 120 轮：同一卡号既是遭遇卡又是幕卡；能力层一个卡号只能注册一个条目，
  // 所以幕的结算规则也挂在这个条目上（引擎只对幕读 actRuleFor，两边互不干扰）。
  actRule: {
    onReveal(state, act, api) {
      api.finish(state.campaign?.records?.theInvestigatorsRescuedAlejandro ? 'r1' : 'r2')
    },
  },
}
