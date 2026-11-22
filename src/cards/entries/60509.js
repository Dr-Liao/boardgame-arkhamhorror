export default {
  code: '60509',
  abilities: [{
    kind: 'free',
    label: '弃掉本卡并受到 1 点恐惧：发现 1 个线索',
    cost: { discardSelf: true, horror: 1 },
    criteria: ({ state, inv }) => state.locations.some(location => location.id === inv.location && location.clues > 0),
    effect: { type: 'discoverClue', amount: 1 },
  }],
}
