import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, settle, answer, asset, enemy, play, use, validateMove, decisionSeat } from './core-fixture.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { performTest, getStat, createGameState } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { campaignCardChange } from '../src/campaign/campaign.js'
import { EFFECTS } from '../src/cards/card-effects.js'

// Behavioral acceptance for the Dunwich player cards that previously had only a
// structural contract. Every test drives the public move/test pipeline so the
// printed effect (not just the encoded data) is exercised.

const cardName = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code
const title = code => `Dunwich ${code} ${cardName(code)} 印刷效果行为验收`

function runTest(s, execute, choose = () => null) {
  resolveTransaction(s, decisionSeat(s) ?? 0, { action: 'gapProbe' }, execute)
  for (let i = 0; s.pendingChoice && i < 80; i++) {
    const p = s.pendingChoice
    const chosen = choose(p)
    const id = chosen ?? ['done', 'skip', 'self'].find(option => p.options.some(o => o.id === option)) ?? p.options[0]?.id
    resolveTransaction(s, p.seat, { action: 'choose', choiceId: p.id, optionId: id }, execute)
  }
}

const damageDealt = (s, id) => s.enemies.find(item => item.id === id)?.damageTaken ?? 0

// Commit options carry labels ("投入：<name>") rather than card codes.
const commitId = (p, code) => p.options.find(option => String(option.label || '').includes(cardName(code)))?.id

function finishBothTurns(s) {
  s.currentSeat = 1
  move(s, { action: 'endTurn' })
  settle(s)
  move(s, { action: 'endTurn' })
}

test(title('02025'), () => {
  const s = fixture()
  const start = s.investigators[0].location
  s.locations[0].connections = ['next']
  s.locations.push({ id: 'next', name: '相邻', revealed: true, clues: 0, connections: [s.locations[0].id] })
  s.investigators[0].hand = ['02025']
  s.encounterDeck = ['ghoulMinion', 'ghoulMinion']
  s.chaosBag = ['0', '0', '0', '0', '0']
  move(s, { action: 'endTurn' })
  settle(s, p => {
    const card = p.options.find(option => option.cardCode === '02025')
    if (card) return card.id
    if (p.kind === 'location' && p.options.some(option => option.id === 'next')) return 'next'
    return null
  })
  assert.equal(s.investigators[0].location, 'next')
  assert.equal(s.enemies.at(-1).location, start)
})

test(title('02028'), () => {
  const s = fixture()
  s.investigators[0].willpower = 8
  s.locations[0].shroud = 1
  s.locations[0].clues = 3
  const a = asset(s, '02028')
  s.chaosBag = ['skull']
  use(s, a)
  settle(s)
  assert.equal(s.investigators[0].clues, 2)
  // Losing all remaining actions ends the turn (the next turn starts with 3).
  assert.equal(s.investigators[0].actionsLeft, 3)
})

test(title('02029'), () => {
  const run = trigger => {
    const s = fixture()
    s.investigators[0].willpower = 2
    asset(s, '02029')
    s.chaosBag = ['skull']
    runTest(s, state => performTest(state, 0, 'willpower', 5, { resolve: result => { state.result = result } }),
      p => p.kind === 'reaction' && p.source === 'ritualCandles' ? (trigger ? 'trigger' : 'skip') : null)
    return s.result.value
  }
  assert.equal(run(true), run(false) + 1)
})

test(title('02032'), () => {
  const s = fixture()
  const a = asset(s, '02032')
  s.investigators[0].resources = 10
  const target = enemy(s, { fight: 1, health: 30 })
  move(s, { action: 'ability', assetId: a.id, abilityIndex: 0, targetId: target.id })
  assert.equal(s.pendingChoice.kind, 'resource')
  // "Limit three times per attack" — only 0..3 resources can be spent.
  assert.deepEqual(s.pendingChoice.options.map(option => option.id), ['0', '1', '2', '3'])
  settle(s, p => p.kind === 'resource' ? '3' : null)
  assert.equal(s.investigators[0].resources, 7)
  assert.equal(s.investigators[0].assets.find(item => item.id === a.id).code, '02032')
})

