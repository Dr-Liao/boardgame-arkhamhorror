// 02036 弯刀
// 卡面：[action]：攻击。本次攻击你得到+1[combat]。如果你检定成功，你可以花费额外1个行动以使本次攻击造成+1伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02036',
  abilities: [
    {
      kind: 'action',
      label: '弯刀攻击（战斗 +1，可追加行动增加伤害）',
      cost: { action: true },
      effect: { type: 'fight', combatBonus: 1, damageBonus: 0, maySpendActionForDamage: 1 },
    },
  ],
  modifiers: [

  ],
}
