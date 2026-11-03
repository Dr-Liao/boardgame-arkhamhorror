export default {
  code: '07203',
  scope: 'location',
  locationRule: {
    objective(state, location) {
      const act = state.acts[state.actIndex]
      if ((act?.originalCode || act?.code) !== '07202') return false
      const investigators = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
      return investigators.length > 0 && investigators.every(inv => inv.location === location.id)
    },
  },
}
