// 最终日黎明（dawnOfTheFinalDay · 序曲 3 · 10679a）· 章节流程钩子。
//
// 参考实现：Scenario/Scenarios/TheFeastOfHemlockVale/PreludeDawnOfTheFinalDay.hs（逐条镜像）：
//   PreScenarioSetup         → 开场 Intro 1/2（读 Dr. Marquez has a plan）+ Intro 3（半数经验、疲劳）
//   Setup                    → gather 5 组 / 第 3 日 / 幕议程 / 8 地点 / 居民 / 放一边 / 毁灭
//   ScenarioSpecific "codex" → 法典 1/2/4/5/6/7/8/9/10/11/13/14/15/16（`readCodex`）
//   PassedThisSkillTest      → 成功藏好烟花 → 在 The plan is underway 记 1 道 tally
//   ScenarioResolution       → noResolution / resolution1 / resolution2（后两者只有一个结算页）
//   EndOfScenario            → 从「Areas Surveyed」未勾选的区域里选下一次勘察
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   introduction / preScenarioSetup → 开场分支、日期（第 3 日白昼）、疲劳标记降级
//   setupLocations → 8 处地点（返回给引擎逐张 placeLocation；图标连接来自 definition）
//   afterDeckSetup → 第三日时间标记、Mother Rachel / Judith Park 入场（资产面）与放一边/移出
//   actions + performAction / actionKind → 地点法典行动与居民谈判（规则写在 behavior，供共享卡复用）
//   actReveal → 幕 1 背面 The Bliss（1 点精神创伤或随机基础疯狂弱点 + 2 点奖励经验）
//   agendaReveal → 议程 1 背面 Bertie's Choice（有 epiphany → Resolution 2，否则 Resolution 1）
//   checkObjectives → 幕目标「Talk to the locals」没有可计量条件（参考实现同样没有 AdvanceAct）
//   resolveChaosToken / chaosTokenValue → 提示卡 10704 四档（谈判自动成功 / 再揭示一枚）
//   resolution / storyResolutionKey → 结局记录、烟花、勘察整备与下一次勘察候选
//
// 写入口径：战斗/检定/选择/资源/创伤/弱点/生成/勘察整备一律走 `api.*`；战役记录与居民关系在
// api 缺省时回退 P2 原语（scenario-calendar.js / resident-record.js），与兄弟章节同一口径。
// 本序曲**没有本章专属单卡条目**（全部规则在 definition/behavior）；共享的 The Vale / Day of the
// Feast / Residents 卡由各自 worker 落条目，卡面规则读点见 `implementedEntryFlags`。
import { spliceHand } from '../../../../../src/engine/hand-icons.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { changeRelationship, changeResidentNote } from '../../../../../src/engine/resident-record.js'
// 战役层（records.js）是记录键/勘察/居民笔记的权威读点；本文件只读它，不写共享文件。
import { areaSurveyed, residentNotes as campaignResidentNotes } from '../../records.js'
import { scenarioDate, setScenarioDate } from '../../../../../src/engine/scenario-calendar.js'
import { chooseSurveyDestination, surveyForDestination } from '../../../../../src/engine/survey-preparation.js'
import {
  CHAOS_TOKEN_FACES, FATIGUE_REPLACEMENT_COUNT, fatigueReplacementPlan, isHardSide, lowerChaosToken,
  normalizeTokenFace, preludeChaosToken, preludeChaosTokenValue,
} from './chaos.js'
import {
  ACT_CODES, ACT1_CODE, AGENDA_CODES, AGENDA1_CODE, ACT_STAGES, AGENDA_STAGES,
  CODEX_BY_NUMBER, CODEX_ENTRIES, CODEX_IDS,
  ENCOUNTER_DECK, FRENZIED_REVELER_CODE, GATHER_GROUPS, GATHER_SET_ASIDE_GROUPS, HEIRLOOM_CODES,
  IN_PLAY_CARDS, LOCATIONS, LOCATION_CONNECTIONS, LOCATION_IDS, MIASMATIC_SHADOW_CODE,
  RECORD_KEYS, REMOVED_CARDS, REMOVED_LOCATION_CODES, REMOVED_STAGE_CODES,
  RESIDENT_BY_ASSET_CODE, RESIDENT_BY_ENEMY_CODE, RESIDENT_BY_KEY, RESIDENT_ENTRY_LOCATIONS,
  RESIDENT_MAX_LEVEL, RESIDENT_RECORDS, RESIDENTS_IN_PLAY_AT_START, RESIDENTS_SET_ASIDE_CARDS,
  RESIDENT_SPECS, RESOLUTION_KEYS, RESOLUTION_RECORD,
  SCENARIO_TEXT, SET_ASIDE_CARDS, START_LOCATION, SURVEY_DESTINATIONS,
  TIME_MARKER_CODE, TIME_MARKER_CODES, scenario,
} from './definition.js'

const CHAPTER_ID = 'dawnOfTheFinalDay'

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------
const clone = value => (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)))
const codeOf = value => String(value?.originalCode || value?.code || value || '')
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const info = (api, message) => api?.info?.(message)
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
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
const activeInvestigators = state => (state?.investigators || [])
  .filter(inv => inv && !inv.defeated && !inv.resigned)
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const storyAssetsOf = state => (state.storyAssets ||= [])
const cap = value => String(value).charAt(0).toUpperCase() + String(value).slice(1)
const mechanicsOf = api => api?.mechanics || api?.helper?.api?.mechanics || null

// ---------------------------------------------------------------------------
// 日期 / 开场分支
// ---------------------------------------------------------------------------
export function introBranchKey(state) {
  return recordsFor(state)[RECORD_KEYS.drMarquezHasAPlan] === true ? 'intro1' : 'intro2'
}
export const introSections = state => (introBranchKey(state) === 'intro1'
  ? ['prelude3.intro.intro1', 'prelude3.intro.intro3']
  : ['prelude3.intro.intro2', 'prelude3.intro.intro3'])

function dateOf(state) {
  const date = scenarioDate(state)
  if (date) return date
  const flags = flagsFor(state)
  const day = Number(flags.dawnOfTheFinalDayDay) || 3
  return { day, period: 'day' }
}

/** 开场正文（引擎 campaign/story.js#introduction 的章节钩子）。 */
export function introduction(sc, records = {}, context = null) {
  const state = context?.campaign ? context : { campaign: { records }, scenarioFlags: context?.scenarioFlags || {} }
  const branch = records[RECORD_KEYS.drMarquezHasAPlan] === true ? 'intro1' : 'intro2'
  const keys = branch === 'intro1'
    ? [SCENARIO_TEXT.intro.intro1, SCENARIO_TEXT.intro.intro3]
    : [SCENARIO_TEXT.intro.intro2, SCENARIO_TEXT.intro.intro3]
  const sections = []
  if (SCENARIO_TEXT.intro.title) {
    sections.push({ title: SCENARIO_TEXT.intro.title, paragraphs: [SCENARIO_TEXT.intro.checkCampaignLog] })
  }
  for (const text of keys) {
    if (text && text.trim()) sections.push({ title: undefined, paragraphs: text.split(/\n{2,}/).filter(Boolean) })
  }
  void state
  return {
    version: 3, title: sc?.name || scenario.name,
    sections: sections.map(section => ({ title: section.title, paragraphs: section.paragraphs })),
    paragraphs: sections.flatMap(section => section.paragraphs),
    code: ACT1_CODE,
  }
}

// ---------------------------------------------------------------------------
// 记录 / 居民关系 / Remember
// ---------------------------------------------------------------------------
export const isRemembered = (state, fact) => {
  const records = recordsFor(state)
  const store = records.remembered
  if (store && typeof store === 'object' && !Array.isArray(store) && store[fact] === true) return true
  if (Array.isArray(store) && store.includes(fact)) return true
  if (records[fact] === true) return true
  return (state.scenarioFlags?.remembered || []).includes(fact)
}

/** 「Remember that …」：records.remembered + 印刷复选框布尔键 + 引擎 remember 窗口（三写同口径）。 */
export function remember(state, fact, api = {}) {
  const records = recordsFor(state)
  records.remembered ||= {}
  let changed = records.remembered[fact] !== true
  records.remembered[fact] = true
  if (records[fact] !== true) {
    records[fact] = true
    changed = true
  }
  safeCall(api, 'remember', fact)
  if (changed) info(api, `记住：${SCENARIO_TEXT.remembered[fact] || fact}`)
  return changed
}

export function residentSpec(key) {
  return RESIDENT_BY_KEY[String(key)] || null
}

export function relationshipLevel(state, key) {
  const spec = RESIDENT_RECORDS[String(key)]
  if (!spec) return 0
  return Math.max(0, Number(recordsFor(state)[spec.level]) || 0)
}

/**
 * 关系等级调整：优先引擎 mechanics.residents.change，回退 P2 原语；与战役层
 * `interludes.js#increaseRelationship` 同口径地双写 `relationships[id]`。返回新等级。
 */
export function addRelationship(state, key, amount = 1, api = {}) {
  const spec = RESIDENT_RECORDS[String(key)]
  if (!spec) return 0
  const mechanics = mechanicsOf(api)
  const engine = mechanics?.residents?.change
  let next = null
  if (typeof engine === 'function') {
    const value = engine(spec, amount)
    if (value !== false && value != null) next = Number(value) || 0
  }
  if (next == null) {
    changeRelationship(state.campaign, spec, amount)
    next = relationshipLevel(state, key)
  }
  const records = recordsFor(state)
  records.relationships ||= {}
  records.relationships[String(key)] = next
  return next
}

