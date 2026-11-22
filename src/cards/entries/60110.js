import { otherSeat } from '../../engine/matcher.js'

export default {
  code: '60110',
  abilities: [{
    kind: 'reaction', trigger: 'move', label: '横置本牌，随另一位调查员移动',
    cost: { exhaust: true },
    criteria: [otherSeat(), ({ state, inv, context, helpers }) => {
      if (context.from !== inv.location || context.location === inv.location) return false
      const here = state.locations.find(location => location.id === inv.location)
      return (here?.connections || []).includes(context.location)
        && helpers.canMoveTo(inv.seat, context.location)
    }],
    resolve: ({ inv, context, api }) => api.moveInvestigator(inv.seat, context.location),
  }],
}
