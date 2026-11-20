import { attackableEnemies } from './_shared.js'

export default {
  code: '11021',
  abilities: [
    {
      kind: 'action', countsAs: 'investigate', label: '横置：使用战斗进行调查',
      cost: { action: true, exhaust: true },
      criteria: ({ state, inv }) => state.locations.some(location => location.id === inv.location && !location.locked),
      resolve: ({ inv, source, api }) => api.investigate(inv.seat, {
        skill: 'combat', assetId: source.id, sourceCode: source.code,
      }),
    },
    {
      kind: 'action', countsAs: 'fight', label: '横置：攻击，战斗 +2',
      cost: { action: true, exhaust: true },
      target: { kind: 'enemy', query: ({ state, inv, entity }) => attackableEnemies(state, inv).includes(entity) },
      resolve: ({ inv, source, targetId, api }) => api.fight(inv.seat, targetId, {
        assetId: source.id, sourceCode: source.code, combatBonus: 2, noSpend: true, trackAssetSource: true,
      }),
    },
  ],
}
