// 02052 宿舍
// 归属：关卡专用 · extracurricularActivity（敦威治遗产 · 课外活动）
// 遭遇组：extracurricular_activity
// 卡面：目标 - 如果在宿舍的调查员共同花费3[per_investigator]个线索：(→结局2)。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 地点的未揭示面「门锁住了，你不能移动进入」（P1 地点进入限制通道）。
// 读点：investigatorEntryError → locationRule.entryError；揭示后自动解除。
// 02054/02057/03172/03176/03177 的 entryError 合并进各自的既有条目。

export default { code: '02052', scope: 'location', implemented: true,
  locationRule: { entryError(state, location) {
    return location.revealed ? null : '通往宿舍的门锁住了。你不能移动进入宿舍。'
  } } }
