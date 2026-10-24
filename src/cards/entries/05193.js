// 05193 附魔剑（神秘学家 · 3 经验）
// 卡面：使用(4充能)。
// 卡面：[action]：攻击。你本次攻击得到+2[combat]。作为使用本能力的额外费用，你可以花费最多2充能来
//       为剑附魔(每以此方式花费1充能，本次攻击你得到+1[combat]并造成+1伤害)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05193 附魔剑（神秘学家）：攻击 +2 战斗；额外费用最多花 2 充能，每点 +1 战斗 +1 伤害。

export default {
  code: '05193',
  uses: 4,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action',
      label: '攻击（战斗 +2；可额外花最多 2 充能，每点 +1 战斗 +1 伤害）',
      countsAs: 'fight',
      target: { kind: 'enemy' },
      resolve: ({ state, inv, api, source, targetId }) => {
        const enemy = state.enemies.find(item => item.id === targetId)
        if (!enemy) return
        const maximum = Math.min(2, source?.uses || 0)
        let spend = 0
        if (maximum > 0) {
          const answer = api.choice({
            kind: 'resource', source: '05193', seat: inv.seat,
            prompt: '作为额外费用，你可以花费最多 2 充能为剑附魔。',
            options: Array.from({ length: maximum + 1 }, (_, amount) => ({
              id: String(amount),
              label: amount === 0 ? '不花费充能' : `花费 ${amount} 充能（+${amount} 战斗，+${amount} 伤害）`,
            })),
          })
          spend = Math.min(maximum, Math.max(0, Number(answer) || 0))
        }
        if (spend) api.addUses(source, -spend)
        api.fight(inv.seat, enemy.id, { combatBonus: 2 + spend, damageBonus: spend })
      },
    },
  ],
}
