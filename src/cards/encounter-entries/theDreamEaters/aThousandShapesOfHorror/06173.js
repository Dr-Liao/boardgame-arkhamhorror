// 06173 幕 II「无尽阶梯」（The Endless Stairs）· 万千骇形
// 归属：关卡专用 · aThousandShapesOfHorror。卡面（正面）：最下方的神秘阶梯地点被揭示时，其获得：
// 「[action]：撤退。」目标 - 到达阶梯底部。如果所有未被击败的调查员都已撤退，推进。
// 背面「强行通过」：(→ 结局 1)。
//
// 实现口径：阶梯是纵向链（verticalIndex 0 = 最上方）；「最下方」= 链上最底层。撤退行动由本章
// behavior.actions 按本条目数据统一提供（004.5.1 scriptCard 归属：归 act），
// 目标检查由 behavior.checkObjectives 按 objective.kind 结算。
export default {
  code: '06173',
  scope: 'act',
  implemented: true,
  actRule: {
    // 目标：所有未败退调查员都已撤退（没有线索推进）。
    objective: { kind: 'allResigned' },
    // 最下方的神秘阶梯被揭示后获得「[action]：撤退」。
    grantsResignAtBottomStairs: true,
    // 背面（→ 结局 1）。
    onReveal(state, act, api) {
      api.finish?.('resolution1')
      return true
    },
  },
}
