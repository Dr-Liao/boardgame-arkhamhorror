// 02051 学生会
// 归属：关卡专用 · extracurricularActivity（敦威治遗产 · 课外活动）
// 遭遇组：extracurricular_activity
// 卡面：强制 - 在学生会揭示后：将放在一边的宿舍放置入场。
// 卡面：[action][action]：治愈1点伤害和1点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 115 轮：课外活动（敦威治第一章）的地点场景行动。
// 行动文案与结算仍留在章节 behavior（只按 move.rule 分派），这里声明「这个地点提供哪些行动」。

export default {
  code: '02051', scope: 'location',
  locationRule: { scenarioActions: ['unionHeal'] },
}
