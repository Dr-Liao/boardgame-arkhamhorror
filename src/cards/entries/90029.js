import { roundActionCount } from '../../engine/action-history.js'
import { assetRegulationEnabled } from '../../engine/card-text.js'

export default {
  code: '90029',
  trackRoundActionHistory: true,
  assetRule: { regulationAction: 'move' },
  passive: { sanityBonus: 3 },
  modifiers: [{
    target: 'capability:move',
    condition: { when: ({ state, inv, source }) => assetRegulationEnabled(state, inv, source)
      && roundActionCount(state, inv, 'move') >= 2 },
  }],
}
