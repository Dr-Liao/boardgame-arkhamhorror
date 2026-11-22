// 恐怖狂欢节（carnevaleOfHorrors · 82001）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/CarnevaleOfHorrors.hs + Act|Agenda|Enemy|Treachery/Cards/CarnevaleOfHorrors/*.hs。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   preScenarioSetup / startLocation → 随机移除 1 张地点、其余 8 张以随机圆环入场
//   setupLocations / locationPlaced / afterDeckSetup → 圆环连接、面具行人/院长/无辜计数、遭遇牌库
//   actions / performAction → 幕 1「团队花费线索查看面具行人另一面」、幕 3「向贡多拉放资源」、
//                             「攻击奈达斯奎（如同位于你所在地点）」
//   phaseBegan → 幕 2 正面：神话阶段开始后翻 1 名面具行人
//   actReveal → 幕 1 背面（奈达斯奎入场/翻面具）、幕 2 背面（贡多拉入场）、幕 3 背面（结局 1）
//   agendaReveal → 议程 1 背面（巴尔福狂欢者生成）
//   agendaWouldAdvance → 议程 2 背面（翻面具并放到议程牌库下方；仍有面具则留在 2a）、
//                        议程 3 背面（奈达斯奎攻击全员；留在 3a）
//   checkObjectives → 幕目标（3 名无辜 / 全员在运河畔 / 贡多拉 4[per_investigator] 资源）
//   enemySpawned / enemyDefeated → 盘绕附肢在议程 3 上放 2 毁灭；奈达斯奎被击败→结局 2
//   resolveChaosToken / applyTokenEffect / tokenMeanings → 混乱标记
//   resolution → 声明式结局 effects（记录 / 面具奖励 / 院长/牺牲分支）
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  ACT1_CODE, ACT2_CODE, ACT3_CODE, AGENDA1_CODE, AGENDA2_CODE, AGENDA3_CODE,
  ACTS, AGENDAS, ACT_STAGES, AGENDA_STAGES, AGENDA_CODES, ENCOUNTER_DECK,
  LOCATIONS, LOCATION_TABLE, RING_ORDER, STATIC_CONNECTIONS, START_LOCATION, CANAL_SIDE,
  CNIDATHQUA_CODE, MASKED_GOER_CODE, INNOCENT_REVELER_CODE, ABBESS_CODE, WRITHING_APPENDAGE_CODE,
  BALEFUL_REVELER_CODE, GONDOLA_CODE, MASK_CODES, SET_ASIDE_ALIASES, SCENARIO_TEXT,
} from './definition.js'

const CHAPTER_ID = 'carnevaleOfHorrors'

