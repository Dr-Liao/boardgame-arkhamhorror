// 消失的姐妹（theLostSister · 10569）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/TheLostSister.hs +
//       Act|Agenda|Location|Enemy|Treachery/Cards/TheFeastOfHemlockVale/TheLostSister/*.hs +
//       frontend/src/locales/en/theFeastOfHemlockVale/theLostSister.json（指南/法典/结局）。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   preScenarioSetup → 天数/昼夜与开场分支（指南 intro）
//   modifyDeck → 按当前天数把「第 N 日」遭遇组并入遭遇牌库
//   setupLocations / locationPlaced / locationRevealed / afterDeckSetup → 阿克望 + 岩穴牌库顶 3 张
//     （未揭示）、放一边（真菌洞穴 + 双面敌人 + 水晶寄生虫）、居民剧情支援
//   actions / performAction → 阿克望谈判/撤退、隐蔽海湾与地下水池的 Remembered、悬墓扩图、
//     露天洞穴熄暗、幕 2/3 的「拉出黑暗地点的敌人」行动
//   cluesGained → 幕 1 强制：从[[洞穴]]地点发现最后线索后扩一张岩穴牌
//   enemySpawned / enemyMoved / enemyDefeated / enemyStatModifier / enemyAttackModifier /
//     enemyDamageAmount / canOpportunityAttack → 双面敌人的翻面、数值、伤害与趁乱限制
//   investigatorEntryError / beforeMove / locationEntered → 真菌洞穴的团队线索入场费、乱藻海滩离场
//   phaseBegan / roundEnded / turnEnded → 露天洞穴熄暗到期、荧光增生的持续效果
//   actReveal / agendaReveal / checkObjectives → 幕 1/2/3 与议程 1/2 背面
//   resolveChaosToken / testAutoFail / applyTokenEffect → 10569 混乱标记
//   resolution → 结局 1–4 / 无结局与战役记录
//
// 近似（模块级披露）：
//   · 露天洞穴（10581）印刷是 [fast]，本实现在普通剧本行动里给出并说明；熄暗状态记在
//     `scenarioFlags.lostSisterLightUntil[locationId] = round`，在下一调查阶段（roundEnded）清除。
//   · 「进入真菌洞穴的额外费用」在 investigatorEntryError 里按「共同支付 2/每人线索」门禁，
//     支付发生在 beforeMove；线索不足时拒绝进入（与印刷一致），但支付者是移动者所在地点的调查员。
//   · 「翻面后保留全部标记与附属」由 physical-faces.js#applyPhysicalFace 保证（同一实体替换印刷字段）。
//   · 法典（Codex 4/6/8/Σ/Θ）以 behavior.codex 的确定性分支实现；法典籍面选择面板与
//     `mechanics.codex` 声明留给主进程（P8），这里不声明未接线的 mechanics 字段。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { applyPhysicalFace, planPhysicalFace } from '../../../../../src/engine/physical-faces.js'
import { adjacentGridSpaces, connectGrid, gridPosition } from '../../../../../src/engine/grid-map.js'
import { mechanicState } from '../../../../../src/engine/mechanic-state.js'
import {
  abominationAtInvestigator, hasTrait, isHardSide, locationIsDark,
  revealedCaveCount, skullValue, theLostSisterChaosToken, theLostSisterChaosTokenValue,
} from './chaos.js'
import {
  ACT_CODES, AGENDA_CODES, AGENDAS, ACTS, AKWAN_CELL, CAVERN_LOCATION_IDS, CRUSTACEAN_CODES,
  FUNGAL_CAVE_ID, HORRORS_CAVERN_POOL_IDS, HORRORS_REMOVED_COUNT, HYBRID_FACES, INITIAL_CAVERN_CELLS,
  LIMULUS_CODES, LOCATIONS, LUMINOUS_GROWTH_CODE, REMEMBERED, REMEMBERED_LABELS, RESIDENT_ASSETS,
  RESOLUTION_KEYS, SET_ASIDE_CARDS, SET_ASIDE_ENEMY_CODES, START_LOCATION, UNREVEALED_CAVERN_NAME,
  UNREVEALED_CAVERN_TRAITS, dayGroupCards, scenario,
} from './definition.js'

const CHAPTER_ID = 'theLostSister'
const NO_RESOLUTION = 'noResolution'

const activeInvestigators = state => (state.investigators || [])
  .filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
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
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const cloneList = value => (Array.isArray(value) ? value.map(item => (item && typeof item === 'object' ? structuredClone(item) : item)) : [])

// 单卡条目的规则数据（flags）是唯一事实源：behavior 只按条目声明分派。
const entryOf = code => (code ? registeredEntry(String(code)) : null)
const flagsOf = code => entryOf(code)?.flags || {}
const flagIs = (code, key) => flagsOf(code)[key] === true
const hybridGroupOf = code => {
  if (LIMULUS_CODES.includes(String(code))) return 'limulus'
  if (CRUSTACEAN_CODES.includes(String(code))) return 'crustacean'
  return flagIs(code, 'limulusHybrid') ? 'limulus' : flagIs(code, 'crustaceanHybrid') ? 'crustacean' : null
}
const codeOf = value => String(value?.originalCode || value?.code || '')

// ---------------------------------------------------------------------------
// 天数与昼夜（指南 Check your Campaign Log）
// ---------------------------------------------------------------------------

export function dayNumberOf(value) {
  const raw = value != null && typeof value === 'object' ? (value.day ?? value.value) : value
  if (raw == null || raw === '') return null
  const match = /([123])/.exec(String(raw))
  return match ? Number(match[1]) : null
}

export function dayOf(state) {
  const records = state?.campaign?.records || {}
  return dayNumberOf(state?.scenarioFlags?.lostSisterDay)
    ?? dayNumberOf(records.day)
    ?? dayNumberOf(records.currentDay)
    ?? 1
}

const timeIsNight = value => value != null && /night/i.test(String(value))

export function isNight(state) {
  if (state?.scenarioFlags?.lostSisterNight != null) return state.scenarioFlags.lostSisterNight === true
  const records = state?.campaign?.records || {}
  return timeIsNight(records.time) || timeIsNight(records.dayTime) || timeIsNight(records.timeOfDay)
}

/** 开场分支键：夜（Night 1/2）→ intro5，否则按天数 intro2/3/4（Haskell DoStep 1）。 */
export function introBranchKey(state) {
  if (isNight(state)) return 'intro5'
  const day = dayOf(state)
  return day === 3 ? 'intro4' : day === 2 ? 'intro3' : 'intro2'
}

export function introFor(state) {
  const key = introBranchKey(state)
  return { key, text: scenario.introBranches?.[key] || '' }
}

// ---------------------------------------------------------------------------
// Remembered（剧情标记）
// ---------------------------------------------------------------------------

export function rememberedFor(state) {
  const records = recordsFor(state)
  records.remembered ||= {}
  return records.remembered
}

export const isRemembered = (state, key) => rememberedFor(state)[key] === true

export function remember(state, key, api = {}) {
  if (!REMEMBERED_LABELS[key]) throw new RangeError(`未知的 Remembered 标记：${key}`)
  const remembered = rememberedFor(state)
  if (remembered[key]) return false
  remembered[key] = true
  info(api, `记住：${REMEMBERED_LABELS[key]}`)
  return true
}

export const hasBothMemories = state => isRemembered(state, REMEMBERED.dogLeash)
  && isRemembered(state, REMEMBERED.footprints)

// ---------------------------------------------------------------------------
// 黑暗地点
// ---------------------------------------------------------------------------

/** 临时「不再黑暗」的地点：露天洞穴检定成功（到下一调查阶段）+ 荧光增生附属地点。 */
export function suppressedDarkIds(state) {
  const suppressed = new Set()
  const until = flagsFor(state).lostSisterLightUntil
  if (until && typeof until === 'object') {
    for (const [locationId, round] of Object.entries(until)) {
      if (Number(round) >= Number(state?.round || 1)) suppressed.add(locationId)
    }
  }
  for (const location of state?.locations || []) {
    const attachedGrowth = (location.attachments || [])
      .some(attachment => codeOf(attachment) === LUMINOUS_GROWTH_CODE)
    if (attachedGrowth) suppressed.add(location.id)
    if ((location.attachments || []).some(attachment => attachment.darkTraitRemoved === true)) suppressed.add(location.id)
  }
  return suppressed
}

export function isDarkLocation(state, location) {
  return locationIsDark(location, suppressedDarkIds(state))
}

