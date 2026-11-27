// 08681 最终幻景 · 幕与议程。无名疯狂获得猎手。
const NAMELESS = '08679'
const RAMP_ORDER = ['theGateOfYquaa', 'titanicRamp1', 'titanicRamp2', 'titanicRamp3', 'titanicRamp4', 'hiddenTunnel']

export default {
  code: '08681', scope: 'act', implemented: true,
  actRule: {
    objective: { type: 'runToHiddenTunnel' },
    backEffect: 'finalMirageOutcome',
    enemiesGainHunterCodes: [NAMELESS],
    doomPlacementReplacement(state, amount, api) {
      const printedCopy = state.scenarioZones?.setAside?.includes(NAMELESS)
      const physicalCopy = api.enemyZones.list('namelessMadness').find(enemy => (enemy.originalCode || enemy.code) === NAMELESS)
      if (!printedCopy && !physicalCopy) return false
      const destination = RAMP_ORDER.find(id => state.investigators.some(inv =>
        !inv.defeated && !inv.resigned && inv.location === id))
      if (destination && api.canEnemyEnterLocation(NAMELESS, destination)) {
        if (printedCopy) api.spawnSetAsideEnemy(NAMELESS, destination)
        else if (physicalCopy) api.enemyZones.restore('namelessMadness', physicalCopy.id, { location: destination })
      }
      return true
    },
  },
  flags: { finalMirage: true, resolutionByRecords: true },
}
