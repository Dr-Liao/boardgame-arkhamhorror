// 02187 高等教育
// 卡面：永久。
// 卡面：你有至少5张手牌时，高等教育获得：
// 卡面：“[free]花费1资源：你本次技能检定得到+2[willpower]。
// 卡面：[free]花费1资源：你本次技能检定得到+2[intellect]。”
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02187 练习：意志 / 智识 +2（手牌足够才可用）。

export default {
  code: '02187',
  minimumHandForBoost: 5,
  freeTriggers: [
    { skill: 'willpower', cost: { resources: 1 }, bonus: 2 },
    { skill: 'intellect', cost: { resources: 1 }, bonus: 2 },
  ],
  abilities: [

  ],
  modifiers: [

  ],
}
