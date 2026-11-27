// 08577 失踪父亲之记忆：被击败时，翻开并结算记忆剧情。
export default {
  code: '08577', scope: 'enemy', implemented: true,
  enemyRule: { flipOnDefeat: true, preyPartner: '08595' },
  abilities: [{
    kind: 'reaction', trigger: 'resourcesGained', label: '它横置时你获得资源后：对它造成 1 伤害',
    criteria: ({ context, inv, source }) => context.seat === inv.seat && source.exhausted && context.amount > 0,
    resolve: ({ inv, source, api }) => api.damageEnemy(source, 1, inv.seat),
  }],
}
