// 重返午夜假面（returnToTheMidnightMasks · 50025）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/ReturnToNightOfTheZealot/ReturnToTheMidnightMasks.hs +
//       Scenario/Scenarios/NightOfTheZealot/TheMidnightMasks.hs 的 whenReturnTo 分支 +
//       Agenda/Cards/ReturnToNightOfTheZealot/ReturnToTheMidnightMasks/ReturnToPredatorOrPrey.hs +
//       Enemy/Cards/ReturnToNightOfTheZealot/ReturnToTheMidnightMasks/Narogath.hs。
//
// 引擎读点：
//   startLocation { record: houseBurned, then: rivertown, else: yourHouse }
//   setupLocations → 9 处地点的原版/重返版随机变体（state.locationVariants，placeLocation 合并）
//   setupEnemies → 按人数-1 在南区/商业区/墓地生成 50041 噬魔信徒
//   modifyDeck → 食尸鬼祭司仍存活时洗入遭遇牌库
//   afterDeckSetup → 异教徒牌堆（8 张混洗后随机移除 3 张）
//   enemySpawned → 50041 生成后：在它上面放 1 毁灭或放置 1 线索（密谋 2 起两者都做）
//   mythosEnded / enemyPhaseEnd → 50042 掠尸者
//   spawnLocation → 50041/50042「最远的无人地点」；50044 你的房子不在场时改为河岸城
//   parleyBlocked → 50026b 重整时封锁其所在地点/连接地点与[[异教徒]]敌人的谈判
//   enemyStatModifier → 50026b 每调查员 +3 生命
//   agendaReveal → 50026a 背面生成纳罗加斯（与猎物交战）/ 01122 背面进入结局 2
//   actions / performAction → 50028 北区（移动到任意阿卡姆地点）、50029 米斯卡塔尼克大学（受 2 恐惧得 1 线索）
//   resolution → 记录盘问/逃脱/午夜已至；食尸鬼祭司在胜利区时划掉记录
//
// 只写 state.scenarioFlags / state.scenarioZones / state.campaign.records / state.locationVariants。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  ACT_CODES, ACT1_CODE, AGENDA1_BASE_CODE, AGENDA1_RETURN_CODE, AGENDA1_LINKED_CODE, NAROGATH_CODE,
  AGENDA2_CODE, AGENDA_CODES, AGENDAS, ACTS, STAGE_CARDS, AGENDA_VARIANTS, LOCATIONS, LOCATION_TABLE,
  LOCATION_IDS, VARIANT_LOCATION_IDS, ARKHAM_LOCATION_IDS, START_LOCATION, RIVERTOWN_IF_BURNED,
  ENCOUNTER_DECK, CULTIST_DECK_CODES, CULTIST_DECK_REMOVE, RESOLUTION_KEYS, SCENARIO_TEXT, scenario,
  locationVariant, LITA_CODE, GHOUL_PRIEST_CODE,
} from './definition.js'

const CHAPTER_ID = 'returnToTheMidnightMasks'

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------
const activeInvestigators = state => (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
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
const setFlag = (state, key, value = true) => { flagsFor(state)[key] = value; return value }
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const enemiesInPlay = state => (state.enemies || []).filter(enemy => !enemy.defeated)
const currentAgendaCode = state => codeOf((state?.agendas || [])[state?.agendaIndex ?? 0])
const isAgendaOne = state => (state?.agendaIndex ?? 0) === 0
const randomOf = (helper, state) => (typeof helper?.randomValue === 'function'
  ? () => helper.randomValue(state)
  : (typeof helper?.api?.random === 'function' ? helper.api.random : Math.random))
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)

function hasTrait(entity, trait) {
  return (entity?.traits || []).some(item => String(item).toLowerCase() === trait.toLowerCase())
}

function cultistEnemiesInPlay(state) {
  return enemiesInPlay(state).filter(enemy => hasTrait(enemy, 'Cultist'))
}

