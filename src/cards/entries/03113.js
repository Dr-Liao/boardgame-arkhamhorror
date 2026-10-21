// 03113 情绪稳定
// 卡面：快速。[[沉稳]]卡牌场上仅限1张。
// 卡面：非直接恐惧在分配到你的调查员卡牌之前，必须先分配给情绪稳定。
// 卡面：[free]在[[法术]]卡牌的技能检定期间，花费1资源：你本次检定得到技能值+1。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03113',
  fast: true,
  composure: true,
  freeTriggers: [
    { skill: 'any', cost: { resources: 1 }, bonus: 1, requireTestTrait: 'Spell' },
  ],
  abilities: [

  ],
  modifiers: [

  ],
}
