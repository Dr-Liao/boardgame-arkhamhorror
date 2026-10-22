// 02234 黑马
// 卡面：每位调查员仅限1张。
// 卡面：在补给阶段期间，你可以选择不获得资源。
// 卡面：你资源池没有资源时，你得到+1[willpower]、+1[intellect]、+1[combat]和+1[agility]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02234',
  limitPerInvestigator: true,
  passive: {"darkHorse":true,"allStatsIfNoResources":1},
  abilities: [

  ],
  modifiers: [

  ],
}
