// 08578 饱经战乱的国家之记忆：被击败时，翻开并结算记忆剧情。
export default {
  code: '08578', scope: 'enemy', implemented: true,
  enemyRule: { flipOnDefeat: true, preyPartner: '08592' },
  abilities: [{
    kind: 'reaction', trigger: 'enemyAttacked', label: '它攻击你后：对它造成 1 伤害',
    criteria: ({ context, inv, source }) => context.seat === inv.seat && context.enemy === source,
    resolve: ({ inv, source, api }) => api.damageEnemy(source, 1, inv.seat),
  }],
}
