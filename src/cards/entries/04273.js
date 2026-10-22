// 04273 陈旧猎枪
// 卡面：使用(3子弹)。
// 卡面：[action]花费1子弹：攻击。你本次攻击得到+3[combat]并造成+2伤害。如果本次攻击期间揭示了[skull]或[auto_fail]符号，
//       猎枪卡膛了。(本次攻击自动失败。你再次激活本攻击能力之前，你必须执行以下能力：「[action]：你解决了卡膛情况。」)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04273 陈旧猎枪：战斗 +3、伤害 +2（合计 3）；揭示骷髅/自动失败即卡膛并自动失败，
// 卡膛期间攻击能力不可用，必须先用 [action] 清除卡膛。

export default {
  code: '04273',
  uses: 3,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action', id: 'oldHuntingRifleAttack',
      label: '花费 1 子弹：攻击（战斗 +3，伤害 +2）',
      cost: { action: true, uses: 1 },
      countsAs: 'fight',
      // 卡膛期间不能再次激活这个攻击能力。
      criteria: [({ source }) => source?.jammed !== true],
      effect: {
        type: 'fight',
        combatBonus: 3,
        damageBonus: 2,
        autoFailOnTokens: ['skull', 'autofail'],
        jamOnTokens: ['skull', 'autofail'],
      },
    },
    {
      kind: 'action', id: 'oldHuntingRifleClearJam',
      label: '[action]：你解决了卡膛情况',
      cost: { action: true },
      // 只有卡膛时才出现「清除卡膛」。
      criteria: [({ source }) => source?.jammed === true],
      resolve: ({ source, api }) => {
        if (source) delete source.jammed
        api.info('🔧 你解决了陈旧猎枪的卡膛情况。')
      },
    },
  ],
  modifiers: [

  ],
}
