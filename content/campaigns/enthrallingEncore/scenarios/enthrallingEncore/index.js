// 惑人返场（enthrallingEncore）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：startLocation / setupLocations /
// setupEnemies / afterDeckSetup / locationRevealed / actions + performAction /
// checkObjectives / actReveal / agendaReveal / allResigned / resolution /
// resolveChaosToken / applyTokenEffect / introduction。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, SCENARIO_ACT_TEXT, SCENARIO_AGENDA_TEXT,
  RESOLUTION_KEYS, ENCOUNTER_GROUPS, ENCOUNTER_DECK, LOCATIONS, LOCATION_COORDINATES,
  PRIVATE_LOCATION_IDS, PROPS_DECK_CODES, START_LOCATION, ACT_CODE, AGENDA_CODE,
  SOLOIST_CODE, TOKEN_MEANINGS, printed,
} from './definition.js'
import { layout, CONNECTIONS } from './layout.js'
import { behavior, findSoloist, measures, propsDeck, classesAmongControlledCards } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

// 本关专属卡（90094 为剧本提示卡，登记身份供图鉴/指南引用）。
export const implementedEncounterCodes = Object.freeze([
  '90094', '90095', '90096', '90097',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'enthrallingEncore',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'carcosaCampaign', 'encCampaign'],
  requiredEncounterGroupIds: [
    'enthrallingEncore', 'curtainCall', 'decay', 'delusions',
    'hauntings', 'ghouls', 'strikingFear', 'rats',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: ['carcosaEncounterEffects'],
  recordReads: [],
  recordWrites: [
    'enthrallingEncoreResolution', 'enthrallingEncoreMeasures', 'enthrallingEncoreSignatureSwap',
  ],
  behaviorIds: [behavior.id],
  setAsideAliases: ['03059', '03060'],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '90094'
// 从游戏中移除：The Man in the Pallid Mask / Royal Emissary（谢幕专属敌人）。
manifest.zones.removed = ['03059', '03060'].map(cardCode => ({ cardCode, count: 1 }))
manifest.zones.setAside = manifest.zones.setAside.filter(entry => !['03059', '03060'].includes(entry.cardCode))
// 六个私密地点已在 locations 中声明、由 behavior 在揭示时放入场，不写进固定的 setAside 账本。

export {
  scenario, identities, layout, behavior, CARD_DATA, SCENARIO_TEXT,
  SCENARIO_ACT_TEXT, SCENARIO_AGENDA_TEXT, RESOLUTION_KEYS, ENCOUNTER_GROUPS, ENCOUNTER_DECK,
  LOCATIONS, LOCATION_COORDINATES, PRIVATE_LOCATION_IDS, PROPS_DECK_CODES, START_LOCATION,
  ACT_CODE, AGENDA_CODE, SOLOIST_CODE, TOKEN_MEANINGS, printed, CONNECTIONS,
  findSoloist, measures, propsDeck, classesAmongControlledCards,
}

export default { scenario, identities, layout, behavior, manifest, CARD_DATA }
