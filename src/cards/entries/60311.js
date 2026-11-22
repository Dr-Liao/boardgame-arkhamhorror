// 60311 街头浪子
// 卡面：[fast]花费2资源：本次技能检定你得到+2[intellect]。
// 卡面：[fast]花费2资源：本次技能检定你得到+2[agility]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60311',
  freeTriggers: [
    { skill: 'intellect', cost: { resources: 2 }, bonus: 2 },
    { skill: 'agility', cost: { resources: 2 }, bonus: 2 },
  ],
}
