import { emitCardAudio } from './presentation-events.js'

const frames = new WeakMap()
let readPublicAttachments = () => ({ locations: {}, assets: {} })

export function setCardOutcomeAttachmentReader(read) {
  readPublicAttachments = read
}

function cardCounts(cards) {
  const counts = new Map()
  for (const code of cards || []) counts.set(code, (counts.get(code) || 0) + 1)
  return counts
}

function outcomeSnapshot(state) {
  const attachments = readPublicAttachments(state)
  const placed = new Map()
  const record = (host, cards) => {
    for (const card of cards || []) {
      if (!card?.code || card.facedown || card.faceDown || card.hidden) continue
      const key = JSON.stringify([host, card.id || card.code])
      placed.set(key, (placed.get(key) || 0) + 1)
    }
  }
  const investigators = (state.investigators || []).map(inv => {
    record(`threat:${inv.seat}`, inv.threat)
    return {
      seat: inv.seat, location: inv.location, resources: inv.resources || 0, clues: inv.clues || 0,
      actions: inv.actionsLeft || 0, scheduled: inv.pendingActionLoss?.[state.round] || 0,
      hand: cardCounts(inv.hand), discard: cardCounts(inv.discard),
    }
  })
  for (const [id, cards] of Object.entries(attachments.locations)) record(`location:${id}`, cards)
  for (const [id, cards] of Object.entries(attachments.assets)) record(id, cards)
  for (const row of [state.enemies, state.locations, state.storyAssets, state.acts, state.agendas,
    ...(state.investigators || []).flatMap(inv => [inv.assets, inv.threat])]) {
    for (const card of row || []) record(card.id || card.code, card.attachments)
  }
  record('act', attachments.act)
  record('agenda', attachments.agenda)
  return {
    scenario: state.scenario, phase: state.phase, round: state.round,
    investigators, placed, enemies: new Map((state.enemies || []).map(enemy => [enemy.id, enemy.location])),
  }
}

export function flushCardOutcomeAudio(state) {
  const frame = frames.get(state)
  if (!frame?.before) return
  const before = frame.before
  const after = frame.before = outcomeSnapshot(state)
  if (before.scenario !== after.scenario || before.phase !== after.phase || before.round !== after.round) return
  const effects = []
  for (const [index, inv] of after.investigators.entries()) {
    const old = before.investigators[index]
    if (old?.seat !== inv.seat) continue
    const add = (sound, amount = 1) => { if (amount > 0) effects.push({ sound, seat: inv.seat, amount }) }
    add('loseResource', old.resources - inv.resources)
    add('loseClue', old.clues - inv.clues)
    add('loseAction', Math.max(0, old.actions - inv.actions) + Math.max(0, inv.scheduled - old.scheduled))
    let discarded = 0
    for (const [code, count] of old.hand) {
      const removed = count - (inv.hand.get(code) || 0)
      const discardedCount = (inv.discard.get(code) || 0) - (old.discard.get(code) || 0)
      discarded += Math.max(0, Math.min(removed, discardedCount))
    }
    add('loseCard', discarded)
    if (old.location != null && inv.location != null && old.location !== inv.location) add('move')
  }
  if ([...after.placed].some(([key, count]) => count > (before.placed.get(key) || 0))) effects.push({ sound: 'attach' })
  if ([...after.enemies.keys()].some(id => !before.enemies.has(id))) effects.push({ sound: 'spawn' })
  if ([...after.enemies].some(([id, location]) => before.enemies.has(id) && before.enemies.get(id) !== location)
      && !effects.some(effect => effect.sound === 'move')) effects.push({ sound: 'move' })
  if (effects.length) emitCardAudio(state, frame.events, { kind: 'cardOutcome', effects })
}

export function withCardOutcomeAudio(state, events, audible, resolve) {
  const parent = frames.get(state)
  flushCardOutcomeAudio(state)
  frames.set(state, { events, before: audible ? outcomeSnapshot(state) : null })
  try {
    return resolve()
  } finally {
    flushCardOutcomeAudio(state)
    if (parent) {
      if (parent.before) parent.before = outcomeSnapshot(state)
      frames.set(state, parent)
    } else frames.delete(state)
  }
}

export function cardOutcomeAudioScoped(state) {
  return frames.has(state)
}

export function noteCardOutcomeSound(state, sound, details = {}, encounterEvents = null) {
  const frame = frames.get(state)
  if (frame ? !frame.before : encounterEvents == null) return
  flushCardOutcomeAudio(state)
  emitCardAudio(state, frame?.events ?? encounterEvents, { kind: 'cardOutcome', effects: [{ sound, ...details }] })
}
