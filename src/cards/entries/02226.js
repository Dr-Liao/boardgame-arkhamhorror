// 02226 春田M1903
// 卡面：使用(3子弹)。
// 卡面：[action]花费1子弹：攻击。本次攻击你得到+3[combat]并造成+2伤害。不能用于攻击与你交战的敌人。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02226',
  uses: 3,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action',
      label: '春田步枪攻击',
      cost: { action: true, uses: 1 },
      effect: { type: 'fight', combatBonus: 3, damageBonus: 2, requireNotEngagedTarget: true },
    },
  ],
  modifiers: [

  ],
}
