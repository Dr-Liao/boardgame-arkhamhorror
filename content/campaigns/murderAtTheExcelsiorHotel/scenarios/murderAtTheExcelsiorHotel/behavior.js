// 精益酒店谋杀案（murderAtTheExcelsiorHotel · 84001）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/MurderAtTheExcelsiorHotel.hs + Act|Agenda|Enemy|Treachery/Cards/MurderAtTheExcelsiorHotel/*.hs。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   preScenarioSetup / startLocation → 随机真凶议程、地点与放一边区
//   setupLocations / locationPlaced / afterDeckSetup → 5 张入场地点、迹象牌库计数、遭遇牌库
//   actions / performAction → 幕 1「团队花费线索抽迹象」、幕 2「向迹象放线索」、
//                             225 房间的三项清理（血迹/尸体/房间）
//   actReveal → 幕 1 背面（放一边地点入场、按已抽迹象洗入副组、移除其余迹象）
//               幕 2 背面（真相幕间：直接翻到真凶议程并生成真凶目标敌人）
//   agendaReveal → 议程 1 背面（门罗警司/警官/诅咒弱点/线索与毁灭）、议程 2 背面（R3）、
//                  真凶议程背面（因毁灭阈值推进 → R2）
//   checkObjectives → 幕 1（2 张迹象）/ 幕 2（每张迹象线索达标）/ 真凶被击败 → R1
//   resolveChaosToken / applyTokenEffect / tokenMeanings → 混乱标记
//   resolution → 声明式结局 effects（记录 / 弱点 / 匕首 / 门罗）
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  ACT1_CODE, ACT2_CODE, AGENDA1_CODE, AGENDA2_CODE, CULPRIT_CODES, CULPRIT_TARGETS,
  CULPRIT_STAGES, ACT_STAGES, ENCOUNTER_DECK, LEADS, LEAD_CODES, LEAD_CODES as LEAD_LIST,
  SETUP_LOCATION_IDS, SET_ASIDE_LOCATION_IDS, LOCATIONS, START_LOCATION,
  DAGGER_CODE, MONROE_CODE, WHAT_HAVE_YOU_DONE_CODE, OFFICER_CODE, SET_ASIDE_ALIASES, MINI_SET_ENEMIES,
  SCENARIO_TEXT,
} from './definition.js'

const CHAPTER_ID = 'murderAtTheExcelsiorHotel'

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
const entryFlagsOf = code => registeredEntry(String(code || ''))?.flags || {}
const isHardSide = state => state.difficulty === 'hard' || state.difficulty === 'expert'
const excelsior = state => flagValue(state, 'excelsior') || {}
const setExcelsior = (state, patch) => setFlag(state, 'excelsior', { ...excelsior(state), ...patch })
const groupCluesAt = state => activeInvestigators(state).reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
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
    name: definition.name || code, fight: definition.fight ?? 1, evade: definition.evade ?? 1,
    health: definition.health ?? 1, damage: definition.damage || 0, horror: definition.horror || 0,
    damageTaken: 0, doom: 0, location: locationId, engagedSeat: options.engagedSeat ?? null, exhausted: false,
    ...(definition.traits ? { traits: [...definition.traits] } : {}),
  }
  state.enemies ||= []
  state.enemies.push(enemy)
  return enemy
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
export function prepareScenario(state, api = {}) {
  if (flagValue(state, 'excelsiorSetup')) return flagValue(state, 'excelsiorSetup')
  const culpritCode = shuffleWith(api, CULPRIT_CODES)[0]
  const setup = {
    culpritCode, culpritTarget: CULPRIT_TARGETS[culpritCode] || null,
    leads: [], leadClues: {}, replays: 0,
    cleaned: { blood: false, body: false, room: false },
  }
  setFlag(state, 'excelsior', setup)
  setFlag(state, 'excelsiorSetup', { culpritCode })
  const actSource = state.scenario?.stageCards || ACT_STAGES
  state.acts = [ACT1_CODE, ACT2_CODE].map(code => clone(actSource[code] || ACT_STAGES[code]))
  state.agendas = [AGENDA1_CODE, AGENDA2_CODE, culpritCode].map(code =>
    clone((state.scenario?.stageCards || CULPRIT_STAGES)[code] || CULPRIT_STAGES[code]))
  state.actIndex = 0
  state.agendaIndex = 0
  info(api, `精益酒店谋杀案：随机真凶为「${locLabel(state, culpritCode)}」；`
    + `目标敌人 ${ALL_CARDS[setup.culpritTarget]?.nameZh || setup.culpritTarget || '未定'}。`)
  return flagValue(state, 'excelsiorSetup')
}

