import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, move, settle } from './core-fixture.mjs'
import { registerCardAbilities } from '../src/engine/ability.js'
import { createPlayerApi } from '../src/engine/player-mechanics.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { tokenCostAvailable, payTokenCost, validateTokenCost } from '../src/engine/token-cost.js'
import { createAbilityRules } from '../src/engine/ability-rules.js'
import { normalizeCostValues } from '../src/engine/cost.js'
import { resolveTransaction, choiceError } from '../src/engine/resolution.js'
import { performTest, executeDescriptor, effectiveTraits, slotUsage, legalMoves, validateMove } from '../src/engine/engine.js'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { validateInvestigatorMechanics } from '../src/engine/investigator-mechanics.js'
import { publicCardInstance } from '../src/integration/presentation-state.js'
import { validateDeckRules } from '../web/deck-rules.js'
import { ALL_BUILDABLE_CODES, BASIC_WEAKNESS_CODES, TIC_PLAYER_BASIC_WEAKNESS_CODES } from '../src/deck/availability.js'
import { buildDeckFromList, matchesDeckOptions, signatureAndWeaknesses } from '../src/deck/deckbuilding.js'
import { replacementAnalysis } from '../src/campaign/campaign.js'

registerCardAbilities([{ code: 'testTicP6Favor', abilities: [{ kind: 'reaction', trigger: 'beforeChaosTokenReveal',
  label: '封印标记替代揭示', cost: { exhaust: true },
  resolve: ({ context, source, api }) => api.playerTools.revealSealedInstead(context, source.id) }] }])
