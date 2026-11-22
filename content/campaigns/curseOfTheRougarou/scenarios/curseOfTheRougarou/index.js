// 狼人诅咒（curseOfTheRougarou）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：startLocation / preScenarioSetup / setupLocations /
// locationPlaced / afterDeckSetup / actions + performAction / actReveal / actIndexAfterAdvance /
// agendaReveal / checkObjectives / spawnLocation / enemyDamaged / enemyDefeated / enemyStatModifier /
// enemyAttackedSuccessfully / locationLeft / turnEnded / moveError / roundEnded /
// resolveChaosToken / applyTokenEffect / tokenMeanings / resolution。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, LOCATIONS, LOCATION_TABLE, LOCATION_COORDINATES,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS, ROUGAROU_SET_CODES, ROUGAROU_SET_DECK_CODES,
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, ACTS, AGENDAS, STAGE_CARDS,
  SET_ASIDE_ALIASES, PILE_TRAITS, PILE_LOCATIONS, RESOLUTION_KEYS, START_LOCATION,
  LADY_ESPIRIT_CODE, BEAR_TRAP_CODE, FISHING_NET_CODE, MONSTROUS_TRANSFORMATION_CODE, CURSE_WEAKNESS_CODE,
} from './definition.js'
import { layout, CONNECTIONS } from './layout.js'
import { behavior, scenarioSummary, implementedEntryFlags, tameConditionsMet } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

// 本关 35 张非玩家条目（81001 是提示卡本身，不建条目）。
export const implementedEncounterCodes = Object.freeze([
  '81002', '81003', '81004', '81005', '81006',
  '81007', '81008', '81009', '81010', '81011', '81012', '81013', '81014', '81015', '81016', '81017', '81018',
  '81019', '81020', '81021',
  '81022', '81023', '81024', '81025', '81026', '81027',
  '81028', '81029', '81030', '81031', '81032', '81033', '81034', '81035', '81036',
])
// 真正有规则读点的条目（幕/议程/地点行动/敌人生成与数值/诡计检定/结局）。
export const behaviorEntryCodes = Object.freeze([
  '81002', '81003', '81004', '81005', '81006',
  '81008', '81015', '81016', '81018',
  '81022', '81023', '81024', '81026', '81027', '81029', '81034',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'curseOfTheRougarou',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'cotrCampaign'],
  // 初始遭遇牌库只用 bayou 组；rougarou 组 Setup 放一边、幕 1 背面洗入（参考 gather/setAside）。
  requiredEncounterGroupIds: [...ENCOUNTER_GROUPS],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  recordReads: [
    'foundAnAncientBindingStone', 'foundAStrangeDoll',
  ],
  recordWrites: [
    'theRougarouContinuesToHauntTheBayou', 'theRougarouIsDestroyed',
    'theRougarouEscapedAndYouEmbracedTheCurse',
    'foundAnAncientBindingStone', 'foundAStrangeDoll',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '81001'

export {
  scenario, identities, layout, behavior, CARD_DATA, SCENARIO_TEXT,
  LOCATIONS, LOCATION_TABLE, LOCATION_COORDINATES, CONNECTIONS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS, ROUGAROU_SET_CODES, ROUGAROU_SET_DECK_CODES,
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, ACTS, AGENDAS, STAGE_CARDS,
  SET_ASIDE_ALIASES, PILE_TRAITS, PILE_LOCATIONS, RESOLUTION_KEYS, START_LOCATION,
  LADY_ESPIRIT_CODE, BEAR_TRAP_CODE, FISHING_NET_CODE, MONSTROUS_TRANSFORMATION_CODE, CURSE_WEAKNESS_CODE,
  scenarioSummary, implementedEntryFlags, tameConditionsMet,
}

export default { scenario, identities, layout, behavior, manifest, CARD_DATA }
