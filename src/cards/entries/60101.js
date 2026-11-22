import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60101',
  kind: 'investigator',
  investigator: { elderSign: { bonus: 1 } },
  elderSign: {
    id: '60101-eldersign',
    label: '旧印：+1，攻击成功时收回弃牌堆中的一张事件',
    resolve: ({ state }) => ({
      delta: 1,
      ...(state.skillTest?.actionKind === 'fight'
        ? { onSuccess: { type: 'searchDiscard', typeFilter: 'event', source: '60101' } }
        : {}),
    }),
  },
  abilities: [{
    kind: 'reaction',
    trigger: 'enemyWouldTakeDamage',
    label: '让这次事件额外造成 1 点伤害',
    limit: { scope: 'perPhase', owner: 'player' },
    criteria: [ownSeat(), ({ context, helpers }) => context.amount > 0
      && helpers.cardType(context.sourceCode) === 'event'],
    resolve: ({ context, api }) => api.increaseEnemyDamage(context, 1),
  }],
}
