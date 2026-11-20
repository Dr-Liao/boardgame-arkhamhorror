import { enumerateTargets } from '../../engine/targets.js'

const code = '11026'
const target = { kind: 'enemy', query: ({ entity }) => !(entity.attachments || []).some(card => card.code === code) }
const targetsAt = (state, inv) => enumerateTargets(state, inv, target, { source: { code } })

export default {
  code, keepOnPlay: true,
  assetRule: { sharedEnemyAttachment: true, attachedEnemyCombatBonus: 1 },
  playCondition: [({ state, inv }) => targetsAt(state, inv).length > 0],
  abilities: [
    {
      kind: 'played', fast: true, label: '附属到同地点的一个敌人上，每个敌人限 1 张',
      resolve: ({ state, inv, api }) => {
        const targets = targetsAt(state, inv)
        const id = targets.length === 1 ? targets[0].id : targets.length ? api.choice({
          kind: 'enemy', source: code, seat: inv.seat, prompt: '选择要被标记的敌人。',
          options: targets.map(({ id, label }) => ({ id, label })),
        }) : null
        const enemy = targets.find(item => item.id === id)?.entity
        if (!enemy || !api.attachPlayerCardToAsset(code, enemy, { ownerSeat: inv.seat })) {
          api.putIntoDiscard(inv.seat, code)
        }
      },
    },
    {
      kind: 'reaction', trigger: 'enemyDamaged', range: 'anywhere',
      label: '所附属敌人受到伤害时：弃掉此卡，对它额外造成 1 点伤害',
      criteria: ({ inv, state, source, context, helpers }) => Number(context.amount ?? context.damage) > 0
        && state.enemies.includes(context.enemy)
        && context.enemy.attachments?.includes(source) && helpers.canDamageEnemy(context.enemy, inv.seat, code),
      resolve: ({ context, inv, source, api }) => {
        if (api.movePlayerAttachment(source, 'discard')) api.damageEnemy(context.enemy, 1, inv.seat, code)
      },
    },
  ],
}
