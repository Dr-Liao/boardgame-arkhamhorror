// 04294 被遗弃的仪式场所
// 归属：关卡专用 · theDepthsOfYoth（失落的时代 · 幽嘶深渊）
// 遭遇组：the_depths_of_yoth
// 卡面：X为当前深度等级。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04294', scope: 'location',
  locationRule: {
    shroudModifier(state) { return Math.max(1, Number(state.scenarioFlags?.depthLevel || 1)) },
  },
}
