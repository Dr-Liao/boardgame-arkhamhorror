import { roundActionCount } from '../../engine/action-history.js'
import { assetRegulationEnabled, assetTextBlanked } from '../../engine/card-text.js'
import { hasTrait } from '../../engine/matcher.js'

export default {
  code: '90026',
  trackRoundActionHistory: true,
  assetRule: { regulationAction: 'play' },
  modifiers: [{
    target: 'capability:play',
    condition: { when: ({ state, inv, source }) => assetRegulationEnabled(state, inv, source)
      && roundActionCount(state, inv, 'play') >= 2 },
  }],
  playTimingProvider: ({ inv, card, source }) =>
    card?.type === 'event' && (hasTrait(card, 'insight') || hasTrait(card, 'tactic')) && !assetTextBlanked(source, inv)
      ? { fast: true, cost: { exhaust: true } } : null,
  abilities: [{
    kind: 'reaction', trigger: 'beforePlayCost',
    label: '使这个洞察或策略事件获得快速',
    cost: { exhaust: true },
    criteria: ({ source, context }) => context.fastSourceId === source.id,
    resolve: ({ api, context }) => api.playerTools.modifyPlay(context, { fast: true }),
  }],
}
