// 01043 隐秘的研究
// 卡面：快速。只能在你回合期间打出。
// 卡面：选择你所在地点的一位调查员。该调查员抽取3张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01043',
  abilities: [
    {
      kind: 'played',
      label: '隐秘的研究',
      fast: true,
      effect: {
        type: 'targetedEffect',
        target: 'location',
        effect: { type: 'draw', amount: 3 },
      },
    },
  ],
  modifiers: [

  ],
}
