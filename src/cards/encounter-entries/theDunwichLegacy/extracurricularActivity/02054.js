// 02054 教师办公室
// 归属：关卡专用 · extracurricularActivity（敦威治遗产 · 课外活动）
// 遭遇组：extracurricular_activity
// 卡面：强制 - 在教师办公室揭示后：查找遭遇牌库和弃牌堆，找出一张[[类人]]敌人并将其生成在此。混洗遭遇牌库。
// 卡面：目标 - 如果在教师办公室的调查员共同花费2[per_investigator]个线索：(→结局1)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02054', scope: 'location',
  locationRule: {
    scenarioActions: ['rescueRice'], facultyOfficeReveal: true,
    entryError(state, location) {
      return location.revealed ? null : '通往教师办公室的门锁住了。你不能移动进入教师办公室。'
    },
  },
}
