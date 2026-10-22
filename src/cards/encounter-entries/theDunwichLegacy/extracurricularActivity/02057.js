// 02057 炼金实验室
// 归属：关卡专用 · extracurricularActivity（敦威治遗产 · 课外活动）
// 遭遇组：extracurricular_activity
// 卡面：[action]：调查。如果你检定成功，不发现线索，改为(如可能)拿取本地点底下的炼金试剂。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02057', scope: 'location',
  locationRule: {
    scenarioActions: ['searchConcoction'],
    entryError(state, location) {
      return location.revealed ? null : '通往炼金实验室的门锁住了。你不能移动进入炼金实验室。'
    },
  },
}
