// 亡命冰原 第 I 部分（iceAndDeathPart1）· 章节装配。
//
// P7 阶段：status 保持 development（引擎只装 playable/verified），单测直接 import 本章五件套，
// 不依赖 content/registered.js；Lead 合并后统一重建索引/注册。
import { scenario, identities, RAW_CODES, SET_ASIDE_ALIASES } from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEntryCodes } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'
import { CAMP_RECORD_KEYS } from '../../records.js'

export { scenario, identities, layout, behavior, RAW_CODES, implementedEntryCodes }
export const implementedEncounterCodes = Object.freeze([...implementedEntryCodes])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'edgeOfTheEarth',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'eoteCampaign'],
  requiredEncounterGroupIds: [
    'iceAndDeath', 'theCrash', 'creaturesInTheIce', 'deadlyWeather', 'hazardsOfAntarctica',
    'silenceAndMystery', 'tekelili',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: ['eoteFrost', 'eoteTekeliDeck', 'eoteShelter'],
  setAsideLocations: scenario.setAsideLocations,
  setAsideAliases: [...SET_ASIDE_ALIASES],
  recordReads: [...CAMP_RECORD_KEYS, 'locationsRevealed'],
  recordWrites: [...CAMP_RECORD_KEYS, 'locationsRevealed', 'iceAndDeathPart1Resolution', 'iceAndDeathPart1CampShelter', 'eoteShelterValue'],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '08501'
