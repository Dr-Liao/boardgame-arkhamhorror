// The common chapter water.air rule supplies the printed front-side forced rule.
export default {
  code: '07279', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      for (const inv of state.investigators.filter(inv => !inv.resigned)) {
        api.trauma(inv.seat, 'mental', 1)
        if (!inv.defeated) api.defeat(inv)
      }
      api.setCampaignRecord('DagonHasAwakened', true)
      api.finish('resolution1')
    },
  },
}
