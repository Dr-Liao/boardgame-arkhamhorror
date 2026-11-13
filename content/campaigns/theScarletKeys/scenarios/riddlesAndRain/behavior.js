// 谜雨（riddlesAndRain · 09501）· 章节引擎钩子（设置 / 地点能力 / 幕议程 / 隐匿 / 密钥 / 结局）。
//
// 约定与 EotE 章节 behavior 相同：
//   · 本文件只做章节分派与剧本级机制；逐卡规则在单卡条目里（本章条目只有 09518 与两把密钥面）；
//   · 地点能力按 P7 分片约定写在章节钩子里（地点卡不建条目），与 EotE「地点只在 definition 声明」一致；
//   · 写入优先走 `ctx.api`（`api.tsk.*` / `api.placeLocation` / `api.advanceAgendaTo` …）；少数引擎只暴露给
//     卡条目的钩子（actions/statModifier 没有 api 参数）用原语模块的只读/写入口兜底（见各函数注释）。
//
// 记录键（跨章汇总；与故事/README 的 Campaign Log 段落对齐）：
//   · tskTime                  —— 「Time Passed」累计值（intro 6/7 + 每个结局标记的时间）
//   · tskPrologueIntent        —— 序幕选择 'trust'（删 [elder_thing] 加 [tablet]）/ 'deception'（反向）
//   · tskPrologueResolution    —— 本章结局键（noResolution / resolution1–4）
//   · tskRedGlovedManAtLarge   —— 「你和戴红手套的男子之间恩怨未了」（固定 true）
//   · tskEyeOfRavensBearer     —— 渡鸦之眼持有者（'investigator:<seat>' / 'redGlovedMan'）
//
// 已披露的近似（审计摘要 simplified；缺读点的同时写 primitive-requests/<code>.json）：
//   1. 密钥「附属到地点」没有原语承载：`campaign.tsk.keys` 的 bearer 只有 none/investigator/enemy，
//      塔楼牢房附属用章节标记 `scenarioFlags.tskKeyLocations` 记账（09519a）。
//   2. 「将基础技能值设为 6」用 statModifier 读点补足，检定结束时再翻面（没有检定开始前替换基值的读点）。
//   3. 「查看已揭示面（不揭露）」没有私密通道：用一次性 choice 展示该迷你卡的真身（09511）。
//   4. 「把迷你卡放回场外」用取出（expose）实现；重新入场时按卡面重新分配迷你卡。
//   5. 阴影中敌人的「攻击」按印刷伤害/恐惧直接结算（不生成实体、不走敌人攻击管线）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { tskScenarioState } from '../../../../../src/engine/tsk-state.js'
import {
  concealedAt as concealedAtCards, concealedById, concealedMiniCards, distributeConcealed, exposeMiniCard,
  isInShadows, placeMiniCard, reshuffleConcealed, setInShadows,
} from '../../../../../src/engine/tsk-concealed.js'
import { scarletKey } from '../../../../../src/engine/tsk-scarlet-keys.js'
import { cardCounterOf } from '../../../../../src/engine/card-counters.js'
import {
  CHAPTER_ID, CONCEALED_DECOY_KIND, CONCEALED_DECOYS_PER_INVESTIGATOR, CONCEALED_DECOY_SPECS, CONCEALED_ENEMY_CODES,
  GATHER_SET_ASIDE_GROUPS, KEY_CODES, KEY_ID, LOCATIONS, LOCATIONS_BY_BACK, LOCATION_CONNECTIONS,
  RAW_CODES as RAW, SCENARIO_TEXT, SET_ASIDE_ALIASES, SET_ASIDE_GROUP_CODES, SET_ASIDE_LOCATION_IDS,
  START_LOCATION, concealedCodeOf, concealedKindOf, scenario,
} from './definition.js'
import { riddlesChaosTokenOutcome, riddlesElderThingFailureSpec } from './chaos.js'

// ---------------------------------------------------------------------------
// 记录与基础读点
// ---------------------------------------------------------------------------
// 记录键必须存在于战役 recordSchema（content/campaigns/theScarletKeys/records.js 的
// FLOW_RECORD_KEYS / CAMP_RECORD_KEYS）：时间走 `time`、密钥归属走 `keysHeld`、章节完成走
// `chaptersCompleted`。印刷「记录你和戴红手套的男子之间恩怨未了」在 Key.hs 的复选框表里没有
// 对应键，改用引擎原生的 `campaign.scenarioResults` 结局记录 + 本章 flowData 承载（见报告）。
export const RECORD_KEYS = Object.freeze({
  time: 'time',
  keysHeld: 'keysHeld',
  chapters: 'chaptersCompleted',
})

// 章节级标记（scenarioFlags，不进战役记录）：序幕选择 / 结算键 / 渡鸦之眼地点。
export const FLAG_KEYS = Object.freeze({
  prologueIntent: 'tskPrologueIntent',
  keyLocations: 'tskKeyLocations',
})

