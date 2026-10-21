// 01101 黑帮打手
// 卡面：猎手。猎物。谈判 - 花费 4 资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01101',
  enemyWeakness: { hunter: true, prey: true, parleyCost: 4 },
  abilities: [],
  modifiers: [],
}
