export default { code: '07010', abilities: [{ kind: 'reaction', trigger: 'turnBegins', fromHand: true, label: '解除交战，本轮不能交战或造成敌人伤害',
  criteria: ({ inv, context }) => context.seat === inv.seat,
  resolve: ({ inv, api }) => {
    api.disengageAll(inv.seat)
    api.addEffect({ duration: 'endOfRound', sourceCode: '07010', controllerSeat: inv.seat, label: '潜于阴影',
      modifiers: [{ target: 'capability:engage', amount: 1 }, { target: 'capability:dealEnemyDamage', amount: 1 }] })
  } }] }
