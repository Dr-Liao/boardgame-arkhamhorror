// 02239 恐惧爆发
// 归属：关卡专用 · undimensionedAndUnseen（无人知晓）
// 遭遇组：undimensioned_and_unseen
// 卡面：每个[[异形]]敌人得到+1攻击和+1躲避。
// 卡面：强制 - 当敌军阶段结束时：将每个犹格·索托斯之子敌人朝一个随机地点移动一次。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02239', scope: 'agenda',
  agendaRule: { onReveal(state, agenda, api) { api.finish('r1') } },
}
