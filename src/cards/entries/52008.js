import { attackableEnemies } from './_shared.js'

const code = '52008'

export default {
  code,
  playCondition: [{
    when: ({ state, inv }) => attackableEnemies(state, inv).length > 0,
    message: '需要所在地点有可攻击的敌人',
  }],
  abilities: [{
    kind: 'played',
    countsAs: 'fight',
    noOpportunityAttack: true,
    label: '以意志进行攻击，对目标所在地点造成范围伤害',
    resolve: ({ state, inv, api }) => {
      const enemies = attackableEnemies(state, inv)
      if (!enemies.length) return
      const enemyId = enemies.length === 1 ? enemies[0].id : api.choice({
        kind: 'enemy', source: code, seat: inv.seat, prompt: '选择攻击目标。',
        options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      api.fight(inv.seat, enemyId, {
        skill: 'willpower', combatBonus: 2, sourceCode: code,
        areaDamage: { enemyAmount: 3, investigatorDamageOnSymbol: 2 },
      })
    },
  }],
}