test(title('02036'), () => {
  const s = fixture()
  const a = asset(s, '02036')
  s.investigators[0].combat = 8
  s.investigators[0].actionsLeft = 10
  const target = enemy(s, { fight: 1, health: 30 })
  move(s, { action: 'ability', assetId: a.id, abilityIndex: 0, targetId: target.id })
  settle(s, p => p.kind === 'action' ? 'spend' : null)
  assert.equal(damageDealt(s, target.id), 2)
  assert.equal(s.investigators[0].actionsLeft, 8)
})

test(title('02106'), () => {
  const s = fixture('01001', 2)
  s.investigators[0].assets = [{ id: 'xavier', code: '02106', exhausted: false }]
  s.investigators[0].location = s.investigators[1].location
  const attacker = enemy(s, { location: s.investigators[1].location, engagedSeat: 1, fight: 1, evade: 1, health: 30, damage: 2, horror: 0 })
  s.investigators[1].engaged = [attacker.id]
  finishBothTurns(s)
  settle(s, p => p.kind === 'assign-damage' && p.options.some(option => option.id === 'xavier') ? 'xavier' : null)
  assert.equal(s.investigators[1].damage, 0)
  assert.equal(s.investigators[0].assets.find(item => item.id === 'xavier').damage, 2)
  // Defeat the ally: the reaction deals 2 damage to an enemy at its location.
  s.investigators[0].assets.find(item => item.id === 'xavier').damage = 2
  finishBothTurns(s)
  settle(s, p => p.kind === 'assign-damage' && p.options.some(option => option.id === 'xavier') ? 'xavier' : null)
  assert.ok(!s.investigators[0].assets.some(item => item.id === 'xavier'))
  assert.ok(s.enemies.find(item => item.id === attacker.id).damageTaken >= 2)
})

test(title('02107'), () => {
  const s = fixture()
  const target = enemy(s, { fight: 2, health: 30 })
  s.investigators[0].clues = 3
  s.investigators[0].intellect = 8
  s.investigators[0].hand = ['02107']
  move(s, { action: 'play', cardId: '02107' })
  settle(s)
  // 1 base + min(3, clues) = 4 damage.
  assert.equal(damageDealt(s, target.id), 4)
})

test(title('02108'), () => {
  const s = fixture()
  const a = asset(s, '02108')
  s.locations[0].connections = ['next']
  s.locations.push({ id: 'next', name: '相邻', revealed: true, clues: 0, connections: [s.locations[0].id] })
  move(s, { action: 'ability', assetId: a.id, abilityIndex: 0 })
  settle(s, p => p.kind === 'location' ? 'next' : null)
  assert.equal(s.investigators[0].location, 'next')
  assert.equal(s.investigators[0].assets.find(item => item.id === a.id).exhausted, true)
})

test(title('02110'), () => {
  const s = createGameState({ campaignHub: true, seed: 'adaptable-behavior' }, [{ seat: 0, role: 'human' }])
  move(s, { action: 'hubGoSetup' }); move(s, { action: 'hubSelectInvestigator', code: '01001' }); move(s, { action: 'hubAutoDeck' })
  campaignCardChange(s.campaign, 0, '02110', 'add', 'gap-test')
  move(s, { action: 'hubDoneSeat' }); move(s, { action: 'hubBeginScenario' }); settle(s)
  assert.ok(s.investigators[0].assets.some(item => item.code === '02110'))
  assert.ok(!s.investigators[0].hand.includes('02110'))
})

test(title('02111'), () => {
  const s = fixture()
  s.investigators[0].hand = ['02111']
  move(s, { action: 'play', cardId: '02111' })
  settle(s)
  assert.ok(s.victoryDisplay.some(item => item.code === '02111'))
})

test(title('02112'), () => {
  const s = fixture()
  const a = asset(s, '02112')
  s.investigators[0].willpower = 8
  const target = enemy(s, { fight: 1, health: 30 })
  s.chaosBag = ['skull']
  move(s, { action: 'ability', assetId: a.id, abilityIndex: 0, targetId: target.id })
  settle(s)
  // Base 1 + Skull bonus 2.
  assert.equal(damageDealt(s, target.id), 3)
})

