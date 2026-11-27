// 最长一夜（theLongestNight · 10626）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/TheLongestNight.hs（Setup / DoStep / RunMessage）+
//       Scenarios/TheFeastOfHemlockVale/TheLongestNight/Helpers.hs（placeDecoy/placeTrap/Barriers）+
//       Story/Cards/.../BarriersDecoysAndTraps.hs（屏障/诱饵/陷阱的强制结算）+
//       Act|Agenda|Location|Enemy|Treachery/Cards/TheFeastOfHemlockVale/TheLongestNight/*.hs +
//       Campaigns/TheFeastOfHemlockVale/Key.hs（战役记录键）+
//       frontend/src/locales/en/theFeastOfHemlockVale/theLongestNight.json（印刷文本）。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   preScenarioSetup / afterChaosBagSetup → 序章二选一 + 共舞人数分支（记录与混乱标记）
//   setupLocations / locationPlaced / afterDeckSetup / setupEnemies → 地图、病俘、埃阿斯、乌尔辛、
//       敌人牌库、初始工事与线索
//   actions / performAction → 幕的快速工事、农庄、牛奶房/鸡笼的 Fire!、牧场、葡萄园、外围农田、
//       控制埃阿斯
//   doomPlacementReplacement / doomPlaced → 议程「卡牌效果放毁灭 → 改放病俘」「毁灭放到议程后抽敌人牌库」
//   spawnLocation / enemyMoved / enemyAttackModifier / enemyAttackResolved / enemyPhaseEnd →
//       生成方向、葡萄园/牧场、谷仓 +1 伤害、狼形自愈、病俘被围攻
//   enemyStatModifier / locationShroudModifier / enemyDamageAmount / enemyConnections / spawnLocation
//   cluesRemoved → 外围农田「发现最后线索后」的反应
//   checkObjectives / actReveal / agendaReveal / resolution / allResigned → 幕与议程推进、四个结局
//   resolveChaosToken / applyTokenEffect / afterTest → 10626 混乱标记（含「若检定成功」的追加效果）
//   roundEnded → 每轮限制复位
//
// 工事状态：屏障走 `state.scenarioFlags.mechanics.barriers`（引擎 edge-barriers 的同一形状，
// `api.mechanics.barriers` 是写入入口）；诱饵/陷阱走 `mechanics.defenses`（location-defenses.js，
// `scenario.mechanics.defenses = true` 让引擎在敌人进入/关键词移动时自己结算强制效果）。
// 敌人牌库：`api.mechanics.scenarioDecks`（id `enemyDeck`，独立弃牌堆、耗尽时把弃牌堆洗回）。
import { registeredEntry } from '../../../../../src/engine/ability.js'
import {
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, AJAX_CODE, BARRIER_TOKENS_CODE,
  CAPTIVES_CODE, CAPTIVES_HEALTH, DANCE_RECORDS, DIRECTIONS, ENEMY_DAMAGE_CAPPED, ENEMY_DECK,
  ENEMY_HEALS_AFTER_ATTACK, ENEMY_PATROL_TARGET, ENEMY_SPAWN_DIRECTION, ENEMY_SPAWN_FEWEST,
  ENEMY_SPAWN_MOST, FARMHOUSE_ID, FARM_LOCATION_IDS, FIRE_CARDS, FIRE_CODE, LOCATION_ID_BY_CODE,
  INVESTIGATOR_DEFEAT, LOCATIONS, NO_RESOLUTION, OUTER_FIELD_SLOT_BY_DIRECTION, PLAYED_OUTER_FIELD_IDS, RECORD_KEYS,
  REMOVED_OUTER_FIELD_ID, RESOLUTION_KEYS, SCENARIO_TEXT, SET_ASIDE_CARDS, SET_ASIDE_LOCATIONS,
  STORY_CODES, URSINE_CODE, URSINE_HEALTH_PER_INVESTIGATOR, URSINE_VICTORY,
} from './definition.js'
import { doomInPlay, halfDoomInPlay, isHardSide, theLongestNightChaosToken } from './chaos.js'

const CHAPTER_ID = 'theLongestNight'
const ENEMY_DECK_ID = 'enemyDeck'
const MILKHOUSE_CODE = '10631'

const RESOLUTION_RECORD_BY_KEY = Object.freeze({
  resolution1: RECORD_KEYS.captivesSaved,
  resolution2: RECORD_KEYS.captivesLost,
  resolution3: RECORD_KEYS.allCaptivesLost,
  resolution4: RECORD_KEYS.drMarquezHasAPlan,
})
const CODEX_RECORDS = Object.freeze({
  2: { record: 'leahStoodByYou', name: 'Leah Atwood' },
  3: { record: 'simeonStoodByYou', name: 'Simeon Atwood' },
  4: { record: 'williamStoodByYou', name: 'William Hemlock' },
  5: { record: 'riverStoodByYou', name: 'River Hawthorne' },
  6: { record: 'gideonStoodByYou', name: 'Gideon Mizrah' },
  7: { record: 'judithStoodByYou', name: 'Judith Park' },
  8: { record: 'theoStoodByYou', name: 'Theo Peters' },
  theta: { record: null, name: 'Dr. Rosa Marquez' },
  omega: { record: null, name: 'Ajax' },
})

const activeInvestigators = state => (state.investigators || [])
  .filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state.numInvestigators)
  || (state.investigators || []).length || 1
const info = (api, text) => api?.info?.(text)
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const flagsFor = state => (state.scenarioFlags ||= {})
const setFlag = (state, key, value = true) => {
  flagsFor(state)[key] = value
  return value
}
const clearFlag = (state, key) => { delete flagsFor(state)[key] }
// `mechanicState` 的存档形状要求 version:1（mechanic-state.js#validateMechanicState）：
// 无 api 的兜底写入必须建同一份容器，否则读档校验会拒绝。
const mechanicsFor = state => {
  const flags = flagsFor(state)
  const mechanics = flags.mechanics ||= { version: 1 }
  mechanics.version ||= 1
  return mechanics
}
const codeOf = card => String(card?.originalCode || card?.code || '')
const locationById = (state, id) => (state.locations || []).find(loc => loc.id === id) || null
const isLocationCode = (loc, code) => codeOf(loc) === String(code)
// 印刷数值以单卡条目的 flags 为唯一事实源：behavior 按条目声明取值，卡号分支只做兜底。
const entryFlags = card => (card ? registeredEntry(codeOf(card))?.flags : null) || {}
const flagNumber = (flags, key, fallback) => (Number.isFinite(Number(flags[key])) ? Number(flags[key]) : fallback)
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const shuffleList = (list, api) => (typeof api?.shuffle === 'function' ? api.shuffle([...list]) : [...list])
const pick = (api, request, fallback) => {
  if (typeof api?.choose !== 'function' || !request?.options?.length) return fallback
  const answer = api.choose(request)
  return request.options.some(option => option.id === answer) ? answer : fallback
}
const pickOption = (api, request, fallback) => pick(api, request, fallback)

// ---------------------------------------------------------------------------
// 序章：二选一 + 共舞人数分支（记录 + 混乱标记）
// ---------------------------------------------------------------------------

export function danceCount(state) {
  const records = state.campaign?.records || {}
  return DANCE_RECORDS.filter(key => records[key]).length
}

export function introPlan(state, { confront = true } = {}) {
  const dances = danceCount(state)
  const tokens = [confront ? 'tablet' : 'skull']
  const branch = dances >= 2 ? 'danceTwo' : dances === 1 ? 'danceOne' : 'danceNone'
  if (branch === 'danceTwo') tokens.push('cultist')
  else if (branch === 'danceOne') tokens.push('cultist', 'elderthing')
  else tokens.push('elderthing')
  return { confront, dances, branch, tokens, facedAlone: branch === 'danceNone' }
}

/** 把序章标记加进混乱袋（并写进战役袋：印刷「在战役余下时间」）。 */
export function applyIntroTokens(state, api = {}) {
  const tokens = flagsFor(state).theLongestNightIntroTokens
  if (!Array.isArray(tokens) || !tokens.length) return 0
  if (flagsFor(state).theLongestNightIntroTokensApplied) return 0
  setFlag(state, 'theLongestNightIntroTokensApplied', true)
  let added = 0
  for (const token of tokens) {
    if (Array.isArray(state.chaosBag)) state.chaosBag.push(token)
    if (Array.isArray(state.campaign?.chaosBag)) state.campaign.chaosBag.push(token)
    added += 1
  }
  info(api, `序章：混乱袋加入 ${added} 个标记（${tokens.join('、')}）。`)
  return added
}

export function preScenarioSetup(state, events, api = {}) {
  void events
  state.scenarioFlags ||= {}
  const records = recordsFor(state)
  const confront = pickOption(api, {
    kind: 'story', source: CHAPTER_ID, seat: state.campaign?.leadSeat ?? 0,
    prompt: '序章：你们要当面质问瑞秋母亲，还是继续躲藏？',
    options: [
      { id: 'confront', label: SCENARIO_TEXT.introLabels.confront || 'Confront Mother Rachel.' },
      { id: 'keepHidden', label: SCENARIO_TEXT.introLabels.keepHidden || 'Keep hidden.' },
    ],
  }, 'confront') !== 'keepHidden'
  const plan = introPlan(state, { confront })
  setFlag(state, 'theLongestNightIntro', plan.branch)
  setFlag(state, 'theLongestNightConfront', confront)
  setFlag(state, 'theLongestNightDances', plan.dances)
  setFlag(state, 'theLongestNightIntroTokens', plan.tokens)
  if (plan.facedAlone) records[RECORD_KEYS.facedAlone] = true
  // 记录「共舞」人数；若之前已记录 faced alone（重玩/存档）仍按记录结算线索数。
  flagsFor(state).theLongestNightFacedAlone = Boolean(records[RECORD_KEYS.facedAlone] || plan.facedAlone)
  info(api, `最长一夜：${confront ? '当面质问瑞秋母亲' : '继续躲藏'}；共舞居民 ${plan.dances} 人 → ${plan.branch}。`)
  return false
}

export function afterChaosBagSetup(state, api = {}) {
  return applyIntroTokens(state, api)
}

// ---------------------------------------------------------------------------
// 布置：地图、病俘、埃阿斯、乌尔辛、敌人牌库、初始工事与线索
// ---------------------------------------------------------------------------

export function prepareScenario(state, api = {}) {
  state.scenarioFlags ||= {}
  state.scenarioZones ||= {}
  state.storyAssets ||= []
  const actSource = state.scenario?.acts || ACT_STAGES
  const agendaSource = state.scenario?.agendas || AGENDA_STAGES
  const pickStage = (source, code) => {
    if (Array.isArray(source)) return source.find(card => codeOf(card) === code)
    return source?.[1] && codeOf(source[1]) === code ? source[1] : Object.values(source || {})
      .find(card => codeOf(card) === code)
  }
  state.acts = ACT_CODES.map(code => pickStage(actSource, code)).filter(Boolean).map(card => structuredClone(card))
  state.agendas = AGENDA_CODES.map(code => pickStage(agendaSource, code)).filter(Boolean).map(card => structuredClone(card))
  state.actIndex = 0
  state.agendaIndex = 0
  const flags = flagsFor(state)
  flags[RECORD_KEYS.captivesDamage] = Number(flags[RECORD_KEYS.captivesDamage]) || 0
  flags.codexResolved ||= []
  flags.theLongestNightLimits ||= {}
  // 放一边：五张 Fire! 诡计 + 埃阿斯剧情资产；随机移除的外围农田记在 removed/放一边地点。
  state.scenarioZones.setAside = [...SET_ASIDE_CARDS]
  state.scenarioZones.setAsideLocations = [...SET_ASIDE_LOCATIONS]
  state.scenarioZones.removed = [REMOVED_OUTER_FIELD_ID]
  flags.theLongestNightPrepared = true
  return {
    actCodes: [...ACT_CODES], agendaCodes: [...AGENDA_CODES],
    removedLocation: REMOVED_OUTER_FIELD_ID, setAside: [...state.scenarioZones.setAside],
  }
}

