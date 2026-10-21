// 01036 心胜于物
// 卡面：快速。只能在你回合期间打出。
// 卡面：直到本轮结束，你可以用你的[intellect]代替你的[combat]和[agility]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01036',
  abilities: [
    {
      kind: 'played',
      label: '心胜于物',
      fast: true,
      effect: { type: 'substituteSkill', from: ['combat', 'agility'], to: 'intellect' },
    },
  ],
  modifiers: [

  ],
}
