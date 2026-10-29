import { createContentRegistry } from './registry.js'
import { packs } from './packs/manifests.js'
import { expansionBundles } from './expansions.js'
import { manifest as nightOfTheZealot } from './campaigns/nightOfTheZealot/manifest.js'
import * as gathering from './campaigns/nightOfTheZealot/scenarios/theGathering/index.js'
import * as masks from './campaigns/nightOfTheZealot/scenarios/theMidnightMasks/index.js'
import * as devourer from './campaigns/nightOfTheZealot/scenarios/theDevourerBelow/index.js'
import { manifest as dunwichCampaignPack } from './packs/dunwichCampaign/manifest.js'
import { manifest as theDunwichLegacy } from './campaigns/theDunwichLegacy/manifest.js'
import { manifest as dunwichInvestigators } from './packs/dunwichInvestigators/manifest.js'
import * as extracurricularActivity from './campaigns/theDunwichLegacy/scenarios/extracurricularActivity/index.js'
import * as theHouseAlwaysWins from './campaigns/theDunwichLegacy/scenarios/theHouseAlwaysWins/index.js'
import * as theMiskatonicMuseum from './campaigns/theDunwichLegacy/scenarios/theMiskatonicMuseum/index.js'
import * as theEssexCountyExpress from './campaigns/theDunwichLegacy/scenarios/theEssexCountyExpress/index.js'
import * as bloodOnTheAltar from './campaigns/theDunwichLegacy/scenarios/bloodOnTheAltar/index.js'
import * as undimensionedAndUnseen from './campaigns/theDunwichLegacy/scenarios/undimensionedAndUnseen/index.js'
import * as whereDoomAwaits from './campaigns/theDunwichLegacy/scenarios/whereDoomAwaits/index.js'
import * as lostInTimeAndSpace from './campaigns/theDunwichLegacy/scenarios/lostInTimeAndSpace/index.js'
import { manifest as carcosaCampaignPack } from './packs/carcosaCampaign/manifest.js'
import { manifest as carcosaInvestigators } from './packs/carcosaInvestigators/manifest.js'
import { manifest as thePathToCarcosa } from './campaigns/thePathToCarcosa/manifest.js'
import * as curtainCall from './campaigns/thePathToCarcosa/scenarios/curtainCall/index.js'
import * as theLastKing from './campaigns/thePathToCarcosa/scenarios/theLastKing/index.js'
import * as echoesOfThePast from './campaigns/thePathToCarcosa/scenarios/echoesOfThePast/index.js'
import * as theUnspeakableOath from './campaigns/thePathToCarcosa/scenarios/theUnspeakableOath/index.js'
import * as aPhantomOfTruth from './campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/index.js'
import * as thePallidMask from './campaigns/thePathToCarcosa/scenarios/thePallidMask/index.js'
import * as blackStarsRise from './campaigns/thePathToCarcosa/scenarios/blackStarsRise/index.js'
import * as dimCarcosa from './campaigns/thePathToCarcosa/scenarios/dimCarcosa/index.js'
import { manifest as tcuCampaignPack } from './packs/tcuCampaign/manifest.js'
import { manifest as tcuInvestigators } from './packs/tcuInvestigators/manifest.js'
import { manifest as tcuPlayer } from './packs/tcuPlayer/manifest.js'
import { manifest as theCircleUndone } from './campaigns/theCircleUndone/manifest.js'
// P8（M3 剧本）：9 章全部从占位升级为真实章节（M0 占位工厂 buildCatalogChapter 保留在
// chapters.js 供「尚未迁移章节」的校验工具使用，组合根不再注册任何占位关卡）。
import * as tcuDisappearanceAtTheTwilightEstate from './campaigns/theCircleUndone/scenarios/disappearanceAtTheTwilightEstate/index.js'
import * as tcuTheWitchingHour from './campaigns/theCircleUndone/scenarios/theWitchingHour/index.js'
import * as tcuAtDeathsDoorstep from './campaigns/theCircleUndone/scenarios/atDeathsDoorstep/index.js'
import * as tcuTheSecretName from './campaigns/theCircleUndone/scenarios/theSecretName/index.js'
import * as tcuTheWagesOfSin from './campaigns/theCircleUndone/scenarios/theWagesOfSin/index.js'
import * as tcuForTheGreaterGood from './campaigns/theCircleUndone/scenarios/forTheGreaterGood/index.js'
import * as tcuUnionAndDisillusion from './campaigns/theCircleUndone/scenarios/unionAndDisillusion/index.js'
import * as tcuInTheClutchesOfChaos from './campaigns/theCircleUndone/scenarios/inTheClutchesOfChaos/index.js'
import * as tcuBeforeTheBlackThrone from './campaigns/theCircleUndone/scenarios/beforeTheBlackThrone/index.js'
import { manifest as tfaCampaignPack } from './packs/tfaCampaign/manifest.js'
import { manifest as tfaInvestigators } from './packs/tfaInvestigators/manifest.js'
import { manifest as tfaPlayer } from './packs/tfaPlayer/manifest.js'
import { manifest as theForgottenAge } from './campaigns/theForgottenAge/manifest.js'
import * as theUntamedWilds from './campaigns/theForgottenAge/scenarios/theUntamedWilds/index.js'
import * as theDoomOfEztli from './campaigns/theForgottenAge/scenarios/theDoomOfEztli/index.js'
import * as threadsOfFate from './campaigns/theForgottenAge/scenarios/threadsOfFate/index.js'
import * as theBoundaryBeyond from './campaigns/theForgottenAge/scenarios/theBoundaryBeyond/index.js'
import * as heartOfTheEldersPart1 from './campaigns/theForgottenAge/scenarios/heartOfTheEldersPart1/index.js'
import * as heartOfTheEldersPart2 from './campaigns/theForgottenAge/scenarios/heartOfTheEldersPart2/index.js'
import * as theCityOfArchives from './campaigns/theForgottenAge/scenarios/theCityOfArchives/index.js'
import * as theDepthsOfYoth from './campaigns/theForgottenAge/scenarios/theDepthsOfYoth/index.js'
import * as shatteredAeons from './campaigns/theForgottenAge/scenarios/shatteredAeons/index.js'
import * as turnBackTime from './campaigns/theForgottenAge/scenarios/turnBackTime/index.js'

