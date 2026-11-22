// 重返聚集于此（returnToTheGathering · 50011）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/ReturnToNightOfTheZealot/ReturnToTheGathering.hs +
//       Scenario/Scenarios/NightOfTheZealot/TheGathering.hs 的 whenReturnTo 分支 +
//       Act/Cards/ReturnToNightOfTheZealot/ReturnToTheGathering/MysteriousGateway.hs。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   startLocation / setupLocations → 新版书房起点、会客厅/卧室/浴室入场、阁楼/地窖随机二选一
//   afterDeckSetup → 放一边区（食尸鬼祭司、丽塔、墙上的洞、客厅、远在房屋之上/之下、选中的阁楼/地窖）
//   actions / performAction → 书房（异常通道）「[action][action] 抽 3 张」仅队长可用
//   spawnLocation → 书房强制：敌人要生成在不在场的地点时，把该地点放置入场并在那里生成
//   afterInvestigate → 卧室（调查失败随机弃 1）、浴室（揭示符号后失去剩余行动并结束回合，近似）
//   resolveEncounterCard → 50024 狂信徒之印、50040 地底深寒
//   checkObjectives → 幕 1「只有会客厅的线索可推进」（3/人，随时可付，非轮末）
//   roundEnded / agendaForced → 阶段收尾
//   actReveal → 幕 1 背面（放墙上的洞、选会客厅调查员进入并揭示、意志(4)/失败弃牌）、
//              幕 2 背面（揭示客厅、放丽塔、生成食尸鬼祭司）、幕 3 背面（结局 1/2 选择）
//   agendaReveal → 密谋 1/2/3 背面
//   resolution → 基础章节的记录/创伤/XP，另加 50011 背面同款记录
//
// 本章状态只写 state.scenarioFlags / state.scenarioZones / state.campaign.records / state.locations 等
// 既有结构（章节 behavior 是允许的写点；单卡条目仍只走 ctx.api）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  ACT_CODES, ACT1_CODE, ACT2_CODE, ACT3_CODE, AGENDA_CODES, AGENDA1_CODE, AGENDA2_CODE, AGENDA3_CODE,
  ACTS, AGENDAS, STAGE_CARDS, LOCATIONS, LOCATION_IDS, SETUP_LOCATION_IDS, SET_ASIDE_CODES,
  START_LOCATION, GUEST_HALL, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, SET_ASIDE_LOCATION_IDS,
  RESOLUTION_KEYS, SCENARIO_TEXT, scenario, enemyDefinition,
} from './definition.js'

const CHAPTER_ID = 'returnToTheGathering'
const GHOUL_PRIEST_CODE = '01116'
const LITA_CODE = '01117'

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
const flagValue = (state, key) => flagsFor(state)[key]
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const enemiesInPlay = state => (state.enemies || []).filter(enemy => !enemy.defeated)
const currentAct = state => (state?.acts || [])[state?.actIndex ?? 0] || null
const currentActCode = state => codeOf(currentAct(state))
const currentAgendaCode = state => codeOf((state?.agendas || [])[state?.agendaIndex ?? 0])
const randomOf = (helper, state) => (typeof helper?.randomValue === 'function'
  ? () => helper.randomValue(state)
  : (typeof helper?.api?.random === 'function' ? helper.api.random : Math.random))
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const groupCluesAt = (state, locationId) => activeInvestigators(state)
  .filter(inv => inv.location === locationId)
  .reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
const failedBy = (result, difficulty) => Math.max(0, difficulty - Number(result?.value ?? 0))