const codeOf = card => card?.originalCode || card?.code || card || null
const activeInvestigators = state => (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
const numInvestigators = state => Math.max(1, Number(state.numInvestigators) || (state.investigators || []).length || 1)
const locationOf = (state, id) => (state.locations || []).find(location => location.id === id)
const flagsOf = state => (state.scenarioFlags ||= {})
const zonesOf = state => (state.scenarioZones ||= {})
const setAside = state => (zonesOf(state).setAside ||= [])
const recordsOf = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const leadSeat = state => Number(state.campaign?.leadSeat ?? state.investigators?.[0]?.seat ?? 0)

function takeFromSetAside(state, code) {
  const list = setAside(state)
  const index = list.indexOf(String(code))
  if (index < 0) return false
  list.splice(index, 1)
  return true
}

function cardName(code) {
  const card = ALL_CARDS[code]
  return card?.nameZh || card?.name || String(code)
}

function setRecord(api, state, key, value) {
  if (typeof api.setCampaignRecord === 'function') return api.setCampaignRecord(key, value)
  if (value == null) delete recordsOf(state)[key]
  else recordsOf(state)[key] = value
  return value
}

function readRecord(api, state, key) {
  if (typeof api.campaignRecord === 'function') return api.campaignRecord(key)
  return recordsOf(state)[key] ?? null
}

/** 「Time Passed」累计值（跨章记录键 tskTime）。 */
export function timePassed(state) {
  return Number(recordsOf(state)[RECORD_KEYS.time] || 0)
}

/** 读取一个 string[] 记录（缺省空数组）。 */
function listRecordOf(api, state, key) {
  const value = readRecord(api, state, key)
  return Array.isArray(value) ? [...value] : []
}

/** 写入 string[] 记录（去重；返回新列表）。 */
function writeListRecord(api, state, key, list) {
  const next = [...new Set(list)]
  setRecord(api, state, key, next)
  return next
}

/** 记录/移除「队伍持有某把绯红密钥」。 */
export function setKeyHeld(state, keyId, held, api = {}) {
  const list = listRecordOf(api, state, RECORD_KEYS.keysHeld)
  const next = held ? [...list, keyId] : list.filter(id => id !== keyId)
  return writeListRecord(api, state, RECORD_KEYS.keysHeld, next)
}

/** 记录本章完成（chaptersCompleted 追加 chapterId）。 */
export function markChapterCompleted(state, chapterId = CHAPTER_ID, api = {}) {
  const list = listRecordOf(api, state, RECORD_KEYS.chapters)
  return writeListRecord(api, state, RECORD_KEYS.chapters, [...list, chapterId])
}

/** 在剧本日志标记 n 时间（记录键 tskTime），返回累计值。 */
export function markTime(state, amount = 1, api = {}) {
  const step = Number(amount) || 0
  if (step <= 0) return timePassed(state)
  const next = timePassed(state) + step
  setRecord(api, state, RECORD_KEYS.time, next)
  api.info?.(`⏳ 剧本日志：标记 ${step} 时间（Time Passed 累计 ${next}）。`)
  return next
}

// ---------------------------------------------------------------------------
// 地点：运行期实例 / 入场 / 揭示
// ---------------------------------------------------------------------------
/** 印刷地点 → 运行期地点实例（线索按调查员人数缩放）。 */
export function makeRuntimeLocation(state, id, { revealed = false } = {}) {
  const data = LOCATIONS[id]
  if (!data) return null
  const perInvestigator = Number(data.cluesPerInvestigator || 0)
  const maxClues = perInvestigator * numInvestigators(state)
  return structuredClone({
    ...data, id, revealed, clues: revealed ? maxClues : 0, maxClues, doom: 0,
    connections: [...(LOCATION_CONNECTIONS[id] || [])],
  })
}

function fallbackPlaceLocation(state, id) {
  if (locationOf(state, id)) return locationOf(state, id)
  const placed = makeRuntimeLocation(state, id)
  if (placed) state.locations.push(placed)
  return placed
}

/**
 * 把一个印刷地点放进场上（并从「放一边」取出）。`revealed` 指印刷要求「放置入场」时是否正面朝上；
 * 正面朝上统一走引擎的 reveal 管线（放置线索、地点揭示钩子、胜利点）。
 */
export function placeLocationInPlay(state, id, api = {}, { revealed = true } = {}) {
  const code = LOCATIONS[id]?.originalCode
  if (!locationOf(state, id)) {
    // 剧本运行时的地点入场入口是 `api.place`（`api.placeLocation` 是机制面的别名）。
    if (typeof api.place === 'function') api.place(id)
    else if (typeof api.placeLocation === 'function') api.placeLocation(id)
    if (!locationOf(state, id)) fallbackPlaceLocation(state, id)
  }
  if (code) takeFromSetAside(state, code)
  const placed = locationOf(state, id)
  if (placed && revealed && placed.revealed !== true) {
    if (typeof api.reveal === 'function') api.reveal(id)
    else {
      placed.revealed = true
      placed.clues = placed.maxClues || placed.clues || 0
    }
  }
  return locationOf(state, id)
}

function placeBackLocations(state, key, api) {
  const placed = []
  for (const id of LOCATIONS_BY_BACK[key] || []) {
    placeLocationInPlay(state, id, api, { revealed: true })
    if (locationOf(state, id)) placed.push(id)
  }
  if (placed.length) api.info?.(`📍 放置地点：${placed.map(id => LOCATIONS[id]?.name || id).join('、')}。`)
  return placed
}

/** 伦敦雨街的强制补线索：「如果没有线索，补到 1/调查员」。 */
export function refillRainyLondonStreets(state, api = {}) {
  const location = locationOf(state, RAW.rainyLondonStreets)
  if (!location) return 0
  const target = numInvestigators(state)
  const missing = Math.max(0, target - (location.clues || 0))
  if (!missing) return 0
  if (typeof api.addCluesToLocation === 'function') api.addCluesToLocation(location.id, missing)
  else location.clues = (location.clues || 0) + missing
  api.info?.(`🌧️ 伦敦雨街没有线索：补充 ${missing} 个线索（直到 ${target} 个）。`)
  return missing
}

// ---------------------------------------------------------------------------
// 隐匿迷你卡（Concealed）
// ---------------------------------------------------------------------------
/** TSK 原语命名空间：剧本运行时把它挂在 `api.mechanics.tsk`，卡条目/旧入口直接挂在 `api.tsk`。 */
const tskApi = api => api?.tsk || api?.mechanics?.tsk || null

/** 读取统一入口：优先 `api.mechanics.tsk.concealed`，没有 api 的钩子（actions/statModifier）用原语模块。 */
function concealedApi(api, state) {
  const namespace = tskApi(api)?.concealed
  if (namespace) return namespace
  return {
    miniCards: () => concealedMiniCards(state),
    at: (locationId, position) => concealedAtCards(state, locationId, position),
    byId: id => concealedById(state, id),
    inShadows: locationId => isInShadows(state, locationId),
    setInShadows: (locationId, value) => setInShadows(state, locationId, value),
    place: spec => placeMiniCard(state, spec),
    distribute: spec => distributeConcealed(state, spec),
    expose: (id) => exposeMiniCard(state, id),
    reshuffle: options => reshuffleConcealed(state, options),
  }
}

/** 某地点上的隐匿迷你卡（只读）。 */
export function miniCardsAt(state, locationId, api = {}) {
  return concealedApi(api, state).at(locationId)
}

/**
 * 一个敌人的「Concealed X」规格（2026-11-13 P1-3 统一口径）。
 * 读点优先级：条目 `enemyScript.concealed`（{value, perInvestigator}）→ `enemyRule.concealed`（数字或对象）
 * → `flags.concealed`（数字）→ definition 的印刷表（无 per_investigator 图标，按总诱饵数）。
 * 返回 `{ value, perInvestigator }`；`value` 是印刷 X，倍率只在 perInvestigator 时按调查员人数乘。
 */
export function concealedSpecFor(code) {
  const entry = registeredEntry(code)
  const isPerInvestigator = flag => flag === true || Number(flag) === 1
  const scripted = entry?.enemyScript?.concealed
  if (scripted && typeof scripted === 'object') {
    return { value: Number(scripted.value ?? 1) || 1, perInvestigator: isPerInvestigator(scripted.perInvestigator) }
  }
  const rule = entry?.enemyRule?.concealed
  if (typeof rule === 'number') return { value: rule, perInvestigator: false }
  if (rule && typeof rule === 'object') {
    return { value: Number(rule.value ?? 1) || 1, perInvestigator: isPerInvestigator(rule.perInvestigator) }
  }
  const flags = entry?.flags?.concealed
  if (typeof flags === 'number') return { value: flags, perInvestigator: false }
  const spec = CONCEALED_DECOY_SPECS[code]
  if (spec) return { value: spec.value, perInvestigator: isPerInvestigator(spec.perInvestigator) }
  return { value: Number(CONCEALED_DECOYS_PER_INVESTIGATOR[code] ?? 0) || 0, perInvestigator: false }
}

/** 本局该敌人的**总诱饵数**：印刷 X，且仅带 `[per_investigator]` 图标的卡才乘调查员人数。 */
export function concealedDecoysFor(code, state) {
  const spec = concealedSpecFor(code)
  if (!spec.value) return 0
  return spec.perInvestigator ? spec.value * numInvestigators(state) : spec.value
}

/** 隐匿迷你卡总数（含诱饵；观察投影只给张数）。 */
export function concealedTotal(state, api = {}) {
  return concealedApi(api, state).miniCards().length
}

/** 「阴影中的敌人」：真身迷你卡（不含诱饵）；章节内部权威读点，不用于观察投影。 */
export function shadowsEnemies(state, api = {}) {
  return concealedApi(api, state).miniCards()
    .filter(card => card.decoy !== true)
    .map(card => ({ id: card.id, kind: card.kind, code: concealedCodeOf(card.kind), locationId: card.locationId }))
    .filter(entry => Boolean(entry.code))
}

/** 离某地点「最近」的在场地点：本地点 + 连接地点（按地点 id 稳定排序）。 */
export function nearestLocationIds(state, locationId) {
  const here = locationOf(state, locationId)
  if (!here) return []
  const ids = [here.id, ...(here.connections || []).filter(id => locationOf(state, id))]
  return [...new Set(ids)].sort()
}

/**
 * 结算一个敌人的「Concealed X」：拿取其迷你卡与 X×调查员 张诱饵，正面朝下混洗后尽可能平均地
 * 分配到离 `locationId`（通常是领队所在地点）最近的地点；这些地点标记为「阴影」。
 */
export function distributeConcealedEnemy(state, code, { locationId = null, seat = null, only = null } = {}, api = {}) {
  const concealed = concealedApi(api, state)
  // 2026-11-13 P1-3：decoys 是该敌人本局的**总诱饵数**（印刷 X；per_investigator 才乘人数）。
  const decoys = concealedDecoysFor(code, state)
  if (!decoys) return null
  const anchor = locationId || state.investigators?.[seat ?? leadSeat(state)]?.location || START_LOCATION
  // only：印刷强制「全部放到某地点」时跳过「最近地点平均分配」。
  const locations = only ? [...only] : nearestLocationIds(state, anchor)
  if (!locations.length) return null
  const cards = [
    { kind: concealedKindOf(code), code, decoy: false },
    ...Array.from({ length: decoys }, () => ({ kind: CONCEALED_DECOY_KIND, decoy: true })),
  ]
  const base = Math.floor(cards.length / locations.length)
  let remainder = cards.length % locations.length
  const placements = locations.map(id => {
    const count = base + (remainder > 0 ? 1 : 0)
    if (remainder > 0) remainder -= 1
    return { locationId: id, count }
  }).filter(entry => entry.count > 0)
  const created = concealed.distribute({ cards, placements, position: null })
  for (const location of locations) concealed.setInShadows(location, true)
  api.info?.(`🕯️ 「${cardName(code)}」进入阴影：${cards.length} 张迷你卡（含 ${decoys} 张诱饵）正面朝下分配到 `
    + `${placements.map(entry => `「${LOCATIONS[entry.locationId]?.name || entry.locationId}」×${entry.count}`).join('、')}。`)
  return { code, cards: created || [], placements, decoys }
}

/**
 * 揭露一张隐匿迷你卡：交给原语取出后，真身入场（在迷你卡所在地点生成敌人），诱饵直接移除。
 * 肯辛顿花园的两条印刷触发（揭露诱饵治愈 1 恐惧；揭露敌人受到 1 恐惧）在这里结算。
 */
export function exposeMiniCardAt(state, id, inv, api = {}) {
  const concealed = concealedApi(api, state)
  const card = concealed.byId(id)
  if (!card) return null
  const locationId = card.locationId
  const exposed = concealed.expose(id)
  if (!exposed) return null
  const seat = inv?.seat ?? state.currentSeat ?? 0
  const kensington = locationId === L.kensington
  if (exposed.decoy) {
    api.info?.(`🎭 揭露的是诱饵（「${LOCATIONS[locationId]?.name || locationId}」）。`)
    if (kensington) {
      api.healHorror?.(seat, 1)
      api.info?.('🌿 肯辛顿花园：揭露诱饵后治愈 1 点恐惧。')
    }
    return { ...exposed, locationId, spawned: null }
  }
  const code = concealedCodeOf(exposed.kind)
  let spawned = null
  if (code) {
    flagsOf(state).tskExposingConcealed = code
    try {
      if (typeof api.spawn === 'function') spawned = api.spawn(code, locationId)
      else { state.enemies ||= []; spawned = fallbackSpawn(state, code, locationId) }
    } finally {
      delete flagsOf(state).tskExposingConcealed
    }
    api.info?.(`👁️ 揭露真身：${cardName(code)} 在「${LOCATIONS[locationId]?.name || locationId}」入场。`)
  }
  if (kensington) {
    api.horror?.(seat, 1)
    api.info?.('🌿 肯辛顿花园：揭露敌人后受到 1 点恐惧。')
  }
  return { ...exposed, code, locationId, spawned }
}

/** 兜底生成（api.spawn 缺失时的最小实例；正常路径一律走 api.spawn）。 */
function fallbackSpawn(state, code, locationId) {
  const card = ALL_CARDS[code] || {}
  const enemy = {
    id: `${code}-${(state.enemies || []).length + 1}`, code, originalCode: code,
    name: cardName(code), location: locationId, engagedSeat: null, exhausted: false, damageTaken: 0,
    fight: card.fight ?? null, evade: card.evade ?? null,
    health: card.healthPerInvestigator ? (card.health || 1) * numInvestigators(state) : (card.health ?? null),
    damage: card.damage || 0, horror: card.horror || 0, traits: [...(card.traits || [])],
  }
  state.enemies.push(enemy)
  return enemy
}

/** 阴影中的每个敌人攻击某位调查员（伦敦塔强制效果）：按印刷伤害/恐惧直接结算（近似 5）。 */
export function shadowsAttack(state, seat, api = {}) {
  const enemies = shadowsEnemies(state, api)
  if (!enemies.length) return 0
  let hits = 0
  for (const entry of enemies) {
    const card = ALL_CARDS[entry.code]
    if (!card) continue
    if (typeof api.harm === 'function') api.harm(seat, { damage: card.damage || 0, horror: card.horror || 0 })
    else {
      const inv = state.investigators?.[seat]
      if (inv) { inv.damage = (inv.damage || 0) + (card.damage || 0); inv.horror = (inv.horror || 0) + (card.horror || 0) }
    }
    hits += 1
  }
  api.info?.(`🗡️ 阴影中的 ${hits} 个敌人向 ${state.investigators?.[seat]?.name || '调查员'} 发起攻击。`)
  return hits
}

// ---------------------------------------------------------------------------
// 绯红密钥（渡鸦之眼）
// ---------------------------------------------------------------------------
function keysApi(api) {
  return tskApi(api)?.keys || null
}

function readKeyRecord(state, api = {}) {
  const namespace = keysApi(api)
  if (namespace) {
    try { return namespace.get(KEY_ID) } catch { return null }
  }
  try { return scarletKey(state, KEY_ID) } catch { return null }
}

/** 密钥「附属地点」（近似 1：原语 bearer 没有地点类型，用章节标记记账）。 */
export function keyLocationOf(state) {
  return flagsOf(state)[FLAG_KEYS.keyLocations]?.[KEY_ID] || null
}

export function attachKeyToLocation(state, locationId, api = {}) {
  flagsOf(state)[FLAG_KEYS.keyLocations] ||= {}
  if (locationId == null) delete flagsOf(state)[FLAG_KEYS.keyLocations][KEY_ID]
  else flagsOf(state)[FLAG_KEYS.keyLocations][KEY_ID] = locationId
  api.info?.(locationId
    ? `🗝️ 渡鸦之眼附属到「${LOCATIONS[locationId]?.name || locationId}」（不由任何人控制）。`
    : '🗝️ 渡鸦之眼离开地点。')
  return keyLocationOf(state)
}

/** 初始化渡鸦之眼（战役级密钥实体；已初始化时沿用现有记录）。 */
export function initializeEyeOfRavens(state, api = {}) {
  const namespace = keysApi(api)
  if (!namespace) return null
  const existing = readKeyRecord(state, api)
  if (existing) return existing
  try {
    const created = namespace.initialize([{
      id: KEY_ID, stableFace: KEY_CODES.stable, unstableFace: KEY_CODES.unstable, bearer: { type: 'none' },
    }])
    api.info?.('🗝️ 渡鸦之眼：稳定面／动荡面就绪（放一边，场外）。')
    return created?.[0] || null
  } catch (error) {
    api.info?.(`⚠️ 渡鸦之眼初始化失败：${error.message}`)
    return null
  }
}

/** 密钥当前面卡号（09519a 稳定 / 09519b 动荡）。 */
export function keyFaceOf(state, api = {}) {
  const record = readKeyRecord(state, api)
  if (!record) return null
  return record.stable ? KEY_CODES.stable : KEY_CODES.unstable
}

/**
 * 结算一次 Shift（变换）：按当前面的条目声明（`keyRule.shift`）执行效果并翻面。
 *   · 稳定面（09519a）：`setBaseSkillValue 6` 由 statModifier 在读点补齐；这里翻到动荡面。
 *   · 动荡面（09519b）：抽遭遇牌库顶 1 张；若由调查员变换则翻回稳定面。
 * `by`：'investigator' | 'enemy' | 'effect'（谁能触发翻面）。
 */
export function resolveKeyShift(state, { by = 'investigator', seat = null, api = {}, force = true } = {}) {
  const namespace = keysApi(api)
  if (!namespace) return null
  const record = readKeyRecord(state, api)
  if (!record) return null
  const face = record.stable ? KEY_CODES.stable : KEY_CODES.unstable
  const rule = registeredEntry(face)?.flags?.keyShift || null
  const effect = rule?.effect || null
  if (effect?.type === 'drawEncounterTop') {
    const target = seat ?? state.currentSeat ?? leadSeat(state)
    if (typeof api.drawEncounter === 'function') api.drawEncounter(target)
    api.info?.('🎴 渡鸦之眼（动荡面）：抽取遭遇牌库顶 1 张。')
  }
  const flipPolicy = rule?.flip || (effect?.type === 'drawEncounterTop' ? 'ifInvestigator' : 'always')
  const shouldFlip = flipPolicy === 'always' || (flipPolicy === 'ifInvestigator' && by === 'investigator')
  if (!shouldFlip) return { face, flipped: false, by }
  let result = null
  try {
    result = namespace.shift(KEY_ID, { force })
  } catch (error) {
    api.info?.(`⚠️ 渡鸦之眼无法变换：${error.message}`)
    return { face, flipped: false, by, error: error.message }
  }
  api.info?.(`🔄 渡鸦之眼变换：${result?.from || face} → ${result?.to || '?'}（由 ${by} 触发）。`)
  return { face, flipped: true, by, from: result?.from, to: result?.to }
}

// ---------------------------------------------------------------------------
// 威胁区 / 同志会乱入（设置阶段）
// ---------------------------------------------------------------------------
/**
 * 红色同志会乱入：「状况报告 ε 之后，每关设置时从『恩怨未了』池随机抽 1 名敌人洗入遭遇牌库」。
 * 读点是引擎的状况报告状态（未初始化 = 第一章序幕，此时无事发生）。
 */
export function injectRedCoterie(state, api = {}) {
  const reports = tskApi(api)?.map?.statusReports
  if (!reports) return null
  let reportState = null
  try { reportState = reports.state() } catch { reportState = null }
  if (!reportState || !Array.isArray(reportState.triggered) || !reportState.triggered.includes('epsilon')) return null
  const coterie = tskApi(api)?.coterie
  if (!coterie) return null
  let injected = null
  try { injected = coterie.inject() } catch { injected = null }
  if (!injected?.code) return null
  api.shuffleIntoEncounterDeck?.([injected.code])
  api.info?.(`🩸 红色同志会乱入：「${cardName(injected.code)}」从恩怨未了池洗入遭遇牌库。`)
  return injected
}

// ---------------------------------------------------------------------------
// 设置
// ---------------------------------------------------------------------------
/** 混乱袋增减（api 没有入口时退到 state.chaosBag / campaign.chaosBag，两处同步）。 */
function adjustChaosBag(state, token, delta, api = {}) {
  const remove = () => {
    if (typeof api.removeChaosToken === 'function') return api.removeChaosToken(token)
    const index = (state.chaosBag || []).indexOf(token)
    if (index >= 0) state.chaosBag.splice(index, 1)
    const campaignIndex = (state.campaign?.chaosBag || []).indexOf(token)
    if (campaignIndex >= 0) state.campaign.chaosBag.splice(campaignIndex, 1)
    return index >= 0
  }
  const add = () => {
    if (typeof api.addChaosToken === 'function') return api.addChaosToken(token)
    state.chaosBag ||= []
    state.chaosBag.push(token)
    if (Array.isArray(state.campaign?.chaosBag)) state.campaign.chaosBag.push(token)
    return true
  }
  return delta > 0 ? add() : remove()
}

/**
 * 序幕选择（intro 6 / intro 7）：影响混乱袋与时间标记。
 *   · 'trust'（接受福林安排）：移除 1 个 [elder_thing]，加入 1 个 [tablet]；标记 1 时间。
 *   · 'deception'（自行前往）：移除 1 个 [tablet]，加入 1 个 [elder_thing]；标记 2 时间。
 * 记录键 tskPrologueIntent 已存在时直接沿用（战役序章可先写入），否则询问领队。
 */
export function applyPrologueChoice(state, api = {}) {
  const existing = flagsOf(state)[FLAG_KEYS.prologueIntent] || null
  let intent = existing
  if (!intent) {
    const seat = leadSeat(state)
    const chooser = api.choose || api.choice
    const answer = typeof chooser === 'function'
      ? chooser.call(api, {
        kind: 'story', seat, source: 'tskPrologueIntro',
        prompt: '序幕：接受福林探员的安排（Intro 6），还是按自己的方式前往伦敦（Intro 7）？',
        options: [
          { id: 'trust', label: '接受他的提议（移除 1 个 [elder_thing]，加入 1 个 [tablet]；记 1 时间）' },
          { id: 'deception', label: '自行前往伦敦（移除 1 个 [tablet]，加入 1 个 [elder_thing]；记 2 时间）' },
        ],
      })
      : 'trust'
    intent = answer === 'deception' ? 'deception' : 'trust'
    flagsOf(state)[FLAG_KEYS.prologueIntent] = intent
  }
  if (intent === 'deception') {
    markTime(state, 2, api)
  } else {
    markTime(state, 1, api)
  }
  // 混乱袋在 setupChaosBag 里重建（顺序在 preScenarioSetup 之后）：由 afterChaosBagSetup 落地。
  return intent
}

/**
 * 序幕的混乱袋改动（intro 6 / intro 7）：
 *   trust → 删 1 [elder_thing]、加 1 [tablet]；deception → 删 1 [tablet]、加 1 [elder_thing]。
 * 只在混乱袋已建立后执行一次（引擎读点 afterChaosBagSetup；标记防止重复）。
 */
export function applyPrologueChaosBag(state, api = {}) {
  if (flagsOf(state).tskPrologueBagApplied === true) return false
  const intent = flagsOf(state)[FLAG_KEYS.prologueIntent] || null
  if (!intent) return false
  if (!Array.isArray(state.chaosBag) || !state.chaosBag.length) return false
  if (intent === 'deception') {
    adjustChaosBag(state, 'tablet', -1, api)
    adjustChaosBag(state, 'elderthing', 1, api)
    api.info?.('🙈 隐瞒催生不确定：混乱袋移除 1 个 [tablet]、加入 1 个 [elder_thing]。')
  } else {
    adjustChaosBag(state, 'elderthing', -1, api)
    adjustChaosBag(state, 'tablet', 1, api)
    api.info?.('🤝 信任源于天真：混乱袋移除 1 个 [elder_thing]、加入 1 个 [tablet]。')
  }
  flagsOf(state).tskPrologueBagApplied = true
  return true
}

/** 引擎读点（startScenario 在 setupChaosBag 之后调用）。 */
export function afterChaosBagSetup(state, events, api = {}) {
  void events
  applyPrologueChaosBag(state, api)
}

/** 引擎读点：startScenario 在布置前调用（preScenarioSetup）。 */
export function preScenarioSetup(state, events, api = {}) {
  void events
  applyPrologueChoice(state, api)
}

/**
 * 本章设置（指南 setup）：
 *   1. 放置伦敦雨街，其余地点放一边；
 *   2. 戴红手套的男子敌人与渡鸦之眼密钥放一边；
 *   3. 遭遇牌库 = gather 组里的诡计（Crimson Conspiracy / Outsiders 放一边）；
 *   4. 隐匿迷你卡池（诱饵 + 戴红手套的男子 + 结社特工 A/B/C）；
 *   5. 绯红密钥初始化、红色同志会乱入（状况报告 ε 之后）、空洞/隐匿场景扩展容器。
 */
export function setupScenario(state, api = {}) {
  state.scenarioFlags ||= {}
  state.scenarioZones ||= {}
  state.campaign ||= {}
  state.acts = structuredClone(scenario.acts)
  state.agendas = structuredClone(scenario.agendas)
  state.actIndex = 0
  state.agendaIndex = 0
  state.doom = 0
  state.round = 1
  state.locations = []
  state.enemies ||= []
  state.victoryDisplay ||= []
  state.encounterDiscard ||= []
  state.storyAssets ||= []

  zonesOf(state).setAside = [
    ...SET_ASIDE_LOCATION_IDS.map(id => LOCATIONS[id].originalCode),
    ...SET_ASIDE_ALIASES,
  ]
  placeLocationInPlay(state, START_LOCATION, api, { revealed: true })
  for (const inv of state.investigators || []) inv.location = START_LOCATION
  zonesOf(state).putIntoPlay = [START_LOCATION]

  state.encounterDeck = [...scenario.encounterDeck]

  // TSK 场景扩展容器（空洞区/隐匿区的宿主；子容器按需创建，读点不初始化）。
  tskScenarioState(state, true)

  const key = initializeEyeOfRavens(state, api)
  const coterie = injectRedCoterie(state, api)

  const decoyPool = CONCEALED_ENEMY_CODES.reduce((sum, code) => sum + concealedDecoysFor(code, state), 0)
  api.info?.(`🌧️ 谜雨：从「${LOCATIONS[START_LOCATION].name}」开始；放一边 ${setAside(state).length} 张，`
    + `遭遇牌库 ${state.encounterDeck.length} 张，隐匿迷你卡池 ${CONCEALED_ENEMY_CODES.length} 张真身 + ${decoyPool} 张诱饵。`)
  return {
    startLocation: START_LOCATION,
    placed: [...(zonesOf(state).putIntoPlay || [])],
    setAside: setAside(state).length,
    encounterDeck: state.encounterDeck.length,
    miniCardPool: { real: [...CONCEALED_ENEMY_CODES], decoys: decoyPool },
    keyInitialized: Boolean(key),
    coterieInjected: coterie?.code || null,
  }
}

export function setupLocations(state, events, helper = {}) {
  // 引擎传入的 helper 自带完整场景运行时（helper.api）：密钥/原语容器必须经它创建。
  const api = helper.api || { info: text => helper.info?.(state, events, text) }
  setupScenario(state, api)
  return []
}

export function setupEnemies() {}

// ---------------------------------------------------------------------------
// 地点钩子
// ---------------------------------------------------------------------------
/** 伦敦雨街 +X 隐藏值，X = 当前幕编号（1 起）。 */
export function locationShroudModifier(state, loc) {
  if (!loc || loc.id !== 'rainyLondonStreets') return 0
  return Number(state.actIndex || 0) + 1
}

export function cluesRemoved(state, loc, amount, api = {}) {
  void amount
  if (loc?.id !== 'rainyLondonStreets') return
  refillRainyLondonStreets(state, api)
}

export function locationRevealed(state, loc, api = {}) {
  if (loc?.id === 'rainyLondonStreets') refillRainyLondonStreets(state, api)
}

export function locationEntered(state, inv, loc, api = {}) {
  const placed = typeof loc === 'string' ? locationOf(state, loc) : loc
  void inv
  if (placed && placed.id === 'rainyLondonStreets') refillRainyLondonStreets(state, api)
  return true
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
function redGlovedManCode() {
  return RAW.redGlovedMan
}

function redGlovedManInPlay(state) {
  return (state.enemies || []).find(enemy => codeOf(enemy) === redGlovedManCode()) || null
}

function loseAllClues(state, api) {
  for (const inv of activeInvestigators(state)) {
    const clues = inv.clues || 0
    if (clues > 0) {
      if (typeof api.loseClues === 'function') api.loseClues(inv.seat, clues)
      else inv.clues = 0
    }
  }
  api.info?.('🕳️ 每位调查员失去其所有线索。')
}

/** 把遭遇牌库整体混洗（没有专门的 api 时用「取出再洗回」）。 */
export function shuffleEncounterDeck(state, api = {}) {
  const codes = [...(state.encounterDeck || [])]
  if (codes.length < 2) return codes.length
  if (typeof api.shuffleIntoEncounterDeck === 'function') {
    state.encounterDeck = []
    api.shuffleIntoEncounterDeck(codes)
  }
  return codes.length
}

/** 幕 1 背面「暗中移动」：放三处地点、领队抽戴红手套的男子并结算隐匿、直接推进到议程 2a。 */
export function resolveAct1Back(state, api = {}) {
  placeBackLocations(state, 'act1', api)
  const seat = leadSeat(state)
  const lead = state.investigators?.[seat] || state.investigators?.[0]
  distributeConcealedEnemy(state, redGlovedManCode(), { seat, locationId: lead?.location || START_LOCATION }, api)
  api.info?.('🌫️ 调查员领队抽取戴红手套的男子并结算其隐匿。')
  api.advanceAgendaTo?.(1)
  return { advancedAgendaTo: 1 }
}

/** 幕 2 背面「追逐开始！」：把戴红手套的男子放一边、放塔桥与伦敦塔、洗入两组、直接推进议程 3a。 */
export function resolveAct2Back(state, api = {}) {
  setRedGlovedManAside(state, api)
  placeBackLocations(state, 'act2', api)
  shuffleGroupsIntoDeck(state, GATHER_SET_ASIDE_GROUPS, api, { includeDiscard: true })
  api.advanceAgendaTo?.(2)
  return { advancedAgendaTo: 2 }
}

/** 幕 3 背面「他在这儿！」：塔楼牢房入场、渡鸦之眼附属、迷你卡与戴红手套的男子都改在塔楼牢房。 */
export function resolveAct3Back(state, api = {}) {
  placeBackLocations(state, 'act3', api)
  attachKeyToLocation(state, L.towerPrison, api)
  const concealed = concealedApi(api, state)
  const cards = concealed.miniCards().map(card => ({ kind: card.kind, decoy: card.decoy }))
  for (const card of concealed.miniCards()) concealed.expose(card.id)
  if (cards.length) {
    const created = concealed.distribute({ cards, placements: [{ locationId: L.towerPrison, count: cards.length }], position: null })
    concealed.setInShadows(L.towerPrison, true)
    api.info?.(`🕯️ 场上 ${created?.length || cards.length} 张隐匿迷你卡移动到塔楼牢房。`)
  }
  const seat = leadSeat(state)
  distributeConcealedEnemy(state, redGlovedManCode(), { seat, locationId: L.towerPrison, only: [L.towerPrison] }, api)
  return { keyAt: 'towerPrison' }
}

/** 幕 4 背面「阴谋落空」：被击败 → 胜利区 + 结局 1；1/调查员 资源 → 胜利区 + 结局 2。 */
export function resolveAct4Back(state, api = {}) {
  const rglm = redGlovedManInPlay(state)
  const defeated = flagsOf(state).tskRedGlovedManDefeated === true
  const resources = parleyResources(rglm)
  const threshold = numInvestigators(state)
  if (defeated) {
    if (rglm) api.addEnemyToVictory?.(rglm)
    api.info?.('📖 阴谋落空：戴红手套的男子被击败（结局 1）。')
    api.finish?.('resolution1')
    return { resolution: 'resolution1' }
  }
  if (rglm && resources >= threshold) {
    api.addEnemyToVictory?.(rglm)
    api.info?.(`📖 阴谋落空：他身上的 ${resources} 资源达到 ${threshold}（结局 2）。`)
    api.finish?.('resolution2')
    return { resolution: 'resolution2' }
  }
  api.info?.('📖 阴谋落空：未满足任何结局条件（保持当前幕）。')
  return { resolution: null }
}

/** 议程 1 背面「脱离掌控」：恐慌、放三处地点、领队抽戴红手套的男子并结算隐匿、失去线索、直接推进幕 2a。 */
export function resolveAgenda1Back(state, api = {}) {
  for (const inv of activeInvestigators(state)) {
    if (typeof api.horror === 'function') api.horror(inv.seat, 1)
  }
  api.info?.('😱 每位调查员受到 1 点恐惧。')
  placeBackLocations(state, 'agenda1', api)
  const seat = leadSeat(state)
  const lead = state.investigators?.[seat] || state.investigators?.[0]
  distributeConcealedEnemy(state, redGlovedManCode(), { seat, locationId: lead?.location || START_LOCATION }, api)
  loseAllClues(state, api)
  api.advanceActDirectly?.()
  return { advancedActTo: 1 }
}

/** 议程 2 背面「他逃了！」：记 1 时间、迷你卡与戴红手套的男子放一边、放塔桥与伦敦塔、
 *  洗入两组、每位调查员失去线索、直接推进幕 3a。 */
export function resolveAgenda2Back(state, api = {}) {
  markTime(state, 1, api)
  setRedGlovedManAside(state, api)
  clearConcealedMiniCards(state, api)
  placeBackLocations(state, 'agenda2', api)
  shuffleGroupsIntoDeck(state, GATHER_SET_ASIDE_GROUPS, api, { includeDiscard: true })
  loseAllClues(state, api)
  api.advanceActDirectly?.()
  return { advancedActTo: 2 }
}

/** 议程 3 背面「神秘身形」：领队二选一（找结社特工抽出来 / 每人 1 伤害 1 恐惧）。 */
export function resolveAgenda3Back(state, api = {}) {
  const seat = leadSeat(state)
  const agentCode = firstCoterieAgentInDeckOrDiscard(state)
  const options = []
  if (agentCode) options.push({ id: 'agent', label: `查找遭遇牌库/弃牌堆中的「${cardName(agentCode)}」并抽取（然后混洗遭遇牌库）` })
  options.push({ id: 'harm', label: '每位调查员受到 1 点伤害与 1 点恐惧' })
  const answer = typeof api.choose === 'function'
    ? api.choose({ kind: 'story', seat, source: 'tskAgendaTheConnection', prompt: '「神秘身形」：领队必须选择一项。', options })
    : options[0].id
  if (answer === 'agent' && agentCode) {
    api.takeEncounterCard?.(agentCode)
    api.shuffleIntoEncounterDeck?.([agentCode], { shuffle: false })
    api.drawEncounter?.(seat)
    shuffleEncounterDeck(state, api)
    api.info?.(`🔎 领队找出了「${cardName(agentCode)}」并抽取；遭遇牌库已混洗。`)
    return { choice: 'agent', code: agentCode }
  }
  for (const inv of activeInvestigators(state)) {
    if (typeof api.harm === 'function') api.harm(inv.seat, { damage: 1, horror: 1 })
  }
  api.info?.('💥 每位调查员受到 1 点伤害与 1 点恐惧。')
  return { choice: 'harm' }
}

/** 议程 4 背面「阴谋得逞」：幕 1–3 → 结局 4；幕 4 → 结局 3。 */
export function resolveAgenda4Back(state, api = {}) {
  const actNumber = Number(state.actIndex || 0) + 1
  if (actNumber >= 4) {
    api.info?.('📖 阴谋得逞：追寻到地窖（结局 3）。')
    api.finish?.('resolution3')
    return { resolution: 'resolution3' }
  }
  api.info?.(`📖 阴谋得逞：线索断了（当前幕 ${actNumber}，结局 4）。`)
  api.finish?.('resolution4')
  return { resolution: 'resolution4' }
}

function firstCoterieAgentInDeckOrDiscard(state) {
  const deck = state.encounterDeck || []
  const discard = state.encounterDiscard || []
  for (const code of RAW.coterieAgents) if (deck.includes(code) || discard.includes(code)) return code
  return null
}

/** 把戴红手套的男子（及其迷你卡）放回场外：敌人实例从场上移除。 */
export function setRedGlovedManAside(state, api = {}) {
  const enemy = redGlovedManInPlay(state)
  if (enemy) {
    if (typeof api.discardEnemy === 'function') api.discardEnemy(enemy)
    const index = state.enemies.indexOf(enemy)
    if (index >= 0) state.enemies.splice(index, 1)
    if (enemy.engagedSeat != null) {
      const engaged = state.investigators?.[enemy.engagedSeat]?.engaged || []
      const at = engaged.indexOf(enemy.id)
      if (at >= 0) engaged.splice(at, 1)
    }
  }
  clearConcealedMiniCards(state, api)
  api.info?.('🕳️ 戴红手套的男子与所有隐匿迷你卡放回场外。')
  return Boolean(enemy)
}

/** 把场上所有迷你卡放回场外（近似 4：原语揭露即取出）。 */
export function clearConcealedMiniCards(state, api = {}) {
  const concealed = concealedApi(api, state)
  const cards = concealed.miniCards()
  for (const card of cards) concealed.expose(card.id)
  if (cards.length) api.info?.(`🎭 ${cards.length} 张隐匿迷你卡放回场外。`)
  return cards.length
}

/** 把放一边的遭遇组（可选含弃牌堆）洗入遭遇牌库。 */
export function shuffleGroupsIntoDeck(state, groups, api = {}, { includeDiscard = false } = {}) {
  const wanted = new Set()
  for (const code of SET_ASIDE_GROUP_CODES) {
    if (groups.includes(groupOfCode(code))) wanted.add(code)
  }
  const moved = []
  // 同一卡号可能有印刷多份：全部从「放一边」取出（直到该卡号不再存在）。
  for (const code of [...wanted]) while (takeFromSetAside(state, code)) moved.push(code)
  if (includeDiscard) {
    for (const code of [...(state.encounterDiscard || [])]) {
      if (typeof api.takeEncounterCard === 'function') {
        if (api.takeEncounterCard(code, { pile: 'encounterDiscard' })) moved.push(code)
      } else {
        const index = state.encounterDiscard.indexOf(code)
        if (index >= 0) { state.encounterDiscard.splice(index, 1); moved.push(code) }
      }
    }
  }
  if (!moved.length) return []
  if (typeof api.shuffleIntoEncounterDeck === 'function') api.shuffleIntoEncounterDeck(moved)
  else state.encounterDeck = [...(state.encounterDeck || []), ...moved]
  api.info?.(`🌀 ${moved.length} 张遭遇卡洗入遭遇牌库（含 ${groups.join(' / ')} 遭遇组）。`)
  return moved
}

/** 共享组 camelCase id ↔ 卡表 encounterCode（卡号反查；与 card-data 的映射同源）。 */
export function groupOfCode(code) {
  const encounterCode = ALL_CARDS[code]?.encounterCode || ''
  return String(encounterCode).replace(/_([a-z])/g, (_, lower) => lower.toUpperCase())
}

/** 引擎读点（reveal.js#runActReveal）：幕背面。 */
export function actReveal(state, act, api = {}) {
  switch (codeOf(act)) {
    case RAW.actCluesAndCapers: resolveAct1Back(state, api); return true
    case RAW.actTheGameIsAfoot: resolveAct2Back(state, api); return true
    case RAW.actEyesInTheTower: resolveAct3Back(state, api); return true
    case RAW.actCaughtRedHanded: resolveAct4Back(state, api); return true
    default: return false
  }
}

/** 引擎读点（phases.js#runAgendaReveal）：议程背面 + 「毁灭移动到下一个密谋」。 */
export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  const carry = Number(flagsOf(state).tskDoomCarry || 0)
  delete flagsOf(state).tskDoomCarry
  const finish = result => {
    // 印刷强制：「在本密谋推进时：将上面所有的毁灭标记移动到下一个密谋。」
    // clearDoomInPlay 已在 reveal 之前清空，这里把本次推进前的毁灭放回密谋计数器。
    if (carry > 0 && state.status === 'playing') {
      state.doom = carry
      api.info?.(`🌑 「${cardName(code)}」上的 ${carry} 个毁灭移动到下一个密谋。`)
    }
    return result
  }
  switch (code) {
    case RAW.agendaWhenItRains: finish(resolveAgenda1Back(state, api)); return true
    case RAW.agendaFiguresInTheFog: finish(resolveAgenda2Back(state, api)); return true
    case RAW.agendaTheConnection: finish(resolveAgenda3Back(state, api)); return true
    case RAW.agendaPlotsAndPanic: finish(resolveAgenda4Back(state, api)); return true
    default: return false
  }
}

/** 引擎读点（act-agenda.js#advanceAgenda）：推进前记下要搬去下一张议程的毁灭。 */
export function agendaAdvancing(state) {
  const doom = Number(state.doom) || 0
  if (doom > 0) flagsOf(state).tskDoomCarry = doom
}

/** 敌人在谈判中累积的「资源」：`enemy.resources` 或通用卡计数器 `bounty`（近似 6）。 */
export function parleyResources(enemy) {
  if (!enemy) return 0
  return Math.max(Number(enemy.resources || 0), cardCounterOf(enemy, 'bounty'))
}

/**
 * 目标判定：
 *   · 幕 2：任一调查员与戴红手套的男子交战 → 推进；
 *   · 幕 4：他被击败，或其上有 1/调查员 资源 → 推进。
 */
export function actObjectiveMet(state) {
  const actIndex = Number(state.actIndex || 0)
  const rglm = redGlovedManInPlay(state)
  if (actIndex === 1) {
    const engaged = Boolean(rglm && rglm.engagedSeat != null
      && !state.investigators?.[rglm.engagedSeat]?.defeated
      && !state.investigators?.[rglm.engagedSeat]?.resigned)
    return { met: engaged, reason: engaged ? 'engagedRedGlovedMan' : null }
  }
  if (actIndex === 3) {
    const defeated = flagsOf(state).tskRedGlovedManDefeated === true
      || (state.victoryDisplay || []).some(card => codeOf(card) === redGlovedManCode())
    if (defeated) return { met: true, reason: 'defeated' }
    if (rglm && parleyResources(rglm) >= numInvestigators(state)) return { met: true, reason: 'parleyResources' }
    return { met: false, reason: null }
  }
  return { met: false, reason: null }
}

export function checkObjectives(state, api = {}) {
  if (state.status && state.status !== 'playing') return false
  if (!actObjectiveMet(state).met) return false
  api.advanceAct?.()
  return true
}

// ---------------------------------------------------------------------------
// 敌人钩子
// ---------------------------------------------------------------------------
/** 引擎读点：敌人被击败。戴红手套的男子记下「已被击败」，胜利区入账交给默认结算。 */
export function enemyDefeated(state, enemy) {
  if (codeOf(enemy) !== redGlovedManCode()) return false
  flagsOf(state).tskRedGlovedManDefeated = true
  return false
}

/** 引擎读点：敌人交战。幕 2 目标「如果调查员与戴红手套的男子交战，推进」。 */
export function enemyEngaged(state, enemy, inv, api = {}) {
  void inv
  if (codeOf(enemy) !== redGlovedManCode()) return
  if (Number(state.actIndex || 0) === 1) checkObjectives(state, api)
}

/** 引擎读点：敌人入场（戴红手套的男子自带反击；定义已从卡文解析）。 */
export function enemySpawned() {}

/**
 * 「Concealed X」入场：真正抽到时把该敌人放进阴影（迷你卡分配），不生成实体。
 * 引擎的生成入口在生成失败分支里调用 spawnFailed，因此这里成对声明。
 */
export function spawnForbiddenAt(state, code) {
  if (flagsOf(state).tskExposingConcealed === code) return false
  return concealedDecoysFor(code, state) > 0
}

export function spawnFailed(state, code, engagedSeat, api = {}) {
  if (!concealedDecoysFor(code, state)) return
  // 引擎在生成失败时把牌放进遭遇弃牌堆；阴影中的敌人应留在场外，改由迷你卡代表。
  const discard = state.encounterDiscard || []
  const index = discard.lastIndexOf(code)
  if (index >= 0) discard.splice(index, 1)
  const seat = Number.isSafeInteger(engagedSeat) ? engagedSeat : leadSeat(state)
  distributeConcealedEnemy(state, code, { seat, locationId: state.investigators?.[seat]?.location }, api)
  const doomOnEnter = Number(/enters the shadows:.*?Place (\d+) doom/i.exec(String(ALL_CARDS[code]?.text || ''))?.[1] || 0)
  if (doomOnEnter > 0) {
    flagsOf(state).tskShadowDoom = (Number(flagsOf(state).tskShadowDoom) || 0) + doomOnEnter
    api.info?.(`🕯️ 「${cardName(code)}」进入阴影：其上放置 ${doomOnEnter} 个毁灭。`)
  }
}

// ---------------------------------------------------------------------------
// 混乱标记 / 检定
// ---------------------------------------------------------------------------
/** 引擎读点（treachery-tokens.js#resolveSpecialToken）：四档 symbol 数值与「再揭示一个」。 */
export function resolveChaosToken(state, inv, token, api = {}) {
  const concealedHere = concealedApi(api, state).at(inv?.location || '').length > 0
  return riddlesChaosTokenOutcome(state, inv, token, { concealedHere })
}

/** 引擎读点（tests.js#afterTest）：[elder_thing] 失败后果 + 渡鸦之眼稳定面的翻面。 */
export function afterTest(state, inv, result, api = {}, extras = {}) {
  const applied = []
  if (result && !result.success) {
    const tokens = extras.resolvedTokens || result.resolvedTokens || result.drawn || []
    const failedBy = Number(extras.test?.failedBy
      ?? result.failedBy
      ?? Math.max(0, Number(result.difficulty || 0) - Number(result.value || 0))) || 0
    if (tokens.includes('elderthing')) {
      const spec = riddlesElderThingFailureSpec(state, inv, 'elderthing', failedBy)
      if (spec) {
        const hasShadows = shadowsEnemies(state, api).length > 0
        const canSpendClue = (inv.clues || 0) > 0
        let choice = null
        if (canSpendClue && !hasShadows) choice = 'spendClue'
        else if (hasShadows && !canSpendClue) choice = 'doomOnShadowEnemy'
        else if (canSpendClue && hasShadows) {
          const answer = typeof api.choose === 'function'
            ? api.choose({ kind: 'story', seat: inv.seat, source: 'tskElderThing',
              prompt: '[elder_thing]：你必须花费 1 个线索，或在阴影中的一个敌人上放置 1 个毁灭。',
              options: [
                { id: 'clue', label: '花费 1 个线索' },
                { id: 'doom', label: '在阴影中的一个敌人上放置 1 个毁灭' },
              ] })
            : 'clue'
          choice = answer === 'doom' ? 'doomOnShadowEnemy' : 'spendClue'
        }
        if (choice === 'spendClue') {
          api.spendClues?.(inv.seat, 1)
          applied.push({ token: 'elderthing', choice })
          api.info?.('[elder_thing]：花费 1 个线索。')
        } else if (choice === 'doomOnShadowEnemy') {
          flagsOf(state).tskShadowDoom = (Number(flagsOf(state).tskShadowDoom) || 0) + 1
          applied.push({ token: 'elderthing', choice })
          api.info?.('[elder_thing]：在阴影中的一个敌人上放置 1 个毁灭。')
        }
      }
    }
  }
  // 渡鸦之眼（稳定面）：「在你地点的技能检定期间 …… 将本钥匙翻至动荡面。」
  const keyLocation = keyLocationOf(state)
  if (keyLocation && inv && keyLocation === inv.location && keyFaceOf(state, api) === KEY_CODES.stable) {
    const shifted = resolveKeyShift(state, { by: 'investigator', seat: inv.seat, api })
    if (shifted?.flipped) applied.push({ key: KEY_ID, shifted: true })
  }
  return applied
}

/** 「查看某张迷你卡的已揭示面」（近似 3：用一次性 choice 展示，没有私密通道）。 */
export function peekMiniCard(state, id, seat, api = {}) {
  const card = concealedApi(api, state).byId(id)
  if (!card) return null
  const code = concealedCodeOf(card.kind)
  const label = card.decoy ? '诱饵（不是敌人）' : `「${cardName(code)}」`
  if (typeof api.choose === 'function') {
    api.choose({ kind: 'card', seat, source: 'tskPeekConcealed',
      prompt: '你查看了这张隐匿迷你卡的已揭示面（不将其揭露）。', options: [{ id: 'done', label }] })
  }
  return { id, kind: card.kind, decoy: card.decoy === true, code }
}

/** 渡鸦之眼（稳定面）：「基础技能值设为 6」——检定进行中按修正差值补足（近似 2）。 */
export function statModifier(state, inv, skill) {
  const keyLocation = keyLocationOf(state)
  if (!keyLocation || !inv || inv.location !== keyLocation) return 0
  if (keyFaceOf(state) !== KEY_CODES.stable) return 0
  const test = state.skillTest
  if (!test || test.seat !== inv.seat) return 0
  const testSkills = Array.isArray(test.skill) ? test.skill : [test.skill]
  if (!testSkills.includes(skill)) return 0
  const value = Number(registeredEntry(KEY_CODES.stable)?.flags?.keyShift?.effect?.value ?? 6)
  return Math.max(0, value - (Number(inv[skill]) || 0))
}

// ---------------------------------------------------------------------------
// 剧本行动（地点能力）
// ---------------------------------------------------------------------------
const SKILL_LABELS = Object.freeze({ willpower: '意志', intellect: '智力', combat: '战斗', agility: '敏捷' })
// 地点运行时 id（与印刷卡号不同：卡号只用于 setAside/定义源码，动作读点一律用 id）。
const L = Object.freeze({
  rainy: 'rainyLondonStreets',
  bigBen: 'bigBen',
  abbey: 'westminsterAbbey',
  kensington: 'kensingtonGardens',
  towerBridge: 'towerBridge',
  traitorsGate: 'traitorsGate',
  towerOfLondon: 'towerOfLondon',
  towerPrison: 'towerPrison',
})

const skillLabel = skill => SKILL_LABELS[skill] || skill
const usedThisRound = (state, key) => Number(flagsOf(state)[key] || 0) === Number(state.round || 0)
const markRoundUse = (state, key) => { flagsOf(state)[key] = Number(state.round || 0) }

/** 地点 / 章节行动枚举（moves.js#legalMoves → scenarioAction；无 api 参数，只读状态）。 */
export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const moves = []
  const here = inv.location
  if (here === L.rainy) {
    moves.push({
      action: 'scenarioAction', rule: 'riddlesResign', actions: 1,
      label: '🚪 撤退：「我们应该等等福林探员……」',
    })
  }
  if (here === L.abbey) {
    const used = flagsOf(state).tskAbbeyParleyUsed === true
    moves.push({
      action: 'scenarioAction', rule: 'abbeyParley', actions: 1,
      label: '⛪ 谈判 意志(1)：在修道院周围打听（团队每场游戏一次）',
      reason: used ? '本场游戏已经打听过了（团队每场游戏仅限一次）' : null,
      used: used || undefined,
      disabled: used || undefined,
    })
  }
  if (here === L.towerBridge) {
    moves.push({
      action: 'scenarioAction', rule: 'towerBridgeWayIn', actions: 1,
      label: '🌉 另寻入口：检定意志或智力(5)，成功放置叛徒之门',
    })
  }
  if (here === L.traitorsGate) {
    moves.push({
      action: 'scenarioAction', rule: 'traitorsGateReveal', actions: 1,
      label: '🚪 检定战斗或敏捷(5)：成功揭示伦敦塔，失败受到 1 点伤害',
    })
  }
  // 大厅预览/战役开局阶段地点实例尚未建立：先确认地点存在再读隐匿迷你卡。
  const concealedHere = here && (state.locations || []).some(location => location.id === here)
    ? concealedAtCards(state, here).length : 0
  if (concealedHere > 0) {
    moves.push({
      action: 'scenarioAction', rule: 'exposeMiniCard', actions: 1,
      label: `👁️ 揭露一个隐匿迷你卡（${LOCATIONS[here]?.name || here}，${concealedHere} 张）`,
    })
  }
  return moves
}

