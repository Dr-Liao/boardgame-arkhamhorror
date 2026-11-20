// 沉睡者墓穴（sepulchreOfTheSleeper）· 章节装配（P7 development）。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：preScenarioSetup / setupLocations /
// afterDeckSetup / canPlaceDoomOn / doomPlaced / agendaReveal / checkObjectives / roundEnded /
// actions + performAction / enemyMoved / enemyDefeated / enemyStatModifier / resolveChaosToken /
// applyTokenEffect / resolution。
//
// 入场/跳过（Campaigns/TheDrownedCity.hs DoStep 1–3）由战役流程层调用 behavior.sepulchreEntry /
// behavior.declineTheNightmare；本模块只负责「让它安息」之后的 Setup 与场景本身。
// resolutionIds 严格按 CONTRACT §6：noResolution + resolution1（en locale 用 Investigator Defeat
// 正文表达 noResolution，不另立结局键）。
import {
  scenario, identities, CARD_DATA, LOCATIONS, LOCATION_IDS, LOCATION_CONNECTIONS, LOCATION_COORDINATES,
  ALCove_IDS, ALCove_OPTIONS, ALCove_CODE, START_LOCATION, AGENDA_CODES, AGENDA_STAGES, STAGE_CARDS,
  AGENDAS, ACTS, ACT_STAGES, BENEATH_THE_CITY_CODE, CTHULHU_AWAKENED_CODE, CTHULHU_CODE,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, GATHER_GROUPS, EXPEDITION_ITEM_CODES, EXPEDITION_CODES,
  ARTIFACT_RECORDS, ARTIFACT_RECORD_KEYS, ARTIFACT_CODE_BY_RECORD, GLYPH_TOTAL,
  RESOLUTION_KEYS, RESOLUTIONS,
} from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEntryFlags, scenarioSummary, sepulchreEntry, artifactsEarned,
  translatedGlyphCount, entryPrepared, entryFullyPrepared, declineTheNightmare } from './behavior.js'
import {
  CTHULHU_TOKEN_MEANINGS, sepulchreChaosToken, sepulchreChaosTokenValue, skullValue, disturbance,
  setDisturbance, increaseDisturbance, disturbanceThreshold, isHardSide, CHAOS_TOKEN_FACES,
} from './chaos.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export {
  scenario, identities, layout, behavior, implementedEntryFlags, scenarioSummary, CARD_DATA,
  LOCATIONS, LOCATION_IDS, LOCATION_CONNECTIONS, LOCATION_COORDINATES, ALCove_IDS, ALCove_OPTIONS,
  ALCove_CODE, START_LOCATION, AGENDA_CODES, AGENDA_STAGES, STAGE_CARDS, AGENDAS, ACTS, ACT_STAGES,
  BENEATH_THE_CITY_CODE, CTHULHU_AWAKENED_CODE, CTHULHU_CODE, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES,
  GATHER_GROUPS, EXPEDITION_ITEM_CODES, EXPEDITION_CODES, ARTIFACT_RECORDS, ARTIFACT_RECORD_KEYS,
  ARTIFACT_CODE_BY_RECORD, GLYPH_TOTAL, RESOLUTION_KEYS, RESOLUTIONS,
  CTHULHU_TOKEN_MEANINGS, sepulchreChaosToken, sepulchreChaosTokenValue, skullValue, disturbance,
  setDisturbance, increaseDisturbance, disturbanceThreshold, isHardSide, CHAOS_TOKEN_FACES,
  sepulchreEntry, artifactsEarned, translatedGlyphCount, entryPrepared, entryFullyPrepared,
  declineTheNightmare,
}

// 本章 9 张非玩家条目（议程 2 / 地点 6 / 敌人 1）。11673 是本关提示卡（scenario 自身）。
export const implementedEncounterCodes = Object.freeze([
  '11674', '11675', '11676', '11677', '11678', '11679', '11680', '11681', '11674b',
])
export const behaviorEntryCodes = Object.freeze([...implementedEncounterCodes])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theDrownedCity',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'tdcCampaign'],
  requiredEncounterGroupIds: [
    'sepulchreOfTheSleeper', 'domination', 'dreams', 'rlyeh', 'starSpawn', 'ancientEvils', 'strikingFear',
    'tdcExpedition',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: [],
  setAsideAliases: [],
  recordReads: [
    'barrierNode', 'obsidianClaw', 'shardOfYchlecht', 'tidalTablet', 'grislyMask',
    'discoveredGlyphs', 'theInnerSanctumWasUnsealed',
  ],
  recordWrites: ['theInvestigatorsHaltedCthulhusAwakening'],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '11673'
// 入场/跳过门槛（Campaigns/TheDrownedCity.hs DoStep 1–3）：战役流程层只读这一份数据。
manifest.entryConditions = {
  prepared: { minArtifacts: 1, minGlyphs: 10, else: 'skipToInterludeIII' },
  fullyPrepared: { artifacts: ARTIFACT_RECORDS.length, glyphs: GLYPH_TOTAL, requiresInnerSanctum: true,
    else: 'addZeroTokenThenInterludeIII' },
  decision: { choices: ['knowBetter', 'layItToRest'], knowBetterRecord: 'theInvestigatorsDidNotConfrontTheNightmare' },
  artifactRecords: [...ARTIFACT_RECORD_KEYS],
}
// 特殊议程牌库：城市之下 → 克苏鲁苏醒（Cthulhu 是「城市之下」的背面）。
manifest.agendaDeck = { codes: [...AGENDA_CODES], cthulhuCode: CTHULHU_CODE, special: true, replacesActs: true }
