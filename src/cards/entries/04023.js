// 04023 埃兹特里之牙
// 卡面：结算诡计卡牌上的能力时，你得到+1[willpower]和+1[agility]。
// 卡面：[reaction]在你结算诡计卡牌上的能力时技能检定成功后，横置埃兹特里之牙：抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04023',
  passive: {"treacheryTestStats":{"willpower":1,"agility":1}},
  abilities: [
    {
      kind: 'reaction', trigger: 'treacheryTestSuccess', id: 'toothOfEztli', legacyReaction: true,
      criteria: { selfOnly: true }, label: '横置抽取 1 张牌', cost: { exhaust: true },
      effect: { type: 'draw', amount: 1 },
    },
  ],
  modifiers: [

  ],
}
