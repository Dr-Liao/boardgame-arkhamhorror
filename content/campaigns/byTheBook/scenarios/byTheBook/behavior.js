// 循规蹈矩（By the Book · 90032）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/ByTheBook.hs + Scenarios/ByTheBook/Helpers.hs +
//       frontend/src/locales/en/standalone/byTheBook.json。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   startLocation / setupLocations / afterDeckSetup → 9 地点、9 名同谋暗置、罗兰 1 线索。
//   actions / performAction → 幕 1 翻开同谋、罗兰横置异教徒、警察局移动/谈判捕获。
//   enemyCanBeDefeated → 非弱点[[异教徒]]敌人改为治疗至剩 1 生命。
//   checkObjectives / actReveal / agendaReveal / investigatorEliminated / allResigned → 推进与结局。
//   resolveChaosToken / applyTokenEffect / tokenMeanings → 90032 提示卡标记。
//   resolution → 声明式结局（罗兰按敌人胜利点、其他调查员按地点胜利点拿经验）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  ACT_CODE, AGENDA1_CODE, AGENDA2_CODE, CHAPTER_ID, CONSPIRATOR_CODES, ENCOUNTER_DECK,
  KEY_INVESTIGATOR, LOCATION_COORDINATES, LOCATION_TABLE, LOCATION_VARIANTS, LOCATIONS,
  MR_GREY_CODE, POLICE_STATION_CODE, RESOLUTION_KEYS, ROLAND_TITLE, SCENARIO_ACT_TEXT,
  SCENARIO_AGENDA_TEXT, SCENARIO_TEXT, START_LOCATION, TOKEN_MEANINGS, VARIANT_LOCATION_TABLE,
  tokenTier,
} from './definition.js'

const activeInvestigators = state => (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
const info = (api, message) => api?.info?.(message)
const codeOf = value => String(value?.originalCode || value?.code || '')
const hasTrait = (value, trait) => (value?.traits || [])
  .some(item => String(item).toLowerCase().replace(/\s+/g, '') === String(trait).toLowerCase().replace(/\s+/g, ''))
const flagsFor = state => (state.scenarioFlags ||= {})
const flagValue = (state, key) => flagsFor(state)[key]
const setFlag = (state, key, value = true) => { flagsFor(state)[key] = value; return value }
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const randomOf = api => (typeof api?.random === 'function' ? api.random : () => Math.random())
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const findRoland = state => (state.investigators || []).find(inv => inv && codeOf(inv) === KEY_INVESTIGATOR) || null
const isRoland = inv => codeOf(inv) === KEY_INVESTIGATOR
  || String(inv?.nameEn || inv?.name || '').includes(ROLAND_TITLE)
const enemiesInPlay = state => (state.enemies || []).filter(enemy => !enemy.defeated)
const cultistsInPlay = state => enemiesInPlay(state).filter(enemy => hasTrait(enemy, 'Cultist'))
const engagedCultists = (state, seat) => cultistsInPlay(state).filter(enemy => enemy.engagedSeat === seat)
const conspiratorAt = (state, locationId) => locationOf(state, locationId)?.conspirator || null
const remainingHealth = enemy => Math.max(0, (Number(enemy.health) || 0) - (Number(enemy.damageTaken) || 0))
const groupCluesAt = (state, locationId) => activeInvestigators(state)
  .filter(inv => inv.location === locationId)
  .reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)

function splitParagraphs(text) {
  return String(text || '').split(/\n{2,}/).map(line => line.trim()).filter(Boolean)
}

function localShuffle(list, rng) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Number(rng()) * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function cultistsCaptured(state) {
  return (state.victoryDisplay || []).filter(entry => {
    const card = ALL_CARDS[entry.code || entry.originalCode] || {}
    return card.type === 'enemy' && (card.traits || []).some(trait => String(trait).toLowerCase() === 'cultist')
  }).length
}

