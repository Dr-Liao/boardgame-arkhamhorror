// 05298 地点条目（ICC）
// 归属：关卡专用 · inTheClutchesOfChaos（P8 w-clutches）。卡面：抽 1 张遭遇牌：移除此处所有裂口并移到当前幕；另有撤退行动。
// 一卡一文件：地点行动由 locationRule.actions / performAction 提供，章节 behavior 按
// locationRuleFor(卡号) 通用分派；裂口读写只走 api（breach / moveBreachesToAct）。

const locationOf = (state, id) => (state.locations || []).find(location => location.id === id) || null
export default {
  code: '05298',
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, state }) {
      if (((state.encounterDeck || []).length || (state.encounterDiscard || []).length)) {
        moves.push({ rule: 'locSouthChurchDraw', label: '🎴 抽取 1 张遭遇牌：移除此处所有裂口并移到当前幕' })
      }
      moves.push({ rule: 'locResign', label: '🏳️ 撤退：你躲藏起来，熬过这一夜。' })
    },
    performAction(state, inv, move, api) {
      if (move.rule === 'locResign') { api.resign?.(inv.seat); return true }
      if (move.rule !== 'locSouthChurchDraw') return false
      const location = locationOf(state, move.locationId || inv.location)
      if (!location) return true
      api.drawEncounter?.(inv.seat)
      api.moveBreachesToAct?.(location.id, Number(location.breaches || 0))
      return true
    },
  },
}
