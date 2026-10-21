// 02154 皱缩术
// 卡面：使用(4充能)。
// 卡面：[action]花费1充能：攻击。本次攻击不使用[combat]，改为使用[willpower]。你本次攻击得到+2[willpower]并造成+1伤害。如果本次攻击期间揭示了[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]符号，受到1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02154',
  uses: 4,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action',
      label: '意志战斗 +2，伤害 +1',
      cost: { action: true, uses: 1 },
      effect: {
        type: 'fight',
        combatBonus: 2,
        damageBonus: 1,
        skill: 'willpower',
        onChaosSymbolHorror: 1,
      },
    },
  ],
  modifiers: [

  ],
}
