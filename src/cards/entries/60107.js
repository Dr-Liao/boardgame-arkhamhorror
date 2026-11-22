import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60107',
  modifiers: [{ target: 'skill:combat', amount: 1 }],
  abilities: [{
    kind: 'reaction', trigger: 'defeatEnemy', label: '横置本牌并使其受到 1 点伤害，发现所在地的 1 个线索',
    cost: { exhaust: true, assetDamage: 1 },
    criteria: [ownSeat(), ({ inv, helpers }) => helpers.canDiscoverClueAt(inv.seat, inv.location)],
    resolve: ({ inv, api }) => api.discoverClue(inv.seat, 1),
  }],
}
