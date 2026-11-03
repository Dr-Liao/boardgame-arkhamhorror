// 国立第一杂货铺：仅搜索牌库顶6张；搜索后完整洗牌（包括只剩一张时）。
export default {
  code: '07067', scope: 'location', implemented: true,
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '国立第一杂货铺：查找一张道具',
    cost: { action: 1 }, limit: { scope: 'perGame', owner: 'player' },
    criteria: [({ inv }) => inv.deck.length > 0],
    resolve: ({ inv, api }) => {
      api.lookAt(inv.seat, { zone: 'investigatorDeck', count: 6, choose: 1,
        filter: { trait: 'Item' }, optional: true, returnStrategy: 'top', source: '07067' })
      api.shuffleDeck(inv.seat)
    },
  }],
}
