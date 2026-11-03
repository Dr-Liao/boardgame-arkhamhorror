import { floodLevel, effectiveFloodLevel, gridPosition, gridLocations } from '../../_shared.js'
const floodBonus = ({ state, entity }) => {
  if (!entity.location || !state.locations.some(location => location.id === entity.location)) return 0
  const seat = state.skillTest?.seat
  return seat == null ? floodLevel(state, entity.location)
    : effectiveFloodLevel(state, seat, { location: entity.location })
}
export default {
  code: '07145', scope: 'enemy', implemented: true,
  modifiers: [
    { target: 'enemyFight', amount: floodBonus },
    { target: 'enemyEvade', amount: floodBonus },
  ],
  abilities: [{
    kind: 'forced', trigger: 'enemyEngaged', label: '深海蹂躏者：战力(2)，失败后在西侧通道放置1个屏障',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ inv, source, context }) => context.enemy?.id === source.id && context.seat === inv.seat,
    resolve: ({ state, source, context, api }) => api.test(context.seat, 'combat', 2, {
      source: { type: 'scenario', code: '07145', name: source.name, ability: true },
      target: { kind: 'enemy', id: source.id },
      resolve: result => {
        if (result.success) return
        const inv = state.investigators[context.seat], here = state.locations.find(location => location.id === inv.location)
        const origin = gridPosition(state, inv.location)
        if (!origin || origin.isolated) return
        const west = gridLocations(state, { row: origin.y }).find(location =>
          gridPosition(state, location.id).x === origin.x - 1 && here?.connections?.includes(location.id))
        if (west) api.barriers.change(inv.location, west.id, 1)
      },
    }),
  }],
}
