// 04309 孤注一掷
// 卡面：每次技能检定最多投入1张。
// 卡面：如果本次检定成功，你每超过难度1点，抽取1张卡牌，最多抽取5张。将所有以此效果抽取的弱点洗回你的牌库，不要结算它们。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04309',
  abilities: [
    {
      kind: 'commit',
      label: '孤注一掷',
      skill: {
        maxPerTest: 1,
        onSuccess: { drawPerSuccessBy: 1, maxDraw: 5, shuffleWeaknessesDrawn: true },
      },
    },
  ],
  modifiers: [

  ],
}
