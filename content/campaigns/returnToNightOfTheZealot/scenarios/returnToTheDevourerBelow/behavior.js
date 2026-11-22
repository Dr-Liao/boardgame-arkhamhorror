// 重返地底噬魔（returnToTheDevourerBelow · 50032a）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/ReturnToNightOfTheZealot/ReturnToTheDevourerBelow.hs +
//       Scenario/Scenarios/NightOfTheZealot/TheDevourerBelow.hs（setup 的 whenReturnTo / isReturnTo /
//       orWhenReturnTo / guard isReturnTo 分支）+
//       Treachery/Cards/ReturnToNightOfTheZealot/ReturnToTheDevourerBelow/VaultOfEarthlyDemise.hs +
//       Enemy|Treachery/Cards/NightOfTheZealot/{GhoulsOfUmordhoth,TheDevourersCult}/**。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   preScenarioSetup / setupLocations → 使者组 4 选 1、阿卡姆密林 10 选 4、主道路固定入场
//   modifyDeck → 使者组洗入遭遇牌库；ghoulPriestAlive 时洗入 01116
//   afterDeckSetup → 放一边区（仪式地/乌默尔多斯/50032b）、逃跑的异教徒毁灭、50032b 附属记录
//   afterMulligan → pastMidnight：每位调查员随机弃 2 张起始手牌
//   spawnLocation → 50041/50042「生成 - 最远的无人地点」
//   enemySpawned → 50032b：乌默尔多斯入场时按剩余幕数放资源；50041：生成后放 1 毁灭或 1 线索（密谋≠1 时两者）
//   enemyStatModifier → 50032b：乌默尔多斯 +X 攻击、+X 倍调查员人数的生命；50043 面具 +2 生命；
//                       01175 低剩余神智交战 +1 攻击/+1 躲避；01144：每个敌人 +1 攻击/+1 躲避
//   enemyDamageAmount → 50035：本地点的敌人每次受到伤害不超过 1 点（近似：该地点所有敌人伤害封顶 1）
//   enemyAttackResolved → 50038：攻击你后随机弃 1 张手牌
//   canEvadeEnemy → 50039：与没有手牌的调查员交战时不能被躲避
//   chaosTokenRevealed → 50034（调查时）/50036（躲避时）：额外揭示并结算 1 个混乱标记（每次检定一次）
//   afterTest + encounterGainsSurge → 50033：在本地点击败诡计的技能检定成功后该诡计获得涌动（团队每轮一次）
//   resolveEncounter → 50043：附属到最远的[[异教徒]]敌人（+2 生命、放 1 毁灭、独特反击/非独特冷漠）
//   mythosEnded / enemyPhaseEnd → 50042：神话阶段末放 1 毁灭；敌军阶段末向主道路移动或把毁灭交给密谋
//   actions / scenarioActionError / sacrificeLitaAction → 献祭丽塔（→ 结局 3）
//   actReveal / agendaReveal / agendaForcedEnemyDefeated / turnEnded → 基础章节同款幕/密谋背面
//   resolution → 记录/创伤/XP（r1 +5 / r2 +10）
//
// 本章状态只写 state.scenarioFlags / state.scenarioZones / state.campaign.records / state.locations
// 等既有结构（章节 behavior 是允许的写点；单卡条目仍只走 ctx.api）。
import {
  ACT_CODES, ACT1_CODE, ACT2_CODE, ACT3_CODE, AGENDA_CODES, AGENDA1_CODE, AGENDA2_CODE, AGENDA3_CODE,
  AGENDAS, STAGE_CARDS, LOCATIONS, LOCATION_IDS, SETUP_LOCATION_IDS, SET_ASIDE_LOCATION_IDS,
  START_LOCATION, RITUAL_SITE, WOODS_POOL, WOODS_COUNT, AGENT_SETS, AGENT_SET_IDS, ENCOUNTER_DECK,
  ENCOUNTER_DECK_CODES, SET_ASIDE_ALIASES, RESOLUTION_KEYS, SCENARIO_TEXT, UMORDHOTH_CODE,
  GHOUL_PRIEST_CODE, LITA_CODE, VAULT_CODE, scenario,
} from './definition.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { LITA_CHANDLER_CODE } from '../../../../../src/cards/card-rules.js'

const CHAPTER_ID = 'returnToTheDevourerBelow'
const DISCIPLE_CODE = '50041'
const CORPSE_TAKER_CODE = '50042'
const GRAVE_EATER_CODE = '50038'
const ACOLYTE_OF_UMORDHOTH_CODE = '50039'
const GREAT_WILLOW_CODE = '50033'
const LAKESIDE_CODE = '50034'
const CORPSE_RIDDEN_CLEARING_CODE = '50035'
const WOODEN_BRIDGE_CODE = '50036'
const BYAKHEE_CODE = '01175'
const MASK_CODE = '50043'

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
const randomOf = helper => (typeof helper?.randomValue === 'function' ? helper.randomValue : Math.random)
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const hasTrait = (entity, trait) => (entity?.traits || [])
  .some(item => String(item).toLowerCase() === String(trait).toLowerCase())

function shuffled(list, random) {
  const out = [...list]
  for (let index = out.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(random() * (index + 1))
    ;[out[index], out[pick]] = [out[pick], out[index]]
  }
  return out
}