export function residentNote(state, key, note) {
  const spec = RESIDENT_RECORDS[String(key)]
  if (!spec) return false
  const records = recordsFor(state)
  if (typeof campaignResidentNotes === 'function' && campaignResidentNotes(records, String(key)).includes(note)) {
    return true
  }
  const notes = records[spec.notes] || []
  return Array.isArray(notes) && notes.includes(note)
}

/** 加一条居民笔记（引擎 mechanics.residents.note → resident-record.js；并镜像印刷复选框布尔键）。 */
export function addResidentNote(state, key, note, api = {}) {
  const spec = RESIDENT_RECORDS[String(key)]
  if (!spec) return false
  const mechanics = mechanicsOf(api)
  let changed = false
  if (typeof mechanics?.residents?.note === 'function') changed = mechanics.residents.note(spec, note) === true
  else changed = changeResidentNote(state.campaign, spec, note) === true
  // base.json#key 的每个笔记也是独立复选框：战役层 `interludes.js#addResidentNote` 同口径双写。
  const records = recordsFor(state)
  if (records[note] !== true) {
    records[note] = true
    changed = true
  }
  return changed
}

export function residentCrossedOut(state, key) {
  const spec = RESIDENT_RECORDS[String(key)]
  if (!spec) return false
  return recordsFor(state)[spec.crossedOut] === true
}

/** 划掉名单（战役日志名字被划掉的居民不能进入序曲）。 */
export function crossedOutResidentKeys(state) {
  return RESIDENT_SPECS.map(spec => spec.key).filter(key => residentCrossedOut(state, key))
}

/** Scenario resolution 前的居民快照（读点；不写状态）。 */
export function residentSnapshot(state) {
  return RESIDENT_SPECS.map(spec => ({
    key: spec.key, code: spec.assetCode, name: spec.name,
    level: relationshipLevel(state, spec.key),
    crossedOut: residentCrossedOut(state, spec.key),
    inPlay: Boolean(residentAssetInPlay(state, spec.key)),
    notes: [...(recordsFor(state)[spec.record.notes] || [])],
  }))
}

// ---------------------------------------------------------------------------
// 勘察记录（Areas Surveyed：战役层 schema 尚未落定，读取兼容四种历史写法）
// ---------------------------------------------------------------------------
const SURVEY_SCENARIO_BY_AREA = Object.freeze({
  northPointMine: 'writtenInRock', hemlockHarbor: 'hemlockHouse', pearlRidge: 'theSilentHeath',
  akwanShoreline: 'theLostSister', eastwickBog: 'theThingInTheDepths',
  westernWoods: 'theTwistedHollow', southernFields: 'theLongestNight',
})
const AREA_BY_SCENARIO = Object.freeze(Object.fromEntries(
  Object.entries(SURVEY_SCENARIO_BY_AREA).map(([area, id]) => [id, area])))

/**
 * 某勘察区域是否已勾选：先读战役层权威 `records.js#areaSurveyed`（`areasSurveyed` 集合 +
 * 各区域布尔键），再兼容 `object` 映射与章节曾经写过的 `<area>Surveyed` / `area<Area>Surveyed`。
 */
export function surveyedArea(state, area) {
  const records = recordsFor(state)
  if (typeof areaSurveyed === 'function' && areaSurveyed(records, String(area))) return true
  const store = records[RECORD_KEYS.areasSurveyed]
  if (Array.isArray(store) && store.includes(area)) return true
  if (store && typeof store === 'object' && !Array.isArray(store) && store[area] === true) return true
  if (records[`${area}Surveyed`] === true) return true
  if (records[`areasSurveyed${cap(area)}`] === true) return true
  if (records[`area${cap(area)}Surveyed`] === true) return true
  return false
}

export const surveyedScenario = (state, scenarioId) => {
  const area = AREA_BY_SCENARIO[String(scenarioId)]
  return area ? surveyedArea(state, area) : false
}

/** 下一次勘察候选（resolution2：只列尚未勾选的区域）。 */
export function surveyChoices(state) {
  return SURVEY_DESTINATIONS
    .filter(id => !surveyedScenario(state, id))
    .map(id => ({ id, label: SCENARIO_TEXT.labels[id] || id, area: AREA_BY_SCENARIO[id] || null }))
}

/** 全队选择下一次勘察（写入 engine campaign.surveyPreparation；不合法返回 false）。 */
export function chooseNextSurvey(state, seat, destination, api = {}) {
  const options = surveyChoices(state)
  if (!options.some(option => option.id === destination)) return false
  const engine = mechanicsOf(api)?.interactions?.fhv?.survey?.chooseNext
  if (typeof engine === 'function') return engine(seat, { optional: false }) === destination
  if (!state.campaign?.surveyPreparation) return false
  return chooseSurveyDestination(state, seat, destination) === destination
}

export const surveyParcel = state => (state.campaign?.surveyPreparation
  ? clone(state.campaign.surveyPreparation) : null)
export const surveyAllows = (state, id) => Boolean(surveyForDestination(state, id))

// ---------------------------------------------------------------------------
// 奖励经验 / 弱点 / 资源
// ---------------------------------------------------------------------------
/** 「Each investigator earns N bonus experience」：引擎结局统一 Awards（记入 Unspent Experience）。 */
export function grantBonusXp(state, amount, api = {}) {
  const value = Math.max(0, Number(amount) || 0)
  if (!value) return 0
  for (const inv of state.investigators || []) {
    if (typeof api.addScenarioXpBonus === 'function') api.addScenarioXpBonus(inv.seat, value)
    else inv.scenarioXpBonus = (Number(inv.scenarioXpBonus) || 0) + value
  }
  setFlag(state, 'dawnOfTheFinalDayBonusXp',
    (Number(flagsFor(state).dawnOfTheFinalDayBonusXp) || 0) + value)
  info(api, `每位调查员获得 ${value} 点奖励经验（记入「Unspent Experience」）。`)
  return value
}

const spendResources = (state, inv, amount, api = {}) => {
  void state
  if (typeof api.spendResources === 'function') return api.spendResources(inv.seat, amount)
  if (typeof api.loseResources === 'function') return api.loseResources(inv.seat, amount)
  inv.resources = Math.max(0, (Number(inv.resources) || 0) - amount)
  return true
}

const gainResources = (state, inv, amount, api = {}) => {
  void state
  if (typeof api.gainResources === 'function') return api.gainResources(inv.seat, amount)
  inv.resources = (Number(inv.resources) || 0) + amount
  return true
}

const drawCards = (state, inv, amount, api = {}) => {
  void state
  if (typeof api.drawCards === 'function') return api.drawCards(inv.seat, amount)
  const deck = inv.deck || (inv.deck = [])
  const drawn = deck.splice(0, amount)
  inv.hand = [...(inv.hand || []), ...drawn]
  return drawn.length
}

const discardCards = (state, inv, amount, api = {}) => {
  void state
  if (typeof api.discardChosen === 'function') return api.discardChosen(inv.seat, amount, 'codex8')
  if (typeof api.discardRandom === 'function') return api.discardRandom(inv.seat, amount)
  const hand = inv.hand || []
  const removed = spliceHand(inv, 0, Math.min(amount, hand.length))
  inv.discard = [...(inv.discard || []), ...removed]
  return removed.length
}

const addMentalTrauma = (seat, amount, api = {}) => {
  if (typeof api.addTrauma === 'function') return api.addTrauma(seat, 'mental', amount)
  return null
}

/** The Bliss：1 点精神创伤，或把 1 张随机基础疯狂弱点加入牌库（不计入牌库张数）。 */
function applyBlissChoice(state, inv, api = {}) {
  void state
  const label = SCENARIO_TEXT.actBack.madness || 'Search for a random basic Madness weakness'
  const traumaLabel = SCENARIO_TEXT.actBack.trauma || 'Suffer 1 mental trauma'
  const options = [
    { id: 'madness', label },
    { id: 'trauma', label: traumaLabel },
  ]
  const choice = typeof api.choose === 'function'
    ? api.choose({ kind: 'choice', seat: inv.seat, source: ACT1_CODE, prompt: 'The Bliss：选择一项。', options })
    : 'trauma'
  if (choice === 'madness' && typeof api.addBasicWeakness === 'function') {
    api.addBasicWeakness(inv.seat, ['madness'])
    info(api, `${inv.name} 将 1 张随机基础[[疯狂]]弱点加入牌库（不计入牌库张数）。`)
  } else {
    addMentalTrauma(inv.seat, 1, api)
    info(api, `${inv.name} 承受 1 点精神创伤。`)
  }
}

// ---------------------------------------------------------------------------
// 法典读点（条件判定 / 可用性）
// ---------------------------------------------------------------------------
export function codexEntry(entryId) {
  return CODEX_ENTRIES[String(entryId)] || CODEX_ENTRIES[CODEX_BY_NUMBER[String(entryId)]] || null
}
export const CODEX_ENTRY_LIST = Object.freeze(CODEX_IDS.map(id => CODEX_ENTRIES[id]))

const codexDoneList = state => {
  const flags = flagsFor(state)
  return (flags.dawnOfTheFinalDayCodexDone ||= [])
}
export const codexDone = (state, entryId) => codexDoneList(state).includes(String(entryId))

function markCodexDone(state, entryId, api = {}) {
  const id = String(entryId)
  const list = codexDoneList(state)
  if (!list.includes(id)) list.push(id)
  // 战役日志的「已读法典」镜像（战役层 records.js#codexRead 是 string[]；带序曲前缀避免撞键）。
  const records = recordsFor(state)
  const key = `${CHAPTER_ID}:${id}`
  records.codexRead = Array.isArray(records.codexRead) ? records.codexRead : []
  if (!records.codexRead.includes(key)) records.codexRead.push(key)
  info(api, `法典 ${codexEntry(id)?.number || id} 已结算（本序曲不再触发）。`)
}