export function locationOf(state, id) {
  return (state?.locations || []).find(location => location.id === id) || null
}

export function darkLocationsInPlay(state) {
  return (state?.locations || []).filter(location => isDarkLocation(state, location))
}

export const caveLocationCount = state => revealedCaveCount(state)

export function syncConnections(state) {
  try {
    connectGrid(state)
  } catch {
    // 未建网格（纯数据测试）时忽略：地点连接由运行期网格维护。
  }
  return state.locations?.map(location => location.id) || []
}

// ---------------------------------------------------------------------------
// 岩穴牌库（Caverns deck）
// ---------------------------------------------------------------------------

/** 岩穴牌库：数组首元素是牌库顶（本关约定，读点只经下面四个函数）。 */
export function cavernsDeck(state) {
  state.scenarioZones ||= {}
  state.scenarioZones.cavernsDeck ||= []
  return state.scenarioZones.cavernsDeck
}

export const cavernsTop = state => cavernsDeck(state)[0] || null

export function takeCavernsTop(state) {
  const deck = cavernsDeck(state)
  return deck.length ? deck.shift() : null
}

export function putCavernsBottom(state, id) {
  if (!id) return false
  cavernsDeck(state).push(id)
  return true
}

export function lookAtCavernsTop(state, count = 3) {
  return cavernsDeck(state).slice(0, Math.max(0, count))
}

function shuffleWith(source, list) {
  const fn = typeof source === 'function' ? source : source?.shuffle
  if (typeof fn === 'function') return fn([...list])
  // 没有注入随机源（纯内容层调用）时不打乱：调用方负责传入 api.shuffle。
  return [...list]
}

/** Setup：组岩穴牌库（先洗 Horrors in the Rock 6 张，移出 2 张，再与 The Lost Sister 的 8 张一起洗）。 */
export function buildCavernsDeck(state, { shuffle = null } = {}) {
  const horrors = shuffleWith(shuffle, HORRORS_CAVERN_POOL_IDS)
  const removed = horrors.slice(0, HORRORS_REMOVED_COUNT)
  const remaining = horrors.slice(HORRORS_REMOVED_COUNT)
  const deck = shuffleWith(shuffle, [...CAVERN_LOCATION_IDS, ...remaining])
  state.scenarioZones ||= {}
  state.scenarioZones.cavernsDeck = deck
  state.scenarioZones.removedCaves = removed
  flagsFor(state).lostSisterRemovedCaves = [...removed]
  return { deck: [...deck], removed: [...removed] }
}

function writeGridCell(state, id, point) {
  const data = mechanicState(state, true)
  data.grid ||= {}
  data.grid[id] = { x: point.x, y: point.y, isolated: false, connections: [] }
  return data.grid[id]
}

export function cavernsRemaining(state) {
  return cavernsDeck(state).length
}

function locationInstance(state, id) {
  const base = state.scenario?.locations?.[id] || LOCATIONS[id]
  if (!base) return null
  const def = structuredClone(base)
  const clues = def.cluesFixed ?? (def.cluesPerInvestigator != null
    ? def.cluesPerInvestigator * investigatorCount(state)
    : Number(def.clues) || 0)
  return {
    ...def, id, revealed: false, clues: 0, maxClues: clues,
    connections: [], attachments: [], damage: 0, horror: 0, resources: 0, doom: 0,
  }
}

/** 把地点放进网格并入场（优先走引擎的 api.place 管线；纯内容层调用时本地建实例）。 */
export function placeCavernLocation(state, id, point, api = {}) {
  writeGridCell(state, id, point)
  if (!(state.locations || []).some(location => location.id === id)) {
    const placed = safeCall(api, 'place', id)
    if (!placed && !(state.locations || []).some(location => location.id === id)) {
      const instance = locationInstance(state, id)
      if (!instance) return null
      state.locations ||= []
      state.locations.push(instance)
      locationPlaced(state, instance, api)
    }
  }
  const loc = locationOf(state, id)
  if (loc) loc.grid = { x: point.x, y: point.y }
  syncConnections(state)
  return id
}

/** 把岩穴牌库顶放进 anchor 的相邻空格；没有空格/牌库为空时返回 null。 */
export function placeCavernCardAdjacent(state, anchorId, api = {}, options = {}) {
  const anchor = gridPosition(state, anchorId)
  if (!anchor) return null
  const spaces = adjacentGridSpaces(state, anchorId)
  if (!spaces.length) return null
  const cell = options.cell && spaces.some(space => space.x === options.cell.x && space.y === options.cell.y)
    ? options.cell
    : spaces[0]
  const id = options.locationId || takeCavernsTop(state)
  if (!id) return null
  const placed = placeCavernLocation(state, id, cell, api)
  if (!placed) {
    putCavernsBottom(state, id)
    return null
  }
  info(api, `岩穴牌库顶的「${locationOf(state, placed)?.unrevealedName || UNREVEALED_CAVERN_NAME}」放在「${locationOf(state, anchorId)?.name || anchorId}」旁（${cell.x},${cell.y}）。`)
  syncHybrids(state, api)
  return placed
}

/** 某地点相邻的已入场地点（连接由网格重算，这里读连接表）。 */
export function neighborsOf(state, locationId) {
  const loc = locationOf(state, locationId)
  return (loc?.connections || []).filter(id => locationOf(state, id))
}

// ---------------------------------------------------------------------------
// 双面敌人
// ---------------------------------------------------------------------------

export function enemyDefinitionFor(state, code) {
  const def = state?.scenario?.enemies?.[code] || scenario.enemies?.[code] || null
  const card = ALL_CARDS[code] || {}
  return { ...card, ...(def || {}), code, type: 'enemy',
    traits: [...((def?.traits) || card.traits || [])] }
}

export function enemyHealthFor(state, code) {
  const def = enemyDefinitionFor(state, code)
  const card = ALL_CARDS[code] || {}
  const base = Number(def.health ?? card.health) || 1
  if (LIMULUS_CODES.includes(String(code))) return base + 3 * investigatorCount(state)
  if (CRUSTACEAN_CODES.includes(String(code))) return base + dayOf(state)
  if (def.healthPerInvestigator) return base * investigatorCount(state)
  return base
}

let enemySerial = 0
export function spawnLostSisterEnemy(state, code, locationId, api = {}, options = {}) {
  const unique = options.unique === true
    ? (state.enemies || []).find(enemy => codeOf(enemy) === String(code))
    : null
  if (unique) return unique
  const before = (state.enemies || []).length
  safeCall(api, 'spawn', code, locationId, options)
  if ((state.enemies || []).length > before) return state.enemies[state.enemies.length - 1]
  const def = enemyDefinitionFor(state, code)
  enemySerial += 1
  const enemy = {
    id: `lostSister-${code}-${enemySerial}`, code, originalCode: code,
    name: def.nameZh || def.name || code, location: locationId,
    fight: def.fight ?? 0, evade: def.evade ?? 0, health: enemyHealthFor(state, code),
    damage: def.damage || 0, horror: def.horror || 0, traits: [...(def.traits || [])],
    exhausted: options.exhausted === true, engagedSeat: options.engagedSeat ?? null,
    damageTaken: 0, doom: 0, clues: 0, attachments: [], victory: Number(def.victory) || 0,
    ...(def.elite ? { elite: true } : {}),
    ...(def.hunter ? { hunter: true } : {}),
    ...(def.retaliate ? { retaliate: true } : {}),
    ...(def.aloof ? { aloof: true } : {}),
    ...(def.massive ? { massive: true } : {}),
  }
  state.enemies ||= []
  state.enemies.push(enemy)
  return enemy
}

/** 从放一边区取一张敌人并生成；放一边区没有该卡时返回 null。 */
export function spawnSetAsideEnemy(state, code, locationId, api = {}, options = {}) {
  state.scenarioZones ||= {}
  const aside = state.scenarioZones.setAside
  if (Array.isArray(aside)) {
    const index = aside.indexOf(String(code))
    if (index < 0) return null
    aside.splice(index, 1)
  } else if (typeof api.takeFromSetAside === 'function') {
    if (!api.takeFromSetAside(String(code))) return null
  }
  return spawnLostSisterEnemy(state, code, locationId, api, options)
}

export function hybridFaceFor(group, { dark }) {
  const faces = HYBRID_FACES[group]
  if (!faces) return null
  return dark ? faces.night : faces.day
}