const locLabel = (state, id) => LOCATIONS[id]?.name || ALL_CARDS[id]?.nameZh || ALL_CARDS[id]?.name || id

export function preScenarioSetup(state, events, helperOrApi = {}) {
  void events
  const api = helperOrApi?.api || helperOrApi || {}
  return prepareScenario(state, api)
}

export function startLocation() {
  return START_LOCATION
}

export function setupLocations(state, events, helper = {}) {
  void events
  const api = helper?.api || {}
  prepareScenario(state, api)
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = [...SET_ASIDE_ALIASES]
  state.scenarioZones.setAsideLocations = [...SET_ASIDE_LOCATION_IDS]
  state.encounterDeck ||= [...ENCOUNTER_DECK]
  info(api, `精益酒店：225 房间/门厅/套房阳台/二楼走廊/餐厅入场；${SET_ASIDE_LOCATION_IDS.length} 张地点放一边；`
    + `迹象牌库 ${LEADS.length} 张。`)
  return [...SETUP_LOCATION_IDS]
}

export function locationPlaced(state, location, api = {}, seat = null) {
  void api
  void seat
  if (!location) return
  location.revealed = true
  const card = ALL_CARDS[codeOf(location)] || {}
  const perPlayer = Number(location.cluesPerInvestigator)
  if (Number.isFinite(perPlayer)) location.clues = perPlayer * investigatorCount(state)
  else if (Number.isFinite(Number(card.clues))) location.clues = Number(card.clues) * investigatorCount(state)
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  prepareScenario(state, api)
  state.scenarioZones ||= {}
  state.scenarioZones.setAside ||= [...SET_ASIDE_ALIASES]
  state.scenarioZones.setAsideLocations ||= [...SET_ASIDE_LOCATION_IDS]
  if (!state.encounterDeck?.length) state.encounterDeck = [...ENCOUNTER_DECK]
  info(api, `精益酒店布置完成：${state.locations.length} 张地点入场；真凶议程已确定。`)
  return { culpritCode: excelsior(state).culpritCode }
}

/** 单测/直调入口。 */
export function setupScenario(state, api = {}) {
  state.locations = []
  state.scenarioFlags ||= {}
  delete state.scenarioFlags.excelsiorSetup
  delete state.scenarioFlags.excelsior
  const report = prepareScenario(state, api)
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = [...SET_ASIDE_ALIASES]
  state.scenarioZones.setAsideLocations = [...SET_ASIDE_LOCATION_IDS]
  for (const id of SETUP_LOCATION_IDS) {
    const instance = { ...clone(LOCATIONS[id]), clues: 0, revealed: true, connections: [...LOCATIONS[id].connections] }
    state.locations.push(instance)
    locationPlaced(state, instance, api)
  }
  state.investigators ||= []
  for (const [index, inv] of state.investigators.entries()) if (!inv.location) inv.location = index === 0 ? START_LOCATION : 'foyer'
  state.encounterDeck = [...ENCOUNTER_DECK]
  afterDeckSetup(state, null, { api })
  return { ...report, placedIds: state.locations.map(location => location.id) }
}

// ---------------------------------------------------------------------------
// 行动
// ---------------------------------------------------------------------------
function drawLead(state, inv, api) {
  const current = excelsior(state)
  const remaining = LEAD_CODES.filter(code => !current.leads.includes(code))
  if (!remaining.length) return null
  const code = remaining[Math.floor(randomOf(api) * remaining.length)]
  setExcelsior(state, { leads: [...current.leads, code] })
  info(api, `🔍 ${inv.name} 抽取迹象「${ALL_CARDS[code]?.nameZh || code}」（已抽 ${current.leads.length + 1} 张）。`)
  return code
}

