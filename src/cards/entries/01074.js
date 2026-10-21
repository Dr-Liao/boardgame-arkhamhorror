// 01074 球棒
// 卡面：[action]：攻击。你本次攻击得到+2[combat]。本次攻击造成+1伤害。如果攻击期间抽出[skull]或[auto_fail]符号，在攻击结算后弃掉球棒。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01074',
  abilities: [
    {
      kind: 'action',
      label: '挥击（战斗 +2，伤害 +1；骷髅或自动失败时弃置）',
      cost: { action: true },
      effect: {
        type: 'fight',
        combatBonus: 2,
        damageBonus: 1,
        discardOnTokens: ['skull', 'autofail'],
      },
    },
  ],
  modifiers: [

  ],
}