/** 快速（[fast]）地点能力：大本钟窥视 / 塔楼牢房花费线索加值。 */
export function fastActions(state, inv, timing) {
  if (!inv || inv.defeated || inv.resigned) return []
  const moves = []
  if (inv.location === L.bigBen && !usedThisRound(state, 'tskBigBenPeekRound')) {
    moves.push({
      action: 'scenarioAction', rule: 'bigBenPeek', actions: 0, fast: true,
      label: '⏰ 快速：查看大本钟或连接地点的一张隐匿迷你卡（敏捷 2，每回合一次）',
    })
  }
  const test = state.skillTest
  if (test && String(timing || '').startsWith('test.') && !test.fastClueSpent
    && state.investigators?.[test.seat]?.location === L.towerPrison
    && (inv.clues || 0) > 0) {
    moves.push({
      action: 'scenarioAction', rule: 'towerPrisonClue', actions: 0, fast: true,
      label: '🔑 快速：花费 1 个线索，检定者本次技能值 +2（塔楼牢房）',
    })
  }
  return moves
}

/** 引擎读点（dispatch.js）：剧本行动结算。 */
export function performAction(state, inv, move, api = {}) {
  if (!move) return false
  switch (move.rule) {
    case 'riddlesResign': return doResign(state, inv, api)
    case 'abbeyParley': return doAbbeyParley(state, inv, api)
    case 'towerBridgeWayIn': return doTowerBridge(state, inv, api)
    case 'traitorsGateReveal': return doTraitorsGate(state, inv, api)
    case 'bigBenPeek': return doBigBenPeek(state, inv, api)
    case 'towerPrisonClue': return doTowerPrisonClue(state, inv, api)
    case 'exposeMiniCard': return doExpose(state, inv, move, api)
    default: return false
  }
}

