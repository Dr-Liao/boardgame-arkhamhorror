// 重返百赌百胜 · 章节行为：大厅二选一、舞台放一边，其余沿用基础章结算。
import { BASE_BEHAVIORS, shuffleWith } from '../../shared.js'

const base = BASE_BEHAVIORS.theHouseAlwaysWins

export function setupPlan(state, rng = () => 0.5) {
  const lounge = rng() < 0.5 ? '02071' : '51016'
  return {
    lounge,
    locations: ['laBellaLuna', 'cloverClubLounge', 'cloverClubBar', 'cloverClubCardroom'],
    enemies: [{ code: '02078', location: 'cloverClubLounge' }],
    setAside: ['02074', '02079', '02080', '02075', '02076', '02077', '51017', ...state.scenario.setAsideEncounterCards],
    removed: [lounge === '02071' ? '51016' : '02071'],
  }
}

export const behavior = {
  ...base,
  id: 'returnToTheHouseAlwaysWins',
  setupLocations(state, events, { randomValue } = {}) {
    const rng = () => (randomValue ? randomValue(state) : 0.5)
    const plan = setupPlan(state, rng)
    state.scenarioFlags = { cheated: [], loungeUsed: false, barUsed: false }
    state.scenarioZones ||= {}
    state.scenarioZones.clubAside = [...state.scenario.setAsideEncounterCards]
    state.scenarioZones.setAside = [...plan.setAside]
    state.scenarioZones.removed = [...plan.removed]
    state.scenarioZones.underLocations ||= {}
    state.scenarioZones.sacrificed ||= []
    const chosen = state.scenario.locationVariants.cloverClubLounge
      .find(location => location.originalCode === plan.lounge)
    state.locationVariants.cloverClubLounge = { ...structuredClone(chosen), id: 'cloverClubLounge' }
    return plan.locations
  },
  locationRevealed(state, location, api) {
    base.locationRevealed?.(state, location, api)
    // 51016「俱乐部大厅」：揭示后把放在一边的俱乐部舞台放置入场。
    if (location.id === 'cloverClubLounge' && (location.originalCode || location.code) === '51016') {
      api.place('cloverClubStage')
      api.reveal?.('cloverClubStage')
    }
  },
  retSetupPlan(state, rng = () => 0.5) { return setupPlan(state, rng) },
}

export const retHelpers = { setupPlan, shuffleWith }