/** 双面敌人翻面：替换印刷字段（保留 id/伤害/横竖/附属/线索），再结算翻面后的强制效果。 */
export function flipHybrid(state, enemy, nextCode, api = {}) {
  const current = codeOf(enemy)
  if (current === String(nextCode)) return enemy
  const definitionFor = code => enemyDefinitionFor(state, code)
  try {
    const plan = planPhysicalFace(enemy, nextCode, { kind: 'enemy', definitionFor })
    applyPhysicalFace(state, enemy, nextCode, { definitionFor })
    void plan
  } catch {
    // 极端状态（不在场/未知面）退回逐字段复制，保持「同一实体」的语义。
    const def = definitionFor(nextCode)
    for (const key of ['fight', 'evade', 'health', 'damage', 'horror', 'victory']) {
      if (def[key] != null) enemy[key] = def[key]
    }
    enemy.code = String(nextCode)
    enemy.originalCode = String(nextCode)
    enemy.name = def.nameZh || def.name || String(nextCode)
    enemy.traits = [...(def.traits || [])]
  }
  enemy.health = enemyHealthFor(state, nextCode)
  const group = hybridGroupOf(nextCode)
  // Forced - 翻到这些面之后的强制效果（印刷文本见 cards-data）。
  if (group === 'limulus' && String(nextCode) === HYBRID_FACES.limulus.day) {
    const amount = investigatorCount(state)
    dealDamageToEnemy(state, enemy, amount, api)
    info(api, `「${enemy.name}」翻至(在光中)面：受到 ${amount} 点伤害。`)
  }
  if (group === 'crustacean' && String(nextCode) === HYBRID_FACES.crustacean.night) {
    for (const inv of activeInvestigators(state).filter(inv => inv.location === enemy.location)) {
      harmInvestigator(state, inv, { damage: 1 }, api)
    }
    info(api, `「${enemy.name}」翻至(在黑暗中)面：所在地点的每位调查员受到 1 点伤害。`)
  }
  info(api, `双面敌人「${enemy.name}」翻面（${current} → ${nextCode}），保留全部标记与附属。`)
  return enemy
}

function dealDamageToEnemy(state, enemy, amount, api = {}) {
  if (!(amount > 0)) return 0
  // 引擎的 damageEnemy(enemyId, amount, seat, source) 自带击败结算；只在没有引擎时本地结算。
  if (typeof api?.damageEnemy === 'function') {
    api.damageEnemy(enemy.id, amount)
    return amount
  }
  enemy.damageTaken = (Number(enemy.damageTaken) || 0) + amount
  const health = Number(enemy.health) || 0
  if (health > 0 && enemy.damageTaken >= health && typeof api?.defeatEnemy === 'function') api.defeatEnemy(enemy)
  return amount
}

function harmInvestigator(state, inv, { damage = 0, horror = 0 } = {}, api = {}) {
  if (damage > 0) {
    if (typeof api?.damage === 'function') api.damage(inv.seat, damage)
    else inv.damage = (Number(inv.damage) || 0) + damage
  }
  if (horror > 0) {
    if (typeof api?.horror === 'function') api.horror(inv.seat, horror)
    else inv.horror = (Number(inv.horror) || 0) + horror
  }
}

/** 同步一个地点上的双面敌人：黑暗地点必须是黑夜面，其余地点必须是白日面。 */
export function syncHybridAt(state, locationId, api = {}) {
  const location = locationOf(state, locationId)
  if (!location) return []
  const dark = isDarkLocation(state, location)
  const flipped = []
  for (const enemy of (state.enemies || []).filter(item => item.location === locationId)) {
    const group = hybridGroupOf(codeOf(enemy))
    if (!group) continue
    const target = hybridFaceFor(group, { dark })
    if (!target || codeOf(enemy) === target) continue
    flipped.push(flipHybrid(state, enemy, target, api))
  }
  return flipped
}

export function syncHybrids(state, api = {}) {
  const flipped = []
  for (const location of state?.locations || []) flipped.push(...syncHybridAt(state, location.id, api))
  return flipped
}

/** 已入场的双面敌人数（投影/测试读点）。 */
export function hybridsInPlay(state) {
  return (state?.enemies || []).filter(enemy => hybridGroupOf(codeOf(enemy)))
}

// ---------------------------------------------------------------------------
// 居民（剧情支援）
// ---------------------------------------------------------------------------

export function residentsInPlay(state) {
  const codes = new Set(Object.values(RESIDENT_ASSETS))
  return (state?.storyAssets || []).filter(asset => codes.has(codeOf(asset)))
}

export function residentInPlay(state, key) {
  const code = RESIDENT_ASSETS[key]
  return (state?.storyAssets || []).find(asset => codeOf(asset) === code) || null
}

export function putResidentInPlay(state, key, api = {}, options = {}) {
  const code = RESIDENT_ASSETS[key]
  const existing = residentInPlay(state, key)
  if (existing) return existing
  const before = (state.storyAssets || []).length
  safeCall(api, 'storyAsset', code, options.location ?? null)
  if ((state.storyAssets || []).length > before) {
    const spawned = state.storyAssets[state.storyAssets.length - 1]
    if (options.controllerSeat != null && spawned.controllerSeat == null) spawned.controllerSeat = options.controllerSeat
    return spawned
  }
  const card = ALL_CARDS[code] || {}
  const asset = {
    id: `lostSister-${code}`, code, originalCode: code, name: card.nameZh || card.name || code,
    location: options.location ?? null, controllerSeat: options.controllerSeat ?? null,
    exhausted: false, tokens: 0, assets: [], attachments: [],
  }
  state.storyAssets ||= []
  state.storyAssets.push(asset)
  return asset
}

export function removeResidentFromPlay(state, key) {
  const asset = residentInPlay(state, key)
  if (!asset) return false
  state.storyAssets = state.storyAssets.filter(item => item !== asset)
  return true
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------

export function preScenarioSetup(state, events, helperOrApi = {}) {
  const api = helperOrApi?.api || helperOrApi || {}
  void events
  const day = dayOf(state)
  const night = isNight(state)
  setFlag(state, 'lostSisterDay', day)
  setFlag(state, 'lostSisterNight', night)
  const intro = introFor(state)
  setFlag(state, 'lostSisterIntro', intro.key)
  recordsFor(state).lostSisterDay = day
  info(api, `消失的姐妹：第 ${day} 日${night ? '（夜）' : ''} · 开场分支 ${intro.key}。`)
  return { day, night, intro }
}

/** 按当前天数把「第 N 日」遭遇组并入遭遇牌库（Setup #2）。 */
export function modifyDeck(state, deck, events = null, helper = {}) {
  void events
  void helper
  const extra = dayGroupCards(dayOf(state))
  return [...deck, ...extra]
}

export function setupLocations(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  state.scenarioZones ||= {}
  const shuffle = typeof api.shuffle === 'function'
    ? api.shuffle
    : typeof helper?.shuffle === 'function'
      ? list => helper.shuffle([...list], () => Number(helper?.randomValue?.(state) ?? Math.random()))
      : null
  // 阿克望在 (0,0)；岩穴牌库顶 3 张放在左下/下/右，未揭示入场。
  writeGridCell(state, START_LOCATION, AKWAN_CELL)
  const built = buildCavernsDeck(state, { shuffle })
  const initial = []
  for (const [index, cell] of INITIAL_CAVERN_CELLS.entries()) {
    const id = takeCavernsTop(state)
    if (!id) break
    writeGridCell(state, id, cell)
    initial.push({ id, cell })
    void index
  }
  state.scenarioZones.setAside = [...SET_ASIDE_CARDS]
  state.scenarioZones.setAsideLocations = [FUNGAL_CAVE_ID]
  setFlag(state, 'lostSisterInitialCaves', initial.map(entry => entry.id))
  info(api, `岩穴牌库 ${built.deck.length} 张（移出 ${built.removed.length} 张岩穴），顶 ${initial.length} 张未揭示入场。`)
  return [START_LOCATION, ...initial.map(entry => entry.id)]
}

export function setupEnemies(state, events = null, helper = {}) {
  void state
  void events
  void helper
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  const day = dayOf(state)
  const night = isNight(state)
  // 居民：Helen 必到；Theo 第 1/2 日（夜则全部登场），Gideon 第 2/3 日，William 第 3 日在阿克望。
  putResidentInPlay(state, 'helen', api, { controllerSeat: state.investigators?.[0]?.seat ?? 0 })
  if (!night) {
    if (day === 1 || day === 2) putResidentInPlay(state, 'theo', api, { controllerSeat: state.investigators?.[0]?.seat ?? 0 })
    if (day === 2 || day === 3) putResidentInPlay(state, 'gideon', api, { controllerSeat: state.investigators?.[0]?.seat ?? 0 })
    if (day === 3) putResidentInPlay(state, 'william', api, { location: START_LOCATION })
  }
  syncConnections(state)
  syncHybrids(state, api)
  info(api, `布置完成：${residentCountText(state)}。`)
  return { day, night, residents: residentsInPlay(state).map(asset => codeOf(asset)) }
}

const residentCountText = state => {
  const count = residentsInPlay(state).length
  return `${count} 名居民入场`
}

export function locationPlaced(state, location, api = {}, seat = null) {
  void seat
  if (!location) return
  const cell = gridPosition(state, location.id)
  if (cell) location.grid = { x: cell.x, y: cell.y }
  if (location.id === START_LOCATION) {
    location.revealed = true
    location.traits = [...(location.printedTraits || location.traits || [])]
    location.name = location.printedName || location.name
  } else if (location.revealed !== true) {
    // 未揭示的岩穴面：名字与特性按印刷的 Cavern 面显示；揭示时由 locationRevealed 还原。
    location.unrevealedActualName = location.printedName || location.name
    location.name = UNREVEALED_CAVERN_NAME
    location.traits = [...UNREVEALED_CAVERN_TRAITS]
  }
  location.dark = isDarkLocation(state, location)
  syncConnections(state)
  syncHybridAt(state, location.id, api)
}

export function locationRevealed(state, location, api = {}, seat = null) {
  void seat
  if (!location) return
  const card = ALL_CARDS[location.originalCode || location.code] || {}
  location.traits = [...(location.printedTraits || card.traits || [])]
  location.name = location.printedName || card.nameZh || card.name || location.name
  location.dark = isDarkLocation(state, location)
  syncConnections(state)
  // 揭示会改变黑暗状态：站在原地的双面敌人必须翻到与当前面相符的一侧。
  const flipped = syncHybridAt(state, location.id, api)
  if (flipped.length) info(api, `「${location.name}」揭示后，${flipped.length} 个双面敌人翻面。`)
  return flipped
}

// ---------------------------------------------------------------------------
// 行动
// ---------------------------------------------------------------------------

const MYTHOS_CLUE_COST = state => investigatorCount(state)
const groupCluesAt = (state, locationId) => (state.investigators || [])
  .filter(inv => inv.location === locationId && !inv.defeated && !inv.resigned)
  .reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)

