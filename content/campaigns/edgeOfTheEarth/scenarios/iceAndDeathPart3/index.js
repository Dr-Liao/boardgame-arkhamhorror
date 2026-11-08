// 亡命冰原 III（iceAndDeathPart3）· 章节装配。
//
// P7 阶段：status 保持 development（引擎只装 playable/verified），单测直接 import 本章五件套，
// 不依赖 content/registered.js；Lead 合并后统一重建索引/注册。
import { scenario, identities, RAW_CODES } from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEntryFlags } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'
import { CAMP_RECORD_KEYS } from '../../records.js'

export { scenario, identities, layout, behavior, RAW_CODES, implementedEntryFlags }
export const implementedEncounterCodes = Object.freeze(['08544', '08545', '08546', '08547', '08548'])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'edgeOfTheEarth',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'eoteCampaign'],
  requiredEncounterGroupIds: [
    'iceAndDeath', 'seepingNightmares', 'creaturesInTheIce', 'deadlyWeather',
    'hazardsOfAntarctica', 'silenceAndMystery', 'tekelili',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: scenario.setAsideLocations,
  recordReads: [...CAMP_RECORD_KEYS, 'locationsRevealed'],
  recordWrites: [
    'shelterValue', 'iceAndDeathPart3Resolution', 'eidolonsVanquished', 'seepingNightmaresEnded',
    'theTeamDefeatedTheHuntingCreatures', 'theTeamFledToTheMountains', 'theTeamBarelyEscapedTheIceShelf',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '08501'
