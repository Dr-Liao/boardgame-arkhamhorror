// 03115 有胆有识
// 卡面：快速。[[沉稳]]卡牌场上仅限1张。
// 卡面：非直接恐惧在分配到你的调查员卡牌之前，必须先分配给有胆有识。
// 卡面：[free]花费1资源：你本次技能检定得到+1[willpower]。
// 卡面：[free]花费1资源：你本次技能检定得到+1[intellect]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03115',
  fast: true,
  composure: true,
  freeTriggers: [
    { skill: 'willpower', cost: { resources: 1 }, bonus: 1 },
    { skill: 'intellect', cost: { resources: 1 }, bonus: 1 },
  ],
  abilities: [

  ],
  modifiers: [

  ],
}
