// Compatibility exports for existing rules, tests and saved scenarios.
// New content is registered through content/registry.js.
export { DIFFICULTIES, CHAOS_BAGS, SYMBOL_DEFAULTS } from '../../content/campaigns/nightOfTheZealot/shared.js'
import { scenario as gathering, identities as gatheringIdentities } from '../../content/campaigns/nightOfTheZealot/scenarios/theGathering/definition.js'
import { scenario as masks, identities as masksIdentities } from '../../content/campaigns/nightOfTheZealot/scenarios/theMidnightMasks/definition.js'
import { scenario as devourer, identities as devourerIdentities } from '../../content/campaigns/nightOfTheZealot/scenarios/theDevourerBelow/definition.js'
export { CAMPAIGN } from '../../content/campaigns/nightOfTheZealot/manifest.js'
export const SCENARIOS = Object.freeze({ theGathering: gathering, theMidnightMasks: masks, theDevourerBelow: devourer })
// P7（八循环《绯红密钥》）：十章 scenario 运行期别名的身份映射（别名 → 印刷卡号）。
import { identities as tskRiddlesAndRainIdentities } from '../../content/campaigns/theScarletKeys/scenarios/riddlesAndRain/definition.js'
import { identities as tskDeadHeatIdentities } from '../../content/campaigns/theScarletKeys/scenarios/deadHeat/definition.js'
import { identities as tskSanguineShadowsIdentities } from '../../content/campaigns/theScarletKeys/scenarios/sanguineShadows/definition.js'
import { identities as tskDealingsInTheDarkIdentities } from '../../content/campaigns/theScarletKeys/scenarios/dealingsInTheDark/definition.js'
import { identities as tskDancingMadIdentities } from '../../content/campaigns/theScarletKeys/scenarios/dancingMad/definition.js'
import { identities as tskOnThinIceIdentities } from '../../content/campaigns/theScarletKeys/scenarios/onThinIce/definition.js'
import { identities as tskDogsOfWarIdentities } from '../../content/campaigns/theScarletKeys/scenarios/dogsOfWar/definition.js'
import { identities as tskShadesOfSufferingIdentities } from '../../content/campaigns/theScarletKeys/scenarios/shadesOfSuffering/definition.js'
import { identities as tskWithoutATraceIdentities } from '../../content/campaigns/theScarletKeys/scenarios/withoutATrace/definition.js'
import { identities as tskCongressOfTheKeysIdentities } from '../../content/campaigns/theScarletKeys/scenarios/congressOfTheKeys/definition.js'
export const SCENARIO_CARD_IDENTITIES = Object.freeze({ theGathering: gatheringIdentities, theMidnightMasks: masksIdentities, theDevourerBelow: devourerIdentities,
  riddlesAndRain: tskRiddlesAndRainIdentities,
  deadHeat: tskDeadHeatIdentities,
  sanguineShadows: tskSanguineShadowsIdentities,
  dealingsInTheDark: tskDealingsInTheDarkIdentities,
  dancingMad: tskDancingMadIdentities,
  onThinIce: tskOnThinIceIdentities,
  dogsOfWar: tskDogsOfWarIdentities,
  shadesOfSuffering: tskShadesOfSufferingIdentities,
  withoutATrace: tskWithoutATraceIdentities,
  congressOfTheKeys: tskCongressOfTheKeysIdentities })
