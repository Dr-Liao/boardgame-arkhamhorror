// Independent verifier probes (player-b highs) — real engine paths, in-process.
// Run: cd G:/boardgame-hall-ai && node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/_probe-verify.mjs
import { fixture, move, asset, enemy, legalMoves, decisionSeat } from '../../../../tests/core-fixture.mjs'
import { registerCardAbilities, registeredEntry } from '../../../../src/engine/ability.js'
import {
  applyHarm, drawCards, executeDescriptor, leaveAsset, playerWindow, reactionWindow, performTest, healDamageFrom,
} from '../../../../src/engine/engine.js'
import { resolveTransaction } from '../../../../src/engine/resolution.js'
import { readFileSync, writeFileSync } from 'node:fs'

const E = c => import(`../../../../src/cards/entries/${c}.js`).then(m => m.default)
const codes = ['08079', '08081', '08083', '08088', '08091', '08102', '08105', '08107', '08130']
for (const e of await Promise.all(codes.map(E))) if (!registeredEntry(e.code)) registerCardAbilities([e])

// Synthetic control entries: force a player window / reaction window to stay open so we can
// observe whether the card under test is also enumerated. They never touch repo files.
if (!registeredEntry('probe-free-1')) {
  registerCardAbilities([{ code: 'probe-free-1', fast: true, modifiers: [], abilities: [{
    kind: 'free', trigger: ['test.beforeCommit', 'test.afterCommit'], label: 'probe control free',
    cost: { action: false }, resolve: () => {},
  }] }])
}
if (!registeredEntry('probe-leave-1')) {
  registerCardAbilities([{ code: 'probe-leave-1', fast: true, modifiers: [], abilities: [{
    kind: 'played', fast: true, trigger: 'assetLeavesPlay', label: 'probe control leave',
    resolve: () => {},
  }] }])
}

const out = []
const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); out.push(s); console.log(s) }
const labels = pending => (pending?.options || []).map(o => String(o.label || o.id))
const hasLabel = (pending, re) => labels(pending).some(l => re.test(l))
const keys = o => o ? Object.keys(o) : null

function play(state, execute, select = () => null) {
  resolveTransaction(state, decisionSeat(state) ?? 0, { action: 'verifyProbe' }, execute)
  for (let i = 0; state.pendingChoice && i < 120; i++) {
    const p = state.pendingChoice
    const id = select(p, state) ?? ['done', 'skip', 'self'].find(x => p.options.some(o => o.id === x)) ?? p.options[0]?.id
    resolveTransaction(state, p.seat, { action: 'choose', choiceId: p.id, optionId: id }, execute)
  }
}

// ---------------------------------------------------------------------------
// P-A: 08105 / 08107 — state.skillTest.actionKind in a REAL fight window.
// ---------------------------------------------------------------------------
try {
  const s = fixture('01001')
  s.investigators[0].assets = []
  asset(s, '08105'); asset(s, '08107'); asset(s, 'probe-free-1')
  const foe = enemy(s, { engagedSeat: 0, fight: 0, evade: 0, health: 30 })
  s.chaosBag = ['0']
  s.investigators[0].hand = []
  move(s, { action: 'fight', enemyId: foe.id })
  let seen = null
  for (let i = 0; s.pendingChoice && i < 60; i++) {
    const p = s.pendingChoice
    if (p.kind === 'playerWindow' && p.source === 'test.beforeCommit') {
      seen = { labels: labels(p), skillTestActionKind: s.skillTest?.actionKind ?? null, skillTestSkill: s.skillTest?.skill, skillTestKeys: keys(s.skillTest) }
      break
    }
    const id = ['skip', 'done', 'self'].find(x => p.options.some(o => o.id === x)) ?? p.options[0]?.id
    move(s, { action: 'choose', choiceId: p.id, optionId: id })
  }
  log('A1 real fight test.beforeCommit window:', seen)
  log('A1 08105 offered in real fight:', seen ? seen.labels.some(l => /破冰锥/.test(l)) : 'window-not-opened')

  // same window, forged actionKind (exactly what tests/eote-player-m2-3.test.mjs:311 does)
  const f = fixture('01001'); f.investigators[0].assets = []
  asset(f, '08105'); asset(f, '08107'); asset(f, 'probe-free-1')
  f.skillTest = { seat: 0, skill: 'combat', actionKind: 'fight', pendingBonus: 0 }
  let forged = null
  play(f, draft => playerWindow(draft, 'test.beforeCommit', [], 0), p => { forged = labels(p); return 'skip' })
  log('A2 forged skillTest.actionKind=fight window options:', forged)
  log('A2 08105 offered when forged:', (forged || []).some(l => /破冰锥/.test(l)))
  log('A2 08107 abilities offered when forged:', (forged || []).filter(l => /破冰锥/.test(l)))
} catch (e) { log('A ERROR', String(e && e.stack || e)) }

