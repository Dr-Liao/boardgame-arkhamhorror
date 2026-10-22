// 02139 亚当·林奇
// 卡面：你控制亚当·林奇时，将保安室的“[action][action]”能力视为如同一个“[action]”能力。
// 卡面：强制 - 在亚当·林奇离场时：将他从游戏中移除，并在混乱袋里加入1个[tablet]标记，直到剧本结束。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02139',
  assetRule: { securityKeys: true },
  discardOnElimination: true,
  abilities: [

  ],
  modifiers: [

  ],
}
