// scratch probe (auditor A) — real investigate difficulty with missing shroud (via applyMove)
import { loadEoteWorld, createHubGame, hubSetup, legalFor, decisionSeat, playMove, settleChoices }
  from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/tests/eote-p8-fixture.mjs'

const world = await loadEoteWorld()
const out = []
const log = (...p) => out.push(p.join(' '))
const state = createHubGame(world, { seats: 2, seed: 'audit-a-investigate2', investigatorCodes: ['08001', '08004'] })
hubSetup(world, state, { investigatorCodes: ['08001', '08004'] })
const seat = decisionSeat(world, state)
let moves = legalFor(world, state, seat)
playMove(world, state, moves.find(m => m.action === 'move' && m.locationId === 'frozenShores'), seat)
settleChoices(world, state)
const seat2 = decisionSeat(world, state)
moves = legalFor(world, state, seat2)
const investigate = moves.find(m => m.action === 'investigate')
log('investigate move=', JSON.stringify(investigate && { action: investigate.action, skill: investigate.skill, label: investigate.label }))
try {
  playMove(world, state, investigate, seat2)
  log('after applyMove investigate: skillTest=', JSON.stringify(state.skillTest && {
    skill: state.skillTest.skill, difficulty: state.skillTest.difficulty, difficultyIsNaN: Number.isNaN(state.skillTest.difficulty),
  }))
  settleChoices(world, state)
  log('after settle: inv clues=', state.investigators[seat2].clues, '| loc clues=', state.locations.find(l => l.id === 'frozenShores')?.clues)
  log('recent log=', (state.log || []).slice(-5).join(' || '))
} catch (e) { log('investigate THREW', e.message) }
console.log(out.join('\n'))
