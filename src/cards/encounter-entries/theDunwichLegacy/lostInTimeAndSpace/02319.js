// 02319 寻找新的道路
// 归属：关卡专用 · lostInTimeAndSpace（迷失时空）
// 遭遇组：lost_in_time_and_space
// 卡面：[action]：弃掉遭遇牌库顶3张卡牌。选择以此效果弃掉的一个地点并结算其“显现”能力。
// 卡面：目标 - 如果所有未被击败的调查员都撤退，推进。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02319', scope: 'act',
  actRule: { onReveal(state, act, api) { api.finish('r1') } },
}
