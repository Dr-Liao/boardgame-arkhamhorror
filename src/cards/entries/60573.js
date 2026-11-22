// 60573 水壶 · 支援（饰品槽，1 费，2 经验，意志图标，物品）
// 卡面：使用（3 补给）。
//       [free]花费 1 补给并横置本卡：治愈 2 点恐惧。
const CODE = '60573'

export default {
  code: CODE,
  uses: 3,
  usesType: 'supplies',
  discardWhenEmpty: true,
  abilities: [{
    kind: 'action',
    actionKind: 'activate',
    label: '花费 1 补给并横置：治愈 2 点恐惧',
    cost: { action: false, exhaust: true, uses: 1 },
    resolve: ({ inv, api }) => {
      if ((inv.horror || 0) <= 0) return
      api.healHorror(inv.seat, 2)
      api.info(`水壶：${inv.name} 治愈 2 点恐惧。`)
    },
  }],
  modifiers: [],
}
