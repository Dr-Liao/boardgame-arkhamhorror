import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, legalMoves, move, settle, use } from './core-fixture.mjs'
import { resolveTransaction } from '../src/engine/resolution.js'
import { executeDescriptor, getStat } from '../src/engine/engine.js'

test('FHV 10093 returns the remaining five encounter cards in the selected order', () => {
  const state = fixture()
  const inv = state.investigators[0]
  inv.hand = ['10093']
  const bottom = ['ghoulMinion', 'dissonantVoices']
  const chosen = ['ancientEvils', 'graspingHands', 'rottingRemains', 'obscuringFog', 'frozenInFear']
  state.encounterDeck = [...bottom, ...chosen]
  move(state, { action: 'play', cardId: '10093' })
  const requested = [...chosen]
  settle(state, choice => {
    if (choice.options.some(option => option.id === 'top')) return 'top'
    if (choice.kind === 'card') {
      const code = requested.shift()
      return choice.options.find(option => option.cardCode === code)?.id
    }
    return null
  })
  assert.deepEqual(state.encounterDeck, [...bottom, ...chosen.toReversed()])
})

for (const code of ['10100', '10101']) {
  test('FHV ' + code + ' returns exactly one played copy at the end of the turn', () => {
    const state = fixture()
    const inv = state.investigators[0]
    inv.hand = [code]
    state.chaosBag = ['eldersign']
    state.debugNextTokens = ['eldersign']
    if (code === '10100') {
      const location = inv.location
      const foe = { id: 'evade-10100', code: 'ghoulMinion', name: '测试敌人', location,
        fight: 1, evade: 1, health: 2, damageTaken: 0, damage: 0, horror: 0, engagedSeat: 0 }
      state.enemies.push(foe)
      inv.engaged.push(foe.id)
    } else {
      const location = state.locations.find(row => row.id === inv.location)
      location.shroud = 1
      location.clues = 2
    }
    move(state, { action: 'play', cardId: code })
    settle(state)
    assert.equal(state.investigators[0].hand.includes(code), false)
    assert.equal(state.investigators[0].discard.includes(code), true)
    move(state, { action: 'endTurn' })
    settle(state)
    assert.equal(state.investigators[0].hand.filter(card => card === code).length, 1)
    assert.equal(state.investigators[0].discard.includes(code), false)
  })
}

test('FHV 10094 leaves the source damage in place when the enemy cannot take it', () => {
  const state = fixture()
  const inv = state.investigators[0]
  inv.hand = ['10094']
  inv.damage = 2
  const target = enemy(state, { fight: 1, preventDamageRound: state.round })
  move(state, { action: 'play', cardId: '10094' })
  settle(state)
  assert.equal(state.lastTestResult.success, true)
  assert.equal(state.investigators[0].damage, 2)
  assert.equal(state.enemies.find(card => card.id === target.id).damageTaken, 0)
})

test('FHV 10099 cannot be played onto a full asset whose ability cannot resolve', () => {
  const state = fixture()
  state.investigators[0].hand = ['10099']
  asset(state, '01061', { uses: 3, exhausted: true })
  assert.equal(legalMoves(state).some(option => option.action === 'play' && option.cardId === '10099'), false)
})

test('FHV 10103 leaves no skill bonus after playing a spell that performs no test', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const baseIntellect = getStat(state, inv, 'intellect')
  inv.hand = ['10103', '10024']
  state.chaosBag = ['0', '0', '0']
  move(state, { action: 'play', cardId: '10103' })
  settle(state, choice => choice.options.find(option => option.cardCode === '10024')?.id ?? null)
  assert.ok(state.investigators[0].discard.includes('10024'))
  const loc = state.locations.find(row => row.id === inv.location)
  loc.shroud = 1
  loc.clues = 2
  state.debugNextTokens = ['0']
  move(state, { action: 'investigate' })
  settle(state)
  assert.equal(state.lastTestResult.value, baseIntellect)
})

test('FHV 10096 suppresses Retaliate only for the test to which it was committed', () => {
  const state = fixture()
  const inv = state.investigators[0]
  inv.hand = ['10096']
  const foe = enemy(state, { fight: 10, retaliate: true, damage: 1 })
  state.chaosBag = ['0']
  let choseIgnore = false
  move(state, { action: 'fight', enemyId: foe.id })
  settle(state, choice => {
    const commitment = choice.options.find(item => item.cardCode === '10096' || /催眠作用|Mesmeric Influence/.test(item.label))
    if (choice.kind === 'commit' && commitment) return commitment.id
    const option = choice.options.find(item => item.id === 'ignore')
    if (option) {
      choseIgnore = true
      return option.id
    }
    return null
  })
  assert.equal(choseIgnore, true)
  assert.equal(state.lastTestResult.success, false)
  assert.equal(state.investigators[0].damage, 0)
  move(state, { action: 'fight', enemyId: foe.id })
  settle(state)
  assert.equal(state.investigators[0].damage, 1)
})

test('FHV 10096 can suppress a location’s failed-investigation effect', () => {
  const state = fixture()
  const inv = state.investigators[0]
  inv.hand = ['10096']
  const location = state.locations.find(loc => loc.id === inv.location)
  location.originalCode = '02135'
  location.shroud = 10
  location.clues = 2
  const actions = inv.actionsLeft
  move(state, { action: 'investigate' })
  settle(state, choice => {
    if (choice.kind === 'commit') return choice.options.find(option => /催眠作用|Mesmeric Influence/.test(option.label))?.id ?? null
    return choice.options.find(option => option.id === 'ignore')?.id ?? null
  })
  assert.equal(state.lastTestResult.success, false)
  assert.equal(state.investigators[0].actionsLeft, actions - 1)
  move(state, { action: 'investigate' })
  settle(state)
  assert.equal(state.investigators[0].actionsLeft, actions - 3)
})

test('FHV 10089 and 10098 return the bonded Rot when an attached enemy is removed without defeat', () => {
  const state = fixture()
  const rod = asset(state, '10098')
  const target = enemy(state, { health: 5, engagedSeat: null })
  const deck = [...state.investigators[0].deck]
  state.chaosBag = ['curse', '0', '0', '0', '0']
  use(state, rod)
  settle(state, choice => choice.options.find(option => option.cardCode === '10089')?.id ?? null)
  assert.equal(state.enemies.find(foe => foe.id === target.id).attachments.some(card => card.code === '10089'), true)
  assert.deepEqual(state.investigators[0].deck, deck)
  const execute = draft => executeDescriptor(draft, { inv: draft.investigators[0], events: [], alreadyPaid: true,
    descriptor: { kind: 'free', cost: {}, resolve: ({ api }) => {
      api.removeEnemy(draft.enemies.find(foe => foe.id === target.id))
    } } })
  resolveTransaction(state, 0, { action: 'removeRotHost' }, execute)
  assert.equal(state.enemies.some(foe => foe.id === target.id), false)
  assert.equal(Object.values(state.bondedSets).flatMap(set => set.cards).filter(code => code === '10089').length, 1)
  assert.equal(state.investigators[0].discard.includes('10089'), false)
})
