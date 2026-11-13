// 死亡酷暑（deadHeat）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：preScenarioSetup / setupLocations /
// locationPlaced / afterDeckSetup / actions + performAction / enemySpawned / enemyMoved /
// enemyAttackStarted / enemyAttackResolved / enemyDefeated / encounterGainsSurge /
// resolveEncounterCard / roundEnded / turnEnded / actReveal / agendaReveal / checkObjectives /
// resolveChaosToken / applyTokenEffect / resolution。
import {
  scenario, identities, ACT_CODES, AGENDA_CODES, ACT_CODE_BY_STAGE, AGENDA_CODE_BY_STAGE,
  ACT_STAGES, AGENDA_STAGES, ENCOUNTER_DECK, GATHER_GROUPS, GATHER_SET_ASIDE_GROUPS, KEY_SPEC,
  KEY_CARD_CODES, LOCATIONS, LOCATION_CONNECTIONS, SET_ASIDE_CARDS, STORY_CODES, SITE_IDS,
  CIVILIAN_TRACK, RISEN_SPAWN_SITE,
} from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEntryFlags } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export {
  scenario, identities, layout, behavior, implementedEntryFlags,
  ACT_CODES, AGENDA_CODES, ACT_CODE_BY_STAGE, AGENDA_CODE_BY_STAGE, ACT_STAGES, AGENDA_STAGES,
  ENCOUNTER_DECK, GATHER_GROUPS, GATHER_SET_ASIDE_GROUPS, KEY_SPEC, KEY_CARD_CODES, LOCATIONS,
  LOCATION_CONNECTIONS, SET_ASIDE_CARDS, STORY_CODES, SITE_IDS, CIVILIAN_TRACK, RISEN_SPAWN_SITE,
}

// 本章实现行为的非玩家条目：6 个敌人（含双面苋两面）+ 2 个诡计 + 2 张剧情卡 + 2 面密钥。
// 地点/幕/议程/scenario 按批次约定不建单卡条目（规则在 definition/scenario 与 behavior）。
export const implementedEncounterCodes = Object.freeze([
  '09537', '09537b', '09538', '09539', '09540', '09541',
  '09542', '09543',
  '09536', '09536b',
  '09544a', '09544b',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theScarletKeys',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'tskCampaign'],
  requiredEncounterGroupIds: [
    'deadHeat',
    'scarletSorcery',
    'spreadingCorruption',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: scenario.setAsideLocations,
  setAsideAliases: [...SET_ASIDE_CARDS],
  recordReads: ['time', 'theCellKnowsAmaranthsRealName'],
  recordWrites: [
    'time', 'theLoversAreReunited', 'youHaventSeenTheLastOfAmaranth', 'amaranthHasLeftTheCoterie',
    'deadHeatResolution', 'deadHeatTimes', 'deadHeatCiviliansRescued', 'deadHeatCiviliansSlain', 'theLastBlossomBearer', 'xp',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '09520'
