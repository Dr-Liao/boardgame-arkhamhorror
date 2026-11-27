import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { ALL_CARDS, ENCOUNTER_CARDS, WEAKNESSES, BASIC_WEAKNESSES } from '../src/cards/cards-data.js'
import { drawCards, drawEncounter, scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { cardRevealAudio } from '../src/engine/card-reveal-audio.js'
import { viewEvents } from '../src/integration/observation.js'
import { CARD_AUDIO_FILES, revealSound } from '../web/card-audio.js'
import { publicSequence } from '../web/table-presentation.js'
import { asset, fixture } from './core-fixture.mjs'

const audioEffects = events => events.flatMap(event => event.kind === 'cardOutcome' ? event.effects.map(effect => effect.sound) : [])
const reveals = events => events.filter(e => e.kind === 'weakness' || e.effect === 'encounter' || e.presentation?.effect === 'encounter')
  .map(e => e.presentation || e)

function transact(state, execute) {
  const begin = resolveTransaction(state, 0, { action: 'testAudio' }, execute)
  const follow = []
  for (let limit = 0; state.pendingChoice; limit++) {
    assert.ok(limit < 45, 'rule choice loop')
    const { id, seat, options } = state.pendingChoice
    const option = options.find(item => ['skip', 'done', 'self'].includes(item.id)) || options[0]
    follow.push(...resolveTransaction(state, seat, { action: 'choose', choiceId: id, optionId: option.id }, execute))
  }
  return { begin, follow, events: [...begin, ...follow] }
}

test('Every printed encounter treachery and all five weakness types resolve to an installed audio family', () => {
  const used = new Set()
  for (const card of Object.values(ENCOUNTER_CARDS)) {
    const kind = cardRevealAudio(card)
    assert.ok(CARD_AUDIO_FILES[kind], card.code)
    used.add(kind)
  }
  assert.equal([...used].filter(kind => kind.startsWith('treachery-')).length, 9)
  for (const code of ['10520', '11636', '12157', '03185', '01136', '54066', '10722', '84026']) {
    assert.notEqual(revealSound({ code, revealAudio: cardRevealAudio(ALL_CARDS[code]) }), 'encounter')
  }
  assert.equal(cardRevealAudio(ALL_CARDS['12157']), 'treachery-magic')
  assert.equal(cardRevealAudio(ALL_CARDS['11636']), 'treachery-omen')
  assert.equal(cardRevealAudio(ALL_CARDS['01136']), 'treachery-scheme')
  assert.equal(cardRevealAudio(ALL_CARDS['10547']), 'encounter-enemy_location')
  for (const card of [...Object.values(WEAKNESSES), ...Object.values(BASIC_WEAKNESSES)]) {
    const kind = cardRevealAudio(card, { weakness: true })
    if (card.code === '01000') { assert.equal(kind, undefined); continue }
    assert.ok(CARD_AUDIO_FILES[revealSound({ code: card.code, revealAudio: kind }, true)], card.code)
  }
  assert.equal(revealSound({ code: '10520', revealAudio: 'treachery-hazard', eventSeq: 1 }), 'treachery-hazard-alt')
  assert.equal(revealSound({ code: '10520' }), 'encounter')
  assert.equal(revealSound({ revealAudio: 'treachery-hazard' }), 'private-reveal')
})

test('All shipped cues contain distinct valid PCM with a short duration and headroom', () => {
  const files = Object.values(CARD_AUDIO_FILES)
  assert.equal(new Set(files).size, files.length)
  for (const file of files) {
    const wav = readFileSync(new URL(`../web/audio/${file}`, import.meta.url))
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF', file)
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE', file)
    assert.equal(wav.readUInt16LE(20), 1, file)
    assert.equal(wav.readUInt16LE(22), 1, file)
    assert.equal(wav.readUInt32LE(40), wav.length - 44, file)
    const duration = (wav.length - 44) / wav.readUInt32LE(28)
    assert.ok(duration >= .19 && duration <= .71, file)
    let peak = 0
    for (let offset = 44; offset < wav.length; offset += 2) peak = Math.max(peak, Math.abs(wav.readInt16LE(offset)))
    assert.ok(peak > 1000 && peak < 25000, file)
  }
})

test('Private encounter identity stays in the owner feed, with one neutral flip per seat', () => {
  const state = fixture('01001', 2)
  const { events } = transact(state, (draft, seat, move, cue) =>
    drawEncounter(draft, draft.investigators[seat], cue, { code: '03340' }))
  const withSeq = events.map((event, seq) => ({ ...event, seq }))
  for (const seat of [0, 1]) {
    const visible = viewEvents(withSeq, seat)
    const draws = reveals(visible)
    assert.equal(draws.length, 1)
    assert.equal(draws[0].code, undefined)
    assert.equal(draws[0].revealAudio, undefined)
    assert.equal(revealSound(draws[0]), 'private-reveal')
    assert.equal(visible.some(e => e.presentation?.effect === 'privateEncounter' && e.presentation.code === '03340'), seat === 0)
    if (seat === 1) assert.ok(!JSON.stringify(visible).includes('03340'))
  }
})

test('An enemy weakness that enters the hand secretly also keeps its flip neutral', () => {
  const state = fixture('01001', 2)
  state.investigators[0].deck.push('06017')
  const { events } = transact(state, (draft, seat, move, cue) =>
    drawCards(draft, draft.investigators[seat], 1, cue))
  assert.ok(state.investigators[0].hand.includes('06017'))
  for (const seat of [0, 1]) {
    const draws = reveals(viewEvents(events, seat))
    assert.equal(draws.length, 1)
    assert.equal(draws[0].code, undefined)
    assert.equal(draws[0].revealAudio, undefined)
    assert.equal(revealSound(draws[0], true), 'private-reveal')
  }
})

test('A real surge chain only flags follow-up cards, including when the transaction resumes choices', () => {
  const state = fixture('01001')
  state.investigators[0].clues = 0
  state.encounterDeck = ['ancientEvils', '01136', '01136']
  const { events } = transact(state, (draft, seat, move, cue) => drawEncounter(draft, draft.investigators[seat], cue))
  assert.deepEqual(reveals(events).map(e => [e.code, Boolean(e.surgeDraw)]), [['01136', false], ['01136', true], ['01166', true]])
  assert.deepEqual(audioEffects(events), ['doom'])
  assert.equal(state.doom, 1)

  state.investigators[0].clues = 2
  state.chaosBag = ['autofail']
  const cluesLost = transact(state, (draft, seat, move, cue) =>
    drawEncounter(draft, draft.investigators[seat], cue, { code: '01136' }))
  assert.equal(state.investigators[0].clues, 0)
  assert.deepEqual(reveals(cluesLost.events).map(e => [e.code, Boolean(e.surgeDraw)]), [['01136', false]])
  assert.deepEqual(audioEffects(cluesLost.events), ['loseClue'])
})

test('Weakness and encounter results follow real choices and actual deltas', () => {
  const state = fixture('01001')
  const drawWeakness = (draft, seat, move, cue) => drawCards(draft, draft.investigators[seat], 1, cue)
  state.investigators[0].deck.push('01097')
  const first = transact(state, drawWeakness)
  assert.equal(state.investigators[0].resources, 0)
  assert.deepEqual(audioEffects(first.events), ['loseResource'])
  assert.equal(revealSound(reveals(first.events)[0], true), 'weakness-treachery-fear')
  state.investigators[0].deck.push('01097')
  assert.deepEqual(audioEffects(transact(state, drawWeakness).events), [])

  const draw = (draft, seat, move, cue) => drawEncounter(draft, draft.investigators[seat], cue, { code: 'rottingRemains' })
  state.chaosBag = ['0']
  assert.ok(!audioEffects(transact(state, draw).events).includes('fright'))
  state.chaosBag = ['autofail']
  const failed = transact(state, draw)
  assert.equal(reveals(failed.events).length, 1)
  assert.equal(audioEffects(failed.events).filter(sound => sound === 'fright').length, 1)
  assert.equal(reveals(failed.follow).length, 0)
  assert.ok(state.investigators[0].horror > 0)
})

test('An actual combined harm placement uses one cue, while a canceled draw uses none', () => {
  const state = fixture('01001')
  const canceled = transact(state, (draft, seat, move, cue) =>
    drawEncounter(draft, draft.investigators[seat], cue, { code: 'ancientEvils', mayCancel: () => true }))
  assert.deepEqual(reveals(canceled.events), [])
  assert.deepEqual(audioEffects(canceled.events), [])
  assert.equal(state.doom, 0)

  state.chaosBag = ['autofail']
  const both = transact(state, (draft, seat, move, cue) =>
    drawEncounter(draft, draft.investigators[seat], cue, { code: '01173' }))
  assert.equal(state.investigators[0].damage, 1)
  assert.equal(state.investigators[0].horror, 1)
  assert.deepEqual(audioEffects(publicSequence(both.events)), ['injuryAndFear'])
})

test('Threat entry, scheduled action loss and the dedicated Tekeli-li pile have their own cues', () => {
  const state = fixture('01001')
  const threat = transact(state, (draft, seat, move, cue) =>
    drawEncounter(draft, draft.investigators[seat], cue, { code: 'dissonantVoices' }))
  assert.deepEqual(audioEffects(threat.events), ['attach'])
  state.phase = 'mythos'
  const actions = transact(state, (draft, seat, move, cue) =>
    scenarioRuntime(draft, cue).loseActions(seat, 1))
  assert.equal(state.investigators[0].pendingActionLoss[state.round], 1)
  assert.deepEqual(audioEffects(actions.events), [], 'ordinary scenario operations need no reveal-specific sound')
  const tekeli = transact(state, (draft, seat, move, cue) =>
    scenarioRuntime(draft, cue).resolveTekeliWeakness(seat, '08723', { deferReturn: true }))
  assert.equal(reveals(tekeli.events).length, 1)
  assert.equal(revealSound(reveals(tekeli.events)[0], true), 'weakness-treachery-tekeli')
})

test('Later scenario harm sounds at placement, including when an asset takes it', () => {
  const state = fixture('01001')
  const ally = asset(state, '01018')
  const { events } = transact(state, (draft, seat, move, cue) => {
    const api = scenarioRuntime(draft, cue)
    api.damage(seat, 1)
    api.horrorAsset(seat, ally.id, 1, { direct: true })
  })
  assert.equal(state.investigators[0].damage, 1)
  assert.equal(state.investigators[0].horror, 0)
  assert.deepEqual(audioEffects(events), ['injury', 'fright'])
})
