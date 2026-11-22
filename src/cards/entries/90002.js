import { assetTextBlanked } from '../../engine/card-text.js'
import { hasTrait } from '../../engine/matcher.js'

export default {
  code: '90002',
  restrictedSlots: [{ slot: 'hand', traitsAny: ['Tome'], count: 2 }],
  playTimingProvider: ({ state, inv, card, source }) =>
    state.phase === 'investigation' && state.currentSeat === inv.seat && !inv.turnEnded
      && card.type === 'asset' && hasTrait(card, 'tome') && !assetTextBlanked(source, inv)
      ? { fast: true, cost: { exhaust: true } } : null,
  abilities: [{
    kind: 'reaction', trigger: 'beforePlayCost', label: '横置：这个书籍支援获得快速',
    cost: { exhaust: true },
    criteria: ({ source, context }) => context.fastSourceId === source.id,
    resolve: ({ api, context }) => api.playerTools.modifyPlay(context, { fast: true }),
  }],
}
