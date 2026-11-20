const choices = [
  { id: 'draw', label: '抽 2 张牌', available: ({ inv, api }) => api.canDrawCards(inv.seat),
    resolve: ({ inv, api }) => api.drawCards(inv.seat, 2) },
  { id: 'clue', label: '在本地点发现 1 个线索', available: ({ inv, api }) => api.canDiscoverClueAt(inv.seat, inv.location),
    resolve: ({ inv, api }) => api.discoverClue(inv.seat, 1, inv.location) },
  { id: 'damage', label: '治疗 1 点伤害', available: ({ inv }) => inv.damage > 0,
    resolve: ({ inv, api }) => api.healDamage(inv.seat, 1) },
  { id: 'horror', label: '治疗 1 点恐惧', available: ({ inv }) => inv.horror > 0,
    resolve: ({ inv, api }) => api.healHorror(inv.seat, 1) },
]

export default {
  code: '11106',
  abilities: [{
    kind: 'played',
    label: '选择两项，按所选顺序结算',
    resolve: context => {
      const { inv, api } = context
      const selected = new Set()
      for (let step = 0; step < 2; step++) {
        const remaining = choices.filter(option => !selected.has(option.id) && option.available(context))
        if (!remaining.length || inv.defeated || inv.resigned) break
        const choice = remaining.length === 1 ? remaining[0].id : api.choice({
          kind: 'effect', source: '11106', seat: inv.seat, prompt: '选择纯粹觉醒结算的效果。',
          options: remaining.map(({ id, label }) => ({ id, label })),
        })
        selected.add(choice)
        remaining.find(option => option.id === choice).resolve(context)
      }
    },
  }],
}
