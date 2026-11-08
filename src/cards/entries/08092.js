// 08092 克图格亚的烙印（4 级）
// 卡面：使用(9充能)。
//       [action]：攻击。你在本次攻击中得到+2技能值，并且可以不使用[combat]，改为使用[willpower]。
//       如果你成功，花费1、2或3充能。本次攻击不造成标准伤害，改为每花费1充能，造成1点伤害。
//       如果你成功且等于难度，失去2行动。
//
// 读点同 08090（api.fight + 成功回调改写 damageOverride）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。

export default {
  code: '08092',
  uses: 9,
  usesType: 'charges',
  abilities: [
    { kind: 'action', label: '烙印攻击（+2 技能值，可改用意志，按充能造成伤害）', cost: { action: true },
      target: { kind: 'enemy' }, countsAs: 'fight',
      resolve: ({ inv, source, target, api }) => {
        if (!target) return
        const skill = api.choice({ kind: 'effect', source: '08092', seat: inv.seat,
          prompt: '本次攻击使用哪项技能？', options: [
            { id: 'combat', label: '战斗' }, { id: 'willpower', label: '意志' },
          ] }) === 'willpower' ? 'willpower' : 'combat'
        api.fight(inv.seat, target.id, { skill, combatBonus: 2, assetId: source?.id, damageOverride: 0,
          onSuccess: ({ result, opts }) => {
            const max = Math.min(3, source?.uses || 0)
            if (max < 1) return
            const spend = api.choice({ kind: 'effect', source: '08092', seat: inv.seat,
              prompt: '花费充能：每花费 1 充能造成 1 点伤害。',
              options: Array.from({ length: max }, (_, offset) => ({ id: String(offset + 1), label: `花费 ${offset + 1} 充能` })) })
            const spent = Math.max(1, Math.min(max, Number(spend) || 1))
            api.spendUses(source, spent)
            opts.damageOverride = spent
            if (result && result.value - result.difficulty === 0) api.loseActions(inv.seat, 2)
          } })
      } },
  ],
  modifiers: [],
}
