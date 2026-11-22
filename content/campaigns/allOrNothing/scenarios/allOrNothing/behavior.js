// 破釜沉舟（All or Nothing · 90011）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/AllOrNothing.hs + frontend/src/locales/en/standalone/allOrNothing.json。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   startLocation / setupLocations / afterDeckSetup → 5 地点、赌场管理员、放一边区。
//   actions / performAction → 议程 1 的「在卡牌室兑现筹码」。
//   roundEnded → 幕 1 目标（回合结束时有人 ≥15 资源 → 推进）。
//   enemyDefeated → 幕 1「罪犯敌人被击败 → 议程 +1 毁灭」；幕 2「罪犯获得猎手/+1 生命」同步。
//   investigatorEliminated → 幕 2 撤退者资源放上幕、全员撤退 → 推进；奥图尔被击败 → 结局 2。
//   actReveal → 幕 1 背面开放撤退/生成 4 名俱乐部保安；幕 2 背面进入结局 1。
//   agendaReveal → 议程推进即结局 2。
//   resolveChaosToken / applyTokenEffect / tokenMeanings → 90011 提示卡标记。
//   resolution → 声明式结局（记录 + 幕上资源档位奖励）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  ACT1_CODE, ACT2_CODE, AGENDA_CODE, BOUNCER_CODE, CHAPTER_ID, ENCOUNTER_DECK, EXCLUDED_DECK_CODES,
  KEY_INVESTIGATOR, LOCATION_CODES, LOCATION_COORDINATES, LOCATION_IDS, PIT_BOSS_CODE,
  PIT_BOSS_FALLBACK, RESOLUTION_KEYS, SCENARIO_ACT_TEXT, SCENARIO_AGENDA_TEXT, SCENARIO_TEXT,
  SET_ASIDE_CODES, SIOBHAN_CODE, START_LOCATION, TOKEN_MEANINGS, tokenTier,
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
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const currentActCode = state => codeOf((state.acts || [])[state.actIndex ?? 0])
const currentAct = state => (state.acts || [])[state.actIndex ?? 0] || null
const findSkids = state => (state.investigators || []).find(inv => inv && codeOf(inv) === KEY_INVESTIGATOR) || null
const isSkids = inv => codeOf(inv) === KEY_INVESTIGATOR
const enemiesInPlay = state => (state.enemies || []).filter(enemy => !enemy.defeated)
const criminals = state => enemiesInPlay(state).filter(enemy => hasTrait(enemy, 'Criminal'))

function splitParagraphs(text) {
  return String(text || '').split(/\n{2,}/).map(line => line.trim()).filter(Boolean)
}

