// 寂静荒野（theSilentHeath）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：introduction / preScenarioSetup /
// modifyDeck / setupLocations / locationPlaced / locationRevealed / afterDeckSetup /
// doomPlaced / actions + performAction / turnBegins / assetLeftPlay / investigatorEliminated /
// enemySpawned / enemyMoved / enemyAttackResolved / enemyStatModifier / locationShroudModifier /
// phaseBegan / roundEnded / actReveal / agendaReveal / checkObjectives / allResigned /
// resolveChaosToken / applyTokenEffect / testAutoFail / resolution。
//
// 与居民组 worker 的接线约定（主进程合并时确认）：
//   · 10694 莉亚·阿特伍德 / 10702 罗莎·马尔克斯博士 / 10693 母亲瑞秋 的 [action]/[reaction]
//     法典触发调用 `api.resolveScenarioEvent('silentHeathCodex<条目>')`（见 behavior.events），
//     条目 id：motherRachel / leahAtwood / drRosaMarquez。
//   · 法典在读点内记 `campaign.records.codexRead`（一次性；罗莎按幕），关系等级记
//     `campaign.records.relationships[residentId]`（与《消失的姐妹》同一口径）。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, RESOLUTION_KEYS, SETUP_STEPS, INTRO_BRANCHES,
  ACT_CODES, AGENDA_CODES, ACT_CODE_BY_STAGE, AGENDA_CODE_BY_STAGE, ACT_STAGES, AGENDA_STAGES,
  DESOLATION_V1_CODE, DESOLATION_V2_CODE, DESOLATION_V2_STAGE, STAGE_CARDS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, encounterDeckForDay, dayGroupCards, DAY_GATHER_GROUPS,
  DAY_NUMBERS, GATHER_GROUPS, LOCATIONS, LOCATION_CONNECTIONS, LOCATION_COORDINATES, LOCATION_TABLE,
  START_LOCATION, START_LOCATION_IDS, CAVE_LOCATION_IDS, CAVE_TABLE, HORRORS_POOL_IDS, HORRORS_TABLE,
  HORRORS_SET_ASIDE_CELLS, HORRORS_SET_ASIDE_COUNT, HORRORS_REMOVED_COUNT, HORRORS_SET_ASIDE_CODES,
  SET_ASIDE_CARDS, SET_ASIDE_LOCATION_IDS, SET_ASIDE_ENEMY_CODES, SET_ASIDE_DECK_CODES, ENEMY_CODES, TREACHERY_CODES,
  CRYSTAL_REMAINS_CODES, CRYSTAL_REMAINS_DECK, BROOD_QUEEN_CODE, CRYSTAL_PARASITE_CODE,
  TIME_MARKER_CODES, RESIDENT_ASSETS, RESIDENT_LOCATIONS, CONNECTION_POLICY,
} from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEntryFlags, scenarioSummary, codex } from './behavior.js'
import {
  SILENT_HEATH_TOKEN_MEANINGS, silentHeathChaosToken, silentHeathChaosTokenValue, skullValue,
  insectCount, insectsInPlay, insectsInVictory, atLairLocation, isHardSide, CHAOS_TOKEN_FACES,
} from './chaos.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export {
  scenario, identities, layout, behavior, implementedEntryFlags, scenarioSummary, codex, CARD_DATA,
  SCENARIO_TEXT, RESOLUTION_KEYS, SETUP_STEPS, INTRO_BRANCHES,
  ACT_CODES, AGENDA_CODES, ACT_CODE_BY_STAGE, AGENDA_CODE_BY_STAGE, ACT_STAGES, AGENDA_STAGES,
  DESOLATION_V1_CODE, DESOLATION_V2_CODE, DESOLATION_V2_STAGE, STAGE_CARDS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, encounterDeckForDay, dayGroupCards, DAY_GATHER_GROUPS,
  DAY_NUMBERS, GATHER_GROUPS, LOCATIONS, LOCATION_CONNECTIONS, LOCATION_COORDINATES, LOCATION_TABLE,
  START_LOCATION, START_LOCATION_IDS, CAVE_LOCATION_IDS, CAVE_TABLE, HORRORS_POOL_IDS, HORRORS_TABLE,
  HORRORS_SET_ASIDE_CELLS, HORRORS_SET_ASIDE_COUNT, HORRORS_REMOVED_COUNT, HORRORS_SET_ASIDE_CODES,
  SET_ASIDE_CARDS, SET_ASIDE_LOCATION_IDS, SET_ASIDE_ENEMY_CODES, SET_ASIDE_DECK_CODES, ENEMY_CODES, TREACHERY_CODES,
  CRYSTAL_REMAINS_CODES, CRYSTAL_REMAINS_DECK, BROOD_QUEEN_CODE, CRYSTAL_PARASITE_CODE,
  TIME_MARKER_CODES, RESIDENT_ASSETS, RESIDENT_LOCATIONS, CONNECTION_POLICY,
  SILENT_HEATH_TOKEN_MEANINGS, silentHeathChaosToken, silentHeathChaosTokenValue, skullValue,
  insectCount, insectsInPlay, insectsInVictory, atLairLocation, isHardSide, CHAOS_TOKEN_FACES,
}