/**
 * 烟花 tally（「mark 1 tally next to The plan is underway」）。
 * 印刷是 Record Count（Key.hs#incrementRecordCount）：优先读数字；战役层 schema 把同名键声明成
 * 布尔复选框（第二日黎明先写入「Simeon hatched a plan / The plan is underway」），因此布尔 true、
 * 或 Simeon 笔记集合里含该笔记，都折算为「至少 1 道 tally」。
 */
export function planTally(state) {
  const records = recordsFor(state)
  const raw = records[RECORD_KEYS.thePlanIsUnderway]
  if (Number.isFinite(Number(raw)) && typeof raw !== 'boolean') return Math.max(0, Number(raw))
  if (raw === true) return 1
  const notes = records[RESIDENT_RECORDS.simeonAtwood.notes]
  if (Array.isArray(notes) && notes.includes(RECORD_KEYS.thePlanIsUnderway)) return 1
  return 0
}
export const hasPlanUnderway = state => planTally(state) >= 1

function addPlanTally(state, api = {}) {
  const records = recordsFor(state)
  records[RECORD_KEYS.thePlanIsUnderway] = planTally(state) + 1
  info(api, `在 The plan is underway 记 1 道 tally（当前 ${records[RECORD_KEYS.thePlanIsUnderway]}）。`)
  return records[RECORD_KEYS.thePlanIsUnderway]
}

function residentAssetInPlay(state, key) {
  const spec = residentSpec(key)
  if (!spec) return null
  return storyAssetsOf(state).find(asset => codeOf(asset) === spec.assetCode) || null
}
export { residentAssetInPlay }

export function residentsInPlay(state) {
  return storyAssetsOf(state).filter(asset => Boolean(RESIDENT_BY_ASSET_CODE[codeOf(asset)]))
}

export function residentPlacementState(state, key) {
  const spec = residentSpec(key)
  if (!spec) return 'unknown'
  if (residentCrossedOut(state, key)) return 'crossedOut'
  if (residentAssetInPlay(state, key)) return 'inPlay'
  if ((state.scenarioZones?.removed || []).includes(spec.assetCode)) return 'removed'
  if ((state.scenarioZones?.setAside || []).includes(spec.assetCode)) return 'setAside'
  return 'outOfPlay'
}

const gateMet = (state, entry) => {
  const gate = entry.gate
  if (!gate) return { met: true, branch: null }
  if (gate.type === 'surveyedArea') return { met: surveyedArea(state, gate.area), branch: gate.unmet || 'cannotReach' }
  if (gate.type === 'planUnderway') return { met: hasPlanUnderway(state), branch: null }
  return { met: true, branch: null }
}

/** 法典是否还能触发（未完成 + 居民资产在场；条件未达成的条目仍可触发并读「无法」段）。 */
export function codexAvailable(state, entryId) {
  const entry = codexEntry(entryId)
  if (!entry) return false
  if (codexDone(state, entry.id)) return false
  if (entry.kind === 'resident' && !residentAssetInPlay(state, entry.resident)) return false
  if (entry.kind === 'location' && !locationOf(state, entry.location)) return false
  return true
}

/** Codex 1/2/4/5/6/7/8/10/11/14/15/16 的分支判定（纯读）。 */
export function codexBranch(state, entryId) {
  const entry = codexEntry(entryId)
  if (!entry) return null
  switch (entry.id) {
    case 'motherRachel':
      return gateMet(state, entry).met ? null : 'cannotReach'
    case 'leahAtwood':
      return recordsFor(state)[RECORD_KEYS.simeonCrossedOut] === true ? 'crossedOut' : 'notCrossedOut'
    case 'williamHemlock':
      return residentNote(state, 'williamHemlock', RECORD_KEYS.williamStoodByYou) ? 'william2' : 'william3'
    case 'riverHawthorne':
      return residentNote(state, 'riverHawthorne', RECORD_KEYS.riverStoodByYou)
        && residentNote(state, 'riverHawthorne', RECORD_KEYS.theSchemeIsInMotion) ? 'stoodByYou' : 'otherwise'
    case 'gideonMizrah':
      return residentNote(state, 'gideonMizrah', RECORD_KEYS.gideonStoodByYou) ? 'stoodByYou' : 'otherwise'
    case 'judithPark': {
      const backed = residentNote(state, 'judithPark', RECORD_KEYS.judithStoodByYou)
        || recordsFor(state)[RECORD_KEYS.theThingInTheDepthsWasDefeated] === true
        || relationshipLevel(state, 'judithPark') >= 4
      return backed ? 'judith2' : 'judith3'
    }
    case 'theoPeters':
      return residentNote(state, 'theoPeters', RECORD_KEYS.theoStoodByYou) ? 'stoodByYou' : 'otherwise'
    case 'theCrossroads':
    case 'tadsGeneralStore':
    case 'valeSchoolhouse':
      return hasPlanUnderway(state) ? 'planUnderway' : 'otherwise'
    case 'hemlockChapel':
      return hasPlanUnderway(state) ? 'planUnderway' : 'otherwise'
    case 'theCommons':
      return isRemembered(state, RECORD_KEYS.youAreDeliveringAPackage) ? 'delivering' : 'regardless'
    default:
      return entry.branches?.[0] || null
  }
}

/** 条目正文键（UI/指南读点）：返回该条件下应展示的 story-text 键。 */
export function codexTextKeys(state, entryId) {
  const entry = codexEntry(entryId)
  if (!entry) return []
  const prefix = `prelude3.codex.${entry.id}`
  const branch = codexBranch(state, entryId)
  const keys = [`${prefix}.title`]
  if (branch === 'cannotReach') return [...keys, `${prefix}.motherRachel1`, `${prefix}.proceedTo2`, `${prefix}.cannotReach`]
  if (entry.id === 'motherRachel') {
    return [...keys, `${prefix}.motherRachel1`, `${prefix}.proceedTo2`, `${prefix}.motherRachel2`]
  }
  if (entry.id === 'williamHemlock') {
    return [...keys, `${prefix}.william1`, `${prefix}.proceedTo2`, `${prefix}.skipTo3`, `${prefix}.${branch}`]
  }
  if (entry.id === 'judithPark') {
    return [...keys, `${prefix}.judith1`, `${prefix}.proceedTo2`, `${prefix}.skipTo3`, `${prefix}.${branch}`]
  }
  if (entry.id === 'theCommons') {
    return [...keys, `${prefix}.delivering`, `${prefix}.regardless`]
  }
  if (entry.id === 'boardingHouse') {
    return [...keys, `${prefix}.body`, `${prefix}.label.william`, `${prefix}.label.theo`, `${prefix}.label.river`]
  }
  return [...keys, `${prefix}.${branch || entry.branches?.[0]}`]
}

// ---------------------------------------------------------------------------
// 法典结算（Haskell ScenarioSpecific "codex" 的逐条镜像）
// ---------------------------------------------------------------------------
function placeResidentFromSetAside(state, key, locationId, api = {}) {
  const spec = residentSpec(key)
  if (!spec) return null
  if (residentCrossedOut(state, key)) return null
  const existing = residentAssetInPlay(state, key)
  if (existing) return existing
  const zones = state.scenarioZones ||= {}
  zones.setAside ||= []
  const index = zones.setAside.indexOf(spec.assetCode)
  if (index >= 0) zones.setAside.splice(index, 1)
  let asset = null
  if (typeof api.storyAsset === 'function') asset = api.storyAsset(spec.assetCode, locationId || null)
  if (!asset) {
    const card = ALL_CARDS[spec.assetCode] || {}
    asset = {
      id: `${CHAPTER_ID}-${spec.assetCode}`, code: spec.assetCode, originalCode: spec.assetCode,
      name: card.nameZh || card.name || spec.assetCode, location: locationId || null,
      controllerSeat: null, exhausted: false, tokens: 0, assets: [], attachments: [],
    }
    storyAssetsOf(state).push(asset)
  }
  info(api, `「${RESIDENT_BY_KEY[key].name}」以资产面进入「${locationOf(state, locationId)?.name || locationId}」。`)
  return asset
}

export { placeResidentFromSetAside }

function spawnEnemy(state, code, locationId, api = {}) {
  if (typeof api.spawn === 'function') return api.spawn(code, locationId)
  const card = ALL_CARDS[code] || {}
  const enemy = {
    id: `${CHAPTER_ID}-${code}-${(state.enemies || []).length + 1}`, code, originalCode: code,
    name: card.nameZh || card.name || code, location: locationId, fight: card.fight ?? 0,
    evade: card.evade ?? 0, health: card.health ?? 1, damage: card.damage || 0, horror: card.horror || 0,
    traits: [...(card.traits || [])], exhausted: false, engagedSeat: null, damageTaken: 0, doom: 0,
    clues: 0, attachments: [], victory: Number(card.victory) || 0,
  }
  state.enemies = [...(state.enemies || []), enemy]
  return enemy
}

function takeControlOfResident(state, key, seat, api = {}) {
  const asset = residentAssetInPlay(state, key)
  if (!asset) return false
  asset.controllerSeat = seat
  const inv = state.investigators?.[seat]
  if (inv) asset.location = inv.location
  info(api, `获得「${RESIDENT_BY_KEY[key].name}」的控制权。`)
  return true
}

