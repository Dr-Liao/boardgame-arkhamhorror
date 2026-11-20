export default {
  code: '11019',
  abilities: [{
    kind: 'weakness', label: '弃掉所有暗置牌', weakness: { type: 'custom' },
    resolve: ({ inv, api }) => {
      const cards = api.commitOrigins.beneath(inv.seat, inv.code)
      if (!cards.length) api.scheduleWeaknessShuffle(inv.seat, '11019')
      else for (const code of cards) api.commitOrigins.take(inv.seat, inv.code, code, 'discard')
    },
  }],
}
