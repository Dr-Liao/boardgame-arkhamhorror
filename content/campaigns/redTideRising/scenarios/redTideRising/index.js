// 红潮涌起（redTideRising）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：startLocation / setupLocations / setupEnemies /
// afterDeckSetup / actions + performAction / agendaWouldAdvance / checkObjectives / actReveal /
// agendaReveal / allResigned / investigatorEliminated / afterTest / tokenMeanings / resolution。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, SCENARIO_ACT_TEXT, SCENARIO_AGENDA_TEXT,
  RESOLUTION_KEYS, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS, REMOVED_CODES,
  LOCATIONS, LOCATION_COORDINATES, LOCATION_TABLE, START_LOCATION, ACT_CODE, AGENDA_CODES,
  AGENDA1_CODE, AGENDA2_CODE, PHOTO_CODES, PHOTO_FRONT, PHOTO_BACK, SUSPECT_CODES, HIDEOUT_CODES,
  ANGRY_MOB_CODE, MONSTER_CODES, KEY_INVESTIGATOR, TOKEN_MEANINGS, SUSPECT_HOME_LOCATIONS, printed,
} from './definition.js'
import { layout, CONNECTIONS } from './layout.js'
import {
  behavior, scenarioSummary, findWendy, spawnScenarioEnemy, spawnStoryAssetSafe,
  leadsSize, drawLead, resolveLead, resolvedVictoryCards, xpForSeat, tokenMeanings,
} from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

// 本关专属卡（90041 为剧本提示卡本身，仍登记身份供图鉴/指南引用）。
export const implementedEncounterCodes = Object.freeze([
  '90041', '90042', '90043', '90044', '90045a', '90045b',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'redTideRising',
  status: 'playable',
  layout,
  // Leads deck 的嫌疑犯/藏身处来自 Innsmouth 战役包；午夜假面伪线索来自 notz。
  requiredPackIds: ['core', 'notz', 'ticCampaign', 'rtrCampaign'],
  requiredEncounterGroupIds: [
    'redTideRising', 'theVanishingOfElinaHarper', 'agentsOfDagon', 'fogOverInnsmouth',
    'theLocals', 'chillingCold', 'lockedDoors', 'nightgaunts', 'theMidnightMasks',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  recordReads: [],
  recordWrites: ['redTideRisingResolution', 'redTideRisingVictoryCards'],
  behaviorIds: [behavior.id],
  setAsideAliases: [
    ANGRY_MOB_CODE, ...MONSTER_CODES, PHOTO_FRONT, PHOTO_BACK,
  ],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '90041'
manifest.zones.removed = REMOVED_CODES.map(cardCode => ({ cardCode, count: 1 }))
// 藏身处已由 scenario.setAsideLocations 计入；神秘相片/怪物/Angry Mob 由 setAsideAliases 计入。
manifest.zones.inPlay = []

export {
  scenario, identities, layout, behavior, CARD_DATA, SCENARIO_TEXT, SCENARIO_ACT_TEXT,
  SCENARIO_AGENDA_TEXT, RESOLUTION_KEYS, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS,
  REMOVED_CODES, LOCATIONS, LOCATION_COORDINATES, LOCATION_TABLE, START_LOCATION, ACT_CODE,
  AGENDA_CODES, AGENDA1_CODE, AGENDA2_CODE, PHOTO_CODES, PHOTO_FRONT, PHOTO_BACK, SUSPECT_CODES, SUSPECT_HOME_LOCATIONS,
  HIDEOUT_CODES, ANGRY_MOB_CODE, MONSTER_CODES, KEY_INVESTIGATOR, TOKEN_MEANINGS, CONNECTIONS,
  scenarioSummary, findWendy, spawnScenarioEnemy, spawnStoryAssetSafe, leadsSize, drawLead,
  resolveLead, resolvedVictoryCards, xpForSeat, tokenMeanings, printed,
}

export default { scenario, identities, layout, behavior, manifest, CARD_DATA }
