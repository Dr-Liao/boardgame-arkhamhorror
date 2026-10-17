import test from 'node:test'
import assert from 'node:assert/strict'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { createGameState, applyMove, validateMove, legalMoves, performTest } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { viewState, viewEvents } from '../src/integration/observation.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { cardRuleIds, ruleById, RULE_INDEX } from '../web/rulebook-data.js'
import { manifest as carcosaPack } from '../content/packs/carcosaCampaign/manifest.js'
import * as oath from '../content/campaigns/thePathToCarcosa/scenarios/theUnspeakableOath/index.js'
import * as dim from '../content/campaigns/thePathToCarcosa/scenarios/dimCarcosa/index.js'

const trialPackId = 'carcosaM4RulesPack'
const trials = {}

registerContentBundle({ packs: [{ ...carcosaPack, id: trialPackId, status: 'playable' }] })
for (const [name, entry] of [['oath', oath], ['dim', dim]]) {
  const scenarioId = `carcosaM4${name}Scenario`
  const campaignId = `carcosaM4${name}Campaign`
  const production = entry.behavior
  trials[name] = { scenarioId, campaignId }
  registerContentBundle({
    campaigns: [{
      ...contentRegistry.getCampaign('thePathToCarcosa'),
      id: campaignId,
      status: 'playable',
      scenarioIds: [scenarioId],
      unlock: { [scenarioId]: [] },
      requiredPackIds: ['core', trialPackId],
      flow: { start: scenarioId, nodes: {
        [scenarioId]: { type: 'scenario', scenarioId, next: 'end' },
        end: { type: 'end' },
      } },
    }],
    scenarios: [{
      scenario: { ...entry.scenario, id: scenarioId },
      behavior: {
        ...production,
        id: scenarioId,
        actions(state, inv) {
          return [
            ...(production.actions?.(state, inv) || []),
            { action: 'scenarioAction', rule: 'm4DrawEncounter', actions: 0, label: 'M4 抽遭遇牌' },
            { action: 'scenarioAction', rule: 'm4RandomDiscard', actions: 0, label: 'M4 随机弃牌' },
          ]
        },
        performAction(state, inv, move, api) {
          if (move.rule === 'm4DrawEncounter') return api.drawEncounter(inv.seat)
          if (move.rule === 'm4RandomDiscard') return api.discardRandom(inv.seat, 1)
          return production.performAction?.(state, inv, move, api)
        },
      },
      manifest: {
        ...entry.manifest,
        id: scenarioId,
        campaignId,
        status: 'playable',
        requiredMechanicIds: [],
        requiredEncounterGroupIds: [],
        requiredPackIds: ['core', trialPackId],
        behaviorIds: [scenarioId],
      },
    }],
  })
}

function settle(state, choose = () => null) {
  const events = []
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 200, 'choice loop')
    const pending = state.pendingChoice
    const optionId = choose(pending)
      || pending.options.find(option => ['done', 'skip'].includes(option.id))?.id
      || pending.options[0].id
    events.push(...applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }))
  }
  return events
}

function fixture(name, players = 1) {
  const state = createGameState({
    campaignId: trials[name].campaignId,
    seed: `carcosa-m4-${name}-${players}`,
    playerInvestigator: '01001',
  }, Array.from({ length: players }, (_, seat) => ({ seat })))
  settle(state)
  state.currentSeat = 0
  state.phase = 'investigation'
  state.turnSerial = 1
  for (const inv of state.investigators) {
    inv.actionsLeft = 20
    inv.hand = []
    inv.discard = []
    inv.hiddenCards = []
    inv.assets = []
    inv.threat = []
  }
  state.enemies = []
  return state
}

function drawHidden(state, code) {
  state.encounterDeck = [code]
  state.encounterDiscard = []
  const events = applyMove(state, state.currentSeat, { action: 'scenarioAction', rule: 'm4DrawEncounter' })
  events.push(...settle(state))
  return events
}

