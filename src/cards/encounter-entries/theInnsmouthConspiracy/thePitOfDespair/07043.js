// 潮水上涨：完全淹没政策替换议程1b的加一政策，不能叠加旧提醒。
export default {
  code: '07043', scope: 'agenda', implemented: true,
  agendaRule: {
    onReveal(state, agenda, api) {
      for (const location of state.locations.filter(location => location.revealed)) {
        api.mechanics.water.set(location.id, 2)
      }
      api.mechanics.water.setRevealPolicy({ mode: 'set', amount: 2 })
    },
  },
}
