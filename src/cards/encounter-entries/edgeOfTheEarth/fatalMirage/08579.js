// 08579 悔恨航程之记忆：被击败时，翻开并结算记忆剧情。
export default {
  code: '08579', scope: 'enemy', implemented: true,
  enemyRule: { flipOnDefeat: true, preyPartner: '08587' },
  abilities: [{
    kind: 'reaction', trigger: 'cardsDrawn', label: '它横置时你抽牌后：对它造成等量伤害',
    criteria: ({ context, inv, source }) => context.seat === inv.seat && source.exhausted && context.drawnCodes?.length > 0,
    resolve: ({ inv, source, context, api }) => api.damageEnemy(source, context.drawnCodes.length, inv.seat),
  }],
}
