// 02193 拳击家
// 卡面：永久。
// 卡面：[free]花费1资源：你本次技能检定得到+1[combat]。
// 卡面：[free]花费1资源：你本次技能检定得到+1[agility]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02193 老练探员：战斗 / 敏捷 +1。

export default {
  code: '02193',
  freeTriggers: [
    { skill: 'combat', cost: { resources: 1 }, bonus: 1 },
    { skill: 'agility', cost: { resources: 1 }, bonus: 1 },
  ],
  abilities: [

  ],
  modifiers: [

  ],
}
