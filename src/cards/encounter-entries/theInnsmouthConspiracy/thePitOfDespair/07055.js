const isAmalgam = enemy => (enemy.originalCode || enemy.code) === '07053'
export default {
  code: '07055', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const deep = api.mechanics.enemyZones.list('depths').find(isAmalgam)
    if (deep) {
      api.mechanics.enemyZones.restore('depths', deep.id,
        { location: inv.location, engageSeat: inv.seat, exhausted: false })
      return false
    }
    const enemy = state.enemies.find(isAmalgam)
    if (enemy) api.mechanics.enemyZones.enter(enemy, 'depths', { clearTokens: true, ready: true, preserveKeys: true })
    // Printed otherwise still surges if no physical Amalgam remains anywhere.
    return { gainSurge: true }
  },
}
