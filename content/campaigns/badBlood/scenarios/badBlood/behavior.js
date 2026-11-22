// 血海深仇（Bad Blood · 90020）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/BadBlood.hs + Scenarios/BadBlood/{Helpers,Meta}.hs +
//       frontend/src/locales/en/standalone/badBlood.json。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   startLocation / setupLocations / afterDeckSetup → 固定 8 地点 + 随机 1 地点、9 个记忆、艾尔佩斯。
//   actions / performAction → 幕 1 的 [fast] 收集记忆。
//   enemyPhaseEnd → 艾尔佩斯的收集/巡逻（敌方阶段结束时）。
//   enemyDefeated → 艾尔佩斯「被击败」改为治愈/翻面并结算 90023b。
//   enemyStatModifier → 艾尔佩斯每收集 1 个记忆 -1 战斗/-1 闪避。
//   actReveal / agendaReveal / allResigned / investigatorEliminated → 推进与结局。
//   resolveChaosToken / applyTokenEffect / tokenMeanings → 90020 提示卡标记。
//   resolution → 声明式结局（记录 + 艾格尼丝按记忆数或胜利点取高拿经验）。
import {
  ACT_CODE, AGENDA_CODE, AGNES_TITLE, ALL_LOCATIONS, CHAPTER_ID, ELSPETH_BACK_CODE, ELSPETH_CODE,
  ENCOUNTER_DECK, FIXED_LOCATION_IDS, KEY_INVESTIGATOR, LOCATION_COORDINATES, RANDOM_LOCATION_IDS,
  RANDOM_LOCATION_TABLE, RESOLUTION_KEYS, SCENARIO_ACT_TEXT, SCENARIO_AGENDA_TEXT, SCENARIO_TEXT,
  START_LOCATION, TOKEN_MEANINGS, tokenTier,
} from './definition.js'

const activeInvestigators = state => (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
const info = (api, message) => api?.info?.(message)
const codeOf = value => String(value?.originalCode || value?.code || '')
const flagsFor = state => (state.scenarioFlags ||= {})
const flagValue = (state, key) => flagsFor(state)[key]
const setFlag = (state, key, value = true) => { flagsFor(state)[key] = value; return value }
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const randomOf = api => (typeof api?.random === 'function' ? api.random : () => Math.random())
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const locationOfMemory = state => (state.locations || []).find(location => (Number(location.memory) || 0) > 0) || null
const findAgnes = state => (state.investigators || []).find(inv => inv && codeOf(inv) === KEY_INVESTIGATOR) || null
const isAgnes = inv => codeOf(inv) === KEY_INVESTIGATOR
  || String(inv?.nameEn || inv?.name || '').includes(AGNES_TITLE)
const findElspeth = state => (state.enemies || []).find(enemy => codeOf(enemy) === ELSPETH_CODE && !enemy.defeated) || null
const agnesMemories = state => Number(flagValue(state, 'badBloodAgnesMemories')) || 0
const elspethMemories = state => Number(flagValue(state, 'badBloodElspethMemories')) || 0
const collectedMemories = state => agnesMemories(state) + elspethMemories(state)
const placedMemories = state => (state.locations || []).filter(location => (Number(location.memory) || 0) > 0).length
const groupCluesAt = (state, locationId) => activeInvestigators(state)
  .filter(inv => inv.location === locationId)
  .reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)

function splitParagraphs(text) {
  return String(text || '').split(/\n{2,}/).map(line => line.trim()).filter(Boolean)
}

