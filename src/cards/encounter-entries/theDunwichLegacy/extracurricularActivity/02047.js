// 02047 校园安全
// 归属：关卡专用 · extracurricularActivity（敦威治遗产 · 课外活动）
// 遭遇组：extracurricular_activity
// 卡面：目标-找到并完成另一张遭遇卡牌上的目标。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: '02047', scope: 'act', actRule: { onReveal(state, act, api) { api.finish('r3') } } }
