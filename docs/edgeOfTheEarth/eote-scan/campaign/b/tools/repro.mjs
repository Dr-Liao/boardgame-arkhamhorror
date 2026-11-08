// 尝试在 in-process 引擎路径里复现「致命幻景议程推进 → runAgendaReveal 抛错」。
const MOD = 'file:///G:/boardgame-hall-ai/games/arkhamhorror'
await import(MOD + '/src/engine/engine.js')
const { advanceAgenda } = await import(MOD + '/src/engine/engine.js')
const { contentRegistry } = await import(MOD + '/content/registered.js')
const chapter = await import(MOD + '/content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/index.js')

const baseState = (overrides = {}) => ({
  investigators: [{ seat: 0, name: '调查员1', location: 'prisonOfMemories', damage: 0, horror: 0, clues: 0,
    resources: 5, hand: [], assets: [], engaged: [], deck: [], discard: [], threat: [], can: [] }],
  locations: [], enemies: [], storyAssets: [], victoryDisplay: [], encounterDeck: [], encounterDiscard: [], effects: [],
  agendaIndex: 0, actIndex: 0, doom: 0, clues: 0, victory: 0, actClues: 0, round: 1, phase: 'investigation',
  status: 'playing', difficulty: 'standard', numInvestigators: 1, log: [],
  campaign: { records: {}, completedSteps: [], investigators: {} },
  ...overrides,
})

const scenario = contentRegistry.getScenario('fatalMirage')
console.log('registry scenario id:', scenario?.id, 'agendas:', scenario?.agendas?.length)

const state = baseState({ scenario: structuredClone(scenario), scenarioFlags: {} })
chapter.behavior.setupLocations(state, [])
console.log('v1 after setup: agendas', state.agendas.length, 'agendaIndex', state.agendaIndex, 'threshold', state.agendas[0].doomThreshold)
state.doom = state.agendas[0].doomThreshold || 15
try {
  advanceAgenda(state, [])
  console.log('v1 advanceAgenda returned without throw; agendaIndex=', state.agendaIndex, 'status=', state.status)
} catch (error) {
  console.log('v1 REPRODUCED THROW:', String(error && error.message))
}

const state2 = baseState({ scenario: structuredClone(scenario), scenarioFlags: { fatalMirageVersion: 2 } })
chapter.behavior.setupLocations(state2, [])
console.log('v2 after setup: agendas', state2.agendas.length, 'agendaIndex', state2.agendaIndex, 'current=', JSON.stringify(state2.agendas[state2.agendaIndex]))
state2.doom = 20
try {
  advanceAgenda(state2, [])
  console.log('v2 advanceAgenda returned without throw; agendaIndex=', state2.agendaIndex, 'status=', state2.status, 'doom=', state2.doom)
} catch (error) {
  console.log('v2 THROW:', String(error && error.message))
}
