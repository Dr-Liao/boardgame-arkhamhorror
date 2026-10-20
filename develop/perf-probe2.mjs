// One-off probe #2: mid-game legalMoves size / validate cost / clone cost.
const engine = await import('../src/engine/engine.js')
const players = [{ seat: 0, name: 'p0' }, { seat: 1, name: 'p1' }]
const state = engine.createGameState({ playerInvestigator: '01001', seed: 'perf2', teammates: 1 }, players)
const settle = (s) => {
  for (let i = 0; s.pendingChoice && i < 300; i++) {
    const c = s.pendingChoice
    const id = ['done', 'skip', 'self'].find(x => c.options.some(o => o.id === x)) ?? c.options[0]?.id
    engine.applyMove(s, engine.decisionSeat(s), { action: 'choose', choiceId: c.id, optionId: id })
  }
}
settle(state)
let maxMoves = 0
let maxBytes = 0
let validateMs = 0
let applyMs = 0
let n = 0
for (let i = 0; i < 120; i++) {
  settle(state)
  const seat = engine.decisionSeat(state)
  const tA = performance.now()
  const moves = engine.legalMoves(state, seat)
  const lv = performance.now() - tA
  maxMoves = Math.max(maxMoves, moves.length)
  maxBytes = Math.max(maxBytes, JSON.stringify(moves).length)
  if (!moves.length) break
  const pick = moves.find(m => m.action === 'investigate') || moves.find(m => m.action === 'endTurn') || moves[0]
  const tB = performance.now()
  const err = engine.validateMove(state, seat, pick)
  validateMs += performance.now() - tB
  if (err) { console.log('validate error', err, JSON.stringify(pick)); break }
  const tC = performance.now()
  try { engine.applyMove(state, seat, pick) } catch (e) { console.log('apply threw', e.message); break }
  applyMs += performance.now() - tC
  n++
}
console.log('moves', n)
console.log('max legalMoves entries', maxMoves, 'max bytes', maxBytes)
console.log('avg legalMoves ms', (validateMs / Math.max(1, n)).toFixed(2), 'avg apply ms', (applyMs / Math.max(1, n)).toFixed(1))
console.log('state JSON MB', (JSON.stringify(state).length / 1048576).toFixed(2))
const { aiDecisionContext } = await import('../src/ai/ai-context.js')
const ctx = aiDecisionContext(state, 0)
console.log('ai context bytes', ctx.length)
