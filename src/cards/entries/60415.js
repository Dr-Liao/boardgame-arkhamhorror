import { CHAOS_SYMBOLS } from './_shared.js'

export default {
  code: '60415',
  abilities: [{
    kind: 'played',
    requiresEncounterDeck: true,
    label: '查看遭遇牌库顶 4 张。揭示指定符号则洗回，否则以任意顺序放回顶部',
    resolve: ({ api, inv }) => api.lookAt(inv.seat, {
      zone: 'encounterDeck',
      count: 4,
      choose: 0,
      showCards: true,
      source: '60415',
      chooseReturn: ({ cards }) => {
        if (!cards.length) return 'shuffle'
        const tokens = api.revealChaosTokens(1, { seat: inv.seat, source: '60415' })
        return tokens.some(token => CHAOS_SYMBOLS.includes(token)) ? 'shuffle' : 'arrange'
      },
    }),
  }],
}
