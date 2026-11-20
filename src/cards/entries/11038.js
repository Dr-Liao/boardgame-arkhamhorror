import { ownSeat } from '../../engine/matcher.js'

function attackingGeist({ context, helpers }) {
  return helpers.cardTraits(context.enemy?.originalCode || context.enemy?.code).some(trait => trait.toLowerCase() === 'geist')
}

export default {
  code: '11038',
  uses: 0,
  usesType: 'evidence',
  abilities: [
    {
      kind: 'reaction', trigger: 'chaosTokenChanged', label: '封印、取消或忽略混乱标记后横置：放置 1 证据',
      cost: { exhaust: true },
      criteria: [ownSeat(), ({ context }) => ['seal', 'cancel', 'ignore'].includes(context.change)],
      resolve: ({ source, api }) => api.addUses(source, 1),
    },
    {
      kind: 'reaction', trigger: 'enemyAttack',
      label: '此处的调查员受到敌人攻击时横置并花费 1 证据：发现线索，若攻击者是灵体则对其造成 1 伤害',
      cost: { exhaust: true, uses: 1 },
      criteria: [ctx => {
        const { inv, context, source, helpers } = ctx
        return !context.cancelled && context.location === inv.location && (
          helpers.canDiscoverClueAt(inv.seat, inv.location)
            || (attackingGeist(ctx) && helpers.canDamageEnemy(context.enemy, inv.seat, source.id)))
      }],
      resolve: ({ state, inv, source, context, api }) => {
        const enemy = context.enemy
        if (api.canDiscoverClueAt(inv.seat, inv.location)) api.discoverClue(inv.seat, 1, inv.location)
        if (state.enemies.includes(enemy) && api.effectiveTraits(enemy.originalCode || enemy.code).some(trait => trait.toLowerCase() === 'geist')) {
          api.damageEnemy(enemy, 1, inv.seat, source.id)
        }
      },
    },
  ],
}
