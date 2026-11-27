// 08671 封印渐弱 · 议程 4。背面的弱点留在各自牌库循环中。
import { entryByCode } from '../../_lookup.js'

export default {
  code: '08671', scope: 'agenda', implemented: true,
  agendaRule: {
    backEffect: 'spawnNamelessAtPylon',
    onReveal(state, agenda, api) {
      api.info('🫀 封印渐弱：只等瘴气吞没最后的理智。')
    },
    onLeave(state, agenda, api) {
      if (!state.campaign?.records?.theTruthOfTheMirageEludesYou) return
      for (const inv of state.investigators.filter(inv => !inv.defeated && !inv.resigned)) {
        const matches = inv.deck.filter(code => entryByCode(code)?.flags?.tekelili)
        const taken = matches.map(code => api.takeDeckCard(inv.seat, code)).filter(Boolean)
        if (!taken.length) continue
        const waiting = [...taken]
        while (waiting.length && !inv.defeated && !inv.resigned) {
          const index = waiting.length === 1 ? 0 : Math.floor(api.random() * waiting.length)
          const [code] = waiting.splice(index, 1)
          api.resolveTekeliWeakness(inv.seat, code, { deferReturn: true })
        }
        for (const code of taken) api.putOnTopOfDeck(inv.seat, code)
        api.shuffleDeck(inv.seat)
      }
    },
  },
}