export function spawnScenarioEnemy(state, code, locationId, options = {}) {
  const definition = (state.scenario?.enemies || {})[code]
    || (code === PIT_BOSS_CODE ? PIT_BOSS_FALLBACK : null)
  if (!definition) return null
  state.enemies ||= []
  const enemy = {
    id: `e${++state.instanceSeq.e}`,
    code, originalCode: code,
    name: definition.name, nameEn: definition.nameEn,
    location: locationId,
    fight: definition.fight ?? null, evade: definition.evade ?? null,
    health: definition.healthPerInvestigator
      ? Number(definition.health) * investigatorCount(state) : Number(definition.health) || 1,
    damage: definition.damage || 0, horror: definition.horror || 0,
    traits: [...(definition.traits || [])],
    hunter: Boolean(definition.hunter), aloof: Boolean(definition.aloof),
    retaliate: Boolean(definition.retaliate), alert: Boolean(definition.alert),
    prey: definition.prey || null, elite: Boolean(definition.elite),
    exhausted: options.exhausted === true,
    engagedSeat: options.engagedSeat ?? null,
    damageTaken: 0, doom: 0, clues: 0, attachments: [],
    victory: Number(definition.victory) || 0,
  }
  state.enemies.push(enemy)
  if (enemy.engagedSeat != null) state.investigators[enemy.engagedSeat]?.engaged.push(enemy.id)
  return enemy
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
export function startLocation() {
  return START_LOCATION
}

export function setupLocations(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  setFlag(state, 'allOrNothingPrepared', true)
  info(api, `破釜沉舟：放置 ${LOCATION_IDS.length} 处四叶草俱乐部/月下美人地点；调查员从月下美人开始。`)
  return [...LOCATION_IDS]
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = [SET_ASIDE_CODES[0], SET_ASIDE_CODES[1], SET_ASIDE_CODES[2], SIOBHAN_CODE,
    BOUNCER_CODE, BOUNCER_CODE, BOUNCER_CODE, BOUNCER_CODE]
  // 幕 1：不能撤退 → 关闭本关撤退入口（幕 1 背面再打开）。
  state.scenario.resignAnywhere = false
  const laBellaLuna = locationOf(state, START_LOCATION)
  if (laBellaLuna) laBellaLuna.resign = false
  // 赌场管理员放在俱乐部大厅（The House Always Wins 的全局定义优先，本地兜底）。
  if (!enemiesInPlay(state).some(enemy => codeOf(enemy) === PIT_BOSS_CODE)) {
    const spawnResult = typeof api.spawn === 'function'
      ? safeCall(api, 'spawn', PIT_BOSS_CODE, 'cloverClubLounge', {}) : null
    if (!spawnResult) spawnScenarioEnemy(state, PIT_BOSS_CODE, 'cloverClubLounge')
  }
  setFlag(state, 'allOrNothingPrepared', true)
  return { setAside: state.scenarioZones.setAside.length }
}

export function setupScenario(state, api = {}) {
  state.locations = []
  for (const id of LOCATION_IDS) {
    const definition = (state.scenario?.locations || {})[id]
    const instance = { ...structuredClone(definition), clues: 0, revealed: false, connections: [...definition.connections] }
    state.locations.push(instance)
  }
  state.investigators ||= []
  for (const inv of state.investigators) inv.location = START_LOCATION
  afterDeckSetup(state, null, { api })
  return { placed: LOCATION_IDS.length }
}

// ---------------------------------------------------------------------------
// 行动
// ---------------------------------------------------------------------------
export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const here = locationOf(state, inv.location)
  if (!here) return []
  const moves = []
  // 议程 1：在卡牌室兑现筹码。
  if (here.id === 'cloverClubCardroom' && Number(inv.clues) > 0) {
    moves.push({
      action: 'scenarioAction', rule: 'allOrNothingCashChips', locationId: here.id, actions: 1,
      label: `兑现筹码：花费全部 ${inv.clues} 个线索，获得 ${inv.clues * 5} 资源`,
    })
  }
  return moves
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv || inv.defeated || inv.resigned) return false
  if (move.rule === 'allOrNothingCashChips') {
    const spent = Number(inv.clues) || 0
    if (spent <= 0) return false
    if (typeof api.spendClues === 'function') api.spendClues(inv.seat, spent)
    else inv.clues = 0
    if (typeof api.gainResources === 'function') api.gainResources(inv.seat, spent * 5)
    else inv.resources = (Number(inv.resources) || 0) + spent * 5
    info(api, `${inv.name} 兑现 ${spent} 个线索的筹码，获得 ${spent * 5} 个资源。`)
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 幕 1/2 状态同步
// ---------------------------------------------------------------------------
function syncCriminalKeywords(state, api = {}) {
  const act = currentActCode(state)
  const act1 = act === ACT1_CODE
  const act2 = act === ACT2_CODE
  if (!act1 && !act2) return false
  const setKeywords = api?.setEnemyKeywords
  for (const enemy of enemiesInPlay(state)) {
    if (!hasTrait(enemy, 'Criminal')) continue
    if (typeof setKeywords === 'function') {
      setKeywords(enemy, ['aloof'], { enabled: act1 && codeOf(enemy) === PIT_BOSS_CODE, throughRound: Number(state.round) || 0 })
      setKeywords(enemy, ['hunter'], { enabled: act2, throughRound: Number(state.round) || 0 })
    } else {
      if (codeOf(enemy) === PIT_BOSS_CODE) enemy.aloof = act1
      if (act2) enemy.hunter = true
    }
  }
  return true
}

export function enemySpawned(state, enemy, api = {}) {
  void enemy
  syncCriminalKeywords(state, api)
  return false
}

export function phaseBegan(state, phase, api = {}) {
  void phase
  syncCriminalKeywords(state, api)
  return false
}

export function enemyStatModifier(state, enemy, stat) {
  if (stat !== 'health') return 0
  if (currentActCode(state) === ACT2_CODE && hasTrait(enemy, 'Criminal')) return 1
  return 0
}

// ---------------------------------------------------------------------------
// 回合结束（幕 1 目标）
// ---------------------------------------------------------------------------
export function roundEnded(state, api = {}) {
  if (currentActCode(state) !== ACT1_CODE) {
    checkActTwoResigned(state, api)
    return false
  }
  const ready = activeInvestigators(state).find(inv => (Number(inv.resources) || 0) >= 15)
  if (ready) {
    info(api, `幕 1 目标达成：${ready.name} 拥有 ${ready.resources} 个资源（≥15），推进幕。`)
    safeCall(api, 'advanceAct')
    return true
  }
  return false
}

function checkActTwoResigned(state, api = {}) {
  if (currentActCode(state) !== ACT2_CODE) return false
  const alive = activeInvestigators(state)
  if (!alive.length) return false
  if (alive.some(inv => !inv.resigned)) return false
  info(api, '幕 2 目标达成：所有未被击败的调查员都已撤退，推进幕。')
  safeCall(api, 'advanceAct')
  return true
}

// ---------------------------------------------------------------------------
// 敌人被击败 / 调查员离场
// ---------------------------------------------------------------------------
export function enemyDefeated(state, enemy, api = {}) {
  if (currentActCode(state) === ACT1_CODE && hasTrait(enemy, 'Criminal')) {
    setFlag(state, 'allOrNothingDoomFromCriminal', (flagValue(state, 'allOrNothingDoomFromCriminal') || 0) + 1)
    if (typeof api.addDoom === 'function') api.addDoom(1)
    info(api, '幕 1：一个[[罪犯]]敌人被击败，议程上放置 1 个毁灭。')
  }
  syncCriminalKeywords(state, api)
  return false
}

export function investigatorEliminated(state, inv, clues = 0, api = {}) {
  void clues
  if (!inv) return false
  if (currentActCode(state) === ACT2_CODE && inv.resigned) {
    const act = currentAct(state)
    if (act) {
      act.resources = (Number(act.resources) || 0) + (Number(inv.resources) || 0)
      inv.resources = 0
      info(api, `${inv.name} 撤退：把其资源放到幕 2 上（幕上现有 ${act.resources} 资源）。`)
    }
    checkActTwoResigned(state, api)
    return false
  }
  if (isSkids(inv) && inv.defeated) {
    setFlag(state, 'allOrNothingResolution', 'resolution2')
    info(api, '「Skids」奥图尔被击败：进入结局 2。')
    safeCall(api, 'finish', 'resolution2')
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 幕 / 议程 / 结局
// ---------------------------------------------------------------------------
export function actReveal(state, act, api = {}) {
  const code = codeOf(act)
  if (code === ACT1_CODE) {
    // 幕 1 背面：开放撤退入口，并在黑暗走廊生成 4 名俱乐部保安（参考「后厅门廊」部队的近似落点）。
    state.scenario.resignAnywhere = true
    const laBellaLuna = locationOf(state, START_LOCATION)
    if (laBellaLuna) laBellaLuna.resign = true
    state.scenarioZones ||= {}
    const aside = state.scenarioZones.setAside || []
    let spawned = 0
    for (let count = 0; count < 4; count += 1) {
      const at = aside.indexOf(BOUNCER_CODE)
      if (at >= 0) aside.splice(at, 1)
      spawnScenarioEnemy(state, BOUNCER_CODE, 'darkenedHall', { engagedSeat: null })
      spawned += 1
    }
    spawnScenarioEnemy(state, SIOBHAN_CODE, 'darkenedHall', { engagedSeat: null })
    setFlag(state, 'allOrNothingAct1Advanced', { bouncers: spawned })
    syncCriminalKeywords(state, api)
    info(api, `幕 1 背面：幕 2 入替，调查员现在可以撤退；${spawned} 名俱乐部保安与西尔班·莱利在黑暗走廊登场。`)
    return true
  }
  if (code === ACT2_CODE) {
    setFlag(state, 'allOrNothingResolution', 'resolution1')
    info(api, '幕 2 背面：调查队带着筹码逃出四叶草俱乐部，进入结局 1。')
    safeCall(api, 'finish', 'resolution1')
    return true
  }
  return false
}

export function agendaReveal(state, agenda, api = {}) {
  if (codeOf(agenda) !== AGENDA_CODE) return false
  setFlag(state, 'allOrNothingResolution', 'resolution2')
  info(api, '议程 1 背面：奥图尔被抓住，进入结局 2。')
  safeCall(api, 'finish', 'resolution2')
  return true
}

export function allResigned(state, api = {}) {
  // 幕 2：全员撤退是推进条件（actReveal 会进入结局 1）；幕 1/其它情况按结局 2。
  if (currentActCode(state) === ACT2_CODE) {
    info(api, '所有未被击败的调查员都已撤退：推进幕 2。')
    safeCall(api, 'advanceAct')
    return true
  }
  setFlag(state, 'allOrNothingResolution', 'resolution2')
  safeCall(api, 'finish', 'resolution2')
  return true
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
export function resolveChaosToken(state, inv, token, api = {}) {
  void api
  const hard = tokenTier(state) === 'hard'
  const clues = Number(inv?.clues) || 0
  const resources = Number(inv?.resources) || 0
  switch (String(token)) {
    case 'skull':
      return { delta: -(hard ? 2 * clues : clues), onDraw: [], onFail: [] }
    case 'cultist': {
      const base = hard ? 4 : 2
      return { delta: resources >= 10 ? -2 * base : -base, onDraw: [], onFail: [] }
    }
    case 'tablet':
      return {
        delta: hard ? -3 : -2, onDraw: [],
        onFail: hard ? [{ type: 'scenarioToken', token: 'tablet', mode: 'loseResources', count: 3 }] : [],
      }
    case 'elderthing':
      return {
        delta: hard ? -5 : -3, onDraw: [],
        onFail: [{ type: 'scenarioToken', token: 'elderthing', mode: 'skidsHorror' }],
      }
    default:
      return null
  }
}

export function applyTokenEffect(state, inv, effect = {}, api = {}) {
  if (!effect || effect.type !== 'scenarioToken') return false
  switch (effect.mode) {
    case 'loseResources': {
      const count = Number(effect.count) || 3
      if (typeof api.loseResources === 'function') api.loseResources(inv.seat, count)
      else inv.resources = Math.max(0, (Number(inv.resources) || 0) - count)
      info(api, `${inv.name} 因 [tablet] 失败，失去 ${count} 个资源。`)
      return true
    }
    case 'skidsHorror': {
      const skids = findSkids(state)
      if (!skids) return false
      if (typeof api.horror === 'function') api.horror(skids.seat, 1)
      else skids.horror = (Number(skids.horror) || 0) + 1
      info(api, '「Skids」奥图尔因 [elder_thing] 失败受到 1 点恐惧。')
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
export function actTwoResources(state) {
  const act2 = (state.acts || []).find(act => codeOf(act) === ACT2_CODE)
  return Number(act2?.resources) || 0
}

export function resourceRewardTier(total) {
  if (total >= 60) return { extraXp: 3, startingResources: 6 }
  if (total >= 50) return { extraXp: 2, startingResources: 5 }
  if (total >= 40) return { extraXp: 1, startingResources: 4 }
  if (total >= 30) return { extraXp: 0, startingResources: 3 }
  if (total >= 20) return { extraXp: 0, startingResources: 2 }
  if (total >= 10) return { extraXp: 0, startingResources: 1 }
  return { extraXp: 0, startingResources: 0 }
}

export function resolution(state, key, events = null, api = {}) {
  void events
  void api
  const finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : 'noResolution'
  const recordKey = finalKey === 'resolution1' ? 'resolution1' : 'resolution2'
  const skids = findSkids(state)
  const total = actTwoResources(state)
  const tier = resourceRewardTier(total)
  setFlag(state, 'allOrNothingResolvedTo', recordKey)
  const effects = [
    { record: { allOrNothingResolution: recordKey } },
    { record: { allOrNothingResourcesOnAct: total } },
    {
      text: recordKey === 'resolution1'
        ? `调查队带着 ${total} 个资源逃出四叶草俱乐部（结局 1）。`
        : '调查队未能逃出四叶草俱乐部（结局 2）。',
    },
  ]
  if (recordKey === 'resolution1' && tier.extraXp > 0) {
    effects.push({ xp: { amount: tier.extraXp, targets: skids ? skids.seat : 'lead' } })
  }
  if (skids && tier.startingResources > 0) {
    effects.push({
      record: { allOrNothingNextScenarioResources: tier.startingResources },
    })
  }
  return {
    award: true,
    effects,
  }
}

// ---------------------------------------------------------------------------
// 只读投影 / 导入
// ---------------------------------------------------------------------------
export function scenarioSummary(state) {
  return {
    act: currentActCode(state),
    agenda: codeOf((state.agendas || [])[state.agendaIndex ?? 0]),
    criminals: criminals(state).length,
    actTwoResources: actTwoResources(state),
    setAside: [...(state.scenarioZones?.setAside || [])],
    skidsSeat: findSkids(state)?.seat ?? null,
  }
}

export function introduction() {
  const paragraphs = splitParagraphs(SCENARIO_TEXT.intro)
  return {
    version: 3,
    title: SCENARIO_TEXT.heading,
    sections: [{ title: SCENARIO_TEXT.heading, paragraphs }],
    paragraphs,
    code: ACT1_CODE,
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
  roundEnded,
  enemySpawned,
  enemyDefeated,
  enemyStatModifier,
  phaseBegan,
  investigatorEliminated,
  actReveal,
  agendaReveal,
  allResigned,
  resolveChaosToken,
  applyTokenEffect,
  tokenMeanings,
  resolution,
  introduction,
  scenarioSummary,
  // 具名助手
  findSkids,
  isSkids,
  criminals,
  actTwoResources,
  resourceRewardTier,
  spawnScenarioEnemy,
  LOCATION_COORDINATES,
  ENCOUNTER_DECK,
}

export {
  ACT1_CODE, ACT2_CODE, AGENDA_CODE, RESOLUTION_KEYS, START_LOCATION, LOCATION_IDS, SET_ASIDE_CODES,
  criminals, findSkids, isSkids,
}
