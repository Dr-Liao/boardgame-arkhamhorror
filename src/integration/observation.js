import { totalDoom, enemyHealthValue } from '../engine/rules-state.js'
import { campaignView } from '../campaign/campaign.js'
import { enemyFightValue, getMaxSanity, getStat, scriptActionHints } from '../engine/engine.js'
import { contentRegistry } from '../../content/registered.js'
import { projectTableState, locationEntryErrors, maskHiddenLocations, publicAttachments, attachLocationCards, publicCardInstance } from './presentation-state.js'
import { campaignStory } from '../campaign/story.js'

const PUBLIC_STATE_FIELDS = [
  'schemaVersion', 'rulesVersion', 'resourceVersion', 'rulesMode', 'revision',
  'status', 'winnerSeat', 'currentSeat', 'turnSeat', 'moveCount', 'round', 'phase',
  'hubFlow', 'uiState', 'hubSelectedScenarioId', 'hubReady', 'hubSeatSelected', 'hubSeatDone',
  'outcome', 'resolution', 'difficulty', 'numInvestigators', 'actIndex', 'agendaIndex',
  'doom', 'clues', 'victory', 'actClues', 'fogMod', 'locations', 'enemies',
  'encounterDiscard', 'cultistsInVictory', 'chaosBag', 'sealedTokens', 'exiled',
  'cards', 'investigatorDefs', 'classNames', 'classColors', 'skillNames',
  'acts', 'agendas', 'tokenLabels', 'storyAssets', 'victoryDisplay', 'log',
  'turnsTaken', 'timingWindow', 'humanSeats', 'aiTurnOrder', 'aiTurnOrderRound',
]

const PUBLIC_INVESTIGATOR_FIELDS = [
  'seat', 'code', 'name', 'nameEn', 'klass', 'willpower', 'intellect', 'combat', 'agility',
  'baseHealth', 'baseSanity', 'health', 'sanity', 'maxHealth', 'maxSanity',
  'damage', 'horror', 'resources', 'clues', 'actionsLeft', 'discard', 'assets', 'threat',
  'location', 'engaged', 'defeated', 'resigned', 'defeatCause', 'testBonus',
  'phaseStatBonus', 'onTheLam', 'fearExtraPaid', 'usedReactions', 'autoBuilt', 'deckName',
  'campaignId', 'tomeActionUsed',
  'role', 'lolaDiscount',
]

function pick(object, fields) {
  return Object.fromEntries(fields.filter(key => Object.hasOwn(object, key)).map(key => [key, structuredClone(object[key])]))
}

function publicSetAsideCards(state) {
  if (!state.scenario?.id) return []
  const tracked = state.scenarioZones?.setAside
  const counts = new Map()
  const add = (reference, amount = 1) => {
    const code = typeof reference === 'string' ? reference : reference?.originalCode || reference?.code
    if (code && amount > 0) counts.set(code, (counts.get(code) || 0) + amount)
  }
  if (Array.isArray(tracked)) {
    for (const reference of tracked) add(reference)
  } else {
    const manifest = contentRegistry.getScenario(state.scenario.id)
    for (const entry of manifest.zones.setAside || []) add(entry.cardCode, entry.count)
    const consume = reference => {
      const code = typeof reference === 'string' ? reference : reference?.originalCode || reference?.code
      if (code && counts.has(code)) counts.set(code, Math.max(0, counts.get(code) - 1))
    }
    const visible = [
      ...(state.locations || []), ...(state.enemies || []), ...(state.storyAssets || []),
      ...(state.victoryDisplay || []), ...(state.encounterDiscard || []),
      ...(state.cultistsInVictory || []), ...(state.scenarioZones?.removed || []),
      ...(state.investigators || []).flatMap(inv => [...(inv.assets || []), ...(inv.threat || [])]),
    ]
    for (const reference of visible) consume(reference)
  }
  return [...counts].filter(([, count]) => count > 0).map(([code, count]) => ({ code, count }))
}