function doResign(state, inv, api) {
  if (typeof api.resign === 'function') {
    api.resign(inv.seat)
    return true
  }
  inv.resigned = true
  api.info?.(`🚪 ${inv.name || '调查员'} 在伦敦雨街撤退，等待福林探员。`)
  return true
}

function chooseSkill(state, inv, skills, api, prompt) {
  if (skills.length === 1) return skills[0]
  const answer = typeof api.choose === 'function'
    ? api.choose({ kind: 'choice', seat: inv.seat, source: 'tskSkillChoice', prompt,
      options: skills.map(skill => ({ id: skill, label: skillLabel(skill) })) })
    : skills[0]
  return skills.includes(answer) ? answer : skills[0]
}

function doAbbeyParley(state, inv, api) {
  if (flagsOf(state).tskAbbeyParleyUsed === true) {
    api.info?.('本场游戏已经打听过了（团队每场游戏仅限一次）。')
    return false
  }
  const candidates = (state.locations || []).filter(location => location.revealed !== false
    && concealedApi(api, state).at(location.id).length > 0)
  if (!candidates.length) {
    api.info?.('没有可打听的地点：场上没有带隐匿迷你卡的地点。')
    return false
  }
  const chosen = typeof api.choose === 'function'
    ? api.choose({ kind: 'location', seat: inv.seat, source: 'tskAbbeyParley',
      prompt: '选择一个地点，在修道院周围打听该处的隐匿迷你卡。',
      options: candidates.map(location => ({ id: location.id, label: location.name || location.id })) })
    : candidates[0].id
  const locationId = candidates.some(location => location.id === chosen) ? chosen : candidates[0].id
  flagsOf(state).tskAbbeyParleyUsed = true
  api.test?.(inv.seat, 'willpower', 1, result => {
    if (!result?.success) return
    const margin = Math.max(1, Number(result.value || 0) - Number(result.difficulty || 1))
    const cards = concealedApi(api, state).at(locationId)
    for (let index = 0; index < Math.min(margin, cards.length); index += 1) {
      peekMiniCard(state, cards[index].id, inv.seat, api)
    }
    api.info?.(`⛪ 修道院打听：查看「${LOCATIONS[locationId]?.name || locationId}」${Math.min(margin, cards.length)} 张迷你卡。`)
  }, 0, { type: 'scenario', action: 'parley', code: RAW.westminsterAbbey, ability: true })
  return true
}

