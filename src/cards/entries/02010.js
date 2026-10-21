// 02010 珍妮的.45双枪
// 卡面：珍妮·巴恩斯牌库专用。使用(X子弹)。
// 卡面：[action]花费1子弹：攻击。本次攻击你得到+2[combat]。本次攻击造成+1伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02010',
  uses: 0,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action',
      label: '双枪射击（战斗 +2，伤害 +1）',
      cost: { action: true, uses: 1 },
      effect: { type: 'fight', combatBonus: 2, damageBonus: 1 },
    },
  ],
  chooseResourceCostOnPlay: true,
  modifiers: [

  ],
}