test(title('02113'), () => {
  const s = fixture()
  const first = enemy(s, { fight: 3, health: 30, engagedSeat: 0 })
  const second = enemy(s, { fight: 1, health: 30, engagedSeat: null })
  s.investigators[0].engaged = [first.id]
  s.investigators[0].combat = 1
  s.investigators[0].hand = ['02113']
  s.chaosBag = ['0']
  move(s, { action: 'fight', enemyId: first.id })
  settle(s, p => {
    const card = p.options.find(option => option.cardCode === '02113')
    if (card) return card.id
    if (p.kind === 'target' && p.options.some(option => option.id === second.id)) return second.id
    return null
  })
  assert.equal(damageDealt(s, second.id), 1)
})

test(title('02114'), () => {
  const s = fixture()
  const a = asset(s, '02114')
  s.investigators[0].agility = 8
  const one = enemy(s, { evade: 1, engagedSeat: 0 })
  const two = enemy(s, { evade: 1, engagedSeat: 0 })
  s.investigators[0].engaged = [one.id, two.id]
  move(s, { action: 'ability', assetId: a.id, abilityIndex: 1 })
  settle(s)
  assert.ok(s.enemies.every(item => item.exhausted))
  assert.ok(s.exiled.includes('02114'))
})

test(title('02115'), () => {
  const s = fixture('01001', 2)
  s.investigators[1].deck = [...Array(10).fill('01088'), '02149']
  s.investigators[0].hand = ['02115']
  s.chaosBag = ['0']
  move(s, { action: 'play', cardId: '02115' })
  settle(s, p => {
    if (p.kind === 'effect') return 'ally'
    if (p.kind === 'target' && p.options.some(option => option.id === '1')) return '1'
    return null
  })
  assert.ok(s.investigators[0].assets.some(item => item.code === '02149'))
})

test(title('02147'), () => {
  const s = fixture()
  s.investigators[0].assets = [
    { id: 'bandolier', code: '02147', exhausted: false },
    { id: 'w1', code: '02016', exhausted: false },
    { id: 'w2', code: '02016', exhausted: false },
  ]
  s.investigators[0].hand = ['02016']
  move(s, { action: 'play', cardId: '02016' })
  settle(s)
  assert.equal(s.investigators[0].assets.filter(item => item.code === '02016').length, 3)
  assert.ok(s.investigators[0].assets.some(item => item.code === '02147'))
})

test(title('02150'), () => {
  const s = fixture()
  s.investigators[0].intellect = 8
  s.locations[0].shroud = 1
  s.locations[0].clues = 3
  s.investigators[0].hand = ['02150']
  s.chaosBag = ['0']
  move(s, { action: 'investigate' })
  settle(s, p => commitId(p, '02150') ?? null)
  // 1 clue + Deduction's 2 (success by 2+) = 3.
  assert.equal(s.investigators[0].clues, 3)
})

test(title('02151'), () => {
  const s = fixture('01001', 2)
  s.investigators[0].hand = ['02151']
  s.locations.forEach(location => { delete location.resign })
  delete s.scenario.resignAnywhere
  assert.ok(validateMove(s, 0, { action: 'play', cardId: '02151' }))
  s.locations[0].resign = true
  assert.equal(validateMove(s, 0, { action: 'play', cardId: '02151' }), null)
  move(s, { action: 'play', cardId: '02151' })
  settle(s)
  assert.equal(s.investigators[0].resigned, true)
})

test(title('02153'), () => {
  const s = fixture()
  const attacker = enemy(s, { fight: 1, evade: 1, health: 30, damage: 2, horror: 0, engagedSeat: 0 })
  s.investigators[0].engaged = [attacker.id]
  s.investigators[0].hand = ['02153']
  s.chaosBag = ['autofail']
  move(s, { action: 'endTurn' })
  settle(s, p => {
    const card = p.options.find(option => option.cardCode === '02153')
    return card ? card.id : null
  })
  assert.equal(s.investigators[0].damage, 0)
})

