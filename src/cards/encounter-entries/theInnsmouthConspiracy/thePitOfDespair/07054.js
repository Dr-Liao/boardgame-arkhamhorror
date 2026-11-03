const isAmalgam = enemy => (enemy.originalCode || enemy.code) === '07053'
export default {
  code: '07054', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'agility', 3, result => {
      if (result.success || inv.defeated || inv.resigned) return
      const deep = api.mechanics.enemyZones.list('depths').find(isAmalgam)
      if (deep) {
        const enemy = api.mechanics.enemyZones.restore('depths', deep.id,
          { location: inv.location, engageSeat: inv.seat, exhausted: false })
        if (enemy && state.enemies.includes(enemy) && !inv.defeated && !inv.resigned) api.attack(enemy, inv)
        return
      }
      const enemy = state.enemies.find(isAmalgam)
      if (!enemy) return
      api.readyEnemy(enemy)
      api.moveEnemy(enemy, inv.location, { skipAutoEngage: true, cause: 'effect', seat: inv.seat })
      if (!state.enemies.includes(enemy) || inv.defeated || inv.resigned) return
      if (enemy.location === inv.location) api.engage(enemy, inv.seat)
      if (state.enemies.includes(enemy) && !inv.defeated && !inv.resigned) api.attack(enemy, inv)
    })
    return false
  },
}