function chooseSeat(api, state, options, prompt) {
  if (!options.length) return null
  if (typeof api?.choose !== 'function') return options[0].seat
  const picked = api.choose({
    kind: 'choice', source: CHAPTER_ID, seat: api.decideSeat?.() ?? state.campaign?.leadSeat ?? 0,
    prompt, options: options.map(inv => ({ id: String(inv.seat), label: inv.name })),
  })
  return Number(picked)
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
export function prepareScenario(state, api = {}) {
  if (flagValue(state, 'retGatheringPrepared')) return flagValue(state, 'retGatheringPrepared')
  const random = typeof api.random === 'function' ? api.random : Math.random
  const atticId = random() < 0.5 ? 'attic' : 'atticReturn'
  const cellarId = random() < 0.5 ? 'cellar' : 'cellarReturn'
  const variants = { atticId, cellarId }
  setFlag(state, 'retGatheringVariants', variants)
  const setAside = [
    ...SET_ASIDE_CODES,
    LOCATIONS.holeInTheWall.code,
    LOCATIONS.parlor.code,
    LOCATIONS[atticId].code,
    LOCATIONS[cellarId].code,
    LOCATIONS.farAboveYourHouse.code,
    LOCATIONS.deepBelowYourHouse.code,
  ]
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = setAside
  state.scenarioZones.setAsideLocations = []
  state.acts = ACT_CODES.map(code => clone((state.scenario?.stageCards || STAGE_CARDS)[code]))
  state.agendas = AGENDA_CODES.map(code => clone((state.scenario?.agendas || AGENDAS)
    .find(agenda => codeOf(agenda) === code) || AGENDAS[AGENDA_CODES.indexOf(code)]))
  state.actIndex = Number.isInteger(state.actIndex) ? state.actIndex : 0
  state.agendaIndex = Number.isInteger(state.agendaIndex) ? state.agendaIndex : 0
  setFlag(state, 'retGatheringPrepared', { ...variants, setAside })
  info(api, `重返聚集于此：阁楼采用${atticId === 'attic' ? '原版' : '新版'}，`
    + `地窖采用${cellarId === 'cellar' ? '原版' : '新版'}。`)
  return flagValue(state, 'retGatheringPrepared')
}

export function preScenarioSetup(state, events, helperOrApi = {}) {
  void events
  const api = helperOrApi?.api || helperOrApi || {}
  return prepareScenario(state, api)
}

export function startLocation() {
  return START_LOCATION
}

export function setupLocations(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  prepareScenario(state, { random: randomOf(helper, state), info: (...args) => info(api, ...args) })
  return [...SETUP_LOCATION_IDS]
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  const report = prepareScenario(state, { random: randomOf(helper, state), info: (...args) => info(api, ...args) })
  if (!state.encounterDeck?.length) state.encounterDeck = [...ENCOUNTER_DECK]
  info(api, `重返聚集于此布置完成：放一边 ${(state.scenarioZones?.setAside || []).length} 张。`)
  return report
}

/** 单测/直调入口：放置 4 处起始地点、阁楼/地窖随机二选一、放一边区与遭遇牌库。 */
export function setupScenario(state, api = {}) {
  state.locations = []
  state.scenarioFlags ||= {}
  delete state.scenarioFlags.retGatheringPrepared
  const report = prepareScenario(state, api)
  for (const id of SETUP_LOCATION_IDS) {
    const definition = (state.scenario?.locations || LOCATIONS)[id]
    const instance = { ...structuredClone(definition), clues: 0, revealed: false, connections: [...definition.connections] }
    const count = investigatorCount(state)
    instance.clues = Number(definition.cluesPerInvestigator) || 0
    instance.maxClues = instance.clues * count
    if (definition.victory != null) instance.victory = definition.victory
    if (state.investigators.some(inv => inv.location === id)) instance.revealed = true
    state.locations.push(instance)
    safeCall(api, 'place', id)
  }
  state.investigators ||= []
  for (const inv of state.investigators) if (!inv.location) inv.location = START_LOCATION
  if (!state.encounterDeck?.length) state.encounterDeck = [...ENCOUNTER_DECK]
  for (const inv of state.investigators) {
    const here = locationOf(state, inv.location)
    if (here && !here.revealed) here.revealed = true
  }
  afterDeckSetup(state, null, { api })
  info(api, `重返聚集于此：${state.locations.length} 处地点入场（阁楼 ${report.atticId} / 地窖 ${report.cellarId}）。`)
  return { ...report, placedIds: state.locations.map(location => location.id) }
}

// ---------------------------------------------------------------------------
// 行动：书房（异常通道）[action][action] 抽 3 张（仅队长）
// ---------------------------------------------------------------------------
export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const here = locationOf(state, inv.location)
  const moves = []
  if (here && String(here.originalCode || here.code) === LOCATIONS.study.code) {
    const isLead = inv.seat === (state.campaign?.leadSeat ?? 0)
    moves.push({
      action: 'scenarioAction', rule: 'retGatheringStudyDraw', locationId: here.id, actions: 2,
      label: '📖 书房（异常通道）：抽取 3 张卡牌（仅队长可用）',
      reason: !isLead ? '只有调查员队长可以执行此能力' : null,
    })
  }
  return moves
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv) return false
  if (move.rule !== 'retGatheringStudyDraw') return false
  const required = 2
  if (typeof api?.spendAction === 'function') { /* 行动点由引擎在提交时扣除 */ }
  void required
  safeCall(api, 'drawCards', inv.seat, 3)
  info(api, `${inv.name} 在书房（异常通道）抽取 3 张卡牌。`)
  return true
}

