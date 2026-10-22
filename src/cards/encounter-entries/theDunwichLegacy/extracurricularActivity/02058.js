// 02058 实验体
// 归属：关卡专用 · extracurricularActivity（敦威治遗产 · 课外活动）
// 遭遇组：extracurricular_activity
// 卡面：庞大。
// 卡面：实验体得到+3[per_investigator]生命值
// 卡面：强制 - 在敌军阶段开始时：重整实验体。
// 卡面：目标 - 如果实验体被击败，推进到场景3b。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code:"02058",scope:"enemy",enemyRule:{healthPerPlayerBonus:3},enemyScript:{experiment:true,onPhaseStart(state,enemy){ enemy.exhausted=false }}}
