// The printed air rule on every Maelstrom agenda front is chapter mechanics.water.air.
export default {
  code: '07312', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      const cards = ['07086', '07332'].filter(code => api.takeFromSetAside(code))
      api.shuffleIntoEncounterDeck(cards, { shuffle: false })
      api.shuffleDiscard()
    },
  },
}
