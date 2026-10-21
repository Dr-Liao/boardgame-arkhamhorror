// 01017 体能训练
// 卡面：[free]花费1资源：你本次技能检定得到+1[willpower]。
// 卡面：[free]花费1资源：你本次技能检定得到+1[combat]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01017 体能训练：花 1 资源提升意志 / 战斗。

export default {
  code: '01017',
  freeTriggers: [
    { skill: 'willpower', cost: { resources: 1 }, bonus: 1 },
    { skill: 'combat', cost: { resources: 1 }, bonus: 1 },
  ],
  abilities: [

  ],
  modifiers: [

  ],
}
