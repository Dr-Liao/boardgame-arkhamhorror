// 01006 罗兰 的.38特制手枪
// 卡面：罗兰·班克斯牌库专用。
// 卡面：使用(4子弹)。
// 卡面：[action]花费1子弹：攻击。你本次攻击得到+1[combat](如果你所在地点至少有1个线索，改为你得到+3[combat])。本次攻击造成+1伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01006',
  uses: 4,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action',
      label: '射击（战斗 +1；所在地点有线索时改为 +3，伤害 +1）',
      cost: { action: true, uses: 1 },
      effect: {
        type: 'fight',
        combatBonus: 1,
        ifCluesAtLocationCombatBonus: 2,
        damageBonus: 1,
      },
    },
  ],
  modifiers: [

  ],
}
