// 60322 艺高胆大
// 卡面：快速。你的技能检定将要成功时打出。
// 卡面：本次技能检定你的技能值+3。抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60322',
  abilities: [{
    kind: 'played', fast: true, trigger: 'wouldSucceedTest',
    label: '检定将要成功：技能值 +3，并抽 1 张牌',
    effect: {
      type: 'sequence',
      effects: [{ type: 'addTestValue', amount: 3 }, { type: 'draw', amount: 1 }],
    },
  }],
}
