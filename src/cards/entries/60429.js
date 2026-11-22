import { ALL_CARDS } from '../cards-data.js'
import { CHAOS_SYMBOLS } from './_shared.js'

const code = '60429'

function eligibleAssets(state, inv) {
  return state.investigators
    .filter(owner => owner.location === inv.location && !owner.defeated && !owner.resigned)
    .flatMap(owner => owner.assets)
    .filter(asset => ALL_CARDS[asset.code]?.traits?.some(trait => ['spell', 'relic'].includes(trait.toLowerCase())))
}

export default {
  code,
  playCondition: [{
    when: ({ state, inv }) => eligibleAssets(state, inv).length > 0,
    message: '此处没有可补充充能的法术或遗物支援',
  }],
  abilities: [{
    kind: 'played',
    label: '选择此处的法术或遗物支援并揭示标记：指定符号充能 +1，否则 +4',
    resolve: ({ state, api, inv }) => {
      const assets = eligibleAssets(state, inv)
      if (!assets.length) return
      const id = assets.length === 1 ? assets[0].id : api.choice({
        kind: 'asset',
        source: code,
        seat: inv.seat,
        prompt: '选择要补充充能的支援。',
        options: assets.map(asset => ({ id: asset.id, label: api.cardName(asset.code), cardCode: asset.code })),
      })
      const chosen = assets.find(asset => asset.id === id)
      const tokens = api.revealChaosTokens(1, { seat: inv.seat, source: code })
      if (tokens.some(token => CHAOS_SYMBOLS.includes(token))) {
        api.triggerChaosRevealEffect(inv.seat, code, () => api.placeUse(chosen, 'charge', 1))
      } else api.placeUse(chosen, 'charge', 4)
    },
  }],
}
