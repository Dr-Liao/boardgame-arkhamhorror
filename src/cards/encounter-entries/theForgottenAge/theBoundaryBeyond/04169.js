// 04169 大都会教堂
// 归属：关卡专用 · theBoundaryBeyond（失落的时代 · 界限彼端）
// 遭遇组：the_boundary_beyond
// 卡面：[action]受到1点恐惧：抽取2张卡牌。
// 卡面：[action]如果你有至少6张手牌：探索。抽取探索牌库顶的一张卡牌。如果抽出的地点左上角带有对应地点符号，将其放在本地点上方并替代本地点。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 91 轮：边界之外的大教堂与查普尔特佩克公园。

export default {
  code: '04169', scope: 'location',
  locationRule: {
    actions({ moves }) {
      moves.push({ action: 'scenarioAction', rule: 'studyCathedral', label: '📖 受到 1 点恐惧：抽 2 张牌' })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'studyCathedral') return false
      api.horror(inv.seat, 1)
      api.drawCards(inv.seat, 2)
      return true
    },
  },
}
