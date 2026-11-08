// scratch probe (auditor A) — Part1 uncharted-location entry fee on real engine path
import { loadEoteWorld, legalFor, decisionSeat, playMove, settleChoices }
  from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/tests/eote-p8-fixture.mjs'

const world = await loadEoteWorld()
const out = []
const log = (...parts) => out.push(parts.join(' '))
const { createHubGame, hubSetup } = await import('file:///G:/boardgame-hall-ai/games/arkhamhorror/tests/eote-p8-fixture.mjs')

const state = createHubGame(world, { seats: 2, seed: 'audit-a-entry-fee', investigatorCodes: ['08001', '08004'] })
hubSetup(world, state, { investigatorCodes: ['08001', '08004'] })
log('scenario=', state.scenario.id, 'uiState=', state.uiState)
const locs = () => state.locations.map(l => `${l.id}[rev=${l.revealed},clues=${l.clues}]`).join(',')
log('initial locations:', locs())

const seat = decisionSeat(world, state)
let moves = legalFor(world, state, seat)
const moveToFrozen = moves.find(m => m.action === 'move' && m.locationId === 'frozenShores')
log('move-to-frozenShores available:', Boolean(moveToFrozen), moveToFrozen?.label)
if (moveToFrozen) {
  playMove(world, state, moveToFrozen, seat)
  settleChoices(world, state)
  log('after move:', 'inv0@', state.investigators[0].location, '| locations:', locs())
  log('broadSnowdrifts placed by agenda-I forced:', state.locations.some(l => l.id === 'broadSnowdrifts'))
  // 给两位调查员线索（若能进入辽阔雪地，卡面要求共同花费 2 线索）
  for (const inv of state.investigators) inv.clues = 5
  const seat2 = decisionSeat(world, state)
  moves = legalFor(world, state, seat2)
  const intoBroad = moves.find(m => m.action === 'move' && m.locationId === 'broadSnowdrifts')
  log('move-into-unrevealed broadSnowdrifts available:', Boolean(intoBroad), intoBroad?.label)
  const before = state.investigators.map(inv => inv.clues)
  if (intoBroad) {
    playMove(world, state, intoBroad, seat2)
    settleChoices(world, state)
    const broad = state.locations.find(l => l.id === 'broadSnowdrifts')
    log('after entering broadSnowdrifts: revealed=', broad?.revealed, 'clues=', broad?.clues,
      '| investigator clue counts', before, '->', state.investigators.map(inv => inv.clues))
  }
}
console.log(out.join('\n'))
