import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '11037',
  uses: 0,
  usesType: 'resources',
  assetRule: { playCostUses: { trait: 'Spell', scope: 'self' } },
  abilities: [{
    kind: 'reaction', trigger: 'clueDiscovered', label: '发现线索后横置：在此牌上放置 1 资源',
    cost: { exhaust: true },
    criteria: [ownSeat(), ({ context }) => context.amount > 0],
    resolve: ({ source, api }) => api.addUses(source, 1),
  }],
}
