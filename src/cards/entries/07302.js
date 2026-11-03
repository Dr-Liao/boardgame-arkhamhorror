import { attackableEnemies } from './_shared.js'
export default {
  code: '07302', abilities: [
    { kind: 'action', countsAs: 'fight', label: '圣矛：战斗 +2，伤害 +1，可释放祝福', cost: { action: true },
      target: { kind: 'enemy', query: ({ state, inv, candidate }) => attackableEnemies(state, inv).some(enemy => enemy.id === candidate.id) },
      resolve: ({ state, inv, source, target, api }) => {
        if (state.chaos?.sealed?.some(item => item.source === source.id && item.token === 'bless')
          && api.choice({ kind: 'token', source: source.id, seat: inv.seat, canSkip: true, prompt: '释放圣矛上的 1 个祝福？',
            options: [{ id: 'release', label: '释放 1 个祝福' }, { id: 'skip', label: '保留' }] }) === 'release') api.chaosTokens.release(source.id, 'bless', 1)
        api.fight(inv.seat, target.id, { assetId: source.id, combatBonus: 2, damageBonus: 1 })
      } },
    { kind: 'action', countsAs: 'fight', label: '封印 2 个祝福：战斗 +4，伤害 +2', cost: { action: true },
      criteria: ({ state }) => state.chaosBag.filter(token => token === 'bless').length >= 2,
      target: { kind: 'enemy', query: ({ state, inv, candidate }) => attackableEnemies(state, inv).some(enemy => enemy.id === candidate.id) },
      resolve: ({ inv, source, target, api }) => {
        if (api.chaosTokens.seal(source.id, 'bless', 2) !== 2) return
        api.fight(inv.seat, target.id, { assetId: source.id, combatBonus: 4, damageBonus: 2 })
      } },
  ],
}
