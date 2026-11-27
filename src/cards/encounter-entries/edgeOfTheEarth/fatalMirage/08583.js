// 08583 单恋之记忆：被击败时，翻开并结算记忆剧情。
export default {
  code: '08583', scope: 'enemy', implemented: true,
  enemyRule: { flipOnDefeat: true, preyPartner: '08593' },
  abilities: [{
    kind: 'reaction', trigger: 'clueDiscovered', label: '发现其所在地点的线索后：对它造成等量伤害',
    criteria: ({ context, inv, source }) => context.seat === inv.seat && context.location === source.location && context.amount > 0,
    resolve: ({ inv, source, context, api }) => api.damageEnemy(source, context.amount, inv.seat),
  }],
}
