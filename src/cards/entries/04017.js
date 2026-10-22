// 04017 求生匕首
// 卡面：[action]：攻击。你本次攻击得到+1[combat]。
// 卡面：[reaction]在敌军阶段期间，在敌人的攻击对你造成伤害后，横置求生匕首：攻击。本次攻击以刚刚发起攻击的敌人为目标。本次攻击你得到+2[combat]并造成+1伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04017 求生刀：主动攻击（战斗 +1）+ 敌人攻击造成伤害时反击。

export default {
  code: '04017',
  abilities: [
    {
      kind: 'action', label: '攻击（战斗 +1）', cost: { action: true },
      effect: { type: 'fight', combatBonus: 1, damageBonus: 0 },
    },
    {
      // 5c-31：不再走 tfaPlayer 逃生原语；攻击者从反应上下文的 `enemy` 取（与旧原语同一个字段）。
      kind: 'reaction', trigger: 'enemyAttackDamage', id: 'survivalKnife', legacyReaction: true,
      criteria: { selfOnly: true }, label: '敌人攻击造成伤害时反击',
      cost: { exhaust: true },
      resolve: ({ state, inv, api }) => {
        // 卡面限定「敌军阶段期间」。
        if (state.phase !== 'enemy') return
        const attacker = api.reactionContext()?.enemy
        if (!attacker || !api.isEnemyInPlay(attacker)) return
        api.fight(inv.seat, attacker.id, { combatBonus: 2, damageBonus: 1, noSpend: true })
      },
    },
  ],
  modifiers: [

  ],
}