// ---------------------------------------------------------------------------
// 书房强制：敌人要生成在不在场的地点 → 放该地点并生成在那里
// ---------------------------------------------------------------------------
export function spawnLocation(state, code, fallback, engagedSeat, api = {}) {
  void code
  void engagedSeat
  if (!flagValue(state, 'retGatheringPrepared')) return fallback
  if (!fallback || locationOf(state, fallback)) return fallback
  const known = LOCATION_IDS.includes(fallback) || SET_ASIDE_LOCATION_IDS.includes(fallback)
  if (!known) return fallback
  if (typeof api?.place === 'function') api.place(fallback)
  info(api, `书房（异常通道）：将不在场的地点「${fallback}」放置入场，敌人改为在那里生成。`)
  return fallback
}

// ---------------------------------------------------------------------------
// 地点调查余波：卧室 / 浴室
// ---------------------------------------------------------------------------
export function afterInvestigate(state, inv, location, result, api = {}) {
  if (!inv || !location) return false
  const code = codeOf(location)
  if (code === LOCATIONS.bedroom.code && result && result.success === false) {
    safeCall(api, 'discardRandom', inv.seat, 1)
    info(api, `卧室：${inv.name} 调查检定失败，随机弃掉 1 张手牌。`)
    return true
  }
  return false
}

/** 浴室：调查时揭示 [skull]/[cultist]/[tablet]/[auto_fail] 后失去剩余行动并结束回合。
 *  近似：在「本回合调查后」检查最后一次混乱标记（引擎无逐标记地点回调）。 */
export function afterTest(state, inv, result = null, api = {}) {
  if (!inv || !result) return false
  const loc = locationOf(state, inv.location)
  if (!loc || codeOf(loc) !== LOCATIONS.bathroom.code) return false
  if (result.action !== 'investigate' && result.skill !== 'intellect') return false
  const face = String(result.token?.face || result.tokenFace || result.face || '')
  if (!['skull', 'cultist', 'tablet', 'autofail'].includes(face)) return false
  info(api, `浴室：${inv.name} 调查时揭示了 ${face}，失去所有剩余行动并结束回合。`)
  safeCall(api, 'loseActions', inv.seat)
  safeCall(api, 'endTurn', inv.seat)
  return true
}

// ---------------------------------------------------------------------------
// 敌人特殊规则：50038 食墓鬼（攻击后随机弃手牌）、50039 乌默尔多斯的祭司（无手牌时不能被躲避）
// （遭遇组 ghoulsOfUmordhoth 随本章进入牌库；揭示结算见单卡条目 50040）
// ---------------------------------------------------------------------------
export function enemyAttackResolved(state, enemy, inv, api = {}) {
  if (!enemy || !inv) return false
  if (codeOf(enemy) !== '50038') return false
  if (!(inv.hand || []).length) return false
  safeCall(api, 'discardRandom', inv.seat, 1)
  info(api, `食墓鬼：${inv.name} 被攻击后随机弃掉 1 张手牌。`)
  return true
}