function addEnemyToVictory(state, enemy) {
  state.enemies = (state.enemies || []).filter(item => item !== enemy)
  for (const inv of state.investigators || []) inv.engaged = (inv.engaged || []).filter(id => id !== enemy.id)
  state.victoryDisplay ||= []
  if (!state.victoryDisplay.some(entry => entry.id === enemy.id)) {
    state.victoryDisplay.push({ id: enemy.id, code: enemy.code, originalCode: enemy.originalCode || enemy.code, victory: enemy.victory || 0 })
  }
  return true
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
export function startLocation() {
  return START_LOCATION
}

export function spawnScenarioEnemy(state, code, locationId, options = {}) {
  const definition = (state.scenario?.enemies || {})[code]
  if (!definition) return null
  state.enemies ||= []
  const health = definition.healthPerInvestigator
    ? Number(definition.health) * investigatorCount(state)
    : Number(definition.health) || 1
  const enemy = {
    id: `e${++state.instanceSeq.e}`,
    code, originalCode: code,
    name: definition.name, nameEn: definition.nameEn,
    location: locationId,
    fight: definition.fight ?? null, evade: definition.evade ?? null,
    health,
    damage: definition.damage || 0, horror: definition.horror || 0,
    traits: [...(definition.traits || [])],
    hunter: Boolean(definition.hunter), aloof: Boolean(definition.aloof),
    retaliate: Boolean(definition.retaliate), alert: Boolean(definition.alert),
    elite: Boolean(definition.elite),
    exhausted: options.exhausted === true,
    engagedSeat: options.engagedSeat ?? null,
    damageTaken: 0, doom: 0, clues: 0, attachments: [],
    victory: Number(definition.victory) || 0,
    ...(options.conspirator ? { conspirator: true } : {}),
  }
  state.enemies.push(enemy)
  if (enemy.engagedSeat != null) state.investigators[enemy.engagedSeat]?.engaged.push(enemy.id)
  return enemy
}

export function setupLocations(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  // 双版本地点：本批固定使用参考后端表头版本（01130 商业区第一银行 / 01126 南区历史协会），
  // 另一版本移出游戏；随机选择记入 dossier 近似。
  const chosen = Object.fromEntries(LOCATION_VARIANTS.map(variant => [variant.id, variant.chosen]))
  setFlag(state, 'byTheBookLocationVariants', chosen)
  info(api, `循规蹈矩：放置 9 处地点（商业区 = ${chosen.downtown}，南区 = ${chosen.southside}）；全员从阿卡姆警察局开始。`)
  return [...LOCATION_TABLE.map(([id]) => id), ...VARIANT_LOCATION_TABLE.map(([id]) => id)]
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  void helper
  // 9 名同谋洗混后暗置在每个地点下方。
  const rng = helper?.api && typeof helper.api.random === 'function' ? helper.api.random : () => Math.random()
  const shuffled = localShuffle([...CONSPIRATOR_CODES], rng)
  const locations = state.locations || []
  locations.forEach((location, index) => {
    location.conspirator = shuffled[index] || null
  })
  setFlag(state, 'byTheBookConspirators', Object.fromEntries(locations.map(location => [location.id, location.conspirator])))
  // 罗兰开局获得 1 个线索。
  const roland = findRoland(state)
  if (roland) {
    if (typeof helper?.api?.gainClues === 'function') helper.api.gainClues(roland.seat, 1)
    else roland.clues = (Number(roland.clues) || 0) + 1
  }
  return { conspirators: locations.filter(location => location.conspirator).length }
}

export function setupScenario(state, api = {}) {
  state.locations = []
  const ids = [...LOCATION_TABLE.map(([id]) => id), ...VARIANT_LOCATION_TABLE.map(([id]) => id)]
  for (const id of ids) {
    const definition = (state.scenario?.locations || LOCATIONS)[id]
    if (!definition) continue
    const instance = { ...structuredClone(definition), clues: 0, revealed: false, connections: [...definition.connections] }
    state.locations.push(instance)
  }
  state.investigators ||= []
  for (const inv of state.investigators) inv.location = START_LOCATION
  afterDeckSetup(state, null, { api })
  return { placed: state.locations.length }
}

// ---------------------------------------------------------------------------
// 行动
// ---------------------------------------------------------------------------
export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const here = locationOf(state, inv.location)
  if (!here) return []
  const moves = []
  // 幕 1 [fast]：翻开本地点的同谋并交战入场。
  const conspirator = conspiratorAt(state, here.id)
  if (conspirator) {
    const required = 1 * investigatorCount(state)
    const available = groupCluesAt(state, here.id)
    moves.push({
      action: 'scenarioAction', rule: 'byTheBookFlipConspirator', locationId: here.id, actions: 0,
      label: `[fast] 团队花费 ${required} 个线索：翻开本地点的同谋并使其与你交战入场`,
      reason: available >= required ? null : `本地点需要共 ${required} 个线索（现有 ${available}）`,
    })
  }
  // 幕 1 [fast]（仅罗兰）：花费 1 资源横置与你交战的一名异教徒。
  if (isRoland(inv) && engagedCultists(state, inv.seat).length && (Number(inv.resources) || 0) >= 1) {
    moves.push({
      action: 'scenarioAction', rule: 'byTheBookExhaustCultist', locationId: here.id, actions: 0,
      label: '[fast] 花费 1 个资源：横置一名与你交战的[[异教徒]]敌人（它保持交战）',
    })
  }
  // 阿卡姆警察局 [fast]：移动到连接地点。
  if (codeOf(here) === POLICE_STATION_CODE) {
    for (const destination of here.connections || []) {
      moves.push({
        action: 'scenarioAction', rule: 'byTheBookPoliceMove', locationId: here.id, actions: 0, destination,
        label: `[fast] 移动到「${locationOf(state, destination)?.name || destination}」`,
      })
    }
    // 阿卡姆警察局 [fast]：花费等于剩余生命的线索进行谈判，把该异教徒加入胜利区。
    const capturable = cultistsInPlay(state).filter(enemy => enemy.location === here.id
      && remainingHealth(enemy) > 0 && (Number(inv.clues) || 0) >= remainingHealth(enemy))
    for (const enemy of capturable) {
      moves.push({
        action: 'scenarioAction', rule: 'byTheBookCapture', locationId: here.id, actions: 0, enemyId: enemy.id,
        label: `[fast] 谈判：花费 ${remainingHealth(enemy)} 个线索，把「${enemy.name}」加入胜利区`,
      })
    }
  }
  return moves
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv || inv.defeated || inv.resigned) return false
  if (move.rule === 'byTheBookFlipConspirator') return flipConspirator(state, inv, api)
  if (move.rule === 'byTheBookExhaustCultist') return exhaustCultist(state, inv, api)
  if (move.rule === 'byTheBookPoliceMove') {
    if (typeof api.moveInvestigator === 'function') api.moveInvestigator(inv.seat, move.destination)
    else inv.location = move.destination
    info(api, `${inv.name} 快速移动到「${locationOf(state, move.destination)?.name || move.destination}」。`)
    return true
  }
  if (move.rule === 'byTheBookCapture') return captureCultist(state, inv, move, api)
  return false
}

