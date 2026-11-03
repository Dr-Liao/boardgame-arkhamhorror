export default {
  code: '07285', scope: 'location',
  locationRule: {
    onReveal(state, location, api) { api.mechanics.water.change(location.id, 1) },
  },
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '花费红色钥匙：取得受诅咒的伊哈-恩斯雷雕像',
    additionalKeyCost: { colors: ['red'] },
    criteria: ({ state }) => (state.scenarioZones?.setAside || []).includes('07300'),
    resolve: ({ inv, api }) => {
      if (api.scenario.takeFromSetAside('07300')) api.scenario.giveAsset(inv.seat, '07300')
    },
  }],
}