function run(state, execute, select = () => null) {
  resolveTransaction(state, 0, { action: 'p6Primitive' }, execute)
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 100)
    const c = state.pendingChoice
    const optionId = select(c) ?? ['done', 'skip', 'self'].find(id => c.options.some(o => o.id === id)) ?? c.options[0].id
    const command = { action: 'choose', choiceId: c.id, optionId }
    assert.equal(choiceError(state, c.seat, command), null)
    resolveTransaction(state, c.seat, command, execute)
  }
}
test('P6 token cost: exact preflight includes sealed tokens and never partially pays', () => {
  const s = fixture(); const inv = s.investigators[0]
  const api = createMechanicsApi(s).chaosTokens
  api.add('bless', 5); api.seal('host', 'bless', 2)
  assert.equal(tokenCostAvailable(s, inv, { token: 'bless', operation: 'pay', count: 5 }), false)
  assert.equal(payTokenCost(s, inv, { token: 'bless', operation: 'pay', count: 6, sealed: true }), false)
  assert.equal(api.count('bless'), 5)
  assert.equal(payTokenCost(s, inv, { token: 'bless', operation: 'pay', count: 5, sealed: true }), true)
  assert.equal(api.count('bless'), 0)
  api.add('curse', 9)
  assert.equal(payTokenCost(s, inv, { token: 'curse', operation: 'add', count: 2 }), false)
  assert.equal(api.count('curse'), 9)
  assert.throws(() => validateTokenCost({ token: 'curse', operation: 'add', count: -1 }))
  assert.throws(() => validateTokenCost({ token: 'curse', operation: 'add', count: 1, ignored: true }))
})
test('P6 token cost: dynamic shroud and difficulty use authoritative current values', () => {
  const s = fixture(); const inv = s.investigators[0]
  s.locations.find(loc => loc.id === inv.location).shroud = 3
  s.locations.find(loc => loc.id === inv.location).shroudMod = 1
  s.skillTest = { difficulty: 4 }
  assert.equal(payTokenCost(s, inv, { token: 'curse', operation: 'add', count: 'shroud' }), true)
  assert.equal(s.chaosBag.filter(t => t === 'curse').length, 4)
  assert.equal(payTokenCost(s, inv, { token: 'curse', operation: 'add', count: 'difficulty' }), true)
  assert.equal(s.chaosBag.filter(t => t === 'curse').length, 8)
})
test('P6 revealed sealed token replaces the physical bag draw and returns through test cleanup', () => {
  const s = fixture(); const inv = s.investigators[0]
  inv.assets.push({ id: 'favor', code: 'testTicP6Favor', exhausted: false })
  s.chaos = { sealed: [{ source: 'favor', token: 'bless' }], revealed: [], removed: [], frames: [] }
  run(s, draft => performTest(draft, 0, 'willpower', 0, {}), c => c.options.find(o => o.id.startsWith('desc:'))?.id)
  assert.ok(s.lastTestResult.drawn.includes('bless'))
  assert.equal(s.chaos.sealed.length, 0)
  assert.equal(s.chaosBag.filter(t => t === 'bless').length, 0, 'resolved bless returns to pool')
  assert.equal(s.chaosBag.filter(t => t === '0').length, 1)
})
test('P6 inspecting until a matching token draws without replacement and restores all tokens', () => {
  const s = fixture(); s.chaosBag = ['-1', '-2', 'curse']
  const tools = createPlayerApi(s, [], {}).playerTools
  const tokens = tools.inspectUntil(['curse'])
  assert.equal(tokens.at(-1), 'curse')
  assert.equal(new Set(tokens).size, tokens.length)
  assert.deepEqual(s.chaosBag.slice().sort(), ['-1', '-2', 'curse'].sort())
})
test('P6 resource support replenishes without deleting surplus, and exchanges secrets physically', () => {
  const s = fixture(); const inv = s.investigators[0]
  inv.assets = [{ id: 'resource', usesType: 'resources', uses: 4 }, { id: 'secret', usesType: 'secrets', uses: 1 }]
  const tools = createPlayerApi(s, [], { api: () => ({ gainResources: (seat, n) => { s.investigators[seat].resources += n } }) }).playerTools
  tools.replenishResources('resource', 2); assert.equal(inv.assets[0].uses, 4)
  inv.assets[0].uses = 0; tools.replenishResources('resource', 2); assert.equal(inv.assets[0].uses, 2)
  const old = inv.resources
  assert.equal(tools.exchangeSecret(0, 'secret', 'resource'), true)
  assert.equal(inv.resources, old + 1); assert.equal(inv.assets[1].uses, 0)
  assert.equal(tools.exchangeSecret(0, 'secret', 'secret'), true)
  assert.equal(inv.resources, old); assert.equal(inv.assets[1].uses, 1)
})
test('P6 cost: failed additional token payment preserves exhaust, resources and uses', () => {
  const s = fixture(); const inv = s.investigators[0], source = { uses: 3, exhausted: false }
  createMechanicsApi(s).chaosTokens.add('curse', 10)
  const before = inv.resources
  const rules = createAbilityRules({ normalizeCostValues })
  const descriptor = { additionalTokenCost: { token: 'curse', operation: 'add', count: 1 } }
  assert.equal(rules.payAbilityCost(s, inv, source, { exhaust: true, uses: 1, resources: 2 }, [], descriptor), false)
  assert.equal(source.exhausted, false); assert.equal(source.uses, 3); assert.equal(inv.resources, before)
})

