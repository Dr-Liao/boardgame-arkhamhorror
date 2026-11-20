// 养育场（theApiary · 11553）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/TheDrownedCity/TheApiary.hs +
//       Scenarios/TheDrownedCity/TheApiary/Helpers.hs（apiaryPositions / ApiaryMeta 旋转）+
//       Act|Agenda|Location|Enemy|Story|Treachery/Cards/TheDrownedCity/TheApiary/*.hs。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   introduction / preScenarioSetup → 东西向分支与开场
//   setupLocations / locationPlaced → 养育场入口 + 地点网格坐标（遭遇牌库进入的地点按印刷位置）
//   modifyDeck → 东向把西向专属组换成东向专属组（默认 manifest 牌库为西向）
//   afterDeckSetup → 放一边/移出游戏、隐藏地点洗入牌库底 10 张、中央腔室初始面朝
//   actions / performAction → 幕 1 弃牌换地点、失落的朝圣者谈判、蜂巢思维线索伤敌、地点行动
//   roundEnded → 蜂巢思维：掷币顺时针/逆时针旋转中央腔室
//   doomPlaced → 可憎寄生虫正面：没有非精英敌人时从遭遇牌库顶翻到一名敌人生成
//   actReveal / agendaReveal / checkObjectives → 幕 1 背面东西两段幕间、幕 2 背面结局、
//     议题 1/2 背面
//   enemyDefeated / enemyAttackResolved → 主母伤害转嫁/被击败目标、带鳞寄生虫翻面
//   resolveChaosToken / applyTokenEffect → 11553 四档混乱标记
//   resolution → 结局 1/2/3/4 与无结局、战役记录（thePilgrimsWereSaved /
//     thePilgrimsWereDevoured / theInvestigatorsExterminatedTheAlienParasites / grislyMask /
//     rlyehMap）与跳章（结局 4 → theDrownedQuarter / theWesternWall）。
//
// 近似（如实记录，见 worker 报告）：
//   · 「查找遭遇牌库/弃牌堆/场外区域把全部非弱点[[异教徒]]敌人叠到迷失营地下」用
//     scenarioZones.apiaryCultistsUnder 记卡号；没有在遭遇牌库中的弱点实体路径。
//   · 结局 2 / 无结局的「每张寄生变形加入牌组」用 api.campaignCard 若可用，否则记
//     scenarioFlags.apiaryParasiticTransformation。
//   · 酸性体腔「额外费用」、养育场看守「毁灭触发」、奇丑混种「武器毁灭」等没有既有读点，
//     只在单卡条目 note 声明，未接线。
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { mechanicState } from '../../../../../src/engine/mechanic-state.js'
import { connectGrid, gridPosition } from '../../../../../src/engine/grid-map.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  ACT1_CODE, ACT2_EAST_CODE, ACT2_WEST_CODE, ACT_CODES_BY_DIRECTION, AGENDA1_CODE, AGENDA2_CODE,
  ANCIENT_RELIC_CODE, ANCIENT_RELIC_STORY_CODE, APIARY_TENDER_CODE, CENTRAL_CHAMBER_ID,
  DECK_LOCATION_CODES, ENCOUNTER_DECK, ENCOUNTER_DECK_BY_DIRECTION, ENCOUNTER_DECK_EAST,
  ENCOUNTER_DECK_WEST, FACING_RING, GRISLY_MASK_CODE, GROTESQUE_AMALGAM_CODE,
  HIDDEN_LOCATION_BY_DIRECTION, HIDDEN_VAULT_STORY_CODE, INITIAL_FACING, LOCATION_COORDINATES,
  LOCATIONS, LOCATION_CONNECTIONS, LOCATION_IDS, MARIA_RIVERA_CODE, MOTHER_CODE,
  PARASITIC_TRANSFORMATION_CODE, REMOVED_BY_DIRECTION, RESOLUTION4_NEXT, RESOLUTION_KEYS,
  RESOLUTION_NEXT, SANCTUM_LOCATION_IDS, SET_ASIDE_ALIASES, SET_ASIDE_LOCATION_IDS,
  SQUAMOUS_PARASITE_CODE, SQUAMOUS_PARASITE_STORY_CODE, START_LOCATION, THE_INESCAPABLE_CODES,
  TREACHERY_CODES, VICTORY_LOCATION_IDS, scenario,
} from './definition.js'
import {
  APIARY_TOKEN_MEANINGS, CHAOS_TOKEN_FACES, apiaryChaosToken, apiaryChaosTokenValue,
  cultistEnemyAtLocation, doomInPlay, enemiesAtLocation, isHardSide, skullValue,
} from './chaos.js'

const CHAPTER_ID = 'theApiary'

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------
const activeInvestigators = state => (state.investigators || [])
  .filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
const info = (api, message) => api?.info?.(message)
const codeOf = value => String(value?.originalCode || value?.code || '')
const clone = value => structuredClone(value)
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
const zonesFor = state => (state.scenarioZones ||= {})
export const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const locationByCode = (state, code) => (state?.locations || [])
  .find(location => String(location.originalCode || location.code) === String(code)) || null
const entryOf = code => (code ? registeredEntry(String(code)) : null)
const flagsOf = code => entryOf(code)?.flags || {}
const currentAct = state => (state.acts || [])[state.actIndex ?? 0] || null
const currentActCode = state => codeOf(currentAct(state))
const currentAgenda = state => (state.agendas || [])[state.agendaIndex ?? 0] || null
const currentAgendaCode = state => codeOf(currentAgenda(state))
const motherInPlay = state => (state.enemies || []).find(enemy => codeOf(enemy) === MOTHER_CODE) || null
const hasTrait = (value, trait) => (value?.traits || [])
  .some(item => String(item).toLowerCase() === String(trait).toLowerCase())
const randomOf = api => (typeof api?.random === 'function' ? api.random : () => 0.5)
function localShuffle(list, random = Math.random) {
  const result = [...list]
  for (let index = result.length - 1; index > 0; index--) {
    const pick = Math.floor(random() * (index + 1))
    ;[result[index], result[pick]] = [result[pick], result[index]]
  }
  return result
}
function resolveShuffle(api, helper = {}) {
  if (typeof api?.shuffle === 'function') return list => api.shuffle([...list])
  if (typeof helper?.shuffle === 'function') return list => helper.shuffle([...list])
  return null
}
const shuffled = (list, shuffle, random) => (shuffle ? [...shuffle([...list])] : localShuffle(list, random))

// ---------------------------------------------------------------------------
// 方向 / 记录
// ---------------------------------------------------------------------------
export function expeditionDirection(state) {
  return recordsFor(state).theExpeditionHeadedWest === true ? 'west' : 'east'
}
export const headedWest = state => expeditionDirection(state) === 'west'

export function creatureWasDefeated(state) {
  return recordsFor(state).theCreatureWasDefeated === true
}

export function prepareScenario(state, api = {}) {
  if (state.scenarioFlags?.apiaryPrepared) return state.scenarioFlags.apiaryReport
  const direction = expeditionDirection(state)
  setFlag(state, 'apiaryDirection', direction)
  const actSource = state.scenario?.stageCards || scenario.stageCards
  const actCodes = ACT_CODES_BY_DIRECTION[direction]
  state.acts = actCodes
    .map(code => actSource?.[code] || scenario.acts.find(act => codeOf(act) === code))
    .filter(Boolean).map(act => clone(act))
  if (state.acts.length < 2) {
    state.acts = [scenario.acts[0], scenario.acts[1], scenario.acts[2]]
      .filter(act => act && actCodes.includes(codeOf(act))).map(act => clone(act))
  }
  const agendaSource = state.scenario?.agendas || scenario.agendas
  state.agendas = [clone(agendaSource[0]), clone(agendaSource[1])]
  state.actIndex = Number.isInteger(state.actIndex) ? state.actIndex : 0
  state.agendaIndex = Number.isInteger(state.agendaIndex) ? state.agendaIndex : 0
  const removed = [...(REMOVED_BY_DIRECTION[direction] || [])]
  const report = {
    direction,
    actCodes: [...actCodes],
    agendaCodes: [AGENDA1_CODE, AGENDA2_CODE],
    removed,
    hiddenLocation: HIDDEN_LOCATION_BY_DIRECTION[direction],
  }
  setFlag(state, 'apiaryReport', report)
  setFlag(state, 'apiaryPrepared', true)
  info(api, `养育场：${direction === 'west' ? '西向（朝圣者线）' : '东向（蜂巢思维线）'}；`
    + `移出 ${removed.join('、') || '无'}。`)
  return report
}

export function preScenarioSetup(state, events = null, helperOrApi = {}) {
  void events
  const api = helperOrApi?.api || helperOrApi || {}
  return { ...prepareScenario(state, api), introText: introFor(state) }
}

