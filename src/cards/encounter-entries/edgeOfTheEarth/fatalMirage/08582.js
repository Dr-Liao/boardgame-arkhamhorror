// 08582 翻译异星文字之记忆：被击败时，翻开并结算记忆剧情。
export default {
  code: '08582', scope: 'enemy', implemented: true,
  enemyRule: { flipOnDefeat: true, preyPartner: '08594' },
  abilities: [{
    kind: 'reaction', trigger: 'enemyExhausted', label: '它于有附属牌的地点横置后：对它造成 4 伤害',
    criteria: ({ state, context, source }) => context.enemy === source
      && state.locations.find(location => location.id === source.location)?.attachments?.length > 0,
    resolve: ({ inv, source, api }) => api.damageEnemy(source, 4, inv.seat),
  }],
}
