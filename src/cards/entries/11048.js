import { enemiesAt, ownTurn } from '../../engine/matcher.js'

export default {
  code: '11048',
  researchRequirement: 'youHaveCalculatedTheDayOfReckoning',
  researchUpgradeFrom: '11035',
  uses: 4,
  usesType: 'charges',
  abilities: [
    {
      kind: 'free', countsAs: 'investigate', label: '你的回合期间横置并花费 1 充能：调查',
      cost: { exhaust: true, uses: 1 },
      criteria: [ownTurn()],
      resolve: ({ inv, source, api }) => api.investigate(inv.seat, { assetId: source.id, trackAssetSource: true }),
    },
    {
      kind: 'forced', trigger: 'testInitiated', silent: true, label: '每有一个此处的敌人便额外揭示一枚标记，选择一枚结算',
      criteria: [({ state, source }) => state.skillTest?.assetSourceId === source.id],
      resolve: ({ state, inv, api }) => {
        const enemies = enemiesAt(state, inv.location).filter(enemy => !enemy.defeated && !enemy.partOf)
        const additional = Math.min(enemies.length, Math.max(0, state.chaosBag.length - 1))
        if (additional > 0) api.addExtraChaosChoices(additional, '11048')
      },
    },
  ],
}
