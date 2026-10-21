// 02262 奇怪的溶液
// 卡面：研究完成。使用(4补给)。
// 卡面：[action]花费1补给：治愈你所在地点一位调查员2点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02262',
  uses: 4,
  usesType: 'supplies',
  abilities: [
    {
      kind: 'action',
      label: '用溶液治疗同地点调查员 2 点伤害',
      cost: { action: true, uses: 1 },
      effect: {
        type: 'targetedEffect',
        target: 'location',
        effect: { type: 'heal', amount: 2, what: 'damage' },
      },
    },
  ],
  modifiers: [

  ],
}
