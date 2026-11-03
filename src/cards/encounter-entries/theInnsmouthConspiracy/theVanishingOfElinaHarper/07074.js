import { ALL_CARDS } from '../../_shared.js'
export default {
  code: '07074', scope: 'location', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'enemyDefeated', label: '在监狱击败无胜利点敌人：将其洗入线索牌堆',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ inv, source, context }) => context.accepted === true && context.sourceSeat === inv.seat
      && inv.location === source.id && !!context.enemy
      && !Object.hasOwn(ALL_CARDS[context.enemy.originalCode || context.enemy.code] || {}, 'victory'),
    resolve: ({ source, context, api }) => api.enemyOutcomes.destination(context,
      { kind: 'scenarioDeck', id: 'leads', shuffle: true }, { sourceId: source.id }),
  }],
}
