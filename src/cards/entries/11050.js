import { attackableEnemies } from './_shared.js'

export default {
  code: '11050', uses: 2, usesType: 'ammo',
  abilities: [
    {
      kind: 'free', countsAs: 'fight', label: '横置并花费 1 弹药：攻击，战斗 +1',
      cost: { exhaust: true, uses: 1 },
      target: { kind: 'enemy', query: ({ state, inv, entity }) => attackableEnemies(state, inv).includes(entity) },
      resolve: ({ inv, source, targetId, api }) => api.fight(inv.seat, targetId, {
        assetId: source.id, sourceCode: source.code, combatBonus: 1, noSpend: true, trackAssetSource: true,
      }),
    },
    {
      kind: 'action', label: '花费 1 资源：补满弹药并重整',
      cost: { action: true, resources: 1 },
      criteria: ({ source }) => source?.exhausted === true || source?.uses !== 2,
      resolve: ({ source, api }) => {
        api.setAssetUses(source, 2)
        api.ready(source)
      },
    },
  ],
}
