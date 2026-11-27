import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, legalMoves, move, settle, use } from './core-fixture.mjs'
import { resolveTransaction } from '../src/engine/resolution.js'
import { enemyIsMassive } from '../src/engine/enemy-keyword-movement.js'
import { executeDescriptor, getStat, scenarioRuntime } from '../src/engine/engine.js'

test('FHV 10035/10036 swap from the bonded zone and transfer only the outgoing Eyes charges', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const deck = [...inv.deck]
  const eyes = asset(state, '10035', { uses: 2, usesType: 'charges' })

  use(state, eyes, { abilityIndex: 1 })
  settle(state)
  const blade = state.investigators[0].assets.find(card => card.code === '10036')
  assert.equal(blade?.id, eyes.id)
  assert.equal(blade?.uses, 2)
  assert.equal(Object.values(state.bondedSets).some(set => set.cards.includes('10035')), true)
  assert.equal(state.investigators[0].hand.includes('10035'), false)

  use(state, blade, { abilityIndex: 1 })
  settle(state)
  const restored = state.investigators[0].assets.find(card => card.code === '10035')
  assert.equal(restored?.id, eyes.id)
  assert.equal(restored?.uses ?? 0, 0)
  assert.equal(Object.values(state.bondedSets).some(set => set.cards.includes('10036')), true)
  assert.deepEqual(state.investigators[0].hand, [])
  assert.deepEqual(state.investigators[0].deck, deck)
})

test('FHV 10043 recharges when the controller reveals an existing location', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const mask = asset(state, '10043', { uses: 0 })
  const current = state.locations.find(location => location.id === inv.location)
  state.scenario.locations.fixtureAnnex = {
    id: 'fixtureAnnex', name: '附楼', connections: [current.id], shroud: 1, clues: 0,
  }
  current.connections = [...current.connections, 'fixtureAnnex']
  scenarioRuntime(state, []).place('fixtureAnnex')
  assert.equal(state.locations.find(location => location.id === 'fixtureAnnex').revealed, false)
  assert.equal(mask.uses, 0)

  move(state, { action: 'move', locationId: 'fixtureAnnex' })
  settle(state)
  assert.equal(state.locations.find(location => location.id === 'fixtureAnnex').revealed, true)
  assert.equal(state.investigators[0].assets.find(card => card.id === mask.id).uses, 1)
})

test('FHV 10054 readies a host exhausted as the cost of its own action', () => {
  const state = fixture()
  const inv = state.investigators[0]
  inv.hand = ['10054']
  const host = asset(state, '10040')
  const location = state.locations.find(loc => loc.id === inv.location)
  location.shroud = 1
  location.clues = 2
  move(state, { action: 'play', cardId: '10054' })
  settle(state)
  use(state, host)
  settle(state, choice => choice.options.find(option => /精准调配/.test(option.label))?.id ?? null)
  const after = state.investigators[0].assets.find(card => card.id === host.id)
  assert.equal(after.exhausted, false)
  assert.equal(after.attachments.find(card => card.code === '10054').exhausted, true)
})

test('FHV 10059 sees a shroud of one while the Skeleton Key is attached', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const fungus = asset(state, '10059', { uses: 1 })
  const location = state.locations.find(loc => loc.id === inv.location)
  location.shroud = 4
  const key = asset(state, '04270')
  use(state, key)
  settle(state)
  const execute = draft => scenarioRuntime(draft, []).drawEncounter(0)
  resolveTransaction(state, 0, { action: 'myconidEncounter' }, execute)
  let reacted = false
  for (let count = 0; state.pendingChoice; count++) {
    assert.ok(count < 20)
    const choice = state.pendingChoice
    const reaction = choice.options.find(option => /饥饿霉菌/.test(option.label))
    reacted ||= Boolean(reaction)
    const optionId = reaction?.id ?? choice.options[0].id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, execute)
  }
  assert.equal(reacted, true)
  assert.equal(state.investigators[0].assets.find(card => card.id === fungus.id).uses, 0)
  assert.equal(state.investigators[0].threat.some(card => card.code === 'dissonantVoices'), false)
})

test('FHV 10065 puts the Bulldog into play after a failed parley event against an enemy', () => {
  const state = fixture()
  state.investigators[0].hand = ['09052', '10065']
  state.chaosBag = ['autofail']
  enemy(state)
  move(state, { action: 'play', cardId: '09052' })
  settle(state, choice => choice.options.find(option => /不列颠斗牛犬/.test(option.label))?.id ?? null)
  assert.equal(state.lastTestResult.success, false)
  assert.equal(state.investigators[0].hand.includes('10065'), false)
  assert.equal(state.investigators[0].assets.find(card => card.code === '10065')?.uses, 3)
})