const chooseOption = (api, { seat, source, prompt, options, fallback = null }) => {
  if (typeof api.choose !== 'function') return fallback ?? options[0]?.id ?? null
  return api.choose({ kind: 'choice', seat, source, prompt, options })
}

const fireworksTest = (state, inv, entry, options, api = {}) => {
  const spec = entry.fireworksTest || { skills: ['combat', 'agility'], difficulty: 3 }
  const skills = spec.skills || ['combat']
  const skill = options.skill && skills.includes(options.skill)
    ? options.skill
    : skills.length === 1 ? skills[0] : chooseOption(api, {
      seat: inv.seat, source: entry.id, prompt: '选择用于藏烟花的技能。',
      options: skills.map(id => ({ id, label: id === 'combat' ? '战斗' : id === 'agility' ? '敏捷' : id })),
      fallback: skills[0],
    })
  let result = { success: false, value: 0, difficulty: spec.difficulty }
  if (typeof api.test === 'function') {
    api.test(inv.seat, skill, spec.difficulty, resolved => { result = resolved || result })
  }
  return { skill, difficulty: spec.difficulty, ...result, success: result?.success === true }
}

function drawOrGainResource(state, inv, entry, options, api = {}) {
  const choice = options.drawOrResource || chooseOption(api, {
    seat: inv.seat, source: entry.id, prompt: '选择：抽 1 张牌或获得 1 资源。',
    options: [{ id: 'draw', label: SCENARIO_TEXT.codex.labels.draw || 'Draw 1 card' },
      { id: 'resource', label: SCENARIO_TEXT.codex.labels.gainResource || 'Gain 1 resource' }],
    fallback: 'draw',
  })
  if (choice === 'resource') gainResources(state, inv, 1, api)
  else drawCards(state, inv, 1, api)
  info(api, `${inv.name} ${choice === 'resource' ? '获得 1 资源' : '抽 1 张牌'}。`)
}

