// 03020 .32柯尔特手枪
// 卡面：使用(6子弹)。
// 卡面：[action]花费1子弹：攻击。你本次攻击造成+1伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03020',
  uses: 6,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action',
      label: '.32柯尔特手枪攻击',
      cost: { action: true, uses: 1 },
      effect: { type: 'fight', combatBonus: 0, damageBonus: 1 },
    },
  ],
  modifiers: [

  ],
}
