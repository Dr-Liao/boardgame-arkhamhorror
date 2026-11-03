export default {
  code: '07191', researchRequirement: 'youHaveTranslatedTheGrimoire', uses: 0, usesType: 'secrets',
  playTimingProvider: ({ state, inv, card, source }) => inv.assets.includes(source) && source.uses >= 2 && state.phase === 'investigation'
    && state.currentSeat === inv.seat && card.type === 'event' && card.traits.some(trait => trait.toLowerCase() === 'insight')
    ? { fast: true, discount: 1, cost: { uses: 2 } } : null,
  abilities: [
    { kind: 'reaction', trigger: 'chaosTokenResolved', label: '结算诅咒后：放置 1 个秘密', limit: { scope: 'perWindow', owner: 'instance' },
      criteria: ({ inv, context }) => context.seat === inv.seat && context.token === 'curse',
      resolve: ({ source, api }) => api.addUses(source, 1) },
    { kind: 'reaction', trigger: 'beforePlayCost', label: '花费 2 秘密：洞察事件快速且费用 -1', cost: { uses: 2 }, limit: { scope: 'perWindow', owner: 'instance' },
      criteria: ({ inv, source, state, context, helpers }) => context.fastSourceId === source.id && context.seat === inv.seat
        && state.phase === 'investigation' && state.currentSeat === inv.seat
        && helpers.cardType(context.cardCode) === 'event' && helpers.cardTraits(context.cardCode).some(trait => trait.toLowerCase() === 'insight'),
      resolve: ({ api, context }) => api.playerTools.modifyPlay(context, { discount: 1, fast: true }) },
  ],
}
