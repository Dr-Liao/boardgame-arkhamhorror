export default {
  code: '11012',
  slotExemptions: [{ slot: 'hand', count: 2, traitsAny: ['firearm'] }],
  abilities: [{
    kind: 'reaction', trigger: 'assetPlayed', limit: { scope: 'perGame', owner: 'instance' }, label: '查找牌库顶 9 张中的枪械支援',
    criteria: ({ context, source }) => context.assetId === source.id,
    resolve: ({ inv, api }) => api.lookAt(inv.seat, {
      zone: 'investigatorDeck', count: 9, choose: 1, filter: { type: 'asset', trait: 'firearm' },
      returnStrategy: 'shuffle', source: '11012',
    }),
  }],
}
