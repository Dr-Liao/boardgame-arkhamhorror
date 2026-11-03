export default {
  code: '07223', uses: 4, usesType: 'secrets',
  abilities: [{ kind: 'free', label: '检定者查找顶 3 张，你可花费 1 秘密投入找到的牌', cost: { action: false },
    limit: { scope: 'perTest', owner: 'player', count: 1 },
    criteria: ({ state, inv }) => !!state.skillTest && state.investigators[state.skillTest.seat]?.location === inv.location,
    resolve: ({ inv, source, api }) => api.playerTools.searchCommit(inv.seat, { sourceId: source.id, count: 3 }) }],
}