test('M4 黄色印记失败后搜索并抽取疯狂弱点，成功时不执行惩罚', () => {
  const failed = fixture('oath')
  failed.chaosBag = ['autofail']
  failed.investigators[0].deck = ['01096', '01088']
  failed.encounterDeck = ['01176']
  applyMove(failed, 0, { action: 'scenarioAction', rule: 'm4DrawEncounter' })
  assert.equal(failed.pendingChoice.kind, 'commit')
  applyMove(failed, 0, { action: 'choose', choiceId: failed.pendingChoice.id, optionId: 'done' })
  assert.equal(failed.pendingChoice.kind, 'search')
  assert.equal(failed.investigators[0].horror, 2)
  settle(failed)
  assert.ok(!failed.investigators[0].deck.includes('01096'))
  assert.ok(failed.investigators[0].discard.includes('01096'))
  assert.deepEqual(failed.investigators[0].deck, ['01088'])

  const passed = fixture('oath')
  passed.chaosBag = ['+1']
  passed.investigators[0].willpower = 5
  passed.investigators[0].deck = ['01096', '01088']
  passed.encounterDeck = ['01176']
  applyMove(passed, 0, { action: 'scenarioAction', rule: 'm4DrawEncounter' })
  settle(passed)
  assert.equal(passed.investigators[0].horror, 0)
  assert.deepEqual(passed.investigators[0].deck, ['01096', '01088'])
})

test('M4 inventories all nine original Carcosa Hidden cards with declarative engine rules', () => {
  const expected = ['03084a', '03084b', '03084c', '03084d', '03186', '03187', '03340', '03341', '03342']
  const definitions = [oath.scenario, dim.scenario].flatMap(scenario => Object.values(scenario.treacheries))
  assert.deepEqual([...new Set(definitions.filter(card => card.hidden).map(card => card.code))].sort(), expected)
  for (const code of expected) {
    assert.match(ALL_CARDS[code].text, /\bHidden\./)
    assert.ok(definitions.some(card => card.code === code && card.hiddenRule), code)
  }
})

test('M4 distinguishes printed surge from conditional surge text', () => {
  const definitions = Object.fromEntries([oath.scenario, dim.scenario]
    .flatMap(scenario => Object.values(scenario.treacheries))
    .map(card => [card.code, card]))
  for (const code of ['03085', '03339']) assert.equal(definitions[code].surge, true, code)
  for (const code of ['03097', '03100', '03102']) assert.equal(definitions[code].surge, false, code)
})

test('M4 printed surge resolves once after the treachery is discarded', () => {
  const state = fixture('oath')
  state.encounterDeck = ['03088', '03085']
  state.encounterDiscard = []
  applyMove(state, 0, { action: 'scenarioAction', rule: 'm4DrawEncounter' })
  settle(state)
  assert.ok(state.encounterDiscard.includes('03085'))
  assert.ok(state.enemies.some(enemy => enemy.code === '03088'))
  assert.equal(state.encounterDeck.length, 0)
})

test('M4 conditional surge cards draw only when their revelation condition is met', () => {
  for (const code of ['03092', '03097', '03102']) {
    const state = fixture('oath')
    state.doom = 0
    const draws = []
    oath.behavior.resolveEncounter(state, state.investigators[0], { code }, {
      drawEncounter: seat => draws.push(seat),
    })
    assert.deepEqual(draws, [0], code)
  }
})

test('M4 Hidden draw is private, counts in hand and survives JSON save/replay', () => {
  const state = fixture('oath', 2)
  const events = drawHidden(state, '03084d')
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored, state)
  assert.ok(state.investigators[0].hand.includes('03084d'))
  assert.ok(state.investigators[0].hiddenCards.includes('03084d'))
  assert.ok(viewState(state, 0).investigators[0].hand.includes('03084d'))
  assert.deepEqual(viewState(state, 1).investigators[0].hand, [])
  assert.equal(viewState(state, 1).investigators[0].handSize, 1)
  assert.ok(viewEvents(events, 0).some(event => String(event.text).includes('脑海中的低语')),
    JSON.stringify(events))
  assert.ok(viewEvents(events, 1).every(event => !JSON.stringify(event).includes('脑海中的低语')))
  assert.ok(state.log.every(line => !line.includes('脑海中的低语') && !line.includes('03084d')))
})

test('M4 Hidden cards cannot leave through ordinary discard and their own action uses the encounter discard', () => {
  const state = fixture('oath')
  drawHidden(state, '03084d')
  state.investigators[0].hand.push('01088')
  const move = legalMoves(state).find(action => action.action === 'hiddenAction' && action.cardId === '03084d')
  assert.ok(move)
  const saved = structuredClone(state)
  applyMove(state, 0, move)
  applyMove(saved, 0, move)
  assert.deepEqual(state, saved)
  assert.ok(state.encounterDiscard.includes('03084d'))
  assert.ok(!state.investigators[0].discard.includes('03084d'))
  assert.ok(!state.investigators[0].hiddenCards.includes('03084d'))
  assert.equal(state.investigators[0].actionsLeft, 18)
})

