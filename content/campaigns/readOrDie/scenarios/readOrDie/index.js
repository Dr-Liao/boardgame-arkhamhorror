// 读书至死（readOrDie）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：startLocation / setupLocations /
// afterDeckSetup / actions + performAction / enemyDefeated / actReveal / agendaReveal /
// allResigned / resolveChaosToken / applyTokenEffect / resolution / introduction。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, SCENARIO_ACT_TEXT, SCENARIO_AGENDA_TEXT,
  RESOLUTION_KEYS, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS, REMOVED_CODES,
  LOCATIONS, LOCATION_COORDINATES, LOCATION_TABLE, START_LOCATION, OTHER_START_LOCATION,
  START_LOCATION_IDS, ACT_CODE, AGENDA_CODE, NAMER_CODE, JAZZ_CODE, ARMITAGE_CODE,
  KEY_INVESTIGATOR, TOKEN_MEANINGS, printed,
} from './definition.js'
import { layout, CONNECTIONS } from './layout.js'
import { behavior, scenarioSummary, findDaisy, findNamer, tomesInPlay } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

// 本关 4 张专属卡（90004 为剧本提示卡本身，仍登记身份供图鉴/指南引用）。
export const implementedEncounterCodes = Object.freeze([
  '90004', '90005', '90006', '90007',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'readOrDie',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'dunwichCampaign', 'rodCampaign'],
  requiredEncounterGroupIds: [
    'readOrDie', 'extracurricularActivity', 'sorcery', 'theBeyond', 'bishopsThralls',
    'whippoorwills', 'ancientEvils', 'lockedDoors', 'agentsOfYogSothoth',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  recordReads: [],
  recordWrites: ['readOrDieResolution', 'readOrDieTomesInPlay'],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '90004'
// 从游戏中移除的牌（Extracurricular Activity 的剧本/幕/议程 + 五张被替换卡）。
manifest.zones.removed = REMOVED_CODES.map(cardCode => ({ cardCode, count: 1 }))
// 书卷暗置数量在运行时决定（玩家牌组），不写死进 zones.setAside；清单只声明空囊。
manifest.zones.setAside = []

export {
  scenario, identities, layout, behavior, CARD_DATA, SCENARIO_TEXT,
  SCENARIO_ACT_TEXT, SCENARIO_AGENDA_TEXT, RESOLUTION_KEYS, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES,
  ENCOUNTER_GROUPS, REMOVED_CODES, LOCATIONS, LOCATION_COORDINATES, LOCATION_TABLE,
  START_LOCATION, OTHER_START_LOCATION, START_LOCATION_IDS, ACT_CODE, AGENDA_CODE,
  NAMER_CODE, JAZZ_CODE, ARMITAGE_CODE, KEY_INVESTIGATOR, TOKEN_MEANINGS, printed,
  CONNECTIONS, scenarioSummary, findDaisy, findNamer, tomesInPlay,
}

export default { scenario, identities, layout, behavior, manifest, CARD_DATA }
