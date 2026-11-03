import { hasTrait, keysAt } from '../../_shared.js'

const awake = enemy => ['07330b', '07331b'].includes(enemy.originalCode || enemy.code)
  && !enemy.defeated && !enemy.removedFromGame && hasTrait(enemy, 'Ancient One')

export default {
  code: '07329', scope: 'location',
  modifiers: [{
    target: 'locationShroud',
    condition: { when: ({ source, entity }) => source.revealed && source.id === entity.id },
    amount: ({ state }) => -state.locations.filter(location => hasTrait(location, 'Sanctum')
      && keysAt(state, `location:${location.id}`).length > 0).length,
  }],
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '放置黑、紫或白色钥匙：对一名已苏醒的古神造成3点伤害',
    limit: { scope: 'perGame', owner: 'group' },
    additionalKeyCost: { colors: ['black', 'purple', 'white'], destination: 'source' },
    criteria: ({ state, inv, helpers }) => state.enemies.some(enemy => awake(enemy) && helpers.canDamageEnemy(enemy, inv.seat, '07329')),
    resolve: ({ state, inv, api }) => {
      const enemies = state.enemies.filter(enemy => awake(enemy) && api.canDamageEnemy(enemy, inv.seat, '07329'))
      if (!enemies.length) return
      const id = enemies.length === 1 ? enemies[0].id : api.choice({ kind: 'enemy', source: '07329', seat: inv.seat,
        prompt: '选择任意地点一名已苏醒的古神，造成3点伤害。',
        options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = enemies.find(enemy => enemy.id === id)
      if (enemy) api.damageEnemy(enemy, 3, inv.seat, '07329')
    },
  }],
}