export function introFor(state) {
  const key = headedWest(state) ? 'headedWest' : 'headedEast'
  return { key, text: scenario.introBranches[key] || '' }
}

export function introduction(sc, records = {}, context = null) {
  const state = context?.campaign ? context : { campaign: { records } }
  const west = recordsFor({ ...state, campaign: { records } }).theExpeditionHeadedWest === true
  const sections = [{
    title: scenario.name,
    paragraphs: [scenario.intro, west ? scenario.introBranches.headedWest : scenario.introBranches.headedEast]
      .filter(Boolean),
  }]
  return { version: 3, title: sc?.name || scenario.name, sections, paragraphs: sections[0].paragraphs, code: ACT1_CODE }
}

// ---------------------------------------------------------------------------
// 网格 / 地点入场
// ---------------------------------------------------------------------------
function syncConnections(state) {
  try {
    connectGrid(state)
  } catch {
    // 纯数据测试没有网格容器时忽略。
  }
  return (state.locations || []).map(location => location.id)
}

export function writeGridCell(state, locationId, cell) {
  const data = mechanicState(state, true)
  data.grid ||= {}
  data.grid[locationId] = { x: cell.x, y: cell.y, isolated: false, connections: [] }
  const location = locationOf(state, locationId)
  if (location) location.grid = { x: cell.x, y: cell.y }
  return data.grid[locationId]
}

function locationInstance(state, locationId, { revealed }) {
  const base = state.scenario?.locations?.[locationId] || LOCATIONS[locationId]
  if (!base) return null
  const definition = clone(base)
  const clues = definition.cluesFixed ?? (definition.cluesPerInvestigator != null
    ? definition.cluesPerInvestigator * investigatorCount(state)
    : Number(definition.clues) || 0)
  return {
    ...definition, id: locationId, revealed,
    clues: revealed ? clues : 0, maxClues: clues,
    connections: [...LOCATION_CONNECTIONS[locationId] || []],
    symbolLinks: [...LOCATION_CONNECTIONS[locationId] || []],
    attachments: [], damage: 0, horror: 0, resources: 0, doom: 0,
  }
}

export function placeLocationAt(state, locationId, api = {}, { revealed = true } = {}) {
  const cell = LOCATION_COORDINATES[locationId]
  if (cell) writeGridCell(state, locationId, cell)
  const inPlay = locationOf(state, locationId)
  if (!inPlay) {
    const instance = locationInstance(state, locationId, { revealed })
    if (!instance) return null
    state.locations ||= []
    state.locations.push(instance)
    locationPlaced(state, instance, api)
  }
  const location = locationOf(state, locationId)
  if (revealed && location && location.revealed !== true) {
    location.revealed = true
    location.clues = Math.max(0, Number(location.maxClues) || 0)
    delete location.hiddenIdentity
  }
  syncConnections(state)
  applyCentralFacing(state, api)
  return locationId
}

export function setupLocations(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  const report = prepareScenario(state, api)
  writeGridCell(state, START_LOCATION, LOCATION_COORDINATES[START_LOCATION])
  setFlag(state, 'apiarySetup', report)
  return [START_LOCATION]
}

export function locationPlaced(state, location, api = {}, seat = null) {
  void seat
  if (!location) return
  const cell = LOCATION_COORDINATES[location.id]
  if (cell && !gridPosition(state, location.id)) writeGridCell(state, location.id, cell)
  const grid = gridPosition(state, location.id)
  if (grid) location.grid = { x: grid.x, y: grid.y }
  location.symbolLinks = [...(LOCATION_CONNECTIONS[location.id] || [])]
  if (location.id === START_LOCATION) {
    location.revealed = true
    location.clues = Math.max(0, Number(location.maxClues) || investigatorCount(state) * 1)
  }
  syncConnections(state)
  applyCentralFacing(state, api)
}

/** 按印刷卡号找地点 id（含双面卡背面卡号）。 */
export function locationIdForCode(code) {
  return LOCATION_IDS.find(id => LOCATIONS[id].code === String(code)
    || LOCATIONS[id].linkedCode === String(code)) || null
}

/** 遭遇牌库中的地点被翻开时：放入场地、分配网格坐标并结算该地点的显现。 */
export function revealApiaryLocation(state, code, api = {}, seat = null) {
  const locationId = locationIdForCode(code)
  if (!locationId) return false
  const definition = LOCATIONS[locationId]
  let location = locationOf(state, locationId)
  if (!location) {
    const placed = typeof api?.placePrintedLocation === 'function'
      ? api.placePrintedLocation(definition.code, { seat, reveal: true })
      : placeLocationAt(state, locationId, api, { revealed: true })
    if (!placed) return false
    location = locationOf(state, locationId)
  } else if (location.revealed !== true) {
    if (typeof api.reveal === 'function') api.reveal(location.id, seat)
    else {
      location.revealed = true
      location.clues = Math.max(0, Number(location.maxClues) || 0)
    }
  }
  if (!location) return false
  applyRevelation(state, location, api, seat)
  syncConnections(state)
  return true
}

/** 地点印刷的「显现」效果（Haskell Cards/TheDrownedCity/TheApiary/*.hs）。 */
export function applyRevelation(state, location, api = {}, seat = null) {
  void seat
  if (!location) return false
  const code = codeOf(location)
  const marker = `apiaryRevealed:${code}`
  if (state.scenarioFlags?.[marker]) return false
  setFlag(state, marker, true)
  const bottomTen = (codes) => shuffleIntoBottom(state, codes, api, 10)
  switch (code) {
    case '11562': // 增生原野：与隐藏秘库一同入场。
      if (!locationOf(state, 'hiddenVault')) placeLocationAt(state, 'hiddenVault', api, { revealed: false })
      break
    case '11563': // 翻涌裂隙：生成放一边的带鳞寄生虫。
      spawnEnemy(state, SQUAMOUS_PARASITE_CODE, location.id, api)
      break
    case '11565': // 荧光通道：朝圣者组 + 弃牌堆洗回牌库；繁殖地/腐化秘库入牌库底 10。
      shuffleEncounterDiscardBackIn(state, api)
      shuffleSetAsideIntoDeck(state, ['11723', '11724'], api)
      bottomTen([LOCATIONS.spawningGrounds.code, LOCATIONS.corruptedVault.code])
      break
    case '11566': // 繁殖地：弃牌堆洗回牌库；迷失营地/翻涌裂隙入牌库底 10。
      shuffleEncounterDiscardBackIn(state, api)
      bottomTen([LOCATIONS.lostCampsite.code, LOCATIONS.churningChasm.code])
      break
    case '11569': // 攫噬长廊：弃牌堆洗回牌库；饥渴长廊/腐化秘库入牌库底 10。
      shuffleEncounterDiscardBackIn(state, api)
      bottomTen([LOCATIONS.starvingCorridor.code, LOCATIONS.corruptedVault.code])
      break
    case '11570': // 饥渴长廊：弃牌堆洗回牌库；酸性体腔/翻涌裂隙入牌库底 10。
      shuffleEncounterDiscardBackIn(state, api)
      bottomTen([LOCATIONS.acidicCoelom.code, LOCATIONS.churningChasm.code])
      break
    case '11579': // 隐藏秘库：进场后从遭遇牌库与弃牌堆找一名敌人生成在此。
      searchEnemyToLocation(state, location.id, api)
      break
    case '11572': // 中央腔室：按面朝顺序接入动态连接。
      applyCentralFacing(state, api)
      break
    default:
      break
  }
  return true
}

// ---------------------------------------------------------------------------
// 中央腔室面朝 / 旋转
// ---------------------------------------------------------------------------
export function centralFacing(state) {
  const facing = state.scenarioFlags?.apiaryFacing
  return FACING_RING.includes(facing) ? facing : INITIAL_FACING
}

function setCentralFacing(state, locationId, api = {}) {
  if (!FACING_RING.includes(locationId)) return false
  setFlag(state, 'apiaryFacing', locationId)
  info(api, `中央腔室面朝「${locationOf(state, locationId)?.name || locationId}」。`)
  return applyCentralFacing(state, api)
}

/** 中央腔室 ↔ 面朝环位的双向动态连接（旧面朝的连接同时移除）。 */
export function applyCentralFacing(state, api = {}) {
  const central = locationOf(state, CENTRAL_CHAMBER_ID)
  if (!central) return false
  const facingId = centralFacing(state)
  const faced = locationOf(state, facingId)
  const baseConnections = LOCATION_CONNECTIONS[CENTRAL_CHAMBER_ID] || []
  central.connections = [...new Set([...baseConnections, ...(faced ? [facingId] : [])])]
  for (const id of FACING_RING) {
    const ring = locationOf(state, id)
    if (!ring || id === facingId) continue
    ring.connections = (ring.connections || []).filter(connection => connection !== CENTRAL_CHAMBER_ID)
  }
  if (faced) {
    faced.connections = [...new Set([...(faced.connections || []), CENTRAL_CHAMBER_ID])]
  }
  const cells = mechanicState(state)?.grid || {}
  if (cells[CENTRAL_CHAMBER_ID]) {
    cells[CENTRAL_CHAMBER_ID].connections = [...central.connections]
  }
  info(api, `中央腔室连接：${central.connections.map(id => locationOf(state, id)?.name || id).join('、') || '无'}。`)
  return true
}

