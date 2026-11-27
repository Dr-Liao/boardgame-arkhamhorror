// 狼人诅咒（curseOfTheRougarou · 81001）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/CurseOfTheRougarou.hs + Act|Agenda|Cards/CurseOfTheRougarou/*.hs +
//       Enemy|Treachery/Cards/CurseOfTheRougarou/*.hs + Location/CardDefs/CurseOfTheRougarou.hs。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   preScenarioSetup / startLocation → 4 堆地点随机（移除 1 堆 / 入场 1 堆 / 放一边 2 堆），起始=入场堆的 Bayou
//   setupLocations / locationPlaced / afterDeckSetup → 入场堆 3 地点、放一边区、遭遇牌库
//   actions / performAction → 地点行动（温室/污秽沼泽/扭曲灌木/石冢）读取条目 flags.locationAction
//   actReveal → 幕 1 背面（Lady Esprit 入场、放一边地点入场、生成狼人、洗入狼人组、队长威胁区放诅咒弱点）
//               幕 2 背面（4 项条件满足→结局 3，否则翻回 2a，由 actIndexAfterAdvance 保持指针）
//   agendaReveal → 议程背面（洗回遭遇弃牌堆 / 移动狼人到线索最少的非河口地点 / 无狼人则加 1 毁灭）
//   checkObjectives → 幕 2 目标：狼人被击败 → 结局 2
//   spawnLocation → 敌人「生成 - 任意/非 [[Bayou]] 地点」（读条目 flags.spawnTrait）
//   enemyStatModifier → 沼泽短吻鳄在 [[Bayou]] +2 战斗/躲避（读条目 flags.bayouStatBonus）
//   enemyDamaged → 狼人一个阶段内受到 1[per_investigator] 伤害后移动到离所有调查员最远的地点
//   turnEnded → 「狼人诅咒」弱点：回合结束未造成伤害则受 1 恐惧
//   locationLeft → 地点强制离场效果（诅咒河岸/遗忘湿地）
//   resolveChaosToken / applyTokenEffect / tokenMeanings → 混乱标记（skull/cultist/tablet/elder_thing）
//   resolution → 声明式结局 effects（记录 / 移除诅咒弱点 / 奖励牌）
import { spliceHand } from '../../../../../src/engine/hand-icons.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  ACT1_CODE, ACT2_CODE, AGENDA1_CODE, AGENDA2_CODE, AGENDA3_CODE,
  ACT_STAGES, AGENDA_CODES, AGENDA_STAGES, ENCOUNTER_DECK, PILE_LOCATIONS, PILE_TRAITS,
  LOCATIONS, START_LOCATION, SET_ASIDE_ALIASES, ROUGAROU_SET_DECK_CODES,
  ROUGAROU_ENEMY_CODE, CURSE_WEAKNESS_CODE,
  LADY_ESPIRIT_CODE, BEAR_TRAP_CODE, FISHING_NET_CODE, MONSTROUS_TRANSFORMATION_CODE,
  SCENARIO_TEXT,
} from './definition.js'

const CHAPTER_ID = 'curseOfTheRougarou'

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------
const clone = value => structuredClone(value)
const codeOf = value => String(value?.originalCode || value?.code || '')
const info = (api, message) => api?.info?.(message)
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const activeInvestigators = state => (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
const flagsFor = state => (state.scenarioFlags ||= {})
const flagValue = (state, key) => flagsFor(state)[key]
const setFlag = (state, key, value = true) => { flagsFor(state)[key] = value; return value }
const recordsFor = state => (state.campaign ||= {}).records || ((state.campaign.records = {}))
const randomOf = api => (typeof api?.random === 'function' ? api.random : () => 0.5)
const hasTrait = (card, trait) => (card?.traits || []).some(value => String(value).toLowerCase() === String(trait).toLowerCase())
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const enemiesInPlay = state => (state.enemies || []).filter(enemy => !enemy.defeated)
const rougarouInPlay = state => enemiesInPlay(state).find(enemy => codeOf(enemy) === ROUGAROU_ENEMY_CODE) || null
const currentActCode = state => codeOf((state.acts || [])[state.actIndex ?? 0])
const currentAgendaCode = state => codeOf((state.agendas || [])[state.agendaIndex ?? 0])
const isHardSide = state => state.difficulty === 'hard' || state.difficulty === 'expert'
const entryFlagsOf = code => registeredEntry(String(code || ''))?.flags || {}
const rememberFact = (state, fact) => {
  flagsFor(state).remembered ||= []
  if (!flagsFor(state).remembered.includes(fact)) flagsFor(state).remembered.push(fact)
  return true
}
const remembered = (state, fact) => Array.isArray(flagValue(state, 'remembered')) && flagValue(state, 'remembered').includes(fact)
const bayouLocationsInPlay = state => (state.locations || []).filter(location =>
  hasTrait(ALL_CARDS[location.originalCode || location.code], 'Bayou'))
const nonBayouLocationsInPlay = state => (state.locations || []).filter(location =>
  !hasTrait(ALL_CARDS[location.originalCode || location.code], 'Bayou'))
const groupCluesAt = (state, locationId) => activeInvestigators(state)
  .filter(inv => inv.location === locationId).reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
const groupClues = state => activeInvestigators(state).reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)