// BFS 一步移动：返回从 fromId 朝最近有记忆地点走的第一步地点 id。
export function stepTowardMemory(state, fromId) {
  const target = locationOfMemory(state)
  if (!target || target.id === fromId) return null
  const seen = new Set([fromId])
  const queue = [[fromId, null]]
  while (queue.length) {
    const [current, firstStep] = queue.shift()
    const location = locationOf(state, current)
    if (!location) continue
    for (const next of location.connections || []) {
      if (seen.has(next)) continue
      seen.add(next)
      const step = firstStep || next
      if (next === target.id) return step
      queue.push([next, step])
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
export function startLocation() {
  return START_LOCATION
}

export function chooseRandomLocation(api = {}) {
  const random = randomOf(api)
  const index = Math.min(RANDOM_LOCATION_IDS.length - 1, Math.floor(random() * RANDOM_LOCATION_IDS.length))
  return RANDOM_LOCATION_IDS[index]
}

export function spawnScenarioEnemy(state, code, locationId, options = {}) {
  const definition = (state.scenario?.enemies || {})[code]
  if (!definition) return null
  state.enemies ||= []
  const enemy = {
    id: `e${++state.instanceSeq.e}`,
    code, originalCode: code,
    name: definition.name, nameEn: definition.nameEn,
    location: locationId,
    fight: definition.fight ?? null, evade: definition.evade ?? null,
    health: Number(definition.health) || 1,
    damage: definition.damage || 0, horror: definition.horror || 0,
    traits: [...(definition.traits || [])],
    hunter: Boolean(definition.hunter), aloof: Boolean(definition.aloof),
    retaliate: Boolean(definition.retaliate), alert: Boolean(definition.alert),
    patrol: Boolean(definition.patrol), prey: definition.prey || null,
    elite: Boolean(definition.elite),
    exhausted: options.exhausted === true,
    engagedSeat: options.engagedSeat ?? null,
    damageTaken: 0, doom: 0, clues: 0, attachments: [],
    victory: Number(definition.victory) || 0,
  }
  state.enemies.push(enemy)
  if (enemy.engagedSeat != null) state.investigators[enemy.engagedSeat]?.engaged.push(enemy.id)
  return enemy
}

export function setupLocations(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  const randomLocation = chooseRandomLocation(api)
  setFlag(state, 'badBloodRandomLocation', randomLocation)
  info(api, `血海深仇：放置 8 处固定地点与随机地点「${randomLocation}」；全员从薇尔玛餐厅开始。`)
  return [...FIXED_LOCATION_IDS, randomLocation]
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  void helper
  // 每个在场地点放 1 个记忆。
  for (const location of state.locations || []) location.memory = 1
  if (!findElspeth(state)) spawnScenarioEnemy(state, ELSPETH_CODE, 'curiositieShoppe', {})
  const randomLocation = flagValue(state, 'badBloodRandomLocation')
  setFlag(state, 'badBloodPrepared', { randomLocation, memories: (state.locations || []).length })
  return { randomLocation, memories: placedMemories(state) }
}

export function setupScenario(state, api = {}) {
  state.locations = []
  const randomLocation = chooseRandomLocation(api)
  for (const id of [...FIXED_LOCATION_IDS, randomLocation]) {
    const definition = (state.scenario?.locations || ALL_LOCATIONS)[id]
    if (!definition) continue
    const instance = { ...structuredClone(definition), clues: 0, revealed: false, connections: [...definition.connections] }
    state.locations.push(instance)
  }
  state.investigators ||= []
  for (const inv of state.investigators) inv.location = START_LOCATION
  afterDeckSetup(state, null, { api })
  return { placed: state.locations.length, randomLocation }
}

// ---------------------------------------------------------------------------
// 行动：幕 1 收集记忆（[fast]，团队花线索）
// ---------------------------------------------------------------------------
export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const here = locationOf(state, inv.location)
  if (!here) return []
  const agnes = findAgnes(state)
  if (!agnes || inv.location !== agnes.location) return []
  if (!(Number(here.memory) > 0)) return []
  const required = 2 * investigatorCount(state)
  const available = groupCluesAt(state, here.id)
  return [{
    action: 'scenarioAction', rule: 'badBloodCollectMemory', locationId: here.id, actions: 0,
    label: `[fast] 团队花费 ${required} 个线索：艾格尼丝·贝克收集本地点的记忆`,
    reason: available >= required ? null : `本地点需要共 ${required} 个线索（现有 ${available}）`,
  }]
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv || inv.defeated || inv.resigned) return false
  if (move.rule !== 'badBloodCollectMemory') return false
  const agnes = findAgnes(state)
  const here = locationOf(state, inv.location)
  if (!agnes || !here || inv.location !== agnes.location) return false
  if (!(Number(here.memory) > 0)) return false
  const required = 2 * investigatorCount(state)
  if (typeof api.payGroupClues === 'function') {
    if (!api.payGroupClues(required, { atLocation: here.id })) return false
  } else {
    let remaining = required
    for (const payer of activeInvestigators(state).filter(item => item.location === here.id)) {
      if (remaining <= 0) break
      const pay = Math.min(Number(payer.clues) || 0, remaining)
      payer.clues -= pay
      remaining -= pay
    }
    if (remaining > 0) return false
  }
  here.memory = 0
  setFlag(state, 'badBloodAgnesMemories', agnesMemories(state) + 1)
  info(api, `艾格尼丝收集了「${here.name}」的记忆（已收集 ${agnesMemories(state)} 个）。`)
  checkMemories(state, api)
  return true
}

function checkMemories(state, api = {}) {
  if (collectedMemories(state) < 9) return false
  if (flagValue(state, 'badBloodActAdvanced')) return false
  setFlag(state, 'badBloodActAdvanced', true)
  info(api, '9 个记忆已全部被收集，幕 1 目标达成。')
  safeCall(api, 'advanceAct')
  return true
}

// ---------------------------------------------------------------------------
// 敌方阶段结束：艾尔佩斯收集记忆 / 巡逻
// ---------------------------------------------------------------------------
function collectMemoryForElspeth(state, api = {}) {
  const elspeth = findElspeth(state)
  if (!elspeth) return false
  const here = locationOf(state, elspeth.location)
  if (!here || !(Number(here.memory) > 0)) return false
  here.memory = 0
  setFlag(state, 'badBloodElspethMemories', elspethMemories(state) + 1)
  info(api, `艾尔佩斯收集了「${here.name}」的记忆（已收集 ${elspethMemories(state)} 个）。`)
  checkMemories(state, api)
  return true
}

export function enemyPhaseEnd(state, api = {}) {
  const elspeth = findElspeth(state)
  if (!elspeth) return false
  if (!elspeth.exhausted && (Number(locationOf(state, elspeth.location)?.memory) || 0) > 0) {
    collectMemoryForElspeth(state, api)
    return true
  }
  if (elspeth.engagedSeat == null && !(Number(locationOf(state, elspeth.location)?.memory) || 0)) {
    const step = stepTowardMemory(state, elspeth.location)
    if (step && typeof api.moveEnemy === 'function') {
      api.moveEnemy(elspeth, step)
      info(api, `艾尔佩斯·博丹巡逻移动到「${locationOf(state, step)?.name || step}」。`)
      return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// 艾尔佩斯：被击败改为翻面结算；数值随记忆下降
// ---------------------------------------------------------------------------
export function enemyStatModifier(state, enemy, stat) {
  if (codeOf(enemy) !== ELSPETH_CODE) return 0
  if (stat === 'fight' || stat === 'evade') return -elspethMemories(state)
  return 0
}

export function enemyDefeated(state, enemy, api = {}) {
  if (codeOf(enemy) !== ELSPETH_CODE) return false
  enemy.damageTaken = 0
  enemy.exhausted = true
  enemy.engagedSeat = null
  enemy.flipped = true
  for (const inv of state.investigators || []) inv.engaged = (inv.engaged || []).filter(id => id !== enemy.id)
  const agnes = findAgnes(state)
  let choice = 'memory'
  if (agnes && typeof api.choose === 'function') {
    choice = api.choose({
      kind: 'choice', source: ELSPETH_BACK_CODE, seat: agnes.seat,
      prompt: '「凯旋与征服」：艾格尼丝·贝克必须选择一项。',
      options: [
        { id: 'memory', label: '从艾尔佩斯处收集 1 个记忆' },
        { id: 'clues', label: `从供应堆获得 ${2 * investigatorCount(state)} 个线索` },
      ],
    })
  }
  if (choice === 'clues' && agnes) {
    if (typeof api.gainClues === 'function') api.gainClues(agnes.seat, 2 * investigatorCount(state))
    else agnes.clues = (Number(agnes.clues) || 0) + 2 * investigatorCount(state)
    info(api, '「凯旋与征服」：艾格尼丝从供应堆获得线索。')
  } else if (agnes) {
    if (elspethMemories(state) > 0) {
      setFlag(state, 'badBloodElspethMemories', elspethMemories(state) - 1)
      setFlag(state, 'badBloodAgnesMemories', agnesMemories(state) + 1)
      info(api, '「凯旋与征服」：艾格尼丝从艾尔佩斯处取得 1 个记忆。')
      checkMemories(state, api)
    } else {
      info(api, '「凯旋与征服」：艾尔佩斯还没有记忆可夺取。')
    }
  }
  return true
}

// ---------------------------------------------------------------------------
// 幕 / 议程 / 结局
// ---------------------------------------------------------------------------
export function actReveal(state, act, api = {}) {
  if (codeOf(act) !== ACT_CODE) return false
  setFlag(state, 'badBloodResolution', 'resolution1')
  info(api, '幕 1 背面：艾格尼丝保住了自己的记忆，进入结局 1。')
  safeCall(api, 'finish', 'resolution1')
  return true
}

export function agendaReveal(state, agenda, api = {}) {
  if (codeOf(agenda) !== AGENDA_CODE) return false
  setFlag(state, 'badBloodResolution', 'resolution2')
  info(api, '议程 1 背面：艾尔佩斯占了上风，进入结局 2。')
  safeCall(api, 'finish', 'resolution2')
  return true
}

export function investigatorEliminated(state, inv, clues = 0, api = {}) {
  void clues
  if (!inv) return false
  if (isAgnes(inv) && inv.defeated) {
    setFlag(state, 'badBloodResolution', 'resolution2')
    info(api, '艾格尼丝·贝克被击败：进入结局 2。')
    safeCall(api, 'finish', 'resolution2')
    return true
  }
  return false
}

export function allResigned(state, api = {}) {
  setFlag(state, 'badBloodResolution', 'resolution2')
  safeCall(api, 'finish', 'resolution2')
  return true
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
export function resolveChaosToken(state, inv, token, api = {}) {
  void inv
  void api
  const hard = tokenTier(state) === 'hard'
  switch (String(token)) {
    case 'skull': {
      const memories = agnesMemories(state)
      return { delta: -(hard ? memories + 1 : memories), onDraw: [], onFail: [] }
    }
    case 'cultist':
      return {
        delta: hard ? -3 : -2,
        onDraw: [{ type: 'scenarioToken', token: 'cultist', mode: 'readyElspeth' }],
        onFail: [],
      }
    case 'tablet':
      return {
        delta: hard ? -5 : -3, onDraw: [],
        onFail: [{ type: 'scenarioToken', token: 'tablet', mode: 'elspethPatrol' }],
      }
    case 'elderthing':
      // 近似：参考的「承受伤害换取技能值」需要检定额外值窗口，本批只结算 -6/-8 差值。
      return { delta: hard ? -8 : -6, onDraw: [], onFail: [] }
    default:
      return null
  }
}

export function applyTokenEffect(state, inv, effect = {}, api = {}) {
  if (!effect || effect.type !== 'scenarioToken') return false
  void inv
  const elspeth = findElspeth(state)
  switch (effect.mode) {
    case 'readyElspeth': {
      if (!elspeth) return false
      elspeth.exhausted = false
      if (typeof api.readyEnemy === 'function') api.readyEnemy(elspeth)
      info(api, '[cultist]：重整艾尔佩斯·博丹并结算其巡逻关键字。')
      const step = elspeth.engagedSeat == null ? stepTowardMemory(state, elspeth.location) : null
      if (step && typeof api.moveEnemy === 'function') {
        api.moveEnemy(elspeth, step)
        info(api, `艾尔佩斯巡逻移动到「${locationOf(state, step)?.name || step}」。`)
      }
      return true
    }
    case 'elspethPatrol': {
      if (!elspeth || elspeth.engagedSeat != null) return false
      const step = stepTowardMemory(state, elspeth.location)
      if (!step || typeof api.moveEnemy !== 'function') return false
      api.moveEnemy(elspeth, step)
      info(api, '[tablet]：艾尔佩斯沿巡逻路径移动。')
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
export function resolution(state, key, events = null, api = {}) {
  void events
  void api
  const finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : 'noResolution'
  const recordKey = finalKey === 'resolution1' ? 'resolution1' : 'resolution2'
  const agnes = findAgnes(state)
  const memories = agnesMemories(state)
  setFlag(state, 'badBloodResolvedTo', recordKey)
  return {
    award: true,
    seatBonus: seat => {
      if (!agnes || agnes.seat !== seat) return 0
      // 艾格尼丝：经验取「胜利点」或「已收集记忆数」较高者；引擎已把胜利点计入基础值。
      return Math.max(0, memories - (Number(state.victory) || 0))
    },
    effects: [
      { record: { badBloodResolution: recordKey } },
      { record: { badBloodAgnesMemories: memories } },
      { record: { badBloodElspethMemories: elspethMemories(state) } },
      {
        text: recordKey === 'resolution1'
          ? `艾格尼丝收集了 ${memories} 个记忆，保住了自己（结局 1）。`
          : `艾格尼丝收集了 ${memories} 个记忆，艾尔佩斯占了上风（结局 2）。`,
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
    agnesMemories: agnesMemories(state),
    elspethMemories: elspethMemories(state),
    placedMemories: placedMemories(state),
    randomLocation: flagValue(state, 'badBloodRandomLocation') || null,
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
  enemyPhaseEnd,
  enemyStatModifier,
  enemyDefeated,
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
  findAgnes,
  isAgnes,
  findElspeth,
  agnesMemories,
  elspethMemories,
  placedMemories,
  stepTowardMemory,
  chooseRandomLocation,
  spawnScenarioEnemy,
  LOCATION_COORDINATES,
  ENCOUNTER_DECK,
}

export {
  ACT_CODE, AGENDA_CODE, RESOLUTION_KEYS, START_LOCATION, RANDOM_LOCATION_IDS, RANDOM_LOCATION_TABLE,
  findAgnes, isAgnes, findElspeth,
}