function cultistDeckShuffledRemove(state, randomValue) {
  const deck = [...(state.cultistDeck || [])]
  const removed = []
  const count = Math.min(CULTIST_DECK_REMOVE, Math.max(0, deck.length - 5))
  for (let index = 0; index < count; index += 1) {
    const pick = Math.floor(randomValue() * deck.length)
    removed.push(...deck.splice(pick, 1))
  }
  state.cultistDeck = deck
  return removed
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
export function prepareScenario(state, api = {}) {
  if (flagsFor(state).retMasksPrepared) return flagsFor(state).retMasksPrepared
  const random = typeof api.random === 'function' ? api.random : Math.random
  // 密谋 1 二选一（50026a 重返版 / 01121a 原版）。
  const useReturnAgenda = random() >= 0.5
  const agenda1 = useReturnAgenda ? clone(AGENDA_VARIANTS.default) : clone(AGENDA_VARIANTS.alternate)
  state.agendas = [agenda1, clone((state.scenario?.stageCards || STAGE_CARDS)[AGENDA2_CODE] || AGENDAS[1])]
  state.acts = ACT_CODES.map(code => clone((state.scenario?.stageCards || STAGE_CARDS)[code]))
  state.actIndex = Number.isInteger(state.actIndex) ? state.actIndex : 0
  state.agendaIndex = Number.isInteger(state.agendaIndex) ? state.agendaIndex : 0
  // 地点变体：每个 id 从主版本/备选版本中随机选一张。
  const chosenVariants = {}
  for (const [id, primary, alternate] of LOCATION_TABLE) {
    if (!alternate) continue
    const code = random() < 0.5 ? primary : alternate
    chosenVariants[id] = code
  }
  state.locationVariants = {}
  for (const id of VARIANT_LOCATION_IDS) {
    const definition = (state.scenario?.locations || LOCATIONS)[id]
    const code = chosenVariants[id] || definition?.code
    if (!code) continue
    state.locationVariants[id] = locationVariant(id, code)
  }
  setFlag(state, 'retMasksAgenda1', {
    code: agenda1.originalCode || AGENDA1_RETURN_CODE, returnTo: useReturnAgenda,
  })
  setFlag(state, 'retMasksVariants', chosenVariants)
  info(api, `重返午夜假面：密谋 1 采用${useReturnAgenda ? '重返版（纳罗加斯）' : '原版（假面猎手）'}。`)
  setFlag(state, 'retMasksPrepared', { agenda1: useReturnAgenda, variants: chosenVariants })
  return flagValueOf(state, 'retMasksPrepared')
}

function flagValueOf(state, key) {
  return flagsFor(state)[key]
}

export function preScenarioSetup(state, events, helperOrApi = {}) {
  void events
  const api = helperOrApi?.api || helperOrApi || {}
  return prepareScenario(state, api)
}

export function startLocation(state) {
  return state?.campaign?.records?.houseBurned ? RIVERTOWN_IF_BURNED : START_LOCATION
}

export function setupLocations(state, events = null, helper = {}) {
  void events
  const random = randomOf(helper, state)
  prepareScenario(state, { random, info: (...args) => info(helper?.api, ...args) })
  const houseBurned = Boolean(state.campaign?.records?.houseBurned)
  const ids = LOCATION_IDS.filter(id => id !== 'yourHouse' || !houseBurned)
  info(helper?.api, `重返午夜假面：${ids.length} 处地点入场${houseBurned ? '（房屋已烧毁，从河岸城开始）' : ''}。`)
  return ids
}

export function setupEnemies(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  const count = Math.max(0, investigatorCount(state) - 1)
  const spots = ['southside', 'downtown', 'graveyard']
  for (let index = 0; index < count && index < spots.length; index += 1) {
    const enemy = typeof helper?.spawnEnemy === 'function'
      ? helper.spawnEnemy('50041', spots[index])
      : safeCall(api, 'spawnEnemy', '50041', spots[index])
    if (enemy) info(api, `👹 噬魔信徒生成于「${spots[index]}」。`)
  }
}

export function modifyDeck(state, deck, events = null, helper = {}) {
  void events
  void helper
  const next = [...deck]
  if (state.campaign?.records?.ghoulPriestAlive) next.push(GHOUL_PRIEST_CODE)
  return next
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  const random = randomOf(helper, state)
  if (!state.encounterDeck?.length) state.encounterDeck = [...ENCOUNTER_DECK]
  const removed = cultistDeckShuffledRemove(state, random)
  setFlag(state, 'retMasksCultistDeckRemoved', removed)
  info(api, `重返午夜假面：异教徒牌堆剩 ${(state.cultistDeck || []).length} 张（随机移除 ${removed.length} 张）。`)
  return { cultistDeck: [...(state.cultistDeck || [])], removed }
}

/** 单测/直调入口：9（或 8）处地点、变体、噬魔信徒、牌库与异教徒牌堆。 */
export function setupScenario(state, api = {}) {
  state.locations = []
  state.scenarioFlags ||= {}
  delete state.scenarioFlags.retMasksPrepared
  const report = prepareScenario(state, api)
  const houseBurned = Boolean(state.campaign?.records?.houseBurned)
  const ids = LOCATION_IDS.filter(id => id !== 'yourHouse' || !houseBurned)
  for (const id of ids) {
    const definition = { ...(state.scenario?.locations || LOCATIONS)[id], ...(state.locationVariants?.[id] || {}) }
    const count = investigatorCount(state)
    const instance = {
      ...structuredClone(definition), id, connections: [...definition.connections],
      clues: (Number(definition.cluesPerInvestigator) || 0) * count,
      maxClues: (Number(definition.cluesPerInvestigator) || 0) * count,
      revealed: false,
    }
    if (instance.victory != null) instance.victory = Number(instance.victory) || 0
    if (state.investigators.some(inv => inv.location === id)) instance.revealed = true
    state.locations.push(instance)
    safeCall(api, 'place', id)
  }
  state.investigators ||= []
  const start = startLocation(state)
  for (const inv of state.investigators) if (!inv.location) inv.location = start
  for (const inv of state.investigators) {
    const here = locationOf(state, inv.location)
    if (here) here.revealed = true
  }
  if (!state.encounterDeck?.length) state.encounterDeck = [...ENCOUNTER_DECK]
  state.cultistDeck = [...CULTIST_DECK_CODES]
  setupEnemies(state, null, { api })
  afterDeckSetup(state, null, { api, randomValue: typeof api.random === 'function' ? api.random : Math.random })
  info(api, `重返午夜假面：${state.locations.length} 处地点入场（密谋 1 ${report.agenda1 ? '重返版' : '原版'}）。`)
  return { ...report, placedIds: state.locations.map(location => location.id) }
}

// ---------------------------------------------------------------------------
// 生成位置
// ---------------------------------------------------------------------------
export function spawnLocation(state, code, fallback, engagedSeat, api = {}) {
  void engagedSeat
  if (!fallback && (code === '50041' || code === '50042')) {
    const from = activeInvestigators(state)[0]?.location
    const distanceOf = id => {
      if (from && typeof api?.locationDistance === 'function') {
        const value = api.locationDistance(from, [id])
        return value == null || value < 0 ? Infinity : value
      }
      return 0
    }
    const empty = (state.locations || []).filter(location => !enemiesInPlay(state).some(enemy => enemy.location === location.id))
    if (!empty.length) return fallback
    const farthest = Math.max(...empty.map(location => distanceOf(location.id)))
    const candidates = empty.filter(location => distanceOf(location.id) === farthest)
    return candidates[0]?.id || fallback
  }
  if (code === '50044') {
    if (!locationOf(state, START_LOCATION)) return RIVERTOWN_IF_BURNED
  }
  return fallback
}

// ---------------------------------------------------------------------------
// 敌人钩子
// ---------------------------------------------------------------------------
export function enemySpawned(state, enemy, api = {}) {
  if (!enemy) return false
  if (codeOf(enemy) === '50041') {
    const mustDoBoth = !isAgendaOne(state)
    const lead = state.campaign?.leadSeat ?? 0
    const options = [
      { id: 'doom', label: '在噬魔信徒上放置 1 个毁灭标记' },
      { id: 'clue', label: '将你的 1 个线索放到它所在地点' },
    ]
    const choice = typeof api.choose === 'function'
      ? api.choose({ kind: 'choice', source: '50041', seat: lead,
        prompt: '噬魔信徒生成：选择放置 1 个毁灭或 1 个线索。', options })
      : 'doom'
    const doDoom = mustDoBoth || choice !== 'clue'
    const doClue = mustDoBoth || choice === 'clue'
    if (doDoom) safeCall(api, 'doomOn', enemy, 1)
    if (doClue) {
      safeCall(api, 'loseClues', lead, 1)
      safeCall(api, 'addCluesToLocation', enemy.location, 1)
    }
    return true
  }
  return false
}

export function enemyStatModifier(state, enemy, stat) {
  if (!enemy) return 0
  if (codeOf(enemy) === NAROGATH_CODE && stat === 'health') return 3 * investigatorCount(state)
  return 0
}

export function mythosEnded(state, api = {}) {
  for (const enemy of enemiesInPlay(state)) {
    if (codeOf(enemy) === '50042') safeCall(api, 'doomOn', enemy, 1)
  }
}

export function enemyPhaseEnd(state, api = {}) {
  for (const enemy of enemiesInPlay(state)) {
    if (codeOf(enemy) !== '50042') continue
    if (['rivertown', 'mainPath'].includes(enemy.location)) {
      const doom = Number(enemy.doom) || 0
      if (doom > 0) { safeCall(api, 'addDoom', doom); enemy.doom = 0 }
    } else {
      const dest = safeCall(api, 'stepToward', enemy.location, 'rivertown')
        || safeCall(api, 'stepToward', enemy.location, 'mainPath')
      if (dest && dest !== enemy.location) safeCall(api, 'moveEnemy', enemy, dest)
    }
  }
}

export function parleyBlocked(state, inv, entity, entityType) {
  if (!inv) return false
  if (String(entityType) !== 'enemy' && entityType != null) return false
  if (!hasTrait(entity, 'Cultist')) return false
  const narogath = enemiesInPlay(state).find(enemy => codeOf(enemy) === NAROGATH_CODE && !enemy.exhausted)
  if (!narogath) return false
  if (narogath.location === inv.location) return true
  const here = locationOf(state, inv.location)
  return Boolean(here?.connections?.includes(narogath.location))
}

// ---------------------------------------------------------------------------
// 地点行动（50028 北区、50029 米斯卡塔尼克大学）
// ---------------------------------------------------------------------------
export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const here = locationOf(state, inv.location)
  if (!here) return []
  const moves = []
  const variant = codeOf(here)
  if (variant === '50028') {
    moves.push({
      action: 'scenarioAction', rule: 'retMasksNorthsideMove', locationId: here.id, actions: 1,
      label: '🚆 北区（火车站）：移动到任意[[阿卡姆]]地点（每场游戏仅限一次）',
      reason: flagValueOf(state, 'retMasksNorthsideUsed') ? '本场游戏已使用' : null,
    })
  }
  if (variant === '50029') {
    moves.push({
      action: 'scenarioAction', rule: 'retMasksMuseumClue', locationId: here.id, actions: 1,
      label: '🏛️ 米斯卡塔尼克大学（博物馆）：受到 2 点恐惧，从供应堆获得 1 个线索（每场游戏仅限一次）',
      reason: flagValueOf(state, 'retMasksMuseumUsed') ? '本场游戏已使用' : null,
    })
  }
  return moves
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv) return false
  if (move.rule === 'retMasksNorthsideMove') {
    if (flagValueOf(state, 'retMasksNorthsideUsed')) return false
    const options = (state.locations || []).filter(location => hasTrait(location, 'Arkham'))
    if (!options.length) return false
    const picked = typeof api.choose === 'function'
      ? api.choose({ kind: 'location', source: '50028', seat: inv.seat, prompt: '选择任意一个[[阿卡姆]]地点。',
        options: options.map(location => ({ id: location.id, label: location.name })) })
      : options[0].id
    if (!picked) return false
    setFlag(state, 'retMasksNorthsideUsed', true)
    safeCall(api, 'moveInvestigator', inv.seat, String(picked))
    info(api, `${inv.name} 使用北区（火车站）：移动到「${String(picked)}」。`)
    return true
  }
  if (move.rule === 'retMasksMuseumClue') {
    if (flagValueOf(state, 'retMasksMuseumUsed')) return false
    setFlag(state, 'retMasksMuseumUsed', true)
    safeCall(api, 'horror', inv.seat, 2)
    safeCall(api, 'gainClues', inv.seat, 1)
    info(api, `${inv.name} 使用米斯卡塔尼克大学（博物馆）：受到 2 点恐惧，获得 1 个线索。`)
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 密谋揭示
// ---------------------------------------------------------------------------
export function agendaReveal(state, agenda, api = {}, revealType = null) {
  const type = revealType || agenda?.reveal?.type
  if (type === 'spawnNarogath') return spawnNarogath(state, api)
  if (type === 'spawnMaskedHunter') return spawnMaskedHunter(state, api)
  if (type === 'resolution2') { safeCall(api, 'finish', 'r2'); return true }
  return false
}

function spawnNarogath(state, api) {
  const cultists = cultistEnemiesInPlay(state).filter(enemy => codeOf(enemy) !== NAROGATH_CODE)
  const distanceToCultists = inv => {
    if (!cultists.length || typeof api?.locationDistance !== 'function') return 0
    return Math.min(...cultists.map(enemy => {
      const value = api.locationDistance(inv.location, [enemy.location])
      return value == null || value < 0 ? Infinity : value
    }))
  }
  const candidates = activeInvestigators(state)
  const target = candidates.sort((a, b) => distanceToCultists(a) - distanceToCultists(b))[0] || null
  const locationId = target?.location || state.locations?.[0]?.id
  const enemy = safeCall(api, 'spawnEngaged', NAROGATH_CODE, locationId, target?.seat ?? null)
  if (enemy) info(api, `👹 纳罗加斯现身，与「猎物」${target?.name || '调查员'}交战！`)
  return true
}

function spawnMaskedHunter(state, api) {
  const seats = activeInvestigators(state).map(inv => inv.seat)
  const target = seats.length
    ? api.preyTarget?.({ code: AGENDA1_LINKED_CODE, name: '假面猎手', prey: 'mostClues' }, seats)
    : null
  const location = target != null ? state.investigators[target].location : state.scenario?.startLocation
  const enemy = safeCall(api, 'spawnEngaged', AGENDA1_LINKED_CODE, location, target)
  if (enemy) info(api, '👹 假面猎手现身，与猎物交战！')
  return true
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
export function resolution(state, key, events = null, api = {}) {
  void events
  void SCENARIO_TEXT
  const finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : 'noResolution'
  const records = recordsFor(state)
  const interrogated = (state.cultistsInVictory || []).map(entry => api.originalCardCode
    ? api.originalCardCode(entry) : codeOf(entry))
  records.cultistsInterrogated = interrogated
  const remaining = [...(state.cultistDeck || [])].map(entry => api.originalCardCode
    ? api.originalCardCode(entry) : codeOf(entry))
  const escapedInPlay = enemiesInPlay(state)
    .filter(enemy => hasTrait(enemy, 'Cultist'))
    .map(enemy => api.originalCardCode ? api.originalCardCode(enemy) : codeOf(enemy))
  const neverSpawned = []
  if ((state.agendaIndex ?? 0) === 0) {
    neverSpawned.push(AGENDA1_RETURN_CODE === '50026a' ? NAROGATH_CODE : AGENDA1_LINKED_CODE)
  }
  records.cultistsEscaped = [...new Set([...remaining, ...escapedInPlay, ...neverSpawned])]
    .filter(code => !interrogated.includes(code))
  if ((state.victoryDisplay || []).some(card => codeOf(card) === GHOUL_PRIEST_CODE)) records.ghoulPriestAlive = false
  const infoApi = api?.info ? api : {}
  info(infoApi, finalKey === 'r2'
    ? '结局 2：记录午夜已至；异教徒盘问/逃脱记录在案。'
    : '结局 1：记录盘问到的异教徒；异教徒逃脱记录在案。')
  void LITA_CODE
  return {
    bonus: 0,
    award: true,
    effects: [
      { record: { pastMidnight: true }, when: { resolution: 'r2' } },
      { record: { pastMidnight: false }, when: { not: { resolution: 'r2' } } },
    ],
  }
}

// ---------------------------------------------------------------------------
// 只读投影
// ---------------------------------------------------------------------------
export function scenarioSummary(state) {
  return {
    act: codeOf(state.acts?.[state.actIndex ?? 0]),
    agenda: currentAgendaCode(state),
    agenda1: flagValueOf(state, 'retMasksAgenda1') || null,
    cultistDeck: (state.cultistDeck || []).length,
    cultistsInVictory: (state.cultistsInVictory || []).length,
    variants: flagValueOf(state, 'retMasksVariants') || null,
  }
}

export function describe(state) {
  return [
    `异教徒牌堆剩余 ${(state.cultistDeck || []).length} 张；已盘问 ${(state.cultistsInVictory || []).length} 名。`,
    `密谋 1：${flagValueOf(state, 'retMasksAgenda1')?.returnTo ? '重返版（纳罗加斯）' : '原版（假面猎手）'}。`,
  ]
}

export function implementedEntryFlags(code) {
  void code
  return {}
}

export const events = {}

export const behavior = {
  id: CHAPTER_ID,
  startLocation,
  locationsStartRevealed: false,
  spawnOverrides: { [GHOUL_PRIEST_CODE]: 'yourHouse' },
  drawCultistActIndex: 0,
  preScenarioSetup,
  prepareScenario,
  setupScenario,
  setupLocations,
  setupEnemies,
  modifyDeck,
  afterDeckSetup,
  spawnLocation,
  enemySpawned,
  enemyStatModifier,
  mythosEnded,
  enemyPhaseEnd,
  parleyBlocked,
  actions,
  performAction,
  agendaReveal,
  resolution,
  events,
  scenarioSummary,
  describe,
  currentAgendaCode,
  codeOf,
}

export {
  ACT_CODES, ACT1_CODE, AGENDA1_BASE_CODE, AGENDA1_RETURN_CODE, AGENDA1_LINKED_CODE, NAROGATH_CODE,
  AGENDA2_CODE, AGENDA_CODES, START_LOCATION, RIVERTOWN_IF_BURNED, ENCOUNTER_DECK,
  CULTIST_DECK_CODES, LOCATION_IDS, ARKHAM_LOCATION_IDS, GHOUL_PRIEST_CODE, LITA_CODE, currentAgendaCode,
}