function locationDistanceMap(state, from) {
  const distances = new Map([[from, 0]])
  const queue = [from]
  for (const id of queue) {
    const location = locationOf(state, id)
    for (const next of location?.connections || []) {
      if (!locationOf(state, next) || distances.has(next)) continue
      distances.set(next, distances.get(id) + 1)
      queue.push(next)
    }
  }
  return distances
}

/** 距离所有调查员最远的地点（同距离返回第一条；狼人强制移动用）。 */
function farthestLocationFromAll(state) {
  const active = activeInvestigators(state)
  if (!active.length) return (state.locations || [])[0]?.id || null
  let best = null
  let bestScore = -1
  for (const location of state.locations || []) {
    const score = Math.min(...active.map(inv => locationDistanceMap(state, inv.location).get(location.id) ?? 0))
    if (score > bestScore) { bestScore = score; best = location.id }
  }
  return best
}

/** 「线索最少的非河口地点」（议程背面 / 觅食）。 */
function fewestClueNonBayouLocation(state) {
  const candidates = nonBayouLocationsInPlay(state)
  if (!candidates.length) return null
  const min = Math.min(...candidates.map(location => Number(location.clues) || 0))
  const tied = candidates.filter(location => (Number(location.clues) || 0) === min)
  return tied[0]?.id || null
}