/** Codex 16 的传家宝检查：[[Item]] 剧情资产（Heirlooms 组）。 */
export function heirloomCandidates(state, seat = null) {
  const seats = Number.isInteger(seat) ? [seat] : (state.investigators || []).map(inv => inv.seat)
  const found = []
  for (const id of seats) {
    const inv = state.investigators?.[id]
    if (!inv) continue
    for (const zone of ['deck', 'hand', 'discard']) {
      for (const code of inv[zone] || []) {
        if (HEIRLOOM_CODES.includes(code)) found.push({ seat: id, code, zone })
      }
    }
  }
  const seen = new Set()
  return found.filter(item => {
    const key = `${item.seat}:${item.code}:${item.zone}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** 移出 1 张传家宝（「remove 1 earned Item story asset from their deck, discard pile, or hand」）。 */
export function removeHeirloom(state, seat, code, api = {}) {
  const inv = state.investigators?.[seat]
  if (!inv) return { removed: false, reason: 'seat' }
  for (const zone of ['deck', 'hand', 'discard']) {
    const list = inv[zone] || []
    const index = list.indexOf(code)
    if (index < 0) continue
    list.splice(index, 1)
    if (typeof api.campaignCard === 'function') api.campaignCard(code, seat, '传家宝交还')
    else {
      const records = recordsFor(state)
      records.obtainedHeirlooms ||= []
      if (!records.obtainedHeirlooms.includes(code)) records.obtainedHeirlooms.push(code)
    }
    info(api, `${inv.name} 从${zone === 'deck' ? '牌库' : zone === 'hand' ? '手牌' : '弃牌堆'}移出传家宝「${ALL_CARDS[code]?.name || code}」。`)
    return { removed: true, zone, code, seat }
  }
  // 旧存档：战役牌组记录里还留着该卡。
  const record = state.campaign?.investigators?.[seat]
  if (record?.deck?.includes(code)) {
    record.deck = record.deck.filter(item => item !== code)
    return { removed: true, zone: 'campaignDeck', code, seat }
  }
  return { removed: false, reason: 'notFound' }
}

/** 关系等级 ≤2 且未被划掉的居民（Codex 16 的收礼人候选）。 */
export function lowRelationshipResidents(state) {
  return RESIDENT_SPECS
    .filter(spec => !residentCrossedOut(state, spec.key) && relationshipLevel(state, spec.key) <= 2)
    .map(spec => ({ key: spec.key, name: spec.name, level: relationshipLevel(state, spec.key) }))
}

/**
 * 结算一条法典。返回
 * `{ ok, entry, number, seat, branch, consumed, xp, test, effects, textKeys, reason? }`。
 * options：`seat`（触发者）、`skill`、`branch`（Choice 分支）、`extraActions`（Codex 9）、
 * `heirloomCode`/`residentKey`（Codex 16）、`drawOrResource`、`spendItem`。
 * `readCodex` 假设卡面触发（地点 [action] / 居民谈判检定）已由调用方完成；Codex 10/11/14/15
 * 的「藏烟花」检定写在法典内部，由本函数结算。
 */
export function readCodex(state, entryId, options = {}, api = {}) {
  const entry = codexEntry(entryId)
  if (!entry) return { ok: false, reason: 'unknownEntry', entry: String(entryId) }
  const seat = Number.isInteger(options.seat) ? options.seat : (state.campaign?.leadSeat ?? 0)
  const inv = state.investigators?.[seat]
  if (!inv) return { ok: false, reason: 'seat', entry: entry.id }
  if (codexDone(state, entry.id)) return { ok: false, reason: 'done', entry: entry.id }
  if (entry.kind === 'resident' && !residentAssetInPlay(state, entry.resident)) {
    return { ok: false, reason: 'residentNotInPlay', entry: entry.id }
  }
  if (entry.kind === 'location' && !locationOf(state, entry.location)) {
    return { ok: false, reason: 'locationNotInPlay', entry: entry.id }
  }

  const result = { ok: true, entry: entry.id, number: entry.number, seat, branch: null,
    consumed: false, xp: 0, test: null, effects: [], textKeys: [] }
  const gate = gateMet(state, entry)

  switch (entry.id) {
    // ── 1. Mother Rachel ────────────────────────────────────────────────
    case 'motherRachel': {
      if (!gate.met) {
        result.branch = 'cannotReach'
        result.textKeys = codexTextKeys(state, entry.id)
        info(api, '南方田野尚未勘察：你无法接近蕾切尔嬷嬷。')
        return result
      }
      result.branch = options.branch === 'iSeeYou' ? 'iSeeYou' : options.branch === 'thankYou' ? 'thankYou'
        : chooseOption(api, {
          seat, source: entry.id, prompt: '你打算对蕾切尔嬷嬷说什么？',
          options: [{ id: 'thankYou', label: SCENARIO_TEXT.codex.entries.motherRachel.branches.thankYou },
            { id: 'iSeeYou', label: SCENARIO_TEXT.codex.entries.motherRachel.branches.iSeeYou }],
          fallback: 'thankYou',
        })
      if (result.branch === 'iSeeYou') {
        addRelationship(state, 'motherRachel', -1, api)
      } else {
        recordsFor(state)[RECORD_KEYS.theInvestigatorsLearnedTheirPlace] = true
        addRelationship(state, 'motherRachel', 1, api)
      }
      result.xp = grantBonusXp(state, 1, api)
      markCodexDone(state, entry.id, api)
      result.consumed = true
      break
    }
    // ── 2. Leah Atwood ──────────────────────────────────────────────────
    case 'leahAtwood': {
      const crossed = recordsFor(state)[RECORD_KEYS.simeonCrossedOut] === true
      result.branch = crossed ? 'crossedOut' : 'notCrossedOut'
      if (crossed) {
        addRelationship(state, 'leahAtwood', 1, api)
        result.xp = grantBonusXp(state, 1, api)
      } else {
        addRelationship(state, 'leahAtwood', 2, api)
        result.xp = grantBonusXp(state, 2, api)
      }
      markCodexDone(state, entry.id, api)
      result.consumed = true
      break
    }
    // ── 4. William Hemlock ──────────────────────────────────────────────
    case 'williamHemlock': {
      result.branch = codexBranch(state, entry.id)
      if (result.branch === 'william2') {
        if (residentNote(state, 'williamHemlock', RECORD_KEYS.williamTookHeart)) {
          addResidentNote(state, 'williamHemlock', RECORD_KEYS.williamIsResolved, api)
          result.effects.push('williamIsResolved')
        }
      }
      addRelationship(state, 'williamHemlock', 1, api)
      result.xp = grantBonusXp(state, 1, api)
      markCodexDone(state, entry.id, api)
      result.consumed = true
      break
    }
    // ── 5. River Hawthorne ──────────────────────────────────────────────
    case 'riverHawthorne': {
      result.branch = codexBranch(state, entry.id)
      if (result.branch === 'stoodByYou') {
        addResidentNote(state, 'riverHawthorne', RECORD_KEYS.riverIsReclaimingTheirLegacy, api)
        result.effects.push('riverIsReclaimingTheirLegacy')
        addRelationship(state, 'riverHawthorne', 1, api)
        result.xp = grantBonusXp(state, 1, api)
      } else {
        gainResources(state, inv, 3, api)
        result.effects.push('gain3Resources')
      }
      markCodexDone(state, entry.id, api)
      result.consumed = true
      break
    }
    // ── 6. Gideon Mizrah ────────────────────────────────────────────────
    case 'gideonMizrah': {
      result.branch = codexBranch(state, entry.id)
      if (result.branch === 'stoodByYou') {
        addRelationship(state, 'gideonMizrah', 1, api)
        result.xp = grantBonusXp(state, 1, api)
      } else {
        drawCards(state, inv, 3, api)
        result.effects.push('draw3Cards')
      }
      markCodexDone(state, entry.id, api)
      result.consumed = true
      break
    }
    // ── 7. Judith Park ──────────────────────────────────────────────────
    case 'judithPark': {
      spawnEnemy(state, MIASMATIC_SHADOW_CODE, 'theCrossroads', api)
      result.effects.push('spawnMiasmaticShadow')
      result.branch = codexBranch(state, entry.id)
      if (result.branch === 'judith2') {
        takeControlOfResident(state, 'judithPark', seat, api)
        addResidentNote(state, 'judithPark', RECORD_KEYS.youBackedJudithUp, api)
        result.effects.push('takeControlJudith', 'youBackedJudithUp')
      } else {
        if (typeof api.discardRandom === 'function') api.discardRandom(seat, 1)
        else discardCards(state, inv, 1, api)
        result.effects.push('randomDiscard1')
      }
      addRelationship(state, 'judithPark', 1, api)
      result.xp = grantBonusXp(state, 1, api)
      markCodexDone(state, entry.id, api)
      result.consumed = true
      break
    }
    // ── 8. Theo Peters ──────────────────────────────────────────────────
    case 'theoPeters': {
      result.branch = codexBranch(state, entry.id)
      if (result.branch === 'stoodByYou') {
        addResidentNote(state, 'theoPeters', RECORD_KEYS.theoIsHavingSecondThoughts, api)
        result.effects.push('theoIsHavingSecondThoughts')
        addRelationship(state, 'theoPeters', 1, api)
        result.xp = grantBonusXp(state, 1, api)
      } else {
        remember(state, RECORD_KEYS.youAreDeliveringAPackage, api)
        result.effects.push('rememberPackage')
      }
      markCodexDone(state, entry.id, api)
      result.consumed = true
      break
    }
    // ── 9. Boarding House（可反复触发；可额外花费行动多选） ───────────────
    case 'boardingHouse': {
      const picks = 1 + Math.max(0, Number(options.extraActions) || 0)
      const labelOf = {
        williamHemlock: SCENARIO_TEXT.codex.labels.boardingHouseWilliam,
        theoPeters: SCENARIO_TEXT.codex.labels.boardingHouseTheo,
        riverHawthorne: SCENARIO_TEXT.codex.labels.boardingHouseRiver,
      }
      const available = ['williamHemlock', 'theoPeters', 'riverHawthorne']
        .filter(key => residentPlacementState(state, key) === 'setAside')
      const chosen = []
      for (let index = 0; index < picks && available.length; index += 1) {
        const pick = options.branch && index === 0 && available.includes(options.branch)
          ? options.branch
          : chooseOption(api, {
            seat, source: entry.id, prompt: '询问奥尔姆斯特德太太：谁今天在山谷里干活？',
            options: available.map(key => ({ id: key, label: labelOf[key] || RESIDENT_BY_KEY[key]?.name || key })),
            fallback: available[0],
          })
        const key = available.includes(pick) ? pick : available[0]
        available.splice(available.indexOf(key), 1)
        if (placeResidentFromSetAside(state, key, RESIDENT_ENTRY_LOCATIONS[key], api)) chosen.push(key)
      }
      result.branch = chosen[0] || null
      result.effects.push(...chosen.map(key => `place:${key}`))
      if (!chosen.length) return { ...result, ok: false, reason: 'noResidentsSetAside' }
      break
    }
    // ── 10. The Crossroads ──────────────────────────────────────────────
    case 'theCrossroads': {
      if (!gate.met) {
        result.branch = 'otherwise'
        drawOrGainResource(state, inv, entry, options, api)
        markCodexDone(state, entry.id, api)
        result.consumed = true
        break
      }
      result.branch = 'planUnderway'
      const test = fireworksTest(state, inv, entry, options, api)
      result.test = test
      if (test.success) {
        addPlanTally(state, api)
        markCodexDone(state, entry.id, api)
        result.consumed = true
        result.effects.push('fireworksHidden')
      }
      break
    }
    // ── 11. Hemlock Chapel ──────────────────────────────────────────────
    case 'hemlockChapel': {
      // 无论是否藏烟花，先把放一边的 Gideon（若不在场）放到教堂。
      if (residentPlacementState(state, 'gideonMizrah') === 'setAside') {
        if (placeResidentFromSetAside(state, 'gideonMizrah', 'hemlockChapel', api)) {
          result.effects.push('place:gideonMizrah')
        }
      }
      if (!gate.met) {
        result.branch = 'otherwise'
        markCodexDone(state, entry.id, api)
        result.consumed = true
        break
      }
      result.branch = 'planUnderway'
      const test = fireworksTest(state, inv, entry, options, api)
      result.test = test
      if (test.success) {
        addPlanTally(state, api)
        markCodexDone(state, entry.id, api)
        result.consumed = true
        result.effects.push('fireworksHidden')
      }
      break
    }
    // ── 13. The Atwood House ────────────────────────────────────────────
    case 'theAtwoodHouse': {
      result.branch = 'body'
      if (residentPlacementState(state, 'leahAtwood') === 'setAside') {
        if (placeResidentFromSetAside(state, 'leahAtwood', 'theAtwoodHouse', api)) {
          result.effects.push('place:leahAtwood')
        }
      }
      markCodexDone(state, entry.id, api)
      result.consumed = true
      break
    }
    // ── 14. Tad's General Store ─────────────────────────────────────────
    case 'tadsGeneralStore': {
      if (!gate.met) {
        result.branch = 'otherwise'
        if ((Number(inv.resources) || 0) >= 5 && options.spendItem !== false) {
          const spend = chooseOption(api, {
            seat, source: entry.id, prompt: SCENARIO_TEXT.codex.labels.item || 'Spend 5 resources for an Item.',
            options: [{ id: 'spend', label: SCENARIO_TEXT.codex.labels.item || 'Spend 5 resources' },
              { id: 'skip', label: '跳过' }],
            fallback: 'skip',
          })
          if (spend === 'spend') {
            spendResources(state, inv, 5, api)
            if (typeof api.searchAndPlayFromDeck === 'function') {
              api.searchAndPlayFromDeck(inv.seat, { type: 'asset', trait: 'Item' })
            }
            result.effects.push('spend5SearchItem')
          }
        }
        markCodexDone(state, entry.id, api)
        result.consumed = true
        break
      }
      result.branch = 'planUnderway'
      const test = fireworksTest(state, inv, entry, options, api)
      result.test = test
      if (test.success) {
        addPlanTally(state, api)
        markCodexDone(state, entry.id, api)
        result.consumed = true
        result.effects.push('fireworksHidden')
      }
      break
    }
    // ── 15. Vale Schoolhouse ────────────────────────────────────────────
    case 'valeSchoolhouse': {
      if (!gate.met) {
        result.branch = 'otherwise'
        drawOrGainResource(state, inv, entry, options, api)
        markCodexDone(state, entry.id, api)
        result.consumed = true
        break
      }
      result.branch = 'planUnderway'
      const test = fireworksTest(state, inv, entry, options, api)
      result.test = test
      if (test.success) {
        addPlanTally(state, api)
        markCodexDone(state, entry.id, api)
        result.consumed = true
        result.effects.push('fireworksHidden')
      }
      break
    }
    // ── 16. The Commons ─────────────────────────────────────────────────
    case 'theCommons': {
      const delivering = isRemembered(state, RECORD_KEYS.youAreDeliveringAPackage)
      result.branch = delivering ? 'delivering' : 'regardless'
      if (delivering) {
        addRelationship(state, 'theoPeters', 1, api)
        result.xp += grantBonusXp(state, 1, api)
      }
      // Regardless：任一调查员可交还 1 张传家宝（Item 剧情资产），换取关系 ≤2 的居民 +1 与全队 1 XP。
      const candidates = heirloomCandidates(state)
      let heirloom = null
      if (candidates.length) {
        if (options.heirloomCode) {
          heirloom = candidates.find(candidate => candidate.code === options.heirloomCode) || candidates[0]
        } else {
          const choice = chooseOption(api, {
            seat, source: entry.id, prompt: '要交还 1 张传家宝吗？',
            options: [{ id: 'skip', label: '不交还' },
              ...candidates.map((candidate, index) => ({
                id: `${candidate.seat}:${candidate.code}:${candidate.zone}:${index}`,
                label: `${ALL_CARDS[candidate.code]?.nameZh || ALL_CARDS[candidate.code]?.name || candidate.code}（${candidate.zone}）`,
              }))],
            fallback: 'skip',
          })
          if (choice !== 'skip' && choice != null) {
            const [rawSeat, rawCode] = String(choice).split(':')
            heirloom = { seat: Number(rawSeat), code: rawCode }
          }
        }
      }
      if (heirloom) {
        const removed = removeHeirloom(state, heirloom.seat, heirloom.code, api)
        if (removed.removed) {
          result.effects.push(`heirloom:${heirloom.code}`)
          const residents = lowRelationshipResidents(state)
          const target = options.residentKey
            ? residents.find(row => row.key === options.residentKey) || residents[0]
            : chooseOption(api, {
              seat, source: entry.id, prompt: '选择一位关系等级 ≤ 2 的居民。',
              options: residents.map(row => ({ id: row.key, label: `${row.name}（${row.level}）` })),
              fallback: residents[0]?.key ?? null,
            })
          if (target) {
            const key = typeof target === 'string' ? target : target.key
            addRelationship(state, key, 1, api)
            result.xp += grantBonusXp(state, 1, api)
            result.effects.push(`relationship:${key}`)
          }
        }
      }
      markCodexDone(state, entry.id, api)
      result.consumed = true
      break
    }
    default:
      return { ok: false, reason: 'unhandled', entry: entry.id }
  }

  result.xp = Number(result.xp) || 0
  result.textKeys = codexTextKeys(state, entry.id)
  return result
}

/** 引擎桥：共享卡/条目 `api.resolveScenarioEvent('dawnOfTheFinalDayCodex', payload)`。 */
export function codexEvent(state, payload = {}, api = {}) {
  const entryId = payload.entry || payload.codex || payload.id
  if (!entryId) return false
  return readCodex(state, entryId, { ...payload, seat: payload.seat }, api)
}

export const events = Object.freeze({
  dawnOfTheFinalDayCodex: codexEvent,
  dawnOfTheFinalDayReadCodex: codexEvent,
})

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
const setAsideZone = state => {
  const zones = state.scenarioZones ||= {}
  zones.setAside ||= []
  return zones.setAside
}
const removedZone = state => {
  const zones = state.scenarioZones ||= {}
  zones.removed ||= []
  return zones.removed
}

function removeCardFromSetAside(state, code) {
  const list = setAsideZone(state)
  const index = list.indexOf(code)
  if (index >= 0) list.splice(index, 1)
  return index >= 0
}

/** 居民放一边/移出：划掉的居民整张移出游戏（正反两面）。 */
function arrangeResidents(state, api = {}) {
  const crossed = crossedOutResidentKeys(state)
  const removed = removedZone(state)
  for (const key of crossed) {
    const spec = residentSpec(key)
    for (const code of [spec.assetCode, spec.enemyCode].filter(Boolean)) {
      removeCardFromSetAside(state, code)
      if (!removed.includes(code)) removed.push(code)
    }
  }
  return crossed
}

/** 第三日时间标记（story 10679，正面 Day Three / 背面 Night Three）。 */
export function putTimeMarkerInPlay(state, api = {}) {
  const code = TIME_MARKER_CODES[3] || TIME_MARKER_CODE
  const existing = storyAssetsOf(state).find(asset => codeOf(asset) === code)
  if (existing) return faceTimeMarker(existing)
  let marker = null
  if (typeof api.storyAsset === 'function') marker = api.storyAsset(code, null)
  if (!marker) {
    const card = ALL_CARDS[code] || {}
    marker = {
      id: `${CHAPTER_ID}-timeMarker`, code, originalCode: code,
      name: card.nameZh || card.name || 'Day Three', global: true, location: null,
      controllerSeat: null, exhausted: false, tokens: 0, assets: [], attachments: [],
    }
    storyAssetsOf(state).push(marker)
  }
  return faceTimeMarker(marker)
}

function faceTimeMarker(marker) {
  const card = ALL_CARDS[codeOf(marker)] || {}
  marker.face = 'front'
  marker.name = card.nameZh || card.name || marker.name || 'Day Three'
  marker.artCode = codeOf(marker)
  return marker
}
export const timeMarkerInPlay = state => storyAssetsOf(state)
  .find(asset => [TIME_MARKER_CODE, TIME_MARKER_CODES[3]].includes(codeOf(asset))) || null

/**
 * 开场 Intro 3 的疲劳：随机替换非符号标记为「低 1 点」的标记（写入战役混乱袋，永久生效）。
 *
 * 与战役层的分工：`interludes.js#runFatigue`（theLongestNight 之后的 `fatigue` 节点）只把待替换
 * 次数累加进 `records.fatiguePending`，真正的标记替换由本函数在该序曲开局完成
 * （参考 Helpers.hs#replaceFatigueChaosTokens 的演出位置：序曲 Intro 3）。
 * 旧存档/直调路径没有 pending 键时退回印刷的 2 枚；重复调用幂等。
 */
export function applyFatigue(state, api = {}) {
  const flags = flagsFor(state)
  if (flags.dawnOfTheFinalDayFatigueApplied === true) return [...(flags.dawnOfTheFinalDayFatigue || [])]
  const records = recordsFor(state)
  const hasPending = Object.hasOwn(records, 'fatiguePending')
  const pending = hasPending ? Math.max(0, Number(records.fatiguePending) || 0) : FATIGUE_REPLACEMENT_COUNT
  let replaced = []
  if (pending > 0) {
    const engine = mechanicsOf(api)?.chaosTokens?.replaceCampaignNumeric
    if (typeof engine === 'function') {
      const result = engine(pending, -1)
      if (Array.isArray(result)) replaced = result
    }
    if (!replaced.length) {
      // 回退：直接改战役袋（引擎 setupChaosBag 之后会复制 campaign.chaosBag）。
      const bag = [...((state.campaign?.chaosBag?.length ? state.campaign.chaosBag : state.chaosBag) || [])]
      const plan = fatigueReplacementPlan(bag, {
        count: pending,
        random: typeof api.random === 'function' ? api.random : null,
      })
      for (const row of plan) bag[row.index] = row.to
      if (state.campaign) state.campaign.chaosBag = [...bag]
      state.chaosBag = [...bag]
      replaced = plan
    }
  }
  // 待替换次数已消费（没能替换的差额也清零：袋里没有可降级的非符号标记时印刷规则同样无解）。
  if (hasPending) records.fatiguePending = 0
  setFlag(state, 'dawnOfTheFinalDayFatigueApplied', true)
  setFlag(state, 'dawnOfTheFinalDayFatigue', replaced)
  if (replaced.length) {
    info(api, `疲劳：${replaced.map(row => `${row.from}→${row.to}`).join('、')}（永久）。`)
  }
  return replaced
}

export function prepareScenario(state, api = {}) {
  const flags = flagsFor(state)
  if (flags.dawnOfTheFinalDayPrepared === true) return flags.dawnOfTheFinalDayReport
  // 日期：第 3 日白昼（引擎日历原语 + campaign.records）。
  const mechanics = mechanicsOf(api)
  if (typeof mechanics?.calendar?.set === 'function') mechanics.calendar.set(3, 'day')
  else setScenarioDate(state, 3, 'day')
  const records = recordsFor(state)
  records.day = 3
  records.time = 'Day'
  setFlag(state, 'dawnOfTheFinalDayDay', 3)
  const intro = introBranchKey(state)
  setFlag(state, 'dawnOfTheFinalDayIntro', intro)
  // 幕/议程：引擎 startScenario 已把 scenario.acts/agendas 放进 state；这里只保底。
  state.acts ||= [clone(ACT_STAGES[1])]
  state.agendas ||= [clone(AGENDA_STAGES[1])]
  state.actIndex = 0
  state.agendaIndex = 0
  // 放一边（Agents of the Colour 整组 + Residents 其余卡）。
  const zones = state.scenarioZones ||= {}
  zones.setAside = [...SET_ASIDE_CARDS]
  zones.removed = [...REMOVED_CARDS]
  zones.setAsideLocations = []
  // 疲劳（Intro 3 第二条）。
  const fatigue = applyFatigue(state, api)
  const report = {
    day: 3, period: 'day', intro, actCodes: [...ACT_CODES], agendaCodes: [...AGENDA_CODES],
    timeMarkerCode: TIME_MARKER_CODE,
    gatherGroups: [...GATHER_GROUPS], setAsideCards: [...SET_ASIDE_CARDS],
    removedCards: [...REMOVED_CARDS], fatigue,
  }
  setFlag(state, 'dawnOfTheFinalDayReport', report)
  setFlag(state, 'dawnOfTheFinalDayPrepared', true)
  info(api, `最终日黎明：第 3 日（白昼）· 开幕分支 ${intro} · 疲劳替换 ${fatigue.length} 枚标记。`)
  return report
}

function locationInstance(state, locationId) {
  const base = state.scenario?.locations?.[locationId] || LOCATIONS[locationId]
  if (!base) return null
  const def = clone(base)
  const clues = def.cluesFixed ?? (def.cluesPerInvestigator != null
    ? def.cluesPerInvestigator * investigatorCount(state) : Number(def.clues) || 0)
  return {
    ...def, id: locationId, revealed: true, clues, maxClues: clues,
    connections: [...(def.connections || [])],
    attachments: [], damage: 0, horror: 0, resources: 0, doom: 0,
  }
}

/** 纯内容层放置（引擎路径由 setupLocations 返回 id 交给 placeLocation）。 */
export function placeLocationLocal(state, locationId, api = {}, { revealed = true } = {}) {
  if (locationOf(state, locationId)) return locationOf(state, locationId)
  const instance = locationInstance(state, locationId)
  if (!instance) return null
  instance.revealed = revealed
  if (!revealed) instance.clues = 0
  state.locations = [...(state.locations || []), instance]
  info(api, `「${instance.name}」进入游戏。`)
  return instance
}

export function placeResidentsAtStart(state, api = {}) {
  const placed = []
  for (const entry of RESIDENTS_IN_PLAY_AT_START) {
    if (residentCrossedOut(state, entry.key)) continue
    const asset = placeResidentFromSetAside(state, entry.key, entry.location, api)
    if (asset) placed.push(entry.key)
  }
  const crossed = arrangeResidents(state, api)
  return { placed, crossedOut: crossed }
}

function placeDoomOnAgenda(state, api = {}) {
  const amount = investigatorCount(state)
  if (typeof api.addDoom === 'function') api.addDoom(amount)
  else state.doom = (Number(state.doom) || 0) + amount
  info(api, `在议程上放置 ${amount} 点毁灭（等于调查员人数）。`)
  return amount
}

/** 引擎真实入口：setup.js 在布置地点之前调用。 */
export function preScenarioSetup(state, eventsArg = [], api = {}) {
  void eventsArg
  const report = prepareScenario(state, api)
  return { ...report, introText: introSections(state) }
}

/** 引擎真实入口：setup.js#setupScenarioLocations（返回要 placeLocation 的地点 id 列表）。 */
export function setupLocations(state, eventsArg = null, helper = {}) {
  void eventsArg
  const api = helper?.api || helper
  prepareScenario(state, api)
  placeDoomOnAgenda(state, api)
  return [...LOCATION_IDS]
}

export function setupEnemies() {
  // 序曲开局没有敌人（Miasmatic Shadow 只在 Codex 7 生成）。
}

/** 引擎真实入口：setup.js#setupScenarioDecks 之后（地点已全部入场）。 */
export function afterDeckSetup(state, eventsArg = null, helper = {}) {
  void eventsArg
  const api = helper?.api || helper
  prepareScenario(state, api)
  putTimeMarkerInPlay(state, api)
  const residents = placeResidentsAtStart(state, api)
  return {
    day: 3, period: 'day', locationCount: (state.locations || []).length,
    timeMarkerCode: TIME_MARKER_CODE, residentsInPlay: residents.placed,
    crossedOut: residents.crossedOut, setAsideCards: [...setAsideZone(state)],
  }
}

/** 直调/单测入口：准备 + 8 地点入场 + 时间标记/居民 + 毁灭。 */
export function setupScenario(state, api = {}) {
  state.locations = []
  state.enemies ||= []
  state.storyAssets = []
  state.scenarioFlags ||= {}
  delete state.scenarioFlags.dawnOfTheFinalDayPrepared
  delete state.scenarioFlags.dawnOfTheFinalDayReport
  const report = prepareScenario(state, api)
  for (const id of LOCATION_IDS) placeLocationLocal(state, id, api, { revealed: true })
  state.investigators ||= []
  for (const inv of state.investigators) if (!inv.location) inv.location = START_LOCATION
  placeDoomOnAgenda(state, api)
  const after = afterDeckSetup(state, null, { api })
  info(api, `最终日黎明布置完成：${state.locations.length} 处地点、${after.residentsInPlay.length} 名初始居民。`)
  return { ...report, ...after, placedIds: [...LOCATION_IDS], doom: Number(state.doom) || 0 }
}

// ---------------------------------------------------------------------------
// 行动（地点法典 / 居民谈判；规则写在 behavior，供共享卡复用）
// ---------------------------------------------------------------------------
const PARLEY_ENTRY_IDS = Object.freeze(['motherRachel', 'leahAtwood', 'williamHemlock', 'riverHawthorne',
  'gideonMizrah', 'judithPark', 'theoPeters'])

const actionReason = (state, inv, entry) => {
  if (!codexAvailable(state, entry.id)) return '法典已结算'
  const cost = entry.trigger?.cost
  const day = Math.max(1, Number(dateOf(state).day) || 3)
  if (cost?.resourcesPerDay && (Number(inv.resources) || 0) < day) return '资源不足'
  if (cost?.discardPerDay && (inv.hand || []).length < day) return '手牌不足'
  if (entry.id === 'boardingHouse') {
    const available = ['williamHemlock', 'theoPeters', 'riverHawthorne']
      .filter(key => residentPlacementState(state, key) === 'setAside')
    if (!available.length) return '没有可放入场的居民'
  }
  if (entry.kind === 'resident' && codexDone(state, entry.id)) return '法典已结算'
  return null
}

/** 引擎读点：补充可执行行动（地点卡 [action] 与居民 [action] Parley）。 */
export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const moves = []
  const here = inv.location
  // 居民谈判（母瑞秋/朱迪斯开局在场；其余由法典 9/11/13 放入）。
  for (const entryId of PARLEY_ENTRY_IDS) {
    const entry = CODEX_ENTRIES[entryId]
    const asset = residentAssetInPlay(state, entry.resident)
    if (!asset || asset.location !== here) continue
    const reason = actionReason(state, inv, entry)
    const trigger = entry.trigger || {}
    const skillText = trigger.skills ? trigger.skills.join('/') : trigger.skill
    moves.push({
      action: 'scenarioAction',
      rule: `dawnOfTheFinalDayCodex_${entryId}`,
      codex: entryId,
      actionKind: 'parley',
      actions: trigger.actions || 1,
      label: `谈判：${SCENARIO_TEXT.codex.titles[entryId] || RESIDENT_BY_KEY[entry.resident]?.name || entryId}`
        + `（法典 ${entry.number}${skillText ? `，${skillText} ${trigger.difficulty}` : ''}）`,
      ...(reason ? { reason } : {}),
    })
  }
  // 地点法典（Codex 9 额外行动选项单独列出）。
  for (const entry of CODEX_ENTRY_LIST) {
    if (entry.kind !== 'location' || entry.location !== here) continue
    const reason = actionReason(state, inv, entry)
    const actionsCost = entry.trigger?.actions || 1
    const actionKind = entry.id === 'tadsGeneralStore' ? 'parley' : 'action'
    moves.push({
      action: 'scenarioAction',
      rule: `dawnOfTheFinalDayCodex_${entry.id}`,
      codex: entry.id,
      actionKind,
      actions: actionsCost,
      label: `法典 ${entry.number}：${SCENARIO_TEXT.codex.titles[entry.id] || entry.id}`,
      ...(reason ? { reason } : {}),
    })
    if (entry.extraActions && locationOf(state, entry.location)) {
      for (const extra of [1, 2]) {
        moves.push({
          action: 'scenarioAction',
          rule: `dawnOfTheFinalDayCodex_${entry.id}_extra${extra}`,
          codex: entry.id,
          extraActions: extra,
          actionKind,
          actions: actionsCost + extra,
          label: `法典 ${entry.number}：${SCENARIO_TEXT.codex.titles[entry.id] || entry.id}`
            + `（额外选 ${extra} 项，共 ${actionsCost + extra} 行动）`,
          ...(reason ? { reason } : {}),
        })
      }
    }
  }
  return moves
}

export function actionKind(state, inv, move) {
  void state
  void inv
  return move?.actionKind || null
}

/** 引擎读点：执行法典行动（居民谈判先做卡面检定/费用，再进法典）。 */
export function performAction(state, inv, move, api = {}) {
  if (!move || !String(move.rule || '').startsWith('dawnOfTheFinalDayCodex_')) return false
  const entryId = move.codex
  const entry = codexEntry(entryId)
  if (!entry) return false
  const seat = inv.seat
  if (entry.kind === 'resident') {
    const trigger = entry.trigger || {}
    // 卡面费用（Judith：X 资源；Theo：弃 X 张手牌；Gideon：2 行动由 actions 计数处理）。
    if (trigger.cost?.resourcesPerDay) {
      const amount = Math.max(1, Number(dateOf(state).day) || 3)
      if ((Number(inv.resources) || 0) < amount) {
        info(api, '资源不足，无法支付谈判费用。')
        return false
      }
      spendResources(state, inv, amount, api)
    }
    if (trigger.cost?.discardPerDay) {
      const amount = Math.max(1, Number(dateOf(state).day) || 3)
      if ((inv.hand || []).length < amount) {
        info(api, '手牌不足，无法支付谈判费用。')
        return false
      }
      discardCards(state, inv, amount, api)
    }
    // 谈判检定（有技能/难度时；失败不结算法典，可再次触发）。
    if (trigger.skill || trigger.skills) {
      const skills = trigger.skills || [trigger.skill]
      const skill = skills.length > 1
        ? (typeof api.choose === 'function'
          ? api.choose({ kind: 'choice', seat, source: entry.id, prompt: '选择谈判技能。',
            options: skills.map(id => ({ id, label: id })) })
          : skills[0])
        : skills[0]
      let result = { success: true }
      if (typeof api.test === 'function') {
        api.test(seat, skill, trigger.difficulty, resolved => { result = resolved || result })
      }
      if (result?.success !== true) {
        info(api, '谈判失败：本次不结算法典（可再次触发）。')
        return true
      }
    }
    return readCodex(state, entry.id, { seat }, api).ok
  }
  return readCodex(state, entry.id, { seat, extraActions: move.extraActions || 0 }, api).ok
}

// ---------------------------------------------------------------------------
// 幕 / 议程背面
// ---------------------------------------------------------------------------
export function actReveal(state, act, api = {}) {
  if (codeOf(act) !== ACT1_CODE) return false
  for (const inv of activeInvestigators(state)) applyBlissChoice(state, inv, api)
  // 「You earn 2 bonus experience」对每位调查员各一次（不是每人各发一次全队经验）。
  grantBonusXp(state, 2, api)
  setFlag(state, 'dawnOfTheFinalDayBliss', true)
  return true
}

export function agendaReveal(state, agenda, api = {}) {
  if (codeOf(agenda) !== AGENDA1_CODE) return false
  const epiphany = recordsFor(state)[RECORD_KEYS.bertieHadAnEpiphany] === true
  const key = epiphany ? 'resolution2' : 'resolution1'
  info(api, `议程 1 背面「Bertie's Choice」→ ${key}。`)
  if (typeof api.finish === 'function') api.finish(key)
  else setFlag(state, 'dawnOfTheFinalDayPendingResolution', key)
  return true
}

/** 幕目标「Talk to the locals」没有可计量条件（参考实现也没有 AdvanceAct）。 */
export function checkObjectives() {
  return false
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
const isParleyAttempt = state => state?.skillTest?.actionKind === 'parley' || state?.skillTest?.parley === true

export function resolveChaosToken(state, inv, token, api = {}) {
  const parley = isParleyAttempt(state)
  const result = preludeChaosToken(state, token, { parley, handSize: (inv?.hand || []).length })
  if (!result) return null
  if (result.autoSucceed) safeCall(api, 'setTestAutoSuccess')
  return { delta: result.delta, drawAnother: result.revealAnother, onDraw: [], onFail: [] }
}

export function chaosTokenValue(state, tokenFace, inv) {
  const parley = isParleyAttempt(state)
  return preludeChaosTokenValue(state, tokenFace, { parley, handSize: (inv?.hand || []).length })
}

export function applyTokenEffect() {
  // 10704 四档没有「检定后」子句：谈判自动成功/再揭示一枚已在 resolveChaosToken 处理。
  return false
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
/** 被击败（killed）调查员的替补经验：half the earned experience, rounded up。 */
export const killedInvestigatorXpShare = xp => Math.ceil(Math.max(0, Number(xp) || 0) / 2)

/** Intro 3「More survey assistance has arrived」：列出可替补的调查员与半数经验。 */
export function survivorUpgradePlan(state) {
  const roster = state.campaign?.investigators || {}
  return Object.entries(roster).flatMap(([seat, record]) => {
    if (!record || record.status !== 'killed') return []
    const earned = Math.max(0, Number(record.earnedXp) || 0)
    return [{ seat: Number(seat), id: record.id || null, code: record.code || null,
      earnedXp: earned, halfXp: killedInvestigatorXpShare(earned) }]
  })
}

export function resolution(state, key, eventsArg = [], api = {}) {
  void eventsArg
  const requested = RESOLUTION_KEYS.includes(String(key)) ? String(key) : 'noResolution'
  const finalKey = RESOLUTION_RECORD[requested] || 'resolution2'
  const records = recordsFor(state)
  const flags = flagsFor(state)
  flags.dawnOfTheFinalDayResolutionEntry = requested
  flags.dawnOfTheFinalDayResolution = finalKey
  // 战役记录（records.js 的 `dawnOfTheFinalDayResolution` / `ResolvedTo` 两个 string 键）。
  records.dawnOfTheFinalDayResolution = requested
  records.dawnOfTheFinalDayResolvedTo = finalKey

  if (requested === 'noResolution') {
    // 「Place 1 doom on the lead investigator's investigator card.」——引擎的 doom 总计只读
    // 敌人/地点/受控卡与议程（rules-state.js#doomCards），调查员卡上的毁灭不入总计；
    // 这里把标记记在调查员实例上并披露近似。
    const lead = state.investigators?.[state.campaign?.leadSeat ?? 0] || state.investigators?.[0] || null
    if (lead) {
      lead.doom = (Number(lead.doom) || 0) + 1
      info(api, `无结局：在队长「${lead.name}」的调查员卡上放置 1 点毁灭。`)
    }
  }
  if (requested === 'resolution1') {
    records[RECORD_KEYS.drMarquesHasAHunch] = true
    info(api, 'Resolution 1：在战役日志记录 Dr. Marquez has a hunch。')
  }
  // Resolution 2（noResolution / resolution1 / resolution2 都收敛到这里）。
  const tally = planTally(state)
  const need = investigatorCount(state)
  flags.dawnOfTheFinalDayFireworks = tally
  if (tally >= need) {
    records[RECORD_KEYS.theValeIsFullOfFireworks] = true
    info(api, `The plan is underway 有 ${tally} 道 tally（≥ ${need}）：记录 The Vale is full of fireworks。`)
  } else {
    info(api, `The plan is underway 只有 ${tally} 道 tally（< ${need}）：不记录 The Vale is full of fireworks。`)
  }
  flags.dawnOfTheFinalDaySurveyChoices = surveyChoices(state).map(option => option.id)
  info(api, 'Resolution 2：结算本序曲奖励经验，并整备下一次勘察（保留 1 张支援 / 弃到开手牌 / 资源上限）。')
  return {
    award: true,
    bonus: 0,
    survey: { destinations: [...SURVEY_DESTINATIONS], available: flags.dawnOfTheFinalDaySurveyChoices },
    fireworks: tally,
  }
}

export function storyResolutionKey(state, key) {
  void state
  return RESOLUTION_RECORD[String(key)] || 'resolution2'
}

export function scenarioResolution(state, resolutionKey = 'resolution2', api = {}) {
  resolution(state, resolutionKey, [], api)
  const records = recordsFor(state)
  return {
    resolution: flagsFor(state).dawnOfTheFinalDayResolution || 'resolution2',
    entry: flagsFor(state).dawnOfTheFinalDayResolutionEntry || resolutionKey,
    fireworks: planTally(state),
    theValeIsFullOfFireworks: records[RECORD_KEYS.theValeIsFullOfFireworks] === true,
    theInvestigatorsLearnedTheirPlace: records[RECORD_KEYS.theInvestigatorsLearnedTheirPlace] === true,
    drMarquesHasAHunch: records[RECORD_KEYS.drMarquesHasAHunch] === true,
    survivors: survivorUpgradePlan(state),
    residents: residentSnapshot(state),
    surveyChoices: surveyChoices(state).map(option => option.id),
  }
}

// ---------------------------------------------------------------------------
// 单卡条目规则读点（本章不建条目；共享卡由各自 worker 落文件）
// ---------------------------------------------------------------------------
const entryFlagsFor = code => {
  const id = String(code)
  if (id === ACT1_CODE) return { actBack: 'theBliss' }
  if (id === AGENDA1_CODE) return { agendaBack: 'bertieChoice', doomThreshold: 6 }
  if (id === TIME_MARKER_CODE) return { timeMarker: 'dayThree', story: true }
  const resident = RESIDENT_BY_ASSET_CODE[id]
  if (resident) {
    const entry = CODEX_IDS.map(entryId => CODEX_ENTRIES[entryId])
      .find(row => row.resident === resident.key)
    return entry ? {
      codex: entry.id, codexNumber: entry.number, resident: resident.key,
      parley: entry.trigger?.type === 'parley', ...(entry.trigger?.skill ? { parleySkill: entry.trigger.skill } : {}),
      ...(entry.trigger?.difficulty ? { parleyDifficulty: entry.trigger.difficulty } : {}),
      ...(entry.trigger?.actions ? { parleyActions: entry.trigger.actions } : {}),
    } : { resident: resident.key, setAside: true }
  }
  const enemy = RESIDENT_BY_ENEMY_CODE[id]
  if (enemy) return { residentEnemy: enemy.key, setAside: !['motherRachel', 'judithPark'].includes(enemy.key) }
  const locationEntry = CODEX_IDS.map(entryId => CODEX_ENTRIES[entryId])
    .find(row => row.kind === 'location' && row.location === LOCATION_IDS.find(locationId =>
      LOCATIONS[locationId].code === id))
  if (locationEntry) return { codex: locationEntry.id, codexNumber: locationEntry.number, locationAction: true }
  if (id === MIASMATIC_SHADOW_CODE) return { setAside: true, spawnCodex: 7 }
  if (id === '10725') return { setAside: true }
  if (REMOVED_CARDS.includes(id)) return { removed: true }
  return {}
}

export function implementedEntryFlags(code) {
  return Object.freeze(entryFlagsFor(code))
}

// ---------------------------------------------------------------------------
// 装配
// ---------------------------------------------------------------------------
export const behavior = {
  id: CHAPTER_ID,
  locationsStartRevealed: true,
  startLocation: () => START_LOCATION,
  introduction,
  preScenarioSetup,
  prepareScenario,
  setupLocations,
  setupEnemies,
  afterDeckSetup,
  setupScenario,
  actions,
  actionKind,
  performAction,
  actReveal,
  agendaReveal,
  checkObjectives,
  resolveChaosToken,
  chaosTokenValue,
  applyTokenEffect,
  resolution,
  storyResolutionKey,
  scenarioResolution,
  events,
  // 读点/工具（测试与战役层共用）
  introBranchKey,
  introSections,
  dateOf,
  readCodex,
  codexEvent,
  codexAvailable,
  codexBranch,
  codexDone,
  codexTextKeys,
  CODEX_ENTRY_LIST,
  planTally,
  hasPlanUnderway,
  relationshipLevel,
  addRelationship,
  residentNote,
  addResidentNote,
  residentCrossedOut,
  crossedOutResidentKeys,
  residentSnapshot,
  residentPlacementState,
  residentsInPlay,
  residentAssetInPlay,
  residentsInPlayCount: state => residentsInPlay(state).length,
  surveyedArea,
  surveyedScenario,
  surveyChoices,
  chooseNextSurvey,
  surveyParcel,
  surveyAllows,
  remember,
  isRemembered,
  grantBonusXp,
  heirloomCandidates,
  removeHeirloom,
  lowRelationshipResidents,
  applyFatigue,
  putTimeMarkerInPlay,
  timeMarkerInPlay,
  placeLocationLocal,
  placeResidentFromSetAside,
  placeResidentsAtStart,
  killedInvestigatorXpShare,
  survivorUpgradePlan,
  implementedEntryFlags,
  isHardSide,
  normalizeTokenFace,
  CHAOS_TOKEN_FACES,
  lowerChaosToken,
}

export { CHAOS_TOKEN_FACES as TOKEN_FACES, TIME_MARKER_CODES, RESIDENT_MAX_LEVEL, SET_ASIDE_CARDS, GATHER_GROUPS, GATHER_SET_ASIDE_GROUPS }
export { ENCOUNTER_DECK, FRENZIED_REVELER_CODE, IN_PLAY_CARDS, CODEX_IDS, HEIRLOOM_CODES, REMOVED_CARDS, REMOVED_LOCATION_CODES, REMOVED_STAGE_CODES, LOCATION_CONNECTIONS, RESIDENTS_SET_ASIDE_CARDS }
