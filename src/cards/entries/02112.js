// 02112 死亡之歌
// 卡面：使用(5充能)。
// 卡面：[action]花费1充能：攻击。本次攻击不使用[combat]，改为使用[willpower]。你本次攻击得到+1[willpower]。如果本次攻击期间揭示了[skull]符号，本次攻击造成+2伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02112',
  uses: 5,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action',
      label: '亡者之歌攻击',
      cost: { action: true, uses: 1 },
      effect: {
        type: 'fight',
        combatBonus: 1,
        damageBonus: 0,
        skill: 'willpower',
        skullDamageBonus: 2,
      },
    },
  ],
  modifiers: [

  ],
}