function shuffleWith(api, list) {
  if (typeof api?.shuffle === 'function') return api.shuffle([...list])
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(randomOf(api) * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function spawnEnemyAt(state, code, locationId, api, options = {}) {
  if (!locationId) return null
  if (typeof api?.spawn === 'function') return api.spawn(code, locationId, options)
  const definition = (state.scenario?.enemies || {})[code] || {}
  const enemy = {
    id: `${code}-${state.round}-${(state.enemies?.length || 0) + 1}`, code, originalCode: code,
    name: definition.name || ALL_CARDS[code]?.nameZh || code,
    fight: definition.fight ?? 1, evade: definition.evade ?? 1,
    health: definition.health ?? 1, damage: definition.damage || 0, horror: definition.horror || 0,
    damageTaken: 0, doom: 0, location: locationId, engagedSeat: null, exhausted: false,
    ...(definition.victory != null ? { victory: definition.victory } : {}),
  }
  state.enemies ||= []
  state.enemies.push(enemy)
  return enemy
}

function placeLocationLite(state, id, api) {
  if (!locationOf(state, id) && typeof api?.place === 'function') api.place(id)
  const location = locationOf(state, id)
  if (location) { location.revealed = true }
  return location
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
export function prepareScenario(state, api = {}) {
  if (flagValue(state, 'rougarouPiles')) return flagValue(state, 'rougarouPiles')
  // 参考 Setup：shuffleM keys locationsByTrait；trait = drop 1 (第二堆) 入场；rest = drop 2 放一边；
  // 第一堆从游戏中移除。
  const order = shuffleWith(api, PILE_TRAITS)
  const removed = order[0]
  const inPlay = order[1]
  const setAside = order.slice(2)
  const inPlayLocations = PILE_LOCATIONS[inPlay]
  const startLocation = inPlayLocations.find(id => hasTrait(ALL_CARDS[LOCATIONS[id].code], 'Bayou')) || START_LOCATION
  const setAsideLocations = setAside.flatMap(pile => PILE_LOCATIONS[pile])
  const removedLocations = PILE_LOCATIONS[removed]
  const report = { order, removed, inPlay, setAside, startLocation, inPlayLocations,
    setAsideLocations, removedLocations }
  setFlag(state, 'rougarouPiles', report)

  const actSource = state.scenario?.stageCards || ACT_STAGES
  state.acts = [ACT1_CODE, ACT2_CODE].map(code => {
    const act = clone(actSource[code] || ACT_STAGES[code])
    if (code === ACT1_CODE) act.objective = { ...act.objective, atLocation: startLocation }
    return act
  })
  state.agendas = AGENDA_CODES.map(code => clone((state.scenario?.agendas || [])
    .find(agenda => codeOf(agenda) === code) || AGENDA_STAGES[code]))
  state.actIndex = Number.isInteger(state.actIndex) ? state.actIndex : 0
  state.agendaIndex = Number.isInteger(state.agendaIndex) ? state.agendaIndex : 0
  info(api, `狼人诅咒：移除「${pileLabel(removed)}」堆，入场「${pileLabel(inPlay)}」堆，起始地点为「${locLabel(state, startLocation)}」。`)
  return report
}

const PILE_LABELS = Object.freeze({
  newOrleans: '新奥尔良', riverside: '河畔', wilderness: '荒野', unhallowed: '不洁之地',
})
const pileLabel = pile => PILE_LABELS[pile] || pile
const locLabel = (state, id) => locationOf(state, id)?.name || LOCATIONS[id]?.name || id

export function preScenarioSetup(state, events, helperOrApi = {}) {
  void events
  const api = helperOrApi?.api || helperOrApi || {}
  return prepareScenario(state, api)
}

/** 起始地点：入场堆里的 [[Bayou]] 地点（参考 Setup 的 break (elem Bayou)）。 */
export function startLocation(state) {
  return flagValue(state, 'rougarouPiles')?.startLocation || START_LOCATION
}

export function setupLocations(state, events, helper = {}) {
  void events
  const api = helper?.api || {}
  const report = prepareScenario(state, api)
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = [...SET_ASIDE_ALIASES]
  state.scenarioZones.setAsideLocations = [...report.setAsideLocations]
  state.scenarioZones.removedLocations = [...report.removedLocations]
  state.encounterDeck ||= [...ENCOUNTER_DECK]
  info(api, `狼人诅咒：${report.inPlayLocations.length} 张地点入场，${report.setAsideLocations.length} 张地点放一边；`
    + `遭遇牌库 ${(state.encounterDeck || []).length} 张。`)
  return [...report.inPlayLocations]
}

export function locationPlaced(state, location, api = {}, seat = null) {
  void seat
  if (!location) return
  location.revealed = true
  const card = ALL_CARDS[codeOf(location)] || {}
  const fixed = Number(location.cluesFixed)
  const perPlayer = Number(location.cluesPerInvestigator)
  if (Number.isFinite(fixed)) location.clues = Math.max(0, fixed)
  else if (Number.isFinite(perPlayer)) location.clues = perPlayer * investigatorCount(state)
  else if (Number.isFinite(Number(card.clues))) location.clues = Number(card.clues) * investigatorCount(state)
  void api
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  prepareScenario(state, api)
  state.scenarioZones ||= {}
  state.scenarioZones.setAside ||= [...SET_ASIDE_ALIASES]
  state.scenarioZones.setAsideLocations ||= []
  if (!state.encounterDeck?.length) state.encounterDeck = [...ENCOUNTER_DECK]
  return { startLocation: startLocation(state) }
}

/** 单测/直调入口：按种子随机放好入场堆、遭遇牌库与放一边区。 */
export function setupScenario(state, api = {}) {
  state.locations = []
  state.scenarioFlags ||= {}
  delete state.scenarioFlags.rougarouPiles
  const report = prepareScenario(state, api)
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = [...SET_ASIDE_ALIASES]
  state.scenarioZones.setAsideLocations = [...report.setAsideLocations]
  for (const id of report.inPlayLocations) {
    const instance = { ...clone(LOCATIONS[id]), clues: 0, revealed: true,
      connections: [...LOCATIONS[id].connections] }
    const card = ALL_CARDS[LOCATIONS[id].code]
    if (card.victory != null) instance.victory = card.victory
    state.locations.push(instance)
    locationPlaced(state, instance, api)
  }
  state.investigators ||= []
  for (const inv of state.investigators) if (!inv.location) inv.location = report.startLocation
  state.encounterDeck = [...ENCOUNTER_DECK]
  afterDeckSetup(state, null, { api })
  info(api, `狼人诅咒布置完成：${state.locations.length} 张地点入场，起始「${locLabel(state, report.startLocation)}」。`)
  return { ...report, placedIds: state.locations.map(location => location.id) }
}

// ---------------------------------------------------------------------------
// 行动：地点行动（条目 flags.locationAction 的数据由这里统一分派）
// ---------------------------------------------------------------------------
function locationActions(state, inv) {
  const moves = []
  for (const location of state.locations || []) {
    if (location.id !== inv.location) continue
    const action = entryFlagsOf(location.originalCode || location.code).locationAction
    if (!action) continue
    const label = actionLabel(action, state, inv)
    const error = actionError(action, state, inv)
    moves.push({
      action: 'scenarioAction', rule: `rougarouLocation:${action.kind}`, locationId: location.id,
      actions: 1, label, reason: error,
    })
  }
  return moves
}

function actionLabel(action, state, inv) {
  void inv
  switch (action.kind) {
    case 'gardenDistrict': return '检定[敏捷](7)：闯入附近温室，成功则记录「找到一个奇怪的玩偶」'
    case 'foulSwamp': return '受到至多 3 点恐惧：检定[意志](7)（每受 1 恐惧 +1），成功则记录「找到一块古代束缚之石」'
    case 'twistedUnderbrush': return '获得 2 资源并受到 1 点恐惧'
    case 'overgrownCairns': return '花费 2 资源：治愈 2 点恐惧（每场游戏限一次）'
    default: return action.label || '地点行动'
  }
}

function actionError(action, state, inv) {
  switch (action.kind) {
    case 'gardenDistrict': return null
    case 'foulSwamp': return null
    case 'twistedUnderbrush': return null
    case 'overgrownCairns':
      if (flagValue(state, 'overgrownCairnsUsed')) return '每场游戏已使用'
      return (Number(inv.resources) || 0) >= 2 ? null : '需要 2 资源'
    default: return null
  }
}

export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  if (!locationOf(state, inv.location)) return []
  const moves = locationActions(state, inv)
  // 幕 2：与狼人交战的调查员可以尝试推进（参考 Objective：「也许还有别的办法……」每阶段限一次）。
  if (currentActCode(state) === ACT2_CODE) {
    const rougarou = rougarouInPlay(state)
    const engaged = rougarou && rougarou.engagedSeat === inv.seat
    const used = Number(flagValue(state, 'rougarouTameAttempts')?.[state.round] || 0)
    moves.push({
      action: 'scenarioAction', rule: 'rougarouTameAdvance', locationId: inv.location, actions: 1,
      label: '“也许还有别的办法……”：与狼人交战时尝试安抚它并推进幕（每阶段限一次）',
      reason: !engaged ? '你必须与狼人交战' : (used > 0 ? '本阶段已尝试过' : null),
    })
  }
  return moves
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv || inv.defeated || inv.resigned) return false
  const kind = String(move.rule || '').replace(/^rougarouLocation:/, '')
  if (kind === 'gardenDistrict') return gardenDistrictAction(state, inv, api)
  if (kind === 'foulSwamp') return foulSwampAction(state, inv, api)
  if (kind === 'twistedUnderbrush') return twistedUnderbrushAction(state, inv, api)
  if (kind === 'overgrownCairns') return overgrownCairnsAction(state, inv, api)
  if (move.rule === 'rougarouTameAdvance') return tameAdvanceAction(state, inv, api)
  return false
}

function gardenDistrictAction(state, inv, api) {
  const record = () => {
    recordsFor(state).foundAStrangeDoll = true
    rememberFact(state, 'foundAStrangeDoll')
    info(api, '🌿 你在温室里找到一个奇怪的玩偶：调查员已「找到一个奇怪的玩偶」。')
  }
  safeCall(api, 'test', inv.seat, 'agility', 7, result => { if (result?.success) record() })
  return true
}

function foulSwampAction(state, inv, api) {
  const taken = Number(safeCall(api, 'choose', {
    kind: 'rougarouHorrorCount', source: 'foulSwamp', seat: inv.seat,
    prompt: '选择本行动要承受的恐惧数量（至多 3 点；每点使本次检定 +1[意志]）。',
    options: [0, 1, 2, 3].map(amount => ({ id: String(amount), label: `${amount} 点恐惧` })),
  })) || 0
  const count = Math.max(0, Math.min(3, taken))
  if (count > 0) safeCall(api, 'horror', inv.seat, count)
  if (inv.defeated || inv.resigned) return true
  safeCall(api, 'test', inv.seat, 'willpower', 7, result => {
    if (!result?.success) return
    recordsFor(state).foundAnAncientBindingStone = true
    rememberFact(state, 'foundAnAncientBindingStone')
    info(api, '🪨 你在骨冢中找到一块古代束缚之石：调查员已「找到一块古代束缚之石」。')
  }, { skillBonus: count })
  return true
}

function twistedUnderbrushAction(state, inv, api) {
  safeCall(api, 'gainResources', inv.seat, 2)
  safeCall(api, 'horror', inv.seat, 1)
  info(api, '🌳 你在扭曲灌木中翻找：获得 2 资源并受到 1 点恐惧。')
  return true
}

function overgrownCairnsAction(state, inv, api) {
  if (flagValue(state, 'overgrownCairnsUsed')) return false
  if ((Number(inv.resources) || 0) < 2) return false
  setFlag(state, 'overgrownCairnsUsed', true)
  safeCall(api, 'loseResources', inv.seat, 2)
  safeCall(api, 'healHorror', inv.seat, 2)
  info(api, '🪦 你花费 2 资源在杂草丛生的石冢前祈祷：治愈 2 点恐惧。')
  return true
}

function tameAdvanceAction(state, inv, api) {
  const rougarou = rougarouInPlay(state)
  if (!rougarou || rougarou.engagedSeat !== inv.seat) return false
  const attempts = flagValue(state, 'rougarouTameAttempts') || {}
  attempts[state.round] = Number(attempts[state.round] || 0) + 1
  setFlag(state, 'rougarouTameAttempts', attempts)
  // 参考实现 Objective（每阶段一次）：满足 4 项条件则进入结局 3，否则翻回 2a。
  if (tameConditionsMet(state)) {
    info(api, '🌕 四项条件全部满足：你们安抚了狼人的诅咒。（→结局 3）')
    safeCall(api, 'finish', 'resolution3')
    return true
  }
  info(api, '🌕 安抚条件尚未全部满足：幕 2 翻回正面（a 面）。')
  setFlag(state, 'rougarouRevertOnce', { actIndex: state.actIndex, round: state.round })
  return true
}

/** 幕 2 背面的 4 项条件（参考 AdvanceAct 的 learnedMoreAboutTheCurse / keptItContained /
 * protectedOurselves / calmedItDown）。 */
export function tameConditionsMet(state) {
  const rougarou = rougarouInPlay(state)
  const players = investigatorCount(state)
  const requiredClues = 4 * players
  const learnedMore = groupClues(state) >= requiredClues
  const traps = rougarou
    ? (state.investigators || []).flatMap(inv => inv.assets || [])
      .filter(asset => [BEAR_TRAP_CODE, FISHING_NET_CODE].includes(codeOf(asset)))
    : []
  const contained = traps.length > 0
  const damaged = (Number(rougarou?.damageTaken) || 0) >= players
  const calmed = remembered(state, 'foundAStrangeDoll') || remembered(state, 'foundAnAncientBindingStone')
  return learnedMore && contained && damaged && calmed
}

export function tameConditionReport(state) {
  const rougarou = rougarouInPlay(state)
  const players = investigatorCount(state)
  return {
    learnedMoreAboutTheCurse: groupClues(state) >= 4 * players,
    keptItContained: Boolean(rougarou && (state.investigators || []).flatMap(inv => inv.assets || [])
      .some(asset => [BEAR_TRAP_CODE, FISHING_NET_CODE].includes(codeOf(asset)))),
    protectedOurselves: (Number(rougarou?.damageTaken) || 0) >= players,
    calmedItDown: remembered(state, 'foundAStrangeDoll') || remembered(state, 'foundAnAncientBindingStone'),
  }
}

// ---------------------------------------------------------------------------
// 敌人生成落点（条目 flags.spawnTrait / flags.spawnTraitExcluded 声明，这里唯一读点）
// ---------------------------------------------------------------------------
export function spawnLocation(state, code, fallback, engagedSeat, api = {}) {
  void engagedSeat
  const flags = entryFlagsOf(code)
  const wantTrait = flags.spawnTrait || null
  const excludeTrait = flags.spawnTraitExcluded || null
  const candidates = (state.locations || []).filter(location => {
    const traits = ALL_CARDS[location.originalCode || location.code]?.traits || []
    if (wantTrait && !traits.some(trait => String(trait).toLowerCase() === String(wantTrait).toLowerCase())) return false
    if (excludeTrait && traits.some(trait => String(trait).toLowerCase() === String(excludeTrait).toLowerCase())) return false
    return true
  })
  if (!candidates.length) return fallback
  const shuffled = shuffleWith(api, candidates.map(location => location.id))
  return shuffled[0]
}

// ---------------------------------------------------------------------------
// 幕 / 议程背面
// ---------------------------------------------------------------------------
export function actReveal(state, act, api = {}) {
  const code = codeOf(act)
  if (code === ACT1_CODE) return act1Back(state, api)
  if (code === ACT2_CODE) return act2Back(state, api)
  return false
}

function act1Back(state, api) {
  const report = flagValue(state, 'rougarouPiles') || {}
  // 1) Lady Esprit 入场（放在一个 [[Bayou]] 地点）。
  const bayou = bayouLocationsInPlay(state)[0] || locationOf(state, startLocation(state))
  if (bayou && typeof api?.storyAsset === 'function') api.storyAsset(LADY_ESPIRIT_CODE, bayou.id)
  else if (bayou) placeLocationLite(state, bayou.id, api)

  // 2) 把放一边的每个地点放入场（参考 Act1b 第一段）。
  for (const id of report.setAsideLocations || []) placeLocationLite(state, id, api)
  if (report.removedLocations?.length) {
    state.scenarioZones ||= {}
    state.scenarioZones.removedLocations = [...report.removedLocations]
  }

  // 3) 生成狼人（任意非 [[Bayou]] 地点）。
  const nonBayou = nonBayouLocationsInPlay(state)
  const spawnAt = nonBayou[Math.floor(randomOf(api) * nonBayou.length)] || nonBayou[0]
  if (spawnAt) {
    const rougarou = spawnEnemyAt(state, ROUGAROU_ENEMY_CODE, spawnAt.id, api)
    if (rougarou) info(api, `🐺 狼人生成在「${spawnAt.name}」。`)
  }

  // 4) 遭遇弃牌堆洗回 + 狼人组（除狼人本体）洗入遭遇牌库。
  state.encounterDeck = [...(state.encounterDeck || []), ...(state.encounterDiscard || []), ...ROUGAROU_SET_DECK_CODES]
  state.encounterDiscard = []
  if (typeof api?.shuffle === 'function') state.encounterDeck = api.shuffle(state.encounterDeck)

  // 5) 队长把放一边的「狼人诅咒」弱点放入威胁区域。
  const lead = leadSeatOf(state)
  const internals = { state, events: [], info: () => {} }
  void internals
  const threat = { id: `${CURSE_WEAKNESS_CODE}-${state.round}-${lead}`, code: CURSE_WEAKNESS_CODE, originalCode: CURSE_WEAKNESS_CODE }
  state.investigators?.[lead]?.threat?.push(threat)
  info(api, `🩸 ${state.investigators?.[lead]?.name || '队长'} 的威胁区域放入「狼人诅咒」弱点。`)
  return true
}

function act2Back(state, api) {
  // 幕 2 背面：条件满足 → 结局 3；否则翻回 2a（由 actIndexAfterAdvance 保持指针）。
  if (tameConditionsMet(state)) {
    info(api, '🌕 幕 2 背面：四项安抚条件全部满足（→结局 3）。')
    safeCall(api, 'finish', 'resolution3')
    return true
  }
  info(api, '🌕 幕 2 背面：安抚条件未全部满足，幕 2 翻回 a 面。')
  return true
}

export function actIndexAfterAdvance(state, act) {
  if (codeOf(act) === ACT2_CODE && !tameConditionsMet(state)) return state.actIndex
  return undefined
}

export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  if (code === AGENDA1_CODE) return agendaBack(state, api, { shuffleRougarouSet: false })
  if (code === AGENDA2_CODE) return agendaBack(state, api, { shuffleRougarouSet: true })
  if (code === AGENDA3_CODE) {
    info(api, '🌑 议程 3 背面：诅咒蔓延，狼人诅咒吞噬了它的持有者。（→结局 1）')
    safeCall(api, 'finish', 'resolution1')
    return true
  }
  return false
}

