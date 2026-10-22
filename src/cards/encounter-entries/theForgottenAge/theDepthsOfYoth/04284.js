// 04284 复仇
// 归属：关卡专用 · theDepthsOfYoth（失落的时代 · 幽嘶深渊）
// 遭遇组：the_depths_of_yoth
// 卡面：强制 - 当神话阶段的“检查毁灭阈值”步骤结束时：场上每有一个毁灭标记，调查员按照玩家顺序抽取额外1张遭遇卡牌。
// 卡面：目标 - 如果每位调查员被击败，推进本密谋。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 107 轮：幽嘶深渊的收尾密谋。

export default { code: '04284', scope: 'agenda', agendaRule: { onReveal(state, agenda, api) { api.finish('r1') } } }