/** 参考 Setup 的地点清单：农庄 + 五处 Atwood Farm + 四张仍在场的外围农田。 */
export function setupLocationIds() {
  return [FARMHOUSE_ID, ...FARM_LOCATION_IDS, ...PLAYED_OUTER_FIELD_IDS]
}

export function setupLocations(state, events, helper = {}) {
  void events
  const api = helper.api || { info: text => helper.info?.(state, events, text) }
  prepareScenario(state, api)
  return setupLocationIds()
}

/** 敌人方向 → 当前在场的外围农田地点 id（按格位，其次按坐标）。 */
export function outerFieldAtDirection(state, direction) {
  const slot = OUTER_FIELD_SLOT_BY_DIRECTION[direction]
  const bySlot = (state.locations || []).find(loc => loc.slot === slot)
  if (bySlot) return bySlot.id
  const coords = { west: [-3, 0], east: [2, 0], north: [0, -2], south: [0, 2] }[direction]
  if (!coords) return null
  const found = (state.locations || []).find(loc => Number(loc.x) === coords[0] && Number(loc.y) === coords[1])
  return found?.id || null
}

export function outerFieldsInPlay(state) {
  return (state.locations || []).filter(loc => DIRECTIONS.some(direction =>
    loc.slot ? loc.slot === OUTER_FIELD_SLOT_BY_DIRECTION[direction]
      : loc.traits?.some(trait => String(trait).toLowerCase() === 'field')))
}

export function locationPlaced(state, location, api = {}, seat = null) {
  void seat
  const flags = entryFlags(location)
  // 谷仓：「揭示时把放在一边的埃阿斯放到本地点（codex Ω）」；本关地点开场即揭示，
  // 因此入场时结算（条目 flags.setAsideAsset / codexOnReveal 是声明读点）。
  if (flags.setAsideAsset === AJAX_CODE || flags.codexOnReveal === 'omega') {
    enterAjax(state, location.id, api)
  }
  safeCall(api, 'setLocationFlag', location.id, 'slot', location.slot || null)
}

/** 谷仓揭示：把放一边的埃阿斯放到谷仓（[codex] Ω）。 */
export function enterAjax(state, locationId, api = {}) {
  if (flagsFor(state).theLongestNightAjaxEntered) return false
  if ((state.storyAssets || []).some(asset => codeOf(asset) === AJAX_CODE)) return false
  setFlag(state, 'theLongestNightAjaxEntered', true)
  setFlag(state, 'theLongestNightAjaxLocation', locationId)
  let asset = null
  if (typeof api.storyAsset === 'function') asset = api.storyAsset(AJAX_CODE, locationId)
  if (!asset) {
    state.storyAssets ||= []
    asset = { id: `story-${AJAX_CODE}`, code: AJAX_CODE, originalCode: AJAX_CODE, name: '埃阿斯',
      location: locationId, controllerSeat: null, exhausted: false, damage: 0, horror: 0 }
    state.storyAssets.push(asset)
  }
  info(api, `谷仓揭示：埃阿斯进入「${locationById(state, locationId)?.name || locationId}」（codex Ω）。`)
  codexEntry(state, state.campaign?.leadSeat ?? 0, 'omega', api)
  return true
}

export function captivesAsset(state) {
  return (state.storyAssets || []).find(asset => codeOf(asset) === CAPTIVES_CODE) || null
}

export function captivesInPlay(state) {
  return Boolean(captivesAsset(state))
}

export function placeCaptives(state, api = {}) {
  if (captivesAsset(state)) return captivesAsset(state)
  let asset = null
  if (typeof api.storyAsset === 'function') asset = api.storyAsset(CAPTIVES_CODE, FARMHOUSE_ID)
  if (!asset) {
    state.storyAssets ||= []
    asset = { id: `story-${CAPTIVES_CODE}`, code: CAPTIVES_CODE, originalCode: CAPTIVES_CODE, name: '病俘',
      location: FARMHOUSE_ID, health: CAPTIVES_HEALTH, damage: 0, doom: 0, controllerSeat: null }
    state.storyAssets.push(asset)
  }
  setFlag(state, 'theLongestNightCaptivesInPlay', true)
  info(api, '病俘剧情支援入场，放在农庄。')
  return asset
}

export function captivesDamage(state) {
  const flag = Number(flagsFor(state)[RECORD_KEYS.captivesDamage]) || 0
  const asset = captivesAsset(state)
  return Math.max(flag, Number(asset?.damage) || 0)
}

/** 对病俘造成伤害（剧情标记是唯一读点；达到 10 点 → 结局 3）。 */
export function damageCaptives(state, amount, api = {}) {
  const total = Math.max(0, Number(amount) || 0)
  if (!total) return 0
  const next = captivesDamage(state) + total
  setFlag(state, RECORD_KEYS.captivesDamage, next)
  const asset = captivesAsset(state)
  if (asset) asset.damage = next
  info(api, `病俘受到 ${total} 点伤害（累计 ${next}/${CAPTIVES_HEALTH}）。`)
  if (next >= CAPTIVES_HEALTH && !flagsFor(state).theLongestNightCaptivesDefeated) {
    setFlag(state, 'theLongestNightCaptivesDefeated', true)
    info(api, '病俘被击败：直接进入结局 3。')
    if (typeof api.finish === 'function') api.finish('resolution3')
    else state.resolution = 'resolution3'
  }
  return next
}

export function healCaptives(state, amount, api = {}) {
  const total = Math.max(0, Number(amount) || 0)
  const next = Math.max(0, captivesDamage(state) - total)
  setFlag(state, RECORD_KEYS.captivesDamage, next)
  const asset = captivesAsset(state)
  if (asset) asset.damage = next
  if (total) info(api, `病俘被治愈 ${total} 点伤害（剩余 ${next}/${CAPTIVES_HEALTH}）。`)
  return next
}

/** 参考 Setup：乌尔辛在「西面外围农田」生成。 */
export function spawnUrsine(state, api = {}, spawnEnemy = null) {
  if ((state.enemies || []).some(enemy => codeOf(enemy) === URSINE_CODE)) {
    return state.enemies.find(enemy => codeOf(enemy) === URSINE_CODE)
  }
  const west = outerFieldAtDirection(state, 'west') || FARMHOUSE_ID
  let enemy = null
  if (typeof spawnEnemy === 'function') enemy = spawnEnemy(state, URSINE_CODE, west, null, true)
  else if (typeof api.spawn === 'function') enemy = api.spawn(URSINE_CODE, west)
  if (!enemy) enemy = spawnScenarioEnemy(state, URSINE_CODE, west)
  info(api, `乌尔辛混种在「${locationById(state, west)?.name || west}」生成。`)
  if (state.campaign?.records?.[RECORD_KEYS.bearWounded]) {
    const amount = 2 * investigatorCount(state)
    enemy.damageTaken = (Number(enemy.damageTaken) || 0) + amount
    enemy.exhausted = true
    info(api, `战役记录「熊受伤了」：乌尔辛受到 ${amount} 点伤害并横置。`)
  }
  return enemy
}

/** 单测/无 api 时的敌人实例（与引擎敌人实例同形）。 */
export function spawnScenarioEnemy(state, code, locationId, extra = {}) {
  state.enemies ||= []
  const def = state.scenario?.enemies?.[code] || LOCATIONS_ENEMY_FALLBACK(code)
  const existing = state.enemies.filter(enemy => codeOf(enemy) === code).length
  const enemy = {
    id: `enemy-${code}-${existing + 1}`, code, originalCode: code,
    name: def?.name || code, location: locationId,
    fight: def?.fight ?? null, evade: def?.evade ?? null, health: def?.health ?? null,
    damage: def?.damage || 0, horror: def?.horror || 0,
    traits: [...(def?.traits || [])], exhausted: false, engagedSeat: null, damageTaken: 0, doom: 0,
    ...extra,
  }
  state.enemies.push(enemy)
  return enemy
}

function LOCATIONS_ENEMY_FALLBACK(code) {
  // 只在内联测试状态缺少 scenario 定义时使用；正式状态从 encounterDefinitions 读到同一份数据。
  const base = { traits: ['Creature', 'Monster', 'Mutated'] }
  const table = {
    '10643': { ...base, fight: 5, evade: 3, health: 6, damage: 3, horror: 2 },
    '10644a': { ...base, fight: 2, evade: 4, health: 3, damage: 0, horror: 1 },
    '10645a': { ...base, fight: 3, evade: 1, health: 4, damage: 1, horror: 1 },
    '10646': { ...base, fight: 3, evade: 3, health: 5, damage: 1, horror: 2 },
    '10647a': { ...base, fight: 2, evade: 2, health: 3, damage: 2, horror: 0 },
    '10648': { ...base, fight: 3, evade: 2, health: 2, damage: 0, horror: 2 },
  }
  return table[code] || { ...base, fight: 3, evade: 3, health: 3, damage: 1, horror: 1 }
}

// ---------------------------------------------------------------------------
// 敌人牌库（The Enemy Deck）：独立牌库/弃牌堆；耗尽时把弃牌堆洗回
// ---------------------------------------------------------------------------

export function enemyDeckPiles(state) {
  return state.scenarioFlags?.mechanics?.scenarioDecks?.[ENEMY_DECK_ID] || null
}

export function enemyDeckSize(state) {
  return enemyDeckPiles(state)?.deck?.length || 0
}

export function enemyDeckDiscard(state) {
  return [...(enemyDeckPiles(state)?.discard || [])]
}

export function buildEnemyDeck(state, api = {}) {
  const decks = api?.mechanics?.scenarioDecks
  if (typeof decks?.initialize === 'function') {
    if (enemyDeckPiles(state)) return enemyDeckPiles(state).deck.length
    return decks.initialize(ENEMY_DECK_ID, [...ENEMY_DECK])
  }
  const mechanics = mechanicsFor(state)
  mechanics.scenarioDecks ||= {}
  mechanics.scenarioDecks[ENEMY_DECK_ID] ||= { deck: [...ENEMY_DECK], discard: [], removed: [] }
  return mechanics.scenarioDecks[ENEMY_DECK_ID].deck.length
}

export function discardToEnemyDeck(state, codes, api = {}) {
  const list = (Array.isArray(codes) ? codes : [codes]).filter(Boolean).map(String)
  if (!list.length) return 0
  const decks = api?.mechanics?.scenarioDecks
  if (typeof decks?.discard === 'function' && enemyDeckPiles(state)) {
    for (const code of list) decks.discard(ENEMY_DECK_ID, code)
    return list.length
  }
  const piles = enemyDeckPiles(state)
  if (!piles) return 0
  piles.discard.push(...list)
  return list.length
}

