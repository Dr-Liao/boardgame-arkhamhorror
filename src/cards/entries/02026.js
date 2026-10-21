// 02026 赌一把
// 卡面：每次技能检定最多投入1张。
// 卡面：本次技能检定难度翻倍。如果本次技能检定成功，结算检定成功效果两次。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02026',
  abilities: [
    {
      kind: 'commit',
      label: '赌一把',
      skill: { doubleDifficultyAndRewards: true, maxPerTest: 1 },
    },
  ],
  modifiers: [

  ],
}