function flipConspirator(state, inv, api = {}) {
  const here = locationOf(state, inv.location)
  if (!here || !here.conspirator) return false
  const required = 1 * investigatorCount(state)
  if (groupCluesAt(state, here.id) < required) return false
  let remaining = required
  for (const payer of activeInvestigators(state).filter(item => item.location === here.id)) {
    if (remaining <= 0) break
    const pay = Math.min(Number(payer.clues) || 0, remaining)
    payer.clues -= pay
    remaining -= pay
  }
  if (remaining > 0) return false
  const code = here.conspirator
  here.conspirator = null
  const enemy = spawnScenarioEnemy(state, code, here.id, { engagedSeat: inv.seat, conspirator: true })
  info(api, `${inv.name} 翻开同谋「${enemy?.name || code}」，它以与${inv.name}交战的方式入场。`)
  return true
}

function exhaustCultist(state, inv, api = {}) {
  if (!isRoland(inv) || (Number(inv.resources) || 0) < 1) return false
  const target = engagedCultists(state, inv.seat)[0]
  if (!target) return false
  if (typeof api.loseResources === 'function') api.loseResources(inv.seat, 1)
  else inv.resources -= 1
  target.exhausted = true
  info(api, `罗兰花费 1 个资源，横置「${target.name}」。`)
  return true
}

function captureCultist(state, inv, move, api = {}) {
  const enemy = enemiesInPlay(state).find(item => item.id === move.enemyId)
  const here = locationOf(state, inv.location)
  if (!enemy || !here || codeOf(here) !== POLICE_STATION_CODE || enemy.location !== here.id) return false
  const cost = remainingHealth(enemy)
  if ((Number(inv.clues) || 0) < cost) return false
  if (typeof api.spendClues === 'function') api.spendClues(inv.seat, cost)
  else inv.clues -= cost
  addEnemyToVictory(state, enemy)
  info(api, `${inv.name} 花费 ${cost} 个线索与「${enemy.name}」谈判，把它加入胜利区（胜利区异教徒 ${cultistsCaptured(state)} 名）。`)
  checkObjectives(state, api)
  return true
}