/** 抽敌人牌库顶（空则洗回弃牌堆）；Gideon 法典：下一次抽牌改为弃掉。 */
export function drawFromEnemyDeck(state, seat, api = {}) {
  const piles = enemyDeckPiles(state)
  if (!piles) buildEnemyDeck(state, api)
  const deck = enemyDeckPiles(state)
  if (!deck) return null
  if (flagsFor(state).theLongestNightDiscardNextEnemyDraw) {
    clearFlag(state, 'theLongestNightDiscardNextEnemyDraw')
    const code = takeEnemyDeckTop(state, api)
    if (!code) return null
    discardToEnemyDeck(state, code, api)
    info(api, `吉迪恩法典：本次敌人牌库抽牌改为弃掉「${cardLabel(code)}」。`)
    return null
  }
  const decks = api?.mechanics?.scenarioDecks
  if (typeof decks?.draw === 'function') {
    const drawn = decks.draw(ENEMY_DECK_ID, seat, { recycle: true })
    if (drawn) info(api, `第 ${state.round} 回合神话阶段：${state.investigators?.[seat]?.name || `座位 ${seat}`} 抽取敌人牌库「${cardLabel(drawn)}」。`)
    return drawn || null
  }
  const code = takeEnemyDeckTop(state, api)
  if (!code) return null
  info(api, `敌人牌库抽到「${cardLabel(code)}」。`)
  return code
}

function takeEnemyDeckTop(state, api = {}) {
  const piles = enemyDeckPiles(state)
  if (!piles) return null
  const decks = api?.mechanics?.scenarioDecks
  if (typeof decks?.take === 'function') {
    const taken = decks.take(ENEMY_DECK_ID, 1)
    return taken?.[0] ?? null
  }
  if (!piles.deck.length) {
    if (!piles.discard.length) return null
    piles.deck = shuffleList(piles.discard, api)
    piles.discard = []
    info(api, '敌人牌库耗尽：把敌人弃牌堆洗回敌人牌库。')
  }
  return piles.deck.pop() || null
}

const cardLabel = code => (LOCATIONS_LABELS[code] || code)
const LOCATIONS_LABELS = Object.freeze({
  '10643': '类熊混种', '10644a': '易羽混种', '10644b': '易羽混种', '10644c': '易羽混种',
  '10645a': '狼形混种', '10645b': '狼形混种', '10645c': '狼形混种', '10646': '山羊混种',
  '10647a': '马状混种', '10647b': '马状混种', '10647c': '马状混种', '10648': '蠕滑混种',
})

// ---------------------------------------------------------------------------
// 工事：屏障（格边计数）与诱饵/陷阱（地点标记）
// ---------------------------------------------------------------------------

const sortedPair = (a, b) => [String(a), String(b)].sort()
export const barrierEdgeKey = (a, b) => sortedPair(a, b).join('|')

export function barrierEdges(state) {
  const barriers = state.scenarioFlags?.mechanics?.barriers
  return Array.isArray(barriers) ? barriers : []
}

export function barrierCount(state, a, b) {
  if (!a || !b) return 0
  const key = barrierEdgeKey(a, b)
  return barrierEdges(state).filter(edge => barrierEdgeKey(edge.a, edge.b) === key)
    .reduce((sum, edge) => sum + (Number(edge.count) || 0), 0)
}

export function barrierCountAt(state, locationId) {
  return barrierEdges(state)
    .filter(edge => edge.a === locationId || edge.b === locationId)
    .reduce((sum, edge) => sum + (Number(edge.count) || 0), 0)
}

/** 屏障计数变更：优先走引擎 `api.mechanics.barriers.change`，否则写同一份状态形状。 */
export function changeBarrierCount(state, api, a, b, amount) {
  if (!a || !b || a === b) return false
  const barriers = api?.mechanics?.barriers
  if (typeof barriers?.change === 'function') {
    const result = barriers.change(a, b, amount)
    if (result !== false) return true
  }
  const mechanics = mechanicsFor(state)
  mechanics.barriers ||= []
  const key = barrierEdgeKey(a, b)
  const index = mechanics.barriers.findIndex(edge => barrierEdgeKey(edge.a, edge.b) === key)
  const current = index < 0 ? 0 : Number(mechanics.barriers[index].count) || 0
  const next = Math.max(0, current + Number(amount))
  if (next === 0) {
    if (index >= 0) mechanics.barriers.splice(index, 1)
    return true
  }
  const [first, second] = sortedPair(a, b)
  if (index < 0) mechanics.barriers.push({ a: first, b: second, count: next })
  else mechanics.barriers[index].count = next
  return true
}

/** 「在你的地点放置 1 个屏障」：选择相邻地点，放在两者之间。 */
export function placeBarrierAt(state, seat, locationId, api = {}) {
  const location = locationById(state, locationId)
  if (!location) return false
  const connected = (location.connections || []).filter(id => locationById(state, id))
  if (!connected.length) {
    info(api, `「${location.name}」没有连接地点，无法放置屏障。`)
    return false
  }
  const target = pickOption(api, {
    kind: 'location', source: 'barrier', seat,
    prompt: `在「${location.name}」与哪个相邻地点之间放置屏障？`,
    options: connected.map(id => ({ id, label: locationById(state, id).name })),
  }, connected[0])
  changeBarrierCount(state, api, locationId, target, 1)
  info(api, `在「${location.name}」与「${locationById(state, target)?.name}」之间放置 1 个屏障。`)
  return true
}

export function defenseStore(state, create = false) {
  const mechanics = create ? mechanicsFor(state) : (state.scenarioFlags?.mechanics || null)
  if (!mechanics) return null
  if (!mechanics.defenses && !create) return null
  if (!mechanics.defenses) mechanics.defenses = { decoy: [], trap: [], cannotReady: {} }
  return mechanics.defenses
}

export function decoyAt(state, locationId) {
  return Boolean(defenseStore(state)?.decoy?.includes(locationId))
}

export function trapAt(state, locationId) {
  return Boolean(defenseStore(state)?.trap?.includes(locationId))
}

/** 农庄不能有诱饵/陷阱；同名地点各限 1 个。 */
export function canPlaceDefenseAt(state, type, locationId) {
  const location = locationById(state, locationId)
  if (!location || !['decoy', 'trap'].includes(type)) return false
  const flags = entryFlags(location)
  if (flags.farmhouse === true || location.noLocationDefenses === true) return false
  const store = defenseStore(state)
  return !(store?.[type] || []).includes(locationId)
}

/**
 * 放置诱饵/陷阱。牛奶房（10631）的反应「改为放在相邻地点」在此生效；
 * 写入优先走 `api.mechanics.defenses.place`（引擎 location-defenses.js）。
 */
export function placeDefense(state, type, locationId, seat = 0, api = {}) {
  if (!['decoy', 'trap'].includes(type)) return false
  let target = locationId
  const location = locationById(state, target)
  if (!location) return false
  if (isLocationCode(location, MILKHOUSE_CODE)) {
    const destinations = (location.connections || [])
      .filter(id => canPlaceDefenseAt(state, type, id))
    if (destinations.length) {
      const redirect = pickOption(api, {
        kind: 'location', source: 'milkhouse', seat,
        prompt: `牛奶房：把${type === 'decoy' ? '诱饵' : '陷阱'}改放到哪个相邻地点？`,
        options: destinations.map(id => ({ id, label: locationById(state, id).name })),
      }, destinations[0])
      target = redirect
      info(api, `牛奶房：${type === 'decoy' ? '诱饵' : '陷阱'}改放到「${locationById(state, target)?.name}」。`)
    }
  }
  if (!canPlaceDefenseAt(state, type, target)) return false
  const defenses = api?.mechanics?.defenses
  if (typeof defenses?.place === 'function') {
    if (defenses.place(type, target) === false) return false
  } else {
    defenseStore(state, true)[type].push(target)
  }
  info(api, `在「${locationById(state, target)?.name}」放置 1 个${type === 'decoy' ? '诱饵' : '陷阱'}。`)
  return true
}

export function removeDecoy(state, locationId) {
  const store = defenseStore(state)
  if (!store) return false
  const index = store.decoy.indexOf(locationId)
  if (index < 0) return false
  store.decoy.splice(index, 1)
  return true
}

export function removeTrap(state, locationId) {
  const store = defenseStore(state)
  if (!store) return false
  const index = store.trap.indexOf(locationId)
  if (index < 0) return false
  store.trap.splice(index, 1)
  return true
}

/** 移除你所在地点的 1 个屏障/诱饵/陷阱（[elder_thing]）。 */
export function removeDefenseAt(state, seat, locationId, api = {}) {
  const location = locationById(state, locationId)
  if (!location) return false
  const options = []
  if (decoyAt(state, locationId)) options.push({ id: 'decoy', label: '移除诱饵' })
  if (trapAt(state, locationId)) options.push({ id: 'trap', label: '移除陷阱' })
  const edges = barrierEdges(state).filter(edge => edge.a === locationId || edge.b === locationId)
  if (edges.length) options.push({ id: 'barrier', label: '移除 1 个屏障' })
  if (!options.length) {
    info(api, `「${location.name}」没有屏障、诱饵或陷阱。`)
    return false
  }
  const choice = pickOption(api, {
    kind: 'effect', source: 'elderthing', seat,
    prompt: '移除你所在地点的 1 个屏障、诱饵或陷阱。', options,
  }, options[0].id)
  if (choice === 'decoy') return removeDecoy(state, locationId)
  if (choice === 'trap') return removeTrap(state, locationId)
  const edge = edges.length === 1 ? edges[0] : edges[Number(pickOption(api, {
    kind: 'effect', source: 'elderthing', seat, prompt: '移除哪条通道上的屏障？',
    options: edges.map((item, index) => ({ id: String(index),
      label: `${locationById(state, item.a)?.name || item.a} — ${locationById(state, item.b)?.name || item.b}` })),
  }, '0'))]
  if (!edge) return false
  changeBarrierCount(state, api, edge.a, edge.b, -1)
  return true
}

/** 初始工事：团队共放置 1 个诱饵、1 个陷阱、1 个屏障。 */
export function placeInitialDefenses(state, api = {}) {
  const seat = state.campaign?.leadSeat ?? 0
  const candidates = (state.locations || []).filter(loc => entryFlags(loc).farmhouse !== true)
  const barriers = []
  const barrierLocations = (state.locations || []).filter(loc => (loc.connections || []).length)
  const barrierLocation = pickOption(api, {
    kind: 'location', source: 'setupBarrier', seat, prompt: '初始工事：在哪处地点放置屏障？',
    options: barrierLocations.map(loc => ({ id: loc.id, label: loc.name })),
  }, barrierLocations[0]?.id)
  if (barrierLocation) barriers.push(barrierLocation)
  const decoyLocation = pickOption(api, {
    kind: 'location', source: 'setupDecoy', seat, prompt: '初始工事：在哪处地点放置诱饵？',
    options: candidates.map(loc => ({ id: loc.id, label: loc.name })),
  }, candidates[0]?.id)
  const trapCandidates = candidates.filter(loc => loc.id !== decoyLocation)
  const trapLocation = pickOption(api, {
    kind: 'location', source: 'setupTrap', seat, prompt: '初始工事：在哪处地点放置陷阱？',
    options: trapCandidates.map(loc => ({ id: loc.id, label: loc.name })),
  }, trapCandidates[0]?.id)
  if (barrierLocation) placeBarrierAt(state, seat, barrierLocation, api)
  if (decoyLocation) placeDefense(state, 'decoy', decoyLocation, seat, api)
  if (trapLocation) placeDefense(state, 'trap', trapLocation, seat, api)
  return { barrier: barriers, decoy: decoyLocation ? [decoyLocation] : [], trap: trapLocation ? [trapLocation] : [] }
}

