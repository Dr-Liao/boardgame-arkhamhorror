// 02024 酒胆
// 卡面：使用(4补给)。
// 卡面：[action]花费1补给：选择你所在地点的1位调查员治愈1点恐惧。然后，该调查员检定[willpower](2)。如果检定成功，其治愈额外1点恐惧。如果检定失败，其随机弃掉自己1张手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02024',
  uses: 4,
  usesType: 'supplies',
  abilities: [
    {
      kind: 'action',
      label: '治疗恐惧并检定意志',
      cost: { action: true, uses: 1 },
      effect: { type: 'liquidCourage' },
    },
  ],
  modifiers: [

  ],
}
