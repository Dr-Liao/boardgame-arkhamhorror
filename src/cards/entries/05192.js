// 05192 附魔剑（守护者 · 3 经验）
// 卡面：使用(3充能)。
// 卡面：[action]：攻击。你本次攻击得到+2[combat]。如果你检定成功，你可以花费1充能来为剑附魔，
//       使本次攻击造成+1伤害。如果剑已附魔且本次攻击击败了敌人，抽取1张卡牌并治愈1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05192 附魔剑（守护者）：攻击 +2 战斗；成功后可花 1 充能附魔（+1 伤害），附魔击败敌人时抽 1 治愈 1 恐惧。
//
// 实现备注：+1 伤害必须在攻击检定开始前就并入战斗结算，因此「是否花费 1 充能附魔」在检定前询问；
// 充能只在检定成功后才真正扣除（与卡面「如果你检定成功，你可以花费」的净结果一致）。

export default {
  code: '05192',
  uses: 3,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action',
      label: '攻击（战斗 +2；成功后可花 1 充能附魔：+1 伤害）',
      countsAs: 'fight',
      target: { kind: 'enemy' },
      resolve: ({ state, inv, api, source, targetId }) => {
        const enemy = state.enemies.find(item => item.id === targetId)
        if (!enemy) return
        let empower = false
        if ((source?.uses || 0) > 0) {
          empower = api.choice({
            kind: 'reaction', source: '05192', seat: inv.seat, canSkip: true,
            prompt: '如果你检定成功，是否花费 1 充能为剑附魔，使本次攻击 +1 伤害？',
            options: [{ id: 'skip', label: '不附魔' }, { id: 'empower', label: '花费 1 充能附魔（+1 伤害）' }],
          }) === 'empower'
        }
        const result = api.fight(inv.seat, enemy.id, { combatBonus: 2, damageBonus: empower ? 1 : 0 })
        if (!result?.success || !empower) return
        api.addUses(source, -1)
        api.info(`🔮 「附魔剑」花费 1 充能附魔（剩余 ${source.uses || 0}）。`)
        if (state.enemies.includes(enemy)) return
        // 剑已附魔且本次攻击击败了敌人。
        api.drawCards(inv.seat, 1)
        api.healHorror(inv.seat, 1)
        api.info(`✨ 附魔剑击杀了「${enemy.name}」：${inv.name} 抽取 1 张牌并治愈 1 点恐惧。`)
      },
    },
  ],
}
