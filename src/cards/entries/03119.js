// 03119 绝命奔逃
// 卡面：每次技能检定最多投入1张。
// 卡面：你剩余神智值为3点或更少才可投入技能检定。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03119',
  abilities: [
    {
      kind: 'commit',
      label: '绝命奔逃',
      skill: { maxPerTest: 1, remainingSanityAtMost: 3 },
    },
  ],
  modifiers: [

  ],
}
