// 04036 殊死一搏
// 卡面：在一次未投入其他卡牌的技能检定中，才能投入本卡牌。该次技能检定不能投入其他卡牌。
// 卡面：你手牌中每有一张卡牌，殊死一搏失去[wild]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04036',
  abilities: [
    {
      kind: 'commit',
      label: '殊死一搏',
      skill: { noOtherCommits: true, wildLosesPerHandCard: true },
    },
  ],
  modifiers: [

  ],
}