// ---------------------------------------------------------------------------
// 布置：使者组 4 选 1 + 密林 10 选 4
// ---------------------------------------------------------------------------
export function prepareScenario(state, api = {}) {
  if (flagValue(state, 'retDevourerPrepared')) return flagValue(state, 'retDevourerPrepared')
  const random = typeof api.random === 'function' ? api.random : Math.random
  const agentSetId = AGENT_SET_IDS[Math.floor(random() * AGENT_SET_IDS.length)]
  const woods = shuffled(WOODS_POOL, random).slice(0, WOODS_COUNT)
  const report = { agentSetId, agentSetCards: [...AGENT_SETS[agentSetId]], woods }
  state.acts = ACT_CODES.map(code => clone((state.scenario?.stageCards || STAGE_CARDS)[code]))
  state.agendas = AGENDA_CODES.map(code => clone((state.scenario?.agendas || AGENDAS)
    .find(agenda => codeOf(agenda) === code) || AGENDAS[AGENDA_CODES.indexOf(code)]))
  state.actIndex = Number.isInteger(state.actIndex) ? state.actIndex : 0
  state.agendaIndex = Number.isInteger(state.agendaIndex) ? state.agendaIndex : 0
  setFlag(state, 'retDevourerPrepared', report)
  info(api, `重返地底噬魔：使者组「${agentSetId}」；阿卡姆密林抽到 ${woods.map(id => LOCATIONS[id].name).join('、')}。`)
  return report
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
  const report = prepareScenario(state, { random: randomOf(helper), info: (...args) => info(api, ...args) })
  return [...SETUP_LOCATION_IDS, ...report.woods]
}

export function modifyDeck(state, deck, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  const report = prepareScenario(state, { random: randomOf(helper), info: (...args) => info(api, ...args) })
  const next = [...deck, ...report.agentSetCards]
  info(api, `重返地底噬魔：使者组「${report.agentSetId}」的 ${report.agentSetCards.length} 张卡加入遭遇牌库。`)
  if (state.campaign?.records?.ghoulPriestAlive) {
    next.push(GHOUL_PRIEST_CODE)
    info(api, '👹 食尸鬼祭司仍存活：01116 被洗入遭遇牌库。')
  }
  return next
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  prepareScenario(state, { random: randomOf(helper), info: (...args) => info(api, ...args) })
  if (!state.encounterDeck?.length) state.encounterDeck = [...ENCOUNTER_DECK]
  // 放一边（场外）区：仪式地 + 乌默尔多斯 + 凡尘终陨之墟（卡号，与本章 manifest.setAside 同源）。
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = [LOCATIONS[RITUAL_SITE].code, UMORDHOTH_CODE, VAULT_CODE]
  // 50032b 在 Setup 时翻面附属到乌默尔多斯：记录 resources（乌默尔多斯入场时按剩余幕数放置）。
  setFlag(state, 'retDevourerVault', { code: VAULT_CODE, attachedTo: UMORDHOTH_CODE, resources: 0, inPlay: false })
  // 逃跑的异教徒：密谋上放 floor((人数 + 1) / 2) 点毁灭（Haskell placeDoomOnAgenda）。
  const escaped = (state.campaign?.records?.cultistsEscaped || []).length
  const extraDoom = Math.floor((escaped + 1) / 2)
  if (extraDoom > 0) {
    if (typeof api?.addDoom === 'function') api.addDoom(extraDoom)
    else state.doom = (Number(state.doom) || 0) + extraDoom
    info(api, `🌑 逃跑的异教徒 ${escaped} 名：密谋上额外放置 ${extraDoom} 点毁灭（当前 ${state.doom}）。`)
  }
  info(api, `重返地底噬魔布置完成：放一边 ${state.scenarioZones.setAside.length} 张（仪式地/乌默尔多斯/凡尘终陨之墟）。`)
  return flagValue(state, 'retDevourerPrepared')
}

export function afterMulligan(state, events, helper = {}) {
  if (!state.campaign?.records?.pastMidnight) return false
  for (const inv of state.investigators || []) {
    if (!inv || inv.defeated || inv.resigned) continue
    if (!(inv.hand || []).length) continue
    if (typeof helper?.discardRandomFromHand === 'function') helper.discardRandomFromHand(state, inv, 2)
    if (typeof helper?.info === 'function') {
      helper.info(state, events, `🌙 午夜已至：${inv.name} 随机弃掉 2 张起始手牌。`)
    }
  }
  return true
}

/** 单测/直调入口：主道路 + 随机 4 密林、放一边区、遭遇牌库（不经过引擎的 placeLocation）。 */
export function setupScenario(state, api = {}) {
  state.locations = []
  state.scenarioFlags ||= {}
  delete state.scenarioFlags.retDevourerPrepared
  const report = prepareScenario(state, api)
  for (const id of [...SETUP_LOCATION_IDS, ...report.woods]) {
    const definition = (state.scenario?.locations || LOCATIONS)[id]
    const instance = {
      ...structuredClone(definition), id, connections: [...definition.connections],
      clues: (Number(definition.cluesPerInvestigator) || 0) * investigatorCount(state),
      maxClues: (Number(definition.cluesPerInvestigator) || 0) * investigatorCount(state),
      revealed: false,
    }
    if (state.investigators.some(inv => inv.location === id)) instance.revealed = true
    state.locations.push(instance)
    safeCall(api, 'place', id)
  }
  state.investigators ||= []
  for (const inv of state.investigators) if (!inv.location) inv.location = START_LOCATION
  for (const inv of state.investigators) {
    const here = locationOf(state, inv.location)
    if (here) here.revealed = true
  }
  if (!state.encounterDeck?.length) {
    state.encounterDeck = [...ENCOUNTER_DECK, ...report.agentSetCards]
    if (state.campaign?.records?.ghoulPriestAlive) state.encounterDeck.push(GHOUL_PRIEST_CODE)
  }
  afterDeckSetup(state, null, { api, randomValue: typeof api.random === 'function' ? api.random : Math.random })
  info(api, `重返地底噬魔：${state.locations.length} 处地点入场（主道路 + ${report.woods.length} 张密林）。`)
  return { ...report, placedIds: state.locations.map(location => location.id) }
}

