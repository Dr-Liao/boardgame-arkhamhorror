// 08715 丹佛斯 · 伙伴。使用（5 秘密）。
export default {
  code: '08715', scope: 'storyAsset', implemented: true,
  flags: { partner: true },
  uses: 5, usesType: 'secrets',
  abilities: [{
    kind: 'reaction', trigger: 'tekeliResolved',
    label: '横置并花费 1 秘密：结算忒咳哩-哩的同地点调查员抽 2 张牌',
    cost: { exhaust: true, uses: 1 },
    criteria: ({ inv, context }) => inv.location === context.location,
    resolve: ({ context, api }) => api.drawCards(context.seat, 2),
  }],
}
