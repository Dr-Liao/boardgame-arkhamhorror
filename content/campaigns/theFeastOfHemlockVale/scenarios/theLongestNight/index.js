// 最长一夜（theLongestNight）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：preScenarioSetup / afterChaosBagSetup /
// setupLocations / locationPlaced / afterDeckSetup / setupEnemies / actions + performAction /
// doomPlacementReplacement / doomPlaced / spawnLocation / spawnOverrides / enemyMoved /
// enemyAttackModifier / enemyAttackResolved / enemyDamageAmount / enemyStatModifier /
// enemyConnections / enemyPhaseEnd / locationShroudModifier / cluesRemoved /
// checkObjectives / actReveal / agendaReveal / resolveChaosToken / applyTokenEffect / afterTest /
// roundEnded / resolution / allResigned。
import {
  scenario, identities, ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, AJAX_CODE,
  BARRIER_TOKENS_CODE, CAPTIVES_CODE, ENCOUNTER_DECK, ENEMY_CARD_CODES, ENEMY_DECK, FARM_LOCATION_IDS,
  FIRE_CARDS, FIRE_CODE, GATHER_GROUPS, GATHER_SET_ASIDE_GROUPS, LOCATIONS, LOCATION_CONNECTIONS,
  LOCATION_COORDINATES, OUTER_FIELD_IDS, RECORD_KEYS, REMOVED_OUTER_FIELD_ID, RESOLUTION_KEYS,
  SCENARIO_TEXT, SET_ASIDE_CARDS, SET_ASIDE_LOCATIONS, STORY_CODES, URSINE_CODE,
} from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEntryFlags } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export {
  scenario, identities, layout, behavior, implementedEntryFlags,
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, AJAX_CODE, BARRIER_TOKENS_CODE, CAPTIVES_CODE,
  ENCOUNTER_DECK, ENEMY_CARD_CODES, ENEMY_DECK, FARM_LOCATION_IDS, FIRE_CARDS, FIRE_CODE, GATHER_GROUPS,
  GATHER_SET_ASIDE_GROUPS, LOCATIONS, LOCATION_CONNECTIONS, LOCATION_COORDINATES, OUTER_FIELD_IDS,
  RECORD_KEYS, REMOVED_OUTER_FIELD_ID, RESOLUTION_KEYS, SCENARIO_TEXT, SET_ASIDE_CARDS,
  SET_ASIDE_LOCATIONS, STORY_CODES, URSINE_CODE,
}

// 本章实现行为的非玩家条目：12 个敌人面（含 Ursine）+ 2 张诡计 + 3 张剧情资产 +
// 11 处地点 + 1 幕 + 1 议程 = 30 个条目文件（提示卡 10626 是剧本参考卡，不建条目）。
export const implementedEncounterCodes = Object.freeze([
  '10627', '10628', '10629', '10630', '10631', '10632', '10633', '10634', '10635',
  '10636', '10637', '10638', '10639', '10640', '10641', '10642', '10643',
  '10644a', '10644b', '10644c', '10645a', '10645b', '10645c', '10646',
  '10647a', '10647b', '10647c', '10648', '10649', '10650',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theFeastOfHemlockVale',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'notz', 'fhvCampaign'],
  requiredEncounterGroupIds: [
    'theLongestNight', 'theSecondDay', 'blight', 'transfiguration', 'fire', 'chillingCold',
    'theMidnightMasks', 'strikingFear',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  // 放一边：五张 Fire! + 埃阿斯；另外随机移除的那张外围农田由 setAsideLocations 计入。
  setAsideAliases: [...SET_ASIDE_CARDS],
  // 开局即在场：乌尔辛混种（西面外围农田）、病俘（农庄）、屏障/诱饵/陷阱提示卡。
  inPlayAliases: [URSINE_CODE, CAPTIVES_CODE, BARRIER_TOKENS_CODE],
  recordReads: [
    RECORD_KEYS.facedAlone, RECORD_KEYS.bearWounded,
    'simeonSharedADance', 'leahSharedADance', 'theoSharedADance', 'gideonSharedADance',
    'judithSharedADance', 'williamSharedADance', 'riverSharedADance', 'helenSharedADance',
  ],
  recordWrites: [
    RECORD_KEYS.facedAlone, RECORD_KEYS.captivesSaved, RECORD_KEYS.captivesLost,
    RECORD_KEYS.allCaptivesLost, RECORD_KEYS.drMarquezHasAPlan,
    RECORD_KEYS.areasSurveyedSouthernFields, RECORD_KEYS.resolution, RECORD_KEYS.captivesDamage,
    'leahStoodByYou', 'simeonStoodByYou', 'williamStoodByYou', 'riverStoodByYou',
    'gideonStoodByYou', 'judithStoodByYou', 'theoStoodByYou',
    'investigatorDefeat', 'ajaxJoinedTheInvestigators', 'drMarquezJoinedTheInvestigators',
    'aResidentWasSacrificed', 'sacrificedResident',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '10626'
