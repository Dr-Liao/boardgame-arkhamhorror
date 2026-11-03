// 印斯茅斯港口：超额成功3后查看顶牌并洗回；只查看，不抽取、不移除。
export default {
  code: '07066', scope: 'location', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'investigateSuccess', label: '印斯茅斯港口：查看迹象顶牌并混洗',
    limit: { scope: 'perRound', owner: 'group' },
    criteria: [({ state, source, context }) => context.location === source.id && context.successBy >= 3
      && (state.scenarioFlags?.mechanics?.scenarioDecks?.leads?.deck.length || 0) > 0],
    resolve: ({ inv, api }) => {
      api.scenarioDecks.peek('leads', inv.seat, 1)
      api.scenarioDecks.put('leads', [], { shuffle: true })
    },
  }],
}
