import { attackableEnemies } from './_shared.js'

export default {
  code: '60111',
  playCondition: [({ state, inv, helpers }) => !helpers.capabilityBlocked(inv.seat, 'fight')
    && attackableEnemies(state, inv).some(enemy => !enemy.hasParts && !helpers.entityRuleActive(enemy, 'cannot:beAttacked'))],
  abilities: [{
    kind: 'played', countsAs: 'fight', label: '获得 2 资源，然后攻击',
    effect: { type: 'sequence', effects: [
      { type: 'gainResource', amount: 2 },
      { type: 'fight', sourceCode: '60111' },
    ] },
  }],
}
