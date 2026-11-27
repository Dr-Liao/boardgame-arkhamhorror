// 08066 平行命运（Parallel Fates）· 秘术师（Mystic）事件 · 2 经验。
//
// 卡面：查看一位调查员的牌库顶或遭遇牌库顶 6 张卡牌，你可以将那些卡牌以任何顺序放回该牌库顶，
//       或将它们洗回该牌库。如果你查看了一位调查员的牌库，该调查员可以抽取 1 张卡牌。
//
// 一卡一文件：这张卡的行为只在这里维护。
// 查看的牌在选定放回方式前可见，并可逐张制定牌库顶顺序。
const ALIVE = state => (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)

export default {
  code: '08066',
  abilities: [
    {
      kind: 'played',
      label: '查看 6 张牌：任意顺序放回牌库顶或洗回；查看调查员牌库时其可抽 1 张',
      resolve: ({ state, inv, api }) => {
        const zones = [
          ...ALIVE(state).map(owner => ({
            id: `seat:${owner.seat}`, kind: 'investigator', seat: owner.seat,
            label: `${owner.name} 的牌库`, pile: owner.deck,
          })),
          { id: 'encounter', kind: 'encounter', seat: null, label: '遭遇牌库', pile: state.encounterDeck },
        ].filter(zone => Array.isArray(zone.pile) && zone.pile.length)
        if (!zones.length) {
          api.info('「平行命运」：没有可以查看的牌库。')
          return
        }
        const zoneId = zones.length === 1 ? zones[0].id
          : api.choice({ kind: 'deck', source: '08066', seat: inv.seat,
            prompt: '选择要查看牌库顶 6 张的牌库。',
            options: zones.map(zone => ({ id: zone.id, label: zone.label })) })
        const zone = zones.find(item => item.id === zoneId) || zones[0]
        api.lookAt(inv.seat, {
          zone: zone.kind === 'encounter' ? 'encounterDeck' : 'deck',
          targetSeat: zone.seat ?? null,
          count: 6,
          choose: 0,
          source: '08066',
          chooseReturn: ({ cards }) => api.choice({
            kind: 'look', source: '08066', seat: inv.seat,
            prompt: `如何放回查看的「${zone.label}」牌？`,
            options: [{ id: 'top', label: '以任意顺序放回牌库顶', cardCodes: cards },
              { id: 'shuffle', label: '洗回该牌库', cardCodes: cards }],
          }) === 'shuffle' ? 'shuffle' : 'arrange',
        })
        if (zone.kind !== 'investigator') return
        const viewer = state.investigators[zone.seat]
        if (!viewer || viewer.defeated || viewer.resigned) return
        const draw = api.choice({
          kind: 'effect', source: '08066', seat: viewer.seat, canSkip: true,
          prompt: `${viewer.name} 是否抽取 1 张卡牌？`,
          options: [{ id: 'draw', label: '抽取 1 张卡牌' }, { id: 'skip', label: '不抽' }],
        })
        if (draw === 'draw') {
          api.drawCards(viewer.seat, 1)
          api.info(`🌌 「平行命运」：${viewer.name} 抽取 1 张卡牌。`)
        }
      },
    },
  ],
  modifiers: [],
}
