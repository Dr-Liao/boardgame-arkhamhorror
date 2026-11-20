import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '11004',
  investigator: { trackClueDiscovery: true, elderSign: { perEnemyAtLocation: true } },
  elderSign: { id: '11004-sign', resolve: ({ state, inv }) => ({
    delta: state.enemies.filter(enemy => enemy.location === inv.location).length,
  }) },
  abilities: [{
    kind: 'reaction', trigger: 'evadeSuccess', label: '躲避成功至少 2 点：发现 1 个线索',
    limit: { scope: 'perRound', owner: 'player' },
    criteria: [ownSeat(), ({ state, inv, context }) => context.successBy >= 2
      && state.locations.some(location => location.id === inv.location && location.clues > 0)],
    resolve: ({ inv, api }) => api.discoverClue(inv.seat, 1, inv.location),
  }],
}
