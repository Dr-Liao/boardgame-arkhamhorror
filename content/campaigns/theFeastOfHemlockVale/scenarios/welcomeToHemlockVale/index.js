// 欢迎来到铁杉谷（welcomeToHemlockVale · 提示卡 10704）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：preScenarioSetup / introduction / startLocation /
// setupLocations / locationPlaced / afterDeckSetup / actions + performAction / afterInvestigate /
// actReveal / agendaReveal / checkObjectives / allResigned / resolveChaosToken / applyTokenEffect /
// resolution / events。
//
// 本序曲不建任何单卡条目（input.entryPaths 为空；The Vale / The First Day / Day of Rest / Residents
// 都是共享遭遇组，由共享组 worker 建条目）。definition 只通过 card-data.js 与 ALL_CARDS 引用卡号，
// behavior 按卡号读点。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, CHINESE_GAPS, TEXT_LANGUAGE, TEXT_STATUS,
  ACT_CODE, ACT_CODES, ACT_STAGES, ACT_OBJECTIVE, ACTS, AGENDA_CODE, AGENDA_CODES, AGENDA_STAGES,
  AGENDA_DOOM_THRESHOLD, AGENDAS, ENCOUNTER_DECK, GATHER_GROUPS, GATHER_SET_ASIDE_GROUPS,
  IN_PLAY_CODES, SET_ASIDE_RESIDENT_CODES, UNUSED_ENCOUNTER_CODES,
  LOCATION_TABLE, LOCATION_IDS, LOCATION_CONNECTIONS, LOCATION_CONNECTION_ICONS, LOCATION_COORDINATES,
  LOCATION_GRID, LOCATION_DAY_CODES, LOCATION_NIGHT_CODES, LOCATION_CODE_BY_ID, LOCATIONS,
  LOCATION_CODEX_NUMBERS, PRELUDE_SYMBOLS, SYMBOL_BY_LOCATION, LOCATION_ID_BY_SYMBOL, START_LOCATION,
  REMOVED_LOCATION_CODES, RESIDENTS, RESIDENT_BY_ID, RESIDENT_BY_ASSET_CODE, RESIDENT_BY_ENEMY_CODE,
  RESIDENT_CODE_BY_ID, RESIDENT_ASSET_CODES, RESIDENT_ENEMY_CODES, RESIDENT_LEVEL_KEYS,
  RESIDENT_NOTE_KEYS, RESIDENT_CROSSED_OUT_KEYS, RESIDENT_PARLEY, RESIDENT_CODEX_NUMBERS,
  RESIDENT_MAX_RELATIONSHIP, CODEX_ENTRIES, CODEX_IDS, CODEX_ENTRY_BY_ID,
  CODEX_ENTRY_BY_NUMBER, CODEX_SPEC, CODEX_BRANCH_PRINTED, CODEX_LIMIT_SCENARIO, CODEX_LIMIT_UNLIMITED,
  SURVEY_DESTINATIONS, SURVEY_LABEL_KEYS, TIME_MARKER, TIME_MARKER_CODE, IS_PRELUDE,
  RECORD_KEYS, RECORD_READS, RECORD_WRITES, RESOLUTION_KEYS, RESOLUTION_RECORD,
  SETUP_STEPS, SETUP_STEP_KEYS, REFERENCE_CODE, CHAPTER_ID, ENCOUNTER_CODE, dayOf, isNight,
} from './definition.js'
import { layout, GRID, SYMBOLS } from './layout.js'
import {
  behavior, implementedEncounterCodes, implementedEntryFlags, RECORD_READ_KEYS, RECORD_WRITE_KEYS,
  syncDayAndTime, timeMarkerInPlay, putTimeMarkerInPlay, placeDoomOnAgenda, residentsInPlay,
  residentInPlay, putResidentInPlay, removeResidentFromPlay, residentRecord, residentLevel, residentOf,
  addResidentRelationship, residentParleySpec, completeResidentParley, codexEntryOf,
  codexNumberForLocation, codexNumberForResident, actionCodexNumberForLocation,
  reactionCodexNumberForLocation, codexEntryForLocation, codexEntryForResident,
  codexEntriesAt, codexAvailable, codexEntryAvailableAt, codexResolved, codexResolvedBy,
  resolvedCodexKeys, resolveCodexEntry, REACTION_CODEX_LOCATIONS, introBranch, introChaosToken,
  applyIntroChaosToken, gainBrilliance, isBrillianceRevealed, completePrelude, resignAll,
  currentAct, currentActCode,
  currentAgenda, currentAgendaCode, agendaDoomReached, isDaytime, setupScenario, prepareScenario,
  preScenarioSetup, introduction, actions, performAction, afterInvestigate, actReveal, agendaReveal,
  checkObjectives, allResigned, resolveChaosToken, chaosTokenValue, applyTokenEffect, resolution,
  scenarioResolution, events, residentParleySpec as parleySpec, ACTIONS, CODEX_ACTION_LABEL,
  PRELUDE_DAY, PRELUDE_PERIOD,
} from './behavior.js'
import {
  WELCOME_TOKEN_MEANINGS, TOKEN_FACES, CALENDAR_RECORD, PRELUDE_DATE, MAX_DAY, dayNumberOf,
  dateOf, dateFromCalendar, dateFromRecord, isHardSide, isParleyTest, investigatorCount,
  skullValue, tabletValue, welcomeChaosToken, welcomeChaosTokenValue, tokenMeaningsFor,
} from './chaos.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export {
  // definition
  scenario, identities, CARD_DATA, SCENARIO_TEXT, CHINESE_GAPS, TEXT_LANGUAGE, TEXT_STATUS,
  ACT_CODE, ACT_CODES, ACT_STAGES, ACT_OBJECTIVE, ACTS, AGENDA_CODE, AGENDA_CODES, AGENDA_STAGES,
  AGENDA_DOOM_THRESHOLD, AGENDAS, ENCOUNTER_DECK, GATHER_GROUPS, GATHER_SET_ASIDE_GROUPS,
  IN_PLAY_CODES, SET_ASIDE_RESIDENT_CODES, UNUSED_ENCOUNTER_CODES,
  LOCATION_TABLE, LOCATION_IDS, LOCATION_CONNECTIONS, LOCATION_CONNECTION_ICONS, LOCATION_COORDINATES,
  LOCATION_GRID, LOCATION_DAY_CODES, LOCATION_NIGHT_CODES, LOCATION_CODE_BY_ID, LOCATIONS,
  LOCATION_CODEX_NUMBERS, PRELUDE_SYMBOLS, SYMBOL_BY_LOCATION, LOCATION_ID_BY_SYMBOL, START_LOCATION,
  REMOVED_LOCATION_CODES, RESIDENTS, RESIDENT_BY_ID, RESIDENT_BY_ASSET_CODE, RESIDENT_BY_ENEMY_CODE,
  RESIDENT_CODE_BY_ID, RESIDENT_ASSET_CODES, RESIDENT_ENEMY_CODES, RESIDENT_LEVEL_KEYS,
  RESIDENT_NOTE_KEYS, RESIDENT_CROSSED_OUT_KEYS, RESIDENT_PARLEY, RESIDENT_CODEX_NUMBERS,
  RESIDENT_MAX_RELATIONSHIP, CODEX_ENTRIES, CODEX_IDS, CODEX_ENTRY_BY_ID,
  CODEX_ENTRY_BY_NUMBER, CODEX_SPEC, CODEX_BRANCH_PRINTED, CODEX_LIMIT_SCENARIO, CODEX_LIMIT_UNLIMITED,
  SURVEY_DESTINATIONS, SURVEY_LABEL_KEYS, TIME_MARKER, TIME_MARKER_CODE, IS_PRELUDE, RECORD_KEYS,
  RECORD_READS, RECORD_WRITES, RESOLUTION_KEYS, RESOLUTION_RECORD, SETUP_STEPS, SETUP_STEP_KEYS,
  REFERENCE_CODE, CHAPTER_ID, ENCOUNTER_CODE, dayOf, isNight,
  // layout
  layout, GRID, SYMBOLS,
  // behavior
  behavior, implementedEncounterCodes, implementedEntryFlags, RECORD_READ_KEYS, RECORD_WRITE_KEYS,
  syncDayAndTime, timeMarkerInPlay, putTimeMarkerInPlay, placeDoomOnAgenda, residentsInPlay,
  residentInPlay, putResidentInPlay, removeResidentFromPlay, residentRecord, residentLevel, residentOf,
  addResidentRelationship, residentParleySpec, parleySpec, completeResidentParley, codexEntryOf,
  codexNumberForLocation, codexNumberForResident, actionCodexNumberForLocation,
  reactionCodexNumberForLocation, codexEntryForLocation, codexEntryForResident,
  codexEntriesAt, codexAvailable, codexEntryAvailableAt, codexResolved, codexResolvedBy,
  resolvedCodexKeys, resolveCodexEntry, REACTION_CODEX_LOCATIONS, introBranch, introChaosToken,
  applyIntroChaosToken, gainBrilliance, isBrillianceRevealed, completePrelude, resignAll,
  currentAct, currentActCode,
  currentAgenda, currentAgendaCode, agendaDoomReached, isDaytime, setupScenario, prepareScenario,
  preScenarioSetup, introduction, actions, performAction, afterInvestigate, actReveal, agendaReveal,
  checkObjectives, allResigned, resolveChaosToken, chaosTokenValue, applyTokenEffect, resolution,
  scenarioResolution, events, ACTIONS, CODEX_ACTION_LABEL, PRELUDE_DAY, PRELUDE_PERIOD,
  // chaos
  WELCOME_TOKEN_MEANINGS, TOKEN_FACES, CALENDAR_RECORD, PRELUDE_DATE, MAX_DAY, dayNumberOf, dateOf,
  dateFromCalendar, dateFromRecord, isHardSide, isParleyTest, investigatorCount, skullValue,
  tabletValue, welcomeChaosToken, welcomeChaosTokenValue, tokenMeaningsFor,
}

