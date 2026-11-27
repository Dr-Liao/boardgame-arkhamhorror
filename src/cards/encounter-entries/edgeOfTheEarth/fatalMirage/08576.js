// 08576 去世病人之记忆：被击败时，翻开并结算记忆剧情。
export default {
  code: '08576', scope: 'enemy', implemented: true,
  enemyRule: { flipOnDefeat: true, preyPartner: '08590' },
  abilities: [{
    kind: 'reaction', trigger: 'damageHealed', label: '它横置时你治疗伤害后：对它造成等量伤害',
    criteria: ({ context, inv, source }) => context.seat === inv.seat && source.exhausted && context.amount > 0,
    resolve: ({ inv, source, context, api }) => api.damageEnemy(source, context.amount, inv.seat),
  }],
}
