// 04229 1918勃朗宁自动步枪
// 卡面：使用(8子弹)。
// 卡面：[action]花费1-5子弹：攻击。你本次攻击得到+X[combat]。本次攻击不造成其基础伤害，改为造成X点伤害。X为作为本能力的费用花费的子弹数量。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04229 勃朗宁自动步枪：花 1–5 子弹，+X 战斗并造成 X 点伤害（旧 browning）。

export default {
  code: '04229',
  uses: 8,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action', label: '花费 1–5 子弹射击', cost: { action: true }, countsAs: 'fight', target: { kind: 'enemy' },
      resolve: ({ target, source, inv, api }) => {
        const rifle = source
        const max = Math.min(5, rifle?.uses || 0)
        if (!max) { api.info('没有子弹。'); return }
        const spend = max === 1 ? 1 : Number(api.choice({ kind: 'resource', source: '04229', seat: inv.seat,
          prompt: '选择本次攻击花费的子弹数量。',
          options: Array.from({ length: max }, (_, index) => ({
            id: String(index + 1), label: `${index + 1} 子弹（+${index + 1} 战斗，造成 ${index + 1} 伤害）`,
          })) }))
        api.addUses(rifle, -spend)
        if (!target?.entity) return
        api.fight(inv.seat, target.entity.id, { combatBonus: spend, damageOverride: spend })
      },
    },
  ],
  modifiers: [

  ],
}
