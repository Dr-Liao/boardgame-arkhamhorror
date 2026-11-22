import { CHAOS_SYMBOLS } from './_shared.js'

export default {
  code: '60416',
  abilities: [{
    kind: 'played',
    label: '获得 1 资源，然后揭示 3 枚标记，每揭示一枚指定符号再获得 2 资源',
    resolve: ({ api, inv }) => {
      api.gainResources(inv.seat, 1)
      const count = api.revealChaosTokens(3, { seat: inv.seat, source: '60416' })
        .filter(token => CHAOS_SYMBOLS.includes(token)).length
      if (count) api.gainResources(inv.seat, count * 2)
    },
  }],
}
