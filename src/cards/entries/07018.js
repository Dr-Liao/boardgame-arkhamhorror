import { attackableEnemies } from './_shared.js'
export default {
  code: '07018', abilities: [
    { kind: 'action', countsAs: 'fight', label: '蒙福之刃：战斗 +1，祝福／旧印使伤害 +1', cost: { action: true },
      criteria: ({ source }) => !source.exhausted,
      target: { kind: 'enemy', query: ({ state, inv, candidate }) => attackableEnemies(state, inv).some(enemy => enemy.id === candidate.id) },
      resolve: ({ inv, source, target, api }) => api.fight(inv.seat, target.id, {
        noSpend: true, assetId: source.id, trackAssetSource: true, combatBonus: 1,
        damageBonusOnTokens: { tokens: ['bless', 'eldersign'], amount: 1 },
      }) },
    { kind: 'reaction', trigger: 'beforeChaosTokenReveal', label: '横置蒙福之刃：加入 1 个祝福', cost: { exhaust: true },
      criteria: ({ state, source, context, helpers }) => state.skillTest?.source?.assetId === source.id
        && (state.chaos.revealed.length === state.chaos.frames.at(-1)) && helpers.poolTokenRoom('bless') > 0,
      resolve: ({ api }) => api.chaosTokens.add('bless', 1) },
  ],
}
