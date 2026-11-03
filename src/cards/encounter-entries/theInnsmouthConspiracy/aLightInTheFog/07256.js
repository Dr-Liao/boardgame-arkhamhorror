import { hasTrait } from '../../_shared.js'

export default {
  code: '07256', scope: 'treachery',
  encounterResolve(state, inv, card, api) {
    const candidates = state.enemies.filter(enemy => !enemy.defeated && !enemy.removedFromGame && hasTrait(enemy, 'Deep One'))
    if (!candidates.length) { api.drawEncounter(inv.seat); return false }
    const difficulty = Math.max(...candidates.map(enemy => api.enemyFight(enemy, inv.seat)))
    const highest = candidates.filter(enemy => api.enemyFight(enemy, inv.seat) === difficulty)
    if (highest.length > 1) api.choice({
      kind: 'enemy', source: '07256', seat: inv.seat,
      prompt: '选择一名战斗值最高的深潜者。',
      options: highest.map(enemy => ({ id: enemy.id, label: enemy.name })),
    })
    api.test(inv.seat, 'willpower', difficulty, result => {
      if (!result.success) api.horror(inv.seat, 2)
    })
    return false
  },
}
