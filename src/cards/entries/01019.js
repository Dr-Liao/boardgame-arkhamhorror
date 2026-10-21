// 01019 急救
// 卡面：使用(3补给)。如果急救没有补给，将其弃掉。
// 卡面：[action]花费1补给：治愈你所在地点的一位调查员1点伤害或1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01019',
  uses: 3,
  usesType: 'supplies',
  discardWhenEmpty: true,
  abilities: [
    {
      kind: 'action',
      label: '治疗 1 伤害或 1 恐惧',
      cost: { action: true, uses: 1 },
      effect: {
        type: 'targetedEffect',
        target: 'location',
        effect: {
          type: 'chooseOne',
          options: [
            { label: '治疗 1 伤害', effect: { type: 'heal', amount: 1, what: 'damage' } },
            { label: '治疗 1 恐惧', effect: { type: 'heal', amount: 1, what: 'horror' } },
          ],
        },
      },
    },
  ],
  modifiers: [

  ],
}
