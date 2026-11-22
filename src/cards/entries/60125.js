import { ownFirstAction } from '../../engine/matcher.js'
import { enemyInEngagement, enemyIsBody } from '../../engine/enemy-parts.js'

const code = '60125'
const targets = (state, inv) => state.enemies.filter(enemy =>
  enemyInEngagement(state, enemy, inv) && !enemyIsBody(enemy) && !enemy.defeated && !enemy.removedFromGame)

export default {
  code,
  playCondition: [ownFirstAction(), ({ state, inv, helpers }) =>
    !helpers.capabilityBlocked(inv.seat, 'dealEnemyDamage') && targets(state, inv).length > 0],
  abilities: [{
    kind: 'played', noOpportunityAttack: true, label: '对与你交战的一名敌人造成 2 点伤害',
    resolve: ({ state, inv, api }) => {
      const enemies = targets(state, inv).filter(enemy => api.canDamageEnemy(enemy, inv.seat, code))
      if (!enemies.length) return
      const id = enemies.length === 1 ? enemies[0].id : api.choice({
        kind: 'target', source: code, seat: inv.seat, prompt: '选择要造成伤害的敌人。',
        options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = enemies.find(target => target.id === id)
      if (enemy) api.damageEnemy(enemy, 2, inv.seat, code)
    },
  }],
}