test(title('02156'), () => {
  const s = fixture()
  s.investigators[0].hand = ['02156']
  move(s, { action: 'play', cardId: '02156' })
  settle(s)
  const loc = s.locations.find(item => item.id === s.investigators[0].location)
  assert.ok(loc.lure)
  move(s, { action: 'endTurn' })
  settle(s)
  assert.equal(s.locations.find(item => item.id === loc.id)?.lure, undefined)
})

test(title('02157'), () => {
  const s = fixture()
  asset(s, '02157')
  s.investigators[0].hand = ['02230', '02269']
  move(s, { action: 'play', cardId: '02230' }); settle(s)
  move(s, { action: 'play', cardId: '02269' }); settle(s)
  assert.equal(s.investigators[0].assets.filter(item => ['02230', '02269'].includes(item.code)).length, 2)
})

test(title('02158'), () => {
  const s = fixture()
  asset(s, '02158')
  s.investigators[0].hand = ['01016', '02149']
  move(s, { action: 'play', cardId: '01016' }); settle(s)
  move(s, { action: 'play', cardId: '02149' }); settle(s)
  assert.equal(s.investigators[0].assets.filter(item => ['01016', '02149'].includes(item.code)).length, 2)
})

test(title('02185'), () => {
  const s = fixture()
  const a = asset(s, '02185')
  const before = getStat(s, s.investigators[0], 'intellect')
  move(s, { action: 'ability', assetId: a.id, abilityIndex: 0 })
  settle(s)
  assert.equal(getStat(s, s.investigators[0], 'intellect'), before + 1)
  assert.equal(s.investigators[0].resources, 28)
})

test(title('02187'), () => {
  const s = fixture()
  asset(s, '02187')
  s.investigators[0].intellect = 2
  s.investigators[0].hand = Array(5).fill('01088')
  let paid = false
  runTest(s, state => performTest(state, 0, 'intellect', 5, { resolve: result => { state.result = result } }),
    p => p.kind === 'boost' ? (paid ? 'skip' : (paid = true, 'pay')) : null)
  assert.equal(s.investigators[0].resources, 29)
})

test(title('02188'), () => {
  const s = fixture('01001', 2)
  asset(s, '02188', {}, 0)
  s.investigators[1].location = 'elsewhere'
  s.locations.push({ id: 'elsewhere', name: '别处', revealed: true, clues: 0, connections: [] })
  const before = s.investigators[0].resources
  s.currentSeat = 1
  move(s, { action: 'endTurn' })
  settle(s, p => p.options.some(option => option.id === 'trigger') ? 'trigger' : null)
  assert.equal(s.investigators[0].resources, before + 1)
})

test(title('02189'), () => {
  const s = fixture()
  asset(s, '02189')
  s.investigators[0].intellect = 2
  let paid = false
  runTest(s, state => performTest(state, 0, 'intellect', 5, { resolve: result => { state.result = result } }),
    p => p.kind === 'boost' ? (paid ? 'skip' : (paid = true, 'pay')) : null)
  assert.equal(s.investigators[0].resources, 28)
})

test(title('02190'), () => {
  const s = fixture()
  s.investigators[0].willpower = 2
  s.investigators[0].hand = ['02190']
  s.chaosBag = ['skull']
  runTest(s, state => performTest(state, 0, 'willpower', 5, { resolve: result => { state.result = result } }),
    p => p.kind === 'token' ? 'skull' : null)
  // The chosen symbol is ignored, including its modifier.
  assert.equal(s.result.value, 2)
})

test(title('02191'), () => {
  const s = fixture()
  const a = asset(s, '02191')
  s.investigators[0].willpower = 2
  runTest(s, state => performTest(state, 0, 'willpower', 5, { resolve: result => { state.result = result } }),
    p => p.kind === 'boost' ? 'pay' : null)
  assert.equal(s.investigators[0].assets.find(item => item.id === a.id).doom, 1)
  assert.equal(s.result.value, 5)
})

