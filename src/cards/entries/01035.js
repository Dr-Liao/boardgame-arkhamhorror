// 01035 医学教科书
// 卡面：[action]：选择你所在地点的一位调查员并检定[intellect](2)。如果你检定成功，治愈该调查员1点伤害。如果你检定失败，对该调查员造成1点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01035',
  abilities: [
    {
      kind: 'action',
      label: '诊断（智识 2；同地点调查员成功治疗 1 伤害，失败受到 1 伤害）',
      cost: { action: true },
      effect: {
        type: 'targetedTest',
        target: 'location',
        skill: 'intellect',
        difficulty: 2,
        successEffect: { type: 'heal', amount: 1, what: 'damage' },
        failEffect: { type: 'takeDamage', amount: 1 },
      },
    },
  ],
  modifiers: [

  ],
}