// ---------------------------------------------------------------------------
// 生成位置：50041 / 50042「生成 - 最远的无人地点」
// ---------------------------------------------------------------------------
export function spawnLocation(state, code, fallback, engagedSeat, api = {}) {
  if (![DISCIPLE_CODE, CORPSE_TAKER_CODE].includes(String(code))) return fallback
  const from = (Number.isInteger(engagedSeat) && state.investigators?.[engagedSeat]?.location)
    || activeInvestigators(state)[0]?.location || fallback
  const empty = (state.locations || []).filter(location => !activeInvestigators(state)
    .some(inv => inv.location === location.id)
    && !enemiesInPlay(state).some(enemy => enemy.location === location.id))
  if (!empty.length) return fallback
  const distance = id => {
    if (typeof api?.locationDistance !== 'function') return 0
    const value = api.locationDistance(from, [id])
    return value == null || value < 0 ? Infinity : value
  }
  const scored = empty.map(location => ({ id: location.id, distance: distance(location.id) }))
  const finite = scored.filter(row => Number.isFinite(row.distance))
  const pool = finite.length ? finite : scored
  const farthest = Math.max(...pool.map(row => row.distance))
  const candidates = pool.filter(row => row.distance === farthest)
  const picked = candidates[0]?.id || fallback
  if (picked && picked !== fallback) {
    info(api, `👹 「${picked}」是距调查员最远的无人地点：${code} 在那里生成。`)
  }
  return picked
}

// ---------------------------------------------------------------------------
// 敌人钩子：50032b 资源 / 50041 生成余波 / 50043 面具 / 01144 密谋被动
// ---------------------------------------------------------------------------
export function enemySpawned(state, enemy, api = {}) {
  if (!enemy) return false
  const code = codeOf(enemy)
  if (code === UMORDHOTH_CODE) {
    const actsRemaining = Math.max(1, (state.acts?.length ?? 0) - (state.actIndex ?? 0))
    const vault = flagValue(state, 'retDevourerVault') || { code: VAULT_CODE, attachedTo: UMORDHOTH_CODE }
    setFlag(state, 'retDevourerVault', { ...vault, resources: actsRemaining, inPlay: true })
    safeCall(api, 'takeFromSetAside', UMORDHOTH_CODE)
    safeCall(api, 'takeFromSetAside', VAULT_CODE)
    info(api, `🌀 凡尘终陨之墟附属到「${enemy.name}」：${actsRemaining} 个资源`
      + `（+${actsRemaining} 攻击、+${actsRemaining} 倍调查员人数的生命）。`)
    return true
  }
  if (code === DISCIPLE_CODE) {
    const seat = Number.isInteger(enemy.drawnBySeat) ? enemy.drawnBySeat : (state.campaign?.leadSeat ?? 0)
    const inv = state.investigators?.[seat]
    const hasClue = (Number(inv?.clues) || 0) > 0
    const mustDoBoth = (state.agendaIndex ?? 0) > 0
    const options = [
      { id: 'doom', label: '在噬魔信徒上放置 1 个毁灭标记' },
      { id: 'clue', label: '将你的 1 个线索放到它所在地点' },
    ]
    const choice = mustDoBoth || !hasClue ? 'doom'
      : (typeof api?.choose === 'function'
        ? api.choose({ kind: 'choice', source: DISCIPLE_CODE, seat,
          prompt: '噬魔信徒生成：选择放置 1 个毁灭或 1 个线索。', options })
        : 'doom')
    const doDoom = mustDoBoth || choice !== 'clue'
    const doClue = mustDoBoth ? hasClue : choice === 'clue' && hasClue
    if (doDoom) safeCall(api, 'doomOn', enemy, 1)
    if (doClue) {
      safeCall(api, 'loseClues', seat, 1)
      safeCall(api, 'addCluesToLocation', enemy.location, 1)
    }
    info(api, `噬魔信徒生成：${doDoom ? '放置 1 个毁灭' : ''}${doDoom && doClue ? '，' : ''}`
      + `${doClue ? '把 1 个线索放到它所在地点' : ''}${!doDoom && !doClue ? '无可放置的线索' : ''}。`)
    return true
  }
  return false
}

