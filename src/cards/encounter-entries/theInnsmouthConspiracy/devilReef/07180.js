import { effectiveFloodLevel, floodLevel } from '../../_shared.js'

export default {
  code: '07180',
  scope: 'storyAsset',
  abilities: [{
    kind: 'free',
    actionKind: 'move',
    cost: { exhaust: true },
    label: '淹没地点：移动到一个连接的淹没地点',
    criteria: ({ state, inv, source }) => inv.assets.some(asset => asset.id === source.id)
      && effectiveFloodLevel(state, inv.seat) > 0,
    target: {
      kind: 'location',
      query: ({ state, inv, candidate, canMoveTo }) => candidate.id !== inv.location
        && floodLevel(state, candidate.id) > 0 && canMoveTo(candidate.id),
    },
    resolve: ({ inv, target, api }) => api.moveInvestigator(inv.seat, target.id),
  }],
}
