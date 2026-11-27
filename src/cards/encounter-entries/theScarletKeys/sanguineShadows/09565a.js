// 09565a 恸哭女士（The Weeping Lady · Broken Statuette · [[Stable]] 面）· 绯红密钥
//
// 归属：关卡专用 · theScarletKeys/sanguineShadows（P7）。
// 卡面：
//   变换 - 发现你所在地点或连接地点的 1 个线索。将本钥匙翻至 [[Unstable]] 面。
export default {
  code: '09565a',
  scope: 'storyAsset',
  implemented: true,
  assetRule: {
    shift({ state, api, context }) {
      if (context.by !== 'investigator') return
      const seat = context.seat ?? context.bearer?.seat
      const current = state.locations.find(location => location.id === state.investigators[seat]?.location)
      if (!current) return
      const locations = state.locations.filter(location => (location.id === current.id || current.connections?.includes(location.id))
        && location.clues > 0 && api.canDiscoverClueAt(seat, location.id))
      if (!locations.length) return
      const chosen = locations.length === 1 ? locations[0].id : api.choose({
        kind: 'location', source: '09565a', seat,
        prompt: '恸哭女士：选择发现 1 个线索的地点。',
        options: locations.map(location => ({ id: location.id, label: location.name })),
      })
      api.discoverClue(seat, 1, locations.find(location => location.id === chosen)?.id ?? locations[0].id)
    },
  },
}