test('FHV 10050 attaches on the first successful evade, anchors the enemy and discovers one clue', () => {
  const state = fixture()
  const inv = state.investigators[0]
  inv.hand = ['10050']
  const here = state.locations.find(loc => loc.id === inv.location)
  here.clues = 3
  state.locations.push({ id: 'rot-neighbor', name: '邻居', revealed: true, connections: [here.id], shroud: 1 })
  here.connections = [...here.connections, 'rot-neighbor']
  const foe = enemy(state, { evade: 1, fight: 1 })
  move(state, { action: 'play', cardId: '10050' })
  settle(state, choice => {
    if (choice.options.some(option => option.id === 'intellect')) return 'intellect'
    return choice.options.find(option => /躲避所附属的敌人后/.test(option.label))?.id ?? null
  })
  const attached = state.enemies.find(item => item.id === foe.id)
  assert.equal(attached.attachments.some(card => card.code === '10050'), true)
  assert.equal(enemyIsMassive(state, attached), true)
  assert.equal(legalMoves(state).some(option => option.action === 'engage' && option.enemyId === foe.id), false)
  assert.equal(state.investigators[0].clues, 1)
  const execute = draft => executeDescriptor(draft, { inv: draft.investigators[0], events: [], alreadyPaid: true,
    descriptor: { kind: 'free', cost: {}, resolve: ({ api }) => {
      const host = draft.enemies.find(item => item.id === foe.id)
      assert.notEqual(api.moveEnemy(host, 'rot-neighbor')?.moved, true)
    } } })
  resolveTransaction(state, 0, { action: 'checkAttachmentMove' }, execute)
  assert.equal(state.enemies.find(item => item.id === foe.id).location, here.id)
  state.enemies.find(item => item.id === foe.id).exhausted = false
  move(state, { action: 'evade', enemyId: foe.id })
  settle(state, choice => {
    assert.equal(choice.options.some(option => /躲避所附属的敌人后/.test(option.label)), false)
    return null
  })
  assert.equal(state.investigators[0].clues, 1, '同一调查员在同一轮不能再触发')
})

test('FHV 10039 resolves the other investigator’s complete Elder Sign effect', () => {
  const state = fixture('01001', 2)
  const tester = state.investigators[1]
  tester.code = '01003'
  asset(state, '10039', { uses: 1 })
  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(state.currentSeat, 1)
  const location = state.locations.find(loc => loc.id === tester.location)
  location.shroud = 3
  location.clues = 2
  state.chaosBag = ['-1']
  const holderResources = state.investigators[0].resources
  const testerResources = state.investigators[1].resources
  move(state, { action: 'investigate' })
  settle(state, choice => choice.options.find(option => /结算该调查员的旧印效果/.test(option.label))?.id ?? null)
  assert.equal(state.lastTestResult.success, true)
  assert.deepEqual(state.lastTestResult.drawn, ['-1'])
  assert.equal(state.investigators[0].resources, holderResources)
  assert.equal(state.investigators[1].resources, testerResources + 2)
  assert.equal(state.investigators[0].assets.some(item => item.code === '10039'), false)
})

test('FHV 10063 shuffles into its bearer’s deck when removed without defeat', () => {
  const state = fixture('01001', 2)
  const weakness = enemy(state, { code: '10063', originalCode: '10063', bearerSeat: 1, engagedSeat: null })
  const execute = draft => executeDescriptor(draft, { inv: draft.investigators[0], events: [], alreadyPaid: true,
    descriptor: { kind: 'free', cost: {}, resolve: ({ api }) => {
      api.removeEnemy(draft.enemies.find(item => item.id === weakness.id))
    } } })
  resolveTransaction(state, 0, { action: 'removeBianca' }, execute)
  assert.equal(state.enemies.some(enemy => enemy.id === weakness.id), false)
  assert.equal(state.investigators[0].deck.includes('10063'), false)
  assert.equal(state.investigators[1].deck.filter(code => code === '10063').length, 1)
  assert.equal(state.encounterDiscard.includes('10063'), false)
})

test('FHV 10035 applies the round bonus only against the chosen enemy, even after a bonded swap', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const eyes = asset(state, '10035')
  const chosen = enemy(state, { fight: 1, health: 6 })
  const uninvolved = enemy(state, { fight: 1, health: 6, engagedSeat: null })
  const combat = getStat(state, inv, 'combat')
  use(state, eyes, { targetId: chosen.id })
  settle(state)
  use(state, eyes, { abilityIndex: 1 })
  settle(state)

  move(state, { action: 'fight', enemyId: chosen.id })
  settle(state)
  assert.equal(state.lastTestResult.value, combat + 1)
  move(state, { action: 'fight', enemyId: uninvolved.id })
  settle(state)
  assert.equal(state.lastTestResult.value, combat)
})
