// player-auditor-b runtime probes: verify suspicious D1 behaviours in the real engine path.
// Run from games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/player-b:  node _probe.mjs
import { fixture, move, asset, enemy, legalMoves, decisionSeat } from '../../../../tests/core-fixture.mjs'
import { registerCardAbilities, registeredEntry } from '../../../../src/engine/ability.js'
import { drawCards, reactionWindow } from '../../../../src/engine/engine.js'
import { resolveTransaction } from '../../../../src/engine/resolution.js'

const E = c => import(`../../../../src/cards/entries/${c}.js`).then(m => m.default)
const entries = await Promise.all(['08130', '08088', '08100', '08084'].map(E))
for (const e of entries) if (!registeredEntry(e.code)) registerCardAbilities([e])

const out = []
const log = (...a) => { out.push(a.join(' ')); console.log(...a) }

function runTest(state, execute, choose = () => null) {
  resolveTransaction(state, decisionSeat(state) ?? 0, { action: 'lifecycleProbe' }, execute)
  for (let index = 0; state.pendingChoice && index < 120; index++) {
    const pending = state.pendingChoice
    const chosen = choose(pending)
      ?? ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: chosen }, execute)
  }
}
const reactWindowProbe = (draft, context) => reactionWindow(draft, context.when, context, [])

// ---------- P1: 08130 free discardSelf on a threat card ----------
{
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].deck = ['08130']
  drawCards(state, state.investigators[0], 1, [])
  const inv = state.investigators[0]
  const threat = inv.threat.find(c => c.code === '08130')
  log('P1 weakness in threat:', Boolean(threat), 'counters=', threat?.counters)
  state.legalMoves = legalMoves(state, 0)
  const moves = state.legalMoves.filter(m => m.assetId === threat?.id)
  log('P1 legal moves for weakness:', JSON.stringify(moves.map(m => ({ a: m.action, i: m.abilityIndex, l: m.label }))))
  if (moves.length) {
    move(state, { action: 'ability', assetId: threat.id, abilityIndex: moves[0].abilityIndex })
    const after = state.investigators[0]
    log('P1 after free discard: stillInThreat=', after.threat.some(c => c.id === threat.id),
      'discardHasCode=', after.discard.includes('08130'), 'threatCodes=', JSON.stringify(after.threat.map(c => c.code)))
    // can it be used again? (if it is a real discard, the ability must be gone)
    state.legalMoves = legalMoves(state, 0)
    log('P1 ability still offered after use:', state.legalMoves.some(m => m.assetId === threat.id && m.action === 'ability'))
  }
}

// ---------- P2: 08088 uses treated as 2 on eventPlayed, any seat, no reset ----------
{
  const state = fixture('01001')
  state.investigators[0].assets = []
  asset(state, '08088')
  const uses = () => state.investigators[0].assets.find(a => a.code === '08088')?.uses
  log('P2 shotgun initial uses=', uses())
  runTest(state, draft => reactWindowProbe(draft, { when: 'eventPlayed', seat: 1, cardCode: '08020', location: draft.investigators[0].location }))
  log('P2 after OTHER seat event: uses=', uses())
  runTest(state, draft => reactWindowProbe(draft, { when: 'eventPlayed', seat: 0, cardCode: '08020', location: draft.investigators[0].location }))
  log('P2 after own event again: uses=', uses(), '(printed: value is 2 only WHILE playing an event)')
}

// ---------- P3: 08100 allows the same action twice ----------
{
  const state = fixture('01001')
  state.investigators[0].assets = []
  const chart = asset(state, '08100')
  state.locations = [{ id: 'a', name: 'A', revealed: true, connections: ['b', 'c'] },
    { id: 'b', name: 'B', revealed: true, connections: ['a'] },
    { id: 'c', name: 'C', revealed: true, connections: ['a'] }]
  state.investigators[0].location = 'a'
  state.legalMoves = legalMoves(state, 0)
  const picks = []
  move(state, { action: 'ability', assetId: chart.id, abilityIndex: 0 })
  for (let i = 0; i < 10 && state.pendingChoice; i++) {
    const pending = state.pendingChoice
    const opt = pending.options.find(o => /移动/.test(String(o.label))) || pending.options[0]
    picks.push(String(opt?.label))
    move(state, { action: 'choose', choiceId: pending.id, optionId: opt.id })
  }
  log('P3 choices=', JSON.stringify(picks), 'final location=', state.investigators[0].location,
    '(printed: TWO DIFFERENT actions, not the same twice)')
}

// ---------- P4: 08084 excludes elite enemies (unprinted restriction) ----------
{
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].hand = ['08084']
  state.locations = [{ id: 'a', name: 'A', revealed: true, connections: ['b'] },
    { id: 'b', name: 'B', revealed: true, connections: ['a'] }]
  state.investigators[0].location = 'a'
  enemy(state, { name: '精英敌人', location: 'b', elite: true, health: 5, fight: 2 })
  state.legalMoves = legalMoves(state, 0)
  const playMove = state.legalMoves.find(m => m.action === 'play' && m.cardId === '08084')
  log('P4 play 08084 with only ELITE enemy in range: offered=', Boolean(playMove),
    '| plays=', JSON.stringify(state.legalMoves.filter(m => m.action === 'play').map(m => m.cardId)))
  // real play -> does the resolve find the elite target?
  if (playMove) {
    move(state, { action: 'play', cardId: '08084' })
    for (let i = 0; i < 10 && state.pendingChoice; i++) {
      const pending = state.pendingChoice
      const opt = pending.options.find(o => /移动|线索/.test(String(o.label))) || pending.options[0]
      move(state, { action: 'choose', choiceId: pending.id, optionId: opt.id })
    }
    log('P4 after play, target moves/log:', JSON.stringify((state.log || []).slice(-3).map(x => x.text || x)))
  }
}

console.log('\n=== SUMMARY ===')
console.log(out.join('\n'))
