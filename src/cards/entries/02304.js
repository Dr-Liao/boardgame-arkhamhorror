// 02304 芝加哥机关枪
// 卡面：使用(4子弹)。
// 卡面：[action]花费1子弹：攻击。你在执行本次攻击时，可以花费任意数量的额外行动。本次攻击每花费一个行动，你得到+2[combat](包括本能力的[action]费用)。本次攻击造成+2伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02304',
  uses: 4,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action',
      label: '芝加哥打字机攻击',
      cost: { action: true, uses: 1 },
      effect: {
        type: 'fight',
        combatBonus: 0,
        damageBonus: 2,
        additionalActionCombatBonus: 2,
      },
    },
  ],
  modifiers: [

  ],
}
