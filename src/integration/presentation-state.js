import { contentRegistry } from '../../content/registered.js'
import { agendaDoom, totalDoom, enemyHealthValue } from '../engine/rules-state.js'

// Use the same scenario gate as movement, independently of remaining actions,
// adjacency or pending choices. Only project the resulting public restriction.
export function locationEntryErrors(state) {
  const investigator = state.investigators.find(item => item.seat === state.currentSeat)
  if (!state.scenario || !investigator) return {}
  const behavior = contentRegistry.getBehavior(state.scenario.id)
  return Object.fromEntries(state.locations.flatMap(location => {
    const error = behavior.investigatorEntryError?.(state, location, investigator)
    return error ? [[location.id, error]] : []
  }))
}

// Cards attached to the current act/agenda or to locations by scenario rules
// live in scenario-private zones; project only their public card codes.
export function publicAttachments(state) {
  const behavior = state.scenario ? contentRegistry.getBehavior(state.scenario.id) : null
  const found = behavior?.publicAttachments?.(state) || {}
  const locations = Object.fromEntries(Object.entries(found.locations || {}).map(([id, cards]) => [id, [...cards]]))
  for (const attachment of state.playerLocationAttachments || []) {
    if (!attachment?.code || !attachment.location) continue
    ;(locations[attachment.location] ||= []).push(structuredClone(attachment))
  }
  return { act: [...(found.act || [])], agenda: [...(found.agenda || [])], locations }
}
export function attachLocationCards(locations, byLocation = {}) {
  return locations.map(loc => byLocation[loc.id]?.length
    ? { ...loc, attachments: [...(loc.attachments || []), ...byLocation[loc.id]] } : loc)
}

// Display checkpoints contain no deck order, RNG, transaction or future choices.
const FIELDS = ['status','currentSeat','turnSeat','moveCount','round','phase','actIndex','agendaIndex','doom','clues','actClues','victory','locations','enemies','storyAssets','encounterDiscard','turnsTaken','log']
const INV_FIELDS = ['seat','code','name','nameEn','klass','willpower','intellect','combat','agility','health','sanity','baseHealth','baseSanity','maxHealth','damage','horror','resources','clues','actionsLeft','discard','assets','threat','location','engaged','defeated','resigned','testBonus','phaseStatBonus']
const pick = (value, keys) => Object.fromEntries(keys.filter(k => Object.hasOwn(value, k)).map(k => [k, structuredClone(value[k])]))
export function publicCardInstance(card) {
  const visible = structuredClone(card)
  if (visible.code === 'xcourage') {
    delete visible.underlyingCode
    delete visible.originalCode
  }
  return visible
}
const hiddenLocationArtCode = loc => loc.artCode
  || (['02285', '02286', '02287', '02288'].includes(loc.originalCode || loc.code) ? '02285'
    : ['02289', '02290', '02291', '02292'].includes(loc.originalCode || loc.code) ? '02289' : undefined)
export function maskHiddenLocations(locations) {
  return locations.map(loc => loc.hiddenIdentity && !loc.revealed
    ? { id: loc.id, name: '未知小径', artCode: hiddenLocationArtCode(loc), revealed: false, clues: 0,
        connections: [...loc.connections], doom: loc.doom || 0 }
    : structuredClone(loc))
}
export function captureTableState(state, getStat, getMaxSanity) {
  const attachments = publicAttachments(state)
  return {
    ...pick(state, FIELDS), locations: attachLocationCards(structuredClone(state.locations || []), attachments.locations),
    scriptAttachments: { act: attachments.act, agenda: attachments.agenda }, enemies: state.enemies.map(enemy => ({ ...structuredClone(enemy), health: enemyHealthValue(state, enemy) })), encounterDeckSize: state.encounterDeck.length,
    locationEntryErrors: locationEntryErrors(state),
    privateTest: state.skillTest && !state.skillTest.helpRequested ? { seat: state.skillTest.seat, publicLog: [...(state.skillTest.publicLog || [])] } : null,
    agendaDoom: agendaDoom(state),
    totalDoom: totalDoom(state),
    investigators: state.investigators.map(inv => ({ ...pick(inv, INV_FIELDS),
      assets: (inv.assets || []).map(publicCardInstance),
      threat: (inv.threat || []).map(publicCardInstance),
      hand: [...inv.hand], handSize: inv.hand.length, deck: [], deckSize: inv.deck.length,
      maxSanity: getMaxSanity(inv), effectiveStats: Object.fromEntries(['willpower','intellect','combat','agility'].map(s => [s, getStat(state, inv, s)])),
    })),
  }
}
export function projectTableState(snapshot, observer) {
  const copy = structuredClone(snapshot)
  copy.locations = maskHiddenLocations(copy.locations || [])
  for (const inv of copy.investigators || []) if (inv.seat !== observer) inv.hand = []
  if (copy.privateTest && copy.privateTest.seat !== observer) copy.log = copy.privateTest.publicLog
  delete copy.privateTest
  return copy
}
