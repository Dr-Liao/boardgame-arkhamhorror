export default {
  code: '60401',
  kind: 'investigator',
  investigator: { elderSign: { bonus: 1 } },
  abilities: [{
    kind: 'reaction',
    id: '60401-extraReveal',
    trigger: 'beforeChaosTokenReveal',
    limit: 'oncePerRound',
    label: '此处将揭示标记时：多揭示 2 枚，取消 2 枚非自动失败或 1 枚自动失败标记',
    criteria: ({ inv, context }) => context.location === inv.location
      && !context.cancellationPlans?.some(plan => plan.seat === inv.seat),
    resolve: ({ api, inv, context }) => api.addChaosRevealCancellation(context, { seat: inv.seat, source: inv.code }),
  }, {
    kind: 'forced',
    trigger: 'chaosTokenChanged',
    label: '你的旧印效果被取消或忽略时：抽 1 张牌',
    criteria: ({ inv, context }) => (context.tokenOwnerSeat ?? context.seat) === inv.seat
      && context.token === 'eldersign' && ['cancel', 'ignore'].includes(context.change),
    resolve: ({ api, inv }) => api.drawCards(inv.seat, 1),
  }],
}