test(title('02192'), () => {
  const s = fixture()
  s.investigators[0].intellect = 2
  s.investigators[0].hand = ['02192']
  s.locations[0].shroud = 5
  s.locations[0].clues = 3
  move(s, { action: 'investigate' })
  const commit = s.pendingChoice
  assert.ok(commitId(commit, '02192'))
  settle(s)
})

test(title('02225'), () => {
  const s = fixture()
  const target = enemy(s, { fight: 1, evade: 1, health: 1, horror: 2, traits: ['Monster'] })
  s.investigators[0].combat = 8
  s.investigators[0].horror = 2
  s.investigators[0].hand = ['02225']
  s.chaosBag = ['0']
  move(s, { action: 'fight', enemyId: target.id })
  settle(s, p => {
    const card = p.options.find(option => option.cardCode === '02225')
    return card ? card.id : null
  })
  assert.equal(s.investigators[0].horror, 0)
})

test(title('02226'), () => {
  const s = fixture()
  const a = asset(s, '02226')
  const engaged = enemy(s, { fight: 1, health: 30, engagedSeat: 0 })
  s.investigators[0].engaged = [engaged.id]
  s.investigators[0].combat = 8
  // The rifle cannot be used against an enemy engaged with the investigator.
  assert.ok(validateMove(s, 0, { action: 'ability', assetId: a.id, abilityIndex: 0, targetId: engaged.id }))
  engaged.engagedSeat = null
  s.investigators[0].engaged = []
  s.chaosBag = ['0']
  move(s, { action: 'ability', assetId: a.id, abilityIndex: 0, targetId: engaged.id })
  settle(s)
  assert.equal(damageDealt(s, engaged.id), 3)
})

test(title('02227'), () => {
  const s = fixture()
  s.investigators[0].intellect = 8
  s.investigators[0].hand = ['02227']
  s.locations[0].shroud = 1
  s.locations[0].clues = 2
  s.chaosBag = ['0']
  move(s, { action: 'investigate' })
  const commit = s.pendingChoice
  assert.ok(commitId(commit, '02227'))
  settle(s)
})

test(title('02228'), () => {
  const s = fixture()
  const target = enemy(s, { fight: 4, health: 30 })
  s.investigators[0].intellect = 8
  s.investigators[0].hand = ['02228']
  s.chaosBag = ['0']
  move(s, { action: 'play', cardId: '02228' })
  settle(s)
  const reduced = s.enemies.find(item => item.id === target.id)
  assert.equal(reduced.fightReduction.amount, 4)
  assert.equal(s.investigators[0].assets.length, 0)
})

test(title('02229'), () => {
  const s = fixture()
  s.investigators[0].intellect = 8
  s.investigators[0].hand = ['02229']
  s.locations[0].shroud = 1
  s.locations[0].clues = 2
  s.chaosBag = ['0']
  const before = s.investigators[0].actionsLeft
  move(s, { action: 'investigate' })
  settle(s, p => commitId(p, '02229') ?? null)
  assert.equal(s.investigators[0].actionsLeft, before)
})

test(title('02231'), () => {
  const s = fixture()
  s.investigators[0].intellect = 8
  s.investigators[0].hand = ['02231']
  s.locations[0].shroud = 1
  s.locations[0].clues = 2
  s.chaosBag = ['0']
  move(s, { action: 'investigate' })
  settle(s, p => {
    const card = p.options.find(option => option.cardCode === '02231')
    return card ? card.id : null
  })
  assert.ok(s.investigators[0].hand.includes('02231'))
})

test(title('02232'), () => {
  const s = fixture()
  const a = asset(s, '02232')
  s.investigators[0].deck = [...Array(9).fill('01088'), '01089']
  move(s, { action: 'ability', assetId: a.id, abilityIndex: 0 })
  settle(s, p => {
    if (p.kind === 'deck') return '0'
    if (p.kind === 'card') return 'bottom'
    return null
  })
  assert.equal(s.investigators[0].assets.find(item => item.id === a.id).doom, 1)
  assert.equal(s.investigators[0].deck[0], '01089')
})

