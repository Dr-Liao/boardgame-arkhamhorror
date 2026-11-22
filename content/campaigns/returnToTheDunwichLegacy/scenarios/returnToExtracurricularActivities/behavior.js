// 重返课外活动 · 章节行为：布置差异 + 沿用基础章的检定/行动/结局结算。
import { BASE_BEHAVIORS, completedScenario, shuffleWith } from '../../shared.js'

const base = BASE_BEHAVIORS.extracurricularActivity

export function setupPlan(state, rng = () => 0.5) {
  const late = completedScenario(state, 'returnToTheHouseAlwaysWins')
  const library = rng() < 0.5 ? '02050' : '51013'
  return {
    late,
    library,
    locations: ['miskatonicQuad', 'humanitiesBuilding', 'orneLibrary', 'studentUnion', 'scienceBuilding', 'administrationBuilding'],
    facultyOfficeCode: late ? '02055' : '02054',
    setAside: [late ? '02054' : '02055', '02060', '02059', '02058', '02052', '02057', '02061'],
    removed: [library === '02050' ? '51013' : '02050', late ? '02054' : '02055'],
  }
}

export const behavior = {
  ...base,
  id: 'returnToExtracurricularActivities',
  setupLocations(state, events, { randomValue } = {}) {
    const rng = () => (randomValue ? randomValue(state) : 0.5)
    const plan = setupPlan(state, rng)
    state.scenarioZones ||= {}
    state.scenarioZones.setAside = [...plan.setAside]
    state.scenarioZones.removed = [...plan.removed]
    state.scenarioZones.underLocations ||= {}
    state.scenarioZones.sacrificed ||= []
    state.scenarioFlags ||= {}
    const office = state.scenario.locationVariants.facultyOffices
      .find(location => location.originalCode === plan.facultyOfficeCode)
    state.locationVariants.facultyOffices = structuredClone(office)
    const library = state.scenario.locationVariants.orneLibrary
      .find(location => location.originalCode === plan.library)
    state.locationVariants.orneLibrary = { ...structuredClone(library), id: 'orneLibrary' }
    return plan.locations
  },
  setupEnemies(state, events, api) {
    if (completedScenario(state, 'returnToTheHouseAlwaysWins')) {
      api.spawnEnemy(state, '51014', 'administrationBuilding', null)
    }
  },
  modifyDeck(state, deck) {
    if (!completedScenario(state, 'returnToTheHouseAlwaysWins')) return deck
    const index = deck.indexOf('51014')
    if (index >= 0) deck.splice(index, 1)
    return deck
  },
  hasLateGuard(state) {
    return completedScenario(state, 'returnToTheHouseAlwaysWins')
  },
  // 供测试/前端读取的重返布置摘要。
  retSetupPlan(state, rng = () => 0.5) { return setupPlan(state, rng) },
}

export const retHelpers = { setupPlan, shuffleWith }
