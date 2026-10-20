import { agendaDoom, totalDoom } from '../engine/rules-state.js'
import { ALL_CARDS } from '../cards/cards-data.js'
import { campaignView } from '../campaign/campaign.js'
import { actingSeats, decisionSeat, enemyEvadeValue, enemyFightValue, enemyHealth, getMaxHealth, getMaxSanity, getStat, handSize, legalMoves, scriptActionHints } from '../engine/engine.js'
import { contentRegistry } from '../../content/registered.js'
import { projectTableState, locationEntryErrors, maskHiddenLocations, publicAttachments, attachLocationCards, publicCardInstance } from './presentation-state.js'
import { campaignStory } from '../campaign/story.js'
import { choiceOptionsFor, choiceSeats } from '../engine/resolution.js'

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

// 剧本标记里可以公开给所有座位的键（深度、石柱、漆黑）。其余标记属于剧本内部状态，
// 直接全量下发会泄露尚未揭示的内容。
const PUBLIC_SCENARIO_FLAGS = Object.freeze(['depthLevel', 'pillars', 'deepDark'])

const PUBLIC_INVESTIGATOR_FIELDS = [
  'seat', 'code', 'name', 'nameEn', 'klass', 'willpower', 'intellect', 'combat', 'agility',
  'baseHealth', 'baseSanity', 'health', 'sanity', 'maxHealth', 'maxSanity',
  'damage', 'horror', 'resources', 'clues', 'actionsLeft', 'exploreOnlyActions', 'discard', 'assets', 'threat',
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

// 时间线汇总：[[古代]] / [[现代]] 地点各有几张在场。只读已经公开的地点数据。
function timelineSummary(state) {
  let ancient = 0
  let modern = 0
  for (const location of state.locations || []) {
    const def = ALL_CARDS[location.originalCode || location.code]
    const traits = (def?.traits || location.traits || []).map(trait => String(trait).toLowerCase())
    if (traits.includes('ancient')) ancient += 1
    else if (traits.some(trait => trait === 'present-day' || trait === 'present day' || trait === 'presentday')) modern += 1
  }
  return { ancient, modern }
}

export function viewState(state, observerSeat = null) {
  const observer = Number.isInteger(observerSeat) && state.investigators.some(inv => inv.seat === observerSeat)
    ? observerSeat : null
  const view = pick(state, PUBLIC_STATE_FIELDS)
  const attachments = publicAttachments(state)
  view.locations = maskHiddenLocations(attachLocationCards(view.locations || [], attachments.locations))
  // 投影有效帷幕：印刷值 + shroudMod + 迷雾 + 剧本常驻修正（04294 的「X=深度」等），
  // 否则前端会一直显示印刷的 0/负数。
  const observerInv = (state.investigators || []).find(inv => inv.seat === observerSeat)
  const shroudBehavior = state.scenario ? contentRegistry.getBehavior(state.scenario.id) : null
  view.locations = view.locations.map(location => {
    const source = (state.locations || []).find(entry => entry.id === location.id)
    if (!source) return location
    const scenarioShroud = shroudBehavior?.locationShroudModifier?.(state, source, observerInv) || 0
    return {
      ...location,
      shroud: (source.shroud || 0) + (source.shroudMod || 0) + (state.fogMod || 0) + scenarioShroud,
    }
  })
  view.scriptAttachments = { act: attachments.act, agenda: attachments.agenda }
  view.enemies = view.enemies.map((enemy, index) => ({
    ...enemy,
    health: enemyHealth(state, state.enemies[index]),
    effectiveFight: enemyFightValue(state, state.enemies[index]),
    effectiveEvade: enemyEvadeValue(state, state.enemies[index]),
  }))
  view.locationEntryErrors = locationEntryErrors(state)
  view.campaign = campaignView(state.campaign, observer)
  // 补给品是公开信息（「检查你们的补给品」由全队共同核对），标签随观察投影下发，
  // 前端因此不需要另存一份中文名。选购界面还需要单价、卡面说明与两个时点的完整清单。
  const campaignManifest = contentRegistry.getCampaign(state.campaign.id)
  view.campaign.supplyLabels = { ...(campaignManifest?.supplyLabels || {}) }
  if (campaignManifest?.supplyCosts) view.campaign.supplyCosts = { ...campaignManifest.supplyCosts }
  if (campaignManifest?.supplyHints) view.campaign.supplyHints = { ...campaignManifest.supplyHints }
  if (campaignManifest?.supplyLists) view.campaign.supplyLists = structuredClone(campaignManifest.supplyLists)
  view.campaignStory = campaignStory(state, contentRegistry, observer)
  view.agendaDoom = agendaDoom(state)
  view.totalDoom = totalDoom(state)
  // 失落的时代：只投影公开的剧本状态。探索牌库是背面朝下的随机牌堆，只公开张数；
  // 弃牌堆、古代遗物位置、领队座位、复仇合计与伊格之怒都是公开信息。
  view.exploration = {
    deck: Array.isArray(state.explorationDeck) ? state.explorationDeck.length : 0,
    discard: [...(state.explorationDiscard || [])],
  }
  view.relicOfAges = state.relicOfAges
    ? { code: state.relicOfAges.code, location: state.relicOfAges.location ?? null, seat: state.relicOfAges.seat ?? null }
    : null
  // 命运之线：亚历山卓的位置、伊塔卡的猎物与目的地都是公开信息（卡在桌上/记录里）。
  if (state.scenario?.id === 'threadsOfFate') {
    const flags = state.scenarioFlags || {}
    const alejandro = flags.alejandro || null
    view.threadsOfFate = {
      alejandro: alejandro
        ? { code: alejandro.code || '04051', location: alejandro.location ?? null, enemyId: alejandro.enemyId ?? null }
        : null,
      prey: [...(flags.ichtacasPrey || [])],
      destinations: [...(flags.ichtacasDestinations || [])],
    }
  }
  // 幽嘶深渊：深度、追击区、瓦卢西亚之子与密谋旁附属都是桌上公开信息。
  if (state.scenario?.id === 'theDepthsOfYoth') {
    const flags = state.scenarioFlags || {}
    const zones = state.scenarioZones || {}
    const agenda = state.agendas?.[state.agendaIndex]
    view.depths = {
      depthLevel: Number(flags.depthLevel || 1),
      pursuit: [...(zones.pursuit || [])],
      childrenOfValusia: [...(zones.childrenOfValusia || [])],
      agendaAttachments: (agenda?.attachments || []).map(entry => entry.code || entry.originalCode),
    }
  }
  view.expeditionLeaderSeat = Number.isInteger(state.expeditionLeaderSeat)
    ? state.expeditionLeaderSeat
    : (Number.isInteger(state.campaign?.expeditionLeader) ? state.campaign.expeditionLeader : null)
  view.vengeance = (state.victoryDisplay || []).reduce((sum, card) => sum + (card.vengeance || 0), 0)
  view.yigsFury = Number(state.campaign?.records?.yigsFury || 0)
  view.scenarioFlagsPublic = Object.fromEntries(PUBLIC_SCENARIO_FLAGS
    .filter(key => state.scenarioFlags?.[key] != null)
    .map(key => [key, state.scenarioFlags[key]]))
  // 时间线（年代）：场上地点里有多少张是[[古代]]面、多少张是[[现代]]面。
  // 这两类特性都印在卡面上、地点也在桌面上，汇总不会泄露未揭示信息。
  view.timeline = timelineSummary(state)
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
    maxHealth: getMaxHealth(inv),
    effectiveStats: Object.fromEntries(['willpower', 'intellect', 'combat', 'agility'].map(skill => [skill, getStat(state, inv, skill)])),
    hand: inv.seat === observer ? [...inv.hand] : [],
    handSize: inv.hand.length,
    handLimit: handSize(state, inv),
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
  const responder = choiceSeats(choice).includes(observer)
  view.pendingChoice = choice && (!privateTest || responder) ? {
    ...pick(choice, ['id', 'kind', 'seat', 'seats', 'prompt', 'canSkip', 'min', 'max', 'payment']),
    source: typeof choice.source === 'string' ? choice.source : pick(choice.source || {}, [
      'id', 'code', 'label', 'name', 'type',
      // 补给选购要区分序幕与补给点：两处的清单和点数不同，前端据此列出完整卡面。
      ...(choice.kind === 'pickSupplies' ? ['context'] : []),
    ]),
    options: responder ? choiceOptionsFor(choice, observer).map(option => pick(option, ['id', 'label'])) : [],
  } : null
  // state.legalMoves is cached for the primary seat; simultaneous seats compute their own list.
  view.legalMoves = observer == null || !actingSeats(state).includes(observer) ? []
    : observer === decisionSeat(state) ? structuredClone(state.legalMoves || []) : legalMoves(state, observer)
  // 牌桌只显示场景/密谋区行动；敌人与地点绑定的条件行动只用于 AI 计划（describeState）。
  view.scriptActions = observer == null ? [] : scriptActionHints(state, observer)
    .filter(hint => ['act', 'agenda'].includes(hint.scriptCard))
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
