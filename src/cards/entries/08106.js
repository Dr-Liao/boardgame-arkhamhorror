// 08106 威廉·韦伯教授（2 级）
// 卡面：使用(3秘密)。
//       [reaction]在你调查成功时，横置威廉·韦伯教授并花费1秘密：在你的弃牌堆中选择一张[[道具]]卡牌，
//       将其加入你的手中。你可以不发现你所在地点的1个线索，改为在一个连接地点发现1个线索。
//
// 读点同 08104：investigateSuccess 窗口 + {exhaust, uses} 费用 + api.moveCard / api.discoverClue。
//
// 替代一条标准调查线索，其他额外线索照常结算。
// 一张卡一个文件：这张卡的行为只在这里维护。

export default {
  code: '08106',
  uses: 3,
  usesType: 'secrets',
  abilities: [
    { kind: 'reaction', trigger: 'investigateSuccess', label: '调查成功：横置并花 1 秘密，取回道具（可改为连接地点发现线索）',
      cost: { exhaust: true, uses: 1 },
      criteria: ({ state, inv, source, context, helpers }) => {
        if (!source || context?.seat !== inv.seat) return false
        const location = state.locations.find(item => item.id === context.location)
        return inv.discard.some(code => helpers.cardTraits(code).some(trait => String(trait).toLowerCase() === 'item'))
          || Boolean(location?.clues > 0 && location.connections?.some(id => helpers.canDiscoverClueAt(inv.seat, id)))
      },
      resolve: ({ state, inv, source, context, api }) => {
        if (!source) return
        const items = [...new Set(inv.discard.filter(code => api.cardTraits(code).some(trait => String(trait).toLowerCase() === 'item')))]
        if (items.length) {
          const code = items.length === 1 ? items[0] : api.choice({
            kind: 'card', source: '08106', seat: inv.seat, prompt: '选择要取回的[[道具]]卡牌。',
            options: items.map(value => ({ id: value, label: api.cardName(value) })),
          })
          api.moveCard({ code, from: 'discard', to: 'hand' }, { seat: inv.seat })
        }
        const location = state.locations.find(item => item.id === context.location)
        const connected = location?.clues > 0
          ? (location.connections || []).filter(id => api.canDiscoverClueAt(inv.seat, id)) : []
        if (!connected.length) return
        const picked = api.choice({
          kind: 'effect', source: '08106', seat: inv.seat, canSkip: true,
          prompt: '是否改为在一个连接地点发现 1 个线索？',
          options: [{ id: 'skip', label: '照常发现本地点的线索' },
            ...connected.map(id => ({ id, label: `在「${api.locName(id)}」发现 1 个线索` }))],
        })
        if (connected.includes(picked) && api.replaceInvestigationClue()) api.discoverClue(inv.seat, 1, picked)
      } },
  ],
  modifiers: [],
}
