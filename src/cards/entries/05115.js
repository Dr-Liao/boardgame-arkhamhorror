// 05115 .45汤姆逊冲锋枪
// 卡面：使用(5子弹)。
// 卡面：[action]花费1子弹：攻击。本次攻击你得到+2[combat]并造成+1伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05115 .45汤姆逊冲锋枪：使用(5子弹)；[行动]花 1 子弹攻击 +2 战斗 +1 伤害。

export default {
  code: '05115',
  uses: 5,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action', label: '花 1 子弹攻击（战斗 +2，伤害 +1）',
      cost: { uses: 1 },
      effect: { type: 'fight', combatBonus: 2, damageBonus: 1 },
    },
  ],
  modifiers: [

  ],
}
