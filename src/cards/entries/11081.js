import { enemyInEngagement } from '../../engine/enemy-parts.js'

const code = '11081'
const evade = {
  kind: 'action',
  countsAs: 'evade',
  label: '躲避（敏捷 +1）；成功躲避非精英时可弃 1 手牌，让它下次补给阶段不重整',
  target: { kind: 'enemy', query: ({ state, inv, entity }) => enemyInEngagement(state, entity, inv) },
  resolve: ({ inv, source, target, api }) => api.evade(inv.seat, {
    enemyId: target.id,
    assetId: source.handAbilityIndex == null ? source.id : undefined,
    sourceCode: code,
    bonus: 1,
    onSuccess: ({ enemy }) => {
      if (!enemy.elite && api.chooseOptionalHandDiscard(inv.seat, code)) api.preventEnemyReady(enemy, 1)
    },
  }),
}

export default {
  code,
  abilities: [
    { ...evade, cost: { action: true, exhaust: true } },
    { ...evade, fromHand: true, cost: { action: true, discardSelf: true } },
  ],
}
