// 02111 过度深入
// 卡面：按玩家顺序，每位调查员抽取遭遇牌库顶的1张卡牌。然后，将过度深入加入胜利区。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02111 过度深入：打出后加入胜利区（事件本体由效果解释器结算）。

export default {
  code: '02111',
  abilities: [
    {
      kind: 'played', label: '过度深入', addToVictory: true,
      resolve: ({ state, api }) => {
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) api.drawEncounter(inv.seat)
      },
    },
  ],
  modifiers: [

  ],
}