// ---------------------------------------------------------------------------
// 敌人的「将被击败」替换：非弱点异教徒改为治疗至剩 1 生命
// ---------------------------------------------------------------------------
export function enemyCanBeDefeated(state, enemy, source = null, seat = null) {
  void source
  void seat
  if (!enemy || !hasTrait(enemy, 'Cultist')) return true
  if (String(enemy.code || '').startsWith('9003')) return true // Mr. Grey 仍可正常结算（近似）
  const health = Number(enemy.health) || 1
  if ((Number(enemy.damageTaken) || 0) >= health) {
    enemy.damageTaken = Math.max(0, health - 1)
    flagValue(state, 'byTheBookHealLog', true)
  }
  return false
}

// ---------------------------------------------------------------------------
// 幕 / 议程 / 结局
// ---------------------------------------------------------------------------
export function checkObjectives(state, api = {}) {
  if (cultistsCaptured(state) < 10) return false
  if (flagValue(state, 'byTheBookActAdvanced')) return false
  setFlag(state, 'byTheBookActAdvanced', true)
  info(api, '胜利区已有 10 名[[异教徒]]敌人，幕 1 目标达成。')
  safeCall(api, 'advanceAct')
  return true
}

export function actReveal(state, act, api = {}) {
  if (codeOf(act) !== ACT_CODE) return false
  setFlag(state, 'byTheBookResolution', 'resolution1')
  info(api, '幕 1 背面：证据确凿，案件告破，进入结局 1。')
  safeCall(api, 'finish', 'resolution1')
  return true
}

export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  if (code === AGENDA1_CODE) {
    // 议程 1 背面：Mr. Grey 入场并与罗兰交战。
    const roland = findRoland(state)
    if (!enemiesInPlay(state).some(enemy => codeOf(enemy) === MR_GREY_CODE)) {
      spawnScenarioEnemy(state, MR_GREY_CODE, roland?.location || START_LOCATION, { engagedSeat: roland?.seat ?? null })
    }
    info(api, '议程 1 背面：Mr. Grey 现身并与罗兰·班克斯交战。')
    return true
  }
  if (code === AGENDA2_CODE) {
    setFlag(state, 'byTheBookResolution', 'resolution2')
    info(api, '议程 2 背面：最后期限已到，进入结局 2。')
    safeCall(api, 'finish', 'resolution2')
    return true
  }
  return false
}

export function investigatorEliminated(state, inv, clues = 0, api = {}) {
  void clues
  if (!inv) return false
  if (isRoland(inv) && inv.defeated) {
    setFlag(state, 'byTheBookResolution', 'resolution2')
    info(api, '罗兰·班克斯被击败：进入结局 2。')
    safeCall(api, 'finish', 'resolution2')
    return true
  }
  return false
}