test(title('02233'), () => {
  const s = fixture()
  s.investigators[0].willpower = 8
  s.locations[0].shroud = 1
  s.locations[0].clues = 4
  const a = asset(s, '02233')
  s.chaosBag = ['skull']
  use(s, a)
  settle(s)
  assert.equal(s.investigators[0].clues, 3)
  assert.equal(s.investigators[0].actionsLeft, 3)
})

test(title('02235'), () => {
  const s = fixture()
  s.investigators[0].agility = 8
  s.investigators[0].hand = ['02235']
  const first = enemy(s, { evade: 1, engagedSeat: 0 })
  const second = enemy(s, { evade: 1, engagedSeat: 0 })
  s.investigators[0].engaged = [first.id, second.id]
  s.chaosBag = ['0']
  move(s, { action: 'evade', enemyId: first.id })
  settle(s, p => {
    if (p.kind === 'commit') return commitId(p, '02235') ?? null
    if (p.source === 'survivalInstinct') return 'trigger'
    return null
  })
  assert.equal(s.enemies.find(item => item.id === second.id).exhausted, true)
})

test(title('02260'), () => {
  const s = fixture('01001', 2)
  s.investigators[0].intellect = 2
  s.investigators[1].hand = ['02260']
  s.investigators[1].location = s.investigators[0].location
  runTest(s, state => performTest(state, 0, 'intellect', 6, { resolve: result => { state.result = result } }),
    p => {
      if (p.kind !== 'commit') return null
      if (p.seat === 0) return p.options.some(option => option.id === 'help') ? 'help' : 'done'
      return commitId(p, '02260') ?? 'done'
    })
  // Leadership gains [willpower][wild] when committed to another investigator's test.
  assert.ok(s.result.value > 2)
  assert.equal(s.investigators[1].hand.length, 0)
})

test(title('02265'), () => {
  const s = fixture()
  const joey = asset(s, '02265')
  s.investigators[0].hand = ['01016', '01087']
  move(s, { action: 'ability', assetId: joey.id, abilityIndex: 0 })
  settle(s, p => p.kind === 'card' ? '1' : null)
  assert.ok(s.investigators[0].assets.some(item => item.code === '01087'))
})

test(title('02268'), () => {
  const s = fixture()
  s.investigators[0].willpower = 8
  s.investigators[0].horror = 3
  s.investigators[0].hand = ['02268']
  runTest(s, state => performTest(state, 0, 'willpower', 1, { resolve: result => { state.result = result } }),
    p => p.kind === 'commit' ? (commitId(p, '02268') ?? null) : null)
  assert.equal(s.investigators[0].horror, 1)
})

test(title('02269'), () => {
  const s = fixture()
  asset(s, '02269')
  s.investigators[0].willpower = 2
  s.investigators[0].hand = []
  s.chaosBag = ['skull']
  runTest(s, state => performTest(state, 0, 'willpower', 5, { resolve: result => { state.result = result } }),
    p => p.kind === 'reaction' && p.source === 'jewelAureolus' ? 'trigger' : (p.kind === 'effect' ? '0' : null))
  assert.equal(s.investigators[0].hand.length, 1)
})

test(title('02270'), () => {
  const s = fixture()
  s.investigators[0].discard = ['02149']
  s.investigators[0].hand = ['02270']
  move(s, { action: 'play', cardId: '02270' })
  settle(s)
  assert.ok(s.investigators[0].assets.some(item => item.code === '02149'))
  move(s, { action: 'endTurn' })
  settle(s)
  assert.ok(!s.investigators[0].assets.some(item => item.code === '02149'))
})

test(title('02271'), () => {
  const s = fixture()
  s.investigators[0].willpower = 1
  s.investigators[0].hand = ['02271']
  s.chaosBag = ['0']
  runTest(s, state => performTest(state, 0, 'willpower', 5, { resolve: result => { state.result = result } }),
    p => {
      if (p.kind === 'commit') return commitId(p, '02271') ?? null
      if (p.source === '02271') return 'exile'
      return null
    })
  assert.equal(s.result.success, true)
  assert.ok(s.exiled.includes('02271'))
})

