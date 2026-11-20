const CODE = '11039'
const FACES = ['skull', 'cultist', 'tablet', 'elderthing']

export default {
  code: CODE,
  fast: true,
  sharedSlotGroup: { id: CODE, slot: 'arcane', upTo: 3 },
  abilities: [{
    kind: 'reaction', trigger: 'tokenEffectWouldResolve',
    label: '弃掉此支援：取消此处揭示的符号并归袋重抽；检定成功则你抽 1 张牌',
    cost: { discardSelf: true },
    criteria: [({ inv, source, context, helpers }) => context.location === inv.location
      && FACES.includes(context.token) && !context.cannotCancel && !context.returnAndReroll && !context.rerollToken
      && helpers.canDiscardAsset(source)],
    resolve: ({ inv, context, api }) => {
      if (api.rerollCurrentTestToken(context, inv.seat)) api.addExtraOnSuccess({ type: 'draw', amount: 1, seat: inv.seat })
    },
  }],
}