// ---------------------------------------------------------------------------
// P-B: 08102 — real assetLeavesPlay window vs hand-crafted context.
// ---------------------------------------------------------------------------
try {
  const s = fixture('01001')
  s.investigators[0].hand = ['01032', '08102', 'probe-leave-1']
  s.investigators[0].assets = []
  move(s, { action: 'play', cardId: '01032' })
  const ally = s.investigators[0].assets.find(a => a.code === '01032')
  log('B1 real ally instance keys:', keys(ally), 'traits?', ally.traits, 'location?', ally.location)
  s.investigators[0].hand = ['08102', 'probe-leave-1']
  let realCtx = null
  leaveAsset(s, s.investigators[0], ally, [], { reason: 'effect' })
  realCtx = s.pendingChoice ? { source: s.pendingChoice.source, cardCode: s.pendingChoice.cardCode ?? null, options: labels(s.pendingChoice), prompt: s.pendingChoice.prompt } : null
  log('B2 real assetLeavesPlay window:', realCtx)
  log('B2 08102 offered on real window:', realCtx ? realCtx.options.some(l => /保护魂灵/.test(l)) : false)
  // hand-crafted context (the shape tests/eote-player-m2-3.test.mjs:296 uses)
  const s2 = fixture('01001'); s2.investigators[0].hand = ['08102', 'probe-leave-1']; s2.investigators[0].assets = []
  let crafted = null
  play(s2, draft => reactionWindow(draft, 'assetLeavesPlay', {
    when: 'assetLeavesPlay', seat: 0, location: draft.investigators[0].location,
    assetCode: '01032', assetId: 'c-x', reason: 'effect',
    asset: { code: '01032', traits: ['Ally'], ownerSeat: 0, location: draft.investigators[0].location },
  }, []), p => { crafted = labels(p); return 'skip' })
  log('B3 hand-crafted context options:', crafted)
  log('B3 08102 offered with crafted context:', (crafted || []).some(l => /保护魂灵/.test(l)))
} catch (e) { log('B ERROR', String(e && e.stack || e)) }

// ---------------------------------------------------------------------------
// P-C: 08130 — threat-area free discardSelf + threatDamageSink healing.
// ---------------------------------------------------------------------------
try {
  const s = fixture('01001')
  s.investigators[0].assets = []
  s.investigators[0].threat = []
  s.investigators[0].deck = ['08130']
  drawCards(s, s.investigators[0], 1, [])
  const threat = s.investigators[0].threat.find(c => c.code === '08130')
  log('C1 weakness in threat:', Boolean(threat), 'keys=', keys(threat), 'counters=', threat?.counters)
  const beforeHeal = { invDamage: s.investigators[0].damage, counters: threat?.counters }
  const healed = healDamageFrom(s, s.investigators[0], 1, [], { log: false })
  log('C2 healDamageFrom 1 ->', healed, '| before', beforeHeal, '| after invDamage=', s.investigators[0].damage,
    'stillInThreat=', s.investigators[0].threat.some(c => c.id === threat?.id), 'counters=', threat?.counters)
  s.legalMoves = legalMoves(s, 0)
  const moves = s.legalMoves.filter(m => m.assetId === threat?.id)
  log('C3 legalMoves for threat:', moves.map(m => ({ a: m.action, i: m.abilityIndex, l: m.label })))
  if (moves.length) {
    move(s, { action: 'ability', assetId: threat.id, abilityIndex: moves[0].abilityIndex })
    log('C4 after free discardSelf: stillInThreat=', s.investigators[0].threat.some(c => c.id === threat.id),
      'discardHas08130=', s.investigators[0].discard.filter(c => c === '08130').length,
      'threatCodes=', s.investigators[0].threat.map(c => c.code))
    s.legalMoves = legalMoves(s, 0)
    log('C5 ability still offered after use:', s.legalMoves.some(m => m.assetId === threat.id && m.action === 'ability'))
  }
  // playerWindow enumeration path (free descriptor of a threat card)
  const w = fixture('01001'); w.investigators[0].assets = []; w.investigators[0].threat = []
  w.investigators[0].threat.push({ id: 'thr-1', code: '08130', counters: 1, exhausted: false })
  asset(w, 'probe-free-1')
  let wOpts = null
  play(w, draft => playerWindow(draft, 'test.beforeCommit', [], 0), p => { wOpts = labels(p); return 'skip' })
  log('C6 playerWindow options with threat 08130:', wOpts)
} catch (e) { log('C ERROR', String(e && e.stack || e)) }