function spendGroupClues(state, locationId, amount) {
  let remaining = amount
  for (const inv of state.investigators || []) {
    if (remaining <= 0) break
    if (inv.location !== locationId || inv.defeated || inv.resigned) continue
    const pay = Math.min(Number(inv.clues) || 0, remaining)
    inv.clues = (Number(inv.clues) || 0) - pay
    remaining -= pay
  }
  return remaining === 0
}

export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const here = locationOf(state, inv.location)
  const moves = []
  if (!here) return moves
  const round = Number(state.round) || 1
  const flags = flagsFor(state)

  // 阿克望：撤退 + 第 1/2 日的谈判（查看岩穴牌库顶 3 张）。
  if (here.id === START_LOCATION) {
    if (dayOf(state) === 1 || dayOf(state) === 2) {
      const empty = cavernsDeck(state).length === 0
      moves.push({
        action: 'scenarioAction', rule: 'lostSisterAkwanParley', locationId: here.id,
        label: '⚓ 阿克望 · 谈判：查看岩穴牌库顶 3 张（任意顺序放回）',
        reason: empty ? '岩穴牌库为空' : null,
      })
    }
  }

  // 隐蔽海湾 / 地下水池：团队共同花费 2[per_investigator] 线索 → Remembered。
  const rememberRule = here.id === 'hiddenCove' ? REMEMBERED.dogLeash
    : here.id === 'undergroundPools' ? REMEMBERED.footprints : null
  if (rememberRule) {
    const required = 2 * investigatorCount(state)
    const already = isRemembered(state, rememberRule)
    const pool = groupCluesAt(state, here.id)
    moves.push({
      action: 'scenarioAction', rule: `lostSisterRemember:${rememberRule}`, locationId: here.id,
      label: `🔎 ${here.name}：团队花费 ${required} 个线索，记住「${REMEMBERED_LABELS[rememberRule]}」`,
      reason: already ? '已经记住过这条线索' : pool < required ? `线索不足（需要 ${required}，当前 ${pool}）` : null,
    })
  }

  // 悬墓：受到 1 点恐惧，把岩穴牌库顶放进相邻空格（团队每场游戏一次）。
  if (here.id === 'suspendedGraveyard1' || here.id === 'suspendedGraveyard2') {
    const used = flags.lostSisterGraveyardUsed === true
    const empty = cavernsDeck(state).length === 0
    const spaces = gridPosition(state, here.id) ? adjacentGridSpaces(state, here.id) : []
    moves.push({
      action: 'scenarioAction', rule: `lostSisterGraveyardDig:${here.id}`, locationId: here.id,
      label: '⛏ 悬墓：受到 1 点恐惧，翻开岩穴牌库顶放到相邻空格',
      reason: used ? '本场游戏团队已使用过' : empty ? '岩穴牌库为空' : !spaces.length ? '没有相邻空格' : null,
    })
  }

  // 露天洞穴：熄灭 [[黑暗]] 直到下个调查阶段（团队每轮一次）。印刷为 [fast]，见模块头近似说明。
  if (here.id === 'openCave1' || here.id === 'openCave2') {
    const usedRound = Number(flags.lostSisterOpenCaveRound) === round
    moves.push({
      action: 'scenarioAction', rule: `lostSisterOpenCaveLight:${here.id}`, locationId: here.id,
      label: '☀️ 露天洞穴：检定[agility](2+此处的重整敌人)，成功则失去[[黑暗]]（团队每轮一次）',
      reason: usedRound ? '本团队本轮已经尝试过' : null,
    })
  }

  // 幕 2/3 的印刷行动：花费 1[per_investigator] 线索，把相邻黑暗地点的敌人拉到你所在地点。
  const actStage = Number(state.actIndex ?? 0)
  if (actStage >= 1) {
    const targets = lureTargets(state, inv)
    const required = MYTHOS_CLUE_COST(state)
    moves.push({
      action: 'scenarioAction', rule: 'lostSisterLureFromDark', locationId: here.id,
      label: `🪝 花费 ${required} 个线索：把相邻黑暗地点的一个敌人移到此处`,
      reason: (Number(inv.clues) || 0) < required ? `线索不足（需要 ${required}）`
        : !targets.length ? '相邻的黑暗地点没有敌人' : null,
    })
  }
  return moves
}

