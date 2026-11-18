// 第二日黎明（dawnOfTheSecondDay · 10677a / 参考卡 10704）· 章节装配。
//
// P7 阶段：status 保持 playable（内容层 + behavior 钩子齐全），本章没有单卡条目
// （input.cards / input.entryPaths 为空：地点/幕/议程/居民的行为统一由 behavior.js 承担）。
// 单测直接 import 本章五件套，不依赖 content/registered.js；主进程合并后统一重建索引/注册。
//
// 与居民共享组（residents 10693–10703）的接线约定（主进程合并时确认）：
//   · 居民资产面 / 地点的 [action] 法典触发调用 behavior.events 的
//     `dawnSecondCodexMotherRachel` / `...SimeonAtwood` / `...WilliamHemlock` / `...RiverHawthorne` /
//     `...GideonMizrah` / `...JudithPark` / `...TheoPeters`（见 behavior.js#events），或直接
//     `api.resolveScenarioEvent(id, { seat })`；事件键与 CODEX_IDS 一一对应。
//   · 关系等级写 `campaign.records.<resident>RelationshipLevel` / `records.relationships[resident]`，
//     笔记写 `<resident>Notes` 数组（与《汉洛克庄园》《最长一夜》同口径）。
//   · 法典/居民机制走 `scenario.mechanics.codex` / `scenario.mechanics.residents`
//     （scenario-calendar.js / resident-record.js 读点）；整备走 `scenario.mechanics.survey`
//     （survey-preparation.js 读点）。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, CODEX_IDS, CODEX_SPEC, CODEX_BY_LOCATION,
  RESIDENT_KEYS, RESIDENT_RECORDS, RESIDENT_CODES, RESIDENTS_SPEC, RESOLUTION_KEYS, ACT_CODES, AGENDA_CODES,
  ACT_CODE, AGENDA_CODE, LOCATION_IDS, LOCATIONS, LOCATION_CONNECTIONS, ICON_CONNECTIONS, GRID_ADJACENCY,
  LOCATION_COORDINATES, LOCATION_TABLE, LOCATION_CELLS, LOCATION_GRID_TEMPLATE, LOCATION_SYMBOLS, PRELUDE_SYMBOLS,
  START_LOCATION, GATHER_GROUPS, GATHER_GROUP_IDS, SET_ASIDE_ALIASES, SET_ASIDE_RESIDENT_CODES,
  IN_PLAY_ALIASES, RESIDENT_ASSET_CODES, JUDITH_CODE, JUDITH_LOCATION, HEMLOCK_CURSE_CODE, UNUSED_TREACHERY_CODE,
  TIME_MARKER, TIME_MARKER_CODE, STEP_CODE, REFERENCE_CODE, SURVEY_DESTINATIONS, SURVEY_LABELS,
  TEXT_LANGUAGE, TEXT_STATUS, CHINESE_GAPS, PRELUDE_DAY, PRELUDE_PERIOD,
  CODEX_ENTRIES, CODEX_ENTRY_BY_ID, CODEX_ENTRY_BY_NUMBER, RESIDENT_CODEX_NUMBERS, LOCATION_CODEX_NUMBERS,
  CODEX_LIMIT_SCENARIO, CODEX_LIMIT_UNLIMITED,
} from './definition.js'
import { layout } from './layout.js'
import {
  behavior, implementedEntryFlags, scenarioSummary, codex, codexEventIds, resolveCodexEvent,
  relationshipLevel, addRelationship, addNote, notesOf, isRemembered, rememberFact,
  surveyDestinations, surveyedAreas, resolutionChainForKey, PREPARATION_FOR_NEXT_SURVEY, RECORD_KEYS,
  FATIGUE_REPLACEMENT, scenarioApproximations, setupScenario, dayOfDawn, CODEX_NUMBERS,
  agendaCancelsWeakness, cancelWeaknessDraw, codexSeatRead, addCampaignCard,
  codexBranchFor, codexAvailable, codexReadCount, isCodexRead,
} from './behavior.js'
import { DAWN_TOKEN_MEANINGS } from './chaos.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export {
  scenario, identities, layout, behavior, implementedEntryFlags, CARD_DATA, SCENARIO_TEXT,
  CODEX_IDS, CODEX_NUMBERS, CODEX_SPEC, CODEX_BY_LOCATION, RESIDENT_KEYS, RESIDENT_RECORDS, RESIDENT_CODES,
  RESIDENTS_SPEC, RESOLUTION_KEYS, ACT_CODES, AGENDA_CODES, ACT_CODE, AGENDA_CODE,
  LOCATION_IDS, LOCATIONS, LOCATION_CONNECTIONS, ICON_CONNECTIONS, GRID_ADJACENCY, LOCATION_COORDINATES,
  LOCATION_TABLE, LOCATION_CELLS, LOCATION_GRID_TEMPLATE, LOCATION_SYMBOLS, PRELUDE_SYMBOLS, START_LOCATION,
  GATHER_GROUPS, GATHER_GROUP_IDS, SET_ASIDE_ALIASES, SET_ASIDE_RESIDENT_CODES, IN_PLAY_ALIASES,
  RESIDENT_ASSET_CODES, JUDITH_CODE, JUDITH_LOCATION, HEMLOCK_CURSE_CODE, UNUSED_TREACHERY_CODE,
  TIME_MARKER, TIME_MARKER_CODE, STEP_CODE, REFERENCE_CODE, SURVEY_DESTINATIONS, SURVEY_LABELS,
  DAWN_TOKEN_MEANINGS, RECORD_KEYS, PREPARATION_FOR_NEXT_SURVEY, FATIGUE_REPLACEMENT,
  scenarioApproximations, scenarioSummary, codex, codexEventIds, resolveCodexEvent,
  relationshipLevel, addRelationship, addNote, notesOf, isRemembered, rememberFact,
  surveyDestinations, surveyedAreas, resolutionChainForKey, setupScenario, dayOfDawn,
  TEXT_LANGUAGE, TEXT_STATUS, CHINESE_GAPS, PRELUDE_DAY, PRELUDE_PERIOD,
  CODEX_ENTRIES, CODEX_ENTRY_BY_ID, CODEX_ENTRY_BY_NUMBER, RESIDENT_CODEX_NUMBERS, LOCATION_CODEX_NUMBERS,
  CODEX_LIMIT_SCENARIO, CODEX_LIMIT_UNLIMITED, codexSeatRead, addCampaignCard,
  codexBranchFor, codexAvailable, codexReadCount, isCodexRead,
  agendaCancelsWeakness, cancelWeaknessDraw,
}

