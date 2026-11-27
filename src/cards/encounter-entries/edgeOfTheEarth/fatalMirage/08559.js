// 08559 大学礼堂
import { ALL_CARDS } from '../../_shared.js'
import { entryByCode as registeredEntry } from '../../_lookup.js'

export default {
  code: '08559', scope: 'location', implemented: true,
  flags: { mirageId: 'universityHalls', tier: 1 },
  locationRule: {
    onMirageFlip(state, location, contributions, api) {
      for (const inv of state.investigators) {
        const spent = Number(contributions[inv.seat]) || 0
        if (spent <= 0) continue
        const discarded = api.discardTop(inv.seat, spent * 3)
        const otherWeaknesses = []
        for (const code of discarded) {
          if (!['weakness', 'basicweakness'].includes(ALL_CARDS[code]?.subtype)) continue
          if (!api.takeDiscardCard(inv.seat, code)) continue
          if (registeredEntry(code)?.flags?.tekelili) api.resolveTekeliWeakness(inv.seat, code)
          else otherWeaknesses.push(code)
        }
        if (!otherWeaknesses.length) continue
        for (const code of otherWeaknesses) api.putOnTopOfDeck(inv.seat, code)
        api.shuffleDeck(inv.seat)
      }
    },
  },
}
