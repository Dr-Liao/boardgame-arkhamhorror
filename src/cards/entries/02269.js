// 02269 奥鲁斯的珠宝
// 卡面：[reaction]你所在地点的技能检定期间揭示[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]符号后，横置奥鲁斯的珠宝：抽取1张卡牌或获得2资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02269 金色宝石：揭示标记后横置，二选一（抽牌 / 获得 2 资源）。

export default {
  code: '02269',
  abilities: [
    {
      kind: 'reaction', trigger: 'symbolRevealed', id: 'jewelAureolus', legacyReaction: true,
      criteria: { symbols: ['skull', 'cultist', 'tablet', 'elderthing', 'autofail'] },
      label: '揭示标记后横置：抽牌或获得 2 资源', cost: { exhaust: true },
      effect: { type: 'chooseOne', options: [
        { label: '抽牌', effect: { type: 'draw', amount: 1 } },
        { label: '获得资源', effect: { type: 'gainResource', amount: 2 } },
      ] },
    },
  ],
  modifiers: [

  ],
}