function agendaBack(state, api, { shuffleRougarouSet }) {
  // 参考议程背面：洗回遭遇弃牌堆；狼人在场则移动到「线索最少的非河口地点」；不在场则在新议程上加 1 毁灭。
  state.encounterDeck = [...(state.encounterDeck || []), ...(state.encounterDiscard || [])]
  state.encounterDiscard = []
  if (shuffleRougarouSet) {
    // 议程 2 背面：把遭遇弃牌堆里所有「觅食」(81034) 洗回遭遇牌库（弃牌堆已在上一步并回，这里补足数量）。
    state.encounterDeck = state.encounterDeck.filter(code => code !== '81034')
    for (let index = 0; index < 5; index++) state.encounterDeck.push('81034')
  }
  if (typeof api?.shuffle === 'function') state.encounterDeck = api.shuffle(state.encounterDeck)
  const rougarou = rougarouInPlay(state)
  if (rougarou) {
    const destination = fewestClueNonBayouLocation(state)
    if (destination) {
      moveEnemyUntil(state, rougarou, destination, api)
      info(api, `🐺 狼人移动到线索最少的非河口地点「${locLabel(state, destination)}」。`)
    }
  } else {
    const newAgenda = state.agendas?.[state.agendaIndex + 1]
    if (newAgenda) newAgenda.doom = (Number(newAgenda.doom) || 0) + 1
    info(api, '🌑 狼人不在场：在新议程上放置 1 个毁灭标记。')
  }
  return true
}

