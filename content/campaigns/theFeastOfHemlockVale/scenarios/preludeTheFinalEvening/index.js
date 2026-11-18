// 最终之夜（preludeTheFinalEvening · 10679b）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：startLocation / preScenarioSetup /
// setupLocations / setupEnemies / afterDeckSetup / afterChaosBagSetup / codexEntry
// （= events.preludeTheFinalEveningCodex）/ enemyDefeated / checkObjectives / actReveal /
// agendaReveal / resolveChaosToken / applyTokenEffect / afterTest / resolution / allResigned。
//
// 与共享遭遇组 worker 的接线约定（主进程合并时确认）：
//   · 居民双面卡（10693–10703 / 10693b–10701b）、狂乱的赴宴者（10692）、Day of the Feast 的
//     地点/议程（10688/10689/10690b/10691b）与 The Vale 的六个地点（10705a…10712a）的单卡条目
//     由共享组 worker 提供；本序曲只负责布置、关系等级、法典与结局。
//   · 地点/居民/[action] 的法典触发调用 `api.resolveScenarioEvent('preludeTheFinalEveningCodex',
//     { seat, entry })`（entry 见 CODEX_IDS），或直接用 `api.interactions.fhv.codex.read`。
import {
  scenario, identities, CHAPTER_ID, REFERENCE_CODE, STEP_CODE, ENCOUNTER_CODE, IS_PRELUDE,
  DAY_NUMBER, PRELUDE_DATE, PRELUDE_DATE_RECORD, TIME_MARKER, TIME_MARKER_CODE,
  GATHER_GROUPS, GATHER_SET_ASIDE_GROUPS, LOCATIONS, LOCATION_CONNECTIONS, LOCATION_COORDINATES,
  LOCATION_IDS, LOCATION_TABLE, MAP_GRID, SYMBOL_BY_LOCATION, LOCATION_CONNECTION_ICONS,
  LOCATION_ID_BY_SYMBOL, PRELUDE_SYMBOLS, REMOVED_LOCATIONS, REMOVED_LOCATION_CODES,
  START_LOCATION, START_LOCATION_WHEN_INTERRUPTED, THE_ATWOOD_HOUSE_ID, THE_COMMONS_ID,
  THE_CROSSROADS_ID, THE_OLD_MILL_ID, HEMLOCK_CHAPEL_ID, VALE_SCHOOLHOUSE_ID, BOARDING_HOUSE_ID,
  STAGE_CARD_CODE, ACT_ID, AGENDA_ID, ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, ACTS,
  AGENDAS, ACT_CODE_BY_STAGE, AGENDA_CODE_BY_STAGE, AGENDA_DOOM_THRESHOLD,
  SPECIAL_AGENDA_CODE, SPECIAL_AGENDA_STAGE, SPECIAL_AGENDA_DOOM_THRESHOLD,
  RESIDENTS, RESIDENT_BY_ID, RESIDENT_BY_ASSET_CODE, RESIDENT_BY_ENEMY_CODE,
  RESIDENT_ASSET_CODES, RESIDENT_ENEMY_CODES, RESIDENT_PLACEMENT_ORDER, RESIDENT_FLIP_THRESHOLDS,
  RESIDENT_MAX_RELATIONSHIP, SET_ASIDE_RESIDENT_IDS, DR_MARQUEZ_CODE, BERTIE_ASSET_CODE,
  BERTIE_ENEMY_CODE, FRENZIED_REVELER_CODE, FRENZIED_REVELER_SPAWN,
  CODEX_ENTRIES, CODEX_IDS, CODEX_BY_ID, CODEX_SPEC, CODEX_BONUS_XP, CODEX_BRANCH_FALLBACK,
  CODEX_LIMIT_SCENARIO, CODEX_LIMIT_UNLIMITED, THEATWOOD_HASHING_RECORD, ATWOOD_HOUSE_LABEL_KEYS,
  SET_ASIDE_CARDS, ENCOUNTER_DECK, UNUSED_ENCOUNTER_CODES, HEIRLOOM_CODES, PRELUDE_HEIRLOOM_REWARDS,
  RECORD_KEYS, RESOLUTION_KEYS, NO_RESOLUTION, RESOLUTION_ORDER, NEXT_SCENARIO_ID,
  REPLAY_LABEL_KEY, LOSE_CAMPAIGN_LABEL_KEY, SCENARIO_TEXT, SETUP_STEPS, SETUP_STEP_KEYS, CARD_DATA,
} from './definition.js'
import { layout } from './layout.js'
import {
  behavior, implementedEntryFlags, approximations, scenarioSummary, hemlocksHashingItOut,
} from './behavior.js'
import {
  THE_FINAL_EVENING_TOKEN_MEANINGS, TOKEN_MEANINGS, CHAOS_TOKEN_FACES, isHardSide, difficultySide,
  dayNumber, periodOfDay, isParleyAttempt, theFinalEveningChaosToken, theFinalEveningChaosTokenValue,
  tokenMeaningsFor,
} from './chaos.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export {
  scenario, identities, layout, behavior, implementedEntryFlags, approximations, scenarioSummary,
  hemlocksHashingItOut,
  CHAPTER_ID, REFERENCE_CODE, STEP_CODE, ENCOUNTER_CODE, IS_PRELUDE, DAY_NUMBER, PRELUDE_DATE,
  PRELUDE_DATE_RECORD, TIME_MARKER, TIME_MARKER_CODE, GATHER_GROUPS, GATHER_SET_ASIDE_GROUPS,
  LOCATIONS, LOCATION_CONNECTIONS, LOCATION_COORDINATES, LOCATION_IDS, LOCATION_TABLE, MAP_GRID,
  SYMBOL_BY_LOCATION, LOCATION_CONNECTION_ICONS, LOCATION_ID_BY_SYMBOL, PRELUDE_SYMBOLS,
  REMOVED_LOCATIONS, REMOVED_LOCATION_CODES, START_LOCATION, START_LOCATION_WHEN_INTERRUPTED,
  THE_ATWOOD_HOUSE_ID, THE_COMMONS_ID, THE_CROSSROADS_ID, THE_OLD_MILL_ID, HEMLOCK_CHAPEL_ID,
  VALE_SCHOOLHOUSE_ID, BOARDING_HOUSE_ID, STAGE_CARD_CODE, ACT_ID, AGENDA_ID, ACT_CODES,
  AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, ACTS, AGENDAS, ACT_CODE_BY_STAGE, AGENDA_CODE_BY_STAGE,
  AGENDA_DOOM_THRESHOLD, SPECIAL_AGENDA_CODE, SPECIAL_AGENDA_STAGE, SPECIAL_AGENDA_DOOM_THRESHOLD,
  RESIDENTS, RESIDENT_BY_ID, RESIDENT_BY_ASSET_CODE, RESIDENT_BY_ENEMY_CODE, RESIDENT_ASSET_CODES,
  RESIDENT_ENEMY_CODES, RESIDENT_PLACEMENT_ORDER, RESIDENT_FLIP_THRESHOLDS, RESIDENT_MAX_RELATIONSHIP,
  SET_ASIDE_RESIDENT_IDS, DR_MARQUEZ_CODE, BERTIE_ASSET_CODE, BERTIE_ENEMY_CODE, FRENZIED_REVELER_CODE,
  FRENZIED_REVELER_SPAWN, CODEX_ENTRIES, CODEX_IDS, CODEX_BY_ID, CODEX_SPEC, CODEX_BONUS_XP,
  CODEX_BRANCH_FALLBACK, CODEX_LIMIT_SCENARIO, CODEX_LIMIT_UNLIMITED, THEATWOOD_HASHING_RECORD,
  ATWOOD_HOUSE_LABEL_KEYS, SET_ASIDE_CARDS, ENCOUNTER_DECK, UNUSED_ENCOUNTER_CODES, HEIRLOOM_CODES,
  PRELUDE_HEIRLOOM_REWARDS, RECORD_KEYS, RESOLUTION_KEYS, NO_RESOLUTION, RESOLUTION_ORDER,
  NEXT_SCENARIO_ID, REPLAY_LABEL_KEY, LOSE_CAMPAIGN_LABEL_KEY, SCENARIO_TEXT, SETUP_STEPS,
  SETUP_STEP_KEYS, CARD_DATA,
  THE_FINAL_EVENING_TOKEN_MEANINGS, TOKEN_MEANINGS, CHAOS_TOKEN_FACES, isHardSide, difficultySide,
  dayNumber, periodOfDay, isParleyAttempt, theFinalEveningChaosToken, theFinalEveningChaosTokenValue,
  tokenMeaningsFor,
}

