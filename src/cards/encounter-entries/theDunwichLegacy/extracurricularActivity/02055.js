// 02055 教师办公室
// 归属：关卡专用 · extracurricularActivity（敦威治遗产 · 课外活动）
// 遭遇组：extracurricular_activity
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: '02055', scope: 'location', implemented: true,
  locationRule: { entryError(state, location) {
    return location.revealed ? null : '通往教师办公室的门锁住了。你不能移动进入教师办公室。'
  } } }