// 本章没有单卡条目（地点/幕/议程/居民行为在 behavior.js 的章节钩子里）。
export const implementedEncounterCodes = Object.freeze([])
export const behaviorEntryCodes = Object.freeze([])
export const entryCount = 0

const relationshipKeys = RESIDENT_KEYS.flatMap(id => [RESIDENT_RECORDS[id].level, RESIDENT_RECORDS[id].notes])
const crossedOutKeys = RESIDENT_KEYS.map(id => RESIDENT_RECORDS[id].crossedOut)

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theFeastOfHemlockVale',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'fhvCampaign'],
  // 指南 setup 的四个 gather 组（The Second Day / Day of Rain / Residents / The Vale）。
  requiredEncounterGroupIds: [...GATHER_GROUP_IDS],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: [],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  // 开局就在场：Day Two 时间标记 + Judith Park（其余 Residents 放一边）。
  inPlayAliases: [...IN_PLAY_ALIASES],
  recordReads: [
    RECORD_KEYS.day, RECORD_KEYS.time, RECORD_KEYS.hemlockDate, RECORD_KEYS.relationships, RECORD_KEYS.codexRead,
    RECORD_KEYS.remembered, RECORD_KEYS.finishedTheirMeal, RECORD_KEYS.bertieWasRescued,
    RECORD_KEYS.areasSurveyed, RECORD_KEYS.fatigueApplied,
    ...relationshipKeys, ...crossedOutKeys,
  ],
  recordWrites: [
    RECORD_KEYS.day, RECORD_KEYS.time, RECORD_KEYS.hemlockDate, RECORD_KEYS.relationships, RECORD_KEYS.codexRead,
    RECORD_KEYS.remembered, RECORD_KEYS.hemlockCurseAdded, RECORD_KEYS.fatigueApplied,
    RECORD_KEYS.resolution, RECORD_KEYS.resolvedTo,
    ...relationshipKeys,
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = REFERENCE_CODE
manifest.stepCode = STEP_CODE
manifest.isPrelude = true
manifest.day = PRELUDE_DAY
manifest.period = PRELUDE_PERIOD
manifest.textLanguage = TEXT_LANGUAGE
manifest.textStatus = TEXT_STATUS
manifest.chineseGaps = [...CHINESE_GAPS]
manifest.storyFaces = Object.keys(scenario.storyFaces)
manifest.surveyDestinations = [...SURVEY_DESTINATIONS]
// 序曲专属声明（主进程：指南/大厅可读；不是引擎契约字段）。
manifest.prelude = { day: 2, period: 'day', timeMarker: TIME_MARKER, skipSetupSteps: { first: 1, last: 8 } }
manifest.survey = { destinations: [...SURVEY_DESTINATIONS], preparation: [...PREPARATION_FOR_NEXT_SURVEY] }
manifest.approximations = [...scenarioApproximations]
