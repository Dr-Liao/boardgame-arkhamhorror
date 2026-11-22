import { defeatedPrintedHealthThisTurn } from '../../engine/action-history.js'
import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60120',
  trackDefeatedEnemyPrintedHealth: true,
  abilities: [{
    kind: 'played', fast: true, trigger: 'defeatEnemy', label: '击败敌人后发现线索；本回合击败敌人的印刷生命合计达到 4 时发现 2 个',
    criteria: [ownSeat(), ({ state, inv, helpers }) =>
      helpers?.canDiscoverClueAt?.(inv.seat, inv.location)
      ?? state.locations.some(location => location.id === inv.location && location.clues > 0)],
    resolve: ({ state, inv, api }) => api.discoverClue(inv.seat, defeatedPrintedHealthThisTurn(state, inv) >= 4 ? 2 : 1),
  }],
}
