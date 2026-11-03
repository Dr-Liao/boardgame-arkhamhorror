export default { code: '07027', fast: true, uses: 3, usesType: 'charges', abilities: [{
  kind: 'reaction', trigger: 'opportunityAttack', label: '花费 1 充能：取消这次借机攻击', cost: { uses: 1 },
  criteria: ({ inv, context }) => context.seat === inv.seat,
  resolve: ({ context, api }) => { api.cancelCurrentAttack(context); api.noteCancelled('enemyAttack') },
}] }