function doTowerBridge(state, inv, api) {
  const gateCode = LOCATIONS[L.traitorsGate].originalCode
  if (!setAside(state).includes(gateCode) && !locationOf(state, L.traitorsGate)) {
    api.info?.('叛徒之门已不在场外。')
    return false
  }
  const skill = chooseSkill(state, inv, ['willpower', 'intellect'], api, '选择技能（意志或智力）')
  api.test?.(inv.seat, skill, 5, result => {
    if (!result?.success) return
    placeLocationInPlay(state, L.traitorsGate, api, { revealed: true })
    api.info?.('🚪 「兴许还有另一条路……」叛徒之门放置入场。')
  }, 0, { type: 'scenario', code: RAW.towerBridge, ability: true })
  return true
}

function doTraitorsGate(state, inv, api) {
  const skill = chooseSkill(state, inv, ['combat', 'agility'], api, '选择技能（战斗或敏捷）')
  api.test?.(inv.seat, skill, 5, result => {
    if (result?.success) {
      if (!locationOf(state, L.towerOfLondon)) placeLocationInPlay(state, L.towerOfLondon, api, { revealed: false })
      api.reveal?.(L.towerOfLondon)
      api.info?.('🏰 叛徒之门：揭示伦敦塔。')
    } else {
      api.damage?.(inv.seat, 1)
      api.info?.('🚪 叛徒之门：检定失败，受到 1 点伤害。')
    }
  }, 0, { type: 'scenario', code: RAW.traitorsGate, ability: true })
  return true
}

