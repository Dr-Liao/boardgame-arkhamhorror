// 02324 空间裂缝
// 归属：关卡专用 · lostInTimeAndSpace（迷失时空）
// 遭遇组：lost_in_time_and_space
// 卡面：涌动。
// 卡面：显现 - 将空间裂缝放置入场。
// 卡面：强制 - 当一轮结束时：在空间裂缝上放置1个毁灭标记，或将空间裂缝弃掉。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02324', scope: 'location',
  locationRule: {
    onDraw(state, loc, api, seat, meta) {
      // 涌动只在从遭遇牌库抽取时结算；从弃牌堆放入场不触发。
      if (meta?.fromDiscard) return
      api.drawEncounter(seat)
    },
  },
}
