// 疯狂之心 第 I 部分（The Heart of Madness, Part I · 08648a）· 章节装配。
//
// P7 章节状态 = development：引擎只装 playable/verified，因此单测直接 import 本章五件套，
// 不依赖 content/registered.js。正式「framework ready」后由 Lead 统一重建索引/注册。
import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEncounterCodes } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, implementedEncounterCodes }
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'edgeOfTheEarth',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'eoteCampaign'],
  requiredEncounterGroupIds: ['theGreatSeal', 'theHeartOfMadness', 'miasma', 'namelessHorrors',
    'penguins', 'shoggoths', 'tekelili', 'ancientEvils', 'lockedDoors'],
  requiredMechanicIds: ['eoteSeals', 'eoteFacilities'],
  requiredInvestigatorIds: [],
  recordReads: [],
  recordWrites: ['sealsPlaced', 'sealsRecovered', 'theSealWasUsedImproperly'],
  behaviorIds: [behavior.id],
  setAsideAliases: [],
})
manifest.contentVersion = '1.0.0'
manifest.referenceCode = '08648'
