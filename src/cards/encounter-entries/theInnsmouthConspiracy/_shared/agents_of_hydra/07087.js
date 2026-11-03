import { ALL_CARDS } from '../../../_shared.js'
export default {
  code: '07087', scope: 'treachery',
  encounterResolve(state, inv, card, api) {
    if (!inv.hand.length) return { gainSurge: true }
    const [code] = api.discardRandom(inv.seat, 1) || []
    if (!code) return false
    const printedCost = ALL_CARDS[code]?.cost
    const difficulty = Number.isFinite(printedCost) ? printedCost : 0
    api.test(inv.seat, 'willpower', difficulty, result => { if (!result.success) api.loseActions(inv.seat, 1) })
    return false
  },
}