/** 「每次移动一个地点」：沿连接图逐格移动（参考 MoveUntil）。 */
function moveEnemyUntil(state, enemy, destination, api = {}) {
  let guard = 0
  while (enemy.location !== destination && guard++ < 32) {
    const distances = locationDistanceMap(state, enemy.location)
    const next = (locationOf(state, enemy.location)?.connections || [])
      .filter(id => locationOf(state, id))
      .sort((a, b) => (distances.get(a) ?? 99) - (distances.get(b) ?? 99))[0]
    if (!next || next === enemy.location) break
    if (typeof api?.moveEnemy === 'function' && api.moveEnemy(enemy, next) === false) break
    enemy.location = next
    scenarioBehaviorSideEffects(state, enemy, next)
  }
  return enemy.location === destination
}

/** 移动副作用：敌人离场触发（幕 2 正面强制：狼人离开地点后放置 1 个线索）。 */
function scenarioBehaviorSideEffects(state, enemy, from) {
  if (codeOf(enemy) !== ROUGAROU_ENEMY_CODE) return
  if (currentActCode(state) !== ACT2_CODE) return
  const location = locationOf(state, from)
  if (!location) return
  location.clues = (Number(location.clues) || 0) + 1
}

// ---------------------------------------------------------------------------
// 目标 / 强制效果
// ---------------------------------------------------------------------------
export function checkObjectives(state, api = {}) {
  if (currentActCode(state) !== ACT2_CODE) return false
  const rougarouAlive = Boolean(rougarouInPlay(state))
  if (!rougarouAlive) {
    info(api, '🐺 狼人已被击败。（→结局 2）')
    safeCall(api, 'finish', 'resolution2')
    return true
  }
  return false
}

