// 08068 治愈真言（Healing Words）· 秘术师（Mystic）资产 · 奥术 · 3 经验（06163 的升级版）。
//
// 卡面：使用(4 充能)。
//       [action] 花费 1 充能：治愈你所在地点调查员总计 2 点伤害。
//
// 一卡一文件：这张卡的行为只在这里维护。
// 读点：条目级 uses/usesType；目标走同地点调查员循环，治愈用 api.healDamage，
// 与 04304「煤油」的两点分配循环同口径。
export default {
  code: '08068',
  uses: 4,
  usesType: 'charges',
  discardWhenEmpty: true,
  abilities: [
    {
      kind: 'action',
      label: '花费 1 充能：治愈你所在地点调查员总计 2 点伤害',
      cost: { action: true, uses: 1 },
      resolve: ({ state, inv, api }) => {
        let remaining = 2
        while (remaining > 0) {
          const targets = api.investigatorsAt(inv.location).filter(owner => (owner.damage || 0) > 0)
          if (!targets.length) break
          const chosen = targets.length === 1 ? String(targets[0].seat)
            : api.choice({ kind: 'investigator', source: '08068', seat: inv.seat,
              prompt: `选择要治愈 1 点伤害的调查员（还可治愈 ${remaining} 点）。`,
              options: targets.map(owner => ({ id: String(owner.seat), label: owner.name })) })
          const seat = Number(chosen)
          if (!Number.isInteger(seat)) break
          api.healDamage(seat, 1)
          api.info(`🙏 「治愈真言」治愈了 ${state.investigators[seat]?.name || '调查员'} 1 点伤害。`)
          remaining -= 1
        }
      },
    },
  ],
  modifiers: [],
}
