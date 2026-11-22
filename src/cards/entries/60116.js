import { attackableEnemies } from './_shared.js'

export default {
  code: '60116',
  playCondition: [({ state, inv, helpers }) => !helpers.capabilityBlocked(inv.seat, 'fight')
    && attackableEnemies(state, inv).some(enemy => !enemy.hasParts && !helpers.entityRuleActive(enemy, 'cannot:beAttacked'))],
  abilities: [{
    kind: 'played', label: '攻击，命中时额外造成 1 点伤害',
    effect: { type: 'fight', sourceCode: '60116', damageBonus: 1 },
  }],
}
