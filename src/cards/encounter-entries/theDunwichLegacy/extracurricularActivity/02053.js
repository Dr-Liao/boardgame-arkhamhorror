// 02053 管理大楼
// 归属：关卡专用 · extracurricularActivity（敦威治遗产 · 课外活动）
// 遭遇组：extracurricular_activity
// 卡面：强制 - 在管理大楼揭示后：将放在一边的教师办公室放置入场。
// 卡面：强制 - 当你的回合结束时，如果你在管理大楼：弃掉你牌库顶1张卡牌。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02053', scope: 'location',
  locationRule: { onTurnEnd(state, loc, api, inv) { api.discardTop(inv.seat, 1) } },
}