export function enemyStatModifier(state, enemy, stat) {
  if (!enemy) return 0
  let total = 0
  if (codeOf(enemy) === UMORDHOTH_CODE) {
    const resources = Number(flagValue(state, 'retDevourerVault')?.resources) || 0
    if (resources > 0) {
      if (stat === 'fight') total += resources
      else if (stat === 'health') total += resources * investigatorCount(state)
    }
  }
  // 50043 乌默尔多斯的面具：附属的敌人 +2 生命（阅读 enemy.attachments 的实体附属）。
  if (stat === 'health' && (enemy.attachments || [])
    .some(attachment => String(attachment.code || attachment.originalCode) === MASK_CODE)) total += 2
  // 01175 尖叫的拜亚基：与剩余神智 ≤4 的调查员交战时 +1 攻击 +1 躲避。
  // （基础章节用别名条目 screechingByakhee 实现；本章牌库按卡号 01175 入牌，改用章节钩子接通同一规则。）
  if (codeOf(enemy) === BYAKHEE_CODE && (stat === 'fight' || stat === 'evade') && enemy.engagedSeat != null) {
    const engaged = state.investigators?.[enemy.engagedSeat]
    if (engaged && (Number(engaged.sanity) - (Number(engaged.horror) || 0)) <= 4) total += 1
  }
  // 01144 密谋 2（仪式开始）：每个敌人 +1 攻击 +1 躲避（基础章节把这条写成无人读的 passive 数据）。
  if ((stat === 'fight' || stat === 'evade') && currentAgendaCode(state) === AGENDA2_CODE) total += 1
  return total
}

// 50035 尸横遍野的空地：本地点的每个敌人每次受到的伤害不能超过 1 点。
// 近似：enemyDamageAmount 拿不到 presentation.attack，「每次攻击」按「每次伤害」封顶。
export function enemyDamageAmount(state, enemy, amount, api = {}) {
  if (!enemy || !(amount > 0)) return amount
  const location = locationOf(state, enemy.location)
  if (!location || codeOf(location) !== CORPSE_RIDDEN_CLEARING_CODE) return amount
  if (amount <= 1) return amount
  info(api, `🛡️ 「${location.name}」：${enemy.name} 本次只受到 1 点伤害（原本 ${amount} 点）。`)
  return 1
}

// 50038 食墓鬼：强制 - 食墓鬼攻击你后：从你的手中随机弃掉 1 张卡牌。
export function enemyAttackResolved(state, enemy, inv, api = {}) {
  if (!enemy || !inv) return false
  if (codeOf(enemy) !== GRAVE_EATER_CODE) return false
  if (!(inv.hand || []).length) return false
  safeCall(api, 'discardRandom', inv.seat, 1)
  info(api, `食墓鬼：${inv.name} 被攻击后随机弃掉 1 张手牌。`)
  return true
}

// 50039 乌默尔多斯的祭司：与没有手牌的调查员交战时不能被躲避。
export function canEvadeEnemy(state, inv, enemy) {
  void state
  if (!enemy || !inv) return true
  if (codeOf(enemy) !== ACOLYTE_OF_UMORDHOTH_CODE) return true
  return (inv.hand || []).length > 0
}

// ---------------------------------------------------------------------------
// 地点强制：50034 调查 / 50036 躲避 时额外揭示 1 个混乱标记
// ---------------------------------------------------------------------------
// 引擎读点：tests.js#performTest 的揭示循环调用 behavior.chaosTokenRevealed；
// 登记进 state.skillTest.pendingExtraReveals 后由同一个揭示循环追加（与 08112 同一原语口径）。
// 检定类型读 test.source.label：调查检定='调查'、躲避检定='躲避'（tests.js 不把
// options.investigation 写进 skillTest，不能读 test.investigation）。
// 「每次检定仅限一次」用队列里的私有标记判重（不新造存档字段）。
export function chaosTokenRevealed(state, inv, token, api = {}) {
  void token
  const test = state.skillTest
  if (!test || !inv) return undefined
  if (test.seat != null && test.seat !== inv.seat) return undefined
  const label = String(test.source?.label || '')
  if (label !== '调查' && label !== '躲避') return undefined
  const location = locationOf(state, inv.location)
  if (!location) return undefined
  const code = codeOf(location)
  const wanted = code === LAKESIDE_CODE ? 'investigate'
    : code === WOODEN_BRIDGE_CODE ? 'evade' : null
  if (!wanted || (wanted === 'investigate' && label !== '调查') || (wanted === 'evade' && label !== '躲避')) return undefined
  const pending = (test.pendingExtraReveals ||= [])
  if (pending.some(plan => plan.retDevourerExtra === code)) return undefined
  pending.push({ flipSign: false, autoFailOn: [], retDevourerExtra: code })
  info(api, `🌀 「${location.name}」：${inv.name} 额外揭示并结算 1 个混乱标记（每次检定一次）。`)
  return undefined
}

