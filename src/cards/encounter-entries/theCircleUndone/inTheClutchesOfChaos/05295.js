// 05295 地点条目（ICC）
// 归属：关卡专用 · inTheClutchesOfChaos（P8 w-clutches）。卡面：[fast] 弃任意张手牌：每弃 1 张移除 1 个裂口并移到当前幕。
// 一卡一文件：地点行动由 locationRule.actions / performAction 提供，章节 behavior 按
// locationRuleFor(卡号) 通用分派；裂口读写只走 api（breach / moveBreachesToAct）。

const locationOf = (state, id) => (state.locations || []).find(location => location.id === id) || null
export default {
  code: '05295',
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, inv, location }) {
      if (Number(location?.breaches || 0) > 0) {
        moves.push({ rule: 'locSouthsideHandBreaches', label: '🃏 弃任意张手牌：每弃 1 张移除 1 个裂口并移到当前幕', actions: 0, fast: true })
      }
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'locSouthsideHandBreaches') return false
      const location = locationOf(state, move.locationId || inv.location)
      if (!location) return true
      const limit = (inv.hand || []).length
      if (limit <= 0) return true
      const picked = Number(api.choose?.({
        kind: 'number', source: '05295', seat: inv.seat, prompt: `弃任意张手牌（最多 ${limit} 张）。`,
        options: Array.from({ length: limit + 1 }, (_, index) => ({ id: String(index), label: `弃 ${index} 张` })),
      }))
      const count = Number.isInteger(picked) && picked >= 0 && picked <= limit ? picked : limit
      for (let index = 0; index < count; index++) api.discardOneFromHand?.(inv.seat, { source: '05295' })
      api.moveBreachesToAct?.(location.id, Math.min(count, Number(location.breaches || 0)))
      return true
    },
  },
}