test('P6 attachment: only the enchanted physical copy gains Relic and a full arcane slot requires replacement', () => {
  const s = fixture('07001'); s.humanSeats = [0]
  const host = asset(s, '07025'), copy = asset(s, '07025'), spell1 = asset(s, '01060'), spell2 = asset(s, '01060')
  s.investigators[0].hand = ['07261']
  move(s, { action: 'play', cardId: '07261' })
  settle(s, c => c.options.some(o => o.id === host.id) && c.prompt.startsWith('选择要附属') ? host.id
    : c.options.some(o => o.id === spell1.id) ? spell1.id : null)
  const inv = s.investigators[0], enchanted = inv.assets.find(card => card.id === host.id)
  assert.ok(effectiveTraits(s, inv, enchanted).includes('Relic'))
  assert.equal(effectiveTraits(s, inv, inv.assets.find(card => card.id === copy.id)).includes('Relic'), false)
  assert.equal(effectiveTraits(s, inv, '07025').includes('Relic'), false, 'an ambiguous title query cannot confer an instance trait')
  assert.equal(inv.assets.some(card => card.id === spell1.id), false)
  assert.ok(inv.assets.some(card => card.id === spell2.id))
  assert.equal(slotUsage(inv).arcane, 2)
})
test('P6 control: armor makes room under the selected controller and preserves the payer assets', () => {
  const s = fixture('07001', 2); s.humanSeats = [0, 1]
  s.investigators[1].location = s.investigators[0].location
  const payerAssets = [asset(s, '01060'), asset(s, '01060'), asset(s, '01072')].map(card => card.id)
  const receiverBody = asset(s, '01072', {}, 1), receiverSpell = asset(s, '01060', {}, 1)
  asset(s, '01060', {}, 1)
  s.investigators[0].hand = ['07189']
  move(s, { action: 'play', cardId: '07189' })
  settle(s, c => c.prompt.includes('控制者') ? '1' : c.options.some(o => o.id === receiverBody.id) ? receiverBody.id
    : c.options.some(o => o.id === receiverSpell.id) ? receiverSpell.id : null)
  assert.deepEqual(s.investigators[0].assets.map(card => card.id), payerAssets)
  assert.equal(s.investigators[1].assets.find(card => card.code === '07189').ownerSeat, 0)
  assert.equal(slotUsage(s.investigators[1]).arcane, 2)
  assert.equal(slotUsage(s.investigators[1]).body, 1)
})
test('P6 discount: two local rites stack in preview, validation and exact payment; empty sources leave play', () => {
  const s = fixture('01001', 2); s.humanSeats = [0, 1]
  s.investigators[1].location = s.investigators[0].location
  const rites = [asset(s, '07019'), asset(s, '07019', {}, 1)]
  const tokens = createMechanicsApi(s).chaosTokens
  tokens.add('bless', 2); for (const rite of rites) tokens.seal(rite.id, 'bless', 1)
  s.investigators[0].resources = 0; s.investigators[0].hand = ['01018']
  const play = legalMoves(s, 0).find(item => item.action === 'play' && item.cardId === '01018')
  assert.ok(play); assert.equal(validateMove(s, 0, play), null)
  move(s, play); settle(s, c => c.options.find(option => option.id.startsWith('desc:07019'))?.id)
  assert.equal(s.investigators[0].resources, 0)
  assert.ok(s.investigators[0].assets.some(card => card.code === '01018'))
  assert.equal(s.investigators.flatMap(inv => inv.assets).some(card => card.code === '07019'), false)
})
test('P6 private captures and optional state reject malformed save data', () => {
  const s = fixture(); const host = asset(s, '07267', { capturedCards: [{ code: '07039', seat: 0 }] })
  const visible = publicCardInstance(host)
  assert.equal(visible.capturedCards, undefined); assert.equal(visible.capturedCardCount, 1)
  assert.equal(validateInvestigatorMechanics(JSON.parse(JSON.stringify(s))), true)
  host.capturedCards[0].seat = 9; assert.throws(() => validateInvestigatorMechanics(s))
  host.capturedCards = []; host.restrictedActionSpent = 'yes'; assert.throws(() => validateInvestigatorMechanics(s))
  delete host.restrictedActionSpent; host.paidX = -1; assert.throws(() => validateInvestigatorMechanics(s))
  delete host.paidX; s.playerWindowOccurrences = { enemyPhaseEnds: '2' }; assert.throws(() => validateInvestigatorMechanics(s))
})
test('P6 deck: Ancestral Knowledge adds five counted cards and requires ten skills in manual construction', () => {
  const inv = INVESTIGATORS['01002'], codes = ['07303']
  const pool = ALL_BUILDABLE_CODES.filter(code => { const card = ALL_CARDS[code]; return card && card.xp === 0 && !card.subtype && !card.permanent && matchesDeckOptions(inv, card) })
  const fill = (type, target) => { for (const code of pool.filter(code => type === 'skill' ? ALL_CARDS[code].type === 'skill' : ALL_CARDS[code].type !== 'skill')) {
    for (let i = 0; i < Math.min(2, ALL_CARDS[code].deckLimit || 2) && codes.length < target; i++) codes.push(code)
    if (codes.length === target) return
  } }
  fill('skill', 11); fill('other', 36)
  assert.equal(codes.filter(code => ALL_CARDS[code].type === 'skill').length, 10)
  assert.equal(validateDeckRules(inv, codes, ALL_CARDS).errors.length, 0)
  const built = buildDeckFromList(inv, codes, { playerPool: ALL_BUILDABLE_CODES, xpBudget: 6 })
  assert.deepEqual(built.errors, []); assert.equal(built.playerCards.length, 36)
  const invalid = codes.filter(code => ALL_CARDS[code].type !== 'skill')
  assert.ok(validateDeckRules(inv, invalid, ALL_CARDS).errors.some(error => error.includes('10')))
})