const clone = value => structuredClone(value)
const codeOf = value => String(value?.originalCode || value?.code || '')
const info = (api, message) => api?.info?.(message)
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const activeInvestigators = state => (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
const flagsFor = state => (state.scenarioFlags ||= {})
const flagValue = (state, key) => flagsFor(state)[key]
const setFlag = (state, key, value = true) => { flagsFor(state)[key] = value; return value }
const randomOf = api => (typeof api?.random === 'function' ? api.random : () => 0.5)
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const currentActCode = state => codeOf((state.acts || [])[state.actIndex ?? 0])
const currentAgendaCode = state => codeOf((state.agendas || [])[state.agendaIndex ?? 0])
const isHardSide = state => state.difficulty === 'hard' || state.difficulty === 'expert'
const entryFlagsOf = code => registeredEntry(String(code || ''))?.flags || {}
const carnevaleState = state => flagValue(state, 'carnevale') || {}
const setCarnevaleState = (state, patch) => setFlag(state, 'carnevale', { ...carnevaleState(state), ...patch })
const cnidathqua = state => (state.enemies || []).find(enemy => codeOf(enemy) === CNIDATHQUA_CODE && !enemy.defeated) || null
const innocentTotal = state => Number(carnevaleState(state).innocentAgenda || 0) + Number(carnevaleState(state).innocentAct || 0)
const shuffleWith = (api, list) => {
  if (typeof api?.shuffle === 'function') return api.shuffle([...list])
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(randomOf(api) * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function spawnEnemyAt(state, code, locationId, api, options = {}) {
  if (typeof api?.spawn === 'function') return api.spawn(code, locationId, options)
  const definition = (state.scenario?.enemies || {})[code] || {}
  const enemy = {
    id: `${code}-${state.round}-${(state.enemies?.length || 0) + 1}`, code, originalCode: code,
    name: definition.name || code,
    fight: definition.fight ?? 1, evade: definition.evade ?? 1,
    health: definition.health ?? 1, damage: definition.damage || 0, horror: definition.horror || 0,
    damageTaken: 0, doom: 0, location: locationId ?? null, engagedSeat: options.engagedSeat ?? null,
    exhausted: false,
  }
  state.enemies ||= []
  state.enemies.push(enemy)
  return enemy
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
export function prepareScenario(state, api = {}) {
  if (flagValue(state, 'carnevaleSetup')) return flagValue(state, 'carnevaleSetup')
  // 随机移除 1 张（圣马可 / 运河畔除外）：候选 = 其余 7 张。
  const candidates = LOCATION_TABLE.map(([id]) => id)
    .filter(id => id !== 'sanMarcoBasilica' && id !== CANAL_SIDE && id !== 'gondola')
  const removed = shuffleWith(api, candidates)[0]
  const rest = candidates.filter(id => id !== removed)
  const ring = ['sanMarcoBasilica', ...shuffleWith(api, [CANAL_SIDE, ...rest])]
  const setup = { removed, ring, maskedGoers: ring.length - 1, innocentAct: 0, innocentAgenda: 0,
    cnidathquaId: null, gondolaPlaced: false, gondolaResources: 0 }
  setFlag(state, 'carnevale', setup)
  setFlag(state, 'carnevaleSetup', { removed, ring })
  const actSource = state.scenario?.stageCards || ACT_STAGES
  state.acts = [ACT1_CODE, ACT2_CODE, ACT3_CODE].map(code => clone(actSource[code] || ACT_STAGES[code]))
  state.agendas = AGENDA_CODES.map(code => clone(AGENDA_STAGES[code]))
  state.actIndex = Number.isInteger(state.actIndex) ? state.actIndex : 0
  state.agendaIndex = Number.isInteger(state.agendaIndex) ? state.agendaIndex : 0
  info(api, `恐怖狂欢节：随机移除地点「${locLabel(state, removed)}」；8 张地点以随机圆环入场。`)
  return flagValue(state, 'carnevaleSetup')
}

const locLabel = (state, id) => LOCATIONS[id]?.name || locationOf(state, id)?.name || id

export function preScenarioSetup(state, events, helperOrApi = {}) {
  void events
  const api = helperOrApi?.api || helperOrApi || {}
  return prepareScenario(state, api)
}

export function startLocation() {
  return START_LOCATION
}

/** 圆环连接：每张地点与环上前后相邻地点双向相连（参考 PlacedLocationDirection 链）。 */
export function applyRingConnections(state) {
  const ring = carnevaleState(state).ring || RING_ORDER
  for (const [index, id] of ring.entries()) {
    const location = locationOf(state, id)
    if (!location) continue
    const prev = ring[(index + ring.length - 1) % ring.length]
    const next = ring[(index + 1) % ring.length]
    location.connections = [...new Set([prev, next])]
  }
  return ring
}

export function setupLocations(state, events, helper = {}) {
  void events
  const api = helper?.api || {}
  const report = prepareScenario(state, api)
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = [...SET_ASIDE_ALIASES]
  state.encounterDeck ||= [...ENCOUNTER_DECK]
  const ring = report.ring
  // 放完后统一重写圆环连接（placeLocation 之后 connections 以 definition 为准，这里覆盖）。
  const placed = [...ring]
  setFlag(state, 'carnevaleRing', ring)
  for (const [index, id] of ring.entries()) {
    const prev = ring[(index + ring.length - 1) % ring.length]
    const next = ring[(index + 1) % ring.length]
    LOCATIONS[id].connections = [...new Set([prev, next])]
  }
  info(api, `恐怖狂欢节：${placed.length} 张地点入场（圆环），${ring.length - 1} 名戴面具的狂欢节行人分布在各地点。`)
  return placed
}

export function locationPlaced(state, location, api = {}, seat = null) {
  void api
  void seat
  if (!location) return
  location.revealed = true
  const card = ALL_CARDS[codeOf(location)] || {}
  const fixed = Number(location.cluesFixed)
  const perPlayer = Number(location.cluesPerInvestigator)
  if (Number.isFinite(fixed)) location.clues = Math.max(0, fixed)
  else if (Number.isFinite(perPlayer)) location.clues = perPlayer * investigatorCount(state)
  else if (Number.isFinite(Number(card.clues))) location.clues = Number(card.clues) * investigatorCount(state)
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  prepareScenario(state, api)
  state.scenarioZones ||= {}
  state.scenarioZones.setAside ||= [...SET_ASIDE_ALIASES]
  if (!state.encounterDeck?.length) state.encounterDeck = [...ENCOUNTER_DECK]
  applyRingConnections(state)
  info(api, `恐怖狂欢节布置完成：${state.locations.length} 张地点、${carnevaleState(state).maskedGoers} 名面具行人在场。`)
  return { ring: carnevaleState(state).ring }
}

/** 单测/直调入口。 */
export function setupScenario(state, api = {}) {
  state.locations = []
  state.scenarioFlags ||= {}
  delete state.scenarioFlags.carnevaleSetup
  delete state.scenarioFlags.carnevale
  const report = prepareScenario(state, api)
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = [...SET_ASIDE_ALIASES]
  for (const id of report.ring) {
    const instance = { ...clone(LOCATIONS[id]), clues: 0, revealed: true, connections: [...LOCATIONS[id].connections] }
    state.locations.push(instance)
    locationPlaced(state, instance, api)
  }
  applyRingConnections(state)
  state.investigators ||= []
  for (const inv of state.investigators) if (!inv.location) inv.location = START_LOCATION
  state.encounterDeck = [...ENCOUNTER_DECK]
  afterDeckSetup(state, null, { api })
  return { ...report, placedIds: state.locations.map(location => location.id) }
}

// ---------------------------------------------------------------------------
// 面具行人 / 无辜的狂欢者（本实现用计数近似：参考实现是双面资产 + 牌库下方实体卡）
// ---------------------------------------------------------------------------
export function flipMaskedGoer(state, api = {}, { choose = false } = {}) {
  const current = carnevaleState(state)
  if (!(Number(current.maskedGoers) > 0)) {
    info(api, '场上没有戴面具的狂欢节行人可翻面。')
    return null
  }
  const ring = current.ring || []
  const candidates = ring.filter(id => id !== START_LOCATION)
  const index = choose
    ? Math.max(0, (ring.indexOf(candidates[Math.floor(randomOf(api) * candidates.length)])))
    : 0
  const locationId = candidates[Math.max(0, Math.min(candidates.length - 1, Number(index) || 0))]
  setCarnevaleState(state, {
    maskedGoers: Number(current.maskedGoers) - 1,
    innocentAgenda: Number(current.innocentAgenda || 0) + 1,
  })
  info(api, `🎭 地点「${locLabel(state, locationId)}」的一名戴面具的狂欢节行人被翻面：另一面是无辜的狂欢者`
    + '（放到议程牌库下方）。')
  return { locationId, innocentTotal: innocentTotal(state) }
}

/** 幕 1 行动：调查员作为团队花费 1[per_investigator] 线索，查看一名面具行人的另一面。 */
function groupCluesAt(state, locationId = null) {
  return activeInvestigators(state)
    .filter(inv => !locationId || inv.location === locationId)
    .reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
}

function spendGroupClues(state, locationId, amount) {
  let remaining = Math.max(0, Number(amount) || 0)
  for (const inv of activeInvestigators(state).filter(item => !locationId || item.location === locationId)) {
    if (remaining <= 0) break
    const spend = Math.min(Number(inv.clues) || 0, remaining)
    inv.clues -= spend
    remaining -= spend
  }
  return remaining === 0
}

// ---------------------------------------------------------------------------
// 行动
// ---------------------------------------------------------------------------
export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const moves = []
  const actCode = currentActCode(state)
  // 幕 1「[action] 调查员作为团队花费 1[per_investigator] 线索：查看任意地点一名面具行人的另一面」。
  if (actCode === ACT1_CODE) {
    const required = investigatorCount(state)
    const available = groupCluesAt(state)
    moves.push({
      action: 'scenarioAction', rule: 'carnevaleRevealMaskedGoer', locationId: inv.location, actions: 1,
      label: `团队花费 ${required} 个线索：查看一名戴面具的狂欢节行人的另一面`,
      reason: Number(carnevaleState(state).maskedGoers) > 0
        ? (available >= required ? null : `团队需要 ${required} 个线索（现有 ${available}）`)
        : '场上没有面具行人',
    })
  }
  // 幕 3「划船！」：在贡多拉上放资源（本实现按调查员花费 1 资源推进贡多拉资源）。
  if (actCode === ACT3_CODE) {
    const gondola = locationOf(state, GONDOLA_CODE)
    if (gondola) {
      moves.push({
        action: 'scenarioAction', rule: 'carnevaleRow', locationId: gondola.id, actions: 1,
        label: '花费 1 资源：向贡多拉放置 1 资源（目标 4[per_investigator]）',
        reason: (Number(inv.resources) || 0) >= 1 ? null : '需要 1 资源',
      })
    }
  }
  // 奈达斯奎：「可以攻击奈达斯奎，如同它位于你所在地点（但不与其交战）」。
  if (cnidathqua(state) && actCode !== ACT1_CODE) {
    moves.push({
      action: 'scenarioAction', rule: 'carnevaleFightCnidathqua', locationId: inv.location, actions: 1,
      label: '攻击奈达斯奎（如同它位于你所在地点；战斗 4，不能躲避）',
      reason: null,
    })
  }
  return moves
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv || inv.defeated || inv.resigned) return false
  if (move.rule === 'carnevaleRevealMaskedGoer') {
    const required = investigatorCount(state)
    if (!spendGroupClues(state, null, required)) return false
    flipMaskedGoer(state, api, { choose: true })
    return true
  }
  if (move.rule === 'carnevaleRow') {
    if ((Number(inv.resources) || 0) < 1) return false
    safeCall(api, 'loseResources', inv.seat, 1)
    const current = carnevaleState(state)
    setCarnevaleState(state, { gondolaResources: Number(current.gondolaResources || 0) + 1 })
    info(api, `🛶 你们向贡多拉放置 1 资源（${Number(carnevaleState(state).gondolaResources)}/${4 * investigatorCount(state)}）。`)
    return true
  }
  if (move.rule === 'carnevaleFightCnidathqua') return fightCnidathqua(state, inv, api)
  return false
}

function fightCnidathqua(state, inv, api) {
  const enemy = cnidathqua(state)
  if (!enemy) return false
  safeCall(api, 'test', inv.seat, 'combat', 4, result => {
    if (result?.success) {
      safeCall(api, 'damageEnemy', enemy.id, 1, inv.seat)
      const taken = Number(enemy.damageTaken) || 0
      info(api, `🌊 你击中奈达斯奎（${taken}/${Number(enemy.health) || 8}）。`)
      if (taken >= (Number(enemy.health) || 8)) {
        state.enemies = state.enemies.filter(item => item !== enemy)
        info(api, '奈达斯奎被击败！（→结局 2）')
        safeCall(api, 'finish', 'resolution2')
      }
      return
    }
    info(api, '你攻击奈达斯奎失败：从遭遇牌库找出一张盘绕附肢并与你交战。')
    const appendage = spawnEnemyAt(state, WRITHING_APPENDAGE_CODE, inv.location, api, { engagedSeat: inv.seat })
    if (appendage) info(api, '盘绕附肢生成并与你交战。')
  })
  return true
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
export function actReveal(state, act, api = {}) {
  const code = codeOf(act)
  if (code === ACT1_CODE) {
    // 把奈达斯奎放入所有地点的中心：视为在场但不在任何地点。
    const enemy = spawnEnemyAt(state, CNIDATHQUA_CODE, null, api)
    if (enemy) setCarnevaleState(state, { cnidathquaId: enemy.id })
    info(api, '🐙 奈达斯奎入场：它被视为在场，但不在任何地点。')
    flipMaskedGoer(state, api, { choose: true })
    return true
  }
  if (code === ACT2_CODE) {
    const location = locationOf(state, GONDOLA_CODE)
    if (!location && typeof api?.place === 'function') {
      api.place(GONDOLA_CODE)
      const gondola = locationOf(state, GONDOLA_CODE)
      if (gondola) {
        gondola.revealed = true
        gondola.connections = [CANAL_SIDE]
        const canal = locationOf(state, CANAL_SIDE)
        if (canal) canal.connections = [...new Set([...(canal.connections || []), GONDOLA_CODE])]
        setCarnevaleState(state, { gondolaPlaced: true })
      }
    }
    info(api, '🛶 贡多拉入场，与运河畔相连。')
    return true
  }
  if (code === ACT3_CODE) {
    info(api, '🌅 幕 3 背面：你们划船离开威尼斯。（→结局 1）')
    safeCall(api, 'finish', 'resolution1')
    return true
  }
  return false
}

export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  if (code === AGENDA1_CODE) {
    const lead = leadSeatOf(state)
    const inv = state.investigators?.[lead]
    const enemy = spawnEnemyAt(state, BALEFUL_REVELER_CODE, inv?.location || START_LOCATION, api,
      { engagedSeat: lead })
    if (enemy) info(api, `🎭 议程 1 背面：巴尔福狂欢者生成并与 ${inv?.name || '队长'} 交战。`)
    return true
  }
  return false
}

/** 议程「推进后翻回」的近似：议程 2 仍有面具行人 → 留在 2a 并翻 1 名；议程 3 → 奈达斯奎攻击全员并留在 3a。
 *  读点：act-agenda.js#advanceAgenda（reason === 'doom' 时返回真值取消推进），第二参即场景运行时 api。 */
export function agendaWouldAdvance(state, api = {}) {
  const code = currentAgendaCode(state)
  if (code === AGENDA2_CODE) {
    if (Number(carnevaleState(state).maskedGoers) > 0) {
      flipMaskedGoer(state, api, { choose: true })
      return true
    }
    return false
  }
  if (code === AGENDA3_CODE) {
    const enemy = cnidathqua(state)
    if (enemy) {
      for (const inv of activeInvestigators(state)) safeCall(api, 'attack', enemy, inv)
      info(api, '🌑 议程 3 背面：奈达斯奎攻击每位调查员；本议程翻回 3a。')
    }
    return true
  }
  return false
}

export function phaseBegan(state, phase, api = {}) {
  // 幕 2 正面强制：神话阶段开始后，选择场上一名面具行人并翻面。
  if (phase === 'mythos' && currentActCode(state) === ACT2_CODE && Number(carnevaleState(state).maskedGoers) > 0) {
    flipMaskedGoer(state, api, { choose: true })
    return true
  }
  return false
}

export function checkObjectives(state, api = {}) {
  const actCode = currentActCode(state)
  if (actCode === ACT1_CODE) {
    if (innocentTotal(state) >= 3) {
      info(api, `🎭 场景/议程牌库下方已有 ${innocentTotal(state)} 名无辜的狂欢者。（推进幕 1）`)
      safeCall(api, 'advanceAct')
      return true
    }
    return false
  }
  if (actCode === ACT2_CODE) {
    const allThere = activeInvestigators(state).every(inv => inv.location === CANAL_SIDE)
    if (allThere && activeInvestigators(state).length) {
      info(api, '🛶 全体未被击败的调查员已到达运河畔。（推进幕 2）')
      safeCall(api, 'advanceAct')
      return true
    }
    return false
  }
  if (actCode === ACT3_CODE) {
    const required = 4 * investigatorCount(state)
    if (Number(carnevaleState(state).gondolaResources || 0) >= required) {
      info(api, `🛶 贡多拉上已有 ${required} 资源：你们开始划船！（推进幕 3）`)
      safeCall(api, 'advanceAct')
      return true
    }
    return false
  }
  return false
}

export function enemySpawned(state, enemy, api = {}) {
  if (codeOf(enemy) === CNIDATHQUA_CODE) setCarnevaleState(state, { cnidathquaId: enemy.id })
  if (codeOf(enemy) === WRITHING_APPENDAGE_CODE && currentAgendaCode(state) === AGENDA3_CODE) {
    enemy.doom = (Number(enemy.doom) || 0) + 2
    info(api, '🌑 议程 3 正面：在盘绕附肢上放置 2 个毁灭标记。')
    return true
  }
  return false
}

export function enemyDefeated(state, enemy, api = {}) {
  if (codeOf(enemy) !== CNIDATHQUA_CODE) return false
  info(api, '奈达斯奎被击败！（→结局 2）')
  safeCall(api, 'finish', 'resolution2')
  return true
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
export function resolveChaosToken(state, inv, token) {
  const face = String(token || '').toLowerCase().replace('_', '')
  const hard = isHardSide(state)
  const current = carnevaleState(state)
  const innocents = Number(current.innocentAgenda || 0) + (hard ? Number(current.innocentAct || 0) : 0)
  if (face === 'skull') return { delta: -(2 + innocents) }
  if (face === 'cultist') {
    return { delta: 0, drawAnother: true,
      onFail: [{ type: 'scenarioToken', token: 'cultist', mode: 'drawEncounterOnFail' }] }
  }
  if (face === 'tablet') {
    return { delta: hard ? -4 : -3,
      onFail: [{ type: 'scenarioToken', token: 'tablet', mode: 'innocentHarm' }] }
  }
  if (face === 'elderthing') {
    return { delta: hard ? -6 : -4,
      onFail: [{ type: 'scenarioToken', token: 'elderthing', mode: 'cnidathquaAttack', seat: inv?.seat ?? null }] }
  }
  return null
}

export function applyTokenEffect(state, inv, effect = {}, api = {}) {
  const mode = effect.mode
  if (mode === 'drawEncounterOnFail') {
    safeCall(api, 'drawEncounter', inv?.seat)
    info(api, '🃏 [cultist]：检定失败，抽取遭遇牌库顶 1 张。')
    return true
  }
  if (mode === 'innocentHarm') {
    info(api, '🎭 [tablet]：对最近的无辜的狂欢者造成 1 伤害或 1 恐惧（本实现：结算给抽到此标记的调查员）。')
    safeCall(api, 'horror', inv?.seat, 1)
    return true
  }
  if (mode === 'cnidathquaAttack') {
    const enemy = cnidathqua(state)
    if (enemy && inv) safeCall(api, 'attack', enemy, inv)
    info(api, '🐙 [elder_thing]：奈达斯奎攻击你。')
    return true
  }
  return false
}

export function tokenMeanings() {
  return SCENARIO_TEXT.tokens
}

// ---------------------------------------------------------------------------
// 地点离场强制效果 / 敌人生成落点（条目 flags 的唯一读点）
// ---------------------------------------------------------------------------
export function locationLeft(state, inv, location, api = {}) {
  const flags = entryFlagsOf(codeOf(location))
  if (!flags.locationLeft) return false
  if (flags.locationLeft === 'loseAction') {
    if (state.phase === 'investigation') inv.actionsLeft = Math.max(0, (inv.actionsLeft || 0) - 1)
    else {
      inv.pendingActionLoss ||= {}
      inv.pendingActionLoss[state.round] = (inv.pendingActionLoss[state.round] || 0) + 1
    }
    info(api, `🌉 ${inv.name} 离开里亚尔托桥：失去 1 行动。`)
    return true
  }
  if (flags.locationLeft === 'horror') {
    safeCall(api, 'horror', inv.seat, 1)
    info(api, `🌉 ${inv.name} 离开叹息桥：受到 1 点恐惧。`)
    return true
  }
  if (flags.locationLeft === 'lose2Resources') {
    safeCall(api, 'loseResources', inv.seat, 2)
    info(api, `🌉 ${inv.name} 离开学院桥：失去 2 资源。`)
    return true
  }
  return false
}

export function spawnLocation(state, code, fallback, engagedSeat, api = {}) {
  void engagedSeat
  const flags = entryFlagsOf(code)
  const ring = carnevaleState(state).ring || [...RING_ORDER]
  const placed = new Set((state.locations || []).map(location => location.id))
  const lead = leadSeatOf(state)
  const leadLocation = state.investigators?.[lead]?.location || START_LOCATION
  const index = ring.indexOf(leadLocation)
  if (flags.spawnRule === 'canalSide') return placed.has(CANAL_SIDE) ? CANAL_SIDE : fallback
  if (flags.spawnRule === 'acrossFromLead' && index >= 0) {
    const target = ring[(index + Math.floor(ring.length / 2)) % ring.length]
    return placed.has(target) ? target : fallback
  }
  if (flags.spawnRule === 'clockwiseNearestEmptyFromLead' && index >= 0) {
    for (let step = 1; step <= ring.length; step++) {
      const id = ring[(index + step) % ring.length]
      if (!placed.has(id)) continue
      const occupied = (state.investigators || []).some(inv => !inv.defeated && !inv.resigned && inv.location === id)
      if (!occupied) return id
    }
  }
  return fallback
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
function rewardEffects(state) {
  const effects = []
  for (const code of MASK_CODES) effects.push({ storyCard: code })
  const current = carnevaleState(state)
  if (Number(current.innocentAgenda || 0) === 0 && Number(current.innocentAct || 0) === 3) {
    effects.push({ storyCard: ABBESS_CODE })
  }
  return effects
}

export function resolution(state, key, events = null, api = {}) {
  void events
  const infoApi = api?.info ? api : api?.api || {}
  const finalKey = String(key)
  const effects = []
  if (finalKey === 'noResolution') {
    effects.push({ record: { manyWereSacrificedToCnidathquaDuringTheCarnivale: true } })
    info(infoApi, '无结局：记录「狂欢节期间许多人被献祭给了奈达斯奎」；前往额外奖励。')
  } else if (finalKey === 'resolution1') {
    effects.push({ record: { theSunBanishedCnidathquaIntoTheDepths: true } })
    info(infoApi, '结局 1：记录「太阳把奈达斯奎驱逐回深渊」；前往额外奖励。')
  } else if (finalKey === 'resolution2') {
    effects.push({ record: { cnidathquaRetreatedToNurseItsWounds: true } })
    info(infoApi, '结局 2：记录「奈达斯奎退回去养伤」；前往额外奖励。')
  }
  effects.push(...rewardEffects(state))
  return { bonus: 0, award: true, effects, flowData: { resolution: finalKey } }
}

// ---------------------------------------------------------------------------
// 只读投影 / 具名助手
// ---------------------------------------------------------------------------
export function scenarioSummary(state) {
  const current = carnevaleState(state)
  return {
    act: currentActCode(state),
    agenda: currentAgendaCode(state),
    ring: [...(current.ring || [])],
    removed: current.removed || null,
    maskedGoers: Number(current.maskedGoers || 0),
    innocentAgenda: Number(current.innocentAgenda || 0),
    innocentAct: Number(current.innocentAct || 0),
    gondolaResources: Number(current.gondolaResources || 0),
    cnidathqua: Boolean(cnidathqua(state)),
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
  carnevaleFlipMaskedGoer(state, payload = {}, api = {}) {
    return flipMaskedGoer(state, api, { choose: payload.choose === true })
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
  applyRingConnections,
  actions,
  performAction,
  actReveal,
  agendaReveal,
  agendaWouldAdvance,
  phaseBegan,
  checkObjectives,
  spawnLocation,
  locationLeft,
  enemySpawned,
  enemyDefeated,
  resolveChaosToken,
  applyTokenEffect,
  tokenMeanings,
  resolution,
  events,
  scenarioSummary,
  flipMaskedGoer,
  innocentTotal,
  currentActCode,
  currentAgendaCode,
  cnidathqua,
  codeOf,
}
