export default {
  code: '11013',
  abilities: [{
    kind: 'weakness', label: '将控制的枪械支援洗回牌库', weakness: { type: 'custom' },
    resolve: ({ inv, api }) => {
      const assets = inv.assets.filter(asset => api.effectiveTraits(asset.code).some(trait => trait.toLowerCase() === 'firearm'))
      const owners = new Set()
      for (const asset of assets) {
        if (api.returnAssetToDeck(inv.seat, asset)) owners.add(asset.ownerSeat ?? inv.seat)
      }
      if (owners.size) for (const seat of owners) api.shuffleDeck(seat)
      else {
        api.damage(inv.seat, 1)
        api.scheduleWeaknessShuffle(inv.seat, '11013')
      }
    },
  }],
}
