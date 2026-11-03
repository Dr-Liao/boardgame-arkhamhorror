import { gridPosition } from '../../_shared.js'
const offsets = [{ x: 0, y: -1 }, { x: -1, y: 0 }, { x: 1, y: 0 }]
export default {
  code: '07046', scope: 'act', implemented: true,
  actRule: {
    objective: state => state.investigators.some(inv => !inv.defeated)
      && state.investigators.every(inv => inv.defeated || inv.resigned),
    onReveal: (state, act, api) => api.finish('resolution1'),
  },
  abilities: [{
    kind: 'forced', trigger: 'locationRevealed', label: '逃出生天：在下方、左侧和右侧的空位放置潮汐隧道',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ state, context }) => !!gridPosition(state, context.location)
      && (state.scenarioFlags?.mechanics?.scenarioDecks?.tidalTunnels?.deck.length || 0) > 0,
    resolve: ({ context, api }) => api.map.expand(context.location, offsets, 'tidalTunnels'),
  }],
}
