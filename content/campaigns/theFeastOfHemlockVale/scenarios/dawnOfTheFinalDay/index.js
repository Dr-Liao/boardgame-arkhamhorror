// 最终日黎明（dawnOfTheFinalDay · 序曲 3 · 10679a）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：introduction / preScenarioSetup /
// setupLocations / afterDeckSetup / actions + actionKind + performAction / actReveal /
// agendaReveal / checkObjectives / resolveChaosToken / chaosTokenValue / resolution /
// storyResolutionKey。
//
// 与其它章不同：本序曲没有本章专属非玩家条目（input.entryPaths 为空），卡面规则全部在
// definition + behavior；The Vale / Day of the Feast / Residents 组由共享组 worker 落条目，
// 可读 `implementedEntryFlags(code)` 拿到本章对那张卡的规则声明（法典编号/谈判技能/放一边）。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES,
  CODEX_ENTRIES, CODEX_IDS, CODEX_BY_NUMBER, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, GATHER_GROUPS,
  GATHER_SET_ASIDE_GROUPS, SET_ASIDE_CARDS, IN_PLAY_CARDS, RESOLUTION_KEYS, RESOLUTION_RECORD,
  RECORD_KEYS, LOCATIONS, LOCATION_CONNECTIONS, LOCATION_COORDINATES, LOCATION_IDS, LOCATION_SYMBOLS,
  START_LOCATION, START_LOCATION_IDS, TIME_MARKER_CODE, TIME_MARKER_CODES, STORY_CODES, SET_ASIDE_LOCATION_IDS,
  REMOVED_CARDS, REMOVED_LOCATION_CODES, REMOVED_STAGE_CODES, HEIRLOOM_CODES,
  RESIDENT_SPECS, RESIDENT_RECORDS, RESIDENT_BY_KEY, RESIDENT_ASSET_CODES, RESIDENT_ENEMY_CODES,
  RESIDENT_MAX_LEVEL, RESIDENTS_IN_PLAY_AT_START, RESIDENTS_SET_ASIDE_CARDS, AGENTS_SET_ASIDE_CARDS,
  MIASMATIC_SHADOW_CODE, ALIEN_WHISPERS_CODE, OTHERWORLDLY_VISIONS_CODE, FRENZIED_REVELER_CODE,
  SURVEY_DESTINATIONS, SURVEY_DESTINATION_LABELS, SURVEY_AREAS,
  preludeSection, htmlToText, ENEMY_DEFINITIONS, TREACHERY_DEFINITIONS, STORY_ASSET_DEFINITIONS,
} from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEntryFlags } from './behavior.js'
import {
  PRELUDE_TOKEN_MEANINGS, PRELUDE_TOKEN_TEXT, CHAOS_TOKEN_FACES, FATIGUE_REPLACEMENT_COUNT,
  isEasyStandard, isHardSide, preludeChaosToken, preludeChaosTokenValue, skullValue,
  tabletValue, cultistValue, elderThingValue, lowerChaosToken, fatigueReplacementPlan,
} from './chaos.js'
import { scenarioManifest, countZone } from '../../../../scenario-manifest.js'

