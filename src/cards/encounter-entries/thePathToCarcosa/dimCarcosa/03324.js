// 03324 褴褛之王
// 归属：关卡专用 · dimCarcosa（卡尔克萨之路 · 卡城幽影）
// 遭遇组：dim_carcosa
// 卡面：[free]如果你所在地点没有线索：将每位调查员的所有线索从游戏中移除。将你所在地点翻面并结算其另一面的文本。
// 卡面：目标 - 如果哈斯塔被击败，推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03324', scope: 'act', flags: { flipCarcosaAct: true },
  actRule: {
    onComplete(state, act, api) {
      const defeated = state.scenarioFlags.defeatedHastur
      api.finish(defeated === '03334' ? 'r1' : defeated === '03332' ? 'r2' : 'r3')
    },
  },
}
