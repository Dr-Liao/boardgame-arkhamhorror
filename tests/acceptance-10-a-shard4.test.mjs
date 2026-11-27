import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, legalMoves, move, settle, use } from './core-fixture.mjs'
import { resolveTransaction } from '../src/engine/resolution.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { canEquip, executeDescriptor, finishScenario, performTest, scenarioRuntime } from '../src/engine/engine.js'

test('FHV 10123 returns an owned attachment only from the controller’s location', () => {
  const state = fixture('01001', 2)
  const inv = state.investigators[0]
  const technique = asset(state, '10123')
  const api = scenarioRuntime(state, [])
  api.attachToLocation(inv.location, { code: '02232', scope: 'player', ownerSeat: 0 })
  api.attachToLocation(inv.location, { code: '04109', scope: 'player', ownerSeat: 1 })

  use(state, technique)
  settle(state, choice => choice.options.find(option => option.cardCode === '02232')?.id ?? null)
  assert.deepEqual(state.investigators[0].hand, ['02232'])
  assert.equal(state.playerLocationAttachments.some(card => card.code === '04109'), true)
  assert.equal(state.playerLocationAttachments.some(card => card.code === '02232'), false)
  assert.equal(state.investigators[0].assets.find(card => card.id === technique.id).exhausted, true)
})

test('FHV 10129 grants two extra actions during the following turn only', () => {
  const state = fixture()
  const inv = state.investigators[0]
  inv.actionsLeft = 3
  inv.hand = ['10129']
  move(state, { action: 'play', cardId: '10129' })
  settle(state)
  assert.equal(state.investigators[0].actionsLeft, 1)
  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(state.investigators[0].actionsLeft, 5)
  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(state.investigators[0].actionsLeft, 3)
})

for (const code of ['10135', '10136', '10137', '10138']) {
  test('FHV ' + code + ' resists generic threat removal and allows its two-action ability', () => {
    const state = fixture()
    const threat = scenarioRuntime(state, []).threat(0, code)
    assert.ok(threat?.id)
    executeDescriptor(state, { inv: state.investigators[0], source: threat, events: [], alreadyPaid: true, descriptor: {
      kind: 'free', cost: {}, resolve: ({ api }) => assert.equal(api.removeThreat(threat), false),
    } })
    assert.equal(state.investigators[0].threat.includes(threat), true)
    const before = state.investigators[0].actionsLeft
    const discardSelf = legalMoves(state).find(option => option.action === 'ability' && option.assetId === threat.id)
    assert.ok(discardSelf)
    move(state, discardSelf)
    settle(state)
    assert.equal(state.investigators[0].actionsLeft, before - 2)
    assert.equal(state.investigators[0].threat.some(card => card.id === threat.id), false)
    assert.equal(state.investigators[0].discard.includes(code), true)
  })
}

test('FHV 10104 keeps both points of healing on the chosen target', () => {
  const state = fixture('01001', 2)
  const [healer, other] = state.investigators
  healer.damage = 1
  other.horror = 2
  state.chaosBag = ['bless', 'bless', 'curse']
  const key = asset(state, '10104')
  use(state, key)
  settle(state, choice => choice.options.find(option => option.id === 'seat:0')?.id ?? null)
  assert.equal(state.investigators[0].damage, 0)
  assert.equal(state.investigators[1].horror, 2)
})

test('FHV 10131 lets each ignored curse damage a different enemy', () => {
  const state = fixture()
  const inv = state.investigators[0]
  inv.hand = ['10131']
  state.chaosBag = ['curse', 'curse', '0']
  state.debugNextTokens = ['curse', 'curse', '0']
  const location = state.locations.find(loc => loc.id === inv.location)
  location.shroud = 1
  location.clues = 2
  const first = enemy(state, { engagedSeat: null })
  const second = enemy(state, { engagedSeat: null })
  const targets = [first.id, second.id]
  move(state, { action: 'investigate' })
  settle(state, choice => {
    if (choice.kind === 'enemy') return targets.shift()
    return choice.options.find(option => option.cardCode === '10131')?.id ?? null
  })
  assert.equal(state.lastTestResult.success, true)
  assert.deepEqual(state.enemies.filter(foe => [first.id, second.id].includes(foe.id)).map(foe => foe.damageTaken), [1, 1])
})