// 本章实现行为的非玩家条目：19 张（议程 3 / 幕 2 / 地点 9 / 诡计 2 / 敌人 3）。
// 10549 是本关提示卡（scenario 自身，按 input.entryPaths 不建单卡条目）。
export const implementedEncounterCodes = Object.freeze([
  '10550', '10551', '10552', '10553', '10554',
  '10555', '10556', '10557', '10558', '10559', '10560',
  '10561', '10562', '10563', '10564', '10565',
  '10566', '10567', '10568',
])
// 真正有规则行为读点的条目（敌人/诡计/水晶残骸）；其余是数据型条目。
export const behaviorEntryCodes = Object.freeze([
  '10561', '10562', '10563', '10564', '10565', '10566', '10567', '10568',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theFeastOfHemlockVale',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'fhvCampaign'],
  requiredEncounterGroupIds: [
    'theSilentHeath', 'agentsOfTheColour', 'blight', 'horrorsInTheRock',
    'refractions', 'transfiguration', 'strikingFear',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: [...scenario.setAsideLocations],
  setAsideAliases: [...SET_ASIDE_CARDS, ...HORRORS_SET_ASIDE_CODES],
  recordReads: [
    'day', 'time', 'hemlockDate', 'relationships', 'codexRead',
    'motherRachelRelationshipLevel', 'leahAtwoodRelationshipLevel', 'drRosaMarquezRelationshipLevel',
    'leahSearchedThePearlRuins', 'theInvestigatorsLaidThePearlFamilyToRest',
    'theRemainsWerePartiallyRecovered', 'madamePearlsDiaryWasRecovered', 'areasSurveyed',
  ],
  recordWrites: [
    'day', 'time', 'hemlockDate', 'relationships', 'codexRead',
    'motherRachelRelationshipLevel', 'leahAtwoodRelationshipLevel', 'drRosaMarquezRelationshipLevel',
    'leahSearchedThePearlRuins', 'theInvestigatorsLaidThePearlFamilyToRest',
    'theRemainsWerePartiallyRecovered', 'madamePearlsDiaryWasRecovered', 'areasSurveyed',
    'pearlRidgeSurveyed', 'silentHeathResolution', 'silentHeathResolvedTo', 'silentHeathNoResolution',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '10549'
// 当日遭遇组（第一日/第二日/最终日）按当前天数并入牌库，静态 zones 只覆盖固定 6 组。
manifest.dynamicEncounterGroups = Object.values(DAY_GATHER_GROUPS)
// 岩中恐怖「独立牌库」：6 张物理地点里 3 张放一边、3 张移出游戏（静态 zones 声明全部候选）。
manifest.horrorsLocationDeck = {
  pool: [...HORRORS_POOL_IDS],
  setAsideCount: HORRORS_SET_ASIDE_COUNT,
  removedCount: HORRORS_REMOVED_COUNT,
}