// P7 阶段 manifest 直接声明 playable（引擎只装 playable/verified；主进程合并后统一重建索引/注册）。
// 依赖组：Setup 收集的 The First Day / Day of Rest / The Vale + 整组放一边的 Residents。
// 记录键只用本序曲实际读写的键（与战役层 records.js 同口径；不在本 worker 的写入范围）。
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theFeastOfHemlockVale',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'fhvCampaign'],
  requiredEncounterGroupIds: [...GATHER_GROUPS, ...GATHER_SET_ASIDE_GROUPS],
  requiredInvestigatorIds: [],
  // 本序曲没有新增引擎原语：日历/法典/居民/勘察/无遭遇牌库/保护调查员都走既有 scenario.mechanics 读点。
  requiredMechanicIds: [],
  setAsideLocations: scenario.setAsideLocations,
  setAsideAliases: [...SET_ASIDE_RESIDENT_CODES],
  inPlayAliases: [TIME_MARKER_CODE],
  recordReads: [...RECORD_READS],
  recordWrites: [...RECORD_WRITES],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = REFERENCE_CODE
manifest.isPrelude = true
manifest.textLanguage = SCENARIO_TEXT.textLanguage
manifest.textStatus = SCENARIO_TEXT.textStatus
manifest.chineseGaps = [...CHINESE_GAPS]
// 引用卡 + 时间指示卡（Day One / Night One 是同一张卡的两面）。
manifest.storyFaces = Object.keys(scenario.storyFaces)
// 序曲固定日/时段（战役层按此推进时间轴）。
manifest.day = PRELUDE_DAY
manifest.period = PRELUDE_PERIOD
// 下一次勘察的候选（战役层的勘察选择读点）。
manifest.surveyDestinations = [...SURVEY_DESTINATIONS]
