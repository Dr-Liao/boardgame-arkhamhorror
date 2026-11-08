// 古老者之城（City of the Elder Things · 08621）· 章节装配。
//
// P7 章节状态 = development（引擎只装 playable/verified，因此单测直接 import 本章五件套，
// 不依赖 content/registered.js）。正式「framework ready」后由 Lead 统一重建索引/注册。
import { scenario, identities, CHAPTER_ENTRY_CODES, RECORD_READS, RECORD_WRITES } from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEncounterCodes } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, implementedEncounterCodes }
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'edgeOfTheEarth',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'eoteCampaign'],
  requiredEncounterGroupIds: [
    'cityOfTheElderThings', 'elderThings', 'miasma', 'namelessHorrors', 'penguins',
    'shoggoths', 'tekelili', 'lockedDoors', 'creaturesInTheIce', 'silenceAndMystery', 'chillingCold',
  ],
  requiredMechanicIds: ['eoteCityMap', 'eoteValueKeys', 'eoteTekeliDeck'],
  requiredInvestigatorIds: [],
  setAsideLocations: [],
  setAsideAliases: [],
  recordReads: [...RECORD_READS],
  recordWrites: [...RECORD_WRITES],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
// 剧本参考卡 08621：check-scenario 的遭遇记录覆盖用它（type=scenario 不建条目）。
manifest.referenceCode = '08621'

export const implementedCodes = CHAPTER_ENTRY_CODES
