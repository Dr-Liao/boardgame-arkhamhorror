import { ALL_CARDS, hasTrait } from '../../_shared.js'
const connectedInnsmouth = (state, source) => state.locations.filter(location => source.connections?.includes(location.id)
  && hasTrait(Array.isArray(location.traits) ? location : ALL_CARDS[location.originalCode || location.code], 'Innsmouth'))

export default {
  code: '07065', scope: 'location', implemented: true,
  abilities: [{
    kind: 'action', actionKind: 'resign', label: '撤退：暂时蛰伏', cost: { action: 1 },
    resolve: ({ inv, api }) => api.resign(inv.seat),
  }, {
    kind: 'free', actionKind: 'move', label: '印斯茅斯广场：移动到连接的印斯茅斯地点',
    cost: { resources: 2 },
    criteria: [({ state, inv, source, helpers }) => connectedInnsmouth(state, source)
      .some(location => helpers?.canMoveTo?.(inv.seat, location.id) !== false)],
    resolve: ({ state, inv, source, api }) => {
      const locations = connectedInnsmouth(state, source).filter(location => api.canMoveTo(inv.seat, location.id))
      if (!locations.length) return
      const destination = locations.length === 1 ? locations[0].id : api.choice({
        kind: 'target', seat: inv.seat, source: '07065', prompt: '选择一个连接的印斯茅斯地点。',
        options: locations.map(location => ({ id: location.id, label: location.name })),
      })
      if (locations.some(location => location.id === destination)) api.moveInvestigator(inv.seat, destination)
    },
  }],
}
