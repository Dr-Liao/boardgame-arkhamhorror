// scratch probe (auditor A) — 08501 symbol token resolution on engine path
import { loadEoteWorld, createHubGame, hubSetup, settleChoices }
  from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/tests/eote-p8-fixture.mjs'

const world = await loadEoteWorld()
const out = []
const log = (...p) => out.push(p.join(' '))
const state = createHubGame(world, { seats: 2, seed: 'audit-a-tokens', investigatorCodes: ['08001', '08004'] })
hubSetup(world, state, { investigatorCodes: ['08001', '08004'] })
const inv = state.investigators[0]
log('scenario=', state.scenario.id, 'difficulty=', state.difficulty, 'inv.location=', inv.location)
log('inv shelter at crashSite=', state.locations.find(l => l.id === inv.location)?.shelter)
for (const token of ['skull', 'cultist', 'tablet', 'frost']) {
  try { log('resolveSpecialToken', token, '=>', JSON.stringify(world.engine.resolveSpecialToken(state, 0, inv, token, []))) }
  catch (e) { log('resolveSpecialToken', token, 'THREW', e.message) }
}
log('tokenMeanings=', JSON.stringify(state.scenario.tokenMeanings?.[state.difficulty]))
// 把地点换到庇护 4 的地方，看 skull 是否变化
const broad = state.locations.find(l => l.id === 'broadSnowdrifts')
if (broad) { inv.location = 'broadSnowdrifts'; log('at broadSnowdrifts(shelter', broad.shelter, ') skull =>', JSON.stringify(world.engine.resolveSpecialToken(state, 0, inv, 'skull', []))) }
console.log(out.join('\n'))