/** 狼人一个阶段内受到 1[per_investigator] 伤害后：移动到离所有调查员最远的地点。 */
export function enemyDamaged(state, enemy, api = {}, seat = null) {
  if (Number.isInteger(seat)) {
    const struck = flagValue(state, 'damageDealtBySeat') || {}
    struck[`${seat}:${state.round}`] = true
    setFlag(state, 'damageDealtBySeat', struck)
  }
  if (codeOf(enemy) !== ROUGAROU_ENEMY_CODE) return false
  const threshold = investigatorCount(state)
  const key = `${state.round}:${state.phase}`
  const ledger = flagValue(state, 'rougarouDamagePhase') || {}
  ledger[key] = Number(ledger[key] || 0) + 1
  setFlag(state, 'rougarouDamagePhase', ledger)
  if (ledger[key] < threshold) return false
  setFlag(state, 'rougarouDamagePhase', { ...ledger, [key]: 0 })
  const destination = farthestLocationFromAll(state)
  if (destination) {
    moveEnemyUntil(state, enemy, destination, api)
    info(api, `🐺 狼人受到 ${threshold} 点伤害：移动到离所有调查员最远的地点「${locLabel(state, destination)}」。`)
  }
  return true
}

/** 地点强制离场效果（条目 flags.locationLeft 的唯一读点）：
 *  · cursedShores：选择并弃掉 1 张技能卡；
 *  · forgottenMarsh：失去 2 资源；
 *  · 另外结算威胁区「拖入水底」(81026)：离开当前地点时受 2 伤害并弃掉该卡。 */
