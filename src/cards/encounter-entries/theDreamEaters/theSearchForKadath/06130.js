// 06130 卡达瑟隆（theSearchForKadath）· 地点（米纳尔 / 古代 / 城市 / 港口，掩藏，线索1，帷幕5）
// 卡面：掩藏。
// 卡面：[action][action][action]：抽取5张卡牌。
//
// 一卡一文件：地点条目声明 [action]；章节 behavior 的 actions/performAction 读取并接线。
export default {
  code: '06130', scope: 'location', implemented: true,
  locationRule: {
    actions({ moves, inv, location }) {
      if (inv.location !== location.id) return
      moves.push({
        action: 'scenarioAction', rule: 'kadatheronDrawFive', actions: 3,
        label: '📜 卡达瑟隆：花费 3 个行动抽取 5 张卡牌',
      })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'kadatheronDrawFive') return false
      api.drawCards?.(inv.seat, 5)
      api.info?.('📜 卡达瑟隆的圆柱上记载着幻梦境的历史：抽 5 张卡。')
      return true
    },
  },
}
