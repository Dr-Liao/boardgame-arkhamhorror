// 03075 餐厅
// 归属：关卡专用 · theLastKing（卡尔克萨之路 · 最后的王者）
// 遭遇组：the_last_king
// 卡面：[action]：治愈1点恐惧。然后，从混乱袋中随机揭示一个标记。如果揭示了[skull]或[auto_fail]符号，受到1点恐惧并在餐厅放置1个毁灭标记。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03075', scope: 'location',
  locationRule: {
    actions({ moves }) {
      // 卡面没有「必须有恐惧才能用」的限制：治愈 0 点后仍要揭示混乱标记（可能吃惩罚），
      // 所以恐惧为 0 时也保留这个行动。
      moves.push({ action: 'scenarioAction', rule: 'diningRoomHeal', label: '治愈1点恐惧并揭示一个混乱标记' })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'diningRoomHeal') return false
      inv.horror = Math.max(0, inv.horror - 1)
      const token = api.revealToken()
      if (['skull', 'autofail'].includes(token)) {
        api.horror(inv.seat, 1)
        const location = state.locations.find(item => item.id === inv.location)
        if (location) location.doom = (location.doom || 0) + 1
      }
      return true
    },
  },
}
