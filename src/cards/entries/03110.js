// 03110 指节铜环
// 卡面：[action]：攻击。本次攻击造成+1伤害。被攻击敌人本次攻击获得反击。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03110',
  abilities: [
    {
      kind: 'action',
      label: '指节铜环攻击',
      cost: { action: true },
      effect: { type: 'fight', combatBonus: 0, damageBonus: 1, grantRetaliate: true },
    },
  ],
  modifiers: [

  ],
}
