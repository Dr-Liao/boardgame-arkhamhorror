import { hasTrait } from '../../_shared.js'

export default {
  code: '07336', scope: 'treachery',
  encounterResolve(state, inv, card, api) {
    const sanctums = state.locations.filter(location => hasTrait(location, 'Sanctum')
      && api.mechanics.keys.at(`location:${location.id}`).length > 0).length
    api.test(inv.seat, 'willpower', 2 + sanctums, result => {
      if (result.success) return
      const ancientOnes = state.enemies.filter(enemy => !enemy.defeated && !enemy.removedFromGame
        && hasTrait(enemy, 'Ancient One') && !api.cannotAttack(enemy))
      const distance = enemy => api.mechanics.map.distance(inv.location, enemy.location)
      const minimum = Math.min(...ancientOnes.map(distance))
      const nearest = ancientOnes.filter(enemy => distance(enemy) === minimum)
      const choice = api.choice({ kind: 'effect', source: '07336', seat: inv.seat,
        prompt: '放置1个毁灭标记，或让最近的旧日支配者攻击你。',
        options: [{ id: 'doom', label: '当前密谋放置1个毁灭标记（可能推进）' },
          ...(nearest.length ? [{ id: 'attack', label: '最近的旧日支配者攻击你' }] : [])],
      })
      if (choice === 'doom') api.addDoom(1)
      else {
        const id = nearest.length === 1 ? nearest[0].id : api.choice({ kind: 'enemy', source: '07336', seat: inv.seat,
          prompt: '选择一名距离最近的旧日支配者攻击你。',
          options: nearest.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = nearest.find(enemy => enemy.id === id)
        if (enemy) api.attack(enemy, inv)
      }
    }, 0, null, { peril: true })
    return false
  },
}
