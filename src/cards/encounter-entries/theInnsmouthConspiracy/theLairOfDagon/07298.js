import { failedBy } from '../../_shared.js'

export default {
  code: '07298', scope: 'treachery',
  encounterResolve(state, inv, card, api) {
    const difficulty = api.mechanics.water.effectiveLevel(inv.seat) > 0 ? 5 : 3
    api.test(inv.seat, 'willpower', difficulty, result => {
      if (result.success) return
      const requested = failedBy(result, difficulty)
      const available = api.mechanics.chaosTokens.room('curse')
      api.mechanics.chaosTokens.add('curse', Math.min(available, requested))
      if (available < requested) api.drawEncounter(inv.seat)
    })
    return false
  },
}
