import test from 'node:test'
import assert from 'node:assert/strict'
import * as echoes from '../content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/index.js'
import * as oath from '../content/campaigns/thePathToCarcosa/scenarios/theUnspeakableOath/index.js'

const clone = value => structuredClone(value)
const setupApi = {
  randomValue: () => 0,
  shuffle: values => [...values],
}

function fixture(entry, records = {}) {
  return {
    scenario: clone(entry.scenario),
    acts: clone(entry.scenario.acts),
    agendas: clone(entry.scenario.agendas),
    actIndex: 0,
    agendaIndex: 0,
    difficulty: 'standard',
    numInvestigators: 2,
    currentSeat: 0,
    round: 1,
    phase: 'investigation',
    doom: 0,
    chaosBag: ['0', 'cultist', 'tablet', 'elderthing'],
    campaign: {
      leadSeat: 0,
      records: clone(records),
      chaosBag: ['0', 'cultist', 'tablet', 'elderthing'],
      investigators: {
        0: { seat: 0, name: '一号', status: 'active', deck: [] },
        1: { seat: 1, name: '二号', status: 'active', deck: [] },
      },
      trauma: [{ physical: 0, mental: 0 }, { physical: 0, mental: 0 }],
    },
    investigators: [
      { seat: 0, name: '一号', location: entry.scenario.startLocation, actionsLeft: 3, deck: [], hand: [], assets: [], clues: 0, resources: 5, horror: 0, damage: 0, maxHealth: 7, maxSanity: 7 },
      { seat: 1, name: '二号', location: entry.scenario.startLocation, actionsLeft: 3, deck: [], hand: [], assets: [], clues: 0, resources: 5, horror: 0, damage: 0, maxHealth: 7, maxSanity: 7 },
    ],
    locations: [],
    enemies: [],
    encounterDeck: clone(entry.scenario.encounterDeck),
    encounterDiscard: [],
    victoryDisplay: [],
    scenarioFlags: {},
    scenarioZones: {},
  }
}

test('M3 middle-A manifests are verified while the campaign gate remains external', () => {
  assert.equal(echoes.manifest.status, 'verified')
  assert.equal(oath.manifest.status, 'verified')
  assert.deepEqual(echoes.scenario.acts.map(card => card.originalCode), ['03124', '03125', '03126'])
  assert.deepEqual(echoes.scenario.agendas.map(card => card.doomThresholdPerInvestigator), [2, 2, 3])
  assert.deepEqual(oath.scenario.agendas.map(card => card.originalCode), ['03160', '03161', '03162'])
  assert.equal(Object.keys(echoes.scenario.locations).length, 13)
  assert.equal(Object.keys(oath.scenario.locations).length, 14)
})

test('Echoes setup transactionally removes one location per floor and applies Sebastien information', () => {
  const state = fixture(echoes, { vipsInterviewed: ['03079'], youFledTheDinnerParty: true })
  const placed = echoes.behavior.setupLocations(state, [], setupApi)
  assert.equal(placed.length, 9)
  assert.equal(state.scenarioZones.removed.length, 3)
  assert.equal(state.scenario.locations.entryHall.cluesFixed, 2)
  assert.ok(state.investigators.every(inv => inv.actionsLeft === 4))
})

test('Echoes uses printed doom chaos values and persists doubt/VIP/symbol results', () => {
  const state = fixture(echoes, { vipsSlain: [] })
  state.enemies = [{ id: 'a', doom: 1 }, { id: 'b', doom: 3 }]
  assert.equal(echoes.behavior.resolveChaosToken(state, state.investigators[0], 'skull', {}).delta, -3)
  state.difficulty = 'hard'
  assert.equal(echoes.behavior.resolveChaosToken(state, state.investigators[0], 'skull', {}).delta, -4)
  state.victoryDisplay = [{ originalCode: '03068b' }]
  echoes.behavior.resolution(state, 'r2')
  assert.equal(state.campaign.records.youLeftTheOnyxClaspBehind, true)
  assert.equal(state.campaign.records.doubt, 1)
  assert.deepEqual(state.campaign.records.vipsSlain, ['03068'])
  assert.equal(state.chaosBag.filter(token => token === 'tablet').length, 2)
})