export {
  scenario, identities, layout, behavior, implementedEntryFlags, CARD_DATA, SCENARIO_TEXT,
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, CODEX_ENTRIES, CODEX_IDS, CODEX_BY_NUMBER,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, GATHER_GROUPS, GATHER_SET_ASIDE_GROUPS, SET_ASIDE_CARDS,
  IN_PLAY_CARDS, RESOLUTION_KEYS, RESOLUTION_RECORD, RECORD_KEYS, LOCATIONS, LOCATION_CONNECTIONS,
  LOCATION_COORDINATES, LOCATION_IDS, LOCATION_SYMBOLS, START_LOCATION, START_LOCATION_IDS,
  TIME_MARKER_CODE, TIME_MARKER_CODES, STORY_CODES, SET_ASIDE_LOCATION_IDS, REMOVED_CARDS,
  REMOVED_LOCATION_CODES,
  REMOVED_STAGE_CODES, HEIRLOOM_CODES, RESIDENT_SPECS, RESIDENT_RECORDS, RESIDENT_BY_KEY,
  RESIDENT_ASSET_CODES, RESIDENT_ENEMY_CODES, RESIDENT_MAX_LEVEL, RESIDENTS_IN_PLAY_AT_START,
  RESIDENTS_SET_ASIDE_CARDS, AGENTS_SET_ASIDE_CARDS, MIASMATIC_SHADOW_CODE, ALIEN_WHISPERS_CODE,
  OTHERWORLDLY_VISIONS_CODE, FRENZIED_REVELER_CODE, SURVEY_DESTINATIONS, SURVEY_DESTINATION_LABELS,
  SURVEY_AREAS, ENEMY_DEFINITIONS, TREACHERY_DEFINITIONS, STORY_ASSET_DEFINITIONS,
  PRELUDE_TOKEN_MEANINGS, PRELUDE_TOKEN_TEXT, CHAOS_TOKEN_FACES, FATIGUE_REPLACEMENT_COUNT,
  isEasyStandard, isHardSide, preludeChaosToken, preludeChaosTokenValue, skullValue, tabletValue,
  cultistValue, elderThingValue, lowerChaosToken, fatigueReplacementPlan, preludeSection, htmlToText,
}

// 本章不建非玩家条目：卡面规则在 definition/behavior；共享卡由各自 worker 落文件。
export const implementedEncounterCodes = Object.freeze([])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theFeastOfHemlockVale',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'fhvCampaign'],
  // gather 的五个遭遇组（序曲没有遭遇牌库，但这些组的卡会入场/放一边）。
  requiredEncounterGroupIds: [...GATHER_GROUPS],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: scenario.setAsideLocations,
  setAsideAliases: [...SET_ASIDE_CARDS],
  // 开局在场：第三日时间标记 + Mother Rachel / Judith Park（资产面；被划掉时改为移出游戏）。
  inPlayAliases: [...IN_PLAY_CARDS],
  recordReads: [
    'day', 'time', 'hemlockDate', 'remembered', 'areasSurveyed', 'fatiguePending', 'codexRead',
    RECORD_KEYS.drMarquezHasAPlan, RECORD_KEYS.bertieHadAnEpiphany, RECORD_KEYS.thePlanIsUnderway,
    RECORD_KEYS.theThingInTheDepthsWasDefeated, RECORD_KEYS.simeonCrossedOut,
    RECORD_KEYS.williamStoodByYou, RECORD_KEYS.williamTookHeart, RECORD_KEYS.riverStoodByYou,
    RECORD_KEYS.theSchemeIsInMotion, RECORD_KEYS.gideonStoodByYou, RECORD_KEYS.judithStoodByYou,
    RECORD_KEYS.theoStoodByYou,
    ...RESIDENT_SPECS.map(spec => spec.record.level),
    ...RESIDENT_SPECS.map(spec => spec.record.notes),
  ],
  recordWrites: [
    'day', 'time', 'hemlockDate', 'remembered', 'fatiguePending', 'codexRead', 'relationships',
    'dawnOfTheFinalDayResolution', 'dawnOfTheFinalDayResolvedTo',
    RECORD_KEYS.drMarquesHasAHunch, RECORD_KEYS.theValeIsFullOfFireworks,
    RECORD_KEYS.thePlanIsUnderway, RECORD_KEYS.theInvestigatorsLearnedTheirPlace,
    RECORD_KEYS.williamIsResolved, RECORD_KEYS.riverIsReclaimingTheirLegacy,
    RECORD_KEYS.youBackedJudithUp, RECORD_KEYS.theoIsHavingSecondThoughts,
    RECORD_KEYS.youAreDeliveringAPackage,
    ...RESIDENT_SPECS.map(spec => spec.record.level),
    ...RESIDENT_SPECS.map(spec => spec.record.notes),
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '10679a'
manifest.stepCode = '10679a'
manifest.kind = 'prelude'
manifest.isPrelude = true
manifest.textLanguage = SCENARIO_TEXT.textLanguage
manifest.textStatus = SCENARIO_TEXT.textStatus
// 移出游戏：其它幕/议程 + The Vale 与 Day of the Feast 的另一面 Crossroads / Old Mill。
manifest.zones.removed = countZone(scenario, [...REMOVED_CARDS])