/** 参考 Setup：在农庄放病俘，并按战役记录给每位调查员 2 或 3 个线索。 */
export function grantSetupClues(state, api = {}) {
  const facedAlone = flagsFor(state).theLongestNightFacedAlone === true
    || Boolean(state.campaign?.records?.[RECORD_KEYS.facedAlone])
  const amount = facedAlone ? 3 : 2
  for (const inv of activeInvestigators(state)) {
    if (typeof api.gainClues === 'function') api.gainClues(inv.seat, amount)
    else inv.clues = (inv.clues || 0) + amount
  }
  info(api, `布置：每位调查员获得 ${amount} 个线索（${facedAlone ? '独自面对' : '有居民相助'}）。`)
  return { amount, facedAlone }
}

export function setupScenario(state, api = {}) {
  const report = prepareScenario(state, api)
  state.locations = []
  const placedIds = []
  for (const id of setupLocationIds()) {
    const placed = placeLocalLocation(state, id, api)
    if (placed) placedIds.push(id)
  }
  if (!(state.storyAssets || []).some(asset => codeOf(asset) === BARRIER_TOKENS_CODE)) {
    state.storyAssets ||= []
    if (typeof api.storyAsset === 'function') api.storyAsset(BARRIER_TOKENS_CODE, null)
    else state.storyAssets.push({ id: `story-${BARRIER_TOKENS_CODE}`, code: BARRIER_TOKENS_CODE,
      originalCode: BARRIER_TOKENS_CODE, name: '屏障、诱饵和陷阱', location: null, global: true })
  } else {
    safeCall(api, 'storyAsset', BARRIER_TOKENS_CODE, null)
  }
  buildEnemyDeck(state, api)
  placeCaptives(state, api)
  spawnUrsine(state, api)
  const defenses = placeInitialDefenses(state, api)
  grantSetupClues(state, api)
  applyIntroTokens(state, api)
  info(api, `最长一夜布置完成：${placedIds.length} 处地点、敌人牌库 ${enemyDeckSize(state)} 张、`
    + `病俘位于农庄、乌尔辛在西面外围农田。`)
  return { ...report, placedIds, defenses, enemyDeckSize: enemyDeckSize(state) }
}

function placeLocalLocation(state, id, api = {}) {
  if (locationById(state, id)) return locationById(state, id)
  const def = state.scenario?.locations?.[id] || LOCATIONS[id]
  if (!def) return null
  const clues = def.cluesFixed
    ? def.cluesFixed === true ? def.clues || 0 : def.cluesFixed
    : (def.cluesPerInvestigator != null ? def.cluesPerInvestigator : def.clues || 0) * investigatorCount(state)
  const location = { ...structuredClone(def), id, revealed: true, clues, maxClues: clues,
    doom: 0, damage: 0, horror: 0, resources: 0 }
  state.locations ||= []
  state.locations.push(location)
  locationPlaced(state, location, api)
  return location
}

export function afterDeckSetup(state, events, helper = {}) {
  void events
  const api = helper.api || { info: text => helper.info?.(state, events, text) }
  buildEnemyDeck(state, api)
  placeCaptives(state, api)
  if (!(state.storyAssets || []).some(asset => codeOf(asset) === BARRIER_TOKENS_CODE)
    && typeof api.storyAsset === 'function') {
    api.storyAsset(BARRIER_TOKENS_CODE, null)
  }
  spawnUrsine(state, api)
  const defenses = flagsFor(state).theLongestNightInitialDefenses
    ? null : placeInitialDefenses(state, api)
  setFlag(state, 'theLongestNightInitialDefenses', true)
  grantSetupClues(state, api)
  info(api, `最长一夜：敌人牌库 ${enemyDeckSize(state)} 张；初始工事 1 诱饵/1 陷阱/1 屏障。`)
  return { enemyDeckSize: enemyDeckSize(state), defenses }
}

export function setupEnemies(state, events, helper = {}) {
  void events
  // 乌尔辛在西面外围农田生成（参考 Setup「Put the Ursine Hybrid enemy into play at the west
  // Outer Fields location」）；helper.spawnEnemy 是引擎注入的真实生成入口。
  const api = helper.api || { info: text => helper.info?.(state, events, text) }
  return spawnUrsine(state, api, helper.spawnEnemy)
}

// ---------------------------------------------------------------------------
// 行动
// ---------------------------------------------------------------------------

function limitKey(state, key, scope) {
  return `${scope}:${key}:${scope === 'round' ? Number(state.round) || 1 : 'game'}`
}

export function limitUsed(state, key, scope = 'round') {
  const limits = flagsFor(state).theLongestNightLimits ||= {}
  return limits[limitKey(state, key, scope)] === true
}

export function markLimit(state, key, scope = 'round') {
  const limits = flagsFor(state).theLongestNightLimits ||= {}
  limits[limitKey(state, key, scope)] = true
}

const FIRE_LIMIT = locationId => `fire:${locationId}`

export function hasSetAsideFire(state) {
  return (state.scenarioZones?.setAside || []).includes(FIRE_CODE)
}

export function fireAction(state, inv, location) {
  if (entryFlags(location).fireActionPerRound !== true) return null
  if (!hasSetAsideFire(state)) {
    return { action: 'scenarioAction', rule: 'theLongestNightFireDraw', actions: 1,
      reason: '放在一边的「着火了！」已经用完' }
  }
  if (limitUsed(state, FIRE_LIMIT(location.id), 'round')) {
    return { action: 'scenarioAction', rule: 'theLongestNightFireDraw', actions: 1,
      reason: '本地点本轮的「着火了！」已经抽过' }
  }
  return { action: 'scenarioAction', rule: 'theLongestNightFireDraw', actions: 1,
    label: `抽 1 张放在一边的「着火了！」；把另 1 张洗入遭遇牌库（每轮一次）` }
}

export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned || state.status !== 'playing') return []
  const moves = []
  const location = locationById(state, inv.location)
  if (!location) return moves
  // 地点能力按单卡条目的 flags 分派（印刷数值唯一事实源）。
  const flags = entryFlags(location)

  // 幕 10629：快速工事（花费 1 线索）。
  if ((inv.clues || 0) >= 1) {
    const connected = (location.connections || []).length > 0
    const decoyOk = canPlaceDefenseAt(state, 'decoy', location.id)
    const trapOk = canPlaceDefenseAt(state, 'trap', location.id)
    if (connected || decoyOk || trapOk) {
      moves.push({ action: 'scenarioAction', rule: 'theLongestNightPlaceDefense', actions: 0,
        label: '（快速，花费 1 线索）在你的地点放置 1 个屏障、诱饵或陷阱' })
    }
  } else {
    moves.push({ action: 'scenarioAction', rule: 'theLongestNightPlaceDefense', actions: 0,
      reason: '放置工事需要 1 个线索' })
  }

  if (flags.farmhouse === true) {
    const cost = flagNumber(flags, 'fastMoveCostPerInvestigator', 1) * investigatorCount(state)
    if ((inv.resources || 0) >= cost && (location.connections || []).length) {
      for (const destination of location.connections) {
        const target = locationById(state, destination)
        if (!target) continue
        moves.push({ action: 'scenarioAction', rule: 'theLongestNightFarmhouseMove', actions: 0,
          destination, label: `（快速，花费 ${cost} 资源）从农庄移动到「${target.name}」` })
      }
    }
    if (limitUsed(state, 'farmhouseClue', 'round')) {
      moves.push({ action: 'scenarioAction', rule: 'theLongestNightFarmhouseClue', actions: 1,
        reason: '农庄的获得线索行动本轮已由团队使用' })
    } else {
      moves.push({ action: 'scenarioAction', rule: 'theLongestNightFarmhouseClue', actions: 1,
        label: '（行动，团队每轮一次）从供应堆获得 1 个线索' })
    }
  }

  const fire = fireAction(state, inv, location)
  if (fire) moves.push(fire)

  if (flags.fastMoveWithTrap === true && trapAt(state, location.id)) {
    for (const destination of location.connections || []) {
      const target = locationById(state, destination)
      if (!target) continue
      moves.push({ action: 'scenarioAction', rule: 'theLongestNightPastureMove', actions: 0,
        destination, label: `（快速）牧场上有陷阱：移动到「${target.name}」` })
    }
  }

  if (flags.fastEngagePerTurn === true && location.revealed) {
    const enemies = (state.enemies || []).filter(enemy => enemy.location === location.id)
    if (limitUsed(state, 'vineyardEngage', 'turn')) {
      moves.push({ action: 'scenarioAction', rule: 'theLongestNightVineyardEngage', actions: 0,
        reason: '葡萄园的快速交战本回合已使用' })
    } else {
      for (const enemy of enemies) {
        moves.push({ action: 'scenarioAction', rule: 'theLongestNightVineyardEngage', actions: 0,
          enemyId: enemy.id, label: `（快速）与葡萄园的「${enemy.name}」交战（每回合一次）` })
      }
    }
  }

  if (flags.moveEnemyActionGroupLimit === 'game') {
    const enemies = (state.enemies || []).filter(enemy => enemy.location === location.id)
    if (limitUsed(state, `moveEnemy:${location.id}`, 'game')) {
      moves.push({ action: 'scenarioAction', rule: 'theLongestNightMoveEnemy', actions: 1,
        reason: '本场游戏已经使用过此地的「移动敌人」能力' })
    } else if (enemies.length) {
      moves.push({ action: 'scenarioAction', rule: 'theLongestNightMoveEnemy', actions: 1,
        label: '（行动，团队每场游戏一次）把一个敌人移动到连接地点' })
    }
  }

  if (flagNumber(flags, 'peekEnemyDeckPerInvestigator', 0) > 0) {
    moves.push(limitUsed(state, `peek:${location.id}`, 'game')
      ? { action: 'scenarioAction', rule: 'theLongestNightEnemyDeckPeek', actions: 0,
        reason: '本场游戏已经查看过敌人牌库顶' }
      : { action: 'scenarioAction', rule: 'theLongestNightEnemyDeckPeek', actions: 0,
        label: `（快速，团队每场游戏一次）查看敌人牌库顶 ${investigatorCount(state)} 张并弃掉任意数量` })
  }

  if (flags.moveBarrierPerTurn === true) {
    moves.push(limitUsed(state, 'moveBarrier', 'turn')
      ? { action: 'scenarioAction', rule: 'theLongestNightMoveBarrier', actions: 0,
        reason: '移动屏障本回合已使用' }
      : { action: 'scenarioAction', rule: 'theLongestNightMoveBarrier', actions: 0,
        label: '（快速，每回合一次）把任意地点的一个屏障移动到另一个地点' })
  }

  if (flags.moveTrapPerTurn === true) {
    moves.push(limitUsed(state, 'moveTrap', 'turn')
      ? { action: 'scenarioAction', rule: 'theLongestNightMoveTrap', actions: 0,
        reason: '移动陷阱本回合已使用' }
      : { action: 'scenarioAction', rule: 'theLongestNightMoveTrap', actions: 0,
        label: '（快速，每回合一次）把任意地点的一个陷阱移动到另一个地点' })
  }

  if (flags.moveDecoyPerTurn === true) {
    moves.push(limitUsed(state, 'moveDecoy', 'turn')
      ? { action: 'scenarioAction', rule: 'theLongestNightMoveDecoy', actions: 0,
        reason: '移动诱饵本回合已使用' }
      : { action: 'scenarioAction', rule: 'theLongestNightMoveDecoy', actions: 0,
        label: '（快速，每回合一次）把任意地点的一个诱饵移动到另一个地点' })
  }

  const ajax = captivesAjax(state)
  if (ajax && ajax.location === inv.location && ajax.controllerSeat == null) {
    moves.push({ action: 'scenarioAction', rule: 'theLongestNightTakeAjax', actions: 1,
      label: '（行动）控制你所在地点的埃阿斯' })
  }
  return moves
}

function captivesAjax(state) {
  return (state.storyAssets || []).find(asset => codeOf(asset) === AJAX_CODE) || null
}

