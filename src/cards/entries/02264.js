// 02264 奇怪的溶液
// 卡面：研究完成。使用(4补给)。
// 卡面：[action]花费1补给：躲避。以基础值为6的[agility]躲避。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02264',
  // 第 123 轮：升级前置记录由条目声明（原 src/campaign/campaign.js 的 researchRequirement 表）。
  researchRequirement: 'identifiedStrangeSolution',
  uses: 4,
  usesType: 'supplies',
  abilities: [
    {
      kind: 'action',
      label: '以基础敏捷值 6 躲避',
      cost: { action: true, uses: 1 },
      effect: { type: 'evade', baseValue: 6 },
    },
  ],
  modifiers: [

  ],
}
