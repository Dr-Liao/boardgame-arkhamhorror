export default {
  code: '07288', scope: 'location',
  locationRule: {
    onReveal(state, location, api, seat) {
      if (!api.takeFromSetAside('07293')) return
      api.shuffleIntoEncounterDeck(['07293'], { shuffle: false })
      api.drawEncounter(seat ?? state.campaign.leadSeat)
    },
  },
}
