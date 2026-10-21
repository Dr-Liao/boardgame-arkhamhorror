// 01020 大砍刀
// 卡面：[action]：攻击。你本次攻击得到+1[combat]。如果被攻击的敌人是唯一与你交战的敌人，本次攻击造成+1伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01020',
  abilities: [
    {
      kind: 'action',
      label: '战斗（战斗 +1，仅与目标交战时伤害 +1）',
      cost: { action: true },
      effect: { type: 'fight', combatBonus: 1, onlyEngagedDamage: 1 },
    },
  ],
  modifiers: [

  ],
}
