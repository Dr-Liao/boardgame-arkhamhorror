// 01060 皱缩术
// 卡面：使用(4充能)。
// 卡面：[action]花费1充能：攻击。本次攻击不使用[combat]，改为使用[willpower]，并造成+1伤害。如果本次攻击期间揭示了[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]符号，受到1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01060',
  uses: 4,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action',
      label: '法术攻击（意志检定，伤害 +1；揭示负面符号受 1 恐惧）',
      cost: { action: true, uses: 1 },
      effect: { type: 'fight', skill: 'willpower', damageBonus: 1, onChaosSymbolHorror: 1 },
    },
  ],
  modifiers: [

  ],
}