// 50033 巨大柳树：强制 - 本地点的调查员结算诡计时技能检定成功后：该诡计卡获得涌动。
// （团队每轮仅限一次）
// 读点：tests.js 在检定结束时调用 behavior.afterTest；这里只登记「待涌动」标记，
// 由 encounter.js#finishDraw 的 behavior.encounterGainsSurge 读点统一把涌动还给该诡计
// （不在检定中途嵌套抽牌，保持「该诡计卡获得涌动」的时机）。
export function afterTest(state, inv, result = null, api = {}) {
  if (!inv || !result || result.success !== true) return false
  const location = locationOf(state, inv.location)
  if (!location || codeOf(location) !== GREAT_WILLOW_CODE) return false
  // 数据型诡计检定的 source.type='encounter'；条目 encounterResolve 里发起的检定
  // source.type='scenario'，但 state._treacheryResolving 记录着正在结算的诡计卡号。
  const isTreacheryTest = result.source?.type === 'encounter' || Boolean(state._treacheryResolving)
  if (!isTreacheryTest) return false
  if (flagValue(state, 'retDevourerWillowRound') === state.round) return false
  const code = String(result.source?.code || state._treacheryResolving || '')
  setFlag(state, 'retDevourerWillowRound', state.round)
  setFlag(state, 'retDevourerWillowSurge', { round: state.round, code: code || null })
  info(api, `🌀 「${location.name}」：${result.source?.name || '该诡计'} 获得涌动（团队每轮一次）。`)
  return true
}

// 引擎读点：encounter.js#finishDraw 在判定本次遭遇是否涌动时调用；返回 true = 该卡获得涌动。
export function encounterGainsSurge(state, code, inv) {
  void inv
  const pending = flagValue(state, 'retDevourerWillowSurge')
  if (!pending || pending.round !== state.round) return false
  if (pending.code && String(code) !== String(pending.code)) return false
  delete flagsFor(state).retDevourerWillowSurge
  return true
}

// ---------------------------------------------------------------------------
// 50042 掠尸者：神话阶段末放毁灭；敌军阶段末向主道路移动或把毁灭交给密谋
// ---------------------------------------------------------------------------
export function mythosEnded(state, api = {}) {
  for (const enemy of enemiesInPlay(state)) {
    if (codeOf(enemy) !== CORPSE_TAKER_CODE) continue
    safeCall(api, 'doomOn', enemy, 1)
    info(api, `🌑 掠尸者：神话阶段结束，在它身上放置 1 个毁灭标记（共 ${Number(enemy.doom) || 0} 个）。`)
  }
  return false
}