// ---------------------------------------------------------------------------
// P-D: 08083 — ally branch of Medical Student.
// ---------------------------------------------------------------------------
function healAllyProbe(startDamage, startHorror) {
  const s = fixture('01001')
  s.investigators[0].assets = []; s.investigators[0].hand = []
  s.investigators[0].damage = 0; s.investigators[0].horror = 0
  const ally = asset(s, '01032')
  ally.damage = startDamage; ally.horror = startHorror
  const desc = registeredEntry('08083').abilities[0]
  let picked = null
  play(s, draft => executeDescriptor(draft, {
    inv: draft.investigators[0], source: { id: 'probe:08083', code: '08083' }, descriptor: desc, events: [], silent: true,
  }), pending => {
    const opt = pending.options.find(o => String(o.id).startsWith('asset:'))
    if (opt) { picked = opt.id; return opt.id }
    return null
  })
  const after = s.investigators[0].assets.find(a => a.id === ally.id)
  return { picked, damage: after?.damage, horror: after?.horror, invDamage: s.investigators[0].damage, invHorror: s.investigators[0].horror }
}
try {
  log('D1 08083 ally target (damage1/horror1):', healAllyProbe(1, 1), 'printed: heal 1 damage + 1 horror')
  log('D2 08083 ally target (damage1/horror0):', healAllyProbe(1, 0), 'horror floor check')
} catch (e) { log('D ERROR', String(e && e.stack || e)) }

// ---------------------------------------------------------------------------
// P-E: 08088 — eventPlayed reaction triggers for another seat, uses sticks at 2.
// ---------------------------------------------------------------------------
try {
  const s = fixture('01001', 2)
  for (const inv of s.investigators) { inv.assets = []; inv.hand = [] }
  s.investigators[1].location = s.investigators[0].location
  const shotgun = asset(s, '08088')
  const uses = () => s.investigators[0].assets.find(a => a.code === '08088')?.uses
  log('E1 initial uses=', uses())
  const fire = (seat) => {
    let captured = null; let chose = null
    play(s, draft => reactionWindow(draft, 'eventPlayed', { when: 'eventPlayed', seat, cardId: '08020', cardCode: '08020', location: draft.investigators[0].location }, []), p => {
      captured = labels(p)
      const opt = p.options.find(o => String(o.label).includes('老旧的霰弹枪') || o.assetId === shotgun.id)
      if (opt) { chose = String(opt.label); return opt.id }
      return null
    })
    return { opened: captured != null, options: captured, chose, uses: uses() }
  }
  log('E2 other seat (seat1) eventPlayed ->', fire(1))
  log('E3 own seat (seat0) eventPlayed again ->', fire(0))
  log('E4 uses after own event again (no reset to 0):', uses())
} catch (e) { log('E ERROR', String(e && e.stack || e)) }

// ---------------------------------------------------------------------------
// P-F: 08081 — damage assignment still offers "self"; horror side is mandatory.
// ---------------------------------------------------------------------------
try {
  const s = fixture('01001')
  s.investigators[0].assets = []; s.investigators[0].damage = 0; s.investigators[0].horror = 0
  asset(s, '08081')
  let dmgOptions = null; let horrorOptions = null
  play(s, draft => { applyHarm(draft, draft.investigators[0], 1, 0, []) }, p => { if (p.kind === 'assign-damage') { dmgOptions = labels(p); return 'self' } return null })
  play(s, draft => { applyHarm(draft, draft.investigators[0], 0, 1, []) }, p => { if (p.kind === 'assign-horror') { horrorOptions = labels(p); return null } return null })
  log('F1 08081 damage assign options:', dmgOptions, '| self offered=', (dmgOptions || []).some(l => /由调查员承受/.test(l)))
  log('F2 08081 horror assign options:', horrorOptions, '| self offered=', (horrorOptions || []).some(l => /由调查员承受/.test(l)))
  log('F3 08081 entry.flags=', registeredEntry('08081').flags ?? null, '| composure=', registeredEntry('08081').composure)
} catch (e) { log('F ERROR', String(e && e.stack || e)) }

// ---------------------------------------------------------------------------
// P-G: 08091 — registered ability kinds (second clause presence).
// ---------------------------------------------------------------------------
try {
  const e = registeredEntry('08091')
  log('G1 08091 ability kinds/triggers:', (e.abilities || []).map(a => ({ kind: a.kind, trigger: a.trigger || null, label: a.label })))
  log('G2 08091 has tokenReveal ability:', (e.abilities || []).some(a => String(a.trigger || '').includes('tokenReveal')))
  log('G3 08091 entry source uses addEffect:', /addEffect/.test(readFileSync('G:/boardgame-hall-ai/games/arkhamhorror/src/cards/entries/08091.js', 'utf8')),
    '| uses setSigilToken:', /setSigilToken/.test(readFileSync('G:/boardgame-hall-ai/games/arkhamhorror/src/cards/entries/08091.js', 'utf8')))
} catch (e) { log('G ERROR', String(e && e.stack || e)) }

writeFileSync('G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/_probe-verify.txt', out.join('\n'))
console.log('\n=== probe done ===')
