// 60303 嚣张
// 卡面：你进行的每次可以投入嚣张的技能检定，必须投入嚣张。
// 卡面：本技能的图标不增加你的技能值，改为从中减去。
// 卡面：如果本次技能检定成功，将本技能返回手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60303',
  weaknessStaysInHand: true,
  weaknessHandNote: '「傲慢」留在手中；必须投入每次符合条件的自身检定。',
  abilities: [{
    kind: 'commit',
    label: '强制投入自身适用的检定，图标从技能值中减去；成功则收回',
    skill: {
      selfTestOnly: true,
      mustCommitNextTest: true,
      subtractIcons: true,
      destination: ({ result }) => result?.success ? 'hand' : undefined,
    },
  }],
}
