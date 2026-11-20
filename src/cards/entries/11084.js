const code = '11084'
const investigate = {
  kind: 'action',
  countsAs: 'investigate',
  label: '调查（智识 +1）；成功时可弃 1 手牌，使这次调查额外发现 1 个线索',
  criteria: ({ state, inv }) => state.locations.some(location => location.id === inv.location && !location.locked),
  resolve: ({ inv, source, api }) => api.investigate(inv.seat, {
    bonus: 1,
    assetId: source.handAbilityIndex == null ? source.id : undefined,
    successClueBonus: () => api.chooseOptionalHandDiscard(inv.seat, code) ? 1 : 0,
  }),
}

export default {
  code,
  abilities: [
    { ...investigate, cost: { action: true, exhaust: true } },
    { ...investigate, fromHand: true, cost: { action: true, discardSelf: true } },
  ],
}