let bundle = {
  packs: [...packs, ...expansionBundles.map(entry => entry.manifest), dunwichCampaignPack, dunwichInvestigators,
    carcosaCampaignPack, carcosaInvestigators, tfaCampaignPack, tfaInvestigators, tfaPlayer,
    tcuCampaignPack, tcuInvestigators, tcuPlayer],
  campaigns: [nightOfTheZealot, theDunwichLegacy, thePathToCarcosa, theForgottenAge, theCircleUndone],
  scenarios: [gathering, masks, devourer, extracurricularActivity, theHouseAlwaysWins, theMiskatonicMuseum,
    theEssexCountyExpress, bloodOnTheAltar, undimensionedAndUnseen, whereDoomAwaits, lostInTimeAndSpace,
    curtainCall, theLastKing, echoesOfThePast, theUnspeakableOath, aPhantomOfTruth, thePallidMask,
    blackStarsRise, dimCarcosa,
    theUntamedWilds, theDoomOfEztli, threadsOfFate, theBoundaryBeyond, heartOfTheEldersPart1,
    heartOfTheEldersPart2, theCityOfArchives, theDepthsOfYoth, shatteredAeons, turnBackTime,
    tcuDisappearanceAtTheTwilightEstate, tcuTheWitchingHour, tcuAtDeathsDoorstep, tcuTheSecretName,
    tcuTheWagesOfSin, tcuForTheGreaterGood, tcuUnionAndDisillusion, tcuInTheClutchesOfChaos,
    tcuBeforeTheBlackThrone],
}
export let contentRegistry = createContentRegistry(bundle)

// 工具/测试用只读快照：把当前组合根（含迁移中的占位章节）交给校验工具，
// 让 tools/check-tcu-registry.mjs 能在替换 registered.js 之前用真实章节做注册期校验。
// 运行时不得依赖这个函数（它是 composition root 的镜像，不是内容 API）。
export function currentContentBundle() {
  return { packs: [...bundle.packs], campaigns: [...bundle.campaigns], scenarios: [...bundle.scenarios] }
}

// For trusted content modules only. HTTP input never reaches this function.
export function registerContentBundle(additions) {
  const next = Object.fromEntries(['packs', 'campaigns', 'scenarios'].map(key => [key, [...bundle[key], ...(additions[key] || [])]]))
  const validated = createContentRegistry(next)
  bundle = next
  contentRegistry = validated
}

// 浏览器验收专用：只有 playwright.tde-ui.config.mjs 的 webServer 会设置该环境变量。
// 默认不注册、不进入玩家可见的战役列表；见 content/browser-demo/dualHub.js 的说明。
if (typeof process !== 'undefined' && process.env?.ARKHAM_BROWSER_DEMO === 'dualHub') {
  const { registerDualHubDemo } = await import('./browser-demo/dualHub.js')
  registerDualHubDemo(registerContentBundle)
}
