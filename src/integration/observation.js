import { agendaDoom, totalDoom } from '../engine/rules-state.js'
import { registeredEntry } from '../engine/ability.js'
import { ALL_CARDS } from '../cards/cards-data.js'
import { campaignView, replacementBlockers, upgradeRecord } from '../campaign/campaign.js'
import { cardPoolContext } from '../deck/card-pool.js'
import { actingSeats, decisionSeat, embeddedCardDefs, enemyEvadeValue, enemyFightValue, enemyHealth, getMaxHealth, getMaxSanity, getStat, handSize, legalMoves, scriptActionHints, abilityUsage } from '../engine/engine.js'
import { contentRegistry } from '../../content/registered.js'
import { projectTableState, locationEntryErrors, maskHiddenLocations, publicAttachments, attachLocationCards, publicCardInstance } from './presentation-state.js'
import { campaignStory } from '../campaign/story.js'
import { choiceOptionsFor, choiceSeats } from '../engine/resolution.js'
// Phase 6（战役插件化第二批）：战役专属状态的公开投影收进内容层
// （探索牌库 / 古代遗物 / 领队 / 复仇 / 伊格之怒 / 两个剧本的公开标记）。
import { campaignProjection } from '../cards/campaign-view.js'

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
  // 开局「游戏高级设置」：卡牌范围与回档开关是公开的对局规则，前端据此收窄卡池、
  // 在关卡纪要里隐藏/说明回档入口。
  'cardPoolScope', 'allowRollback',
]

// 剧本标记里可以公开给所有座位的键（深度、石柱、漆黑）。其余标记属于剧本内部状态，
// 直接全量下发会泄露尚未揭示的内容。
const PUBLIC_SCENARIO_FLAGS = Object.freeze(['depthLevel', 'pillars', 'deepDark'])

// P1.4：两张公共静态表由大厅的会话级缓存单独下发（mod.staticTables），精简视图里不出现。
const STATIC_STATE_FIELDS = Object.freeze(['cards', 'investigatorDefs'])
const PUBLIC_STATE_FIELDS_SLIM = Object.freeze(PUBLIC_STATE_FIELDS.filter(key => !STATIC_STATE_FIELDS.includes(key)))

const PUBLIC_INVESTIGATOR_FIELDS = [
  'seat', 'code', 'name', 'nameEn', 'klass', 'willpower', 'intellect', 'combat', 'agility',
  'baseHealth', 'baseSanity', 'health', 'sanity', 'maxHealth', 'maxSanity',
  'damage', 'horror', 'resources', 'clues', 'actionsLeft', 'exploreOnlyActions', 'discard', 'assets', 'threat',
  'location', 'engaged', 'defeated', 'resigned', 'defeatCause', 'testBonus',
  'phaseStatBonus', 'onTheLam', 'fearExtraPaid', 'usedReactions', 'autoBuilt', 'deckName',
  'campaignId', 'tomeActionUsed',
  'role', 'lolaDiscount',
]

// A1′（P3.2）：大厅声明 stateIsolated=true 时，传给 viewState 的 state 是「每 revision 只
// structuredClone 一次、多个席位共用」的隔离副本。这份副本不会被权威状态改动，Mod 也承诺不写它，
// 因此视图字段只需浅拷贝（数组/对象各复制一层），无需逐字段深拷大字段。
function copyViewValue(value) {
  if (Array.isArray(value)) return value.slice()
  if (value && typeof value === 'object') return { ...value }
  return value
}

function pick(object, fields, copy = structuredClone) {
  return Object.fromEntries(fields.filter(key => Object.hasOwn(object, key)).map(key => [key, copy(object[key])]))
}

