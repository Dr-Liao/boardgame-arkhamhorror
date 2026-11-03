// 05156 反应灵敏
// 卡面：快速。在任意调查员的回合期间(不含行动期间)打出。
// 卡面：立即进行一次行动，如同现在是你的回合。此行动不计入你每回合能够进行的行动数量。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 打出时机由行动间的快速卡窗口决定；即时行动由引擎结算并返回原调查员的回合。

export default {
  code: '05156',
  betweenActionsAnyTurn: true,
  abilities: [
    {
      kind: 'played', fast: true, label: '立即进行一次行动，如同现在是你的回合',
      resolve: ({ inv, api }) => {
        api.beginImmediateAction(inv.seat, { source: '05156' })
      },
    },
  ],
  modifiers: [],
}
