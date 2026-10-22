// 04059 逃出遗迹
// 归属：关卡专用 · theDoomOfEztli（失落的时代 · 埃兹特里的覆灭）
// 遭遇组：eztli
// 卡面：胜利区内有至少3点复仇点数时，每个[[蛇族]]敌人得到+1躲避值。
// 卡面：目标 - 如果所有未被击败的调查员都撤退，推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 7 批：失落时代「埃兹特里覆灭」的简单幕/密谋分支。

export default {
  code: '04059', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      const relic = state.relicOfAges
      const bearer = relic?.seat != null ? state.investigators[relic.seat] : null
      api.finish(bearer?.resigned ? 'r1' : 'r3')
    },
  },
}
