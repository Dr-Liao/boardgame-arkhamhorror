import { declareScenario } from '../../../../scenario-declaration.js'
import { agendaReveal } from './reveal-hooks.js'

export const behavior = declareScenario({
  id: 'theMidnightMasks',
  data: {
    spawnOverrides: { ghoulPriest: 'yourHouse' },
    drawCultistActIndex: 0,
  },
  setup: {
    startLocation: { record: 'houseBurned', then: 'rivertown', else: 'yourHouse' },
    locations: { all: true, variants: true, exceptIf: { record: 'houseBurned', ids: ['yourHouse'] } },
    enemies: [{ code: 'acolyte', count: 'investigators-1', at: ['southside', 'downtown', 'graveyard'] }],
    deck: { removeSpawnedEnemies: true, addSurvivingPriest: true },
  },
  hooks: {
    agendaReveal,
    describe(state) {
      return [`已盘问异教徒：${state.cultistsInVictory.length}/6；异教徒牌堆剩余：${state.cultistDeck.length}。`]
    },
    resolution(state, key, events, api) {
      const rec = state.campaign.records
      rec.cultistsInterrogated = [...state.cultistsInVictory].map(api.originalCardCode)
      const all = [...state.scenario.cultistDeck, 'theMaskedHunter'].map(api.originalCardCode)
      rec.cultistsEscaped = all.filter(code => !rec.cultistsInterrogated.includes(code))
      if ((state.victoryDisplay || []).some(card => card.code === 'ghoulPriest')) rec.ghoulPriestAlive = false
      return {
        bonus: 0,
        award: true,
        effects: [
          { record: { pastMidnight: true }, when: { resolution: 'r2' } },
          { record: { pastMidnight: false }, when: { not: { resolution: 'r2' } } },
        ],
      }
    },
  },
})
