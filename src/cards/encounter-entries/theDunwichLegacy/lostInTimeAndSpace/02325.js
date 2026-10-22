// 02325 菱柱瀑布
// 归属：关卡专用 · lostInTimeAndSpace（迷失时空）
// 遭遇组：lost_in_time_and_space
// 卡面：显现 - 将菱柱瀑布放置入场，并随机弃掉你一张手牌。
// 卡面：强制 - 在菱柱瀑布上最后的线索移除后：弃掉菱柱瀑布。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02325', scope: 'location',
  locationRule: {
    onDraw(state, loc, api, seat) { api.discardRandom(seat, 1) },
    onCluesRemoved(state, loc, api) {
      if ((loc.clues || 0) > 0) return
      api.remove(loc.id)
      state.encounterDiscard.push('02325')
      api.info?.('「菱柱瀑布」上的最后 1 个线索被移除，它被弃掉。')
    },
  },
}
