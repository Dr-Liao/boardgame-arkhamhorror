export const behavior = Object.freeze({
  id: 'theGathering',
  setupLocations: () => ['study'],
  houseFateChoice: true,
  roundEndActIndex: 1,
  litaParleyActIndex: 2,
  investigatorEntryError(state, location) {
    // Also enforce the act gate for old saves that revealed the Parlor too early.
    if (location.id === 'parlor' && (state.actIndex < 2 || !location.revealed)) {
      return '灼热屏障尚未解除，不能进入客厅'
    }
    return null
  },
  resolution(state, key, events, api) {
    const { campaign } = state
    const rec = campaign.records
    const lead = state.investigators[campaign.leadSeat]
    rec.houseBurned = key === 'r1'
    rec.ghoulPriestAlive = !['r1', 'r2'].includes(key)
    if (key === 'r3') {
      rec.litaForcedOthers = true
      for (const inv of state.investigators) if (!inv.resigned) campaign.investigators[inv.seat].status = 'killed'
    }
    if (key !== 'r2') api.addLitaToCampaign(state)
    if (key === 'r1') api.addTrauma(state, lead.seat, 'mental', 1, events)
    return { bonus: 2, award: key !== 'r3', seatBonus: seat => key === 'r2' && seat === lead.seat ? 1 : 0 }
  },
})
