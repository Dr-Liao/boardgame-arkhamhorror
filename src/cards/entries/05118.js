// 05118 附魔剑
// 卡面：使用(3充能)。
// 卡面：[action]：攻击。你本次攻击得到+1[combat]。作为发动本能力的额外费用，
// 你可以花费1充能来为剑附魔。如果你这么做，本次攻击你得到+1[combat]并造成+1伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// P7：[action] 攻击走 api.fight；可选的额外充能费用在 resolve 里询问后用 api.setAssetUses 扣除
// （引擎没有 optionalCost 通道，与 05114 切肉刀同一写法）。

export default {
  code: '05118',
  uses: 3,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action', label: '攻击（+1 战斗；可花 1 充能再 +1 战斗/+1 伤害）',
      cost: { action: true },
      target: { kind: 'enemy' },
      resolve: ({ inv, source, target, api }) => {
        const enemy = target?.entity
        if (!enemy) return
        let combatBonus = 1
        let damageBonus = 0
        if ((source?.uses || 0) > 0) {
          const answer = api.choice({ kind: 'effect', source: '05118', seat: inv.seat, canSkip: true,
            prompt: '附魔剑：是否花费 1 充能附魔（再 +1 战斗、+1 伤害）？',
            options: [{ id: 'skip', label: '不花费充能' }, { id: 'empower', label: '花费 1 充能' }] })
          if (answer === 'empower') {
            api.setAssetUses(source, (source.uses || 0) - 1)
            combatBonus += 1
            damageBonus += 1
            api.info(`${inv.name} 花费 1 充能附魔附魔剑。`)
          }
        }
        api.fight(inv.seat, enemy.id, { combatBonus, damageBonus })
      },
    },
  ],
  modifiers: [],
}
