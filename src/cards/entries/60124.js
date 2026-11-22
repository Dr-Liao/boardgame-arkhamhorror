import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60124',
  abilities: [{
    kind: 'played', fast: true, trigger: 'enemyAttacked', label: '受到敌人攻击的伤害后发现 2 个线索',
    criteria: [ownSeat(), ({ state, inv, context, helpers }) => context.attack?.damage > 0
      && (helpers?.canDiscoverClueAt?.(inv.seat, inv.location)
        ?? state.locations.some(location => location.id === inv.location && location.clues > 0))],
    effect: { type: 'discoverClue', amount: 2 },
  }],
}
