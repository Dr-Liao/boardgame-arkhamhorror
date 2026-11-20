import { ALL_CARDS } from '../cards-data.js'
import { hasTrait } from '../../engine/matcher.js'

export default {
  code: '11068b',
  kind: 'investigator',
  campaignDeck: { successorOnly: true, changesProhibited: true, killedOnDefeat: true, trackTestAssetSource: true },
  investigator: { elderSign: { bonus: 0 } },
  modifiers: [{
    target: 'testValue', amount: 2, condition: { when: ({ state, inv }) => {
      const test = state.skillTest
      if (test?.seat !== inv.seat) return false
      const source = inv.assets.find(asset => asset.id === (test.assetSourceId || state._resolvingAssetId))
      return hasTrait(ALL_CARDS[source?.code || state._resolvingCardCode || test.source?.code], 'Spell')
    } },
  }],
  elderSign: {
    id: '11068b-eldersign', label: '旧印 +0，抽 1 张牌',
    resolve: ({ inv, api }) => {
      api.drawCards(inv.seat, 1)
      return { delta: 0 }
    },
  },
}
