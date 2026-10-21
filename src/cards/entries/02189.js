// 02189 街头浪子
// 卡面：永久。
// 卡面：[free]花费2资源：你本次技能检定得到+3[intellect]。
// 卡面：[free]花费2资源：你本次技能检定得到+3[agility]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02189 坚持不懈：智识 / 敏捷 +3。

export default {
  code: '02189',
  freeTriggers: [
    { skill: 'intellect', cost: { resources: 2 }, bonus: 3 },
    { skill: 'agility', cost: { resources: 2 }, bonus: 3 },
  ],
  abilities: [

  ],
  modifiers: [

  ],
}
