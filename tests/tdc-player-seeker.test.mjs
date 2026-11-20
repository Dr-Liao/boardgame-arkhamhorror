import test from 'node:test'
import assert from 'node:assert/strict'
import { asset, enemy, fixture, legalMoves, move, play, settle, validateMove } from './core-fixture.mjs'
import { applyDamage, applyHorror, autoEvadeEnemy, enemyAttack, performTest, placeDoomOnCard, runMythos, startScenario, turnBeginningWindow } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { viewState } from '../src/integration/observation.js'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { adoptInvestigatorIdentity } from '../src/engine/investigator-form.js'
import { purchaseCard, replacementOptions } from '../src/campaign/campaign.js'

const investigator = (state, seat = 0) => state.investigators[seat]
const controlled = (state, id, seat = 0) => investigator(state, seat).assets.find(card => card.id === id)
const byCard = (pending, code) => pending.options.find(option => option.cardCode === code)?.id

function transaction(state, execute, choose = () => null) {
  resolveTransaction(state, 0, { action: 'tdcSeekerFixture' }, execute)
  for (let step = 0; state.pendingChoice; step++) {
    const pending = state.pendingChoice
    assert.ok(step < 80, pending.prompt)
    const optionId = choose(pending) ?? pending.options.find(option => ['skip', 'done', 'self'].includes(option.id))?.id
      ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
}

test('11066 uses willpower, pays one charge, and deals +2 only when the chosen face matches an ignored token', () => {
  for (const [other, damage] of [['0', 3], ['-1', 1]]) {
    const state = fixture('01004')
    const spell = asset(state, '11066')
    const target = enemy(state, { fight: 0, health: 8 })
    const bag = ['0', other, '+1', '-2']
    state.chaosBag = [...bag]
    state.debugNextTokens = ['0', other]
    const action = legalMoves(state).find(command => command.assetId === spell.id && command.targetId === target.id)
    assert.ok(action)
    let paid = false
    let chose = false
    move(state, action)
    settle(state, pending => {
      if (pending.kind === 'resource' && pending.source === spell.id) {
        paid = true
        return '1'
      }
      if (pending.kind === 'token' && pending.source === spell.id) {
        chose = true
        return pending.options[0].id
      }
      return null
    })
    assert.equal(paid, true)
    assert.equal(chose, true)
    assert.equal(state.lastTestResult.skill, 'willpower')
    assert.equal(controlled(state, spell.id).uses, 8)
    assert.equal(state.enemies.find(card => card.id === target.id).damageTaken, damage)
    assert.deepEqual(state.chaosBag.slice().sort(), bag.slice().sort())
  }
})

test('11071 protects an investigator, removes the owner’s last charge, and then discards itself after cancellation', () => {
  const state = fixture('01004')
  const charge = asset(state, '11066', { uses: 1 })
  play(state, '11071')
  settle(state, pending => pending.options.find(option => option.id === 'seat:0')?.id)
  assert.equal(investigator(state).attachments?.filter(card => card.code === '11071').length, 1)

  transaction(state, draft => applyDamage(draft, investigator(draft), 1, [], true))
  assert.equal(investigator(state).damage, 0)
  assert.equal(controlled(state, charge.id).uses, 0)
  assert.equal(investigator(state).attachments?.filter(card => card.code === '11071').length, 1)

  transaction(state, draft => applyHorror(draft, investigator(draft), 1, [], true))
  assert.equal(investigator(state).horror, 0)
  assert.equal(investigator(state).attachments?.filter(card => card.code === '11071').length, 0)
  assert.equal(investigator(state).discard.filter(code => code === '11071').length, 1)
})

test('11075 repeats the same spell at the attached location, pays both charges and only one action', () => {
  const state = fixture('01004')
  const home = state.locations.find(location => location.id === investigator(state).location)
  home.shroud = 0
  home.clues = 4
  const other = { ...home, id: 'echo-fixture', name: 'Echo fixture', locked: false, attachments: [], connections: [] }
  state.locations.push(other)
  const spell = asset(state, '02028')
  const usesBefore = spell.uses

  investigator(state).location = other.id
  play(state, '11075')
  settle(state)
  assert.equal(state.playerLocationAttachments.find(card => card.code === '11075')?.location, other.id)

  investigator(state).location = home.id
  const actions = investigator(state).actionsLeft
  const action = legalMoves(state).find(command => command.assetId === spell.id)
  assert.ok(action)
  move(state, action)
  let echoed = false
  settle(state, pending => {
    const selected = byCard(pending, '11075')
    if (selected) echoed = true
    return selected
  })
  assert.equal(echoed, true)
  assert.equal(controlled(state, spell.id).uses, usesBefore - 2)
  assert.equal(investigator(state).actionsLeft, actions - 1)
  assert.equal(state.locations.find(location => location.id === home.id).clues, 2)
  assert.equal(state.locations.find(location => location.id === other.id).clues, 2)
  assert.equal(investigator(state).location, home.id)
  assert.equal(state.playerLocationAttachments.some(card => card.code === '11075'), false)
  assert.equal(investigator(state).hand.filter(code => code === '11075').length, 1)
})

test('11076 changes the printed front while preserving harm capacities, campaign identity and play limit', () => {
  const state = fixture('01001')
  const original = investigator(state)
  const capacities = [original.maxHealth, original.maxSanity]
  const record = state.campaign.investigators[0]
  const originalDeck = [...record.deck]
  original.hand.push('11076')
  play(state, '11076')
  settle(state, pending => pending.options.find(option => option.id === '01004')?.id)
  const current = investigator(state)
  assert.equal(current.code, '01004')
  assert.equal(current.willpower, INVESTIGATORS['01004'].willpower)
  assert.deepEqual([current.maxHealth, current.maxSanity], capacities)
  assert.equal(state.campaign.investigators[0].code, record.code)
  assert.deepEqual(state.campaign.investigators[0].deck, originalDeck)
  assert.ok(current.hand.includes('11076'))
  assert.ok(validateMove(state, 0, { action: 'play', cardId: '11076' }))
})

test('11079 draws both investigators’ cards for its player, gives the first surge and skips the next draw step', () => {
  const state = fixture('01004', 2)
  investigator(state).hand.push('11079')
  const initial = state.encounterDeck.length
  let played = false
  transaction(state, draft => runMythos(draft), pending => {
    const selected = byCard(pending, '11079')
    if (selected) played = true
    return selected
  })
  assert.equal(played, true)
  assert.equal(initial - state.encounterDeck.length, 3)
  assert.equal(investigator(state).threat.length, 3)
  assert.equal(investigator(state, 1).threat.length, 0)
  assert.equal(state._mythosEncounterDrawRule, undefined)
  assert.ok(state.mythosEncounterSkipNext)

  transaction(state, draft => runMythos(draft))
  assert.equal(state.encounterDeck.length, initial - 3)
  assert.equal(state.mythosEncounterSkipNext, undefined)
  transaction(state, draft => runMythos(draft))
  assert.equal(state.encounterDeck.length, initial - 5)
})

test('11073 reveals only the actual encounter top to each observer while the asset is in play', () => {
  const state = fixture('01004', 2)
  state.encounterDeck = ['ancientEvils', 'dissonantVoices']
  const eye = asset(state, '11073')
  for (const seat of [0, 1]) {
    const view = viewState(state, seat)
    assert.equal(view.encounterTop?.code, 'dissonantVoices')
    assert.deepEqual(view.encounterDeck, [])
  }
  state.encounterDeck.pop()
  assert.equal(viewState(state, 1).encounterTop?.code, 'ancientEvils')
  investigator(state).assets.splice(investigator(state).assets.indexOf(eye), 1)
  assert.equal(viewState(state, 1).encounterTop, undefined)
})


test('11067 discovers the matching ignored token bonus in the same investigation', () => {
  for (const [other, expected] of [['0', 2], ['-1', 1]]) {
    const state = fixture('01004')
    const spell = asset(state, '11067')
    const location = state.locations.find(item => item.id === investigator(state).location)
    location.shroud = 0
    location.clues = 4
    state.chaosBag = ['0', other, '+1', '-2']
    state.debugNextTokens = ['0', other]
    const action = legalMoves(state).find(command => command.assetId === spell.id)
    assert.ok(action)
    move(state, action)
    settle(state, pending => {
      if (pending.kind === 'resource' && pending.source === spell.id) return '1'
      if (pending.kind === 'token' && pending.source === spell.id) return pending.options[0].id
      return null
    })
    assert.equal(state.lastTestResult.skill, 'willpower')
    assert.equal(controlled(state, spell.id).uses, 8)
    assert.equal(state.locations.find(item => item.id === location.id).clues, 4 - expected)
  }
})

test('11038 and 11070 gain evidence from a real seal, then spends it to discover and damage an attacking Geist', () => {
  const state = fixture('01004')
  const oculus = asset(state, '11038')
  state.chaosBag = ['0', 'skull']
  play(state, '11070')
  settle(state, pending => byCard(pending, '11038'))
  assert.equal(controlled(state, oculus.id).uses, 1)
  assert.equal(controlled(state, oculus.id).exhausted, true)
  assert.ok(state.chaos.sealed.some(row => row.token === 'skull'))

  controlled(state, oculus.id).exhausted = false
  const location = state.locations.find(item => item.id === investigator(state).location)
  location.clues = 4
  const wraith = enemy(state, { code: '05103', name: 'Wraith' })
  transaction(state, draft => {
    const attacker = draft.enemies.find(item => item.id === wraith.id)
    enemyAttack(draft, attacker, investigator(draft), [])
  }, pending => byCard(pending, '11038'))
  assert.equal(controlled(state, oculus.id).uses, 0)
  assert.equal(controlled(state, oculus.id).exhausted, true)
  assert.equal(state.locations.find(item => item.id === location.id).clues, 3)
  assert.equal(state.enemies.find(item => item.id === wraith.id).damageTaken, 1)
})

test('11039 rerolls another investigator’s symbol and awards the asset owner the success draw', () => {
  const state = fixture('01004', 2)
  state.humanSeats = [0, 1]
  investigator(state, 1).location = investigator(state).location
  const specimen = asset(state, '11039', {}, 1)
  const bag = ['skull', '0', '-1']
  state.chaosBag = [...bag]
  state.debugNextTokens = ['skull', '0']
  transaction(state, draft => performTest(draft, 0, 'willpower', 0), pending => byCard(pending, '11039'))
  assert.equal(state.lastTestResult.success, true)
  assert.equal(controlled(state, specimen.id, 1), undefined)
  assert.deepEqual(investigator(state, 1).discard, ['11039'])
  assert.equal(investigator(state, 1).hand.length, 1)
  assert.equal(investigator(state).hand.length, 0)
  assert.deepEqual(state.chaosBag.slice().sort(), bag.slice().sort())
})

test('11040 rerolls the first token and adds two charges after succeeding by exactly one', () => {
  const state = fixture('01004')
  const spell = asset(state, '11066', { uses: 0 })
  const location = state.locations.find(item => item.id === investigator(state).location)
  location.shroud = INVESTIGATORS[investigator(state).code].intellect - 1
  location.clues = 4
  state.chaosBag = ['-1', '0']
  state.debugNextTokens = ['-1', '0']
  play(state, '11040')
  let rerolled = false
  settle(state, pending => {
    if (!pending.options.some(option => option.id === 'redraw')) return null
    rerolled = true
    return 'redraw'
  })
  assert.equal(rerolled, true)
  assert.equal(state.lastTestResult.success, true)
  assert.equal(controlled(state, spell.id).uses, 2)
  assert.equal(state.locations.find(item => item.id === location.id).clues, 3)
  assert.deepEqual(state.chaosBag.slice().sort(), ['-1', '0'])
})

test('11049 banks two additional actions until the owner’s next turn begins', () => {
  const state = fixture('01004', 2)
  const device = asset(state, '11049')
  const startingActions = investigator(state).actionsLeft
  for (let attempt = 1; attempt <= 2; attempt++) {
    transaction(state, draft => performTest(draft, 0, 'willpower', 0), pending => byCard(pending, '11049'))
    assert.equal(investigator(state).actionsLeft, startingActions)
    assert.equal(investigator(state).bonusActionsOnNextTurn, attempt)
    controlled(state, device.id).exhausted = false
  }
  state.currentSeat = 1
  transaction(state, draft => turnBeginningWindow(draft, []))
  assert.equal(investigator(state).actionsLeft, startingActions)
  assert.equal(investigator(state).bonusActionsOnNextTurn, 2)
  state.currentSeat = 0
  transaction(state, draft => turnBeginningWindow(draft, []))
  assert.equal(investigator(state).actionsLeft, startingActions + 2)
  assert.equal(investigator(state).bonusActionsOnNextTurn, undefined)
})

test('11035 records research on its fourth charge and unlocks 11046, 11047 and 11048 only as its replacement', () => {
  const state = fixture('01002', 1, { expansions: ['core', 'theDrownedCity'] })
  const record = () => state.campaign.investigators[0]
  const basic = record().deck.indexOf('01033')
  assert.ok(basic >= 0)
  record().deck.splice(basic, 1, '11035')
  record().xp = 12
  const upgrades = ['11046', '11047', '11048']
  const replacements = code => replacementOptions(record(), code, state.campaign.records).map(option => option.code)
  for (const code of upgrades) assert.deepEqual(replacements(code), [], code)
  const device = asset(state, '11035', { uses: 3 })
  const foe = enemy(state, { evade: 0 })
  const action = legalMoves(state).find(command => command.action === 'evade' && command.enemyId === foe.id)
  assert.ok(action)
  move(state, action)
  settle(state, pending => byCard(pending, '11035'))
  assert.equal(controlled(state, device.id).uses, 4)
  assert.equal(state.campaign.records.youHaveCalculatedTheDayOfReckoning, true)
  for (const code of upgrades) assert.deepEqual(replacements(code), ['11035'], code)
  state.campaign.phase = 'interlude'
  const purchase = purchaseCard(state.campaign, 0, '11046', '11035')
  assert.equal(purchase.cost, 4)
  assert.equal(record().xp, 8)
  assert.ok(record().deck.includes('11046') && !record().deck.includes('11035'))
  for (const code of upgrades) assert.deepEqual(replacements(code), [], code)
})

test('11047 rerolls the upgraded device’s fight test and deals the extra damage after success', () => {
  const state = fixture('01004')
  const device = asset(state, '11047')
  const foe = enemy(state, { fight: 0, health: 8 })
  state.chaosBag = ['skull', '0']
  state.debugNextTokens = ['skull', '0']
  const action = legalMoves(state).find(command => command.assetId === device.id && command.abilityIndex === 0 && command.targetId === foe.id)
  assert.ok(action)
  let paid = false
  move(state, action)
  settle(state, pending => {
    const option = byCard(pending, '11047')
    if (paid || !option) return null
    paid = true
    return option
  })
  assert.equal(paid, true)
  assert.equal(controlled(state, device.id).uses, 3)
  assert.equal(state.enemies.find(item => item.id === foe.id).damageTaken, 2)
  assert.deepEqual(state.chaosBag.slice().sort(), ['0', 'skull'])
})

test('11078 funds an empty Spell and restores a charge when the last local clue is discovered', () => {
  const state = fixture('01004')
  const holder = asset(state, '11078')
  const spell = asset(state, '02028', { uses: 0 })
  const location = state.locations.find(item => item.id === investigator(state).location)
  location.shroud = 0
  location.clues = 2
  const action = legalMoves(state).find(command => command.assetId === spell.id)
  assert.ok(action)
  move(state, action)
  let recharged = false
  settle(state, pending => {
    const option = byCard(pending, '11078')
    if (!option) return null
    recharged = true
    return option
  })
  assert.equal(recharged, true)
  assert.equal(controlled(state, holder.id).uses, 2)
  assert.equal(controlled(state, holder.id).exhausted, true)
  assert.equal(controlled(state, spell.id).uses, 0)
  assert.equal(state.locations.find(item => item.id === location.id).clues, 0)
})

test('11046 seals a failed test’s revealed token, pays once to keep it, then releases it at round end', () => {
  const state = fixture('01002')
  const device = asset(state, '11046')
  const bag = ['-2', '0']
  state.chaosBag = [...bag]
  state.debugNextTokens = ['-2']
  transaction(state, draft => performTest(draft, 0, 'willpower', 4), pending => byCard(pending, '11046'))
  assert.equal(state.lastTestResult.success, false)
  assert.deepEqual(state.chaosBag.slice().sort(), ['0'])
  assert.ok(state.chaos.sealed.some(item => item.source === device.id && item.token === '-2'))
  move(state, { action: 'endTurn' })
  settle(state, pending => pending.source === '11046' ? 'pay' : null)
  assert.equal(controlled(state, device.id).uses, 3)
  assert.ok(state.chaos.sealed.some(item => item.source === device.id && item.token === '-2'))
  move(state, { action: 'endTurn' })
  settle(state, pending => pending.source === '11046' ? 'release' : null)
  assert.equal(controlled(state, device.id).uses, 3)
  assert.ok(!state.chaos.sealed.some(item => item.source === device.id))
  assert.deepEqual(state.chaosBag.slice().sort(), bag.slice().sort())
})

test('11048 spends one charge without spending an action and selects among an extra token per local enemy', () => {
  const state = fixture('01002')
  const device = asset(state, '11048')
  const location = state.locations.find(item => item.id === investigator(state).location)
  location.shroud = 3
  location.clues = 4
  enemy(state, { engagedSeat: null })
  enemy(state, { engagedSeat: null })
  const bag = ['-4', '-3', '0']
  state.chaosBag = [...bag]
  state.debugNextTokens = [...bag]
  const action = legalMoves(state).find(command => command.assetId === device.id && command.abilityIndex === 0)
  assert.ok(action)
  const actions = investigator(state).actionsLeft
  move(state, action)
  let chose = false
  settle(state, pending => {
    if (pending.kind !== 'token' || pending.source !== '11048') return null
    assert.deepEqual(pending.options.map(option => option.id), ['0', '1', '2'])
    chose = true
    return '2'
  })
  assert.equal(chose, true)
  assert.equal(investigator(state).actionsLeft, actions)
  assert.equal(controlled(state, device.id).uses, 3)
  assert.equal(controlled(state, device.id).exhausted, true)
  assert.equal(state.locations.find(item => item.id === location.id).clues, 3)
  assert.deepEqual(state.chaosBag.slice().sort(), bag.slice().sort())
})

test('11035 reacts once to each separate automatic or tested evade of the same enemy with a full log', () => {
  const state = fixture('01002')
  const device = asset(state, '11035')
  const foe = enemy(state, { evade: 0 })
  state.log = Array(120).fill('Earlier game log entry')
  transaction(state, draft => {
    const target = draft.enemies.find(item => item.id === foe.id)
    autoEvadeEnemy(draft, target, [], { seat: 0 })
    autoEvadeEnemy(draft, target, [], { seat: 0 })
  }, pending => byCard(pending, '11035'))
  assert.equal(controlled(state, device.id).uses, 2)
  for (const expectedUses of [3, 4]) {
    move(state, { action: 'engage', enemyId: foe.id })
    settle(state)
    move(state, { action: 'evade', enemyId: foe.id })
    settle(state, pending => byCard(pending, '11035'))
    assert.equal(controlled(state, device.id).uses, expectedUses)
  }
  assert.equal(state.log.length, 120)
})

test('11068b adds two skill points only to a Spell check and draws a card on elder sign', () => {
  const state = fixture('01004')
  adoptInvestigatorIdentity(state, investigator(state), '11068b')
  transaction(state, draft => performTest(draft, 0, 'willpower', 3))
  assert.equal(state.lastTestResult.value, 2)
  assert.equal(state.lastTestResult.success, false)

  const spell = asset(state, '02028')
  const location = state.locations.find(item => item.id === investigator(state).location)
  location.shroud = 4
  location.clues = 4
  const action = legalMoves(state).find(command => command.assetId === spell.id)
  assert.ok(action)
  move(state, action)
  settle(state)
  assert.equal(state.lastTestResult.value, 4)
  assert.equal(state.lastTestResult.success, true)
  assert.equal(state.locations.find(item => item.id === location.id).clues, 2)

  state.chaosBag = ['eldersign']
  const handSize = investigator(state).hand.length
  transaction(state, draft => performTest(draft, 0, 'willpower', 2))
  assert.equal(state.lastTestResult.value, 2)
  assert.equal(investigator(state).hand.length, handSize + 1)
})

test('11080 offers the branded Spell before drawing a starting hand and charges its regular price', () => {
  const state = fixture('01004')
  const spell = '02028'
  const record = state.campaign.investigators[0]
  record.deck = [spell, '01060', '11080', ...Array(26).fill('01088')]
  record.brandedSpell = ALL_CARDS[spell].name
  let offered = false
  transaction(state, draft => startScenario(draft, 0, []), pending => {
    if (pending.source !== '11080' || !pending.options.some(option => option.id === 'search')) return null
    assert.equal(investigator(state).hand.length, 0)
    offered = true
    return 'search'
  })
  assert.equal(offered, true)
  assert.ok(investigator(state).assets.some(card => card.code === '11080'))
  assert.ok(investigator(state).assets.some(card => card.code === spell))
  assert.ok(investigator(state).assets.every(card => card.code !== '01060'))
  assert.equal(investigator(state).resources, 5 - ALL_CARDS[spell].cost)
  assert.equal(investigator(state).hand.length, 5)
  assert.ok(!investigator(state).deck.includes(spell) && !investigator(state).hand.includes(spell))
})

test('11033 gains one evidence at exactly three above difficulty and pays the current shroud', () => {
  const state = fixture('01004')
  const reporter = asset(state, '11033', { uses: 1 })
  const location = state.locations.find(item => item.id === investigator(state).location)
  location.shroud = 1
  location.clues = 4
  location.turnShroudMod = { amount: 1, round: state.round, turnSeat: state.currentSeat }
  assert.ok(!legalMoves(state).some(command => command.assetId === reporter.id))
  transaction(state, draft => performTest(draft, 0, 'willpower', 2), pending => byCard(pending, '11033'))
  assert.equal(controlled(state, reporter.id).uses, 2)
  const action = legalMoves(state).find(command => command.assetId === reporter.id)
  assert.ok(action)
  const actions = investigator(state).actionsLeft
  move(state, action)
  settle(state)
  assert.equal(investigator(state).actionsLeft, actions)
  assert.equal(controlled(state, reporter.id).uses, 0)
  assert.equal(controlled(state, reporter.id).exhausted, true)
  assert.equal(state.locations.find(item => item.id === location.id).clues, 3)
})

test('11034 adjusts a revealed test by either one and replenishes by discarding a hand card', () => {
  for (const [adjustment, success] of [['+1', true], ['-1', false]]) {
    const state = fixture('01004')
    const talent = asset(state, '11034')
    transaction(state, draft => performTest(draft, 0, 'willpower', 5), pending =>
      byCard(pending, '11034') ?? (pending.source === '11034' ? adjustment : null))
    assert.equal(state.lastTestResult.value, 5 + Number(adjustment))
    assert.equal(state.lastTestResult.success, success)
    assert.equal(controlled(state, talent.id).uses, 0)
    investigator(state).hand.push('01088')
    const refill = legalMoves(state).find(command => command.assetId === talent.id)
    assert.ok(refill)
    move(state, refill)
    settle(state)
    assert.equal(controlled(state, talent.id).uses, 1)
    assert.equal(controlled(state, talent.id).exhausted, true)
    assert.deepEqual(investigator(state).discard, ['01088'])
  }
})

test('11036 investigates with agility and the printed bonus and heals only with an exhausted enemy', () => {
  for (const exhausted of [true, false]) {
    const state = fixture('01004')
    const kit = asset(state, '11036')
    const location = state.locations.find(item => item.id === investigator(state).location)
    location.shroud = INVESTIGATORS[investigator(state).code].agility + 1
    location.clues = 4
    investigator(state).horror = 2
    enemy(state, { exhausted, engagedSeat: null })
    const action = legalMoves(state).find(command => command.assetId === kit.id)
    assert.ok(action)
    move(state, action)
    settle(state, pending => pending.source === '11036' ? 'agility' : null)
    assert.equal(state.lastTestResult.skill, 'agility')
    assert.equal(state.lastTestResult.success, true)
    assert.equal(controlled(state, kit.id).uses, 3)
    assert.equal(investigator(state).horror, exhausted ? 1 : 2)
    assert.equal(state.locations.find(item => item.id === location.id).clues, 3)
  }
})

test('11037 saves a clue reward resource and pays toward either a Spell asset or event', () => {
  for (const spell of ['01060', '11072']) {
    const state = fixture('01004')
    play(state, '11037')
    settle(state)
    const tool = investigator(state).assets.find(card => card.code === '11037')
    assert.ok(tool)
    const location = state.locations.find(item => item.id === investigator(state).location)
    location.shroud = 0
    location.clues = 2
    move(state, { action: 'investigate' })
    settle(state, pending => byCard(pending, '11037'))
    assert.equal(controlled(state, tool.id).uses, 1)
    assert.equal(controlled(state, tool.id).exhausted, true)
    investigator(state).resources = 0
    investigator(state).hand.push('01063')
    assert.ok(!legalMoves(state).some(command => command.action === 'play' && command.cardId === '01063'))

    if (spell === '11072') enemy(state, { horror: 0, engagedSeat: null })
    investigator(state).resources = ALL_CARDS[spell].cost - 1
    play(state, spell)
    let paid = false
    settle(state, pending => {
      if (pending.kind !== 'resource' || pending.source !== tool.id) return null
      paid = true
      return '1'
    })
    assert.equal(paid, true)
    assert.equal(controlled(state, tool.id).uses, 0)
    assert.equal(investigator(state).resources, 0)
  }
})

test('11045 is playable only for a revealed clue and discovers it remotely without spending an action', () => {
  const state = fixture('01002')
  const start = state.locations.find(item => item.id === investigator(state).location)
  start.clues = 0
  const revealed = { ...start, id: 'tdc-remote-revealed', revealed: true, inPlay: true, clues: 0 }
  const hidden = { ...start, id: 'tdc-remote-hidden', revealed: false, inPlay: true, clues: 3 }
  state.locations.push(revealed, hidden)
  investigator(state).hand.push('11045')
  assert.ok(!legalMoves(state).some(command => command.action === 'play' && command.cardId === '11045'))
  revealed.clues = 2
  const actions = investigator(state).actionsLeft
  move(state, { action: 'play', cardId: '11045' })
  settle(state)
  assert.equal(investigator(state).location, start.id)
  assert.equal(investigator(state).actionsLeft, actions)
  assert.equal(state.locations.find(item => item.id === revealed.id).clues, 1)
  assert.equal(state.locations.find(item => item.id === hidden.id).clues, 3)
})

test('11069 resolves the first revealed symbol and returns all ignored numeric tokens', () => {
  const state = fixture('01004')
  const ally = asset(state, '11069')
  const bag = ['-4', '0', 'skull']
  state.chaosBag = [...bag]
  state.debugNextTokens = [...bag]
  transaction(state, draft => performTest(draft, 0, 'willpower', 4), pending => byCard(pending, '11069'))
  assert.equal(controlled(state, ally.id).exhausted, true)
  assert.deepEqual(state.lastTestResult.drawn, ['skull'])
  assert.deepEqual(state.chaosBag.slice().sort(), bag.slice().sort())
})

test('11072 excludes weakness targets, defeats regular enemies, damages Elites and places doom on failure', () => {
  for (const [elite, token, outcome] of [[false, '0', 'defeat'], [true, '0', 'damage'], [false, '-1', 'doom']]) {
    const state = fixture('01004')
    const weakness = enemy(state, { code: '01101', horror: 0, engagedSeat: null })
    investigator(state).hand.push('11072')
    assert.ok(!legalMoves(state).some(command => command.action === 'play' && command.cardId === '11072'))
    const foe = enemy(state, { elite, horror: 2, health: 8, engagedSeat: null })
    state.chaosBag = [token]
    move(state, { action: 'play', cardId: '11072' })
    settle(state)
    assert.equal(state.lastTestResult.difficulty, 5)
    const target = state.enemies.find(item => item.id === foe.id)
    assert.ok(state.enemies.some(item => item.id === weakness.id))
    if (outcome === 'defeat') assert.equal(target, undefined)
    if (outcome === 'damage') assert.equal(target.damageTaken, 3)
    if (outcome === 'doom') assert.equal(target.doom, 1)
  }
})

test('11042 gains an icon from each discarded copy and shuffles the other two back', () => {
  const state = fixture('01004')
  investigator(state).hand.push('11042')
  investigator(state).discard.push('11042', '01088', '11042')
  const baseSkill = INVESTIGATORS[investigator(state).code].intellect
  transaction(state, draft => performTest(draft, 0, 'intellect', baseSkill + 2), pending =>
    pending.kind === 'commit' ? pending.options.find(option => option.id === '0')?.id
      : pending.source === '11042' ? 'shuffle' : null)
  assert.equal(state.lastTestResult.value, baseSkill + 3)
  assert.equal(state.lastTestResult.success, true)
  assert.deepEqual(investigator(state).discard, ['01088', '11042'])
  assert.equal(investigator(state).deck.filter(code => code === '11042').length, 2)
})

test('11041 reveals the chosen parity and lets each investigator draw or pay to play in player order', () => {
  const state = fixture('01004', 2)
  state.humanSeats = [0, 1]
  state.campaign.leadSeat = 1
  const even = '06117'
  const odd = '01063'
  const reactionOnly = '01079'
  investigator(state).hand = [odd]
  investigator(state, 1).hand = [even, odd, reactionOnly]
  investigator(state, 1).location = investigator(state).location
  const location = state.locations.find(item => item.id === investigator(state).location)
  location.shroud = 0
  location.clues = 3
  const players = []
  const resources = investigator(state, 1).resources
  const actions = investigator(state, 1).actionsLeft
  play(state, '11041')
  settle(state, pending => {
    if (pending.source !== '11041') return null
    if (pending.kind === 'effect') return '0'
    if (pending.kind !== 'card') return null
    players.push(pending.seat)
    assert.ok(pending.options.every(option => option.id !== odd && option.id !== reactionOnly))
    return pending.seat === 1 ? even : 'draw'
  })
  assert.deepEqual(players, [1, 0])
  assert.ok(state.log.some(line => line.includes('揭示：')
    && [even, reactionOnly].every(code => line.includes(ALL_CARDS[code].nameZh))))
  assert.ok(investigator(state, 1).discard.includes(even))
  assert.equal(state.lastTestResult.seat, 1)
  assert.equal(state.lastTestResult.success, true)
  assert.equal(state.locations.find(item => item.id === location.id).clues, 1)
  assert.equal(state.currentSeat, 0)
  assert.equal(investigator(state, 1).resources, resources - ALL_CARDS[even].cost)
  assert.equal(investigator(state, 1).actionsLeft, actions)
  assert.deepEqual(investigator(state, 1).hand, [odd, reactionOnly])
  assert.deepEqual(investigator(state).hand, [odd, '01088'])
})

test('11043 seals a token on entry and after the final clue, then spends one to cancel and move', () => {
  const state = fixture('01004')
  const home = state.locations.find(item => item.id === investigator(state).location)
  const away = { ...home, id: 'misdirection-fixture', name: 'Misdirection destination', locked: false, connections: [home.id] }
  home.connections.push(away.id)
  state.locations.push(away)
  home.shroud = 0
  home.clues = 1
  state.chaosBag = ['+1', '0', '0']
  play(state, '11043')
  settle(state, pending => pending.options.some(option => option.id === '+1') ? '+1' : null)
  const trick = investigator(state).assets.find(card => card.code === '11043')
  assert.ok(trick)
  const sealed = () => state.chaos.sealed.filter(item => item.source === trick.id).map(item => item.token).sort()
  assert.deepEqual(sealed(), ['+1'])
  move(state, { action: 'investigate' })
  settle(state, pending => byCard(pending, '11043'))
  assert.deepEqual(sealed(), ['+1', '0'])

  const foe = enemy(state, { damage: 1, horror: 1 })
  transaction(state, draft => enemyAttack(draft, draft.enemies.find(item => item.id === foe.id), investigator(draft), []), pending => {
    const reaction = byCard(pending, '11043')
    if (reaction) return reaction
    if (pending.kind === 'token' && pending.source === '11043') return '+1'
    if (pending.kind === 'location' && pending.source === '11043') return away.id
    return null
  })
  assert.equal(investigator(state).damage, 0)
  assert.equal(investigator(state).horror, 0)
  assert.equal(investigator(state).location, away.id)
  assert.equal(controlled(state, trick.id).exhausted, true)
  assert.deepEqual(sealed(), ['0'])
})

test('11044 accepts a two-handed Tool beside a two-handed Weapon and restricts a third Weapon', () => {
  const state = fixture('01001')
  const shotgun = asset(state, '01029')
  play(state, '11044')
  settle(state)
  play(state, '10110')
  let toolDisplacedAsset = false
  settle(state, pending => {
    if (pending.kind === 'assetReplacement') toolDisplacedAsset = true
    return null
  })
  assert.equal(toolDisplacedAsset, false)
  assert.deepEqual(investigator(state).discard, [])
  assert.ok(investigator(state).assets.some(card => card.code === '10110'))
  play(state, '01044')
  let weaponReplacedShotgun = false
  settle(state, pending => {
    if (pending.kind !== 'assetReplacement') return null
    assert.deepEqual(pending.options.map(option => option.id), [shotgun.id])
    weaponReplacedShotgun = true
    return shotgun.id
  })
  assert.equal(weaponReplacedShotgun, true)
  assert.deepEqual(investigator(state).discard, ['01029'])
  assert.ok(investigator(state).assets.some(card => card.code === '10110'))
  assert.ok(investigator(state).assets.some(card => card.code === '01044'))
})

test('11065 gains one offering for controlled doom and uses all offerings for a teammate action', () => {
  const state = fixture('01004', 2)
  state.humanSeats = [0, 1]
  investigator(state, 1).location = investigator(state).location
  const blood = asset(state, '11065', { uses: 4 })
  const doomed = asset(state, '01063')
  const teammateCard = asset(state, '01033', {}, 1)
  transaction(state, draft => placeDoomOnCard(draft, controlled(draft, teammateCard.id, 1), 1, []), pending => byCard(pending, '11065'))
  assert.equal(controlled(state, blood.id).uses, 4)
  transaction(state, draft => placeDoomOnCard(draft, controlled(draft, doomed.id), 2, []), pending => byCard(pending, '11065'))
  assert.equal(controlled(state, blood.id).uses, 5)
  assert.equal(controlled(state, blood.id).exhausted, true)
  controlled(state, blood.id).exhausted = false

  const action = legalMoves(state).find(command => command.assetId === blood.id && command.targetId === '1')
  assert.ok(action)
  const resources = investigator(state, 1).resources
  const actions = [investigator(state).actionsLeft, investigator(state, 1).actionsLeft]
  move(state, action)
  let acted = false
  settle(state, pending => {
    if (pending.kind !== 'action' || pending.source !== '11065') return null
    assert.equal(pending.seat, 1)
    const resource = pending.options.find(option => /资源/.test(option.label))
    assert.ok(resource)
    acted = true
    return resource.id
  })
  assert.equal(acted, true)
  assert.equal(state.currentSeat, 0)
  assert.equal(investigator(state, 1).resources, resources + 1)
  assert.deepEqual([investigator(state).actionsLeft, investigator(state, 1).actionsLeft], actions)
  assert.equal(controlled(state, blood.id).uses, 0)
  assert.equal(controlled(state, blood.id).exhausted, true)
})

test('11074 enters fast, damages and fights without a cost, then pays an action to evade', () => {
  const state = fixture('01004')
  const foe = enemy(state, { fight: 6, evade: 6, health: 8 })
  const startingActions = investigator(state).actionsLeft
  play(state, '11074')
  settle(state, pending => {
    if (pending.source === '11074' && pending.kind === 'target') {
      return pending.options.find(option => option.id === foe.id || /攻击/.test(option.label))?.id
    }
    if (pending.source === '11074' && pending.kind === 'effect') return 'willpower'
    return byCard(pending, '11074')
  })
  const cane = investigator(state).assets.find(card => card.code === '11074')
  assert.ok(cane)
  assert.equal(investigator(state).actionsLeft, startingActions)
  assert.equal(cane.exhausted, false)
  assert.equal(state.lastTestResult.skill, 'willpower')
  assert.equal(state.lastTestResult.value, 6)
  assert.equal(state.enemies.find(item => item.id === foe.id).damageTaken, 2)

  const evade = legalMoves(state).find(command => command.assetId === cane.id
    && command.targetId === foe.id && /躲避/.test(command.label))
  assert.ok(evade)
  move(state, evade)
  settle(state, pending => pending.source === '11074' ? 'willpower' : null)
  assert.equal(state.lastTestResult.value, 6)
  assert.equal(state.lastTestResult.success, true)
  assert.equal(state.enemies.find(item => item.id === foe.id).engagedSeat, null)
  assert.equal(investigator(state).actionsLeft, startingActions - 1)
  assert.equal(controlled(state, cane.id).exhausted, true)
})

test('11077 allows only one committed copy and distributes up to three uses across local assets', () => {
  const state = fixture('01002', 2)
  investigator(state, 1).location = investigator(state).location
  investigator(state).hand = ['11077', '11077']
  const charge = asset(state, '11066', { uses: 0 })
  const secret = asset(state, '03027', { uses: 0 }, 1)
  const location = state.locations.find(item => item.id === investigator(state).location)
  location.shroud = 0
  location.clues = 2
  const assigned = [charge.id, secret.id, secret.id]
  let commits = 0
  let placements = 0
  move(state, { action: 'investigate' })
  settle(state, pending => {
    if (pending.kind === 'commit') {
      const card = pending.options.find(option => option.id === '0')?.id
      if (!card) return null
      assert.equal(commits++, 0)
      return card
    }
    if (pending.kind !== 'target' || pending.source !== '11077') return null
    return assigned[placements++]
  })
  assert.equal(commits, 1)
  assert.equal(placements, 3)
  assert.equal(controlled(state, charge.id).uses, 1)
  assert.equal(controlled(state, secret.id, 1).uses, 2)
  assert.deepEqual(investigator(state).hand, ['11077'])
  assert.deepEqual(investigator(state).discard, ['11077'])
})
