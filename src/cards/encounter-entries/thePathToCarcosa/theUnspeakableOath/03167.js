// 03167 告别疯人院
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
// 卡面：忽略阿卡姆疯人院地点未揭示面上的文字。
// 卡面：花园获得：“[action]如果花园没有处于重整状态的敌人：撤退。终于，找到出口了！”
// 卡面：目标 - 如果所有未被击败的调查员都撤退，推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03167', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      api.finish(state.scenarioFlags.tookKeysByForce ? 'r2' : 'r3')
    },
  },
}
