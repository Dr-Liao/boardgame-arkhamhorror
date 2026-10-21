// 03107 战斗训练
// 卡面：快速。[[沉稳]]卡牌场上仅限1张。
// 卡面：非直接恐惧在分配到你的调查员卡牌之前，必须先分配给战斗训练。
// 卡面：[free]花费1资源：你本次技能检定得到+1[combat]。
// 卡面：[free]花费1资源：你本次技能检定得到+1[agility]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03107 / 03109 / 03111 / 03113 / 03115：五张「沉静」天赋（快速 + 沉静 + 两组 +1）。

export default {
  code: '03107',
  fast: true,
  composure: true,
  freeTriggers: [
    { skill: 'combat', cost: { resources: 1 }, bonus: 1 },
    { skill: 'agility', cost: { resources: 1 }, bonus: 1 },
  ],
  abilities: [

  ],
  modifiers: [

  ],
}