function payClue(inv, api) {
  if (typeof api?.spendClues === 'function') return api.spendClues(inv.seat, 1)
  if ((inv.clues || 0) < 1) return false
  inv.clues -= 1
  if (typeof api?.syncClues === 'function') api.syncClues()
  return true
}

function payResources(inv, amount, api) {
  if ((inv.resources || 0) < amount) return false
  if (typeof api?.loseResources === 'function') api.loseResources(inv.seat, amount)
  else inv.resources -= amount
  return true
}

function moveInvestigatorTo(state, inv, destination, api) {
  if (typeof api?.moveInvestigator === 'function') return api.moveInvestigator(inv.seat, destination)
  inv.location = destination
  return true
}

export function performAction(state, inv, move, api = {}) {
  if (!inv || !move) return false
  const location = locationById(state, inv.location)
  const rule = String(move.rule || '')
  switch (rule) {
    case 'theLongestNightPlaceDefense': {
      if ((inv.clues || 0) < 1) return false
      const options = []
      if ((location?.connections || []).length) options.push({ id: 'barrier', label: '放置屏障' })
      if (canPlaceDefenseAt(state, 'decoy', inv.location)) options.push({ id: 'decoy', label: '放置诱饵' })
      if (canPlaceDefenseAt(state, 'trap', inv.location)) options.push({ id: 'trap', label: '放置陷阱' })
      if (!options.length) return false
      const choice = pickOption(api, {
        kind: 'effect', source: '10629', seat: inv.seat,
        prompt: '花费 1 个线索：放置 1 个屏障、诱饵或陷阱。', options,
      }, options[0].id)
      if (!payClue(inv, api)) return false
      const seat = inv.seat
      if (choice === 'barrier') return placeBarrierAt(state, seat, inv.location, api)
      return placeDefense(state, choice, inv.location, seat, api)
    }
    case 'theLongestNightFarmhouseMove': {
      const cost = investigatorCount(state)
      if (!move.destination || !payResources(inv, cost, api)) return false
      info(api, `农庄：支付 ${cost} 资源快速移动。`)
      return moveInvestigatorTo(state, inv, move.destination, api) !== false
    }
    case 'theLongestNightFarmhouseClue': {
      markLimit(state, 'farmhouseClue', 'round')
      if (typeof api.gainClues === 'function') api.gainClues(inv.seat, 1)
      else inv.clues = (inv.clues || 0) + 1
      info(api, '农庄：获得 1 个线索（团队每轮一次）。')
      return true
    }
    case 'theLongestNightPastureMove': {
      if (!move.destination || !trapAt(state, inv.location)) return false
      return moveInvestigatorTo(state, inv, move.destination, api) !== false
    }
    case 'theLongestNightVineyardEngage': {
      const enemy = (state.enemies || []).find(item => item.id === move.enemyId)
      if (!enemy || enemy.location !== inv.location) return false
      markLimit(state, 'vineyardEngage', 'turn')
      enemy.engagedSeat = inv.seat
      if (!(inv.engaged ||= []).includes(enemy.id)) inv.engaged.push(enemy.id)
      info(api, `葡萄园：${inv.name} 与「${enemy.name}」交战。`)
      return true
    }
    case 'theLongestNightFireDraw':
      return drawSetAsideFire(state, inv, location, api)
    case 'theLongestNightEnemyDeckPeek':
      return peekEnemyDeck(state, inv, api)
    case 'theLongestNightMoveEnemy':
      return moveEnemyFromLocation(state, inv, location, api)
    case 'theLongestNightMoveBarrier':
      return moveDefenseBetweenLocations(state, inv, 'barrier', api)
    case 'theLongestNightMoveTrap':
      return moveDefenseBetweenLocations(state, inv, 'trap', api)
    case 'theLongestNightMoveDecoy':
      return moveDefenseBetweenLocations(state, inv, 'decoy', api)
    case 'theLongestNightTakeAjax': {
      const ajax = captivesAjax(state)
      if (!ajax || ajax.location !== inv.location) return false
      return takeControlOfAjax(state, inv.seat, api)
    }
    default:
      return false
  }
}

function drawSetAsideFire(state, inv, location, api) {
  if (!location || !hasSetAsideFire(state) || limitUsed(state, FIRE_LIMIT(location.id), 'round')) return false
  markLimit(state, FIRE_LIMIT(location.id), 'round')
  const setAside = state.scenarioZones.setAside
  const index = setAside.indexOf(FIRE_CODE)
  if (index < 0) return false
  setAside.splice(index, 1)
  if (typeof api.drawEncounter === 'function') api.drawEncounter(inv.seat, { code: FIRE_CODE })
  else {
    state.encounterDiscard ||= []
    state.encounterDiscard.push(FIRE_CODE)
  }
  const shuffleIndex = setAside.indexOf(FIRE_CODE)
  if (shuffleIndex >= 0) {
    setAside.splice(shuffleIndex, 1)
    if (typeof api.shuffleIntoEncounterDeck === 'function') api.shuffleIntoEncounterDeck([FIRE_CODE])
    else (state.encounterDeck ||= []).push(FIRE_CODE)
  }
  info(api, `${inv.name} 抽取放在一边的「着火了！」；另一张已洗入遭遇牌库。`)
  return true
}

function peekEnemyDeck(state, inv, api) {
  if (limitUsed(state, `peek:${inv.location}`, 'game')) return false
  const count = investigatorCount(state)
  const decks = api?.mechanics?.scenarioDecks
  const top = typeof decks?.take === 'function'
    ? decks.take(ENEMY_DECK_ID, count) || []
    : takeEnemyDeckCardsFallback(state, count, api)
  markLimit(state, `peek:${inv.location}`, 'game')
  if (!top.length) {
    info(api, '敌人牌库是空的，没有可查看的牌。')
    return true
  }
  const kept = []
  for (const code of top) {
    const choice = pickOption(api, {
      kind: 'card', source: '10637', seat: inv.seat,
      prompt: `敌人牌库顶「${cardLabel(code)}」：弃掉还是放回牌库顶？`,
      options: [{ id: 'top', label: '放回牌库顶' }, { id: 'discard', label: '弃掉' }],
    }, 'top')
    if (choice === 'discard') discardToEnemyDeck(state, code, api)
    else kept.push(code)
  }
  if (kept.length) {
    if (typeof decks?.put === 'function') decks.put(ENEMY_DECK_ID, kept, { top: true })
    else {
      const piles = enemyDeckPiles(state)
      if (piles) piles.deck.push(...[...kept].reverse())
    }
  }
  info(api, `查看敌人牌库顶 ${top.length} 张：弃掉 ${top.length - kept.length} 张，其余放回牌库顶。`)
  return true
}

function takeEnemyDeckCardsFallback(state, count, api) {
  const cards = []
  for (let index = 0; index < count; index += 1) {
    const code = takeEnemyDeckTop(state, api)
    if (!code) break
    cards.push(code)
  }
  return cards
}

function moveEnemyFromLocation(state, inv, location, api) {
  if (!location || limitUsed(state, `moveEnemy:${location.id}`, 'game')) return false
  const enemies = (state.enemies || []).filter(enemy => enemy.location === location.id)
  if (!enemies.length) return false
  const enemyId = pickOption(api, {
    kind: 'enemy', source: '10636', seat: inv.seat, prompt: '把哪个敌人移走？',
    options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
  }, enemies[0].id)
  const enemy = enemies.find(item => item.id === enemyId) || enemies[0]
  const destinations = (location.connections || []).filter(id => locationById(state, id))
  if (!destinations.length) return false
  const destination = pickOption(api, {
    kind: 'location', source: '10636', seat: inv.seat, prompt: '移动到哪个连接地点？',
    options: destinations.map(id => ({ id, label: locationById(state, id).name })),
  }, destinations[0])
  if (typeof api.moveEnemy === 'function') api.moveEnemy(enemy, destination)
  else enemy.location = destination
  markLimit(state, `moveEnemy:${location.id}`, 'game')
  info(api, `外围农田：把「${enemy.name}」移动到「${locationById(state, destination)?.name}」。`)
  return true
}

function moveDefenseBetweenLocations(state, inv, type, api) {
  if (limitUsed(state, `move:${type}`, 'turn')) return false
  const store = defenseStore(state)
  const existing = type === 'barrier'
    ? barrierEdges(state).map(edge => (edge.a === inv.location ? edge.b : edge.a))
    : (store?.[type] || [])
  if (!existing.length) {
    info(api, `场上没有可移动的${type === 'barrier' ? '屏障' : type === 'trap' ? '陷阱' : '诱饵'}。`)
    return false
  }
  const from = pickOption(api, {
    kind: 'location', source: 'outerFields', seat: inv.seat,
    prompt: `从哪个地点移走${type === 'barrier' ? '屏障' : type === 'trap' ? '陷阱' : '诱饵'}？`,
    options: [...new Set(existing)].map(id => ({ id, label: locationById(state, id)?.name || id })),
  }, existing[0])
  const candidates = (state.locations || []).filter(loc => loc.id !== from)
  const destination = pickOption(api, {
    kind: 'location', source: 'outerFields', seat: inv.seat,
    prompt: '移动到哪个地点？',
    options: candidates.map(loc => ({ id: loc.id, label: loc.name })),
  }, candidates[0]?.id)
  if (!destination) return false
  if (type === 'barrier') {
    const edge = barrierEdges(state).find(item => item.a === from || item.b === from)
    if (!edge) return false
    changeBarrierCount(state, api, edge.a, edge.b, -1)
    placeBarrierAt(state, inv.seat, destination, api)
  } else {
    if (!canPlaceDefenseAt(state, type, destination)) return false
    if (type === 'decoy') removeDecoy(state, from)
    else removeTrap(state, from)
    placeDefense(state, type, destination, inv.seat, api)
  }
  markLimit(state, `move:${type}`, 'turn')
  return true
}

export function takeControlOfAjax(state, seat, api = {}) {
  const ajax = captivesAjax(state)
  const inv = state.investigators?.[seat]
  if (!ajax || !inv || ajax.controllerSeat != null) return false
  if (api.claimUncontrolledStoryAsset) {
    return Boolean(api.claimUncontrolledStoryAsset(seat, ajax, { ignoreLocation: true }))
  }
  state.storyAssets.splice(state.storyAssets.indexOf(ajax), 1)
  delete ajax.location
  ajax.controllerSeat = seat
  ajax.ownerSeat = seat
  inv.assets.push(ajax)
  info(api, `${inv.name} 控制埃阿斯（不占盟友槽）。`)
  return true
}

// ---------------------------------------------------------------------------
// 毁灭：议程强制（改放病俘 / 放到议程后抽敌人牌库）
// ---------------------------------------------------------------------------

export function doomPlacementReplacement(state, amount, api = {}, context = {}) {
  const source = context?.source || 'effect'
  if (source === 'mythos') return false
  const captives = captivesAsset(state)
  if (!captives) return false
  const total = Math.max(0, Number(amount) || 0)
  if (!total) return false
  if (typeof api.placeDoomOnCard === 'function') api.placeDoomOnCard(captives, total)
  else captives.doom = (Number(captives.doom) || 0) + total
  info(api, `猛攻：卡牌效果的 ${total} 点毁灭改放在病俘上。`)
  return true
}

export function doomPlaced(state, payload = {}, api = {}) {
  if (!payload?.agenda) return false
  const amount = Math.max(0, Number(payload.amount) || 0)
  if (!amount) return false
  let drawn = 0
  for (const inv of activeInvestigators(state).sort((a, b) => a.seat - b.seat)) {
    if (drawFromEnemyDeck(state, inv.seat, api)) drawn += 1
  }
  info(api, `猛攻：议程放置 ${amount} 点毁灭 → 每位调查员抽取敌人牌库顶（实际抽到 ${drawn} 张）。`)
  return true
}