function doBigBenPeek(state, inv, api) {
  if (usedThisRound(state, 'tskBigBenPeekRound')) {
    api.info?.('大本钟的这个能力每回合只能使用一次。')
    return false
  }
  const bigBen = locationOf(state, L.bigBen)
  const ids = new Set([L.bigBen, ...(bigBen?.connections || [])])
  const cards = [...ids].flatMap(id => concealedApi(api, state).at(id))
  if (!cards.length) {
    api.info?.('大本钟附近没有隐匿迷你卡。')
    return false
  }
  const chosen = typeof api.choose === 'function'
    ? api.choose({ kind: 'card', seat: inv.seat, source: 'tskBigBenPeek',
      prompt: '选择要查看（不揭露）的隐匿迷你卡（大本钟或其连接地点）。',
      options: cards.map((card, index) => ({ id: card.id,
        label: `隐匿迷你卡 ${index + 1}（${LOCATIONS[card.locationId]?.name || card.locationId}）` })) })
    : cards[0].id
  if (!cards.some(card => card.id === chosen)) return false
  markRoundUse(state, 'tskBigBenPeekRound')
  api.test?.(inv.seat, 'agility', 2, result => {
    if (result?.success) peekMiniCard(state, chosen, inv.seat, api)
    else {
      api.horror?.(inv.seat, 1)
      api.info?.('⏰ 大本钟：检定失败，受到 1 点恐惧。')
    }
  }, 0, { type: 'scenario', code: RAW.bigBen, ability: true })
  return true
}

