import { ALL_CARDS, putRevealedPrintedLocation } from '../../_shared.js'
export default {
  code: '07075', scope: 'location', implemented: true,
  encounterResolve: putRevealedPrintedLocation,
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '查看线索牌堆顶牌；若没有胜利X则弃掉', cost: { action: 2 },
    limit: { scope: 'perGame', owner: 'group' },
    criteria: ({ state, source }) => source.clues === 0
      && (state.scenarioFlags?.mechanics?.scenarioDecks?.leads?.deck.length || 0) > 0,
    resolve: ({ inv, api }) => {
      const code = api.scenarioDecks.cards('leads').at(-1)
      if (!code) return
      api.scenarioDecks.peek('leads', inv.seat, 1)
      if (!Object.hasOwn(ALL_CARDS[code] || {}, 'victory')) api.scenarioDecks.discardTop('leads', 1)
    },
  }],
}
