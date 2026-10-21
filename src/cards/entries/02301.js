// 02301 闪电枪
// 卡面：使用(3子弹)。
// 卡面：[action]花费1子弹：攻击。本次攻击你得到+5[combat]。本次攻击造成+2伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02301',
  uses: 3,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action',
      label: '战斗 +5，伤害 +2',
      cost: { action: true, uses: 1 },
      effect: { type: 'fight', combatBonus: 5, damageBonus: 2 },
    },
  ],
  modifiers: [

  ],
}