export function viewState(state, observerSeat = null) {
  const observer = Number.isInteger(observerSeat) && state.investigators.some(inv => inv.seat === observerSeat)
    ? observerSeat : null
  const view = pick(state, PUBLIC_STATE_FIELDS)
  const attachments = publicAttachments(state)
  view.locations = maskHiddenLocations(attachLocationCards(view.locations || [], attachments.locations))
  view.scriptAttachments = { act: attachments.act, agenda: attachments.agenda }
  view.enemies = view.enemies.map((enemy, index) => ({
    ...enemy,
    health: enemyHealthValue(state, state.enemies[index]),
    effectiveFight: enemyFightValue(state, state.enemies[index]),
  }))
  view.locationEntryErrors = locationEntryErrors(state)
  view.campaign = campaignView(state.campaign, observer)
  view.campaignStory = campaignStory(state, contentRegistry, observer)
  view.totalDoom = totalDoom(state)
  view.chaos = state.chaos ? { revealed: [...state.chaos.revealed], sealed: structuredClone(state.chaos.sealed), removed: [...state.chaos.removed] } : null
  const privateTest = state.skillTest && !state.skillTest.helpRequested && state.skillTest.seat !== observer
  if (privateTest) { view.log = [...(state.skillTest.publicLog || [])]; view.timingWindow = null }
  view.skillTest = state.skillTest && !privateTest ? { ...structuredClone(state.skillTest) } : null
  view.scenario = state.scenario ? {
    ...pick(state.scenario, ['id', 'name', 'nameEn', 'intro', 'setup']),
    intro: view.campaignStory.entries.find(e => e.id === `current:${state.scenario.id}`)?.paragraphs.join('\n\n') || state.scenarioIntro?.paragraphs?.join('\n\n') || state.scenario.intro,
    layout: structuredClone(contentRegistry.getScenario(state.scenario.id).layout),
  } : null
  view.setAsideCards = publicSetAsideCards(state)
  view.investigators = state.investigators.map(inv => ({
    ...pick(inv, PUBLIC_INVESTIGATOR_FIELDS),
    assets: inv.assets.map(asset => asset.code === '03009' && inv.damage >= 5
      ? { ...publicCardInstance(asset), code: '03009b', linkedFromCode: '03009' }
      : publicCardInstance(asset)),
    threat: (inv.threat || []).map(publicCardInstance),
    maxSanity: getMaxSanity(inv),
    effectiveStats: Object.fromEntries(['willpower', 'intellect', 'combat', 'agility'].map(skill => [skill, getStat(state, inv, skill)])),
    hand: inv.seat === observer ? [...inv.hand] : [],
    handSize: inv.hand.length,
    beneath: inv.seat === observer ? [...(inv.beneath || [])] : [],
    beneathCount: inv.beneath?.length || 0,
    deck: [],
    deckSize: inv.deck.length,
  }))
  view.encounterDeck = []
  view.encounterDeckSize = state.encounterDeck.length
  view.cultistDeck = []
  view.cultistDeckSize = state.cultistDeck.length
  const choice = state.pendingChoice
  // A private test can still cause another investigator to take damage or
  // answer a mandatory effect. Keep that recipient's own decision visible.
  view.pendingChoice = choice && (!privateTest || choice.seat === observer) ? {
    ...pick(choice, ['id', 'kind', 'seat', 'prompt', 'canSkip', 'min', 'max', 'payment']),
    source: typeof choice.source === 'string' ? choice.source : pick(choice.source || {}, ['id', 'code', 'label', 'name', 'type']),
    options: choice.seat === observer ? choice.options.map(option => pick(option, ['id', 'label'])) : [],
  } : null
  const seat = choice?.seat ?? state.currentSeat
  view.legalMoves = seat === observer ? structuredClone(state.legalMoves || []) : []
  view.scriptActions = observer == null ? [] : scriptActionHints(state, observer)
  return view
}

export function viewEvents(events, observerSeat = null) {
  return events.filter(event => event.privateSeat == null || event.privateSeat === observerSeat).map(event => {
    const copy = structuredClone(event)
    if (copy.tableState) copy.tableState = projectTableState(copy.tableState, observerSeat)
    if (copy.presentation?.tableState) copy.presentation.tableState = projectTableState(copy.presentation.tableState, observerSeat)
    if (copy.type === 'move' && copy.seat !== observerSeat && copy.move?.action === 'choose') {
      return { ...pick(copy, ['seq', 'type', 'seat']), move: { action: 'choose' } }
    }
    return copy
  })
}
