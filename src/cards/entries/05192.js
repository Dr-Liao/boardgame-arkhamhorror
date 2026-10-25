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
// 第六轮：走引擎新原语 api.fight 的 maySpendUsesForDamage（combat.js:298-316）——引擎在检定成功后
// 询问是否花费 1 充能、扣充能、+1 伤害，并给 sourceAsset.empowered += 1。条目不再在检定前预问、
// 也不手动扣充能；「剑已附魔」读 source.empowered（持久状态，多回合有效）。

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
        const result = api.fight(inv.seat, enemy.id, {
          combatBonus: 2,
          assetId: source?.id,
          maySpendUsesForDamage: { uses: 1, damage: 1 },
        })
        if (!result?.success) return
        const empowered = Number(source?.empowered || 0) > 0
        const defeated = result.attackResult?.defeated === true
          || !state.enemies.includes(enemy)
          || enemy.defeated === true
        if (!empowered || !defeated) return
        // 剑已附魔且本次攻击击败了敌人。
        api.drawCards(inv.seat, 1)
        api.healHorror(inv.seat, 1)
        api.info(`✨ 附魔剑击杀了「${enemy.name}」：${inv.name} 抽取 1 张牌并治愈 1 点恐惧。`)
      },
    },
  ],
}
