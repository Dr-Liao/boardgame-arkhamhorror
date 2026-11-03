export default {
  code: '07020', abilities: [{ kind: 'reaction', fromHand: true, quickEvent: true, trigger: 'enemyAttack',
    label: '取消攻击，加入等同伤害与恐惧值的祝福',
    criteria: ({ inv, context }) => context.location === inv.location,
    resolve: ({ api, context }) => {
      api.cancelCurrentAttack(context)
      api.chaosTokens.add('bless', (context.enemy.damage || 0) + (context.enemy.horror || 0))
    } }],
}
