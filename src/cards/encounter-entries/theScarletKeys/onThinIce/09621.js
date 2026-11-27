// 09621 偏远小路 · 地点（onThinIce）
export default {
  code: '09621',
  scope: 'location',
  implemented: true,
  flags: { victory: 1, printedShroud: 3, printedClues: 2 },
  locationRule: {
    encounterGainsSurge(state, inv, source, code, api) {
      if (inv.location !== source.id || api.cardType(code) !== 'treachery' || !api.cardTraits(code).includes('Hazard')) return false
      const key = `09621:hazardSurgeRound:${source.id}`
      if (state.scenarioFlags?.[key] === state.round) return false
      api.setScenarioFlag(key, state.round)
      return true
    },
  },
}