export function canEvadeEnemy(state, inv, enemy) {
  void state
  if (!enemy || !inv) return true
  if (codeOf(enemy) !== '50039') return true
  if ((inv.hand || []).length > 0) return true
  return false
}

// ---------------------------------------------------------------------------
// 幕背面
// ---------------------------------------------------------------------------
export function actReveal(state, act, api = {}, revealType = null) {
  const type = revealType || act?.reveal?.type
  if (type === 'mysteriousGateway') return act1Back(state, api)
  if (type === 'revealParlor') return act2Back(state, api)
  if (type === 'resolutionChoice') return act3Back(state, api)
  return false
}

function act1Back(state, api) {
  if (typeof api.place === 'function') api.place('holeInTheWall')
  const candidates = activeInvestigators(state).filter(inv => inv.location === GUEST_HALL)
  const pick = chooseSeat(api, state, candidates, '选择一位位于会客厅的调查员进入「墙上的洞」并揭示它。')
  const chosen = pick == null ? null : state.investigators[pick]
  if (chosen) {
    safeCall(api, 'moveInvestigator', chosen.seat, 'holeInTheWall')
    safeCall(api, 'reveal', 'holeInTheWall')
    safeCall(api, 'test', chosen.seat, 'willpower', 4, result => {
      if (result?.success) return
      const amount = failedBy(result, 4)
      safeCall(api, 'discardRandom', chosen.seat, amount)
      info(api, `神秘通道：${chosen.name} 意志检定失败 ${amount} 点，随机弃掉 ${amount} 张手牌。`)
    })
  } else {
    safeCall(api, 'reveal', 'holeInTheWall')
  }
  setFlag(state, 'retGatheringAct1Back', true)
  info(api, '幕 1 背面：墙上的洞入场；调查员进入并揭示，随后结算意志(4)检定。')
  return true
}

function act2Back(state, api) {
  safeCall(api, 'place', 'parlor')
  safeCall(api, 'reveal', 'parlor')
  safeCall(api, 'storyAsset', LITA_CODE, 'parlor')
  if (typeof api.spawn === 'function') {
    const boss = api.spawn(GHOUL_PRIEST_CODE, 'holeInTheWall')
    if (boss) info(api, `👹 首领「${boss.name}」出现在「走廊」。`)
  }
  setFlag(state, 'retGatheringAct2Back', true)
  info(api, '幕 2 背面：屏障消失，客厅揭示，丽塔入场，食尸鬼祭司在走廊生成。')
  return true
}

function act3Back(state, api) {
  const resolution = typeof api.choose === 'function' ? api.choose({
    kind: 'story', source: 'resolutionChoice', seat: api.decideSeat?.() ?? 0,
    prompt: '决定房屋的命运。',
    options: [{ id: 'r1', label: '烧毁房屋' }, { id: 'r2', label: '保留房屋' }],
  }) : 'r1'
  safeCall(api, 'finish', resolution === 'r2' ? 'r2' : 'r1')
  setFlag(state, 'retGatheringResolution', resolution)
  return true
}

// ---------------------------------------------------------------------------
// 密谋揭示 / 强制
// ---------------------------------------------------------------------------
export function agendaReveal(state, agenda, api = {}, revealType = null) {
  const type = revealType || agenda?.reveal?.type
  if (type === 'lapseInTime') return agenda1Back(state, api)
  if (type === 'tunnelsBelow') return agenda2Back(state, api)
  if (type === 'ghoulsBreakFree') return agenda3Back(state, api)
  return false
}

