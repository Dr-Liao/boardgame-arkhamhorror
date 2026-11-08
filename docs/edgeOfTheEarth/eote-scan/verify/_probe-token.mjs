// Verifier probe: real performTest token application, fatalMirage vs a working chapter.
const MOD = 'file:///G:/boardgame-hall-ai/games/arkhamhorror'
const { performTest } = await import(MOD + '/src/engine/engine.js')
const { resolveTransaction } = await import(MOD + '/src/engine/resolution.js')
const { contentRegistry } = await import(MOD + '/content/registered.js')
const { fixture } = await import(MOD + '/tests/core-fixture.mjs')

async function run (scenarioId, token, difficulty = 'standard') {
  const scenario = contentRegistry.getScenarioData(scenarioId)
  const s = fixture('01001')
  s.scenario = structuredClone(scenario)
  s.difficulty = difficulty
  s.victoryDisplay = [{ code: '08556b' }]
  s.chaosBag = [token]
  let captured = null
  const execute = draft => performTest(draft, 0, 'willpower', 2, { resolve: r => { captured = r } })
  resolveTransaction(s, 0, { action: 'verify-token' }, execute)
  for (let i = 0; s.pendingChoice && i < 30; i++) {
    const c = s.pendingChoice
    const id = ['done', 'skip', 'self'].find(o => c.options.some(x => x.id === o)) ?? c.options[0]?.id
    resolveTransaction(s, c.seat, { action: 'choose', choiceId: c.id, optionId: id }, execute)
  }
  return { value: captured?.value, success: captured?.success, drawn: captured?.drawn }
}

for (const [id, tokens] of [['fatalMirage', ['cultist', 'tablet', 'elderthing']],
  ['theHeartOfMadnessPart2', ['tablet']], ['iceAndDeathPart2', ['cultist']]]) {
  for (const token of tokens) console.log(id, token, JSON.stringify(await run(id, token)))
}