function doTowerPrisonClue(state, inv, api) {
  const test = state.skillTest
  if (!test) return false
  if ((inv.clues || 0) < 1) {
    api.info?.('没有线索可以花费。')
    return false
  }
  api.spendClues?.(inv.seat, 1)
  test.fastClueSpent = true
  // 剧本运行时没有 addTestPendingBonus 入口：直接累加本次检定的 pendingBonus（tests.js ST.2 读取并清零）。
  if (typeof api.addTestPendingBonus === 'function') api.addTestPendingBonus(2)
  else test.pendingBonus = (Number(test.pendingBonus) || 0) + 2
  api.info?.('🔑 塔楼牢房：花费 1 个线索，本次检定技能值 +2。')
  return true
}

function doExpose(state, inv, move, api) {
  const id = move.miniCardId || move.cardId || move.targetId
  const result = exposeMiniCardAt(state, id, inv, api)
  return Boolean(result)
}

// ---------------------------------------------------------------------------
// 回合 / 轮末
// ---------------------------------------------------------------------------
/** 引擎读点（turn-flow.js#turnEnded）：伦敦塔「结束回合后必须失去 2 资源，或被阴影中的敌人攻击」。 */
export function turnEnded(state, inv, api = {}) {
  if (!inv || inv.location !== L.towerOfLondon) return
  const enemies = shadowsEnemies(state, api)
  const canPay = (inv.resources || 0) >= 2
  let choice = 'pay'
  if (enemies.length && canPay) {
    choice = typeof api.choose === 'function'
      ? api.choose({ kind: 'story', seat: inv.seat, source: 'tskTowerOfLondon',
        prompt: '在伦敦塔结束回合：失去 2 资源，或让阴影中的每个敌人攻击你。',
        options: [
          { id: 'pay', label: '失去 2 资源' },
          { id: 'attack', label: `让阴影中的 ${enemies.length} 个敌人攻击你` },
        ] })
      : 'pay'
  } else if (enemies.length) {
    choice = 'attack'
  }
  if (choice === 'attack') {
    shadowsAttack(state, inv.seat, api)
    return
  }
  if (canPay) {
    api.loseResources?.(inv.seat, 2)
    api.info?.(`🏰 伦敦塔：${inv.name || '调查员'} 失去 2 资源。`)
  }
}

