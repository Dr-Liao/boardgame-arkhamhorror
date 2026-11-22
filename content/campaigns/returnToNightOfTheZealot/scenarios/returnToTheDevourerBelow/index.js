// 重返地底噬魔（returnToTheDevourerBelow · 50032a）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；注册期契约见 content/schema.js 与 content/scenario-manifest.js。
// 本文件只导出章节数据/行为/manifest；content/registered.js 的注册由主进程统一完成。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, SCENARIO_ACT_TEXT, RESOLUTION_KEYS,
  CHAPTER_ID, REFERENCE_CODE, VAULT_CODE, UMORDHOTH_CODE, GHOUL_PRIEST_CODE, LITA_CODE,
  ACT_CODES, ACT1_CODE, ACT2_CODE, ACT3_CODE, AGENDA_CODES, AGENDA1_CODE, AGENDA2_CODE, AGENDA3_CODE,
  ACT_STAGES, AGENDA_STAGES, ACTS, AGENDAS, STAGE_CARDS,
  LOCATIONS, LOCATION_TABLE, LOCATION_COORDINATES, LOCATION_IDS, START_LOCATION, RITUAL_SITE,
  SETUP_LOCATION_IDS, SET_ASIDE_LOCATION_IDS, SET_ASIDE_ALIASES, WOODS_POOL, WOODS_COUNT,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUP_IDS, AGENT_SETS, AGENT_SET_IDS,
} from './definition.js'
import { layout, CONNECTIONS } from './layout.js'
import { behavior, scenarioSummary, implementedEntryFlags, currentActCode, currentAgendaCode } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'
import { sharedEncounterIdentities } from '../../../../packs/shared-identities.js'

// 本章有规则读点的 50xxx 单卡条目：50037（显现，entryRevelation）。
// 其余 50xxx 规则在 behavior.js 钩子里（50032b/50033–50036/50038/50039/50041–50043），
// 50040 复用战役共用条目 returnToNightOfTheZealot/_shared/ghouls_of_umôrdhoth/50040.js；
// 读点见 definition.js 文件头。
export const implementedEncounterCodes = Object.freeze(['50037'])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'returnToNightOfTheZealot',
  status: 'playable',
  layout,
  sharedIdentities: sharedEncounterIdentities,
  requiredPackIds: ['core', 'notz', 'rtnotzCampaign'],
  requiredEncounterGroupIds: [
    'theDevourerBelow', 'ancientEvils', 'strikingFear', 'ghoulsOfUmordhoth',
    'theDevourersCult', 'returnToTheDevourerBelow',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  // 放一边：仪式地（01156）；别名为乌默尔多斯（01157）与凡尘终陨之墟（50032b）。
  // 使者组四组全部登记为可选组（manifest 只声明，Setup 随机 4 选 1 的实现在 behavior）。
  setAsideAliases: [...SET_ASIDE_ALIASES],
  recordReads: ['cultistsEscaped', 'pastMidnight', 'ghoulPriestAlive', 'litaOwner'],
  recordWrites: ['succumbedToUmordhoth', 'ritualBroken', 'repelledUmordhoth', 'sacrificedLita'],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = REFERENCE_CODE
// 幕/密谋牌库与基础章节同三张，没有随机二选一。
manifest.actVariants = Object.freeze({ default: [...ACT_CODES], alternate: [], randomChoice: false })
manifest.requiredEncounterGroupWarnings = Object.freeze([])

export {
  scenario, identities, layout, behavior, CARD_DATA, SCENARIO_TEXT, SCENARIO_ACT_TEXT, RESOLUTION_KEYS,
  CHAPTER_ID, REFERENCE_CODE, VAULT_CODE, UMORDHOTH_CODE, GHOUL_PRIEST_CODE, LITA_CODE,
  ACT_CODES, ACT1_CODE, ACT2_CODE, ACT3_CODE, AGENDA_CODES, AGENDA1_CODE, AGENDA2_CODE, AGENDA3_CODE,
  ACT_STAGES, AGENDA_STAGES, ACTS, AGENDAS, STAGE_CARDS,
  LOCATIONS, LOCATION_TABLE, LOCATION_COORDINATES, LOCATION_IDS, START_LOCATION, RITUAL_SITE,
  SETUP_LOCATION_IDS, SET_ASIDE_LOCATION_IDS, SET_ASIDE_ALIASES, WOODS_POOL, WOODS_COUNT,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUP_IDS, AGENT_SETS, AGENT_SET_IDS,
  CONNECTIONS, scenarioSummary, implementedEntryFlags, currentActCode, currentAgendaCode,
}

export default { scenario, identities, layout, behavior, manifest, CARD_DATA }
