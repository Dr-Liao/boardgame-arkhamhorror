// 02272 华服
// 卡面：在“谈判”行动期间，你执行的技能检定难度降低2点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02272',
  passive: {"parleyDifficultyModifier":-2},
  negotiationDifficultyReduction: 2,
  abilities: [

  ],
  modifiers: [

  ],
}
