// 05293 地点条目（ICC）
// 归属：关卡专用 · inTheClutchesOfChaos（P8 w-clutches）。卡面：${skillZh}(${difficulty}) 检定：成功且每超出 1 点，移除 1 个裂口并移到当前幕。
// 一卡一文件：地点行动由 locationRule.actions / performAction 提供，章节 behavior 按
// locationRuleFor(卡号) 通用分派；裂口读写只走 api（breach / moveBreachesToAct）。

const locationOf = (state, id) => (state.locations || []).find(location => location.id === id) || null
export default {
  code: '05293',
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, location }) {
      if (Number(location?.breaches || 0) > 0) moves.push({ rule: 'locIntellectBreach', label: '📖 智识(2) 检定：成功且每超出 1 点，移除 1 个裂口并移到当前幕' })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'locIntellectBreach') return false
      const location = locationOf(state, move.locationId || inv.location)
      if (!location) return true
      api.test?.(inv.seat, 'intellect', 2, result => {
        if (!result?.success) return
        // 恰好成功（差值 0）不移裂口；每超出 1 点移 1。
        const successBy = Math.max(0, Number(result.value || 0) - Number(result.difficulty || 2))
        if (successBy <= 0) return
        api.moveBreachesToAct?.(location.id, Math.min(Number(location.breaches || 0), successBy))
      }, 0, { code: '05293' })
      return true
    },
  },
}
