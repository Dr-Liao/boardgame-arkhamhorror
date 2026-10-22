// 02056 科学大楼
// 归属：关卡专用 · extracurricularActivity（敦威治遗产 · 课外活动）
// 遭遇组：extracurricular_activity
// 卡面：强制 - 在科学大楼揭示后：将放在一边的炼金实验室放置入场。
// 卡面：强制 - 在你于科学大楼[willpower]检定失败时：受到1点伤害。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02056', scope: 'location',
  locationRule: {
    onTestFail(state, loc, api, inv, result) {
      if (result.skill === 'willpower') api.damage(inv.seat, 1)
    },
  },
}