test('FHV 10121 Hunting Jacket is available while another investigator takes a turn', () => {
  const state = fixture('01001', 2)
  state.investigators[0].hand = ['01088']
  const jacket = asset(state, '10121')
  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(state.currentSeat, 1)
  const location = state.locations.find(loc => loc.id === state.investigators[1].location)
  location.shroud = 1
  location.clues = 2
  const resources = state.investigators[0].resources

  move(state, { action: 'investigate' })
  let activated = false
  settle(state, choice => {
    if (!activated && choice.seat === 0 && choice.kind === 'playerWindow') {
      const option = choice.options.find(option => /横置.*非弱点手牌/.test(option.label))
      if (option) {
        activated = true
        return option.id
      }
    }
    return choice.options.find(option => option.cardCode === '01088')?.id ?? null
  })
  assert.equal(activated, true)
  const after = state.investigators[0].assets.find(card => card.id === jacket.id)
  assert.equal(after.attachments.some(card => card.code === '01088' && card.facedown), true)
  assert.equal(state.investigators[0].resources, resources + 1)
})

test('FHV 10117 lets a different investigator at the enemy’s location take the attached Hatchet', () => {
  const state = fixture('01001', 2)
  const axe = asset(state, '10117', { ownerSeat: 0 })
  const foe = enemy(state, { fight: 1, health: 3 })
  use(state, axe, { targetId: foe.id })
  settle(state)
  assert.equal(state.enemies.find(item => item.id === foe.id)?.attachments?.[0]?.id, axe.id)
  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(state.currentSeat, 1)

  move(state, { action: 'fight', enemyId: foe.id })
  settle(state, choice => choice.seat === 1
    ? choice.options.find(option => /接手飞斧/.test(option.label))?.id ?? null : null)
  assert.equal(state.enemies.some(item => item.id === foe.id), false)
  const claimed = state.investigators[1].assets.find(item => item.id === axe.id)
  assert.equal(claimed?.ownerSeat, 0)
  assert.equal(claimed?.controllerSeat, 1)
  assert.equal(state.investigators[0].discard.includes('10117'), false)
})

test('FHV 10109 grants exactly one purchase discount when the owner resigns with the card in hand', () => {
  const state = fixture('01001', 2)
  const inv = state.investigators[0]
  inv.hand = ['10109']
  state.locations.find(loc => loc.id === inv.location).resign = true
  move(state, { action: 'resign' })
  settle(state, choice => choice.options.find(option => /下一张新购卡牌/.test(option.label))?.id ?? null)
  assert.equal(state.investigators[0].resigned, true)
  assert.deepEqual(state.campaign.investigators[0].purchaseDiscount, { amount: 1, uses: 1 })
  assert.equal(state.campaign.investigators[1].purchaseDiscount, undefined)
})

test('FHV 10109 offers its purchase discount when an investigator remains in the scenario until resolution', () => {
  const state = fixture()
  state.investigators[0].hand = ['10109']
  const resolution = Object.keys(state.scenario.resolutions)[0]
  const execute = draft => {
    try { finishScenario(draft, resolution, []) }
    catch (error) { if (error.message !== '剧本结算完成' || !Object.hasOwn(error, 'nextIndex')) throw error }
  }
  resolveTransaction(state, 0, { action: 'peltScenarioEnding' }, execute)
  for (let count = 0; state.pendingChoice; count++) {
    assert.ok(count < 50)
    const choice = state.pendingChoice
    const option = choice.options.find(item => /下一张新购卡牌/.test(item.label)) ?? choice.options[0]
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: option.id }, execute)
  }
  assert.deepEqual(state.campaign.investigators[0].purchaseDiscount, { amount: 1, uses: 1 })
})

test('FHV 10126 retries the whole failed investigation and resolves clue discovery when the retry succeeds', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  const token = asset(state, '10126')
  const location = state.locations.find(loc => loc.id === inv.location)
  location.shroud = 1
  location.clues = 2
  state.chaosBag = ['autofail', '0']
  state.debugNextTokens = ['autofail', '0']
  const actions = inv.actionsLeft
  move(state, { action: 'investigate' })
  settle(state, choice => {
    if (choice.options.some(option => option.id === 'retry')) return 'retry'
    return choice.options.find(option => /宗教信物/.test(option.label))?.id ?? null
  })
  assert.equal(state.investigators[0].clues, 1)
  assert.equal(state.investigators[0].actionsLeft, actions - 1)
  assert.equal(state.investigators[0].assets.find(item => item.id === token.id).exhausted, true)
  assert.equal(state.lastTestResult.success, true)
})

