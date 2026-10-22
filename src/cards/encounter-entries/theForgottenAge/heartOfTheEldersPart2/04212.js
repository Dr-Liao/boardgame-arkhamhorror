// 04212 黑暗中的眼睛
// 归属：关卡专用 · heartOfTheEldersPart2（久远腹地（下））
// 遭遇组：knyan
// 卡面：[action]如果你所在地点没有线索：探索。抽取探索牌库顶的一张卡牌。如果该卡牌是一个连接地点，将其放置入场，并移动到该地点。
// 卡面：*本密谋得到+1[per_investigator]毁灭阈值。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 7 批：失落时代「久远腹地（下）」的简单幕/密谋分支。

export default {
  code: '04212', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) {
        api.trauma(inv.seat, 'physical', 1)
        api.defeat(inv, null)
      }
    },
  },
}
