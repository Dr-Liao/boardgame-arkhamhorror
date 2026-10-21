// 02030 净心术
// 卡面：使用(3充能)。
// 卡面：[action]花费1充能：治愈你所在地点一位调查员1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02030',
  uses: 3,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action',
      label: '同地点调查员治疗 1 恐惧',
      cost: { action: true, uses: 1 },
      effect: {
        type: 'targetedEffect',
        target: 'location',
        effect: { type: 'heal', amount: 1, what: 'horror' },
      },
    },
  ],
  modifiers: [

  ],
}
