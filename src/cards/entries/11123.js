export default {
  code: '11123',
  fast: true,
  sharedSlotGroup: { id: 'sacredOath', slot: 'arcane', upTo: 3 },
  playCondition: [{
    when: ({ state }) => state.investigators.flatMap(inv => inv.assets)
      .filter(asset => ['11121', '11122', '11123'].includes(asset.code)).length < 3,
    message: '场上最多可以有 3 张神圣誓约',
  }],
  abilities: [{
    kind: 'reaction', trigger: 'treachery', label: '弃置智慧誓约：取消诡计的显现并弃置它',
    cost: { discardSelf: true },
    criteria: ({ inv, context, helpers }) => context.seat === inv.seat
      && !context.weakness && !context.cancelled && !context.cannotCancel
      && helpers.cardTraits(context.cardCode).some(trait => ['omen', 'power'].includes(trait.toLowerCase())),
    resolve: ({ context, api }) => api.playerTools.cancelRevelation(context),
  }],
  modifiers: [],
}
