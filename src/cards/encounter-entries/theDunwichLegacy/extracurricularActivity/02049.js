// 02049 人文学大楼
// 归属：关卡专用 · extracurricularActivity（敦威治遗产 · 课外活动）
// 遭遇组：extracurricular_activity
// 卡面：强制 - 当你的回合结束时，如果你在人文学大楼：弃掉你牌库顶的X张卡牌，其中X为你的恐惧数。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02049', scope: 'location',
  locationRule: { onTurnEnd(state, loc, api, inv) { api.discardTop(inv.seat, inv.horror) } },
}
