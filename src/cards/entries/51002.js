import { enemyBody } from '../../engine/enemy-parts.js'
import { attackableEnemies } from './_shared.js'

export default {
  code: '51002',
  abilities: [{
    kind: 'action', countsAs: 'fight', cost: { action: true },
    target: { kind: 'enemy', query: ({ state, inv, candidate }) => attackableEnemies(state, inv).includes(candidate.entity) },
    label: '战斗 +2，攻击与队友交战的敌人时伤害 +1，失败不误伤队友',
    resolve: ({ state, inv, source, target, api }) => {
      const enemy = target.entity
      const body = enemyBody(state, enemy) || enemy
      const textBlanked = body.textBlanked?.round === state.round && body.textBlanked?.phase === state.phase
      const engagedWithOther = state.investigators.some(other => other.seat !== inv.seat
        && other.location === body.location && !other.defeated && !other.resigned
        && (body.engagedSeat === other.seat || (body.massive && !textBlanked)))
      api.fight(inv.seat, enemy.id, {
        assetId: source.id, combatBonus: 2, damageBonus: engagedWithOther ? 1 : 0, noFriendlyFire: true,
      })
    },
  }],
}
