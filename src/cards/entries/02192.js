// 02192 随机应变
// 卡面：只能投入你正在执行，且难度高于你基础技能值至少2点的技能检定。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02192',
  abilities: [
    {
      kind: 'commit',
      label: '随机应变',
      skill: { selfTestOnly: true, requireDifficultyAboveBase: 2 },
    },
  ],
  modifiers: [

  ],
}
