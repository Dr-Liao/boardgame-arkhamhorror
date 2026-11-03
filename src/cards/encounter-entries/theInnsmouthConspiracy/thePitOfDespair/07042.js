// 苏醒：先淹没已揭示地点，再登记离开本议程后仍持续的揭示政策。
// 正面的缺氧由本章通用 water.air 统一结算一次。
export default {
  code: '07042', scope: 'agenda', implemented: true,
  agendaRule: {
    onReveal(state, agenda, api) {
      for (const location of state.locations.filter(location => location.revealed)) {
        api.mechanics.water.change(location.id, 1)
      }
      api.mechanics.water.setRevealPolicy({ mode: 'increase', amount: 1 })
    },
  },
}
