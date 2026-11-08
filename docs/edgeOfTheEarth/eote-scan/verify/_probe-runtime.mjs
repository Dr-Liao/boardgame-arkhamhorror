// Verifier probe: real engine entry points for fatalMirage agenda advance.
const MOD = 'file:///G:/boardgame-hall-ai/games/arkhamhorror'
const { checkAgenda, advanceAgenda } = await import(MOD + '/src/engine/engine.js')
const { contentRegistry } = await import(MOD + '/content/registered.js')
const chapter = await import(MOD + '/content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/index.js')

const behavior = contentRegistry.getBehavior('fatalMirage')
console.log('registry behavior id:', behavior?.id)
console.log('agendaReveal hook:', typeof behavior?.agendaReveal)
console.log('actReveal hook:', typeof behavior?.actReveal)
console.log('resolution hook:', typeof behavior?.resolution)
console.log('scenarioResolution export:', typeof behavior?.scenarioResolution)

const scenario = contentRegistry.getScenario('fatalMirage')
const state = () => ({
  investigators: [{ seat: 0, name: 'I1', location: 'prisonOfMemories', damage: 0, horror: 0, clues: 0,
    resources: 5, hand: [], assets: [], engaged: [], deck: [], discard: [], threat: [], can: [] }],
  locations: [], enemies: [], storyAssets: [], victoryDisplay: [], encounterDeck: [], encounterDiscard: [], effects: [],
  agendaIndex: 0, actIndex: 0, doom: 0, clues: 0, victory: 0, actClues: 0, round: 1, phase: 'mythos',
  status: 'playing', difficulty: 'standard', numInvestigators: 1, log: [],
  campaign: { records: {}, completedSteps: [], investigators: {} },
  scenario: structuredClone(scenario), scenarioFlags: {},
})

// v1: actual mythos-phase entry (turn.js:140 calls checkAgenda)
const s1 = state()
chapter.behavior.setupLocations(s1, [])
s1.doom = s1.agendas[0].doomThreshold
try {
  checkAgenda(s1, [])
  console.log('v1 checkAgenda returned; agendaIndex=', s1.agendaIndex)
} catch (e) {
  console.log('v1 checkAgenda THROW:', String(e?.message))
}

// v2: second entry via setup version override
const s2 = state()
s2.scenarioFlags = { fatalMirageVersion: 2 }
chapter.behavior.setupLocations(s2, [])
console.log('v2 agendas:', s2.agendas.length, 'agendaIndex:', s2.agendaIndex, 'agenda at index:', s2.agendas[s2.agendaIndex])
s2.doom = 20
console.log('v2 checkAgenda return value:', checkAgenda(s2, []))
console.log('v2 after checkAgenda: agendaIndex=', s2.agendaIndex, 'status=', s2.status, 'doom=', s2.doom)
console.log('v2 advanceAgenda return:', advanceAgenda(s2, []))
console.log('v2 after advanceAgenda: agendaIndex=', s2.agendaIndex, 'doom=', s2.doom)

// v3
const s3 = state()
s3.scenarioFlags = { fatalMirageVersion: 3 }
chapter.behavior.setupLocations(s3, [])
console.log('v3 agendas:', s3.agendas.length, 'agendaIndex:', s3.agendaIndex, 'agenda at index:', s3.agendas[s3.agendaIndex])