export function rotateCentralChamber(state, direction = 'clockwise', api = {}) {
  const current = FACING_RING.indexOf(centralFacing(state))
  const step = direction === 'counterclockwise' ? -1 : 1
  const next = FACING_RING[(current + step + FACING_RING.length) % FACING_RING.length]
  setCentralFacing(state, next, api)
  setFlag(state, 'apiaryCentralRotations', (Number(state.scenarioFlags?.apiaryCentralRotations) || 0) + 1)
  return next
}

// ---------------------------------------------------------------------------
// 遭遇牌库操作
// ---------------------------------------------------------------------------
function encounterDeck(state) {
  return state.encounterDeck || (state.encounterDeck = [])
}
function takeFromDeck(state, code) {
  const deck = encounterDeck(state)
  const index = deck.indexOf(code)
  if (index < 0) return false
  deck.splice(index, 1)
  return true
}
export function shuffleIntoBottom(state, codes, api = {}, count = 10) {
  const deck = encounterDeck(state)
  const fromSetAside = (codes || []).filter(code => takeFromSetAside(state, code) || takeFromDeck(state, code))
  // 引擎的遭遇牌库数组是栈：顶部 = 末尾，底部 = 开头；「底 10 张」= 前 10 张。
  const depth = Math.min(count, Math.max(0, deck.length))
  const bottom = deck.splice(0, depth)
  const random = randomOf(api)
  const merged = shuffled([...fromSetAside, ...bottom], resolveShuffle(api), random)
  deck.unshift(...merged)
  return merged
}
function shuffleEncounterDiscardBackIn(state, api = {}) {
  const discard = state.encounterDiscard || []
  if (!discard.length) return 0
  state.encounterDiscard = []
  encounterDeck(state).push(...discard)
  const random = randomOf(api)
  state.encounterDeck = shuffled(encounterDeck(state), resolveShuffle(api), random)
  return discard.length
}
function shuffleSetAsideIntoDeck(state, codes, api = {}) {
  const moved = []
  for (const code of codes || []) {
    // 同一组可能有 2–3 份物理副本：全部搬走。
    while (takeFromSetAside(state, code) || takeFromDeck(state, code)) moved.push(code)
  }
  if (!moved.length) return 0
  encounterDeck(state).push(...moved)
  const random = randomOf(api)
  state.encounterDeck = shuffled(encounterDeck(state), resolveShuffle(api), random)
  return moved.length
}
function takeFromSetAside(state, code) {
  const zones = zonesFor(state)
  const list = (zones.setAside ||= [])
  const index = list.indexOf(code)
  if (index < 0) return false
  list.splice(index, 1)
  return true
}

/** 从遭遇牌库（再弃牌堆）找一名敌人生成到指定地点。 */
export function searchEnemyToLocation(state, locationId, api = {}) {
  for (const pile of ['encounterDeck', 'encounterDiscard']) {
    const list = state[pile] || []
    for (let index = list.length - 1; index >= 0; index--) {
      const code = list[index]
      const card = ALL_CARDS[code]
      if (card?.type !== 'enemy') continue
      list.splice(index, 1)
      const enemy = spawnEnemy(state, code, locationId, api)
      if (enemy) {
        info(api, `从遭遇${pile === 'encounterDeck' ? '牌库' : '弃牌堆'}找出「${card.nameZh || card.name}」生成在「${locationOf(state, locationId)?.name || locationId}」。`)
        if (pile === 'encounterDeck') shuffleEncounterDeckLocal(state, api)
        return enemy
      }
      list.push(code)
    }
  }
  return null
}
function shuffleEncounterDeckLocal(state, api = {}) {
  const random = randomOf(api)
  state.encounterDeck = shuffled(encounterDeck(state), resolveShuffle(api), random)
}

// ---------------------------------------------------------------------------
// Setup 完整直调入口
// ---------------------------------------------------------------------------
export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  const direction = expeditionDirection(state)
  const zones = zonesFor(state)
  let setAside = [...SET_ASIDE_LOCATION_IDS.map(id => LOCATIONS[id].code), ...SET_ASIDE_ALIASES]
  const removed = [...(REMOVED_BY_DIRECTION[direction] || [])]
  if (direction === 'west') {
    // 西向：朝圣者组与穷途异魔组放一边（已在 SET_ASIDE_ALIASES 里）。
  } else {
    // 东向不取朝圣者组（不在本局）→ 从牌库/放一边移除；主母改为放一边。
    setAside = setAside.filter(code => !['11723', '11724'].includes(code))
    removed.push('11723', '11723', '11723', '11724')
    setAside.push(MOTHER_CODE)
    // 穷途异魔组：生物已被击败 → 移出游戏；否则放一边（默认已在别名表里）。
    if (creatureWasDefeated(state)) {
      setAside = setAside.filter(code => !THE_INESCAPABLE_CODES.includes(code))
      removed.push(...THE_INESCAPABLE_CODES, THE_INESCAPABLE_CODES[1], THE_INESCAPABLE_CODES[1])
    }
  }
  // 西向主母 / 东向玛莉亚移出游戏（RemovedByDirection）：同卡不能同时放一边。
  setAside = setAside.filter(code => !removed.includes(code))
  zones.setAside = setAside
  zones.removed = removed
  // 隐藏地点洗入遭遇牌库底 10 张（从放一边区取出；shuffleIntoBottom 负责移除）。
  const hiddenId = HIDDEN_LOCATION_BY_DIRECTION[direction]
  const hiddenCode = LOCATIONS[hiddenId].code
  shuffleIntoBottom(state, [hiddenCode], api, 10)
  zones.setAside = zones.setAside.filter(code => code !== hiddenCode)
  // 中央腔室初始面朝：底边朝向酸性体腔。
  setFlag(state, 'apiaryFacing', INITIAL_FACING)
  syncConnections(state)
  info(api, `养育场放一边 ${zones.setAside.length} 张；隐藏地点 ${hiddenCode} 洗入牌库底 10 张。`)
  return { direction, setAside: [...zones.setAside], removed: [...zones.removed] }
}

/** 直调/单测入口：等价于引擎 Setup 全流程。 */
export function setupScenario(state, api = {}) {
  state.locations = []
  state.enemies ||= []
  state.storyAssets ||= []
  state.scenarioFlags ||= {}
  delete state.scenarioFlags.apiaryPrepared
  delete state.scenarioFlags.apiaryReport
  const report = prepareScenario(state, api)
  lockDirection(state)
  setupLocations(state, null, { api })
  const start = placeLocationAt(state, START_LOCATION, api, { revealed: true })
  state.investigators ||= []
  for (const inv of state.investigators) if (!inv.location) inv.location = START_LOCATION
  if (!state.encounterDeck?.length) {
    state.encounterDeck = [
      ...(state.scenario?.encounterDeckByDirection?.[expeditionDirection(state)]
        || ENCOUNTER_DECK_BY_DIRECTION[expeditionDirection(state)] || ENCOUNTER_DECK),
    ]
  }
  afterDeckSetup(state, null, { api })
  void start
  info(api, `养育场 Setup：入口入场，${state.encounterDeck.length} 张遭遇牌库，朝圣者线=${expeditionDirection(state) === 'west'}。`)
  return { ...report, placedIds: [START_LOCATION], deck: state.encounterDeck.length }
}

function lockDirection(state) {
  setFlag(state, 'apiaryDirection', expeditionDirection(state))
}

export function modifyDeck(state, deck, events = null, helper = {}) {
  void events
  void helper
  const direction = expeditionDirection(state)
  if (direction === 'west') return [...deck]
  const westOnly = new Set(['11723', '11724', '01169', '01170', '01171'])
  const eastOnly = ['11726', '11721', '11721', '11721', '11722', '11722', '11722']
  return [...deck.filter(code => !westOnly.has(code)), ...eastOnly]
}

// ---------------------------------------------------------------------------
// 遭遇牌库 / 胜利区查询
// ---------------------------------------------------------------------------
export function cultistCardsUnderAct(state) {
  return [...(state.scenarioFlags?.apiaryCultistsUnder || [])]
}
export function cultistCardsInVictory(state) {
  const cultistCodes = new Set(Object.entries(ALL_CARDS)
    .filter(([, card]) => card.type === 'enemy' && (card.traits || []).includes('Cultist'))
    .map(([code]) => code))
  return (state.victoryDisplay || []).filter(entry => cultistCodes.has(codeOf(entry)))
}
export function cultistCardCount(state) {
  return cultistCardsUnderAct(state).length + cultistCardsInVictory(state).length
}

