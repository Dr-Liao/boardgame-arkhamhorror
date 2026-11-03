// All three Lair agenda fronts share chapter mechanics.water.air.
// The selected physical v.I agenda adds four curses when its back resolves.
export default {
  code: '07277', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      api.mechanics.chaosTokens.add('curse', 4)
    },
  },
}
