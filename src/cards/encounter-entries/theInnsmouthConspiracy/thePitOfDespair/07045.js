const offsets = [{ x: 0, y: -1 }, { x: -1, y: 0 }, { x: 1, y: 0 }]
export default {
  code: '07045', scope: 'act', implemented: true,
  actRule: {
    onReveal(state, act, api) {
      const alive = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
      const lead = alive.find(inv => inv.seat === state.campaign.leadSeat) || alive[0]
      if (!lead) return
      if (api.takeFromSetAside('07053')) api.spawnEngaged('07053', lead.location, lead.seat)
      const added = []
      for (const code of ['07054', '07055']) while (api.takeFromSetAside(code)) added.push(code)
      api.shuffleIntoEncounterDeck(added, { shuffle: false })
      api.shuffleDiscard()
      const special = ['07050', '07051', '07052'].map(code => {
        const locations = Object.values(state.scenario.locations).filter(location => (location.originalCode || location.code) === code)
        if (locations.length !== 1) throw new Error(`Expected one physical Tidal Tunnel: ${code}`)
        return locations[0].id
      })
      const reserve = state.scenarioFlags.pitTunnelReserve || []
      api.mechanics.scenarioDecks.initialize('tidalTunnels', [...reserve, ...special])
      api.setScenarioFlag('pitTunnelReserve', [])
      // Snapshot only the already-revealed locations. New tunnels enter unrevealed.
      const origins = state.locations.filter(location => location.revealed).map(location => location.id)
      for (const id of origins) api.mechanics.map.expand(id, offsets, 'tidalTunnels')
      const actor = alive.find(inv => !inv.defeated && !inv.resigned)
      if (actor) api.resolveFlashback(actor.seat, 'flashback1')
    },
  },
}
