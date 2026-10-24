// 05156 反应灵敏
// 卡面：快速。在任意调查员的回合期间(不含行动期间)打出。
// 卡面：立即进行一次行动，如同现在是你的回合。此行动不计入你每回合能够进行的行动数量。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// P7：「立即进行一次行动、不计入每回合行动数」= 获得 1 个额外行动（api.gainAction）。
// 打出时机「任意调查员的回合期间、行动之间」由引擎的快速卡窗口决定：本条目只声明 fast，
// 引擎只在行动边界/玩家窗口里允许打出快速卡（行动结算中不会开窗口）。

export default {
  code: '05156',
  abilities: [
    {
      kind: 'played', fast: true, label: '立即获得 1 个不计入行动数的行动',
      resolve: ({ inv, api }) => {
        api.gainAction(inv.seat, 1)
        api.info(`${inv.name} 立即获得 1 个额外行动（不计入本回合行动数）。`)
      },
    },
  ],
  modifiers: [],
}