// ---------------------------------------------------------------------------
// 行动
// ---------------------------------------------------------------------------
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
  if (!here) return []
  const moves = []
  const actCode = currentActCode(state)
  const required = investigatorCount(state)
  const hereCode = codeOf(here)
  // 幕 1：调查员共同花费 1 个或更多线索：每花费 1 个线索，从遭遇牌库顶弃 5（单人 10）张，
  // 并抽取以此效果弃掉的每处地点。
  if (actCode === ACT1_CODE && groupCluesAt(state, here.id) > 0) {
    moves.push({
      action: 'scenarioAction', rule: 'apiaryDiscardForLocations', locationId: here.id, actions: 1,
      label: '共同花费线索：每 1 个线索从遭遇牌库顶弃 5 张（单人 10 张），并抽取弃掉的地点',
    })
  }
  // 失落的朝圣者：与所在地点的[[异教徒]]敌人谈判（智力(2) / 战力(2)）。
  if (actCode === ACT2_WEST_CODE) {
    const cultist = (state.enemies || []).find(enemy => enemy.location === here.id && hasTrait(enemy, 'Cultist'))
    if (cultist) {
      moves.push({
        action: 'scenarioAction', rule: 'apiaryParleyCultist', locationId: here.id, actions: 1, enemyId: cultist.id,
        label: `谈判：检定智力(2)或战力(2)，成功超出每 1 点让你所在地点一名[[异教徒]]敌人移动一次`,
      })
    }
  }
  // 蜂巢思维：[fast] 在你所在地点放置 X 个线索（从你的线索池）：对所在地点一名非精英敌人造成 X 点伤害。
  if (actCode === ACT2_EAST_CODE) {
    const target = (state.enemies || []).find(enemy => enemy.location === here.id
      && !hasTrait(enemy, 'Elite') && codeOf(enemy) !== MOTHER_CODE)
    if (target) {
      const available = Number(inv.clues) || 0
      moves.push({
        action: 'scenarioAction', rule: 'apiaryCluesForDamage', locationId: here.id, actions: 0, enemyId: target.id,
        label: `[fast] 放置 X 个线索：对「${target.name}」造成 X 点伤害`,
        reason: available > 0 ? null : '你至少有 1 个线索才能使用',
      })
    }
  }
  // 增生原野：意志(8) → 控制放一边的骇人「面具」。
  if (hereCode === '11562' && !anyInvestigatorControls(state, GRISLY_MASK_CODE)
    && !state.scenarioFlags?.apiaryGrislyMaskTaken) {
    moves.push({
      action: 'scenarioAction', rule: 'apiaryGrislyMask', locationId: here.id, actions: 1,
      label: '检定意志(8)：成功则控制放一边的骇人「面具」',
    })
  }
  // 血肉道路（东侧）：智力(2) 搜寻肉壁 → 控制放一边的古代遗物。
  if (hereCode === '11560' && !anyInvestigatorControls(state, ANCIENT_RELIC_CODE)) {
    moves.push({
      action: 'scenarioAction', rule: 'apiaryAncientRelic', locationId: here.id, actions: 1,
      label: '检定智力(2)：成功则控制放一边的古代遗物',
    })
  }
  // 养育场入口（引诱之光）：[fast] 每轮一次，在离入口最远的地点放线索直到其线索值。
  if (hereCode === '11559' && !state.scenarioFlags?.[`apiaryEntranceFast:${state.round}`]) {
    moves.push({
      action: 'scenarioAction', rule: 'apiaryEntranceFast', locationId: here.id, actions: 0,
      label: '[fast]（每轮一次）在离养育场入口最远的地点放置线索直到其线索值',
    })
  }
  // 腐化秘库 [action][action] 发现符文 Q。
  if (hereCode === '11564' && !glyphsKnown(state, 'q')) {
    moves.push({ action: 'scenarioAction', rule: 'apiaryGlyphQ', locationId: here.id, actions: 2, label: '发现符文 [Q]（手）' })
  }
  // 血肉道路（西侧）[action] 发现符文 R。
  if (hereCode === '11561' && !glyphsKnown(state, 'r')) {
    moves.push({ action: 'scenarioAction', rule: 'apiaryGlyphR', locationId: here.id, actions: 1, label: '发现符文 [R]（时间）' })
  }
  return moves
}

function anyInvestigatorControls(state, code) {
  return (state.investigators || []).some(inv => (inv.assets || []).some(asset => codeOf(asset) === code))
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv || inv.defeated || inv.resigned) return false
  switch (move.rule) {
    case 'apiaryDiscardForLocations': return discardForLocationsAction(state, inv, api)
    case 'apiaryParleyCultist': return parleyCultistAction(state, inv, api)
    case 'apiaryCluesForDamage': return cluesForDamageAction(state, inv, move, api)
    case 'apiaryGrislyMask': return grislyMaskAction(state, inv, api)
    case 'apiaryAncientRelic': return ancientRelicAction(state, inv, api)
    case 'apiaryEntranceFast': return entranceFastAction(state, inv, api)
    case 'apiaryGlyphQ': return glyphAction(state, 'rune_q', '手', api)
    case 'apiaryGlyphR': return glyphAction(state, 'rune_r', '时间', api)
    default: return false
  }
}

function discardForLocationsAction(state, inv, api) {
  const total = groupCluesAt(state, inv.location)
  if (total <= 0) return false
  const cluesSpent = 1
  if (!spendGroupClues(state, inv.location, cluesSpent)) return false
  const perClue = investigatorCount(state) === 1 ? 10 : 5
  const deck = encounterDeck(state)
  const discarded = []
  for (let index = 0; index < perClue && deck.length; index++) discarded.push(deck.pop())
  const locations = discarded.filter(code => ALL_CARDS[code]?.type === 'location')
  const others = discarded.filter(code => !locations.includes(code))
  state.encounterDiscard ||= []
  state.encounterDiscard.push(...others)
  for (const code of locations) revealApiaryLocation(state, code, api, inv.seat)
  info(api, `花费 ${cluesSpent} 个线索：弃掉遭遇牌库顶 ${discarded.length} 张，抽取其中 ${locations.length} 处地点。`)
  return true
}

function parleyCultistAction(state, inv, api) {
  const cultist = (state.enemies || []).find(enemy => enemy.location === inv.location && hasTrait(enemy, 'Cultist'))
  if (!cultist) return false
  const spec = flagsOf('11557').parley || { skill: 'intellect', difficulty: 2 }
  const move = result => {
    if (result?.success && Number(result.failedBy ?? 0) <= 0) {
      const from = locationOf(state, cultist.location)
      const target = (from?.connections || []).filter(id => locationOf(state, id))[0]
      if (target) {
        if (typeof api.moveEnemy === 'function') api.moveEnemy(cultist, target)
        else cultist.location = target
        info(api, `谈判成功：「${cultist.name}」移动到「${locationOf(state, target)?.name || target}」。`)
      }
    }
  }
  if (typeof api.test !== 'function') { move({ success: true, failedBy: 0 }); return true }
  api.test(inv.seat, spec.skill, spec.difficulty, move, 0, { label: '失落的朝圣者：谈判' })
  return true
}

function cluesForDamageAction(state, inv, move, api) {
  const enemy = (state.enemies || []).find(item => item.id === move.enemyId)
  const clues = Number(inv.clues) || 0
  if (!enemy || clues <= 0) return false
  inv.clues = 0
  const here = locationOf(state, inv.location)
  if (here) here.clues = (Number(here.clues) || 0) + clues
  if (typeof api.placeDoomOnCard === 'function') api.placeDoomOnCard(enemy, clues)
  else enemy.doom = (Number(enemy.doom) || 0) + clues
  info(api, `蜂巢思维：放置 ${clues} 个线索，对「${enemy.name}」造成 ${clues} 点伤害。`)
  return true
}

function grislyMaskAction(state, inv, api) {
  if (anyInvestigatorControls(state, GRISLY_MASK_CODE)) return false
  const resolve = result => {
    if (!result?.success) return
    takeSetAsideAsset(state, inv, GRISLY_MASK_CODE, api)
    setFlag(state, 'apiaryGrislyMaskTaken', true)
    info(api, `${inv.name} 控制骇人「面具」。`)
  }
  if (typeof api.test !== 'function') { resolve({ success: true }); return true }
  api.test(inv.seat, 'willpower', 8, resolve, 0, { label: '增生原野：意志(8)' })
  return true
}

