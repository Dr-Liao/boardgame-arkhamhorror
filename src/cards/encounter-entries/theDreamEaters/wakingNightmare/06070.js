// 06070 候诊室（Waiting Room）
// 归属：关卡专用 · theDreamEaters/wakingNightmare（P8-1 w-p8-a）。
// 卡面：当「候诊室」未被寄生时，它获得：「[action]：撤退。你逃离医院，把同伴抛在身后。」
// 读点：locationRule.actions / performAction 由章节 behavior.actions / performAction 分派；
//   「是否被寄生」读章节 behavior 维护的 api.tokenBag.isInfested 状态（本条目用只读的
//   state.infestedLocations 判断形态，见 src/engine/token-bag.js 的状态形状）。
const CODE = '06070'

function isInfested(state, locationId) {
  return (state.infestedLocations || []).map(String).includes(String(locationId))
}

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id) return
      if (isInfested(state, location.id)) return
      moves.push({
        action: 'scenarioAction',
        rule: 'waitingRoomResign',
        actions: 1,
        label: '🚪 候诊室：撤退。你逃离医院，把同伴抛在身后',
      })
    },
    performAction(state, inv, move, api) {
      if (!move || move.rule !== 'waitingRoomResign') return false
      api.resign?.(inv.seat)
      api.info?.(`🚪 ${inv.name} 逃离医院，把同伴抛在身后。`)
      return true
    },
  },
}
