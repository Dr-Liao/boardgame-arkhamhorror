import { hasTrait } from '../../_shared.js'

export default {
  code: '07296', scope: 'treachery',
  encounterResolve(state, inv, card, api) {
    api.mechanics.chaosTokens.add('curse', 1)
    api.test(inv.seat, 'willpower', 4, result => {
      if (result.success) return
      for (const enemy of state.enemies.filter(enemy => !enemy.defeated && !enemy.removedFromGame && hasTrait(enemy, 'Cultist'))) {
        api.doomOn(enemy, 1)
      }
      api.horror(inv.seat, (result.drawn || []).includes('curse') ? 2 : 1)
    })
    return false
  },
}
