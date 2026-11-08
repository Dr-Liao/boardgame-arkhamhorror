// 失落之峰（To the Forbidden Peaks · 08596）· 章节装配。
//
// P7 章节状态 = development（引擎只装 playable/verified，因此单测直接 import 本章五件套，
// 不依赖 content/registered.js）。正式「framework ready」后由 Lead 统一重建索引/注册。
import { scenario, identities, CHAPTER_ENTRY_CODES, RECORD_READS, RECORD_WRITES, SET_ASIDE_ALIASES } from './definition.js'
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
    'toTheForbiddenPeaks', 'deadlyWeather', 'elderThings', 'hazardsOfAntarctica',
    'namelessHorrors', 'tekelili',
  ],
  requiredMechanicIds: ['eoteClimb', 'eoteTekeliDeck', 'eoteExpeditionAssets'],
  requiredInvestigatorIds: [],
  setAsideLocations: (scenario.setAsideLocations || []).map(item => item.id || item),
  setAsideAliases: [...SET_ASIDE_ALIASES],
  recordReads: [...RECORD_READS],
  recordWrites: [...RECORD_WRITES],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
// 剧本参考卡 08596：check-scenario 的遭遇记录覆盖用它（type=scenario 不建条目）。
manifest.referenceCode = '08596'

export const implementedCodes = CHAPTER_ENTRY_CODES
