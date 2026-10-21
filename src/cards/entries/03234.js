// 03234 .41短口手枪
// 卡面：使用(3子弹)。
// 卡面：[action]花费1子弹：攻击。你本次攻击得到+2[combat]。如果你检定成功且超过难度至少1点，本次攻击造成+1伤害。每回合一次，如果你检定成功且超过难度至少3点，你本回合可以进行额外一次行动。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03234',
  uses: 3,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action',
      label: '.41短口手枪攻击',
      cost: { action: true, uses: 1 },
      effect: {
        type: 'fight',
        combatBonus: 2,
        damageBonus: 0,
        damageOnSuccessBy: 1,
        gainActionOnSuccessBy: 3,
        gainActionLimit: 'turn',
      },
    },
  ],
  modifiers: [

  ],
}