function ancientRelicAction(state, inv, api) {
  if (anyInvestigatorControls(state, ANCIENT_RELIC_CODE)) return false
  const resolve = result => {
    if (!result?.success) return
    takeSetAsideAsset(state, inv, ANCIENT_RELIC_CODE, api)
    info(api, `${inv.name} 控制古代遗物。`)
  }
  if (typeof api.test !== 'function') { resolve({ success: true }); return true }
  api.test(inv.seat, 'intellect', 2, resolve, 0, { label: '血肉道路：智力(2)' })
  return true
}

function entranceFastAction(state, inv, api) {
  const key = `apiaryEntranceFast:${state.round}`
  if (state.scenarioFlags?.[key]) return false
  setFlag(state, key, true)
  const entrance = locationOf(state, START_LOCATION)
  const distances = new Map([[START_LOCATION, 0]])
  const queue = [START_LOCATION]
  for (const id of queue) {
    const current = locationOf(state, id)
    for (const next of current?.connections || []) {
      if (distances.has(next) || !locationOf(state, next)) continue
      distances.set(next, distances.get(id) + 1)
      queue.push(next)
    }
  }
  const farthest = [...distances.entries()]
    .filter(([id]) => id !== START_LOCATION && locationOf(state, id)?.revealed === true)
    .sort((left, right) => right[1] - left[1])[0]?.[0]
  const target = locationOf(state, farthest || '')
  if (!target) return false
  target.clues = Math.max(Number(target.clues) || 0, Number(target.maxClues) || 0)
  info(api, `养育场入口：[fast] 在「${target.name}」放置线索直到其线索值。`)
  void entrance
  return true
}

function glyphAction(state, rune, meaning, api) {
  if (glyphsKnown(state, rune.replace(/^rune_/, ''))) return false
  translateGlyph(state, rune, meaning, api)
  return true
}

function takeSetAsideAsset(state, inv, code, api = {}) {
  takeFromSetAside(state, code)
  if (typeof api.giveAsset === 'function') return api.giveAsset(inv.seat, code)
  const card = ALL_CARDS[code] || {}
  const asset = {
    id: `apiary-${code}-${inv.seat}`, code, originalCode: code,
    name: card.nameZh || card.name || code, controllerSeat: inv.seat, ownerSeat: inv.seat,
    exhausted: false, damage: 0, horror: 0, tokens: 0, attachments: [],
  }
  inv.assets ||= []
  inv.assets.push(asset)
  return asset
}

// ---------------------------------------------------------------------------
// 符文
// ---------------------------------------------------------------------------
const GLYPH_LETTER = rune => String(rune).replace(/^.*rune_/, '').replace(/[^a-z]/gi, '').toUpperCase()
export function translateGlyph(state, rune, meaning, api = {}) {
  const letter = GLYPH_LETTER(rune)
  if (!letter) return false
  const records = recordsFor(state)
  records.discoveredGlyphs ||= []
  const added = !records.discoveredGlyphs.includes(letter)
  if (added) records.discoveredGlyphs.push(letter)
  info(api, `发现符文 [${letter}]${meaning ? `（「${meaning}」）` : ''}${added ? '' : '（已记录）'}。`)
  return true
}
export function glyphsKnown(state, letters) {
  const want = String(letters).toUpperCase().split('').filter(Boolean)
  const known = new Set(recordsFor(state).discoveredGlyphs || [])
  return want.every(letter => known.has(letter))
}

// ---------------------------------------------------------------------------
// 敌人
// ---------------------------------------------------------------------------
let enemySerial = 0
export function enemyDefinitionFor(code) {
  const definition = scenario.enemies?.[code] || {}
  const card = ALL_CARDS[code] || {}
  return { ...card, ...definition, code, type: 'enemy', traits: [...(definition.traits || card.traits || [])] }
}
export function motherHealth(state) {
  return 8 * investigatorCount(state)
}
export function spawnEnemy(state, code, locationId, api = {}, options = {}) {
  const spawned = typeof api.spawn === 'function' ? api.spawn(code, locationId, options) : null
  if (spawned) {
    if (code === MOTHER_CODE) {
      spawned.health = motherHealth(state)
      spawned.healthPerInvestigator = true
    }
    if (code === SQUAMOUS_PARASITE_CODE) spawned.health = investigatorCount(state)
    return spawned
  }
  const definition = enemyDefinitionFor(code)
  if (!definition.name && !definition.fight && !definition.health) return null
  enemySerial += 1
  const enemy = {
    id: `apiary-${code}-${enemySerial}`, code, originalCode: code,
    name: definition.nameZh || definition.name || code,
    location: locationId,
    fight: definition.fight ?? 0, evade: definition.evade ?? 0,
    health: code === MOTHER_CODE ? motherHealth(state)
      : code === SQUAMOUS_PARASITE_CODE ? investigatorCount(state)
        : (definition.health ?? 1),
    damage: definition.damage || 0, horror: definition.horror || 0,
    traits: [...(definition.traits || [])], exhausted: options.exhausted === true,
    engagedSeat: options.engagedSeat ?? null,
    damageTaken: 0, doom: 0, clues: 0, attachments: [], victory: Number(definition.victory) || 0,
    ...(definition.elite ? { elite: true } : {}),
    ...(definition.massive ? { massive: true } : {}),
    ...(definition.hunter ? { hunter: true } : {}),
  }
  state.enemies ||= []
  state.enemies.push(enemy)
  return enemy
}

/** 主母：另一名[[偷渡者]]敌人被击败时把伤害移给主母（有毁灭则洗回遭遇牌库）。 */
export function relocateStowawayDamageToMother(state, enemy, api = {}) {
  const mother = motherInPlay(state)
  if (!mother || !enemy || codeOf(enemy) === MOTHER_CODE) return false
  if (!hasTrait(enemy, 'Stowaway')) return false
  const damage = Number(enemy.damageTaken) || 0
  if (damage > 0) mother.damageTaken = (Number(mother.damageTaken) || 0) + damage
  const doom = Number(enemy.doom) || 0
  if (doom > 0) {
    state.encounterDeck ||= []
    state.encounterDeck.push(codeOf(enemy))
    shuffleEncounterDeckLocal(state, api)
    enemy.doom = 0
  }
  info(api, `「${enemy.name}」被击败：${damage} 点伤害移到主母上。`)
  return true
}

/** 带鳞寄生虫被击败：翻面 → 符文 T（空气）+ 胜利区；离开场地时放一边。 */
export function flipSquamousParasite(state, enemy, flippedBy, api = {}) {
  if (!enemy) return false
  if (flippedBy === 'leave') {
    const zones = zonesFor(state)
    ;(zones.setAside ||= [])
    if (!zones.setAside.includes(SQUAMOUS_PARASITE_CODE)) zones.setAside.push(SQUAMOUS_PARASITE_CODE)
    const index = (state.enemies || []).indexOf(enemy)
    if (index >= 0) state.enemies.splice(index, 1)
    info(api, '带鳞寄生虫离场：放一边，位于场外。')
    return true
  }
  translateGlyph(state, 'rune_t', '空气', api)
  const code = SQUAMOUS_PARASITE_STORY_CODE
  state.victoryDisplay ||= []
  if (!state.victoryDisplay.some(entry => codeOf(entry) === code)) {
    state.victoryDisplay.push({
      id: enemy.id, code, originalCode: code,
      name: ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code, victory: 1,
    })
  }
  const index = (state.enemies || []).indexOf(enemy)
  if (index >= 0) state.enemies.splice(index, 1)
  info(api, '带鳞寄生虫被击败：发现符文 [T]，卡牌加入胜利区。')
  return true
}

/** 古代遗物（11581）翻面：符文 S（机器）+ 胜利区。 */
export function flipAncientRelic(state, inv, asset, api = {}) {
  translateGlyph(state, 'rune_s', '机器', api)
  const code = ANCIENT_RELIC_STORY_CODE
  state.victoryDisplay ||= []
  if (!state.victoryDisplay.some(entry => codeOf(entry) === code)) {
    state.victoryDisplay.push({
      id: asset?.id || code, code, originalCode: code,
      name: ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code, victory: 1,
    })
  }
  const index = (inv?.assets || []).indexOf(asset)
  if (index >= 0) inv.assets.splice(index, 1)
  info(api, '古代遗物打开：发现符文 [S]，卡牌加入胜利区。')
  return true
}

/** 隐藏秘库（11579）翻面：符文 U（女儿们），翻回地点面且不能再翻。 */
export function flipHiddenVault(state, location, api = {}) {
  translateGlyph(state, 'rune_u', '女儿们', api)
  if (location) {
    location.face = 'location'
    setFlag(state, `apiaryHiddenVaultFlipped:${location.id}`, true)
  }
  info(api, '隐藏秘库：发现符文 [U]（女儿们），翻回地点面。')
  return true
}

