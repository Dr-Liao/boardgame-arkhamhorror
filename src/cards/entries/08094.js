// 08094 长柄大锤（0 级）
// 卡面：[action]：攻击。你本次攻击得到-1[combat]并造成+1伤害。
//       [action][action]：攻击。你本次攻击得到+2[combat]并造成+2伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。

export default {
  code: '08094',
  abilities: [
    { kind: 'action', label: '挥砸（战斗 -1，伤害 +1）', cost: { action: true }, countsAs: 'fight',
      effect: { type: 'fight', combatBonus: -1, damageBonus: 1 } },
    { kind: 'action', label: '全力挥砸（战斗 +2，伤害 +2）', cost: { action: 2 }, countsAs: 'fight',
      effect: { type: 'fight', combatBonus: 2, damageBonus: 2 } },
  ],
  modifiers: [],
}
