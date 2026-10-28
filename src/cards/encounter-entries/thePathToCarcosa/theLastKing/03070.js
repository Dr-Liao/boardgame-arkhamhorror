// 03070 门厅
// 归属：关卡专用 · theLastKing（卡尔克萨之路 · 最后的王者）
// 遭遇组：the_last_king
// 卡面：[action]：撤退。你已经找到了有关这部剧的宝贵信息，你准备离开并计划下一步行动。(如果每位未被击败的调查员都撤退了，进入剧本手册中“如果未达成任何结局”部分。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 99 轮：最后之王的舞厅出口与餐厅。

export default {
  code: '03070', scope: 'location',
  locationRule: {
    actions({ moves }) {
      moves.push({ action: 'scenarioAction', rule: 'leaveParty', label: '撤退：带着已找到的情报离开庄园' })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'leaveParty') return false
      api.placeCluesOnAct(inv.clues)
      api.spendClues(inv.seat, inv.clues)
      api.resign(inv.seat)
      return true
    },
  },
}
