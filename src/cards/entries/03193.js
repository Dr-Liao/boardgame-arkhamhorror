// 03193 古代雕文
// 卡面：研究完成。(FAQ，v2.0)使用(3充能)。
// 卡面：[action]花费1充能：调查。如果你检定成功，你可以自动躲避一个与你交战的敌人。本行动不会触发趁乱攻击。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03193',
  uses: 3,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action',
      label: '预言调查',
      cost: { action: true, uses: 1 },
      effect: { type: 'investigate', autoEvadeOnSuccess: true, noOpportunityAttack: true },
    },
  ],
  modifiers: [

  ],
}
