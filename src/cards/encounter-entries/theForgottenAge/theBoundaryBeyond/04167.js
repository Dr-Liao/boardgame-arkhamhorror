// 04167 归家之旅
// 归属：关卡专用 · theBoundaryBeyond（失落的时代 · 界限彼端）
// 遭遇组：the_boundary_beyond
// 卡面：目标 - 如果帕德玛·阿姆丽塔被击败，推进场景。
// 卡面：目标 - 如果位于大神庙的调查员共同花费所需数量的线索，推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04167', scope: 'act',
  actRule: { onReveal(state, act, api) { api.finish('r1') } },
}
