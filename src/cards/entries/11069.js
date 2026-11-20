import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '11069',
  abilities: [{
    kind: 'reaction', trigger: 'beforeChaosTokenReveal',
    label: '横置：揭示直到首枚符号标记，结算它并忽略其余标记',
    cost: { exhaust: true },
    criteria: [ownSeat(), ({ state, context }) => state.skillTest && state.chaosBag.length > 0
      && !context.replacementToken && !context.revealUntilSymbol],
    resolve: ({ inv, context, api }) => api.revealUntilSymbol(context, inv.seat),
  }],
}