test('Echoes R1 transactionally assigns the Black Onyx Clasp and marks conviction', () => {
  const state = fixture(echoes)
  echoes.behavior.resolution(state, 'r1', [], { choose: () => '1' })
  assert.equal(state.campaign.records.youTookTheOnyxClasp, true)
  assert.equal(state.campaign.records.conviction, 1)
  assert.ok(state.campaign.investigators[1].deck.includes('03142'))
  assert.equal(state.chaosBag.filter(token => token === 'cultist').length, 2)
})

test('Echoes meeting room exhausts an Ally and discovers one clue once per investigator each round', () => {
  const state = fixture(echoes)
  state.locations = [{ ...clone(echoes.scenario.locations.meetingRoom), revealed: true, clues: 2 }]
  const inv = state.investigators[0]
  inv.location = 'meetingRoom'
  inv.assets = [{ id: 'ally-1', code: '01018', exhausted: false }]
  const move = echoes.behavior.actions(state, inv).find(action => action.rule === 'meetingRoomAlly')
  assert.ok(move)
  echoes.behavior.performAction(state, inv, move, {
    gainClues(seat, amount) { state.investigators[seat].clues += amount },
  })
  assert.equal(inv.assets[0].exhausted, true)
  assert.equal(inv.clues, 1)
  assert.equal(state.locations[0].clues, 1)
  assert.ok(!echoes.behavior.actions(state, inv).some(action => action.rule === 'meetingRoomAlly'))
})

test('Unspeakable Oath conserves both side decks and selects the original act II', () => {
  const state = fixture(oath, { youTookTheOnyxClasp: false })
  const placed = oath.behavior.setupLocations(state, [], setupApi)
  assert.equal(placed.length, 8)
  assert.equal(state.scenarioZones.removed.length, 2)
  assert.equal(state.scenarioZones.monsters.length, 7)
  assert.equal(state.scenarioZones.lunatics.length, 7)
  assert.equal(state.acts[1].originalCode, '03165')
})

test('Unspeakable Oath Courage keeps its own identity while restoring the underlying card', () => {
  const state = fixture(oath, { vipsInterviewed: ['03076a'] })
  const inv = state.investigators[0]
  inv.deck = ['01024']
  oath.behavior.afterMulligan(state)
  const courage = inv.assets[0]
  assert.equal(courage.code, 'xcourage')
  assert.equal(courage.underlyingCode, '01024')
  assert.ok(!Object.hasOwn(courage, 'originalCode'))
  oath.behavior.assetLeftPlay(state, inv, courage)
  assert.equal(courage.code, '01024')
  assert.ok(!Object.hasOwn(courage, 'underlyingCode'))
})

test('Unspeakable Oath writes Daniel state, escape facts, trauma, VIP and symbols', () => {
  const state = fixture(oath, { vipsSlain: [] })
  state.investigators[0].resigned = true
  state.investigators[0].assets.push({ code: '03182a' })
  state.victoryDisplay = [{ originalCode: '03065b' }]
  const traumas = []
  oath.behavior.resolution(state, 'r2', [], {
    addTrauma(_state, seat, kind, amount) { traumas.push({ seat, kind, amount }) },
  })
  assert.equal(state.campaign.records.danielStatus, 'survived')
  assert.equal(state.campaign.records.theInvestigatorsWereAttackedAsTheyEscapedTheAsylum, true)
  assert.deepEqual(state.campaign.records.vipsSlain, ['03065'])
  assert.equal(state.chaosBag.filter(token => token === 'tablet').length, 2)
  assert.deepEqual(traumas, [
    { seat: 0, kind: 'physical', amount: 1 },
    { seat: 1, kind: 'physical', amount: 1 },
  ])
})

test('Unspeakable Oath preserves all three Daniel states for conditional Interlude II', () => {
  const possessed = fixture(oath)
  possessed.victoryDisplay = [{ originalCode: '03182b' }]
  oath.behavior.resolution(possessed, 'r3', [], {})
  assert.equal(possessed.campaign.records.danielStatus, 'possessed')

  const missing = fixture(oath)
  oath.behavior.resolution(missing, 'r3', [], {})
  assert.equal(missing.campaign.records.danielStatus, 'didNotSurvive')
})
