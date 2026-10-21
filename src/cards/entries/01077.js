// 01077 深挖
// 卡面：[free]花费1资源：你本次技能检定得到+1[willpower]。
// 卡面：[free]花费1资源：你本次技能检定得到+1[agility]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01077 体能训练（另一张同名不同卡）：意志 / 敏捷。

export default {
  code: '01077',
  freeTriggers: [
    { skill: 'willpower', cost: { resources: 1 }, bonus: 1 },
    { skill: 'agility', cost: { resources: 1 }, bonus: 1 },
  ],
  abilities: [

  ],
  modifiers: [

  ],
}