// ---------------------------------------------------------------------------
// 敌人：生成方向、关键词、伤害与攻击修正
// ---------------------------------------------------------------------------

export function spawnLocation(state, code, locationId, engagedSeat, api = {}, options = {}) {
  void engagedSeat
  void api
  void options
  const key = String(code)
  if (ENEMY_SPAWN_FEWEST.includes(key)) return fewestOuterField(state) || locationId
  if (ENEMY_SPAWN_MOST.includes(key)) return mostOuterField(state) || locationId
  const direction = ENEMY_SPAWN_DIRECTION[key]
  if (!direction) return locationId
  return outerFieldAtDirection(state, direction) || locationId
}

function outerFieldEnemyCount(state, locationId) {
  return (state.enemies || []).filter(enemy => enemy.location === locationId).length
}

export function fewestOuterField(state) {
  const fields = outerFieldsInPlay(state)
  if (!fields.length) return null
  return [...fields].sort((a, b) => outerFieldEnemyCount(state, a.id) - outerFieldEnemyCount(state, b.id))[0].id
}

export function mostOuterField(state) {
  const fields = outerFieldsInPlay(state)
  if (!fields.length) return null
  return [...fields].sort((a, b) => outerFieldEnemyCount(state, b.id) - outerFieldEnemyCount(state, a.id))[0].id
}

export function spawnOverrides() {
  // 生成方向由 spawnLocation 钩子按当前在场的外围农田格位计算（地点洗牌后仍正确）；
  // 这里声明「没有静态生成点覆盖」。
  return EMPTY_SPAWN_OVERRIDES
}
const EMPTY_SPAWN_OVERRIDES = Object.freeze({})

export function enemyMoved(state, enemy, previous, api = {}, seat = null) {
  void seat
  const location = locationById(state, enemy.location)
  if (!location) return false
  const flags = entryFlags(location)
  // 葡萄园：「敌人进入时治愈 1 点伤害」（条目 flags.healEnteringEnemy）。
  const heal = flagNumber(flags, 'healEnteringEnemy', 0)
  if (heal > 0) healEnemyDamage(enemy, heal, api, `${location.name}：敌人进入时治愈 ${heal} 点伤害。`)
  // 牧场：「没有屏障时再结算该关键词」（条目 flags.keywordRepriseWithoutBarriers）。
  if (flags.keywordRepriseWithoutBarriers === true && previous !== location.id) {
    pastureKeywordReprise(state, enemy, api)
  }
  return false
}

/** 牧场：重整且未交战的敌人通过关键词进入、且牧场没有屏障时，再结算该关键词一次。 */
export function pastureKeywordReprise(state, enemy, api = {}) {
  if (!enemy || enemy.exhausted || enemy.engagedSeat != null) return false
  const location = locationById(state, enemy.location)
  if (!location || entryFlags(location).keywordRepriseWithoutBarriers !== true) return false
  if (barrierCountAt(state, location.id) > 0) return false
  const entry = registeredEntry(enemy.originalCode || enemy.code)
  const hunter = entry?.flags?.hunter === true || /\bHunter\./.test(entry?.text || '')
  const patrol = entry?.enemyRule?.patrolTarget != null
  if (hunter && typeof api.resolveHunterMove === 'function') {
    api.resolveHunterMove(enemy)
    info(api, '牧场：没有屏障，猎手关键词再结算一次。')
    return true
  }
  if (patrol) {
    setFlag(state, 'theLongestNightPastureReprise', { enemyId: enemy.id, round: state.round })
    info(api, '牧场：没有屏障，巡逻关键词将在敌人阶段再结算一次。')
    return true
  }
  return false
}

export function enemyAttackModifier(state, enemy, inv) {
  void inv
  const location = locationById(state, enemy.location)
  if (!location) return {}
  // 谷仓：「谷仓的敌人 +1 伤害值」（条目 flags.enemyDamageModifier 是唯一事实源）。
  const bonus = flagNumber(entryFlags(location), 'enemyDamageModifier', 0)
  return bonus ? { damage: bonus, horror: 0 } : {}
}

export function enemyAttackResolved(state, enemy, inv, api = {}) {
  void state
  void inv
  const healAfterAttack = flagNumber(entryFlags(enemy), 'healAfterAttack', 0)
  if (healAfterAttack > 0 || ENEMY_HEALS_AFTER_ATTACK.includes(codeOf(enemy))) {
    healEnemyDamage(enemy, healAfterAttack || 1, api, `「${enemy.name}」攻击后治愈 ${healAfterAttack || 1} 点伤害。`)
  }
  return false
}

function healEnemyDamage(enemy, amount, api = {}, message = '') {
  const value = Math.min(Math.max(0, Number(enemy.damageTaken) || 0), Math.max(0, Number(amount) || 0))
  if (!value) return 0
  enemy.damageTaken = Math.max(0, (Number(enemy.damageTaken) || 0) - value)
  if (typeof api.healEnemy === 'function') api.healEnemy(enemy, value)
  if (message) info(api, message)
  return value
}

/** 敌人受到的伤害修正：伤害降为 1 / 无视 Fire! 的伤害（条目 flags 为唯一事实源）。 */
export function enemyDamageAmount(state, enemy, amount, api = {}, seat = null, source = null) {
  void state
  void api
  void seat
  const flags = entryFlags(enemy)
  const sourceCode = typeof source === 'string' ? source : source?.code || source?.originalCode || null
  if (flags.ignoreFireDamage === true && sourceCode === FIRE_CODE) return 0
  const capped = flagNumber(flags, 'damageCappedAt', ENEMY_DAMAGE_CAPPED.includes(codeOf(enemy)) ? 1 : 0)
  if (capped > 0) return Math.min(capped, Math.max(0, Number(amount) || 0))
  return undefined
}

export function enemyStatModifier(state, enemy, stat, inv = null) {
  void inv
  const flags = entryFlags(enemy)
  if (stat === 'health') {
    const perInvestigator = flagNumber(flags, 'healthPerInvestigator',
      codeOf(enemy) === URSINE_CODE ? URSINE_HEALTH_PER_INVESTIGATOR : 0)
    if (perInvestigator > 0) return perInvestigator * investigatorCount(state)
    return 0
  }
  const location = locationById(state, enemy.location)
  if (!location) return 0
  const locationFlags = entryFlags(location)
  if (stat === 'fight') return flagNumber(locationFlags, 'enemyFightModifier', 0)
  if (stat === 'evade') return flagNumber(locationFlags, 'enemyEvadeModifier', 0)
  return 0
}

/** 乌尔辛移动时，每个 [[Field]] 地点视为彼此连接。 */
export function enemyConnections(state, enemy, location) {
  if (!entryFlags(enemy).hunter && codeOf(enemy) !== URSINE_CODE) return []
  if (!location?.traits?.some(trait => String(trait).toLowerCase() === 'field')) return []
  return (state.locations || [])
    .filter(loc => loc.id !== location.id && loc.traits?.some(trait => String(trait).toLowerCase() === 'field'))
    .map(loc => loc.id)
}

export function locationShroudModifier(state, location, inv = null) {
  void inv
  if (!location) return 0
  const modifier = flagNumber(entryFlags(location), 'decoyShroudModifier', 0)
  if (modifier && decoyAt(state, location.id)) return modifier
  return 0
}

export function enemyPhaseEnd(state, api = {}) {
  const captives = captivesAsset(state)
  if (!captives) return false
  const attackers = (state.enemies || []).filter(enemy => enemy.location === FARMHOUSE_ID
    && !enemy.exhausted && enemy.engagedSeat == null && !enemy.defeated)
  if (!attackers.length) return false
  const damage = attackers.reduce((sum, enemy) => sum + (Number(enemy.damage) || 0) + (Number(enemy.horror) || 0), 0)
  info(api, `敌军阶段结束：农庄的 ${attackers.length} 个重整敌人攻击病俘（${damage} 点伤害）。`)
  damageCaptives(state, damage, api)
  return true
}

// ---------------------------------------------------------------------------
// 地点线索被取光后的反应（外围农田）
// ---------------------------------------------------------------------------