export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const moves = []
  const current = excelsior(state)
  if (currentActCode(state) === ACT1_CODE) {
    const required = investigatorCount(state)
    const available = groupCluesAt(state)
    const remaining = LEAD_CODES.length - current.leads.length
    moves.push({
      action: 'scenarioAction', rule: 'excelsiorDrawLead', locationId: inv.location, actions: 1,
      label: `团队花费 ${required} 个线索：抽取迹象牌库顶 1 张`,
      reason: remaining <= 0 ? '迹象牌库已空' : (available >= required ? null : `团队需要 ${required} 个线索（现有 ${available}）`),
    })
  }
  if (currentActCode(state) === ACT2_CODE && current.leads.length) {
    const open = current.leads.filter(code => Number(current.leadClues[code] || 0) < investigatorCount(state))
    moves.push({
      action: 'scenarioAction', rule: 'excelsiorPlaceLeadClue', locationId: inv.location, actions: 1,
      label: '调查迹象：向一张迹象放置 1 个线索',
      reason: open.length ? null : '每张迹象上的线索都已达标',
    })
  }
  if (inv.location === START_LOCATION) {
    for (const [key, label] of [['blood', '清理血迹'], ['body', '藏匿尸体'], ['room', '整理房间']]) {
      if (current.cleaned[key]) continue
      moves.push({
        action: 'scenarioAction', rule: `excelsiorClean:${key}`, locationId: START_LOCATION, actions: 1,
        label: `${label}（避免在议程 1 背面被警方发现）`,
        reason: null,
      })
    }
  }
  return moves
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv || inv.defeated || inv.resigned) return false
  if (move.rule === 'excelsiorDrawLead') {
    const required = investigatorCount(state)
    if (groupCluesAt(state) < required) return false
    let remaining = required
    for (const investigator of activeInvestigators(state)) {
      if (remaining <= 0) break
      const spend = Math.min(Number(investigator.clues) || 0, remaining)
      investigator.clues -= spend
      remaining -= spend
    }
    drawLead(state, inv, api)
    return true
  }
  if (move.rule === 'excelsiorPlaceLeadClue') {
    const current = excelsior(state)
    const open = current.leads.filter(code => Number(current.leadClues[code] || 0) < investigatorCount(state))
    const code = open.length === 1 ? open[0] : safeCall(api, 'choose', {
      kind: 'target', seat: inv.seat, source: 'excelsiorPlaceLeadClue', prompt: '选择要调查的迹象。',
      options: open.map(item => ({ id: item, label: ALL_CARDS[item]?.nameZh || item })),
    })
    if (!code) return false
    setExcelsior(state, { leadClues: { ...current.leadClues, [code]: Number(current.leadClues[code] || 0) + 1 } })
    info(api, `🔍 「${ALL_CARDS[code]?.nameZh || code}」上现在有 ${Number(excelsior(state).leadClues[code])} 个线索。`)
    return true
  }
  if (move.rule?.startsWith('excelsiorClean:')) {
    const key = move.rule.split(':')[1]
    const current = excelsior(state)
    setExcelsior(state, { cleaned: { ...current.cleaned, [key]: true } })
    info(api, `🧹 你们完成了「${{ blood: '清理血迹', body: '藏匿尸体', room: '整理房间' }[key]}」。`)
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
export function actReveal(state, act, api = {}) {
  const code = codeOf(act)
  const current = excelsior(state)
  if (code === ACT1_CODE) {
    for (const id of SET_ASIDE_LOCATION_IDS) {
      if (!locationOf(state, id) && typeof api?.place === 'function') api.place(id)
      const location = locationOf(state, id)
      if (location) location.revealed = true
    }
    state.scenarioZones ||= {}
    state.scenarioZones.setAsideLocations = []
    // 按已抽迹象把对应副组 3 张洗入遭遇牌库（参考 Act1b 逐条）。
    const shuffledIn = []
    for (const lead of LEADS.filter(item => current.leads.includes(item.code))) {
      state.encounterDeck = [...(state.encounterDeck || []), ...lead.setAsideCodes]
      shuffledIn.push(lead.group)
    }
    state.encounterDeck = [...(state.encounterDeck || []), ...(state.encounterDiscard || [])]
    state.encounterDiscard = []
    if (typeof api?.shuffle === 'function') state.encounterDeck = api.shuffle(state.encounterDeck)
    info(api, `🩸 幕 1 背面：放一边的 5 张地点入场；按已抽迹象洗入副组 ${shuffledIn.join('、') || '（无）'}；`
      + '其余迹象牌移出游戏。')
    return true
  }
  if (code === ACT2_CODE) {
    // 「真相」幕间：直接翻到真凶议程并生成真凶目标敌人。
    if (state.agendas.length > 2) state.agendaIndex = 2
    const target = current.culpritTarget
    if (target && !(state.enemies || []).some(enemy => codeOf(enemy) === target)) {
      const spawnAt = locationOf(state, 'office') || locationOf(state, START_LOCATION)
      spawnEnemyAt(state, target, spawnAt?.id || START_LOCATION, api)
    }
    info(api, `🕵️ 幕 2 背面：真相揭晓——真凶是「${locLabel(state, current.culpritCode)}」，`
      + `目标为 ${ALL_CARDS[target]?.nameZh || target}。`)
    return true
  }
  return false
}

export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  const current = excelsior(state)
  if (code === AGENDA1_CODE) {
    // 门罗警司入场；警官生成；「你都做了什么？」弱点加入队长牌组；未清理项 → 225 房间线索 + 警官毁灭。
    const foyer = locationOf(state, 'foyer')
    if (foyer) safeCall(api, 'storyAsset', MONROE_CODE, foyer.id)
    spawnEnemyAt(state, OFFICER_CODE, locationOf(state, 'secondFloorHall')?.id || START_LOCATION, api)
    if (investigatorCount(state) >= 3) {
      spawnEnemyAt(state, OFFICER_CODE, foyer?.id || START_LOCATION, api)
    }
    // 其余警官洗入遭遇牌库（参考 Setup：生成 1–2 名后把剩下的警官洗入遭遇牌库）。
    const officersSpawned = investigatorCount(state) >= 3 ? 2 : 1
    for (let index = officersSpawned; index < 3; index++) state.encounterDeck.push(OFFICER_CODE)
    const lead = leadSeatOf(state)
    const record = state.campaign?.investigators?.[lead]
    if (record && !record.deck.includes(WHAT_HAVE_YOU_DONE_CODE)) {
      record.deck.push(WHAT_HAVE_YOU_DONE_CODE)
      info(api, `🃏 ${record.name} 的牌组加入「你都做了什么？」弱点。`)
    }
    let clues = 0
    let doom = 0
    for (const key of ['blood', 'body', 'room']) {
      if (current.cleaned[key]) continue
      clues += 1
      doom += 1
    }
    const room = locationOf(state, START_LOCATION)
    if (room && clues) room.clues = (Number(room.clues) || 0) + clues
    for (const enemy of (state.enemies || []).filter(item => codeOf(item) === OFFICER_CODE).slice(0, doom)) {
      enemy.doom = (Number(enemy.doom) || 0) + 1
    }
    info(api, `🚔 议程 1 背面：门罗警司入场、阿卡姆警官生成；未清理项 ${clues} 项 → 225 房间 +${clues} 线索、`
      + `警官 +${doom} 毁灭。`)
    return true
  }
  if (code === AGENDA2_CODE) {
    info(api, '🚔 议程 2 背面：调查员未能破案并洗清嫌疑！（→结局 3）')
    safeCall(api, 'finish', 'resolution3')
    return true
  }
  if (CULPRIT_CODES.includes(code)) {
    info(api, `😱 真凶议程「${locLabel(state, code)}」因毁灭阈值推进：真凶得逞。（→结局 2）`)
    safeCall(api, 'finish', 'resolution2')
    return true
  }
  return false
}

