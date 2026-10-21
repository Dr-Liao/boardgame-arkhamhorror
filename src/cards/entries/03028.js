// 03028 潜行
// 卡面：[action]横置潜行：躲避。所选敌人本次躲避尝试得到-2躲避。如果你成功躲避该敌人，与它解除交战但不要横置它。直到你回合结束，该敌人不能与你交战。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03028',
  abilities: [
    {
      kind: 'action',
      label: '潜行躲避',
      cost: { action: true, exhaust: true },
      effect: {
        type: 'evade',
        evadeModifier: -2,
        noExhaustOnSuccess: true,
        preventEngageThisTurn: true,
      },
    },
  ],
  modifiers: [

  ],
}