/** 引擎读点（phases.js#roundEnded）：轮末重排隐匿迷你卡位置。 */
export function roundEnded(state, api = {}) {
  const concealed = concealedApi(api, state)
  if (concealed.miniCards().length > 1) concealed.reshuffle({})
  refillRainyLondonStreets(state, api)
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
function bearerSeatChoice(state, api, prompt) {
  const active = activeInvestigators(state)
  if (!active.length) return null
  if (active.length === 1) return active[0].seat
  const answer = typeof api.choose === 'function'
    ? api.choose({ kind: 'investigator', seat: leadSeat(state), source: 'tskEyeOfRavensBearer',
      prompt, options: active.map(inv => ({ id: String(inv.seat), label: inv.name || `调查员 ${inv.seat + 1}` })) })
    : String(active[0].seat)
  const seat = Number(answer)
  return active.some(inv => inv.seat === seat) ? seat : active[0].seat
}

function bindEyeOfRavens(state, bearer, api) {
  const namespace = keysApi(api)
  if (!namespace) return null
  try {
    namespace.bind(KEY_ID, bearer)
    return bearer
  } catch (error) {
    api.info?.(`⚠️ 渡鸦之眼绑定失败：${error.message}`)
    return null
  }
}

/**
 * 结局记录（引擎读点 campaign-flow.js#applyResolutionEffects → behavior.resolution）：
 *   · 经验 = 胜利区 Victory X（引擎默认发放，这里不加成）；
 *   · 结局 1/2：选择一位调查员成为渡鸦之眼的持有者；结局 3/4：戴红手套的男子持有；
 *   · 所有结局：记录「恩怨未了」并标记时间（结局 1/2/3 记 1，结局 4 记 2）。
 */
export function scenarioResolution(state, key = 'resolution1', events = [], api = {}) {
  void events
  const resolvedKey = ['resolution1', 'resolution2', 'resolution3', 'resolution4'].includes(key) ? key : 'resolution4'
  markChapterCompleted(state, CHAPTER_ID, api)
  let bearer = null
  if (resolvedKey === 'resolution1' || resolvedKey === 'resolution2') {
    const seat = bearerSeatChoice(state, api,
      `结局 ${resolvedKey === 'resolution1' ? 1 : 2}：选择一位调查员成为渡鸦之眼的持有者。`)
    if (seat != null) {
      bearer = bindEyeOfRavens(state, { type: 'investigator', seat }, api) ? `investigator:${seat}` : null
      if (bearer) api.info?.(`🗝️ 渡鸦之眼由 ${state.investigators?.[seat]?.name || `调查员 ${seat + 1}`} 持有。`)
    }
  } else {
    // 结局 3/4：戴红手套的男子持有渡鸦之眼（他在场时绑定实体，否则只记持有者）。
    const enemy = redGlovedManInPlay(state)
    bearer = 'redGlovedMan'
    if (enemy) bindEyeOfRavens(state, { type: 'enemy', enemyId: enemy.id }, api)
    api.info?.('🗝️ 渡鸦之眼由戴红手套的男子持有。')
  }
  // 结局 1/2：调查员持有渡鸦之眼（keysHeld 记入）；结局 3/4：戴红手套的男子持有（队伍失去它）。
  // 结局键与持有者由 flowData 交给 campaign-flow（campaign.flowPayload），不再写章节标记。
  setKeyHeld(state, KEY_ID, resolvedKey === 'resolution1' || resolvedKey === 'resolution2', api)
  markTime(state, resolvedKey === 'resolution4' ? 2 : 1, api)
  attachKeyToLocation(state, null, api)
  api.info?.(`📖 谜雨结局：${resolvedKey}；渡鸦之眼持有者 ${bearer || '未定'}；`
    + `Time Passed 累计 ${timePassed(state)}。`)
  return {
    key: resolvedKey,
    bearer,
    timePassed: timePassed(state),
    flowData: { resolution: resolvedKey, eyeOfRavensBearer: bearer },
  }
}

// ---------------------------------------------------------------------------
// 2026-11-13 P1-11：伦敦塔（09516）进入费用；伦敦塔监狱（09517）隐匿迷你卡落点重定向。
// ---------------------------------------------------------------------------
function cluePoolAt(state, locationId) {
  return activeInvestigators(state).filter(inv => inv.location === locationId)
    .reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
}

/** 09516 背面：塔桥的调查员作为一个团队花费 2[每人] 线索才能进入伦敦塔。 */
export function moveError(state, inv, location, id) {
  const destination = typeof id === 'string' ? id : (id ?? location?.id)
  if (destination !== 'towerOfLondon' || inv?.location !== 'towerBridge') return null
  const required = 2 * numInvestigators(state)
  const pool = cluePoolAt(state, 'towerBridge')
  if (pool < required) {
    return `进入伦敦塔：塔桥的调查员需作为一个团队花费 ${required} 个线索（当前 ${pool} 个）`
  }
  return null
}

export function beforeMove(state, inv, destination, api = {}) {
  const destinationId = typeof destination === 'string' ? destination : destination?.id
  if (destinationId !== 'towerOfLondon' || inv?.location !== 'towerBridge') return true
  const required = 2 * numInvestigators(state)
  let remaining = required
  for (const other of activeInvestigators(state).filter(item => item.location === 'towerBridge')) {
    if (remaining <= 0) break
    const spend = Math.min(Number(other.clues) || 0, remaining)
    if (spend <= 0) continue
    other.clues = (Number(other.clues) || 0) - spend
    remaining -= spend
  }
  if (remaining > 0) return false
  api?.info?.(`进入伦敦塔：塔桥的调查员共同花费 ${required} 个线索。`)
  return true
}

/** 09517 强制：隐匿迷你卡要进入其它地点时，改为进入伦敦塔监狱。 */
export function redirectConcealedLocation(state, locationId) {
  if (locationId === 'towerPrison') return locationId
  const prison = (state.locations || []).find(location => location.id === 'towerPrison')
  return prison ? 'towerPrison' : locationId
}

// ---------------------------------------------------------------------------
// 行为对象（引擎按注册的关卡行为调用）
// ---------------------------------------------------------------------------
export const behavior = {
  id: CHAPTER_ID,
  preScenarioSetup,
  setupScenario,
  setupLocations,
  setupEnemies,
  // 地点
  locationShroudModifier,
  cluesRemoved,
  locationRevealed,
  locationEntered,
  // 幕 / 议程
  actReveal,
  agendaReveal,
  agendaAdvancing,
  actObjectiveMet,
  checkObjectives,
  // 敌人 / 隐匿
  moveError,
  beforeMove,
  redirectConcealedLocation,
  enemyDefeated,
  enemyEngaged,
  enemySpawned,
  spawnForbiddenAt,
  spawnFailed,
  // 混乱 / 检定
  resolveChaosToken,
  afterTest,
  statModifier,
  // 行动
  actions,
  fastActions,
  performAction,
  turnEnded,
  roundEnded,
  // 结局
  resolution: scenarioResolution,
  scenarioResolution,
  // 背面结算与设置辅助（测试/战役流程可直接调用同一份实现）
  resolveAct1Back,
  resolveAct2Back,
  resolveAct3Back,
  resolveAct4Back,
  resolveAgenda1Back,
  resolveAgenda2Back,
  resolveAgenda3Back,
  resolveAgenda4Back,
  resolveKeyShift,
  distributeConcealedEnemy,
  exposeMiniCardAt,
  placeLocationInPlay,
  attachKeyToLocation,
  initializeEyeOfRavens,
  keyFaceOf,
  applyPrologueChoice,
  applyPrologueChaosBag,
  afterChaosBagSetup,
  markTime,
  // 展示（describe.js 读点）：放一边 / 阴影 / 密钥的公开读数
  describe(state) {
    const lines = []
    const aside = setAside(state).length
    if (aside) lines.push(`放一边 ${aside} 张（${SET_ASIDE_LOCATION_IDS.map(id => LOCATIONS[id]?.name || id).join('、')} 等）`)
    const shadows = shadowsEnemies(state).length
    if (shadows) lines.push(`阴影中的敌人 ${shadows} 个（迷你卡 ${concealedTotal(state)} 张）`)
    const keyLocation = keyLocationOf(state)
    if (keyLocation) lines.push(`渡鸦之眼在「${LOCATIONS[keyLocation]?.name || keyLocation}」`)
    return lines
  },
  tokenMeanings: scenario.tokenMeanings,
  setupText: SCENARIO_TEXT.setup,
}

export const implementedEntryCodes = Object.freeze(['09518', KEY_CODES.stable, KEY_CODES.unstable])