export function lureTargets(state, inv, { darkness = true } = {}) {
  const here = locationOf(state, inv?.location)
  if (!here) return []
  const adjacent = new Set(here.connections || [])
  return (state.enemies || []).filter(enemy => adjacent.has(enemy.location)
    && (!darkness || isDarkLocation(state, locationOf(state, enemy.location))))
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv) return false
  const rule = String(move.rule || '')
  if (rule === 'lostSisterAkwanParley') {
    const top = lookAtCavernsTop(state, 3)
    if (!top.length) return false
    // 印刷是「看过之后任意顺序放回」：这里按原顺序放回（顺序调整留给玩家面板），披露于模块头。
    info(api, `阿克望谈判：岩穴牌库顶 ${top.length} 张按任意顺序放回（当前未提供重排面板）。`)
    setFlag(state, 'lostSisterAkwanParleyUsed', true)
    return true
  }
  if (rule.startsWith('lostSisterRemember:')) {
    const key = rule.slice('lostSisterRemember:'.length)
    const required = 2 * investigatorCount(state)
    if (isRemembered(state, key)) return false
    if (groupCluesAt(state, inv.location) < required) return false
    if (!spendGroupClues(state, inv.location, required)) return false
    remember(state, key, api)
    checkObjectives(state, api)
    return true
  }
  if (rule.startsWith('lostSisterGraveyardDig:')) {
    if (flagsFor(state).lostSisterGraveyardUsed === true) return false
    const locationId = rule.slice('lostSisterGraveyardDig:'.length)
    if (!cavernsDeck(state).length) return false
    harmInvestigator(state, inv, { horror: 1 }, api)
    const placed = placeCavernCardAdjacent(state, locationId, api)
    if (!placed) return false
    setFlag(state, 'lostSisterGraveyardUsed', true)
    return true
  }
  if (rule.startsWith('lostSisterOpenCaveLight:')) {
    const locationId = rule.slice('lostSisterOpenCaveLight:'.length)
    const round = Number(state.round) || 1
    if (Number(flagsFor(state).lostSisterOpenCaveRound) === round) return false
    setFlag(state, 'lostSisterOpenCaveRound', round)
    const readyHere = (state.enemies || []).filter(enemy => enemy.location === locationId && !enemy.exhausted).length
    const difficulty = 2 + readyHere
    const test = safeCall(api, 'test', inv.seat, 'agility', difficulty, () => true)
    const success = test && typeof test === 'object' ? test.success === true : test !== false
    if (!success) {
      info(api, `露天洞穴：${inv.name} 的[agility]检定失败，地点仍然黑暗。`)
      return false
    }
    const until = flagsFor(state).lostSisterLightUntil ||= {}
    until[locationId] = round
    const location = locationOf(state, locationId)
    if (location) location.dark = false
    info(api, '露天洞穴失去[[黑暗]]特性，直到下个调查阶段开始。')
    syncHybridAt(state, locationId, api)
    return true
  }
  if (rule === 'lostSisterLureFromDark') {
    const required = MYTHOS_CLUE_COST(state)
    if ((Number(inv.clues) || 0) < required) return false
    const targets = lureTargets(state, inv)
    if (!targets.length) return false
    const chosen = typeof api.choose === 'function'
      ? pickTarget(api, inv.seat, targets, '选择要拉到这里的敌人')
      : targets[0]
    if (!chosen) return false
    const from = chosen.location
    inv.clues -= required
    chosen.location = inv.location
    info(api, `「${chosen.name}」被从「${locationOf(state, from)?.name || from}」拉到「${locationOf(state, inv.location)?.name || inv.location}」。`)
    syncHybridAt(state, inv.location, api)
    if (from) syncHybridAt(state, from, api)
    return true
  }
  return false
}

function pickTarget(api, seat, list, prompt) {
  const answer = api.choose({ kind: 'enemy', seat, prompt, options: list.map((item, index) => ({ id: item.id, label: item.name || item.id, index })) })
  if (answer == null) return null
  const byId = list.find(item => item.id === answer)
  if (byId) return byId
  const byIndex = list.find((item, index) => String(index) === String(answer))
  return byIndex || null
}

// ---------------------------------------------------------------------------
// 强制效果与移动
// ---------------------------------------------------------------------------

/** 幕 1 强制：从[[洞穴]]地点发现最后线索后，把岩穴牌库顶放到该地点旁。 */
export function cluesGained(state, inv, amount, api = {}) {
  if (!(Number(amount) > 0)) return null
  if (Number(state.actIndex ?? 0) !== 0) return null
  const location = locationOf(state, inv?.location)
  if (!location || !hasTrait(location, 'Cave')) return null
  if (Number(location.clues) > 0) return null
  const key = `lostSisterLastClue:${location.id}`
  if (flagsFor(state)[key]) return null
  const placed = placeCavernCardAdjacent(state, location.id, api)
  if (!placed) return null
  setFlag(state, key, true)
  return placed
}

/** 真菌洞穴的额外入场费：所在地点的调查员共同花费 2[per_investigator] 线索。 */
export function investigatorEntryError(state, location, inv) {
  if (!location || location.id !== FUNGAL_CAVE_ID) return null
  if (location.revealed === true) return null
  const required = 2 * investigatorCount(state)
  const pool = groupCluesAt(state, inv?.location) + (Number(inv?.clues) || 0) * 0
  if (pool >= required) return null
  return `进入真菌洞穴需要你所在地点的调查员共同花费 ${required} 个线索`
}

export function beforeMove(state, inv, destination, api = {}, options = {}) {
  void options
  if (!inv || !destination) return true
  // 真菌洞穴入场费（未揭示时）。
  if (destination.id === FUNGAL_CAVE_ID && destination.revealed !== true) {
    const required = 2 * investigatorCount(state)
    if (groupCluesAt(state, inv.location) < required) return false
    spendGroupClues(state, inv.location, required)
  }
  // 乱藻海滩：离开时揭示混乱标记，命中符号则取消移动或弃掉一个[[道具]]支援。
  const from = locationOf(state, inv.location)
  if (from && from.id === 'weedChokedBeach') {
    const token = safeCall(api, 'revealChaosToken') || safeCall(api, 'drawChaosToken')
    const face = typeof token === 'string' ? token : String(token?.face || '')
    const triggers = ['skull', 'tablet', 'elderthing', 'elder_thing', 'autofail', 'auto_fail']
    if (triggers.includes(face)) {
      const items = (inv.assets || []).filter(asset => (asset.traits || [])
        .some(trait => String(trait).toLowerCase() === 'item'))
      const answer = typeof api.choose === 'function'
        ? api.choose({
          kind: 'choice', seat: inv.seat, prompt: '乱藻海滩：取消移动，或弃掉一个[[道具]]支援',
          options: [
            { id: 'cancel', label: '取消移动效果' },
            ...(items.length ? [{ id: 'discard', label: '弃掉一个[[道具]]支援' }] : []),
          ],
        })
        : items.length ? 'discard' : 'cancel'
      if (answer !== 'discard' || !items.length) {
        info(api, `乱藻海滩：揭示了 ${face}，移动被取消。`)
        return false
      }
      const asset = items[0]
      const discarded = safeCall(api, 'discardAsset', inv.seat, asset.id)
      if (discarded === false) return false
      if (discarded == null) {
        inv.assets = (inv.assets || []).filter(item => item !== asset)
        inv.discard = [...(inv.discard || []), codeOf(asset)]
      }
      info(api, `乱藻海滩：弃掉「${asset.name || codeOf(asset)}」以避免移动被取消。`)
    }
  }
  return true
}

export function locationEntered(state, inv, location, api = {}) {
  void location
  // 进入新地点后可能翻面（黑暗状态变化）并且幕 2 的目标是「进入真菌洞穴」。
  checkObjectives(state, api)
  return syncHybridAt(state, inv?.location, api)
}

export function locationLeft(state, inv, location, api = {}) {
  void location
  void inv
  void api
  return null
}

// ---------------------------------------------------------------------------
// 敌人钩子
// ---------------------------------------------------------------------------

export function enemySpawned(state, enemy, api = {}) {
  if (!enemy || !hybridGroupOf(codeOf(enemy))) return null
  const location = locationOf(state, enemy.location)
  if (!location) return null
  const target = hybridFaceFor(hybridGroupOf(codeOf(enemy)), { dark: isDarkLocation(state, location) })
  if (!target || codeOf(enemy) === target) return null
  return flipHybrid(state, enemy, target, api)
}

export function enemyMoved(state, enemy, fromId, api = {}) {
  void fromId
  if (!enemy) return null
  const flipped = syncHybridAt(state, enemy.location, api)
  return flipped.length ? flipped[0] : null
}

export function enemyDefeated(state, enemy, api = {}) {
  if (hybridGroupOf(codeOf(enemy)) === 'limulus') setFlag(state, 'lostSisterLimulusDefeated', true)
  checkObjectives(state, api)
  return false
}

export function enemyStatModifier(state, enemy, stat) {
  if (!enemy) return 0
  const group = hybridGroupOf(codeOf(enemy))
  if (stat === 'health') {
    if (group === 'limulus') return 3 * investigatorCount(state)
    if (group === 'crustacean') return dayOf(state)
    return 0
  }
  // 荧光增生：所附属地点的敌人得到 +1 攻击值。
  if ((stat === 'fight' || stat === 'evade') && luminousGrowthLocations(state).has(enemy.location)) {
    return stat === 'fight' ? 1 : 0
  }
  return 0
}

export function luminousGrowthLocations(state) {
  const ids = new Set()
  for (const location of state?.locations || []) {
    if ((location.attachments || []).some(attachment => codeOf(attachment) === LUMINOUS_GROWTH_CODE)) ids.add(location.id)
  }
  return ids
}

/** 荧光增生：所附属地点的敌人 +1 伤害值（攻击加成钩子）。 */
export function enemyAttackModifier(state, enemy) {
  if (!enemy) return {}
  return luminousGrowthLocations(state).has(enemy.location) ? { damage: 1 } : {}
}