test('M4 random discard and hand-limit discard cannot select Hidden cards', () => {
  const random = fixture('oath')
  drawHidden(random, '03084d')
  random.investigators[0].hand.push('01088')
  applyMove(random, 0, { action: 'scenarioAction', rule: 'm4RandomDiscard' })
  assert.deepEqual(random.investigators[0].hand, ['03084d'])
  assert.deepEqual(random.investigators[0].discard, ['01088'])

  const limit = fixture('oath')
  drawHidden(limit, '03084d')
  limit.investigators[0].hand.push(...Array(8).fill('01088'))
  applyMove(limit, 0, { action: 'endTurn' })
  assert.equal(limit.pendingChoice?.source, 'hand-limit')
  assert.ok(limit.pendingChoice.options.every(option => !String(option.label).includes('脑海中的低语')))
  settle(limit)
  assert.ok(limit.investigators[0].hand.includes('03084d'))
  assert.equal(limit.investigators[0].hand.length, 8)
})

test('M4 Delusions enforce event, skill, free-trigger and once-per-turn movement restrictions', () => {
  const doubt = fixture('oath')
  drawHidden(doubt, '03084d')
  doubt.investigators[0].hand.push('01088')
  assert.ok(validateMove(doubt, 0, { action: 'play', cardId: '01088' }))

  const dismay = fixture('oath')
  drawHidden(dismay, '03084a')
  dismay.investigators[0].hand.push('01090')
  const execute = current => performTest(current, 0, 'intellect', 1, { resolve: result => { current.m4Result = result } })
  resolveTransaction(dismay, 0, { action: 'm4DismayTest' }, execute)
  assert.ok(dismay.pendingChoice)
  assert.ok(dismay.pendingChoice.options.every(option => option.cardCode !== '01090'
    && !String(option.label).includes(ALL_CARDS['01090'].nameZh)))

  const anxiety = fixture('oath')
  drawHidden(anxiety, '03084c')
  anxiety.investigators[0].assets = [{ id: 'flashlight', code: '01087', exhausted: false, uses: 3, usesType: 'supplies' }]
  assert.ok(legalMoves(anxiety).every(action => !(action.action === 'ability' && action.actions === 0)))

  const dread = fixture('oath')
  drawHidden(dread, '03084b')
  const first = legalMoves(dread).find(action => action.action === 'move')
  assert.ok(first)
  applyMove(dread, 0, first)
  assert.ok(legalMoves(dread).every(action => action.action !== 'move'))
})

test('M4 Gift of Madness restrictions and discard action execute from the private hand', () => {
  const state = fixture('oath')
  drawHidden(state, '03186')
  state.enemies.push({
    id: 'lunatic', code: '03184', name: '疯子', location: state.investigators[0].location,
    traits: ['Lunatic'], health: 3, damageTaken: 0, fight: 2, evade: 2, exhausted: true,
  })
  assert.ok(legalMoves(state).every(action => !(action.action === 'fight' && action.enemyId === 'lunatic')))
  state.scenarioZones.monsters = ['03184']
  const action = legalMoves(state).find(move => move.rule === 'discardGift' && move.hidden === '03186')
  assert.ok(action)
  applyMove(state, 0, action)
  assert.ok(state.encounterDiscard.includes('03186'))
  assert.ok(!state.investigators[0].discard.includes('03186'))
})