// 战役记录里的数组/字符串可能是卡号（被献祭的角色、遇害的贵宾……）。规则继续用卡号判断，
// 但界面必须显示卡名。这里只收集当前记录与每关结算快照里出现过的卡号，投影成一张很小的
// 公开映射表（`campaign.recordCardNames`），避免前端各自维护一份卡号→卡名。
function recordCardNames(campaign) {
  const codes = new Set()
  const add = value => {
    if (Array.isArray(value)) value.forEach(code => typeof code === 'string' && codes.add(code))
    else if (typeof value === 'string') codes.add(value)
  }
  for (const value of Object.values(campaign?.records || {})) add(value)
  for (const result of campaign?.scenarioResults || []) {
    for (const snapshot of [result.recordsBefore, result.recordsAfter]) {
      for (const value of Object.values(snapshot || {})) add(value)
    }
  }
  const names = {}
  for (const code of codes) {
    const name = ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name
    if (name) names[code] = name
  }
  return names
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

export function viewState(state, observerSeat = null, options = {}) {
  // P1.4：includeStatic=false 时跳过两张公共静态表（cards / investigatorDefs），也不再深拷它们；
  // 大厅会另行下发会话级静态表，并按 staticVersion 让浏览器 hydrate 回来。
  const slim = !!(options && options.includeStatic === false)
  // A1′（P3.2）：stateIsolated=true 表示入参 state 已被大厅深度隔离（同一 revision 的四席位共用
  // 同一份副本）。此时视图字段浅拷贝即可，但本函数绝不能写入入参（含嵌套对象）。
  const isolated = !!(options && options.stateIsolated === true)
  const copyField = isolated ? copyViewValue : structuredClone
  const observer = Number.isInteger(observerSeat) && state.investigators.some(inv => inv.seat === observerSeat)
    ? observerSeat : null
  const view = pick(state, slim ? PUBLIC_STATE_FIELDS_SLIM : PUBLIC_STATE_FIELDS, copyField)
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
  // 记录值里的卡号→卡名只用于界面显示；规则读取的仍是 campaign.records 里的原值。
  view.campaign.recordCardNames = recordCardNames(view.campaign)
  // 补给品是公开信息（「检查你们的补给品」由全队共同核对），标签随观察投影下发，
  // 前端因此不需要另存一份中文名。选购界面还需要单价、卡面说明与两个时点的完整清单。
  const campaignManifest = contentRegistry.getCampaign(state.campaign.id)
  view.campaign.supplyLabels = { ...(campaignManifest?.supplyLabels || {}) }
  if (campaignManifest?.supplyCosts) view.campaign.supplyCosts = { ...campaignManifest.supplyCosts }
  if (campaignManifest?.supplyHints) view.campaign.supplyHints = { ...campaignManifest.supplyHints }
  if (campaignManifest?.supplyLists) view.campaign.supplyLists = structuredClone(campaignManifest.supplyLists)
  // 遗留记忆的中文名随观察投影下发（牌桌战役面板用）；P9 补齐 64 个记录键时沿用同一张表。
  view.campaign.mementoLabels = { ...(campaignManifest?.mementoLabels || {}) }
  view.campaignStory = campaignStory(state, contentRegistry, observer)
  view.agendaDoom = agendaDoom(state)
  view.totalDoom = totalDoom(state)
  // 失落的时代 / 命运之线 / 幽嘶深渊的公开状态由内容层投影（见 src/cards/campaign-view.js）。
  Object.assign(view, campaignProjection(state))
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
    ...pick(state.scenario, ['id', 'name', 'nameEn', 'intro', 'setup'], copyField),
    intro: view.campaignStory.entries.find(e => e.id === `current:${state.scenario.id}`)?.paragraphs.join('\n\n') || state.scenarioIntro?.paragraphs?.join('\n\n') || state.scenario.intro,
    layout: structuredClone(contentRegistry.getScenario(state.scenario.id).layout),
  } : null
  view.setAsideCards = publicSetAsideCards(state)
  // 第 125 轮（第 8 批）：「翻面/变体」表现由条目声明（03009 → 03009b，伤害 ≥5 时）。
  const projectAsset = (asset, inv) => {
    const variant = registeredEntry(asset.code)?.observationVariant
    if (!variant || !(inv.damage >= (variant.minDamage ?? 0))) return publicCardInstance(asset)
    return { ...publicCardInstance(asset), code: variant.code, linkedFromCode: asset.code }
  }
  view.investigators = state.investigators.map(inv => ({
    ...pick(inv, PUBLIC_INVESTIGATOR_FIELDS, copyField),
    assets: inv.assets.map(asset => projectAsset(asset, inv)),
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
  // 展示表 cards 是开局/读档时的派生快照：幕间奖励、剧本效果中途加入的卡可能不在里面。
  // 只要场上或自己的手牌里有前端拿不到定义的卡，就补一份——否则前端读不到它的 slots，
  // 会把占着槽位的支援画进「其他资产」（典型：02040 亨利·阿米蒂奇博士占了盟友槽）。
  const visibleCodes = new Set()
  for (const inv of state.investigators || []) {
    for (const card of [...(inv.assets || []), ...(inv.threat || [])]) visibleCodes.add(card.code)
    if (inv.seat === observer) for (const code of inv.hand || []) visibleCodes.add(code)
  }
  for (const card of [...(state.storyAssets || []), ...(state.victoryDisplay || [])]) visibleCodes.add(card.code)
  // P1.4：精简视图拿不到 view.cards，用大厅传入的公共表（publicCards，只读）判断缺哪些卡面。
  const publicCards = slim && options.publicCards && typeof options.publicCards === 'object' ? options.publicCards : null
  const publicCardCodes = slim && !publicCards && options.publicCardCodes instanceof Set ? options.publicCardCodes : null
  const missingVisible = [...visibleCodes].some(code => code && !(publicCards ? publicCards[code] : (publicCardCodes ? publicCardCodes.has(code) : view.cards?.[code])))
  if (missingVisible) {
    // 只补「公共可见 + 本人手牌」的卡面：别人的手牌/牌组卡面若被顺带补进来，
    // 等于泄露「他手里有这张牌」。观察者过滤在建局快照（不传 options）里保持全量。
    const defs = embeddedCardDefs(state, state.campaign?.id, { observerSeat: observer })
    if (!slim) {
      // cards 是派生展示表（见 replay.js 的 DERIVED_KEYS，不进重放指纹），旧存档与中途加入的卡
      // 在这里自愈。A1′：入参 state 可能是四席位共享的隔离副本，视图侧 copy-on-write 只更新
      // 本视图的 cards，绝不回写入参（视图生成期间权威 state 必须保持不变）。
      view.cards = { ...(view.cards || {}), ...structuredClone(defs) }
    } else {
      // 公共表只来自 mod.staticTables：公共新增进 cardsPatch（大厅合并后重发一次静态表），
      // 只有本人手牌/牌库/压牌里的卡面进 privateCards，只发给这个观察者。
      const privateZones = new Set()
      const own = (state.investigators || []).find(inv => inv.seat === observer)
      if (own) for (const code of [...(own.hand || []), ...(own.deck || []), ...(own.beneath || [])]) if (code) privateZones.add(code)
      const patch = {}
      const privateCards = {}
      for (const [code, def] of Object.entries(defs)) {
        const known = publicCards ? publicCards[code] : undefined
        // 与全量视图保持一致：全量会把 defs 整体覆盖进 view.cards，因此公共表里内容不同的也要更新。
        if (known && JSON.stringify(known) === JSON.stringify(def)) continue
        if (!known && privateZones.has(code)) privateCards[code] = def
        else patch[code] = def
      }
      if (Object.keys(patch).length) view.cardsPatch = patch
      if (Object.keys(privateCards).length) view.privateCards = privateCards
    }
  }
  // 旧存档的 cards 快照可能缺少后来新增的展示字段（例如 04006 的 allySlotsForNonUnique），
  // 前端据此画不出受限盟友槽。可见卡按当前条目补一次；A1′：只补本视图（copy-on-write），
  // 不回写共享副本或权威状态。
  for (const code of visibleCodes) {
    const nonUniqueSlots = code ? registeredEntry(code)?.passive?.allySlotsForNonUnique : null
    if (!nonUniqueSlots) continue
    if (!slim) {
      if (!view.cards?.[code] || view.cards[code].allySlotsForNonUnique === nonUniqueSlots) continue
      view.cards[code] = { ...view.cards[code], allySlotsForNonUnique: nonUniqueSlots }
    } else {
      const known = publicCards ? publicCards[code] : null
      if (!known) continue
      const base = view.cardsPatch?.[code] || known
      if (base.allySlotsForNonUnique === nonUniqueSlots) continue
      ;(view.cardsPatch ||= {})[code] = { ...base, allySlotsForNonUnique: nonUniqueSlots }
    }
  }
  view.encounterDeck = []
  view.encounterDeckSize = state.encounterDeck.length
  view.cultistDeck = []
  view.cultistDeckSize = state.cultistDeck.length
  const choice = state.pendingChoice
  // A private test can still cause another investigator to take damage or
  // answer a mandatory effect. Keep that recipient's own decision visible.
  const responder = choiceSeats(choice).includes(observer)
  view.pendingChoice = choice && (!privateTest || responder) ? {
    ...pick(choice, ['id', 'kind', 'seat', 'seats', 'prompt', 'canSkip', 'min', 'max', 'payment'], copyField),
    source: typeof choice.source === 'string' ? choice.source : pick(choice.source || {}, [
      'id', 'code', 'label', 'name', 'type',
      // 补给选购要区分序幕与补给点：两处的清单和点数不同，前端据此列出完整卡面。
      ...(choice.kind === 'pickSupplies' ? ['context'] : []),
    ], copyField),
    // cardCode 只下发给该选择的应答者（非应答者 options 为空），供界面显示候选卡面；
    // 它不包含牌库顺序等隐藏信息，且卡名此前已通过 label 公开给应答者。
    options: responder ? choiceOptionsFor(choice, observer).map(option => pick(option, [
      'id', 'label', 'cardCode',
      // 序章故事调查员：额外放行公开印刷卡面身份（职业、职业名、副标题、四维、生命/理智），
      // 选人界面据此画出卡面。这些字段只放宽给 storyInvestigator 的应答座位，其他 kind
      // 仍只保留 id/label/cardCode，避免把无关选择里的内部数据顺带带出。
      ...(choice.kind === 'storyInvestigator' ? ['klass', 'classLabel', 'subtitle', 'stats', 'health', 'sanity'] : []),
    ], copyField)) : [],
  } : null
  // state.legalMoves is cached for the primary seat; simultaneous seats compute their own list.
  view.legalMoves = observer == null || !actingSeats(state).includes(observer) ? []
    : observer === decisionSeat(state) ? structuredClone(state.legalMoves || []) : legalMoves(state, observer)
  // 关间升级：牌组里换不掉的卡与原因，由服务端用同一套升级规则算好再投影给本人。
  // 升级界面据此把不可替换的卡置灰并显示原因；前端不复制升级判定（ARCHITECTURE §4 第 2 条）。
  const purchaseMoves = view.legalMoves.filter(move => move.action === 'hubPurchase')
  if (observer != null && purchaseMoves.length && state.campaign?.investigators?.[observer]) {
    const record = upgradeRecord(state.campaign.investigators[observer])
    const context = cardPoolContext(state)
    const legalByAdded = new Map()
    for (const move of purchaseMoves) {
      if (!legalByAdded.has(move.added)) legalByAdded.set(move.added, new Set())
      legalByAdded.get(move.added).add(move.removed)
    }
    const blocked = {}
    for (const [added, knownLegal] of legalByAdded) {
      const list = replacementBlockers(record, added, state.campaign.records, context, knownLegal)
      if (list.length) blocked[added] = list
    }
    if (Object.keys(blocked).length) view.upgradeBlocked = blocked
  }
  // 牌桌只显示场景/密谋区行动；敌人与地点绑定的条件行动只用于 AI 计划（describeState）。
  // 同一份提示同时供「剧本行动」与「已用行动」使用，避免重复枚举 behavior.actions。
  const actionHints = observer == null ? [] : scriptActionHints(state, observer)
  view.scriptActions = actionHints.filter(hint => ['act', 'agenda'].includes(hint.scriptCard))
  // 能力上限的公开投影：每张支援的每条「每回合/每场游戏…」能力是否已经用掉。
  // 场上支援对所有座位可见，因此上限账本也按座位全量下发；它只回答「还能不能用」，
  // 不重复 legalMoves 的费用/目标/时机判定。牌桌据此给卡面加「已用」角标。
  view.abilityUsage = Object.fromEntries(state.investigators
    .map(inv => [inv.seat, abilityUsage(state, inv)])
    .filter(([, list]) => list.length))
  // 已经用掉的「每场游戏一次」卡面行动：内容层在提示上打 used 标记（reason 给 AI 与牌桌共用）。
  // 这里只投影地点绑定的条目——挂在幕/密谋上的已用行动已经在 scriptActions 里带 reason 显示。
  view.usedActions = actionHints.filter(hint => hint.used && !hint.scriptCard)
    .map(hint => ({ label: hint.label, reason: hint.reason }))
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

// P1.4：会话级公共静态表。只含公共卡面与调查员定义（与所有人本来就拿到的展示表内容一致），
// 不含任何席位的私有信息；返回独立副本，供大厅长期缓存、合并 cardsPatch，且不回写权威状态。
export function staticTables(state) {
  return {
    cards: structuredClone(state.cards || {}),
    investigatorDefs: structuredClone(state.investigatorDefs || {}),
  }
}