export function locationLeft(state, inv, location, api = {}) {
  const flags = entryFlagsOf(codeOf(location))
  if (flags.locationLeft === 'cursedShores') {
    const skills = (inv.hand || []).filter(card => ALL_CARDS[card]?.type === 'skill')
    if (skills.length) {
      const pick = skills[Math.floor(randomOf(api) * skills.length)]
      spliceHand(inv, inv.hand.indexOf(pick), 1)
      inv.discard.push(pick)
      info(api, `🌫️ ${inv.name} 离开诅咒河岸：弃掉技能卡「${ALL_CARDS[pick]?.nameZh || pick}」。`)
    }
  } else if (flags.locationLeft === 'forgottenMarsh') {
    safeCall(api, 'loseResources', inv.seat, 2)
    info(api, `🌫️ ${inv.name} 离开遗忘湿地：失去 2 资源。`)
  }
  // 「拖入水底」：离开当前地点时受到 2 点伤害并弃掉该诡计。
  const draggedUnder = (inv.threat || []).find(card => codeOf(card) === '81026')
  if (draggedUnder) {
    inv.threat.splice(inv.threat.indexOf(draggedUnder), 1)
    safeCall(api, 'damage', inv.seat, 2)
    info(api, `🌊 ${inv.name} 离开地点时被拖入水底：受到 2 点伤害并弃掉「拖入水底」。`)
    return true
  }
  return Boolean(flags.locationLeft)
}

/** 回合结束：「狼人诅咒」弱点持有者本回合未造成伤害 → 受 1 恐惧；
 *  「拖入水底」在威胁区域时：回合结束检定敏捷(3)，成功弃掉该卡。 */
export function turnEnded(state, inv, api = {}) {
  if (!inv || inv.defeated || inv.resigned) return false
  let handled = false
  if ((inv.threat || []).some(card => codeOf(card) === CURSE_WEAKNESS_CODE)) {
    const dealt = flagValue(state, 'damageDealtBySeat') || {}
    const key = `${inv.seat}:${state.round}`
    if (!dealt[key]) {
      safeCall(api, 'horror', inv.seat, 1)
      info(api, `🩸 ${inv.name} 本回合未造成伤害：狼人诅咒造成 1 点恐惧。`)
      handled = true
    }
  }
  const draggedUnder = (inv.threat || []).find(card => codeOf(card) === '81026')
  if (draggedUnder) {
    safeCall(api, 'test', inv.seat, 'agility', 3, result => {
      if (!result?.success) return
      const index = inv.threat.indexOf(draggedUnder)
      if (index >= 0) inv.threat.splice(index, 1)
      inv.discard.push('81026')
      info(api, `🌊 ${inv.name} 在回合结束时摆脱了「拖入水底」。`)
    })
    handled = true
  }
  return handled
}

/** 神话阶段开始 = 上一调查阶段结束：议程 3 正面「狼人未与调查员交战 → +1 毁灭」。 */
export function phaseBegan(state, phase, api = {}) {
  if (phase !== 'mythos') return false
  if (currentAgendaCode(state) !== AGENDA3_CODE) return false
  const rougarou = rougarouInPlay(state)
  const engaged = rougarou && (state.investigators || [])
    .some(inv => rougarou.engagedSeat === inv.seat && !inv.defeated && !inv.resigned)
  if (engaged) return false
  safeCall(api, 'addDoom', 1)
  info(api, '🌑 议程 3 正面：调查阶段结束时狼人未与调查员交战，在本议程上放置 1 个毁灭标记。')
  return true
}

/** 狼人交战额外费用：团队需支付 1 线索（3–4 位调查员时 2 线索）。读点 moves.js/enemies.js。 */
export function canEngageEnemy(state, inv, enemy) {
  if (codeOf(enemy) !== ROUGAROU_ENEMY_CODE) return true
  const required = investigatorCount(state) >= 3 ? 2 : 1
  return groupClues(state) >= required
}

/** 伤害来源记账（turnEnded 的「本回合未造成伤害」读点）。
 *  普通攻击由 combat.js 的 enemyAttackedSuccessfully 派发；战斗/效果伤害由 enemyDamaged 补记。 */
export function enemyAttackedSuccessfully(state, inv, enemy, api, result = {}) {
  void enemy
  void api
  if (!(Number(result?.damage) > 0)) return false
  const struck = flagValue(state, 'damageDealtBySeat') || {}
  struck[`${inv.seat}:${state.round}`] = true
  setFlag(state, 'damageDealtBySeat', struck)
  return true
}

export function enemyDefeated(state, enemy, api = {}) {
  void api
  if (codeOf(enemy) !== ROUGAROU_ENEMY_CODE) return false
  setFlag(state, 'rougarouDefeated', true)
  return true
}