export function enemyDefeated(state, enemy, api = {}) {
  if (!enemy) return false
  const code = codeOf(enemy)
  if (code === MOTHER_CODE) {
    setFlag(state, 'apiaryMotherDefeated', true)
    return true
  }
  if (code === SQUAMOUS_PARASITE_CODE) return flipSquamousParasite(state, enemy, 'defeat', api)
  if (hasTrait(enemy, 'Stowaway')) return relocateStowawayDamageToMother(state, enemy, api)
  return false
}

export function enemyAttackResolved() {
  return false
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
export function actReveal(state, act, api = {}) {
  const code = codeOf(act)
  if (code === ACT1_CODE) return act1Back(state, api)
  if (code === ACT2_WEST_CODE) {
    const under = cultistCardsUnderAct(state).length
    const key = under >= 3 ? 'resolution1' : 'resolution2'
    info(api, `朝圣者的命运（背面）：幕下异教徒 ${under} 张 → 结局 ${under >= 3 ? 1 : 2}。`)
    if (typeof api.finish === 'function') { api.finish(key); return true }
    state.resolution = key
    return true
  }
  if (code === ACT2_EAST_CODE) {
    info(api, '主母的拥抱（背面）→ 结局 3。')
    if (typeof api.finish === 'function') { api.finish('resolution3'); return true }
    state.resolution = 'resolution3'
    return true
  }
  return false
}

function act1Back(state, api = {}) {
  const direction = expeditionDirection(state)
  const atLostCampsite = (state.investigators || [])
    .some(inv => !inv.defeated && !inv.resigned && inv.location === 'lostCampsite')
  const pilgrimsBranch = atLostCampsite || direction === 'west'
  if (pilgrimsBranch) {
    const entrance = locationOf(state, START_LOCATION)
    if (entrance) {
      entrance.code = '11559b'
      entrance.originalCode = '11559b'
      entrance.face = 'dangerousExit'
      entrance.clues = 0
    }
    // 把遭遇牌库/弃牌堆/放一边区的全部非弱点[[异教徒]]敌人叠到迷失营地下。
    const under = [...cultistCardsUnderAct(state)]
    for (const pile of ['encounterDeck', 'encounterDiscard']) {
      const list = state[pile] || []
      for (let index = list.length - 1; index >= 0; index--) {
        const code = list[index]
        const card = ALL_CARDS[code]
        if (card?.type !== 'enemy' || !(card.traits || []).includes('Cultist')) continue
        list.splice(index, 1)
        under.push(code)
      }
    }
    const aside = zonesFor(state).setAside || []
    for (let index = aside.length - 1; index >= 0; index--) {
      const code = aside[index]
      const card = ALL_CARDS[code]
      if (card?.type !== 'enemy' || !(card.traits || []).includes('Cultist')) continue
      aside.splice(index, 1)
      under.push(code)
    }
    setFlag(state, 'apiaryCultistsUnder', under)
    // 玛莉亚·里维拉：由一位调查员控制（西向）。
    const mariaTaken = (state.investigators || []).some(inv => (inv.assets || []).some(asset => codeOf(asset) === MARIA_RIVERA_CODE))
    if (!mariaTaken) {
      const inv = (state.investigators || [])[0]
      if (inv) takeSetAsideAsset(state, inv, MARIA_RIVERA_CODE, api)
    }
    // 穷途异魔在离所有调查员最远的地点生成（横置）。
    spawnTheInescapable(state, api)
    placeCluesOnRevealedLocations(state, api)
    setFlag(state, 'apiaryInterlude', 'lostPilgrims')
    info(api, `幕间：失落的朝圣者（叠在迷失营地下的异教徒 ${under.length} 张）。`)
    return true
  }
  // 蜂巢思维幕间：重排环位、清走其余地点、中央腔室朝酸性体腔、主母生成。
  const entrance = locationOf(state, START_LOCATION)
  const acidic = locationOf(state, 'acidicCoelom')
  if (entrance) writeGridCell(state, START_LOCATION, { x: -1, y: -2 })
  if (acidic) writeGridCell(state, 'acidicCoelom', { x: 0, y: -3 })
  for (const location of [...(state.locations || [])]) {
    if (location.id === START_LOCATION || FACING_RING.includes(location.id)) continue
    if (VICTORY_LOCATION_IDS.includes(location.id) && (Number(location.clues) || 0) === 0) {
      state.victoryDisplay ||= []
      state.victoryDisplay.push({ id: location.id, code: codeOf(location), originalCode: codeOf(location),
        name: location.name, victory: Number(location.victory) || 0 })
    }
    const index = state.locations.indexOf(location)
    if (index >= 0) state.locations.splice(index, 1)
  }
  if (!locationOf(state, CENTRAL_CHAMBER_ID)) placeLocationAt(state, CENTRAL_CHAMBER_ID, api, { revealed: true })
  setFlag(state, 'apiaryFacing', 'acidicCoelom')
  applyCentralFacing(state, api)
  spawnEnemy(state, MOTHER_CODE, CENTRAL_CHAMBER_ID, api)
  spawnTheInescapable(state, api)
  placeCluesOnRevealedLocations(state, api)
  setFlag(state, 'apiaryInterlude', 'theHiveMind')
  info(api, '幕间：蜂巢思维（重新排布环位，主母在中央腔室生成）。')
  return true
}

export function spawnTheInescapable(state, api = {}) {
  const zones = zonesFor(state)
  const aside = zones.setAside || []
  const code = THE_INESCAPABLE_CODES[0]
  const index = aside.indexOf(code)
  if (index < 0) return null
  aside.splice(index, 1)
  const distances = new Map()
  const queue = []
  for (const inv of activeInvestigators(state)) {
    if (!inv.location) continue
    distances.set(inv.location, 0)
    queue.push(inv.location)
  }
  for (const id of queue) {
    const current = locationOf(state, id)
    for (const next of current?.connections || []) {
      if (distances.has(next) || !locationOf(state, next)) continue
      distances.set(next, distances.get(id) + 1)
      queue.push(next)
    }
  }
  const farthest = [...distances.entries()].sort((left, right) => right[1] - left[1])[0]?.[0]
    || (state.locations || [])[0]?.id || null
  const enemy = spawnEnemy(state, code, farthest, api, { exhausted: true })
  for (const codeToShuffle of THE_INESCAPABLE_CODES.slice(1)) {
    const list = zones.setAside || []
    const at = list.indexOf(codeToShuffle)
    if (at >= 0) { list.splice(at, 1); encounterDeck(state).push(codeToShuffle) }
  }
  shuffleEncounterDiscardBackIn(state, api)
  shuffleEncounterDeckLocal(state, api)
  info(api, '穷途异魔在离所有调查员最远的地点生成（横置）。')
  return enemy
}

function placeCluesOnRevealedLocations(state, api = {}) {
  void api
  for (const location of state.locations || []) {
    if (location.revealed !== true) continue
    if ((location.victory || 0) > 0) continue
    location.clues = Math.max(Number(location.clues) || 0, Number(location.maxClues) || 0)
  }
}

export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  if (code === AGENDA1_CODE) {
    placeCluesOnRevealedLocations(state, api)
    // 把放一边的奇丑混种与遭遇弃牌堆混洗，放到遭遇牌库底。
    if (takeFromSetAside(state, GROTESQUE_AMALGAM_CODE)) {
      const discard = state.encounterDiscard || []
      state.encounterDiscard = []
      const random = randomOf(api)
      const merged = shuffled([GROTESQUE_AMALGAM_CODE, ...discard], resolveShuffle(api), random)
      encounterDeck(state).unshift(...merged)
    }
    info(api, '黑暗中的躁动（背面）：放置线索并把奇丑混种洗入遭遇牌库底。')
    return true
  }
  if (code === AGENDA2_CODE) {
    for (const inv of activeInvestigators(state)) {
      if (typeof api.defeat === 'function') api.defeat(inv, 'physical')
      else { inv.defeated = true; inv.defeatCause = 'physical' }
    }
    state.resolution = 'noResolution'
    info(api, '可憎寄生虫（背面）：每位未撤退的调查员被击败。')
    return true
  }
  return false
}

