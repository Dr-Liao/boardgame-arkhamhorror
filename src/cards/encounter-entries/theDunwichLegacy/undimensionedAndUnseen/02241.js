// 02241 消灭他们！
// 归属：关卡专用 · undimensionedAndUnseen（无人知晓）
// 遭遇组：undimensioned_and_unseen
// 卡面：目标 - 尽可能击败最多的犹格·索托斯之子！如果没有犹格·索托斯之子在场上或放在一边，推进。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02241', scope: 'act',
  actRule: {
    objective(state) {
      return !state.scenarioZones.brood.remaining && !state.enemies.some(enemy => enemy.code === '02255')
    },
    onReveal(state, act, api) { api.finish('r2') },
  },
}
