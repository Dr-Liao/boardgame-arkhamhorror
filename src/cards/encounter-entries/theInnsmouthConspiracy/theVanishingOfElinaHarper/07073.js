import { putRevealedPrintedLocation } from '../../_shared.js'
// 水街老屋：不预先查看遭遇顶牌；选择真实抽取或将该顶牌洗入迹象牌堆。
export default {
  code: '07073', scope: 'location', implemented: true,
  encounterResolve: putRevealedPrintedLocation,
  abilities: [{
    kind: 'forced', trigger: 'investigateSuccess', label: '水街老屋：抽遭遇牌或洗入迹象牌堆',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: [({ state, source, context }) => context.location === source.id && context.successBy >= 3
      && (state.encounterDeck.length > 0 || state.encounterDiscard.length > 0)],
    resolve: ({ state, inv, api }) => {
      const options = [{ id: 'draw', label: '抽取遭遇牌库顶的卡牌' }]
      if (state.encounterDeck.length) options.push({ id: 'shuffle', label: '将遭遇顶牌洗入迹象牌堆' })
      const chosen = options.length === 1 ? 'draw' : api.choice({
        kind: 'effect', source: '07073', seat: inv.seat, prompt: '水街老屋：选择如何处理遭遇牌库顶牌。', options,
      })
      if (chosen === 'shuffle') api.scenarioDecks.addEncounterTop('leads')
      else if (chosen === 'draw') api.drawEncounter(inv.seat)
    },
  }],
}
