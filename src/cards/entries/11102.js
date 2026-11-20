export default {
  code: '11102',
  limitPerInvestigator: true,
  abilities: [{
    kind: 'free', countsAs: 'move',
    cost: { exhaust: true, discardHand: 1 },
    label: '你的回合：横置并弃 1 张手牌，移动到连接地点',
    criteria: ({ state, inv }) => state.phase === 'investigation' && state.currentSeat === inv.seat && !inv.turnEnded,
    target: { kind: 'location', query: ({ inv, entity, canMoveTo }) => entity.id !== inv.location && canMoveTo(entity.id) },
    resolve: ({ inv, target, api }) => api.moveInvestigator(inv.seat, target.id),
  }],
}
