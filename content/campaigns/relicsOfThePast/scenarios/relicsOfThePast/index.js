// 往昔遗物（relicsOfThePast）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：startLocation / setupLocations / afterDeckSetup /
// canExplore / afterExplore / checkObjectives / actReveal / agendaAdvancing / agendaReveal /
// allResigned / investigatorEliminated / enemyStatModifier / tokenMeanings / resolution。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, SCENARIO_ACT_TEXT, SCENARIO_AGENDA_TEXT,
  RESOLUTION_KEYS, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS, LOCATIONS,
  LOCATION_COORDINATES, LOCATION_TABLE, START_LOCATION, ACT1_CODE, ACT2_CODE, AGENDA1_CODE,
  AGENDA2_CODE, DWELLER_CODE, RELIC_CODES, VENGEANT_PAST_CODE, KEY_INVESTIGATOR, TOKEN_MEANINGS,
  SET_ASIDE_CODES, initialExplorationDeck, printed,
} from './definition.js'
import { layout, CONNECTIONS } from './layout.js'
import {
  behavior, scenarioSummary, findMonterey, spawnScenarioEnemy, spawnStoryAssetSafe,
  relicVictoryCount, supplyFor, tokenMeanings,
} from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export const implementedEncounterCodes = Object.freeze([
  '90065', '90066a', '90066b', '90067', '90068', '90069', '90070', '90071',
  '90072', '90073', '90074', '90075', '90076', '90077',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'relicsOfThePast',
  status: 'playable',
  layout,
  // 复用的 TFA 地点/遭遇牌来自 tfaCampaign；午夜假面伪线索来自 notz。
  requiredPackIds: ['core', 'notz', 'tfaCampaign', 'ropCampaign'],
  requiredEncounterGroupIds: [
    'relicsOfThePast', 'theDoomOfEztli', 'agentsOfYig', 'traps', 'ruins', 'poison',
    'serpents', 'venom', 'chillingCold', 'lockedDoors', 'theMidnightMasks',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  recordReads: [],
  recordWrites: ['relicsOfThePastResolution', 'relicsOfThePastRelics'],
  behaviorIds: [behavior.id],
  setAsideAliases: [...SET_ASIDE_CODES],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '90065'
manifest.zones.removed = [
  '04054', '04055', '04056', '04057', '04058', '04059', '04061', '04062', '04063', '04067', '04068',
].map(cardCode => ({ cardCode, count: 1 }))
manifest.zones.inPlay = []

export {
  scenario, identities, layout, behavior, CARD_DATA, SCENARIO_TEXT, SCENARIO_ACT_TEXT,
  SCENARIO_AGENDA_TEXT, RESOLUTION_KEYS, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_GROUPS,
  LOCATIONS, LOCATION_COORDINATES, LOCATION_TABLE, START_LOCATION, ACT1_CODE, ACT2_CODE,
  AGENDA1_CODE, AGENDA2_CODE, DWELLER_CODE, RELIC_CODES, VENGEANT_PAST_CODE, KEY_INVESTIGATOR,
  TOKEN_MEANINGS, SET_ASIDE_CODES, CONNECTIONS, scenarioSummary, findMonterey, spawnScenarioEnemy,
  spawnStoryAssetSafe, relicVictoryCount, supplyFor, tokenMeanings, initialExplorationDeck, printed,
}

export default { scenario, identities, layout, behavior, manifest, CARD_DATA }
