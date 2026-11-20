import { attackableEnemies } from './_shared.js'
import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '11032', uses: 3, usesType: 'ammo',
  abilities: [
    {
      kind: 'action', countsAs: 'fight', label: '花费 1 弹药：攻击，战斗 +2、伤害 +1',
      cost: { action: true, uses: 1 },
      target: { kind: 'enemy', query: ({ state, inv, entity }) => attackableEnemies(state, inv).includes(entity) },
      resolve: ({ inv, source, targetId, api }) => api.fight(inv.seat, targetId, {
        assetId: source.id, sourceCode: source.code, combatBonus: 2, damageBonus: 1,
        noSpend: true, trackAssetSource: true,
      }),
    },
    {
      kind: 'reaction', trigger: ['assetEnteredPlay', 'assetLeavesPlay'],
      label: '此支援进入或离开游戏时：忽略全部费用发动其攻击能力',
      limit: { scope: 'perWindow', owner: 'instance' },
      criteria: [ownSeat(), ({ state, inv, source, context }) => context.assetId === source?.id
        && attackableEnemies(state, inv).length > 0],
      resolve: ({ inv, source, api }) => api.resolveCardAbility(inv.seat, source, {
        abilityIndex: 0, ignoreCosts: true,
      }),
    },
  ],
}