// 沼泽短吻鳄在 [[Bayou]] 地点 +2 战斗/躲避（条目 flags.bayouStatBonus 的读点）。
export function enemyStatModifier(state, enemy, stat) {
  const bonus = entryFlagsOf(codeOf(enemy)).bayouStatBonus
  if (!bonus) return 0
  const location = locationOf(state, enemy.location)
  const traits = ALL_CARDS[location?.originalCode || location?.code]?.traits || []
  if (!traits.some(trait => String(trait).toLowerCase() === 'bayou')) return 0
  return Number(bonus[stat]) || 0
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
export function resolveChaosToken(state, inv, token) {
  const face = String(token || '').toLowerCase().replace('_', '')
  const hard = isHardSide(state)
  const bayou = hasTrait(ALL_CARDS[locationOf(state, inv?.location)?.originalCode
    || locationOf(state, inv?.location)?.code], 'Bayou')
  const rougarou = rougarouInPlay(state)
  const here = rougarou && rougarou.location === inv?.location
  const connected = rougarou && (locationOf(state, inv?.location)?.connections || []).includes(rougarou.location)
  if (face === 'skull') {
    if (bayou) return { delta: hard ? -6 : -4 }
    return { delta: hard ? -3 : -2 }
  }
  if (face === 'cultist') {
    return { delta: hard ? -3 : -2, drawAnother: Boolean(here) }
  }
  if (face === 'tablet') {
    return { delta: 0, drawAnother: true, onFail: [{ type: 'scenarioToken', token: 'tablet', mode: 'cannotMove' }] }
  }
  if (face === 'elderthing') {
    const attacks = here || (hard && connected)
    return { delta: -4, ...(attacks && rougarou && inv
      ? { onDraw: [{ type: 'scenarioToken', token: 'elderthing', mode: 'attack', enemyId: rougarou.id, seat: inv.seat }] }
      : {}) }
  }
  return null
}

export function applyTokenEffect(state, inv, effect = {}, api = {}) {
  const mode = effect.mode
  if (mode === 'cannotMove') {
    setFlag(state, 'rougarouCannotMove', { round: state.round, seat: inv?.seat ?? null })
    info(api, '🪨 [tablet]：本轮结束前你不能移动。')
    return true
  }
  if (mode === 'attack') {
    const enemy = (state.enemies || []).find(item => item.id === effect.enemyId)
    if (enemy) safeCall(api, 'attack', enemy, inv)
    return true
  }
  return false
}

export function tokenMeanings() {
  return SCENARIO_TEXT.tokens
}

export function moveError(state, inv, location) {
  void inv
  void location
  const blocked = flagValue(state, 'rougarouCannotMove')
  if (blocked && blocked.round === state.round) return '本轮结束前不能移动（[tablet]）'
  return null
}

export function roundEnded(state) {
  if (flagValue(state, 'rougarouCannotMove')) delete flagsFor(state).rougarouCannotMove
  return false
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
export function resolution(state, key, events = null, api = {}) {
  void events
  const infoApi = api?.info ? api : api?.api || {}
  const finalKey = String(key)
  const effects = []
  if (finalKey === 'resolution1' || finalKey === 'noResolution') {
    effects.push({ record: { theRougarouContinuesToHauntTheBayou: true } })
    info(infoApi, '结局 1：记录「狼人继续在河口出没」；每位调查员获得胜利区经验。')
  } else if (finalKey === 'resolution2') {
    effects.push({ record: { theRougarouIsDestroyed: true } })
    effects.push({ removeStoryCard: CURSE_WEAKNESS_CODE })
    effects.push({ storyCard: LADY_ESPIRIT_CODE })
    info(infoApi, '结局 2：记录「狼人已被消灭，诅咒解除」；移除牌组中的狼人诅咒弱点；可选把埃斯普利女士加入牌组。')
  } else if (finalKey === 'resolution3') {
    effects.push({ record: { theRougarouEscapedAndYouEmbracedTheCurse: true } })
    effects.push({ storyCard: MONSTROUS_TRANSFORMATION_CODE })
    info(infoApi, '结局 3：记录「狼人逃走，你拥抱了诅咒」；诅咒持有者把兽性变化加入牌组。')
  }
  return { bonus: 0, award: true, effects, flowData: { resolution: finalKey } }
}

// ---------------------------------------------------------------------------
// 只读投影 / 具名助手
// ---------------------------------------------------------------------------
export function scenarioSummary(state) {
  const rougarou = rougarouInPlay(state)
  return {
    act: currentActCode(state),
    agenda: currentAgendaCode(state),
    piles: flagValue(state, 'rougarouPiles') || null,
    rougarou: rougarou ? { location: rougarou.location, damage: rougarou.damageTaken || 0 } : null,
    tame: tameConditionReport(state),
    remembered: [...(flagValue(state, 'remembered') || [])],
  }
}

export function implementedEntryFlags(code) {
  return entryFlagsOf(code)
}

const leadSeatOf = state => {
  const active = activeInvestigators(state)
  const lead = state.campaign?.leadSeat
  return active.some(inv => inv.seat === lead) ? lead : active[0]?.seat ?? 0
}

export const events = {
  rougarouLocationAction(state, payload = {}, api = {}) {
    const inv = (state.investigators || [])[payload.seat]
    return inv ? performAction(state, inv, { rule: `rougarouLocation:${payload.kind}` }, api) : false
  },
}

export const behavior = {
  id: CHAPTER_ID,
  locationsStartRevealed: true,
  startLocation,
  preScenarioSetup,
  prepareScenario,
  setupLocations,
  locationPlaced,
  afterDeckSetup,
  setupScenario,
  actions,
  performAction,
  actReveal,
  actIndexAfterAdvance,
  agendaReveal,
  checkObjectives,
  spawnLocation,
  canEngageEnemy,
  enemyDamaged,
  enemyDefeated,
  enemyStatModifier,
  enemyAttackedSuccessfully,
  locationLeft,
  turnEnded,
  phaseBegan,
  moveError,
  roundEnded,
  resolveChaosToken,
  applyTokenEffect,
  tokenMeanings,
  resolution,
  events,
  scenarioSummary,
  // 具名助手（测试/验收）
  tameConditionsMet,
  tameConditionReport,
  currentActCode,
  currentAgendaCode,
  rougarouInPlay,
  farthestLocationFromAll,
  fewestClueNonBayouLocation,
  codeOf,
  PILE_TRAITS,
}