// 本序曲不新建任何单卡条目（input.cards / input.entryPaths 均为空）：相关卡面（Residents 20 面、
// 狂乱的赴宴者、两张傍晚地点、Around the Table 幕/议程、待宰羔羊、第三夜时间指示卡）由共享遭遇组
// worker 注册；提示卡 10679b 与参考卡 10704 是剧本自身，不建条目。
export const implementedEncounterCodes = Object.freeze([])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theFeastOfHemlockVale',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'fhvCampaign'],
  requiredEncounterGroupIds: [...GATHER_GROUPS],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  // 放一边：整组 Residents（20 面）+ 特别议程「待宰羔羊」；地点另见移出游戏清单。
  setAsideAliases: [...SET_ASIDE_CARDS],
  // 开局即在场：第三夜时间指示卡（其余在场卡由 relation/记录决定，见 behavior.setupPlan）。
  inPlayAliases: [TIME_MARKER_CODE],
  recordReads: [
    PRELUDE_DATE_RECORD, RECORD_KEYS.drMarquezHasAPlan, RECORD_KEYS.areasSurveyedNorthPointMine,
    RECORD_KEYS.bertieHadAnEpiphany, RECORD_KEYS.interrupted, RECORD_KEYS.believed,
    RECORD_KEYS.lied, RECORD_KEYS.valeIsFullOfFireworks,
    ...RESIDENTS.flatMap(row => [row.record.level, row.record.notes, row.record.crossedOut]),
  ],
  recordWrites: [
    PRELUDE_DATE_RECORD, RECORD_KEYS.believed, RECORD_KEYS.lied, RECORD_KEYS.interrupted,
    RECORD_KEYS.bertiePerished, RECORD_KEYS.gideonFinishedTheTaleOfAnnabelleLee,
    RECORD_KEYS.theHemlocksMadeATruce, RECORD_KEYS.resolution, RECORD_KEYS.nextStep,
    RECORD_KEYS.codexRead, RECORD_KEYS.replayRequested, RECORD_KEYS.campaignLost,
    THEATWOOD_HASHING_RECORD,
    ...RESIDENTS.flatMap(row => [row.record.level, row.record.notes, row.record.crossedOut]),
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = REFERENCE_CODE
manifest.stepCode = STEP_CODE
manifest.isPrelude = IS_PRELUDE
// 序曲没有遭遇牌库（hasEncounterDeckL .~ False）：牌库区为空、机制里也声明了 noEncounterDeck。
manifest.preludeDate = { ...PRELUDE_DATE }
manifest.timeMarkerCode = TIME_MARKER_CODE
manifest.removedLocationCodes = [...REMOVED_LOCATION_CODES]
manifest.nextScenarioId = NEXT_SCENARIO_ID
manifest.codexIds = [...CODEX_IDS]
manifest.residentIds = RESIDENTS.map(row => row.id)
