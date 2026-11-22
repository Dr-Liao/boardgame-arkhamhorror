// 深渊守卫 · 第一章《永恒沉睡》（theEternalSlumber · 83001）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：startLocation / preScenarioSetup / setupLocations /
// locationPlaced / afterDeckSetup / actions + performAction / actReveal / agendaReveal /
// checkObjectives / enemyDefeated / resolveChaosToken / applyTokenEffect / tokenMeanings / resolution。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, LOCATIONS, LOCATION_COORDINATES,
  SET_ASIDE_LOCATION_IDS, SET_ASIDE_ALIASES, ENCOUNTER_DECK, ENCOUNTER_GROUPS,
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, ACTS, AGENDAS, STAGE_CARDS, RESOLUTION_KEYS,
  START_LOCATION, CAIRO_LOCATION_IDS, EXPEDITION_LOCATION_IDS, EXPLORATION_DECK,
  NEITH_CODE, BROTHERHOOD_ENEMY_CODES,
} from './definition.js'
import { layout, CONNECTIONS } from './layout.js'
import { behavior, scenarioSummary, implementedEntryFlags } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

// 本关非玩家条目（需要行为的卡；其余纯数据卡在 definition.CARD_DATA 声明）。
// 83055/83056 为战役资产（关间奖励/可选获得），行为在单卡文件里，见 encounter-entries/guardiansOfTheAbyss/。
export const implementedEncounterCodes = Object.freeze(['83055', '83056'])
export const behaviorEntryCodes = Object.freeze(['83055', '83056'])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'guardiansOfTheAbyss',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'guardiansCampaign'],
  requiredEncounterGroupIds: [...ENCOUNTER_GROUPS],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  recordReads: ['dreamersInTheAbyss', 'brotherhoodAgentsWhoEscaped', 'wasTakenByTheAbyss'],
  recordWrites: [
    'theCurseOfSlumberWasLifted', 'youAreAwareOfXzharahsPlans', 'theBrotherhoodsSchemesContinueUnabated',
    'dreamersInTheAbyss', 'brotherhoodAgentsWhoEscaped', 'wasTakenByTheAbyss',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '83001'

export {
  scenario, identities, layout, behavior, CARD_DATA, SCENARIO_TEXT,
  LOCATIONS, LOCATION_COORDINATES, CONNECTIONS,
  SET_ASIDE_LOCATION_IDS, SET_ASIDE_ALIASES, ENCOUNTER_DECK, ENCOUNTER_GROUPS,
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, ACTS, AGENDAS, STAGE_CARDS, RESOLUTION_KEYS,
  START_LOCATION, CAIRO_LOCATION_IDS, EXPEDITION_LOCATION_IDS, EXPLORATION_DECK,
  NEITH_CODE, BROTHERHOOD_ENEMY_CODES,
  scenarioSummary, implementedEntryFlags,
}

export default { scenario, identities, layout, behavior, manifest, CARD_DATA }