export function cluesRemoved(state, location, amount, api = {}) {
  void amount
  if (!location || Number(location.clues) > 0) return false
  const flags = entryFlags(location)
  const seat = state.campaign?.leadSeat ?? 0
  // 外围农田的「发现最后线索后」反应由条目 flags 声明（印刷数值唯一事实源）。
  const heal = flagNumber(flags, 'healCaptivesOnLastClue', 0)
  if (heal > 0) {
    if (limitUsed(state, `lastClueHeal:${location.id}`, 'game')) return false
    markLimit(state, `lastClueHeal:${location.id}`, 'game')
    healCaptives(state, heal, api)
    return true
  }
  if (flags.barrierOnLastClue === true) {
    if (limitUsed(state, `lastClueBarrier:${location.id}`, 'game')) return false
    markLimit(state, `lastClueBarrier:${location.id}`, 'game')
    return placeBarrierAt(state, seat, location.id, api)
  }
  if (flags.trapOnLastClue === true) {
    if (limitUsed(state, `lastClueTrap:${location.id}`, 'game')) return false
    markLimit(state, `lastClueTrap:${location.id}`, 'game')
    return placeDefense(state, 'trap', location.id, seat, api)
  }
  if (flags.decoyOnLastClue === true) {
    if (limitUsed(state, `lastClueDecoy:${location.id}`, 'game')) return false
    markLimit(state, `lastClueDecoy:${location.id}`, 'game')
    return placeDefense(state, 'decoy', location.id, seat, api)
  }
  return false
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------

export function resolveChaosToken(state, inv, token) {
  return theLongestNightChaosToken(state, inv, token)
}

export function chaosTokenValue(state, tokenFace, inv) {
  void inv
  return theLongestNightChaosToken(state, null, tokenFace)?.delta ?? null
}

export function applyTokenEffect(state, inv, effect, api = {}) {
  if (!inv || inv.defeated || inv.resigned || !effect) return false
  const mode = effect.mode || 'always'
  if (effect.token === 'cultist') {
    if (mode === 'success') {
      setFlag(state, 'theLongestNightCultistBarrierPending', true)
      info(api, '[cultist]：若本次检定成功，将放置 1 个屏障。')
      return true
    }
    placeBarrierAt(state, inv.seat, inv.location, api)
    return true
  }
  if (effect.token === 'tablet') {
    applyNearestEnemyAttack(state, inv, api)
    return true
  }
  if (effect.token === 'elderthing') {
    removeDefenseAt(state, inv.seat, inv.location, api)
    return true
  }
  return false
}

/** 「若检定成功」的标记追加效果（[cultist] 困难/专家）。 */
export function afterTest(state, inv, result, api = {}, context = {}) {
  void context
  if (!flagsFor(state).theLongestNightCultistBarrierPending) return false
  clearFlag(state, 'theLongestNightCultistBarrierPending')
  if (!result?.success || !inv) return false
  placeBarrierAt(state, inv.seat, inv.location, api)
  return true
}

function distanceBetween(state, from, to) {
  if (!from || !to) return Infinity
  if (from === to) return 0
  const seen = new Set([from])
  let frontier = [from]
  let distance = 0
  while (frontier.length) {
    distance += 1
    const next = []
    for (const id of frontier) {
      for (const neighbor of locationById(state, id)?.connections || []) {
        if (seen.has(neighbor)) continue
        if (neighbor === to) return distance
        seen.add(neighbor)
        next.push(neighbor)
      }
    }
    frontier = next
  }
  return Infinity
}

export function nearestEnemy(state, inv) {
  const enemies = (state.enemies || []).filter(enemy => !enemy.defeated)
  if (!enemies.length) return null
  return [...enemies].sort((a, b) =>
    distanceBetween(state, inv.location, a.location) - distanceBetween(state, inv.location, b.location))[0]
}

/** [tablet]：最近的敌人重整、移动并攻击，如同敌军阶段。 */
export function applyNearestEnemyAttack(state, inv, api = {}) {
  const enemies = (state.enemies || []).filter(enemy => !enemy.defeated)
  if (!enemies.length) {
    info(api, '[tablet]：场上没有敌人。')
    return false
  }
  const nearest = nearestEnemy(state, inv)
  const candidates = enemies.filter(enemy =>
    distanceBetween(state, inv.location, enemy.location) === distanceBetween(state, inv.location, nearest.location))
  const chosenId = pickOption(api, {
    kind: 'enemy', source: 'tablet', seat: inv.seat, prompt: '[tablet]：选择最近的敌人。',
    options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
  }, nearest.id)
  const enemy = enemies.find(item => item.id === chosenId) || nearest
  enemy.exhausted = false
  safeCall(api, 'readyEnemy', enemy)
  if (enemy.location !== inv.location) {
    if (typeof api.moveEnemyToward === 'function') api.moveEnemyToward(enemy, inv.location)
    else if ((locationById(state, enemy.location)?.connections || []).includes(inv.location)) {
      enemy.location = inv.location
    }
  }
  if (enemy.location === inv.location) {
    if (typeof api.attack === 'function') api.attack(enemy, inv)
    else {
      enemy.engagedSeat = inv.seat
      inv.damage = (inv.damage || 0) + (Number(enemy.damage) || 0)
      inv.horror = (inv.horror || 0) + (Number(enemy.horror) || 0)
    }
  }
  info(api, `[tablet]：「${enemy.name}」重整、移动并攻击 ${inv.name}。`)
  return true
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------

export function checkObjectives(state, api = {}) {
  void state
  void api
  // 幕面「不要推进场景，直到你受到指示」：没有自动目标。
  return false
}

export function actReveal(state, act, api = {}) {
  const code = codeOf(act)
  if (!ACT_CODES.includes(code)) return false
  const damage = captivesDamage(state)
  const key = damage <= 4 ? 'resolution1' : 'resolution2'
  setFlag(state, RECORD_KEYS.captivesDamage, damage)
  info(api, `幕 1 背面（九死一生）：病俘上有 ${damage} 点伤害（≤4 → 结局 1，否则结局 2）。`)
  if (typeof api.finish === 'function') api.finish(key)
  else state.resolution = key
  return true
}

export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  if (!AGENDA_CODES.includes(code)) return false
  const residents = residentAssets(state)
  const options = []
  if (activeInvestigators(state).length) options.push({ id: 'mentalTrauma', label: '每位未被击败的调查员承受 1 点精神创伤' })
  if (residents.length) options.push({ id: 'sacrificeResident', label: '选择一位居民代替你们（划掉该居民）' })
  const choice = options.length
    ? pickOption(api, {
      kind: 'agenda', source: AGENDA_CODES[0], seat: state.campaign?.leadSeat ?? 0,
      prompt: '最后的牺牲：选择一项。', options,
    }, 'mentalTrauma')
    : 'mentalTrauma'
  if (choice === 'sacrificeResident' && residents.length) {
    const assetId = pickOption(api, {
      kind: 'asset', source: AGENDA_CODES[0], seat: state.campaign?.leadSeat ?? 0,
      prompt: '选择被牺牲的居民。', options: residents.map(asset => ({ id: asset.id, label: asset.name || asset.code })),
    }, residents[0].id)
    const asset = residents.find(item => item.id === assetId) || residents[0]
    sacrificeResident(state, asset, api)
  } else {
    for (const inv of activeInvestigators(state)) {
      if (typeof api.addTrauma === 'function') api.addTrauma(inv.seat, 'mental', 1)
      else {
        inv.trauma ||= { physical: 0, mental: 0 }
        inv.trauma.mental = (Number(inv.trauma.mental) || 0) + 1
      }
    }
    info(api, '猛攻背面：每位未被击败的调查员承受 1 点精神创伤。')
  }
  info(api, '猛攻背面：推进幕（由议程效果推进）。')
  if (typeof api.advanceAct === 'function') api.advanceAct()
  return true
}

function residentAssets(state) {
  const traitOf = asset => (asset.traits || []).map(trait => String(trait).toLowerCase())
  return [...(state.storyAssets || [])]
    .filter(asset => traitOf(asset).includes('resident') && asset.controllerSeat != null)
    .concat((state.investigators || []).flatMap(inv => (inv.assets || [])
      .filter(asset => traitOf(asset).includes('resident'))))
}

function sacrificeResident(state, asset, api = {}) {
  const code = codeOf(asset)
  setFlag(state, 'theLongestNightSacrificedResident', code)
  const records = recordsFor(state)
  records.aResidentWasSacrificed = true
  records.sacrificedResident = code
  const storyIndex = (state.storyAssets || []).findIndex(item => item.id === asset.id)
  if (storyIndex >= 0) state.storyAssets.splice(storyIndex, 1)
  else {
    const owner = (state.investigators || []).find(inv => (inv.assets || []).some(item => item.id === asset.id))
    if (owner) {
      const index = owner.assets.findIndex(item => item.id === asset.id)
      if (index >= 0) owner.assets.splice(index, 1)
    }
  }
  info(api, `最后一夜：居民「${asset.name || code}」代替调查员牺牲（划掉该居民）。`)
  return true
}

// ---------------------------------------------------------------------------
// 法典（[codex] 2–8 / Θ / Ω）
// ---------------------------------------------------------------------------

export function codexEntry(state, seat, entry, api = {}) {
  const key = String(entry)
  const info_ = CODEX_RECORDS[key]
  if (!info_) return false
  const inv = state.investigators?.[seat]
  if (!inv) return false
  const flags = flagsFor(state)
  flags.codexResolved ||= []
  if (flags.codexResolved.includes(key)) return false
  flags.codexResolved.push(key)
  if (info_.record) recordsFor(state)[info_.record] = true
  info(api, `法典（${info_.name}）：记录「${info_.name} 站在你这边」。`)
  if (key === '2') {
    const target = nearestEnemy(state, inv)
    if (target) {
      if (typeof api.damageEnemy === 'function') api.damageEnemy(target.id, 3, seat)
      else target.damageTaken = (Number(target.damageTaken) || 0) + 3
      info(api, `法典 2：对最近的敌人「${target.name}」造成 3 点伤害。`)
    }
  } else if (key === '3') {
    const destinations = (state.locations || []).filter(loc => canPlaceDefenseAt(state, 'decoy', loc.id))
    const target = pickOption(api, {
      kind: 'location', source: 'codex3', seat, prompt: '法典 3：在任意地点放置 1 个诱饵。',
      options: destinations.map(loc => ({ id: loc.id, label: loc.name })),
    }, destinations[0]?.id)
    if (target) placeDefense(state, 'decoy', target, seat, api)
  } else if (key === '4') {
    for (const other of activeInvestigators(state)) {
      if (typeof api.gainClues === 'function') api.gainClues(other.seat, 1)
      else other.clues = (other.clues || 0) + 1
    }
  } else if (key === '5') {
    const enemies = (state.enemies || []).filter(enemy => !enemy.elite)
    const enemyId = pickOption(api, {
      kind: 'enemy', source: 'codex5', seat, prompt: '法典 5：选择一个非精英敌人。',
      options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
    }, enemies[0]?.id)
    const enemy = enemies.find(item => item.id === enemyId)
    const destination = pickOption(api, {
      kind: 'location', source: 'codex5', seat, prompt: '法典 5：把它移动到任意地点。',
      options: (state.locations || []).map(loc => ({ id: loc.id, label: loc.name })),
    }, state.locations?.[0]?.id)
    if (enemy && destination) {
      if (typeof api.moveEnemy === 'function') api.moveEnemy(enemy, destination)
      else enemy.location = destination
    }
  } else if (key === '6') {
    setFlag(state, 'theLongestNightDiscardNextEnemyDraw', true)
  } else if (key === '7') {
    const destinations = (state.locations || []).filter(loc => canPlaceDefenseAt(state, 'trap', loc.id))
    const target = pickOption(api, {
      kind: 'location', source: 'codex7', seat, prompt: '法典 7：在任意地点放置 1 个陷阱。',
      options: destinations.map(loc => ({ id: loc.id, label: loc.name })),
    }, destinations[0]?.id)
    if (target) placeDefense(state, 'trap', target, seat, api)
  } else if (key === '8') {
    moveDefenseFromHere(state, inv, api)
  } else if (key === 'theta') {
    placeBarrierAt(state, seat, inv.location, api)
    placeBarrierAt(state, seat, inv.location, api)
  } else if (key === 'omega') {
    takeControlOfAjax(state, seat, api)
  }
  return true
}

function moveDefenseFromHere(state, inv, api) {
  const options = []
  if (decoyAt(state, inv.location)) options.push({ id: 'decoy', label: '移动诱饵' })
  if (trapAt(state, inv.location)) options.push({ id: 'trap', label: '移动陷阱' })
  if (barrierCountAt(state, inv.location) > 0) options.push({ id: 'barrier', label: '移动屏障' })
  if (!options.length) return false
  const choice = pickOption(api, {
    kind: 'effect', source: 'codex8', seat: inv.seat,
    prompt: '法典 8：移动 1 个屏障、诱饵或陷阱，然后解除交战并移动。', options,
  }, options[0].id)
  const destination = pickOption(api, {
    kind: 'location', source: 'codex8', seat: inv.seat, prompt: '法典 8：目标地点。',
    options: (state.locations || []).map(loc => ({ id: loc.id, label: loc.name })),
  }, state.locations?.[0]?.id)
  if (!destination) return false
  if (choice === 'barrier') {
    const edge = barrierEdges(state).find(item => item.a === inv.location || item.b === inv.location)
    if (edge) {
      changeBarrierCount(state, api, edge.a, edge.b, -1)
      placeBarrierAt(state, inv.seat, destination, api)
    }
  } else {
    const from = inv.location
    if (choice === 'decoy') removeDecoy(state, from)
    else removeTrap(state, from)
    placeDefense(state, choice, destination, inv.seat, api)
  }
  for (const enemyId of [...(inv.engaged || [])]) {
    const enemy = (state.enemies || []).find(item => item.id === enemyId)
    if (enemy) {
      if (typeof api.disengage === 'function') api.disengage(enemy)
      enemy.engagedSeat = null
    }
  }
  inv.engaged = []
  moveInvestigatorTo(state, inv, destination, api)
  return true
}

// ---------------------------------------------------------------------------
// 回合结束 / 结局
// ---------------------------------------------------------------------------

export function roundEnded(state, api = {}) {
  void api
  const flags = flagsFor(state)
  flags.theLongestNightLimits = {}
  return true
}

/** 全部调查员撤退/败退：无结局 → 结局 3。 */
export function allResigned(state, api = {}) {
  info(api, '所有调查员都撤退了：直接结算结局 3。')
  if (typeof api.finish === 'function') api.finish('resolution3')
  else state.resolution = 'resolution3'
  return true
}

export function victoryXp(state) {
  const display = state.victoryDisplay || []
  const total = display.reduce((sum, entry) => sum + (Number(entry?.victory ?? entry?.points ?? entry) || 0), 0)
  return Math.max(0, Number(state.victory) || 0) || Math.max(0, total)
}

export function resolutionBonus(key, damage) {
  if (key === 'resolution1') return damage === 0 ? 5 : damage <= 2 ? 4 : 3
  if (key === 'resolution2') return damage <= 6 ? 3 : damage <= 8 ? 2 : 1
  return 0
}

function applyResolution4(state, api = {}) {
  const records = recordsFor(state)
  records[RECORD_KEYS.drMarquezHasAPlan] = true
  records[RECORD_KEYS.areasSurveyedSouthernFields] = true
  const ajax = captivesAjax(state)
  if ((ajax && ajax.controllerSeat != null) || state.investigators.some(inv =>
    inv.assets.some(asset => codeOf(asset) === AJAX_CODE))) records.ajaxJoinedTheInvestigators = true
  records.drMarquezJoinedTheInvestigators = true
  const bonus = victoryXp(state)
  info(api, `结局 4：记录「马奎兹医生有计划」并勾选「南部农田」；胜利显示区经验 ${bonus}。`)
  return bonus
}

function storyResolutionKey(state, key) {
  if (key !== NO_RESOLUTION) return key
  return state.investigators.some(inv => inv.defeated && !inv.resigned)
    ? INVESTIGATOR_DEFEAT : 'resolution3'
}

export function resolution(state, key, events = [], api = {}) {
  void events
  const records = recordsFor(state)
  const damage = captivesDamage(state)
  let finalKey = storyResolutionKey(state, String(key || NO_RESOLUTION))
  if (![...RESOLUTION_KEYS, INVESTIGATOR_DEFEAT].includes(finalKey)) finalKey = 'resolution3'
  let bonus = 0
  if (finalKey === INVESTIGATOR_DEFEAT) {
    for (const inv of state.investigators) {
      if (!inv.defeated || inv.resigned) continue
      inv.killed = true
      const record = state.campaign?.investigators?.[inv.seat]
      if (record) record.status = 'killed'
    }
    records.investigatorDefeat = true
    info(api, '调查员败北：被击败的调查员被吞噬（死亡）。')
    if (state.investigators.every(inv => inv.killed)) {
      if (state.campaign) state.campaign.failed = true
      records[RECORD_KEYS.resolution] = finalKey
      return { award: false, bonus: 0, resolution: finalKey }
    }
    if (key === INVESTIGATOR_DEFEAT) return { award: true, bonus: 0, resolution: finalKey }
    finalKey = 'resolution3'
  }
  if (finalKey === 'resolution1' || finalKey === 'resolution2') {
    records[RESOLUTION_RECORD_BY_KEY[finalKey]] = true
    bonus = resolutionBonus(finalKey, damage)
    info(api, `${finalKey}：病俘伤害 ${damage} → 奖励经验 ${bonus}；随后进入结局 4。`)
    bonus += applyResolution4(state, api)
    finalKey = 'resolution4'
  } else if (finalKey === 'resolution3') {
    records[RESOLUTION_RECORD_BY_KEY.resolution3] = true
    for (const inv of activeInvestigators(state)) {
      if (typeof api.addBasicWeakness === 'function') api.addBasicWeakness(inv.seat, ['madness'])
      else (inv.deck ||= []).push('01006')
    }
    info(api, '结局 3：所有病俘遇难；每位调查员获得 1 张随机基础疯狂弱点；随后进入结局 4。')
    bonus += applyResolution4(state, api)
    finalKey = 'resolution4'
  } else {
    bonus += applyResolution4(state, api)
  }
  records[RECORD_KEYS.resolution] = finalKey
  setFlag(state, RECORD_KEYS.captivesDamage, damage)
  return { award: true, bonus, resolution: finalKey, captivesDamage: damage }
}

export function scenarioResolution(state, resolutionKey = 'resolution1', api = {}) {
  const result = resolution(state, resolutionKey, [], api)
  return {
    resolution: recordsFor(state)[RECORD_KEYS.resolution],
    captivesDamage: captivesDamage(state),
    bonus: result.bonus,
  }
}

// ---------------------------------------------------------------------------
// 诡计事件的唯一结算入口（单卡条目的 encounterResolve → api.resolveScenarioEvent）
// ---------------------------------------------------------------------------

/** 无尽夜晚（10649 显现）：三选一（移除 1 毁灭 / 病俘受 2 伤害 / 3 直接伤害+3 直接恐惧）。 */
export function endlessNightEvent(state, payload = {}, api = {}) {
  const seat = Number(payload.seat) || 0
  const inv = state.investigators?.[seat]
  if (!inv || inv.defeated || inv.resigned) return false
  const options = []
  if ((Number(state.doom) || 0) > 0) options.push({ id: 'doom', label: '移除密谋上的 1 个毁灭标记' })
  if (captivesInPlay(state)) options.push({ id: 'captives', label: '对病俘剧情支援造成 2 点伤害' })
  options.push({ id: 'damage', label: '受到 3 点直接伤害和 3 点直接恐惧' })
  const choice = pickOption(api, {
    kind: 'treachery', source: '10649', seat,
    prompt: '无尽夜晚：你必须决定（选择一项）。', options,
  }, options[options.length - 1].id)
  if (choice === 'doom') {
    state.doom = Math.max(0, (Number(state.doom) || 0) - 1)
    info(api, '无尽夜晚：移除密谋上的 1 个毁灭标记。')
  } else if (choice === 'captives') {
    damageCaptives(state, 2, api)
  } else {
    if (typeof api.directDamage === 'function') api.directDamage(seat, 3)
    else inv.damage = (inv.damage || 0) + 3
    if (typeof api.directHorror === 'function') api.directHorror(seat, 3)
    else inv.horror = (inv.horror || 0) + 3
    info(api, `无尽夜晚：${inv.name} 受到 3 点直接伤害和 3 点直接恐惧。`)
  }
  return false
}

/** 入侵（10650 显现）：检定 [敏捷](X=场上毁灭的一半向上取整)，每失败 1 点触发一个最近的[[突变]]敌人。 */
export function incursionEvent(state, payload = {}, api = {}) {
  const seat = Number(payload.seat) || 0
  const inv = state.investigators?.[seat]
  if (!inv || inv.defeated || inv.resigned) return false
  const difficulty = halfDoomInPlay(state)
  const resolve = result => {
    if (!result || result.success) return
    const explicit = Number(result.failedBy)
    const failedBy = Math.max(0, Number.isFinite(explicit)
      ? explicit
      : ((Number(result.difficulty) || difficulty) - (Number(result.value) || 0)))
    const chosen = []
    for (let index = 0; index < failedBy; index += 1) {
      const candidates = (state.enemies || [])
        .filter(enemy => !chosen.includes(enemy.id))
        .filter(enemy => (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'mutated'))
      if (!candidates.length) break
      const nearest = [...candidates].sort((a, b) =>
        distanceBetween(state, FARMHOUSE_ID, a.location) - distanceBetween(state, FARMHOUSE_ID, b.location))[0]
      chosen.push(nearest.id)
      nearest.exhausted = false
      safeCall(api, 'readyEnemy', nearest)
      if (typeof api.moveEnemyToward === 'function') api.moveEnemyToward(nearest, FARMHOUSE_ID)
      if (nearest.location === FARMHOUSE_ID) {
        damageCaptives(state, (Number(nearest.damage) || 0) + (Number(nearest.horror) || 0), api)
      } else if (nearest.engagedSeat != null && typeof api.attack === 'function') {
        api.attack(nearest, state.investigators[nearest.engagedSeat])
      }
      info(api, `入侵：[[突变]]敌人「${nearest.name}」重整并向农庄移动。`)
    }
  }
  if (typeof api.test === 'function') {
    api.test(inv.seat, 'agility', difficulty, resolve)
    return false
  }
  void resolve
  return false
}

export const events = Object.freeze({
  theLongestNightEndlessNight: endlessNightEvent,
  theLongestNightIncursion: incursionEvent,
})

// ---------------------------------------------------------------------------
// 行为装配
// ---------------------------------------------------------------------------

export function implementedEntryFlags(code) {
  return registeredEntry(String(code))?.flags || {}
}

/**
 * 无法在本内容层等价表达的子句（逐条披露；不写假等价）。
 */
export const approximations = Object.freeze([
  '印刷「随机移除 1 张 Outer Fields」固定移除 outerFieldsRancidCrops（10640），其余四张按方向格位放置。',
  '印刷把 5 张 Atwood Farm 地点洗到 5 个农场格：content 层用固定格位，保证地点 id/卡号/连接一致。',
  '地点起始面（Atwood Farm 背面）的数值没有第二份印刷数据：本关全部地点开场即揭示。',
  '居民剧情资产（Residents 组）与马奎兹医生不在本章卡表内：布置步骤由共享组/战役层放置，本章只读取记录与本处居民。',
  '「病俘被攻击」用 enemyPhaseEnd 结算农庄重整且未交战敌人的伤害值+恐惧值，而不是复用引擎的攻击管线。',
  '法典 2–8/Θ/Ω 由居民支援条目触发；本章实现全部九个条目效果（codexEntry），触发接线在居民条目/战役层。',
])

export const behavior = {
  id: CHAPTER_ID,
  locationsStartRevealed: true,
  startLocation: () => FARMHOUSE_ID,
  preScenarioSetup,
  afterChaosBagSetup,
  prepareScenario,
  setupScenario,
  setupLocations,
  setupEnemies,
  locationPlaced,
  afterDeckSetup,
  actions,
  performAction,
  doomPlacementReplacement,
  doomPlaced,
  spawnLocation,
  spawnOverrides,
  enemyMoved,
  enemyAttackModifier,
  enemyAttackResolved,
  enemyDamageAmount,
  enemyStatModifier,
  enemyConnections,
  enemyPhaseEnd,
  locationShroudModifier,
  cluesRemoved,
  checkObjectives,
  actReveal,
  agendaReveal,
  resolveChaosToken,
  chaosTokenValue,
  applyTokenEffect,
  afterTest,
  events,
  roundEnded,
  resolution,
  storyResolutionKey,
  scenarioResolution,
  allResigned,
  codexEntry,
  damageCaptives,
  healCaptives,
  captivesDamage,
  captivesInPlay,
  captivesAsset,
  spawnScenarioEnemy,
  placeBarrierAt,
  changeBarrierCount,
  barrierCount,
  barrierCountAt,
  placeDefense,
  removeDefenseAt,
  canPlaceDefenseAt,
  decoyAt,
  trapAt,
  placeInitialDefenses,
  grantSetupClues,
  buildEnemyDeck,
  drawFromEnemyDeck,
  discardToEnemyDeck,
  enemyDeckSize,
  enemyDeckDiscard,
  outerFieldAtDirection,
  fewestOuterField,
  mostOuterField,
  spawnUrsine,
  enterAjax,
  takeControlOfAjax,
  placeCaptives,
  applyNearestEnemyAttack,
  nearestEnemy,
  doomInPlay,
  halfDoomInPlay,
  isHardSide,
  introPlan,
  danceCount,
  applyIntroTokens,
  resolutionBonus,
  victoryXp,
  limitUsed,
  markLimit,
  setupLocationIds,
  defenseStore,
  barrierEdges,
  approximations,
}

export {
  ACT_CODES, AGENDA_CODES, ENEMY_DECK, FIRE_CARDS, FIRE_CODE, RECORD_KEYS,
  RESOLUTION_KEYS, SCENARIO_TEXT, SET_ASIDE_CARDS, STORY_CODES, URSINE_CODE, URSINE_VICTORY,
}