test('P6 extra engage remains available after the final ordinary action and is spent only once', () => {
  const s = fixture(), inv = s.investigators[0]
  const whistle = asset(s, '07108'), foe = enemy(s, { engagedSeat: null, damage: 0 })
  inv.actionsLeft = 1
  const round = s.round
  move(s, { action: 'draw' }); settle(s)
  assert.equal(s.round, round); assert.equal(s.investigators[0].actionsLeft, 0)
  assert.ok(legalMoves(s).some(m => m.action === 'engage' && m.enemyId === foe.id))
  move(s, { action: 'engage', enemyId: foe.id }); settle(s)
  assert.ok(s.round > round || s.investigators[0].assets.find(a => a.id === whistle.id).restrictedActionSpent)
})

test('P6 transient player state survives JSON and rejects malformed test continuations', () => {
  const s = fixture()
  s.skillTest = { baseSkillOverride: 5, tokenRedraws: 2, ignoredTokenModifiers: -2,
    releaseAfterTest: ['c1'], rerollGuard: { sourceId: 'c2' }, tokenRewards: { sourceId: 'c3', ready: false, action: true } }
  assert.equal(validateInvestigatorMechanics(JSON.parse(JSON.stringify(s))), true)
  for (const [key, value] of Object.entries({ baseSkillOverride: -1, tokenRedraws: '2', ignoredTokenModifiers: NaN,
    releaseAfterTest: ['c1', 'c1'], rerollGuard: { sourceId: '' }, tokenRewards: { sourceId: 'c3', ready: 'yes', action: true } })) {
    const bad = structuredClone(s); bad.skillTest[key] = value
    assert.throws(() => validateInvestigatorMechanics(bad), key)
  }
})
test('P6 upgrade: translated grimoire is required before either researched upgrade is available', () => {
  const s = fixture('07002'), record = s.campaign.investigators[0]
  record.deck = ['07022']; record.status = 'active'
  for (const code of ['07191', '07192']) {
    assert.equal(replacementAnalysis(record, code, {}).allowed, false)
    assert.equal(replacementAnalysis(record, code, { youHaveTranslatedTheGrimoire: true }).allowed, true)
  }
})

test('P6 dependency: all three basic weaknesses are licensed for explicit setup without changing the default pool', () => {
  const inv = INVESTIGATORS['01001']
  for (const code of TIC_PLAYER_BASIC_WEAKNESS_CODES) {
    assert.deepEqual(signatureAndWeaknesses(inv, () => 0, { basicWeaknessPool: [code] }).basicWeaknesses, [code])
    assert.equal(ALL_BUILDABLE_CODES.includes(code), false)
  }
  assert.ok(BASIC_WEAKNESS_CODES.every(code => !code.startsWith('07')))
  assert.deepEqual(signatureAndWeaknesses(inv, () => 0).basicWeaknesses, [BASIC_WEAKNESS_CODES[0]])
})