test('M4 Possession exception auto-fails tests; payment, harm and death clauses execute', () => {
  const traitorous = fixture('dim')
  drawHidden(traitorous, '03340')
  const execute = current => performTest(current, 0, 'intellect', 0, { resolve: result => { current.m4Result = result } })
  resolveTransaction(traitorous, 0, { action: 'm4PossessionTest' }, execute)
  while (traitorous.pendingChoice) {
    const pending = traitorous.pendingChoice
    const hidden = pending.options.find(option => String(option.label).includes('恶灵附身'))
    const optionId = hidden?.id || pending.options.find(option => ['done', 'skip'].includes(option.id))?.id
      || pending.options[0].id
    resolveTransaction(traitorous, pending.seat,
      { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
  assert.equal(traitorous.m4Result.autoFail, true)
  assert.equal(traitorous.m4Result.success, false)
  assert.ok(traitorous.encounterDiscard.includes('03340'))

  const torturous = fixture('dim')
  drawHidden(torturous, '03341')
  torturous.investigators[0].resources = 5
  const pay = legalMoves(torturous).find(move => move.action === 'hiddenAction' && move.cardId === '03341')
  assert.ok(pay)
  applyMove(torturous, 0, pay)
  assert.equal(torturous.investigators[0].resources, 0)
  assert.ok(torturous.encounterDiscard.includes('03341'))

  const murderous = fixture('dim', 2)
  murderous.investigators[1].location = murderous.investigators[0].location
  drawHidden(murderous, '03342')
  const harm = legalMoves(murderous).find(move => move.action === 'hiddenAction'
    && move.cardId === '03342' && move.targetSeat === 1)
  assert.ok(harm)
  applyMove(murderous, 0, harm)
  assert.equal(murderous.investigators[1].damage, 2)
  assert.ok(murderous.encounterDiscard.includes('03342'))

  const doomed = fixture('dim')
  drawHidden(doomed, '03341')
  doomed.investigators[0].horror = doomed.investigators[0].maxSanity * 2 + 1
  doomed.investigators[0].deck = ['01088']
  applyMove(doomed, 0, { action: 'draw' })
  assert.equal(doomed.investigators[0].defeatCause, 'killed')
  assert.equal(doomed.campaign.investigators[0].status, 'killed')
})

test('C5 Dazed stacks per copy only on the first matching action and survives save/replay', () => {
  const state = fixture('dim')
  state.encounterDeck = ['03226']
  applyMove(state, 0, { action: 'scenarioAction', rule: 'm4DrawEncounter' })
  settle(state)
  state.encounterDeck = ['03226']
  applyMove(state, 0, { action: 'scenarioAction', rule: 'm4DrawEncounter' })
  settle(state)
  assert.equal(state.investigators[0].threat.filter(card => card.code === '03226').length, 2)

  const first = legalMoves(state).find(move => move.action === 'move')
    || legalMoves(state).find(move => move.action === 'fight' || move.action === 'evade')
  assert.ok(first)
  const restored = structuredClone(state)
  const before = state.investigators[0].actionsLeft
  applyMove(state, 0, first)
  applyMove(restored, 0, first)
  assert.deepEqual(restored, state)
  assert.equal(state.investigators[0].actionsLeft, before - 3)
})

test('C5 Visions in Your Mind attacks from discard without spawning or engaging the enemy', () => {
  const state = fixture('dim')
  const inv = state.investigators[0]
  state.chaosBag = ['autofail']
  state.encounterDeck = ['03222', '03224']
  applyMove(state, 0, { action: 'scenarioAction', rule: 'm4DrawEncounter' })
  settle(state)
  assert.ok(state.encounterDiscard.includes('03222'))
  assert.ok(state.enemies.every(enemy => enemy.code !== '03222'))
  assert.ok(inv.engaged.every(id => !String(id).includes('03222')))
})

test('C5 Dance of the Yellow King carries mythos action loss into investigation', () => {
  const state = fixture('dim')
  state.investigators[0].actionsLeft = 0
  state.investigators[0].hand = []
  state.investigators[0].deck = ['01088', '01088']
  state.chaosBag = ['autofail']
  state.encounterDeck = ['03302']
  applyMove(state, 0, { action: 'endTurn' })
  settle(state)
  assert.equal(state.phase, 'investigation')
  assert.equal(state.investigators[0].actionsLeft, 3 - state.investigators[0].damage)
  assert.ok(state.investigators[0].damage >= 1)
})

test('M4 Carcosa rules are indexed and linked from keyword, scenario and finale cards', () => {
  const required = [
    'hidden', 'carcosaCampaign', 'carcosaDoubtConviction', 'carcosaGuests',
    'carcosaAsylum', 'carcosaCatacombs', 'carcosaChaos', 'carcosaFinale',
  ]
  for (const id of required) {
    assert.equal(ruleById(id).id, id)
    assert.ok(ruleById(id).body.length > 0)
    assert.ok(RULE_INDEX.some(rule => rule.id === id && rule.sortKey && rule.initial))
  }
  assert.ok(cardRuleIds(ALL_CARDS['03084a']).includes('hidden'))
  assert.ok(cardRuleIds(ALL_CARDS['03079']).includes('carcosaGuests'))
  assert.ok(cardRuleIds(ALL_CARDS['03186']).includes('carcosaAsylum'))
  assert.ok(cardRuleIds(ALL_CARDS['03250']).includes('carcosaCatacombs'))
  assert.ok(cardRuleIds(ALL_CARDS['03340']).includes('carcosaFinale'))
  assert.ok(cardRuleIds(ALL_CARDS['03316']).includes('carcosaChaos'))
})
