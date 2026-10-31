// 06344 巨网·庞大蛛网（地点，2 张）
// 归属：关卡专用 · weaverOfTheCosmos（P8 w-p8-f）。遭遇组：weaver_of_the_cosmos。
// 卡面：[action] 如果当前场景非场景 1，并且本地点上有不超过 1[per_investigator] 个线索：
//       移动。移动到本地点正对面的地点。
// 接线（章节 behavior.actions/performAction）：把 locationRule.actions 合并进合法行动；
//   performAction 读纵向链 api.verticalChain.order()，正对面 = 链上相距一半的位置（4/8 步），
//   行动费由 move.actions=1 结算。这样不写死地点标签。
export default {
  code: '06344',
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      if ((state.actIndex || 0) < 1) return
      const limit = (state.numInvestigators || 1) * 1
      if ((location.clues || 0) > limit) return
      moves.push({
        action: 'scenarioAction', rule: 'greatWebAcrossMove', actions: 1,
        label: '🕸️ 移动到本地点正对面的地点',
      })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'greatWebAcrossMove') return false
      const order = api.verticalChain?.order?.() || []
      if (order.length < 2) return false
      const index = order.findIndex(item => item.id === inv.location)
      if (index < 0) return false
      const across = order[(index + Math.floor(order.length / 2)) % order.length]
      if (!across) return false
      api.moveInvestigator?.(inv.seat, across.id)
      api.info?.(`🕸️ ${inv.name} 沿着大网移动到正对面的「${across.name}」。`)
      return true
    },
  },
}