export function checkObjectives(state, api = {}) {
  const actCode = currentActCode(state)
  const current = excelsior(state)
  if (actCode === ACT1_CODE) {
    if (current.leads.length >= 2) {
      info(api, `🔍 调查员已抽取 ${current.leads.length} 张迹象。（推进幕 1）`)
      safeCall(api, 'advanceAct')
      return true
    }
    return false
  }
  if (actCode === ACT2_CODE) {
    const required = investigatorCount(state)
    const done = current.leads.length > 0
      && current.leads.every(code => Number(current.leadClues[code] || 0) >= required)
    if (done) {
      info(api, '🔍 每张迹象上的线索都已达标。（推进幕 2）')
      safeCall(api, 'advanceAct')
      return true
    }
    return false
  }
  return false
}

export function enemyDefeated(state, enemy, api = {}) {
  const current = excelsior(state)
  if (!current.culpritTarget || codeOf(enemy) !== current.culpritTarget) return false
  if (!state.campaign) return false
  state.campaign.records.theTrueCulpritWasIdentified =
    String(ALL_CARDS[current.culpritTarget]?.nameZh || ALL_CARDS[current.culpritTarget]?.name || current.culpritTarget)
  info(api, `🕵️ 真凶被击败：查明真凶「${state.campaign.records.theTrueCulpritWasIdentified}」。（→结局 1）`)
  safeCall(api, 'finish', 'resolution1')
  return true
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
export function resolveChaosToken(state, inv, token) {
  const face = String(token || '').toLowerCase().replace('_', '')
  const hard = isHardSide(state)
  if (face === 'skull') {
    const guests = (state.enemies || []).filter(enemy =>
      (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'guest')).length
    const innocents = (state.enemies || []).filter(enemy =>
      (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'innocent')).length
    void inv
    return { delta: hard ? -(guests || 2) : -(guests || 1) + (hard ? -innocents : 0) }
  }
  if (face === 'cultist') return { delta: hard ? -2 : -1 }
  if (face === 'tablet') return { delta: hard ? -5 : -3 }
  if (face === 'elderthing') {
    return { delta: -3,
      onFail: [{ type: 'scenarioToken', token: 'elderthing', mode: 'innocentHorror', hard }] }
  }
  return null
}

export function applyTokenEffect(state, inv, effect = {}, api = {}) {
  if (effect.mode !== 'innocentHorror') return false
  const innocents = (state.victoryDisplay || []).filter(card =>
    (card.traits || []).some(trait => String(trait).toLowerCase() === 'innocent')).length
  const amount = effect.hard ? Math.max(1, innocents) : 1
  safeCall(api, 'horror', inv?.seat, amount)
  info(api, `[elder_thing]：对无辜者相关失败效果，受到 ${amount} 点恐惧。`)
  return true
}

export function tokenMeanings() {
  return SCENARIO_TEXT.tokens
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
function addWeakness(state, code = WHAT_HAVE_YOU_DONE_CODE) {
  const lead = leadSeatOf(state)
  const record = state.campaign?.investigators?.[lead]
  if (!record || record.deck.includes(code)) return
  record.deck.push(code)
}

export function resolution(state, key, events = null, api = {}) {
  void events
  const infoApi = api?.info ? api : api?.api || {}
  const finalKey = String(key)
  const effects = []
  const current = excelsior(state)
  if (finalKey === 'noResolution') {
    const anyResigned = (state.investigators || []).some(inv => inv.resigned)
    if (anyResigned) {
      effects.push({ record: { theInvestigatorsFledTheSceneOfTheCrime: true } })
      effects.push({ record: { theMurdersContinueUnsolved: true } })
      info(infoApi, '无结局（有人撤退）：记录「调查员逃离了犯罪现场」+「谋杀仍未解决」。（→R3）')
    } else {
      effects.push({ record: { theExcelsiorClaimsAnotherVictim: true } })
      info(infoApi, '无结局（无人撤退）：记录「艾肖希尔酒店又添一名受害者」。（→R2）')
    }
  } else if (finalKey === 'resolution1') {
    effects.push({ record: { theExcelsiorIsQuietForNow: true } })
    if (current.culpritTarget) {
      effects.push({ record: { theTrueCulpritWasIdentified:
        String(ALL_CARDS[current.culpritTarget]?.nameZh || ALL_CARDS[current.culpritTarget]?.name || current.culpritTarget) } })
    }
    info(infoApi, '结局 1：记录「艾肖希尔酒店暂时恢复了平静」；获得经验；队长加入「你都做了什么？」弱点。')
  } else if (finalKey === 'resolution2') {
    effects.push({ record: { theMurdersContinueUnsolved: true } })
    info(infoApi, '结局 2：记录「谋杀仍未解决」；获得经验；队长加入「你都做了什么？」弱点。')
  } else if (finalKey === 'resolution3') {
    effects.push({ record: { theMurdersContinueUnsolved: true } })
    effects.push({ record: { theInvestigatorsFledTheSceneOfTheCrime: true } })
    info(infoApi, '结局 3：记录「谋杀仍未解决」+「调查员逃离了犯罪现场」；获得经验。')
  }
  effects.push({ storyCard: DAGGER_CODE })
  if (finalKey === 'resolution1' && state.campaign?.records?.thePoliceAreOnYourSide) {
    effects.push({ storyCard: MONROE_CODE })
  }
  return { bonus: 0, award: true, effects, afterExperience: () => addWeakness(state), flowData: { resolution: finalKey } }
}

// ---------------------------------------------------------------------------
// 只读投影 / 具名助手
// ---------------------------------------------------------------------------
export function scenarioSummary(state) {
  const current = excelsior(state)
  return {
    act: currentActCode(state),
    agenda: currentAgendaCode(state),
    culprit: current.culpritCode || null,
    culpritTarget: current.culpritTarget || null,
    leads: [...(current.leads || [])],
    leadClues: { ...(current.leadClues || {}) },
    replays: Number(current.replays || 0),
    cleaned: { ...(current.cleaned || {}) },
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
  excelsiorDrawLead(state, payload = {}, api = {}) {
    const inv = (state.investigators || [])[payload.seat || 0]
    return inv ? Boolean(drawLead(state, inv, api)) : false
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
  agendaReveal,
  checkObjectives,
  enemyDefeated,
  resolveChaosToken,
  applyTokenEffect,
  tokenMeanings,
  resolution,
  events,
  scenarioSummary,
  currentActCode,
  currentAgendaCode,
  excelsior,
  codeOf,
}
