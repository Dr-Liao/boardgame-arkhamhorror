import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEncounterCodes } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, implementedEncounterCodes }

// 放在一边：6 张异端者（实际随机 4 张入场、2 张移出游戏；区域账本按全部 6 张登记）、
// 4 张幽灵迷网（05177）、看守人组（05086 + 05087×2）。
// 幽灵遭遇牌库是运行期第二牌堆（P2.2），不进 manifest 的 encounterDeck。
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theCircleUndone',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'tcuCampaign'],
  requiredEncounterGroupIds: [
    'theWagesOfSin', 'anettesCoven', 'cityOfSins', 'inexorableFate', 'realmOfDeath',
    'theWatcher', 'trappedSpirits', 'witchcraft',
  ],
  requiredMechanicIds: ['tcuSpectral', 'tcuHaunted', 'tcuHeretics', 'tcuWatcher', 'tcuChaos', 'tcuMemento'],
  setAsideAliases: [
    '05178a', '05178c', '05178e', '05178g', '05178i', '05178k',
    '05177', '05177', '05177', '05177',
    '05086', '05087', '05087',
  ],
  recordReads: ['mementosDiscovered'],
  recordWrites: [
    'hereticsWereUnleashedUntoArkham', 'theInvestigatorsSurvivedTheWatchersEmbrace',
    'erynnJoinedTheInvestigators', 'mementosDiscovered',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
