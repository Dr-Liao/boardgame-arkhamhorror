export default {
  code: '07217',
  scope: 'treachery',
  encounterResolve(state, inv, card, api) {
    const vehicleId = api.mechanics.vehicles.of(inv.seat)
    const vehicle = vehicleId && state.scenarioFlags.mechanics.vehicles[vehicleId]
    if (!vehicle) {
      api.test(inv.seat, 'willpower', 5, result => {
        if (!result.success) api.horror(inv.seat, 3)
      })
    } else {
      if (vehicle.driver == null) throw new Error('载具内有调查员时必须指定驾驶员')
      api.test(vehicle.driver, 'willpower', 3, result => {
        if (result.success) return
        const passengers = [...(state.scenarioFlags.mechanics.vehicles[vehicleId]?.passengers || [])]
        for (const seat of passengers) {
          if (!state.investigators[seat].defeated && !state.investigators[seat].resigned) api.horror(seat, 2)
        }
      })
    }
    return false
  },
}
