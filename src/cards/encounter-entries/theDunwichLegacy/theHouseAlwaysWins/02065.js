// 02065 混乱俱乐部
// 归属：关卡专用 · theHouseAlwaysWins（敦威治遗产 · 百赌百胜）
// 遭遇组：the_house_always_wins
// 卡面：强制 - 当敌军阶段开始时：弃掉和[[异形]]敌人在同一个地点的每个[[罪犯]]敌人。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02065', scope: 'agenda',
  agendaRule: {
    // 第 115 轮：敌军阶段开始时弃掉与异形同地点的罪犯（读者在章节 behavior）。
    discardsCriminalsWithAbomination: true,
    onReveal(state, agenda, api) { api.finish('r4') },
  },
}