/** 虾类混种（白日面）：受到攻击伤害时减至 1。 */
export function enemyDamageAmount(state, enemy, total) {
  if (!enemy) return total
  if (codeOf(enemy) === HYBRID_FACES.crustacean.day) return Math.min(Number(total) || 0, 1)
  return total
}

/** 鳖类混种（白日面）不能进行趁乱攻击。 */
export function canOpportunityAttack(state, enemy) {
  if (!enemy) return true
  return codeOf(enemy) !== HYBRID_FACES.limulus.day
}

// ---------------------------------------------------------------------------
// 轮末 / 回合末
// ---------------------------------------------------------------------------

export function roundEnded(state, api = {}) {
  // 露天洞穴的熄暗只到一个调查阶段开始。
  const until = flagsFor(state).lostSisterLightUntil
  if (until && typeof until === 'object') {
    for (const [locationId, round] of Object.entries(until)) {
      if (Number(round) <= Number(state.round || 1)) {
        delete until[locationId]
        const location = locationOf(state, locationId)
        if (location) location.dark = isDarkLocation(state, location)
        syncHybridAt(state, locationId, api)
      }
    }
    if (!Object.keys(until).length) clearFlag(state, 'lostSisterLightUntil')
  }
  syncHybrids(state, api)
  return true
}

export function turnEnded(state, inv, api = {}) {
  void state
  void api
  // 本关没有回合末的印刷强制效果（乱藻海滩/悬墓在自己的行动与离开钩子里结算）。
  void inv
  return null
}

