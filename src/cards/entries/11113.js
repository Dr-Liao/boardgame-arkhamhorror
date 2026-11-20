export default {
  code: '11113',
  trackRoundActionHistory: true,
  abilities: [{
    kind: 'forced', trigger: 'opportunityAttack',
    limit: { scope: 'perRound', owner: 'investigator' },
    label: '取消每轮第一次对你发动的趁乱攻击',
    criteria: ({ inv, context }) => inv.seat === context.seat && context.firstThisRound && !context.cancelled,
    resolve: ({ context, api }) => { api.cancelCurrentAttack(context) },
  }],
}
