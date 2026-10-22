// 02045 下班时间
// 归属：关卡专用 · extracurricularActivity（敦威治遗产 · 课外活动）
// 遭遇组：extracurricular_activity
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 7 批：课外活动（敦威治第一章）的幕/密谋/地点/敌人脚本从 behavior.js 搬来。

export default {
  code: '02045', scope: 'act',
  actRule: { onReveal(state, act, api) { state.encounterDeck.push('02060'); api.shuffleDiscard() } },
}