export function doomPlaced(state, context = {}, api = {}) {
  if (!context?.agenda || Number(context.amount) <= 0) return false
  if (currentAgendaCode(state) !== AGENDA2_CODE) return false
  const existsNonElite = (state.enemies || []).some(enemy => !hasTrait(enemy, 'Elite'))
  if (existsNonElite) return false
  const deck = encounterDeck(state)
  const revealed = []
  let found = null
  while (deck.length) {
    const code = deck.pop()
    if (ALL_CARDS[code]?.type === 'enemy') { found = code; break }
    revealed.push(code)
  }
  const random = randomOf(api)
  if (found) {
    const empty = (state.locations || []).find(location => !(state.enemies || []).some(enemy => enemy.location === location.id))
    spawnEnemy(state, found, empty?.id || (state.locations || [])[0]?.id || null, api)
  }
  deck.push(...shuffled(revealed, resolveShuffle(api), random))
  info(api, `可憎寄生虫：从遭遇牌库顶揭示 ${revealed.length + (found ? 1 : 0)} 张，`
    + `${found ? '生成一名敌人' : '没有敌人'}，其余洗回牌库。`)
  return Boolean(found)
}

export function roundEnded(state, api = {}) {
  if (currentActCode(state) !== ACT2_EAST_CODE) return false
  if (!locationOf(state, CENTRAL_CHAMBER_ID)) return false
  const heads = randomOf(api)() < 0.5
  rotateCentralChamber(state, heads ? 'clockwise' : 'counterclockwise', api)
  setFlag(state, 'apiaryLastCoin', heads ? 'heads' : 'tails')
  return true
}

