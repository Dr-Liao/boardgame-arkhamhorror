// 02029 仪式蜡烛
// 卡面：[reaction]你执行的技能检定期间揭示了[skull]、[cultist]、[tablet]或[elder_thing]符号后：你本次检定得到技能值+1。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02029 仪式蜡烛：揭示符号标记后，本次检定 +1。

export default {
  code: '02029',
  abilities: [
    {
      kind: 'reaction', trigger: 'symbolRevealed', id: 'ritualCandles', legacyReaction: true,
      criteria: { symbols: ['skull', 'cultist', 'tablet', 'elderthing'] }, label: '揭示符号标记后本次检定 +1',
      effect: { type: 'addCurrentTest', amount: 1 },
    },
  ],
  modifiers: [

  ],
}