test(title('02272'), () => {
  const s = fixture()
  asset(s, '02272')
  s.investigators[0].willpower = 2
  runTest(s, state => performTest(state, 0, 'willpower', 4, { source: { label: '谈判', name: '谈判' }, resolve: result => { state.result = result } }))
  assert.equal(s.result.difficulty, 2)
})

test(title('02299'), () => {
  const s = fixture()
  const target = enemy(s, { fight: 1, health: 30 })
  s.investigators[0].combat = 8
  s.investigators[0].hand = ['02299']
  s.chaosBag = ['0']
  move(s, { action: 'fight', enemyId: target.id })
  settle(s, p => commitId(p, '02299') ?? null)
  // 1 base + Vicious Blow's +2 (success by 2+) = 3.
  assert.equal(damageDealt(s, target.id), 3)
})

test(title('02300'), () => {
  const s = fixture()
  const target = enemy(s, { fight: 1, health: 5, elite: false })
  s.investigators[0].combat = 8
  s.investigators[0].hand = ['02300']
  s.chaosBag = ['0']
  move(s, { action: 'play', cardId: '02300' })
  settle(s, p => p.kind === 'target' ? target.id : null)
  assert.equal(s.enemies.length, 0)
})

test(title('02302'), () => {
  const s = fixture()
  asset(s, '02302')
  s.investigators[0].clues = 1
  s.encounterDeck = ['dissonantVoices', 'ghoulMinion']
  s.chaosBag = ['0']
  move(s, { action: 'endTurn' })
  settle(s, p => p.kind === 'reaction' && p.options.some(option => option.id === 'trigger') ? 'trigger' : null)
  assert.equal(s.investigators[0].clues, 0)
})

test(title('02307'), () => {
  const s = fixture()
  s.investigators[0].hand = ['02307']
  s.encounterDeck = ['dissonantVoices']
  s.chaosBag = ['0']
  move(s, { action: 'endTurn' })
  settle(s, p => {
    const card = p.options.find(option => option.cardCode === '02307')
    return card ? card.id : null
  })
  assert.equal(s.investigators[0].horror, 1)
  assert.equal(s.investigators[0].threat.length, 0)
})

test(title('02308'), () => {
  const s = fixture()
  asset(s, '02308')
  const attacker = enemy(s, { fight: 1, evade: 1, health: 30, damage: 2, horror: 1, engagedSeat: 0 })
  const other = enemy(s, { fight: 1, health: 30, location: s.investigators[0].location, engagedSeat: null })
  s.investigators[0].engaged = [attacker.id]
  move(s, { action: 'endTurn' })
  settle(s, p => {
    if (p.kind === 'reaction' && p.options.some(option => option.id === 'trigger')) return 'trigger'
    if (p.kind === 'target' && p.options.some(option => option.id === other.id)) return other.id
    return null
  })
  assert.equal(s.investigators[0].damage, 0)
  assert.equal(s.investigators[0].horror, 1)
})

test(title('02193'), () => {
  const s = fixture()
  asset(s, '02193')
  s.investigators[0].combat = 2
  let paid = false
  runTest(s, state => performTest(state, 0, 'combat', 5, { resolve: result => { state.result = result } }),
    p => p.kind === 'boost' ? (paid ? 'skip' : (paid = true, 'pay')) : null)
  assert.equal(s.investigators[0].resources, 29)
  assert.equal(s.result.value, 3)
})

test(title('02309'), () => {
  const s = fixture()
  asset(s, '02309')
  s.investigators[0].intellect = 1
  s.investigators[0].hand = ['01090']
  s.locations[0].shroud = 5
  s.locations[0].clues = 2
  s.chaosBag = ['autofail']
  move(s, { action: 'investigate' })
  settle(s, p => {
    const card = p.options.find(option => option.cardCode === '01090')
    if (card) return card.id
    if (p.kind === 'reaction' && p.source === '02309') return 'trigger'
    if (p.kind === 'card' && p.options.some(option => option.cardCode === '01090')) return p.options.find(option => option.cardCode === '01090').id
    return null
  })
  assert.ok(s.investigators[0].hand.includes('01090'))
})