test('FHV 10110 transfers control to any present investigator and discards to its owner if the location leaves', () => {
  for (const removeLocation of [false, true]) {
    const state = fixture('01001', 2)
    const owner = state.investigators[0]
    const here = owner.location
    const fork = asset(state, '10110', { ownerSeat: 0 })
    const foe = enemy(state, { fight: 1, health: 10 })
    use(state, fork, { targetId: foe.id })
    settle(state)
    const attached = state.locations.find(loc => loc.id === here).attachments.find(card => card.code === '10110')
    assert.equal(attached?.id, fork.id)
    assert.equal(attached?.ownerSeat, 0)
    if (removeLocation) {
      scenarioRuntime(state, []).remove(here)
      assert.equal(state.investigators[0].discard.filter(code => code === '10110').length, 1)
      assert.equal(state.investigators[1].discard.includes('10110'), false)
      continue
    }

    move(state, { action: 'endTurn' })
    settle(state)
    assert.equal(state.currentSeat, 1)
    const detach = legalMoves(state).find(option => option.action === 'detachLocationAttachment')
    assert.ok(detach)
    move(state, detach)
    settle(state)
    const claimed = state.investigators[1].assets.find(card => card.id === fork.id)
    assert.equal(claimed?.ownerSeat, 0)
    assert.equal(claimed?.controllerSeat, 1)
  }
})

test('FHV 10118 shuffles after a discard-pile commitment and follows normal discard after hand commitment', () => {
  for (const zone of ['discard', 'hand']) {
    const state = fixture('01001')
    const inv = state.investigators[0]
    inv[zone] = ['10118']
    const location = state.locations.find(loc => loc.id === inv.location)
    location.shroud = 4
    location.clues = 2
    move(state, { action: 'investigate' })
    settle(state, choice => choice.options.find(option => option.cardCode === '10118' || /百折不挠/.test(option.label))?.id ?? null)
    assert.equal(state.lastTestResult.success, true)
    assert.equal(state.investigators[0].deck.filter(code => code === '10118').length, zone === 'discard' ? 1 : 0)
    assert.equal(state.investigators[0].discard.filter(code => code === '10118').length, zone === 'discard' ? 0 : 1)
  }
})

test('FHV 10132 shares one restricted slot across hand, accessory, and arcane', () => {
  const state = fixture()
  const inv = state.investigators[0]
  asset(state, '10132')
  asset(state, '01059')
  asset(state, '01060')
  asset(state, '01061')
  assert.equal(canEquip(inv, ALL_CARDS['10019']), true)
  assert.equal(canEquip(inv, ALL_CARDS['04031']), true)
  asset(state, '10019')
  assert.equal(canEquip(inv, ALL_CARDS['04031']), false)
})
test('FHV 10123 recovers an owned physical attachment without taking any nearby card', () => {
  const state = fixture('01001', 2)
  const inv = state.investigators[0]
  const location = inv.location
  const key = asset(state, '04270')
  const technique = asset(state, '10123')
  scenarioRuntime(state, []).attachToLocation(location, { code: '04109', scope: 'player', ownerSeat: 1 })
  scenarioRuntime(state, []).attachToLocation(location, { code: '02232', scope: 'player', ownerSeat: 0 })
  use(state, key)
  settle(state)
  use(state, technique)
  settle(state, choice => choice.options.find(option => option.cardCode === '04270')?.id ?? null)
  assert.ok(state.investigators[0].hand.includes('04270'))
  assert.equal(state.playerLocationAttachments.length, 2)
  assert.equal(state.locations.find(loc => loc.id === location).attachments.some(card => card.code === '04270'), false)
})

test('FHV 10126 resolves the original location failure before the retry’s success effect', () => {
  const state = fixture()
  const inv = state.investigators[0]
  asset(state, '10126')
  state.locations.find(loc => loc.id === inv.location).originalCode = '02056'
  state.chaosBag = ['autofail', '0']
  state.debugNextTokens = ['autofail', '0']
  const execute = draft => performTest(draft, 0, 'willpower', 1, {
    resolve: result => {
      if (result.success) assert.equal(draft.investigators[0].damage, 1)
    },
  })
  resolveTransaction(state, 0, { action: 'retryLocationFailure' }, execute)
  for (let count = 0; state.pendingChoice; count++) {
    assert.ok(count < 30)
    const choice = state.pendingChoice
    const option = choice.options.find(item => item.id === 'retry' || /宗教信物/.test(item.label))
      ?? choice.options.find(item => item.id === 'self' || item.id === 'done') ?? choice.options[0]
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: option.id }, execute)
  }
  assert.equal(state.lastTestResult.success, true)
  assert.equal(state.investigators[0].damage, 1)
})
