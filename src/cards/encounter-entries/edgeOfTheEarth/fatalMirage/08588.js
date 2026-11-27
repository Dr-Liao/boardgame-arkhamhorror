// 08588 丹佛斯 · 坚毅伙伴
export default {
  code: '08588', scope: 'storyAsset', implemented: true,
  flags: { partner: true, resolute: true },
  uses: 5, usesType: 'secrets',
  abilities: [{
    kind: 'reaction', trigger: 'tekeliResolved', label: '横置并花费 1 秘密：该调查员抽 3 张；跳过抽到的忒咳哩-哩的显现',
    cost: { exhaust: true, uses: 1 },
    criteria: ({ inv, context }) => context.location === inv.location && Number.isInteger(context.seat),
    resolve: ({ api, context }) => api.drawCards(context.seat, 3, { skipTekeli: true }),
  }],
}