export function phaseBegan(state, phase, api = {}) {
  void api
  if (String(phase) !== 'investigation') return null
  const until = flagsFor(state).lostSisterLightUntil
  if (!until || !Object.keys(until).length) return null
  for (const locationId of Object.keys(until)) {
    const location = locationOf(state, locationId)
    delete until[locationId]
    if (location) location.dark = isDarkLocation(state, location)
    syncHybridAt(state, locationId, api)
  }
  if (!Object.keys(until).length) clearFlag(state, 'lostSisterLightUntil')
  return true
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------

const currentAct = state => (state.acts || [])[Number(state.actIndex ?? 0)] || null
const currentAgenda = state => (state.agendas || [])[Number(state.agendaIndex ?? 0)] || null

/** 目标判定：满足当前幕的印刷目标时返回 true 并推进（引擎在目标窗口调用）。 */
export function checkObjectives(state, api = {}) {
  const act = currentAct(state)
  if (!act) return false
  const objective = act.objective || {}
  if (objective.type === 'remembered') {
    if (!hasBothMemories(state)) return false
    info(api, '两个 Remembered 都已记录：立即推进幕 1。')
    advanceAct(state, api)
    return true
  }
  if (objective.type === 'enters') {
    const target = objective.locationId
    if (!(state.investigators || []).some(inv => inv.location === target && !inv.defeated && !inv.resigned)) return false
    info(api, '有调查员进入真菌洞穴：立即推进幕 2。')
    advanceAct(state, api)
    return true
  }
  if (objective.type === 'defeatEnemy') {
    const codes = objective.enemyCodes || []
    const inPlay = (state.enemies || []).some(enemy => codes.includes(codeOf(enemy)))
    if (inPlay) return false
    const defeated = state.victoryDisplay?.some(entry => codes.includes(codeOf(entry)))
      || flagsFor(state).lostSisterLimulusDefeated === true
    if (!defeated) return false
    info(api, '鳖类混种已被击败：立即推进幕 3。')
    advanceAct(state, api)
    return true
  }
  return false
}

function advanceAct(state, api) {
  if (typeof api?.advanceAct === 'function') {
    api.advanceAct()
    return true
  }
  // 内容层（测试/无引擎）推进：结算当前幕背面并移动指针。
  const act = currentAct(state)
  actReveal(state, act, api)
  if (state.actFinished) return true
  state.actIndex = Number(state.actIndex ?? 0) + 1
  return true
}

function advanceAgenda(state, api) {
  if (typeof api?.advanceAgenda === 'function') {
    api.advanceAgenda()
    return true
  }
  const agenda = currentAgenda(state)
  agendaReveal(state, agenda, api)
  if (state.skipAgendaAdvance) return true
  state.agendaIndex = Number(state.agendaIndex ?? 0) + 1
  return true
}

export function actReveal(state, act, api = {}) {
  if (!act) return false
  const code = codeOf(act)
  const apiInfo = api?.info ? api : (api?.api || {})
  if (code === ACT_CODES[0]) {
    // 幕 1 背面：选一个[[海岸]]地点（尽量没有调查员），把真菌洞穴放到它旁边，
    // 再用岩穴牌库顶补到真菌洞穴与 4 个地点相连（或牌库空）。
    const coastal = coastalAnchor(state)
    if (!coastal) return false
    const placed = placeFungalCaveAdjacent(state, coastal.id, apiInfo)
    if (placed) fillFungalCaveNeighbors(state, placed, apiInfo)
    setFlag(state, 'lostSisterAct1Resolved', true)
    return true
  }
  if (code === ACT_CODES[1]) {
    // 幕 2 背面：在真菌洞穴生成放一边的鳖类混种；移出海伦；若希奥由调查员控制则读法典 Σ。
    const fungal = locationOf(state, FUNGAL_CAVE_ID)
    if (fungal) {
      spawnSetAsideEnemy(state, HYBRID_FACES.limulus.day, FUNGAL_CAVE_ID, apiInfo, { unique: true })
      syncHybridAt(state, FUNGAL_CAVE_ID, apiInfo)
    }
    removeResidentFromPlay(state, 'helen')
    if (residentInPlay(state, 'theo')) codex(state, 'lobstrosity', apiInfo)
    setFlag(state, 'lostSisterAct2Resolved', true)
    return true
  }
  if (code === ACT_CODES[2]) {
    // 幕 3 背面：→ 结局 1。
    info(apiInfo, '幕 3 背面：进入结局 1。')
    safeCall(apiInfo, 'finish', 'resolution1')
    setFlag(state, 'lostSisterAct3Resolved', true)
    return true
  }
  return false
}

export function agendaReveal(state, agenda, api = {}) {
  if (!agenda) return false
  const code = codeOf(agenda)
  if (code === AGENDA_CODES[0]) {
    // 议程 1 背面：在离最多调查员最近的[[海岸]]地点生成放一边的虾类混种（在光中面）；
    // 每个在[[黑暗]]地点的调查员随机弃 1 张手牌；推进议程后在议程 2a 上放等于天数的毁灭。
    const target = nearestCoastalToMostInvestigators(state)
    if (target) spawnSetAsideEnemy(state, HYBRID_FACES.crustacean.day, target.id, api, { unique: false })
    for (const inv of activeInvestigators(state).filter(inv => isDarkLocation(state, locationOf(state, inv.location)))) {
      discardRandomCard(state, inv, api)
    }
    const doom = dayOf(state)
    state.doom = (Number(state.doom) || 0) + doom
    if (state.agendas?.[Number(state.agendaIndex ?? 0) + 1]) {
      // 毁灭放在「议程 2a」上：引擎把 doom 记在 state.doom，议程实例上再补一份读点。
      const next = state.agendas[Number(state.agendaIndex ?? 0) + 1]
      next.doom = (Number(next.doom) || 0) + doom
    }
    setFlag(state, 'lostSisterAgenda1Resolved', true)
    return true
  }
  if (code === AGENDA_CODES[1]) {
    // 议程 2 背面：每位尚未撤退的幸存调查员被击败并承受 1 点精神创伤。
    for (const inv of activeInvestigators(state)) {
      safeCall(api, 'defeatInvestigator', inv.seat)
      const applied = safeCall(api, 'addTrauma', inv.seat, 'mental', 1)
      if (applied == null) {
        recordsFor(state).trauma ||= {}
        const trauma = recordsFor(state).trauma
        trauma[inv.seat] ||= { physical: 0, mental: 0 }
        trauma[inv.seat].mental += 1
      }
      inv.defeated = true
    }
    setFlag(state, 'lostSisterAgenda2Resolved', true)
    safeCall(api, 'finish', NO_RESOLUTION)
    return true
  }
  return false
}

function coastalAnchor(state) {
  const inPlay = (state.locations || []).filter(location => (location.traits || [])
    .some(trait => String(trait).toLowerCase() === 'coastal'))
  const empty = inPlay.filter(location => !(state.investigators || [])
    .some(inv => inv.location === location.id && !inv.defeated && !inv.resigned))
  return empty[0] || inPlay[0] || null
}

function placeFungalCaveAdjacent(state, anchorId, api) {
  const anchor = gridPosition(state, anchorId)
  if (!anchor) return null
  const spaces = adjacentGridSpaces(state, anchorId)
  if (!spaces.length) return null
  return placeCavernLocation(state, FUNGAL_CAVE_ID, spaces[0], api)
}

function fillFungalCaveNeighbors(state, fungalId, api) {
  let guard = 0
  while (neighborsOf(state, fungalId).length < 4 && cavernsDeck(state).length && guard < 8) {
    guard += 1
    if (!placeCavernCardAdjacent(state, fungalId, api)) break
  }
  return neighborsOf(state, fungalId)
}

function nearestCoastalToMostInvestigators(state) {
  const count = location => (state.investigators || [])
    .filter(inv => inv.location === location.id && !inv.defeated && !inv.resigned).length
  const coastal = (state.locations || []).filter(location => (location.traits || [])
    .some(trait => String(trait).toLowerCase() === 'coastal'))
  if (!coastal.length) return null
  return coastal.reduce((best, location) => (count(location) > count(best) ? location : best), coastal[0])
}

function discardRandomCard(state, inv, api) {
  const hand = inv.hand || []
  if (!hand.length) return null
  const index = Math.floor(Math.random() * hand.length)
  const [code] = hand.splice(index, 1)
  inv.discard = [...(inv.discard || []), code]
  info(api, `${inv.name} 随机弃掉 1 张手牌（${ALL_CARDS[code]?.nameZh || code}）。`)
  return code
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------

export function resolveChaosToken(state, inv, token) {
  return theLostSisterChaosToken(state, inv, token)
}

export function chaosTokenValue(state, tokenFace, inv = null) {
  return theLostSisterChaosTokenValue(state, tokenFace, inv)
}

/** 困难/专家：地点有[[异形]]敌人且抽出[elder_thing] → 本次检定自动失败。 */
export function testAutoFail(state, inv, context = {}) {
  if (!isHardSide(state)) return false
  const drawn = context?.drawn || []
  if (!drawn.includes('elderthing')) return false
  return abominationAtInvestigator(state, inv)
}
export function applyTokenEffect(state, inv, effect = {}, api = {}) {
  if (!inv || !effect) return false
  const token = effect.token
  const mode = effect.mode
  const test = effect.test || null
  const succeeded = !test || !Number.isFinite(Number(test.failedBy)) || Number(test.failedBy) <= 0
  if (token === 'cultist') {
    const byTwo = mode === 'healBy2'
    const qualifies = byTwo
      ? (!test || Number(test.failedBy) <= -2)
      : succeeded
    if (!qualifies) return false
    if (typeof api?.healHorror === 'function') api.healHorror(inv.seat, 1)
    else inv.horror = Math.max(0, (Number(inv.horror) || 0) - 1)
    info(api, `[cultist]：${inv.name} 治愈 1 点恐惧。`)
    return true
  }
  if (token === 'elderthing') {
    if (mode === 'autoFail') {
      if (typeof api?.failTest === 'function') api.failTest(inv)
      else if (typeof api?.autoFail === 'function') api.autoFail(inv)
      info(api, `[elder_thing]：${inv.name} 所在地点有[[异形]]敌人，本次检定自动失败。`)
      return true
    }
    if (mode === 'revealAnother') {
      if (typeof api?.revealChaosTokens === 'function') api.revealChaosTokens(1)
      info(api, `[elder_thing]：${inv.name} 再揭示一个混乱标记。`)
      return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// 法典（Codex 4/6/8/Σ/Θ）
// ---------------------------------------------------------------------------

export const CODEX_IDS = Object.freeze({
  williamHemlock: 4,
  gideonMizrah: 6,
  theoPeters: 8,
  lobstrosity: 'Sigma',
  drRosaMarquez: 'Theta',
})

export function codex(state, id, api = {}, seat = state.currentSeat ?? state.campaign?.leadSeat ?? 0) {
  const records = recordsFor(state)
  records.codexRead ||= {}
  if (id === 'williamHemlock') {
    records.codexRead[4] = true
    addRelationship(state, 'williamHemlock', 1)
    records.lostSisterBonusXp = (Number(records.lostSisterBonusXp) || 0) + 1
    info(api, '法典 4：威廉·汉洛克的居民关系 +1，每位调查员获得 1 点奖励经验。')
    return true
  }
  if (id === 'gideonMizrah') {
    records.codexRead[6] = true
    remember(state, REMEMBERED.gideonHeirloom, api)
    info(api, '法典 6：记住「Gideon is searching for an heirloom.」')
    return true
  }
  if (id === 'theoPeters') {
    const arguing = isRemembered(state, REMEMBERED.theoArguing)
    const theo = residentInPlay(state, 'theo')
    const helen = residentInPlay(state, 'helen')
    const sameLocation = Boolean(theo && helen && theo.location === helen.location)
    if (arguing && sameLocation) {
      const result = safeCall(api, 'test', state.currentSeat ?? 0, 'willpower', 4, () => true)
      const success = result && typeof result === 'object' ? result.success === true : result !== false
      if (!success) {
        info(api, '法典 8：意志检定失败，可以再次触发该法典。')
        return false
      }
      records.theoReconciledWithHelen = true
      addRelationship(state, 'theoPeters', 1)
      records.lostSisterBonusXp = (Number(records.lostSisterBonusXp) || 0) + 1
      info(api, '法典 8：希奥与海伦和解，居民关系 +1，每位调查员 1 点奖励经验。')
      return true
    }
    records.codexRead[8] = true
    remember(state, REMEMBERED.theoArguing, api)
    info(api, '法典 8：记住「Theo is arguing with Helen.」')
    return true
  }
  if (id === 'lobstrosity') {
    const theo = residentInPlay(state, 'theo')
    if (records.theoReconciledWithHelen === true) {
      const limulus = (state.enemies || []).find(enemy => LIMULUS_CODES.includes(codeOf(enemy)))
      if (theo && limulus) {
        const moved = Math.min(1, Number(theo.damage) || 0)
        if (moved > 0) {
          theo.damage = (Number(theo.damage) || 0) - moved
          dealDamageToEnemy(state, limulus, moved, api)
        }
      }
      info(api, '法典 Σ：希奥站在你身边（把他身上的 1 点伤害移给鳖类混种）。')
      return true
    }
    removeResidentFromPlay(state, 'theo')
    info(api, '法典 Σ：希奥离开了游戏（从游戏中移除）。')
    return true
  }
  if (id === 'drRosaMarquez') {
    records.codexRead.Theta = true
    const top = cavernsTop(state)
    if (!top) return false
    const answer = typeof api.choose === 'function'
      ? api.choose({
        kind: 'story', seat, prompt: '罗莎·马尔克斯：把岩穴牌库顶放到最近的[[洞穴]]地点旁，或放到牌库底',
        options: [{ id: 'place', label: '放到最近的洞穴旁' }, { id: 'bottom', label: '放到岩穴牌库底' }],
      })
      : 'place'
    if (answer === 'bottom') {
      putCavernsBottom(state, takeCavernsTop(state))
      return true
    }
    const cave = (state.locations || []).find(location => location.revealed
      && hasTrait(location, 'Cave') && adjacentGridSpaces(state, location.id).length)
    if (!cave) {
      putCavernsBottom(state, takeCavernsTop(state))
      return true
    }
    return Boolean(placeCavernCardAdjacent(state, cave.id, api))
  }
  return false
}

function addRelationship(state, resident, amount) {
  const records = recordsFor(state)
  records.relationships ||= {}
  records.relationships[resident] = Math.max(0, (Number(records.relationships[resident]) || 0) + amount)
  return records.relationships[resident]
}

// ---------------------------------------------------------------------------
// 遭遇事件（treachery 条目的 encounterResolve 桥）
// ---------------------------------------------------------------------------

function askChoice(api, seat, prompt, options) {
  if (typeof api?.choose !== 'function') return options[0]
  const answer = api.choose({ kind: 'treachery', source: '10586', seat, prompt, options: options.map(id => ({ id, label: id })) })
  return options.includes(answer) ? answer : options[0]
}

function nearestEnemyTo(state, inv) {
  const here = locationOf(state, inv?.location)
  if (!here) return (state.enemies || [])[0] || null
  const adjacent = new Set(neighborsOf(state, here.id))
  return (state.enemies || []).find(enemy => adjacent.has(enemy.location))
    || (state.enemies || []).find(enemy => enemy.location === here.id)
    || null
}

function healEnemy(state, enemy, amount, api) {
  if (typeof api?.healEnemy === 'function') api.healEnemy(enemy, amount)
  else enemy.damageTaken = Math.max(0, (Number(enemy.damageTaken) || 0) - amount)
  return true
}

export const events = {
  /** 10586 重属自然：白日[combat] / 黑夜[willpower] (3)，失败二选一。 */
  lostSisterReclaimedByNature(state, payload = {}, api = {}) {
    const inv = (state.investigators || [])[payload.seat]
    if (!inv) return false
    const location = locationOf(state, inv.location)
    const night = payload.night != null ? Boolean(payload.night) : (location ? isDarkLocation(state, location) : false)
    const result = safeCall(api, 'test', inv.seat, night ? 'willpower' : 'combat', 3, () => true)
    const success = result && typeof result === 'object' ? result.success === true : result !== false
    if (success) return false
    if (night) {
      const enemies = (state.enemies || []).filter(enemy => enemy.location === inv.location
        || neighborsOf(state, inv.location).includes(enemy.location))
      if (!enemies.length) {
        harmInvestigator(state, inv, { horror: 2 }, api)
        return true
      }
      const choice = askChoice(api, inv.seat, '重属自然（黑夜）：受到 2 点恐惧，或让这些敌人各治愈 1 点伤害', ['horror', 'heal'])
      if (choice === 'heal') {
        for (const enemy of enemies) healEnemy(state, enemy, 1, api)
        info(api, '重属自然：所在地点与连接地点的每个敌人治愈 1 点伤害。')
        return true
      }
      harmInvestigator(state, inv, { horror: 2 }, api)
      return true
    }
    const nearest = nearestEnemyTo(state, inv)
    if (!nearest) {
      harmInvestigator(state, inv, { damage: 2 }, api)
      return true
    }
    const choice = askChoice(api, inv.seat, '重属自然（白日）：受到 2 点伤害，或让最近的敌人攻击你', ['damage', 'attack'])
    if (choice === 'attack') {
      const attacked = safeCall(api, 'enemyAttacks', nearest, inv)
      if (attacked === false || attacked == null) {
        info(api, `「${nearest.name}」攻击 ${inv.name}。`)
        harmInvestigator(state, inv, { damage: Number(nearest.damage) || 1, horror: Number(nearest.horror) || 0 }, api)
      }
      return true
    }
    harmInvestigator(state, inv, { damage: 2 }, api)
    return true
  },
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
// P8：印刷链 R1 →（R2/R3）→ R4 的 `skipTo` 引擎不跟随；本章自己把链上后续记录一次落账。
function applyChainRecords (records, next) {
  if (next === 'resolution2') records.thePetersFamilyWasReunited = true; else if (next === 'resolution3') records.elizabethPetersWasSaved = true
  records.lostSisterResolutionFinal = 'resolution4'; records.akwanShorelineSurveyed = true; records.areasSurveyed ||= {}; records.areasSurveyed.akwanShoreline = true
}

export function resolution(state, key, events = null, api = {}) {
  void events
  const records = recordsFor(state)
  const infoApi = api?.info ? api : api?.api || {}
  const bonusXp = Number(records.lostSisterBonusXp) || 0
  if (!RESOLUTION_KEYS.includes(key)) throw new RangeError(`未知结局：${key}`)
  if (key === NO_RESOLUTION) {
    records.lostSisterResolution = NO_RESOLUTION
    records.lostSisterNoResolution = true
    applyChainRecords(records)
    info(infoApi, '无结局：每位调查员获得 1 点奖励经验，然后进入结局 4。')
    return { bonus: 1 + bonusXp, award: true, skipTo: 'resolution4' }
  }
  if (key === 'resolution1') {
    records.lostSisterResolution = key
    const next = records.theoReconciledWithHelen === true ? 'resolution2' : 'resolution3'
    records.lostSisterResolutionNext = next
    applyChainRecords(records, next)
    info(infoApi, `结局 1：${next === 'resolution2' ? '进入结局 2' : '进入结局 3'}。`)
    return { bonus: bonusXp, award: true, skipTo: next }
  }
  if (key === 'resolution2') {
    records.lostSisterResolution = key
    applyChainRecords(records, 'resolution2')
    info(infoApi, '结局 2：记录「The Peters family was reunited」。每位调查员 2 点奖励经验。')
    return { bonus: 2 + bonusXp, award: true }
  }
  if (key === 'resolution3') {
    records.lostSisterResolution = key
    applyChainRecords(records, 'resolution3')
    info(infoApi, '结局 3：记录「Elizabeth Peters was saved」。每位调查员 2 点奖励经验。')
    return { bonus: 2 + bonusXp, award: true }
  }
  // 结局 4：胜利区经验 + 阿夸望海岸勘察；吉迪恩的传家宝在「至少 2 个线索」时找到。
  records.lostSisterResolution = key
  applyChainRecords(records)
  const clues = (state.investigators || []).reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
  const gideonBonus = isRemembered(state, REMEMBERED.gideonHeirloom) && clues >= 2
  if (gideonBonus) {
    addRelationship(state, 'gideonMizrah', 1)
    records.gideonFoundHisTreasure = true
  }
  const victoryXp = (state.victoryDisplay || []).reduce((sum, entry) => sum + (Number(entry.victory) || 0), 0)
  info(infoApi, `结局 4：勘察阿克望海岸；胜利区经验 ${victoryXp}${gideonBonus ? '；吉迪恩找到传家宝（+1）' : ''}。`)
  return { bonus: victoryXp + (gideonBonus ? 1 : 0) + bonusXp, award: true }
}

// ---------------------------------------------------------------------------
// 导出给测试/主进程的只读投影
// ---------------------------------------------------------------------------

export function scenarioSummary(state) {
  return {
    day: dayOf(state),
    night: isNight(state),
    intro: introBranchKey(state),
    revealedCaves: revealedCaveCount(state),
    skull: skullValue(state),
    cavernsRemaining: cavernsRemaining(state),
    remembered: { ...rememberedFor(state) },
    hybrids: hybridsInPlay(state).map(enemy => ({ id: enemy.id, code: codeOf(enemy), location: enemy.location })),
    darkLocations: darkLocationsInPlay(state).map(location => location.id),
  }
}

export function implementedEntryFlags(code) {
  return entryOf(code)?.flags || {}
}

export const behavior = {
  id: CHAPTER_ID,
  startLocation: () => START_LOCATION,
  locationsStartRevealed: false,
  preScenarioSetup,
  modifyDeck,
  setupLocations,
  setupEnemies,
  afterDeckSetup,
  locationPlaced,
  locationRevealed,
  actions,
  performAction,
  cluesGained,
  investigatorEntryError,
  beforeMove,
  locationEntered,
  locationLeft,
  enemySpawned,
  enemyMoved,
  enemyDefeated,
  enemyStatModifier,
  enemyAttackModifier,
  enemyDamageAmount,
  canOpportunityAttack,
  roundEnded,
  turnEnded,
  phaseBegan,
  actReveal,
  agendaReveal,
  checkObjectives,
  resolveChaosToken,
  chaosTokenValue,
  testAutoFail,
  applyTokenEffect,
  events,
  resolution,
  codex,
  // 具名助手（测试与主进程验收用）
  dayOf,
  isNight,
  introFor,
  isDarkLocation,
  darkLocationsInPlay,
  suppressedDarkIds,
  syncHybrids,
  syncHybridAt,
  flipHybrid,
  hybridsInPlay,
  hybridGroupOf,
  enemyDefinitionFor,
  enemyHealthFor,
  spawnSetAsideEnemy,
  spawnLostSisterEnemy,
  placeCavernCardAdjacent,
  placeCavernLocation,
  buildCavernsDeck,
  cavernsDeck,
  cavernsTop,
  takeCavernsTop,
  lookAtCavernsTop,
  putCavernsBottom,
  cavernsRemaining,
  investigatorEntryError,
  isDarkLocation,
  locationOf,
  revealCave: locationRevealed,
  remember,
  isRemembered,
  hasBothMemories,
  residentsInPlay,
  residentInPlay,
  scenarioSummary,
  luminousGrowthLocations,
  neighborsOf,
  implementedEntryFlags,
  events,
}

export { ACT_CODES, AGENDA_CODES, AGENDAS, ACTS, SET_ASIDE_ENEMY_CODES, START_LOCATION, FUNGAL_CAVE_ID }
