// 03311 时间曲折
// 卡面：快速。你所在地点的一位调查员在其回合期间结算完毕一次行动后立刻打出。
// 卡面：撤销该行动(游戏返回到该行动执行之前的状态，但仍然视作你打出了时间曲折，且该卡牌打出的费用不会返还)。(FAQ，v1.4)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03311 时间曲折：把一个动作的结算完全回滚（保留自己的手牌/资源/弃牌堆）。

export default {
  code: '03311',
  rewindAction: true,
  abilities: [
    {
      kind: 'played', fast: true, trigger: 'actionResolvedAtLocation',
      label: '回滚上一个动作',
      resolve: ({ inv, api }) => { api.rewindLastAction(inv.seat) },
    },
  ],
  modifiers: [

  ],
}
