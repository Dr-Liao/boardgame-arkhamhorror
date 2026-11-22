// 安魂镇息（laidToRest）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：startLocation / setupLocations /
// setupEnemies / afterDeckSetup / actions + performAction / checkObjectives / enemyDefeated /
// actReveal / agendaReveal / allResigned / resolution / resolveChaosToken / applyTokenEffect /
// encounterDeckFor / locationFlipped / introduction。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, SCENARIO_ACT_TEXT, SCENARIO_AGENDA_TEXT,
  RESOLUTION_KEYS, ENCOUNTER_GROUPS, LOCATIONS, LOCATION_COORDINATES, START_LOCATION,
  ACT_CODE, AGENDA_CODE, TOKEN_MEANINGS, STANDARD_DECK_CODES, SPECTRAL_DECK_CODES, printed,
} from './definition.js'
import { layout, CONNECTIONS } from './layout.js'
import { behavior, findJim, findJean, banishedUnfinishedBusiness, spiritDeck } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

// 本关专属卡（90054 为剧本提示卡，登记身份供图鉴/指南引用）。
export const implementedEncounterCodes = Object.freeze([
  '90054', '90055', '90056', '90057a', '90057b', '90058',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'laidToRest',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'tcuCampaign', 'ltrCampaign'],
  requiredEncounterGroupIds: [
    'laidToRest', 'theWagesOfSin', 'anettesCoven', 'cityOfSins', 'inexorableFate',
    'realmOfDeath', 'trappedSpirits', 'witchcraft',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: ['tcuSpectral', 'tcuHaunted', 'tcuHeretics'],
  recordReads: [],
  recordWrites: [
    'laidToRestResolution', 'laidToRestUnfinishedBusinessBanished', 'laidToRestSpiritDeckRemaining',
  ],
  behaviorIds: [behavior.id],
  setAsideAliases: ['05178a', '05178c', '05178e', '05178g', '05178i', '05178k'],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '90054'
// 从游戏中移除：幽灵迷网 4 张、另一半双面地点、教堂阁楼 C175a。
manifest.zones.removed = [
  { cardCode: '05177', count: 4 },
  ...['05170', '05172', '05174', '05175'].map(cardCode => ({ cardCode, count: 1 })),
]
manifest.zones.setAside = manifest.zones.setAside.filter(entry => entry.cardCode !== '05177')

export {
  scenario, identities, layout, behavior, CARD_DATA, SCENARIO_TEXT,
  SCENARIO_ACT_TEXT, SCENARIO_AGENDA_TEXT, RESOLUTION_KEYS, ENCOUNTER_GROUPS, LOCATIONS,
  LOCATION_COORDINATES, START_LOCATION, ACT_CODE, AGENDA_CODE, TOKEN_MEANINGS, printed,
  STANDARD_DECK_CODES, SPECTRAL_DECK_CODES, CONNECTIONS,
  findJim, findJean, banishedUnfinishedBusiness, spiritDeck,
}

export default { scenario, identities, layout, behavior, manifest, CARD_DATA }
