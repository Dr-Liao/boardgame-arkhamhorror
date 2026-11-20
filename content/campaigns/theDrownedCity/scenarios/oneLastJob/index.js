// 金盆洗手（oneLastJob）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：startLocation / preScenarioSetup /
// setupLocations / locationPlaced / afterDeckSetup / actions + performAction / afterInvestigate /
// roundEnded / actReveal / agendaReveal / checkObjectives / enemyStatModifier /
// resolveChaosToken / applyTokenEffect / resolution。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, SCENARIO_ACT_TEXT, RESOLUTION_KEYS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS, LOCATION_GROUP, LOCATION_TABLE,
  LOCATIONS, LOCATION_COORDINATES, START_LOCATION, START_LOCATION_IDS, SETUP_LOCATION_IDS,
  LINKED_LOCATION_IDS, SET_ASIDE_ALIASES, REMOVED_LOCATION_CODES, ACT_CODES, ALT_ACT_CODES,
  ACT1_V1_CODE, ACT1_V2_CODE, ACT2_SHELDON_CODE, ACT2_OBANNION_CODE, ACT3_CODE, ACT2_CODE_BY_ACT1,
  AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, ACTS, AGENDAS, STAGE_CARDS,
} from './definition.js'
import { layout, CONNECTIONS } from './layout.js'
import { behavior, scenarioSummary, implementedEntryFlags, GANG_BOSS_CODES } from './behavior.js'
import {
  ONE_LAST_JOB_TOKEN_MEANINGS, oneLastJobChaosToken, oneLastJobTokenValue, oneLastJobTokenText,
  criminalsInPlay, criminalAtInvestigator, skullValue, isHardSide, CHAOS_TOKEN_FACES, tierOf,
} from './chaos.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

// 本章 17 张专属卡条目（11501 是提示卡本身，不建条目）。
export const implementedEncounterCodes = Object.freeze([
  '11502', '11503', '11504', '11505', '11504b', '11505b', '11506', '11507', '11508',
  '11509', '11510', '11511', '11512', '11513', '11514', '11515', '11516',
])
// 真正有规则读点的条目：幕 5 / 议程 2 / 地点 3 / 敌人 2（11513/11514 见条目 note）。
export const behaviorEntryCodes = Object.freeze([
  '11502', '11503', '11504', '11505', '11506', '11507', '11508',
  '11509', '11504b', '11505b', '11510', '11511', '11513', '11514',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theDrownedCity',
  status: 'development',
  layout,
  requiredPackIds: ['core', 'tdcCampaign'],
  // campaign.requiredPackIds 含 notz（campaign-core 已落盘）；《午夜假面》复用卡属于 **arkham 地点组**
  // （01124–01134，encounterCode=arkham），不是 notz 的 theMidnightMasks 剧本组。
  requiredEncounterGroupIds: ['oneLastJob', 'dreams', 'chillingCold', 'lockedDoors', 'rats', 'strikingFear', 'arkham'],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: [],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  recordReads: ['theInvestigatorsDiscoveredAnAlienLanguage'],
  recordWrites: ['theInvestigatorsDiscoveredAnAlienLanguage', 'rubyWonTheBet', 'rubyLostTheBet', 'discoveredGlyphs'],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '11501'
// 从游戏中移除的地点（Setup 固定移除 5 张；Downtown 采用参考后端口径 01130 留场、01131 移出）。
manifest.zones.removed = REMOVED_LOCATION_CODES.map(cardCode => ({ cardCode, count: 1 }))
// 幕 1 两版二选一：静态声明默认 Hibbs 线，另一版在 preScenarioSetup 随机切换。
manifest.actVariants = Object.freeze({
  default: [...ACT_CODES],
  alternate: [...ALT_ACT_CODES],
  randomChoice: true,
})
// 集成备注：01124–01134 的 theMidnightMasks 组已随 campaign.requiredPackIds 的 notz 一起可登记。
manifest.requiredEncounterGroupWarnings = Object.freeze([])

export {
  scenario, identities, layout, behavior, CARD_DATA, SCENARIO_TEXT, SCENARIO_ACT_TEXT, RESOLUTION_KEYS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS, LOCATION_GROUP, LOCATION_TABLE,
  LOCATIONS, LOCATION_COORDINATES, START_LOCATION, START_LOCATION_IDS, SETUP_LOCATION_IDS,
  LINKED_LOCATION_IDS, SET_ASIDE_ALIASES, REMOVED_LOCATION_CODES, ACT_CODES, ALT_ACT_CODES,
  ACT1_V1_CODE, ACT1_V2_CODE, ACT2_SHELDON_CODE, ACT2_OBANNION_CODE, ACT3_CODE, ACT2_CODE_BY_ACT1,
  AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, ACTS, AGENDAS, STAGE_CARDS, CONNECTIONS,
  scenarioSummary, implementedEntryFlags, GANG_BOSS_CODES,
  ONE_LAST_JOB_TOKEN_MEANINGS, oneLastJobChaosToken, oneLastJobTokenValue, oneLastJobTokenText,
  criminalsInPlay, criminalAtInvestigator, skullValue, isHardSide, CHAOS_TOKEN_FACES, tierOf,
}

export default { scenario, identities, layout, behavior, manifest, CARD_DATA }
