// player-auditor-b runtime probes round 2
import { fixture, move, asset, enemy, legalMoves, decisionSeat } from '../../../../tests/core-fixture.mjs'
import { registerCardAbilities, registeredEntry } from '../../../../src/engine/ability.js'
import { applyHarm, drawCards, reactionWindow, executeDescriptor } from '../../../../src/engine/engine.js'
import { resolveTransaction } from '../../../../src/engine/resolution.js'

const E = c => import(`../../../../src/cards/entries/${c}.js`).then(m => m.default)
const codes = ['08083', '08081', '08088', '08116']
const entries = await Promise.all(codes.map(E))
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

// ---------- P5: 08083 heals ally assets? ----------
{
  const state = fixture('01001')
  state.investigators[0].assets = []
  const inv0 = state.investigators[0]
  // an Ally asset with 1 damage + 1 horror already on it
  const ally = asset(state, '01076', {}, 0) // 野猫 [[Ally]][[Creature]], health 2 sanity 2?
  ally.damage = 1
  ally.horror = 1
  const entry = registeredEntry('08083')
  const desc = entry.abilities[0]
  runTest(state, draft => executeDescriptor(draft, {
    inv: draft.investigators[0], source: { id: 'probe:08083', code: '08083' }, descriptor: desc, events: [],
    silent: true,
  }))
  const after = state.investigators[0].assets.find(a => a.id === ally.id)
  log('P5 08083 ally target: damage after =', after.damage, '(printed: heal 1 damage) horror after =', after.horror,
    '(printed: heal 1 horror)')
  log('P5 08083 registered flags =', JSON.stringify(registeredEntry('08083').flags || null))
}

// ---------- P6: 08081 composure damage side ----------
{
  const state = fixture('01001')
  state.investigators[0].assets = []
  const plucky = asset(state, '08081')
  const offers = []
  runTest(state, draft => { applyHarm(draft, draft.investigators[0], 1, 0, []) }, pending => {
    offers.push(pending.options.map(o => o.label))
    return null
  })
  log('P6 08081 damage assignment options =', JSON.stringify(offers))
  log('P6 08081 entry.composure =', registeredEntry('08081').composure,
    '| entry.flags =', JSON.stringify(registeredEntry('08081').flags || null),
    '| engine damage-side read point = flags.composureDamage (harm-threat.js:162)')
}

// ---------- P7: 08088 reaction does fire when chosen (window path) ----------
{
  const state = fixture('01001')
  state.investigators[0].assets = []
  asset(state, '08088')
  const uses = () => state.investigators[0].assets.find(a => a.code === '08088')?.uses
  runTest(state, draft => reactWindowProbe(draft, { when: 'eventPlayed', seat: 1, cardCode: '08020', location: draft.investigators[0].location }),
    pending => pending.options.find(o => /08088|老旧的霰弹枪/.test(String(o.label || '')))?.id)
  log('P7 08088 uses after OTHER-seat eventPlayed chosen option =', uses())
  runTest(state, draft => reactWindowProbe(draft, { when: 'eventPlayed', seat: 0, cardCode: '08020', location: draft.investigators[0].location }),
    pending => pending.options.find(o => /08088|老旧的霰弹枪/.test(String(o.label || '')))?.id)
  log('P7 08088 uses after own event again =', uses(), '(still 2 => no reset; printed: only while playing an event)')
}

// ---------- P8: 08116 own-turn playCondition + harmDealt cancel ----------
{
  const state = fixture('01001')
  state.investigators[0].assets = []
  log('P8 08116 playCondition =', JSON.stringify(registeredEntry('08116').playCondition?.map(p => p.message || 'fn')))
  log('P8 08116 entry.cannotLeavePlay =', registeredEntry('08116').cannotLeavePlay)
}

console.log('\n=== SUMMARY2 ===')
console.log(out.join('\n'))