export function enemyPhaseEnd(state, api = {}) {
  for (const enemy of enemiesInPlay(state)) {
    if (codeOf(enemy) !== CORPSE_TAKER_CODE) continue
    if (enemy.location === START_LOCATION) {
      const doom = Number(enemy.doom) || 0
      if (doom > 0) {
        safeCall(api, 'addDoom', doom)
        enemy.doom = 0
        info(api, `🌑 掠尸者已在主道路：把 ${doom} 个毁灭标记移到当前密谋。`)
      }
      continue
    }
    const destination = safeCall(api, 'stepToward', enemy.location, START_LOCATION)
    if (destination && destination !== enemy.location) {
      safeCall(api, 'moveEnemy', enemy, destination)
      info(api, '🚶 掠尸者向主道路移动一次。')
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// 50043 乌默尔多斯的面具：附属到最远的[[异教徒]]敌人
// ---------------------------------------------------------------------------
// 读点：scenario.treacheries['50043'].effect.kind === 'campaignRule' →
//       treachery-tokens.js#resolveTreacheryBody → behavior.resolveEncounter。
// 不建单卡条目的原因：theDevourersCult 同时被 RtMM 使用，归属算法会把条目判给
// returnToNightOfTheZealot/_shared/the_devourers_cult/（本任务只允许写本章目录）。
function farthestCultist(state, inv, api) {
  const cultists = enemiesInPlay(state).filter(enemy => hasTrait(enemy, 'Cultist'))
  if (!cultists.length) return null
  const distanceOf = enemy => {
    if (typeof api?.locationDistance !== 'function') return 0
    const value = api.locationDistance(inv.location, [enemy.location])
    return value == null || value < 0 ? Infinity : value
  }
  const scored = cultists.map(enemy => ({ enemy, distance: distanceOf(enemy) }))
  const finite = scored.filter(row => Number.isFinite(row.distance))
  const pool = finite.length ? finite : scored
  const farthest = Math.max(...pool.map(row => row.distance))
  const candidates = pool.filter(row => row.distance === farthest).map(row => row.enemy)
  if (candidates.length === 1 || typeof api?.choose !== 'function') return candidates[0] || null
  const picked = api.choose({
    kind: 'enemy', source: MASK_CODE, seat: inv.seat,
    prompt: '选择要附属「乌默尔多斯的面具」的最远[[异教徒]]敌人。',
    options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
  })
  return candidates.find(enemy => enemy.id === picked) || candidates[0] || null
}

function maskRevelation(state, inv, api) {
  let target = farthestCultist(state, inv, api)
  if (!target && typeof api?.searchEncounterCard === 'function') {
    // 场上没有[[异教徒]]敌人：查遭遇牌库与弃牌堆，抽出一个[[异教徒]]敌人再附属。
    const found = api.searchEncounterCard({
      traits: ['Cultist'], type: 'enemy', from: ['deck', 'discard'], spawn: 'engaged', seat: inv.seat,
    })
    if (found) target = enemiesInPlay(state).filter(enemy => codeOf(enemy) === String(found)).at(-1) || null
  }
  if (!target) {
    info(api, '「乌默尔多斯的面具」：没有可附属的[[异教徒]]敌人，本卡弃掉。')
    return { placed: false }
  }
  safeCall(api, 'attachToEnemy', target, MASK_CODE, { id: `${MASK_CODE}:${target.id}` })
  safeCall(api, 'doomOn', target, 1)
  // 附属的敌人 +2 生命走 enemyStatModifier('health') 读点；独特敌人获得反击，
  // 非独特敌人获得冷漠（setEnemyKeywords 是关键词改写的既有写入口）。
  const unique = target.unique === true || ALL_CARDS[codeOf(target)]?.unique === true
  safeCall(api, 'setEnemyKeywords', target, [unique ? 'retaliate' : 'aloof'],
    { enabled: true, throughRound: Number.MAX_SAFE_INTEGER })
  info(api, `🎭 「乌默尔多斯的面具」附属到「${target.name}」：+2 生命、放置 1 毁灭，`
    + `并${unique ? '获得反击' : '获得冷漠'}。`)
  return { placed: true }
}

export function resolveEncounter(state, inv, card, api = {}) {
  const code = codeOf(card)
  if (code !== MASK_CODE) return false
  return maskRevelation(state, inv, api)
}

// ---------------------------------------------------------------------------
// 幕背面
// ---------------------------------------------------------------------------
export function actReveal(state, act, api = {}, revealType = null) {
  const type = revealType || act?.reveal?.type
  if (type === 'revealRitualSite') return act1Back(state, api)
  if (type === 'drawEnemyAtRitualSite') return act2Back(state, api)
  if (type === 'resolution1') {
    safeCall(api, 'finish', 'r1')
    return true
  }
  if (type === 'resolution2') {
    safeCall(api, 'finish', 'r2')
    return true
  }
  return false
}

function ensureRitualSite(state, api) {
  if (!locationOf(state, RITUAL_SITE)) {
    safeCall(api, 'takeFromSetAside', LOCATIONS[RITUAL_SITE].code)
    safeCall(api, 'place', RITUAL_SITE)
  }
}

function act1Back(state, api) {
  ensureRitualSite(state, api)
  const escaped = state.campaign?.records?.cultistsEscaped || []
  for (const originalCode of escaped) {
    const code = typeof api?.ruleCode === 'function' ? api.ruleCode(originalCode) : originalCode
    const enemy = safeCall(api, 'spawn', code, START_LOCATION)
    if (enemy) info(api, `👹 逃跑的异教徒「${enemy.name}」出现在「主道路」！`)
  }
  info(api, '幕 1 背面：仪式地入场；未落网的异教徒生成在主道路。')
  return true
}

function act2Back(state, api) {
  if (typeof api?.shuffleDiscard === 'function') api.shuffleDiscard()
  else if ((state.encounterDiscard || []).length) {
    state.encounterDeck = [...(state.encounterDeck || []), ...state.encounterDiscard]
    state.encounterDiscard = []
  }
  const times = investigatorCount(state) >= 3 ? 2 : 1
  ensureRitualSite(state, api)
  for (let index = 0; index < times; index += 1) {
    const code = safeCall(api, 'discardAnyEnemy')
    if (!code) continue
    const enemy = safeCall(api, 'spawn', code, RITUAL_SITE)
    if (enemy) info(api, `👹 「${enemy.name}」在「仪式地」生成！`)
  }
  info(api, '幕 2 背面：遭遇弃牌堆洗回，弃到的敌人在仪式地生成。')
  return true
}

// ---------------------------------------------------------------------------
// 密谋揭示
// ---------------------------------------------------------------------------
export function agendaReveal(state, agenda, api = {}, revealType = null) {
  const type = revealType || agenda?.reveal?.type
  if (type === 'drawMonsterAtMainPath') return agenda1Back(state, api)
  if (type === 'madnessTest') return agenda2Back(state, api)
  if (type === 'spawnUmordhoth') return agenda3Back(state, api, agenda)
  return false
}

function agenda1Back(state, api) {
  if (typeof api?.shuffleDiscard === 'function') api.shuffleDiscard()
  else if ((state.encounterDiscard || []).length) {
    state.encounterDeck = [...(state.encounterDeck || []), ...state.encounterDiscard]
    state.encounterDiscard = []
  }
  const code = safeCall(api, 'discardUntilEnemyTrait', 'monster')
  if (code) {
    const enemy = safeCall(api, 'spawn', code, START_LOCATION)
    if (enemy) {
      safeCall(api, 'doomOn', enemy, 1)
      info(api, `👹 「${enemy.name}」在「主道路」生成，并放置 1 点毁灭。`)
    }
  } else {
    info(api, '密谋 1 背面：遭遇牌库中没有[[怪物]]敌人。')
  }
  return true
}

function agenda2Back(state, api) {
  const pool = typeof api?.basicWeaknesses === 'function' ? api.basicWeaknesses('madness') : []
  if (!pool.length) throw new Error('疯狂弱点依赖缺失')
  const random = typeof api?.random === 'function' ? api.random : Math.random
  for (const inv of activeInvestigators(state)) {
    safeCall(api, 'test', inv.seat, 'willpower', 6, result => {
      if (result?.success) {
        info(api, `✔️ ${inv.name} 通过意志检定，未被疯狂侵蚀。`)
        return
      }
      const code = pool[Math.floor(random() * pool.length)]
      if (typeof api?.putInHand === 'function') api.putInHand(inv.seat, code)
      else inv.hand.push(code)
      info(api, `❌ ${inv.name} 意志检定失败，获得疯狂弱点「${safeCall(api, 'cardName', code) || code}」。`)
    }, 0, { label: '密谋结算', name: '疯狂侵蚀' })
  }
  return true
}

function agenda3Back(state, api, agenda) {
  ensureRitualSite(state, api)
  // 场景 2/3 时先弃掉仪式地上的所有敌人（Haskell：discard all enemies at the Ritual Site）。
  for (const enemy of state.enemies.filter(item => item.location === RITUAL_SITE).slice()) {
    const index = state.enemies.indexOf(enemy)
    if (index >= 0) state.enemies.splice(index, 1)
    if (enemy.engagedSeat != null) {
      const target = state.investigators[enemy.engagedSeat]
      if (target) target.engaged = (target.engaged || []).filter(id => id !== enemy.id)
    }
    if (typeof api?.isWeaknessCode === 'function' && api.isWeaknessCode(enemy.code)) {
      state.investigators[enemy.bearerSeat]?.discard.push(enemy.code)
    } else {
      state.encounterDiscard.push(enemy.code)
    }
    info(api, `♻️ 「${enemy.name}」因仪式地让位于乌默尔多斯而进入遭遇弃牌堆。`)
  }
  safeCall(api, 'takeFromSetAside', UMORDHOTH_CODE)
  safeCall(api, 'takeFromSetAside', VAULT_CODE)
  const boss = safeCall(api, 'spawn', UMORDHOTH_CODE, RITUAL_SITE)
  if (boss) info(api, `👹 古神「${boss.name}」降临于「仪式地」！`)
  const final = {
    ...agenda, name: '地底噬魔', stage: '3b', face: 'back', doomThreshold: null, reveal: null,
    text: '目标 — 如果乌默尔多斯被击败，推进至结局 2。',
  }
  state.agendas = [final]
  state.agendaIndex = 0
  state.acts = [{
    ...final, id: 'finalObjective', objective: { type: 'defeatEnemy', enemy: UMORDHOTH_CODE },
    reveal: { type: 'resolution2' },
  }]
  state.actIndex = 0
  safeCall(api, 'autoEngageAll')
  info(api, '幕与密谋被「地底噬魔」替代：目标改为击败乌默尔多斯（→ 结局 2）。')
  return true
}

// 乌默尔多斯被击败：密谋 3 的 forced 直接把场景带入结局 2。
export function agendaForcedEnemyDefeated(state, enemy, api) {
  const forced = state.agendas[state.agendaIndex]?.forced?.enemyDefeated
  if (!forced || forced.type !== 'umordhothDefeated') return false
  if (codeOf(enemy) !== UMORDHOTH_CODE) return false
  safeCall(api, 'finish', 'r2')
  return true
}

// 乌默尔多斯在每位调查员回合结束时重整（印刷强制）。
export function turnEnded(state, inv, api) {
  void inv
  const boss = state.enemies.find(enemy => codeOf(enemy) === UMORDHOTH_CODE && enemy.exhausted)
  if (!boss) return false
  boss.exhausted = false
  info(api, '🌀 「乌默尔多斯」重整。')
  return true
}

// ---------------------------------------------------------------------------
// 行动：献祭丽塔·钱德勒（→ 结局 3）
// ---------------------------------------------------------------------------
export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const boss = state.enemies.find(enemy => codeOf(enemy) === UMORDHOTH_CODE)
  const controlled = (inv.assets || []).some(asset => asset.code === LITA_CHANDLER_CODE)
  const bossAt = boss && (locationOf(state, boss.location)?.name || boss.location)
  return [{
    action: 'sacrificeLita', enemyId: boss?.id, scriptCard: 'enemy',
    label: '😱 献祭丽塔·钱德勒（→ 结局 3）',
    reason: !controlled ? '需要先控制丽塔·钱德勒'
      : !boss ? '乌默尔多斯尚未降临'
        : boss.location === inv.location ? null : `需要与乌默尔多斯位于同一地点（它在「${bossAt}」）`,
  }]
}

export function scenarioActionError(state, inv, action) {
  if (action !== 'sacrificeLita') return undefined
  const boss = state.enemies.find(enemy => codeOf(enemy) === UMORDHOTH_CODE)
  if (!boss) return '乌默尔多斯尚未降临'
  if (boss.location !== inv.location) return '乌默尔多斯不在你所在的地点'
  if (!(inv.assets || []).some(asset => asset.code === LITA_CHANDLER_CODE)) return '你没有控制丽塔·钱德勒'
  return null
}

export function sacrificeLitaAction(state, inv, api = {}) {
  const asset = (inv.assets || []).find(item => item.code === LITA_CHANDLER_CODE)
  if (!asset) return false
  const records = recordsFor(state)
  const owners = Object.values(state.campaign.investigators || {})
    .filter(record => record.deck?.includes(asset.code))
  // litaOwner 记录的是「丽塔所属调查员」的 id（hub.js 在关间写）；用它核对献祭者。
  const recordedOwner = typeof records.litaOwner === 'string' ? records.litaOwner : null
  const ownerRecord = owners.find(record => record.id === recordedOwner) || owners[0] || null
  safeCall(api, 'spendAction', inv.seat)
  safeCall(api, 'removeAsset', inv.seat, asset.id)
  if (ownerRecord) {
    safeCall(api, 'campaignCardChange', state.campaign, ownerRecord.seat, asset.code, 'remove', 'sacrificedLita')
  }
  ;(state.exiled ||= []).push(asset.code)
  info(api, `${inv.name} 将丽塔·钱德勒推向了乌默尔多斯，并从实际牌组中移除丽塔。`)
  safeCall(api, 'finish', 'r3')
  return true
}

// ---------------------------------------------------------------------------
// 结局（记录键沿用基础章节，不新增）
// ---------------------------------------------------------------------------
export function resolution(state, key, events = null, api = {}) {
  void events
  const finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : 'noResolution'
  if (finalKey === 'r3') {
    for (const inv of state.investigators || []) {
      if (inv.resigned || inv.defeated) continue
      const pool = typeof api?.basicWeaknessPool === 'function'
        ? api.basicWeaknessPool().filter(code => (api.ALL_CARDS?.[code]?.traits || [])
          .some(trait => String(trait).toLowerCase() === 'madness'))
        : []
      if (!pool.length) continue
      // 结局钩子拿到的是引擎的 raw randomValue(state)（campaign-flow 注入），与基础章节同口径。
      const random = typeof api?.randomValue === 'function' ? api.randomValue(state) : Math.random()
      safeCall(api, 'campaignCardChange', state.campaign, inv.seat,
        pool[Math.floor(random * pool.length)], 'add', 'sacrificedLita')
    }
  }
  const infoApi = typeof api?.info === 'function' ? api : {}
  info(infoApi, finalKey === 'noResolution'
    ? '结局：屈服于乌默尔多斯；所有仍活着的调查员阵亡。'
    : finalKey === 'r1'
      ? '结局 1：仪式已破坏；每位调查员 +2 精神创伤，额外 5 经验。'
      : finalKey === 'r2'
        ? '结局 2：已击退乌默尔多斯；每位调查员 +2 肉体与 +2 精神创伤，额外 10 经验。'
        : '结局 3：已牺牲丽塔；每位调查员 +2 肉体与 +2 精神创伤。')
  if (finalKey === 'noResolution') {
    return {
      bonus: 0,
      award: false,
      effects: [
        { record: { succumbedToUmordhoth: true }, failed: true },
        { investigatorStatus: 'killed', targets: 'all' },
      ],
    }
  }
  return {
    bonus: finalKey === 'r1' ? 5 : finalKey === 'r2' ? 10 : 0,
    award: true,
    effects: [
      { record: { ritualBroken: true }, when: { resolution: 'r1' } },
      { record: { repelledUmordhoth: true }, when: { resolution: 'r2' } },
      { record: { sacrificedLita: true }, when: { resolution: 'r3' } },
      { trauma: { all: { mental: 2 } } },
      { trauma: { all: { physical: 2 } }, when: { not: { resolution: 'r1' } } },
    ],
  }
}

// ---------------------------------------------------------------------------
// 只读投影
// ---------------------------------------------------------------------------
export function scenarioSummary(state) {
  const prepared = flagValue(state, 'retDevourerPrepared') || null
  return {
    act: currentActCode(state),
    agenda: currentAgendaCode(state),
    agentSetId: prepared?.agentSetId || null,
    woods: [...(prepared?.woods || [])],
    vault: flagValue(state, 'retDevourerVault') || null,
    setAside: [...(state.scenarioZones?.setAside || [])],
  }
}

export function describe(state) {
  const prepared = flagValue(state, 'retDevourerPrepared')
  const vault = flagValue(state, 'retDevourerVault')
  return [
    `使者组：${prepared?.agentSetId || '?'}；密林：${(prepared?.woods || []).join('/') || '?'}。`,
    `凡尘终陨之墟：${vault?.resources || 0} 资源（乌默尔多斯 ${vault?.inPlay ? '已入场' : '仍放一边'}）。`,
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
  // 幕 3（01148）的[action]「破坏仪式」由引擎读这个索引开启。
  interruptRitualActIndex: 2,
  preScenarioSetup,
  prepareScenario,
  setupScenario,
  setupLocations,
  modifyDeck,
  afterDeckSetup,
  afterMulligan,
  spawnLocation,
  enemySpawned,
  enemyStatModifier,
  enemyDamageAmount,
  enemyAttackResolved,
  canEvadeEnemy,
  chaosTokenRevealed,
  afterTest,
  encounterGainsSurge,
  resolveEncounter,
  mythosEnded,
  enemyPhaseEnd,
  actions,
  scenarioActionError,
  sacrificeLitaAction,
  actReveal,
  agendaReveal,
  agendaForcedEnemyDefeated,
  turnEnded,
  resolution,
  events,
  scenarioSummary,
  describe,
  // 具名助手（测试/验收）
  currentActCode,
  currentAgendaCode,
  codeOf,
}

export {
  ACT_CODES, ACT1_CODE, ACT2_CODE, ACT3_CODE, AGENDA_CODES, AGENDA1_CODE, AGENDA2_CODE, AGENDA3_CODE,
  START_LOCATION, RITUAL_SITE, SET_ASIDE_LOCATION_IDS, SET_ASIDE_ALIASES, ENCOUNTER_DECK,
  ENCOUNTER_DECK_CODES, LOCATION_IDS, WOODS_POOL, WOODS_COUNT, AGENT_SETS, AGENT_SET_IDS,
  UMORDHOTH_CODE, GHOUL_PRIEST_CODE, LITA_CODE, VAULT_CODE, scenario, SCENARIO_TEXT,
  currentActCode, currentAgendaCode,
}