function agenda1Back(state, api) {
  const lead = state.investigators?.[state.campaign?.leadSeat ?? 0] || activeInvestigators(state)[0]
  if (!lead) return true
  const options = [{ id: 'discard', label: '每位调查员随机弃掉 1 张手牌' },
    { id: 'horror', label: '队长受到 2 点恐惧' }]
  const answer = typeof api.choose === 'function'
    ? api.choose({ kind: 'agenda', source: AGENDA1_CODE, seat: api.decideSeat?.() ?? lead.seat,
      prompt: '到底发生了什么？！队长必须选择一项。', options })
    : 'discard'
  if (answer === 'discard') {
    for (const inv of activeInvestigators(state)) {
      if (!(inv.hand || []).length) continue
      safeCall(api, 'discardRandom', inv.seat, 1)
    }
    info(api, '密谋 1 背面：每位调查员随机弃掉 1 张手牌。')
  } else {
    safeCall(api, 'horror', lead.seat, 2)
    info(api, `密谋 1 背面：${lead.name} 受到 2 点恐惧。`)
  }
  return true
}

function agenda2Back(state, api) {
  if (typeof api.shuffleDiscard === 'function') api.shuffleDiscard()
  else if ((state.encounterDiscard || []).length) {
    state.encounterDeck = [...(state.encounterDeck || []), ...state.encounterDiscard]
    state.encounterDiscard = []
  }
  const lead = state.investigators?.[state.campaign?.leadSeat ?? 0] || activeInvestigators(state)[0]
  const code = typeof api.discardUntilEnemyTrait === 'function' ? api.discardUntilEnemyTrait('ghoul') : null
  if (code && lead) {
    const enemy = safeCall(api, 'spawnEngaged', code, lead.location, lead.seat)
    if (enemy) info(api, `密谋 2 背面：「${enemy.name}」被引出，与 ${lead.name} 交战。`)
  } else {
    info(api, '密谋 2 背面：遭遇牌库中没有食尸鬼敌人。')
  }
  return true
}

function agenda3Back(state, api) {
  if (Number(state.actIndex) <= 1) {
    info(api, '☠️ 食尸鬼们破墙而出！调查队被团团包围，无处可逃……')
    safeCall(api, 'defeatAll')
    safeCall(api, 'finish', 'r3')
    return true
  }
  for (const inv of activeInvestigators(state)) {
    safeCall(api, 'defeat', inv)
  }
  info(api, '🏃 你们在食尸鬼涌出前逃出了房子，但未撤退的调查员被击败。')
  safeCall(api, 'finish', 'noResolution')
  return true
}

