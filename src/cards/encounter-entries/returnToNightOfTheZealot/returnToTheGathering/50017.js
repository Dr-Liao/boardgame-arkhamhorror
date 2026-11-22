// 50017 墙上的洞 / 走廊（Hole in the Wall / Hallway）· 地点 · return_to_the_gathering
// 卡面（揭示面「走廊」）：强制 - 走廊揭示后：将放在一边的阁楼、地窖和客厅地点放置入场。
// 读点：locations.js#revealLocation → locationRule.onReveal。
// 阁楼/地窖在 Setup 从两张中各随机取一（state.scenarioFlags.retGatheringVariants），因此按变体放置。

export default {
  code: '50017',
  scope: 'location',
  implemented: true,
  locationRule: {
    onReveal(state, loc, api) {
      void loc
      const variants = state.scenarioFlags?.retGatheringVariants || {}
      const ids = ['parlor', variants.atticId || 'attic', variants.cellarId || 'cellar']
      for (const id of ids) api.place(id)
      api.info('「走廊」揭示：放在一边的阁楼、地窖和客厅地点放置入场。')
    },
  },
}
