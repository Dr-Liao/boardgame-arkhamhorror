// 05302 地点条目（ICC）
// 归属：关卡专用 · inTheClutchesOfChaos（P8 w-clutches）。卡面：查找遭遇牌库/弃牌堆的「女巫」敌人并抽取：然后把此处所有裂口移到当前幕。
// 一卡一文件：地点行动由 locationRule.actions / performAction 提供，章节 behavior 按
// locationRuleFor(卡号) 通用分派；裂口读写只走 api（breach / moveBreachesToAct）。

const locationOf = (state, id) => (state.locations || []).find(location => location.id === id) || null
export default {
  code: '05302',
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, location }) {
      const base = '🧙 查找遭遇牌库/弃牌堆的「女巫」敌人并抽取'
      const suffix = Number(location?.breaches || 0) > 0 ? '：然后把此处所有裂口移到当前幕' : ''
      moves.push({ rule: 'locHangmansHillSearch', label: base + suffix })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'locHangmansHillSearch') return false
      const location = locationOf(state, move.locationId || inv.location)
      if (!location) return true
      api.drawEncounterByTrait?.('Witch', inv.seat, { source: '05302' })
      api.moveBreachesToAct?.(location.id, Number(location.breaches || 0))
      api.shuffleEncounterDeck?.()
      return true
    },
  },
}
