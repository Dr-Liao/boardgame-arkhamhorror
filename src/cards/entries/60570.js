// 60570 额外配给 · 支援（2 费，1 经验，+2 万用图标，物品/补给）
// 卡面：使用（4 补给）。如果没有补给，将其弃掉。
//       [free]花费 1 补给并横置本卡：治愈你的调查员或你控制的一个[[盟友]]支援 1 点伤害。
const CODE = '60570'

export default {
  code: CODE,
  uses: 4,
  usesType: 'supplies',
  discardWhenEmpty: true,
  abilities: [{
    kind: 'action',
    actionKind: 'activate',
    label: '花费 1 补给并横置：治愈你的调查员或一个[[盟友]] 1 点伤害',
    cost: { action: false, exhaust: true, uses: 1 },
    resolve: ({ inv, api }) => {
      const allies = (inv.assets || []).filter(asset => {
        const traits = api.cardTraits(asset.code).map(trait => String(trait).toLowerCase())
        return traits.includes('ally') && (asset.damage || 0) > 0
      })
      const options = [{ id: 'self', label: `${inv.name}（自身）` },
        ...allies.map(asset => ({ id: asset.id, label: `${api.cardName(asset.code)}（伤害 ${asset.damage}）` }))]
      if ((inv.damage || 0) <= 0) options.shift()
      if (!options.length) return
      const picked = options.length === 1 ? options[0].id : api.choice({
        kind: 'target', source: CODE, seat: inv.seat,
        prompt: '额外配给：选择要治愈 1 点伤害的目标。', options,
      })
      if (picked === 'self') {
        api.healDamage(inv.seat, 1)
        return
      }
      const ally = allies.find(asset => asset.id === picked)
      if (ally) {
        api.healAsset(ally, { damage: 1 })
        api.info(`额外配给：治愈「${api.cardName(ally.code)}」1 点伤害。`)
      }
    },
  }],
  modifiers: [],
}
