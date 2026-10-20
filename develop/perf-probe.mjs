// One-off probe: startup cost, state size, per-move cost, legalMoves size.
const t0 = performance.now()
const engine = await import('../src/engine/engine.js')
const t1 = performance.now()
const cards = await import('../src/cards/cards-data.js')
const t2 = performance.now()

console.log('import engine ms', (t1 - t0).toFixed(0))
console.log('import cards-data ms', (t2 - t1).toFixed(0))
console.log('cards count', Object.keys(cards.ALL_CARDS).length)
console.log('heap after import MB', (process.memoryUsage().heapUsed / 1048576).toFixed(1))

const players = [{ seat: 0, name: 'p0' }, { seat: 1, name: 'p1' }]
const state = engine.createGameState({ playerInvestigator: '01001', seed: 'perf', teammates: 1 }, players)

const settle = (s) => {
  for (let i = 0; s.pendingChoice && i < 200; i++) {
    const c = s.pendingChoice
    const id = ['done', 'skip', 'self'].find(x => c.options.some(o => o.id === x)) ?? c.options[0]?.id
    const seat = engine.decisionSeat(s)
    engine.applyMove(s, seat, { action: 'choose', choiceId: c.id, optionId: id })
  }
}
settle(state)

const json = JSON.stringify(state)
console.log('state JSON MB', (json.length / 1048576).toFixed(2))
console.log('legalMoves at scenario start', JSON.stringify(engine.legalMoves(state, engine.decisionSeat(state))).length, 'bytes')

// cost of one move end-to-end (clone + execute + validate)
const seat = engine.decisionSeat(state)
let n = 0
const t3 = performance.now()
for (let i = 0; i < 20; i++) {
  const moves = engine.legalMoves(state, engine.decisionSeat(state))
  if (!moves.length) break
  const pick = moves.find(m => m.action === 'investigate') || moves[0]
  const s = engine.decisionSeat(state)
  if (engine.validateMove(state, s, pick)) break
  engine.applyMove(state, s, pick)
  n++
  settle(state)
  if (state.phase === 'mythos' || state.pendingChoice) settle(state)
  if (!state.investigators.length) break
}
const t4 = performance.now()
console.log('moves applied', n, 'total ms', (t4 - t3).toFixed(0), 'per move ms', ((t4 - t3) / Math.max(1, n)).toFixed(1))
console.log('state JSON MB after', (JSON.stringify(state).length / 1048576).toFixed(2))
console.log('heap end MB', (process.memoryUsage().heapUsed / 1048576).toFixed(1))
