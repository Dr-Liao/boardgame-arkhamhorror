// 04170 查普尔特佩克公园
// 归属：关卡专用 · theBoundaryBeyond（失落的时代 · 界限彼端）
// 遭遇组：the_boundary_beyond
// 卡面：强制 - 你位于查普尔特佩克公园时，[willpower]技能检定失败后：受到1点恐惧。
// 卡面：[action]：探索。检定[willpower](3)。如果你检定成功，抽取探索牌库顶的一张卡牌。如果抽出的地点在左上角带有对应地点符号，将其放在本地点上方并替代本地点。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04170', scope: 'location',
  locationRule: {
    onTestFail(state, loc, api, inv, result) {
      if (!result?.success && result?.skill === 'willpower') api.horror(inv.seat, 1)
    },
  },
}
