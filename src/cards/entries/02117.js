// 02117 止痛药
// 卡面：使用(3补给)。
// 卡面：[free]花费1补给，横置止痛药，并受到1点恐惧：治愈1点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02117',
  uses: 3,
  usesType: 'supplies',
  abilities: [
    {
      kind: 'action',
      label: '受到 1 点恐惧，治愈 1 点伤害',
      cost: { action: false, exhaust: true, uses: 1 },
      effect: {
        type: 'sequence',
        effects: [{ type: 'takeHorror', amount: 1 }, { type: 'heal', amount: 1, what: 'damage' }],
      },
    },
  ],
  modifiers: [

  ],
}