export function checkObjectives(state, api = {}) {
  if (state.status && state.status !== 'playing') return false
  const actCode = currentActCode(state)
  if (actCode === ACT1_CODE) {
    if (state._roundEndWindow !== true) return false
    const alive = activeInvestigators(state)
    if (!alive.length) return false
    const sanctumIds = SANCTUM_LOCATION_IDS.filter(id => locationOf(state, id)).map(id => locationOf(state, id).id)
    const here = new Set([...sanctumIds, ...(state.locations || [])
      .filter(location => (location.traits || []).some(trait => String(trait).toLowerCase() === 'sanctum'))
      .map(location => location.id)])
    if (!alive.every(inv => here.has(inv.location))) return false
    info(api, '轮末：每位未击败调查员都在一处[[圣所]]地点，推进幕 1。')
    if (typeof api.advanceAct === 'function') { api.advanceAct(); return true }
    return actReveal(state, currentAct(state), api)
  }
  if (actCode === ACT2_WEST_CODE) {
    if (state._roundEndWindow !== true) return false
    if (cultistCardCount(state) < 5) return false
    info(api, `轮末：异教徒卡牌合计 ${cultistCardCount(state)} 张（≥5），必须推进幕 2。`)
    if (typeof api.advanceAct === 'function') { api.advanceAct(); return true }
    return actReveal(state, currentAct(state), api)
  }
  if (actCode === ACT2_EAST_CODE) {
    if (!state.scenarioFlags?.apiaryMotherDefeated) return false
    info(api, '主母被击败：立刻推进幕 2。')
    if (typeof api.advanceAct === 'function') { api.advanceAct(); return true }
    return actReveal(state, currentAct(state), api)
  }
  return false
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
export function resolveChaosToken(state, inv, token) {
  return apiaryChaosToken(state, inv, token)
}
export function chaosTokenValue(state, tokenFace) {
  return apiaryChaosTokenValue(state, tokenFace)
}
export function applyTokenEffect(state, inv, effect = {}, api = {}) {
  if (!inv || !effect) return false
  const mode = effect.mode
  const placeDoomOn = enemy => {
    if (!enemy) return false
    if (typeof api.placeDoomOnCard === 'function') api.placeDoomOnCard(enemy, 1)
    else enemy.doom = (Number(enemy.doom) || 0) + 1
    info(api, `[tablet]：在「${enemy.name}」上放置 1 个毁灭标记。`)
    return true
  }
  if (effect.token === 'cultist' && mode === 'revealAnother') {
    if (typeof api.revealToken !== 'function') return false
    const token = api.revealToken(inv.seat)
    const delta = Number.isFinite(Number(token)) ? Number(token) : (apiaryChaosTokenValue(state, token) ?? 0)
    if (typeof api.addTestValue === 'function') api.addTestValue(delta)
    info(api, `[cultist]：所在地点有[[异教徒]]敌人，再揭示一个标记（${token}）。`)
    return true
  }
  if (effect.token === 'tablet') {
    const enemies = enemiesAtLocation(state, inv)
    const candidates = enemies.filter(enemy => (Number(enemy.doom) || 0) === 0)
    if (mode === 'doomOnEnemyNoDoom') return placeDoomOn(candidates[0] || null)
    if (mode === 'doomOnEnemy') return placeDoomOn(candidates[0] || enemies[0] || null)
    return false
  }
  if (effect.token === 'elderthing' && mode === 'damageOrHorrorOnFail') {
    const choice = typeof api.choose === 'function'
      ? api.choose({
        kind: 'token', source: '11553-token', seat: inv.seat,
        prompt: '[elder_thing]：受到 1 点伤害或 1 点恐惧。',
        options: [{ id: 'damage', label: '受到 1 点伤害' }, { id: 'horror', label: '受到 1 点恐惧' }],
      })
      : 'horror'
    if (choice === 'damage') {
      if (typeof api.damage === 'function') api.damage(inv.seat, 1)
      else inv.damage = (Number(inv.damage) || 0) + 1
    } else if (typeof api.horror === 'function') api.horror(inv.seat, 1)
    else inv.horror = (Number(inv.horror) || 0) + 1
    info(api, `[elder_thing]：受到 1 点${choice === 'damage' ? '伤害' : '恐惧'}。`)
    return true
  }
  return false
}
export function testAutoFail() {
  return false
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
const RESOLUTION_CHAIN = Object.freeze({
  noResolution: Object.freeze(['noResolution']),
  resolution1: Object.freeze(['resolution1']),
  resolution2: Object.freeze(['resolution2']),
  resolution3: Object.freeze(['resolution3', 'resolution4']),
  resolution4: Object.freeze(['resolution4']),
})
const RESOLUTION_STEPS = Object.freeze({
  noResolution: { log: '无结局：从颈中扯出扭动的虫子逃出隧道。', record: null },
  resolution1: { record: 'thePilgrimsWereSaved', log: '结局 1：记录「朝圣者获救」，每名调查员 +2 奖励经验。', bonus: 2 },
  resolution2: { record: 'thePilgrimsWereDevoured', log: '结局 2：记录「朝圣者被吞噬」，每名调查员获得一张寄生变形。' },
  resolution3: { record: 'theInvestigatorsExterminatedTheAlienParasites', log: '结局 3：记录「调查员灭绝了异星寄生虫」，进入结局 4。' },
  resolution4: { log: '结局 4：调查员必须选择去淹没城区或西墙。' },
})

export function resolutionChainForKey(key, state) {
  const chain = [...(RESOLUTION_CHAIN[key] || [])]
  if (key === 'noResolution' && expeditionDirection(state) === 'east') chain.push('resolution4')
  return chain
}

export function resolution4Choice(state, api = {}) {
  const options = [
    { id: 'drownedQuarter', label: '「我们都走到这一步了，不能留下任何未解之谜。」→ 淹没城区' },
    { id: 'westernWall', label: '「你疯了吗？我们得离开这里！」→ 西墙' },
  ]
  const chosen = typeof api.choose === 'function'
    ? api.choose({ kind: 'resolution', source: REFERENCE_CODE_FOR_CHOICE, seat: state.campaign?.leadSeat ?? 0,
      prompt: '结局 4：调查员必须选择下一站。', options })
    : 'westernWall'
  return RESOLUTION4_NEXT[chosen] || RESOLUTION4_NEXT.westernWall
}
const REFERENCE_CODE_FOR_CHOICE = '11553'

export function controlledGrislyMask(state) {
  return (state.investigators || []).some(inv => (inv.assets || []).some(asset => codeOf(asset) === GRISLY_MASK_CODE))
}

export function grantParasiticTransformation(state, api = {}) {
  for (const inv of state.investigators || []) {
    if (typeof api.campaignCard === 'function') api.campaignCard(PARASITIC_TRANSFORMATION_CODE, inv.seat, '结局：寄生变形')
    else setFlag(state, `apiaryParasiticTransformation:${inv.seat}`, true)
  }
  info(api, '每名调查员获得一张寄生变形（不占牌组张数）。')
}

export function resolution(state, key, events = null, api = {}) {
  void events
  const infoApi = api?.info ? api : api?.api || {}
  const finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : 'noResolution'
  const chain = resolutionChainForKey(finalKey, state)
  if (!chain.length) throw new RangeError(`未知结局：${key}`)
  const records = recordsFor(state)
  records.apiaryResolution = finalKey
  records.apiaryResolvedTo = chain[chain.length - 1]
  records.apiaryNoResolution = finalKey === 'noResolution'
  // 所有非「调查员败退」结局共通：划掉拉莱耶地图上的养育场；若仍控制骇人「面具」则记录。
  records.rlyehMap ||= []
  if (!records.rlyehMap.includes('RlyehApiary')) records.rlyehMap.push('RlyehApiary')
  if (controlledGrislyMask(state)) records.grislyMask = true
  for (const step of chain) {
    const config = RESOLUTION_STEPS[step]
    if (!config) continue
    if (config.record) records[config.record] = true
    info(infoApi, config.log)
    if (config.bonus) {
      for (const inv of state.investigators || []) {
        if (typeof api.addScenarioXpBonus === 'function') api.addScenarioXpBonus(inv.seat, config.bonus)
        else inv.scenarioXpBonus = (Number(inv.scenarioXpBonus) || 0) + config.bonus
      }
    }
  }
  if (chain.includes('resolution2') || chain.includes('noResolution')) grantParasiticTransformation(state, infoApi)
  // 下一章 / 跳章。
  let nextScenarioId = null
  if (chain.includes('resolution4')) {
    nextScenarioId = resolution4Choice(state, infoApi)
  } else if (chain.includes('resolution1') || chain.includes('resolution2')) {
    nextScenarioId = 'theGrandVault'
  } else if (chain.includes('noResolution')) {
    nextScenarioId = expeditionDirection(state) === 'west' ? 'theGrandVault' : 'resolution4'
  }
  records.apiaryNextScenario = nextScenarioId
  return { bonus: 0, award: true, nextScenarioId }
}

// ---------------------------------------------------------------------------
// 事件
// ---------------------------------------------------------------------------
export const events = {
  apiaryPlaceLocation(state, payload = {}, api = {}) {
    return revealApiaryLocation(state, payload.code, api, payload.seat)
  },
  apiaryRevealCard(state, payload = {}, api = {}) {
    return revealApiaryLocation(state, payload.code, api, payload.seat)
  },
  apiaryTranslateGlyph(state, payload = {}, api = {}) {
    return translateGlyph(state, payload.rune, payload.meaning, api)
  },
  apiaryTakeAsset(state, payload = {}, api = {}) {
    const inv = (state.investigators || [])[payload.seat]
    if (!inv) return false
    return Boolean(takeSetAsideAsset(state, inv, payload.code, api))
  },
  apiaryRotateCentralChamber(state, payload = {}, api = {}) {
    return rotateCentralChamber(state, payload.direction || 'clockwise', api)
  },
  apiaryFlipHiddenVault(state, payload = {}, api = {}) {
    return flipHiddenVault(state, locationOf(state, payload.locationId || 'hiddenVault'), api)
  },
  apiaryFlipSquamousParasite(state, payload = {}, api = {}) {
    const enemy = (state.enemies || []).find(item => codeOf(item) === SQUAMOUS_PARASITE_CODE)
    return enemy ? flipSquamousParasite(state, enemy, 'defeat', api) : false
  },
  apiaryFlipAncientRelic(state, payload = {}, api = {}) {
    const inv = (state.investigators || [])[payload.seat]
    const asset = (inv?.assets || []).find(item => codeOf(item) === ANCIENT_RELIC_CODE)
    return asset ? flipAncientRelic(state, inv, asset, api) : false
  },
  apiarySpawnMother(state, payload = {}, api = {}) {
    return spawnEnemy(state, MOTHER_CODE, payload.locationId || CENTRAL_CHAMBER_ID, api)
  },
  apiaryPlaceCluesFarthest(state, payload = {}, api = {}) {
    const inv = (state.investigators || [])[payload.seat]
    return inv ? entranceFastAction(state, inv, api) : false
  },
  apiaryPutCultistUnderAct(state, payload = {}, api = {}) {
    const inv = (state.investigators || [])[payload.seat]
    const enemy = (state.enemies || []).find(item => item.location === inv?.location && hasTrait(item, 'Cultist'))
    if (!enemy) return false
    const under = [...cultistCardsUnderAct(state), codeOf(enemy)]
    setFlag(state, 'apiaryCultistsUnder', under)
    const index = state.enemies.indexOf(enemy)
    if (index >= 0) state.enemies.splice(index, 1)
    info(api, `把「${enemy.name}」放到幕下。`)
    return true
  },
  apiarySearchEnemy(state, payload = {}, api = {}) {
    return Boolean(searchEnemyToLocation(state, payload.locationId, api))
  },
  apiaryDoomNearestEnemy(state, payload = {}, api = {}) {
    const origin = locationOf(state, (state.investigators || [])[payload.seat]?.location)
    if (!origin) return false
    const distances = new Map([[origin.id, 0]])
    const queue = [origin.id]
    for (const id of queue) {
      const current = locationOf(state, id)
      for (const next of current?.connections || []) {
        if (distances.has(next) || !locationOf(state, next)) continue
        distances.set(next, distances.get(id) + 1)
        queue.push(next)
      }
    }
    const candidates = (state.enemies || []).filter(enemy => !hasTrait(enemy, 'Elite')
      && (Number(enemy.doom) || 0) === 0 && distances.has(enemy.location))
      .sort((left, right) => distances.get(left.location) - distances.get(right.location))
    const enemy = candidates[0]
    if (!enemy) return false
    if (typeof api.placeDoomOnCard === 'function') api.placeDoomOnCard(enemy, 1)
    else enemy.doom = (Number(enemy.doom) || 0) + 1
    info(api, `外星虫卵：在最近的「${enemy.name}」上放置 1 个毁灭标记。`)
    return true
  },
}

// ---------------------------------------------------------------------------
// 只读投影
// ---------------------------------------------------------------------------
export function scenarioSummary(state) {
  return {
    direction: expeditionDirection(state),
    act: currentActCode(state),
    agenda: currentAgendaCode(state),
    locations: (state.locations || []).length,
    gatheredLocations: LOCATION_IDS.filter(id => locationOf(state, id)),
    centralFacing: centralFacing(state),
    motherInPlay: Boolean(motherInPlay(state)),
    cultistsUnderAct: cultistCardsUnderAct(state).length,
    cultistsInVictory: cultistCardsInVictory(state).length,
    doomInPlay: doomInPlay(state),
    skull: skullValue(state),
    glyphs: [...(recordsFor(state).discoveredGlyphs || [])],
    setAside: [...(state.scenarioZones?.setAside || [])],
    removed: [...(state.scenarioZones?.removed || [])],
    nextScenarioId: recordsFor(state).apiaryNextScenario || null,
  }
}

export function implementedEntryFlags(code) {
  return entryOf(code)?.flags || {}
}

export const behavior = {
  id: CHAPTER_ID,
  startLocation: () => START_LOCATION,
  locationsStartRevealed: false,
  roundEndActIndex: null,
  introduction,
  preScenarioSetup,
  prepareScenario,
  setupScenario,
  setupLocations,
  locationPlaced,
  afterDeckSetup,
  modifyDeck,
  actions,
  performAction,
  roundEnded,
  doomPlaced,
  actReveal,
  agendaReveal,
  checkObjectives,
  enemyDefeated,
  enemyAttackResolved,
  resolveChaosToken,
  chaosTokenValue,
  applyTokenEffect,
  testAutoFail,
  resolution,
  events,
  scenarioSummary,
  // 具名助手（测试 / 主进程验收）
  expeditionDirection,
  headedWest,
  creatureWasDefeated,
  writeGridCell,
  placeLocationAt,
  revealApiaryLocation,
  applyRevelation,
  centralFacing,
  rotateCentralChamber,
  applyCentralFacing,
  cultistCardsUnderAct,
  cultistCardsInVictory,
  cultistCardCount,
  motherHealth,
  spawnEnemy,
  spawnTheInescapable,
  flipSquamousParasite,
  flipAncientRelic,
  flipHiddenVault,
  translateGlyph,
  glyphsKnown,
  doomInPlay,
  skullValue,
  resolutionChainForKey,
  resolution4Choice,
  controlledGrislyMask,
  grantParasiticTransformation,
  shuffleIntoBottom,
  locationOf,
  anyInvestigatorControls,
}

export {
  ACT1_CODE, ACT2_EAST_CODE, ACT2_WEST_CODE, AGENDA1_CODE, AGENDA2_CODE, ANCIENT_RELIC_CODE,
  CENTRAL_CHAMBER_ID, ENCOUNTER_DECK, ENCOUNTER_DECK_BY_DIRECTION, FACING_RING, GRISLY_MASK_CODE,
  HIDDEN_LOCATION_BY_DIRECTION, INITIAL_FACING, LOCATION_CONNECTIONS, LOCATION_IDS, MARIA_RIVERA_CODE,
  MOTHER_CODE, PARASITIC_TRANSFORMATION_CODE, RESOLUTION4_NEXT, RESOLUTION_KEYS, RESOLUTION_NEXT,
  SET_ASIDE_ALIASES, SET_ASIDE_LOCATION_IDS, SQUAMOUS_PARASITE_CODE, START_LOCATION, TREACHERY_CODES,
}