export function agendaForced(state, when, api = {}, forcedType = null) {
  if (forcedType === 'ghoulsMoveToParlor') {
    for (const enemy of enemiesInPlay(state)) {
      if (enemy.engagedSeat != null) continue
      if (!(enemy.traits || []).some(trait => String(trait).toLowerCase() === 'ghoul')) continue
      const dest = safeCall(api, 'stepToward', enemy.location, 'parlor')
      if (dest && dest !== enemy.location) safeCall(api, 'moveEnemy', enemy, dest)
    }
    return true
  }
  if (forcedType === 'doomPerGhoulAtParlorHallway') {
    const count = enemiesInPlay(state).filter(enemy => ['parlor', 'holeInTheWall'].includes(enemy.location)
      && (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'ghoul')).length
    if (count > 0) safeCall(api, 'addDoom', count)
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 目标
// ---------------------------------------------------------------------------
export function checkObjectives(state, api = {}) {
  if (state.status && state.status !== 'playing') return false
  const code = currentActCode(state)
  if (code === ACT1_CODE) {
    const required = 3 * investigatorCount(state)
    const available = groupCluesAt(state, GUEST_HALL)
    if (available >= required) {
      const paid = safeCall(api, 'payGroupClues', required, { atLocation: GUEST_HALL })
      if (paid === false) return false
      info(api, `幕 1 目标达成：会客厅共同支付 ${required} 个线索。`)
      safeCall(api, 'advanceAct')
      return true
    }
  }
  return false
}

export function roundEnded(state, api = {}) {
  void state
  void api
  return false
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
export function resolution(state, key, events = null, api = {}) {
  void events
  const finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : 'noResolution'
  const records = recordsFor(state)
  if (finalKey === 'r3') {
    records.litaForcedOthers = true
    for (const inv of state.investigators || []) {
      if (!inv.resigned && !inv.defeated) {
        inv.defeated = true
        inv.defeatCause = 'damage'
      }
    }
  }
  if (finalKey === 'r1') records.houseBurned = true
  else records.houseBurned = false
  if (finalKey === 'r1' || finalKey === 'r2') records.ghoulPriestAlive = false
  else records.ghoulPriestAlive = true
  const infoApi = api?.info ? api : api?.api || {}
  if (finalKey !== 'r2') safeCall(api, 'addLitaToCampaign', state)
  info(infoApi, finalKey === 'noResolution'
    ? '结局：记录房屋还在、食尸鬼祭司还活着；进入幕间。'
    : finalKey === 'r1'
      ? '结局 1：记录房屋已烧毁；队长受到 1 点精神创伤。'
      : finalKey === 'r2'
        ? '结局 2：记录房屋还在；队长获得额外 1 点经验。'
        : '结局 3：记录丽塔不得不去找别的帮手，未撤退的调查员全部阵亡。')
  void SCENARIO_TEXT
  return {
    bonus: 2,
    award: finalKey !== 'r3',
    seatBonus: seat => finalKey === 'r2' && seat === (state.campaign?.leadSeat ?? 0) ? 1 : 0,
    effects: [
      { record: { houseBurned: true }, when: { resolution: 'r1' } },
      { record: { houseBurned: false }, when: { not: { resolution: 'r1' } } },
      { record: { ghoulPriestAlive: false }, when: { resolutionIn: ['r1', 'r2'] } },
      { record: { ghoulPriestAlive: true }, when: { not: { resolutionIn: ['r1', 'r2'] } } },
      { when: { resolution: 'r1' }, trauma: { lead: { mental: 1 } } },
    ],
  }
}

// ---------------------------------------------------------------------------
// 只读投影
// ---------------------------------------------------------------------------
export function scenarioSummary(state) {
  return {
    act: currentActCode(state),
    agenda: currentAgendaCode(state),
    variants: flagValue(state, 'retGatheringVariants') || null,
    setAside: [...(state.scenarioZones?.setAside || [])],
    encounterCards: (state.encounterDeck || []).length,
  }
}

export function describe(state) {
  const variants = flagValue(state, 'retGatheringVariants')
  return [
    `阁楼/地窖：${variants?.atticId || '?'} / ${variants?.cellarId || '?'}。`,
    `会客厅线索：${groupCluesAt(state, GUEST_HALL)}（幕 1 需 ${3 * investigatorCount(state)}）。`,
  ]
}

export function implementedEntryFlags(code) {
  void code
  return {}
}

export const events = {
  retGatheringStudyDraw(state, payload = {}, api = {}) {
    const inv = (state.investigators || [])[payload.seat]
    return inv ? performAction(state, inv, { rule: 'retGatheringStudyDraw' }, api) : false
  },
}

export const behavior = {
  id: CHAPTER_ID,
  startLocation,
  locationsStartRevealed: false,
  roundEndActIndex: 1,
  preScenarioSetup,
  prepareScenario,
  setupScenario,
  setupLocations,
  afterDeckSetup,
  actions,
  performAction,
  spawnLocation,
  afterInvestigate,
  afterTest,
  enemyAttackResolved,
  canEvadeEnemy,
  actReveal,
  agendaReveal,
  agendaForced,
  checkObjectives,
  roundEnded,
  resolution,
  events,
  scenarioSummary,
  describe,
  // 具名助手（测试/验收）
  currentActCode,
  currentAgendaCode,
  groupCluesAt,
  codeOf,
}

export {
  ACT_CODES, ACT1_CODE, ACT2_CODE, ACT3_CODE, AGENDA_CODES, AGENDA1_CODE, AGENDA2_CODE, AGENDA3_CODE,
  START_LOCATION, GUEST_HALL, SET_ASIDE_CODES, SET_ASIDE_LOCATION_IDS, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES,
  LOCATION_IDS, GHOUL_PRIEST_CODE, LITA_CODE, currentActCode, currentAgendaCode,
}
