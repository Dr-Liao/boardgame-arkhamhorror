// 04213 失落时代的洞穴
// 归属：关卡专用 · heartOfTheEldersPart2（久远腹地（下））
// 遭遇组：knyan
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 117 轮：久远腹地（下）（失落时代第七章）的幕/密谋与两个地点。
// 幕/密谋通过 onReveal 的 hooks 参数调用本章实现（走圈、预示者），实现只有一份。
// 幕 04213「原地绕圈」背面：深入幽嘶洗入探索牌库；选一名侦查员，没有粉笔就让全场 +1 线索。

export default {
  code: '04213', scope: 'act',
  actRule: {
    onReveal(state, act, api, hooks) {
      hooks.goingInCircles()
    },
  },
}