export function allResigned(state, api = {}) {
  const investigators = state.investigators || []
  const allResigned = investigators.every(inv => inv.resigned)
  if (allResigned) {
    setFlag(state, 'byTheBookResolution', 'resolution1')
    info(api, '罗兰·班克斯撤退：按结局 1 结算。')
    safeCall(api, 'finish', 'resolution1')
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
export function resolveChaosToken(state, inv, token, api = {}) {
  void api
  const hard = tokenTier(state) === 'hard'
  const captured = cultistsCaptured(state)
  switch (String(token)) {
    case 'skull':
      return { delta: -(hard ? 1 + captured : Math.min(5, captured)), onDraw: [], onFail: [] }
    case 'cultist':
      return {
        delta: hard ? -3 : -2,
        drawAnother: engagedCultists(state, inv?.seat ?? 0).length > 0,
        onDraw: [], onFail: [],
      }
    case 'tablet':
      return {
        delta: hard ? -4 : -3, onDraw: [],
        onFail: [{ type: 'scenarioToken', token: 'tablet', mode: 'readyCultists' }],
      }
    case 'elderthing':
      return {
        delta: hard ? -5 : -4, onDraw: [],
        onFail: [{ type: 'scenarioToken', token: 'elderthing', mode: 'rolandDamage' }],
      }
    default:
      return null
  }
}

export function applyTokenEffect(state, inv, effect = {}, api = {}) {
  if (!effect || effect.type !== 'scenarioToken') return false
  const roland = findRoland(state)
  switch (effect.mode) {
    case 'readyCultists': {
      const targets = engagedCultists(state, inv?.seat ?? 0)
      for (const enemy of targets) {
        enemy.exhausted = false
        if (typeof api.readyEnemy === 'function') api.readyEnemy(enemy)
      }
      info(api, `[tablet]：重整 ${targets.length} 名与${inv?.name || '调查员'}交战的[[异教徒]]敌人。`)
      return targets.length > 0
    }
    case 'rolandDamage': {
      if (!roland) return false
      if (typeof api.damage === 'function') api.damage(roland.seat, 1)
      else roland.damage = (Number(roland.damage) || 0) + 1
      info(api, '罗兰·班克斯因 [elder_thing] 失败受到 1 点伤害。')
      return true
    }
    default:
      return false
  }
}

export function tokenMeanings() {
  return TOKEN_MEANINGS
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
function victoryPointSums(state) {
  const enemyVictory = (state.victoryDisplay || []).reduce((sum, entry) => {
    const card = ALL_CARDS[entry.code || entry.originalCode] || {}
    return sum + (card.type === 'enemy' ? Number(entry.victory) || 0 : 0)
  }, 0)
  const locationVictory = (state.locations || []).filter(location => location.revealed && location.clues === 0)
    .reduce((sum, location) => sum + (Number(location.victory) || 0), 0)
  return { enemyVictory, locationVictory }
}

export function resolution(state, key, events = null, api = {}) {
  void events
  void api
  const finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : 'noResolution'
  const roland = findRoland(state)
  const rolandResigned = Boolean(roland && roland.resigned)
  const recordKey = finalKey === 'resolution1' ? 'resolution1'
    : finalKey === 'noResolution' ? (rolandResigned ? 'resolution1' : 'resolution2')
      : 'resolution2'
  const captured = cultistsCaptured(state)
  const { enemyVictory, locationVictory } = victoryPointSums(state)
  setFlag(state, 'byTheBookResolvedTo', recordKey)
  return {
    award: true,
    seatBonus: seat => {
      // seatBonus 在引擎把胜利点计入基础值之后调用：用当时的 state.victory 反推目标分。
      const currentTotal = Number(state.victory) || 0
      const isRolandSeat = Boolean(roland && roland.seat === seat)
      const target = isRolandSeat ? enemyVictory : locationVictory
      const delta = target - currentTotal
      return Math.max(-currentTotal, delta)
    },
    effects: [
      { record: { byTheBookResolution: recordKey } },
      { record: { byTheBookCultistsCaptured: captured } },
      {
        text: recordKey === 'resolution1'
          ? `案件告破：胜利区有 ${captured} 名[[异教徒]]敌人（结局 1）。`
          : `期限已至，案件被迫结案（结局 2）。`,
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// 只读投影 / 导入
// ---------------------------------------------------------------------------
export function scenarioSummary(state) {
  return {
    act: codeOf((state.acts || [])[state.actIndex ?? 0]),
    agenda: codeOf((state.agendas || [])[state.agendaIndex ?? 0]),
    cultistsCaptured: cultistsCaptured(state),
    conspirators: (state.locations || []).filter(location => location.conspirator).length,
    rolandClues: findRoland(state)?.clues ?? 0,
  }
}

export function introduction() {
  const paragraphs = splitParagraphs(SCENARIO_TEXT.intro)
  return {
    version: 3,
    title: SCENARIO_TEXT.heading,
    sections: [{ title: SCENARIO_TEXT.heading, paragraphs }],
    paragraphs,
    code: ACT_CODE,
  }
}

export const behavior = {
  id: CHAPTER_ID,
  startLocation,
  setupLocations,
  afterDeckSetup,
  setupScenario,
  actions,
  performAction,
  enemyCanBeDefeated,
  checkObjectives,
  actReveal,
  agendaReveal,
  investigatorEliminated,
  allResigned,
  resolveChaosToken,
  applyTokenEffect,
  tokenMeanings,
  resolution,
  introduction,
  scenarioSummary,
  // 具名助手
  findRoland,
  isRoland,
  cultistsCaptured,
  cultistsInPlay,
  remainingHealth,
  conspiratorAt,
  spawnScenarioEnemy,
  addEnemyToVictory,
  LOCATION_COORDINATES,
  ENCOUNTER_DECK,
  SCENARIO_ACT_TEXT,
  SCENARIO_AGENDA_TEXT,
  TOKEN_MEANINGS,
}

export {
  ACT_CODE, AGENDA1_CODE, AGENDA2_CODE, RESOLUTION_KEYS, START_LOCATION, POLICE_STATION_CODE,
  MR_GREY_CODE, findRoland, isRoland,
}
