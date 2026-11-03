import { ALL_CARDS, hasTrait } from '../../_shared.js'

const relics = state => [...new Set((state.scenarioZones?.setAside || []).filter(code => ALL_CARDS[code]?.type === 'asset' && hasTrait(ALL_CARDS[code], 'Relic')))]
export default {
  code: '07240', scope: 'location',
  locationRule: { floodBounds: { min: 0, max: 1 } },
  abilities: [{
    kind: 'free', actionKind: 'activate', label: '将1张预留的遗物剧情支援加入你的手牌',
    criteria: ({ state }) => relics(state).length > 0,
    resolve: ({ state, inv, api }) => {
      const choices = relics(state)
      const code = choices.length === 1 ? choices[0] : api.choice({ kind: 'card', source: '07240', seat: inv.seat,
        prompt: '选择1张预留的遗物剧情支援，加入你的手牌。',
        options: choices.map(code => ({ id: code, cardCode: code, label: ALL_CARDS[code].nameZh || ALL_CARDS[code].name })),
      })
      if (choices.includes(code)) api.scenario.takeSetAsideToHand(inv.seat, code)
    },
  }],
}
