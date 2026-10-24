// 05187 .45汤姆逊冲锋枪（潜袭者 · 3 经验）
// 卡面：使用(5子弹)。
// 卡面：[action]花费1子弹：攻击。本次攻击你得到+2[combat]并造成+1伤害。如果你检定成功且超过难度
//       至少X点，你可以花费1子弹以对你所在地点的另一个敌人造成本次攻击的伤害，其中X为该敌人的攻击值。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05187 .45汤姆逊冲锋枪（潜袭者）：攻击 +2 战斗 +1 伤害；成功且超出另一名敌人攻击值时可再花 1 子弹转伤。

export default {
  code: '05187',
  uses: 5,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action',
      label: '花 1 子弹攻击（战斗 +2，伤害 +1；超出另一敌人攻击值时可花 1 子弹转伤）',
      countsAs: 'fight',
      target: { kind: 'enemy' },
      cost: { uses: 1 },
      resolve: ({ state, inv, api, source, targetId }) => {
        const enemy = state.enemies.find(item => item.id === targetId)
        if (!enemy) return
        const result = api.fight(inv.seat, enemy.id, { combatBonus: 2, damageBonus: 1 })
        if (!result?.success) return
        if ((source?.uses || 0) < 1) return
        const successBy = result.value - result.difficulty
        // X = 另一名敌人的攻击值：只有成功点数够高时才能把本次攻击的伤害转给它。
        const candidates = state.enemies.filter(other => other.id !== enemy.id
          && other.location === inv.location
          && successBy >= api.enemyFight(other))
        if (!candidates.length) return
        const answer = api.choice({
          kind: 'target', source: '05187', seat: inv.seat, canSkip: true,
          prompt: '是否花费 1 子弹，把本次攻击的伤害转给另一个敌人？',
          options: [
            { id: 'skip', label: '不花费' },
            ...candidates.map(other => ({ id: other.id, label: `${other.name}（攻击值 ${api.enemyFight(other)}）` })),
          ],
        })
        const target = candidates.find(other => other.id === answer)
        if (!target) return
        api.addUses(source, -1)
        // 本次攻击的伤害 = 基础 1 + 卡面 +1。
        api.damageEnemy(target, 2, inv.seat)
        api.info(`💥 「.45汤姆逊冲锋枪」把本次攻击的伤害转给「${target.name}」（2 点）。`)
      },
    },
  ],
}
