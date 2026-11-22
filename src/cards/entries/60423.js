import { CHAOS_SYMBOLS } from './_shared.js'

export default {
  code: '60423',
  abilities: [{
    kind: 'played',
    fast: true,
    trigger: 'enemyAttack',
    label: '取消本地点的攻击。若揭示指定符号，对该敌人造成其伤害值或恐惧值的伤害',
    criteria: ({ inv, context }) => Boolean(context?.enemy) && context.location === inv.location,
    resolve: ({ api, inv, context }) => {
      const { enemy } = context
      api.cancelCurrentAttack(context)
      const [token] = api.chaosTokens.inspect(1)
      if (!CHAOS_SYMBOLS.includes(token)) return
      const damage = Math.max(0, enemy.damage || 0)
      const horror = Math.max(0, enemy.horror || 0)
      const choice = damage === horror ? 'damage' : api.choice({
        kind: 'effect', source: '60423', seat: inv.seat,
        prompt: '按敌人的伤害值或恐惧值造成伤害。',
        options: [
          { id: 'damage', label: '伤害值：' + damage },
          { id: 'horror', label: '恐惧值：' + horror },
        ],
      })
      api.damageEnemy(enemy, choice === 'horror' ? horror : damage, inv.seat, '60423')
    },
  }],
}
