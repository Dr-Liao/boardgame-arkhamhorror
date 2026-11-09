// 05301 地点条目（ICC）
// 归属：关卡专用 · inTheClutchesOfChaos（P8 w-clutches）。卡面：[fast] 支付 2 资源：移除 1 个裂口并移到当前幕。
// 一卡一文件：地点行动由 locationRule.actions / performAction 提供，章节 behavior 按
// locationRuleFor(卡号) 通用分派；裂口读写只走 api（breach / moveBreachesToAct）。

const locationOf = (state, id) => (state.locations || []).find(location => location.id === id) || null
export default {
  code: '05301',
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, inv, location }) {
      if (Number(location?.breaches || 0) > 0 && Number(inv.resources || 0) >= 2) {
        moves.push({ rule: 'locMerchantPay', label: '💰 支付 2 资源：移除 1 个裂口并移到当前幕', actions: 0, fast: true })
      }
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'locMerchantPay') return false
      const location = locationOf(state, move.locationId || inv.location)
      if (!location || Number(inv.resources || 0) < 2) return true
      api.loseResources?.(inv.seat, 2)
      api.moveBreachesToAct?.(location.id, 1)
      return true
    },
  },
}
