// 03190 .45自动手枪
// 卡面：使用(4子弹)。
// 卡面：[action]花费1子弹：攻击。你本次攻击得到+2[combat]。本次攻击造成+1伤害。本次攻击忽略反击关键词。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03190',
  uses: 4,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action',
      label: '.45自动手枪攻击',
      cost: { action: true, uses: 1 },
      effect: { type: 'fight', combatBonus: 2, damageBonus: 1, ignoreRetaliate: true },
    },
  ],
  modifiers: [

  ],
}
