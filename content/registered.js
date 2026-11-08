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
// P10（M5 发布）：第五循环《食梦者》三包 + 战役 + 8 章注册进生产组合根。
// 内容本身仍是 earlyAccess 口径（87 条显式简化、equivalenceCertified=false），但已可在大厅启动。
import { manifest as tdeCampaignPack } from './packs/tdeCampaign/manifest.js'
import { manifest as tdeInvestigators } from './packs/tdeInvestigators/manifest.js'
import { manifest as tdePlayer } from './packs/tdePlayer/manifest.js'
import { manifest as theDreamEaters } from './campaigns/theDreamEaters/manifest.js'
import * as tdeBeyondTheGatesOfSleep from './campaigns/theDreamEaters/scenarios/beyondTheGatesOfSleep/index.js'
import * as tdeWakingNightmare from './campaigns/theDreamEaters/scenarios/wakingNightmare/index.js'
import * as tdeTheSearchForKadath from './campaigns/theDreamEaters/scenarios/theSearchForKadath/index.js'
import * as tdeAThousandShapesOfHorror from './campaigns/theDreamEaters/scenarios/aThousandShapesOfHorror/index.js'
import * as tdeDarkSideOfTheMoon from './campaigns/theDreamEaters/scenarios/darkSideOfTheMoon/index.js'
import * as tdePointOfNoReturn from './campaigns/theDreamEaters/scenarios/pointOfNoReturn/index.js'
import * as tdeWhereTheGodsDwell from './campaigns/theDreamEaters/scenarios/whereTheGodsDwell/index.js'
import * as tdeWeaverOfTheCosmos from './campaigns/theDreamEaters/scenarios/weaverOfTheCosmos/index.js'
import { manifest as ticCampaignPack } from './packs/ticCampaign/manifest.js'
import { manifest as ticInvestigators } from './packs/ticInvestigators/manifest.js'
import { manifest as ticPlayer } from './packs/ticPlayer/manifest.js'
// P8（六循环发布）：《印斯茅斯暗潮》战役 + 8 章真实章节 + 三个内容包进入生产组合根。
// 8 章模块经 chapter-entry.js 构建：真实 layout + status 'playable'（P7 逐章验收 8/8 已完成）。
//
// 静态 import 环的处理：本章装配链原本经 companions-setup.js 直接 import
//   `src/engine/hand-entry.js`，而 hand-entry → content/registered.js，形成
//   registered → scenarios/<id>/index.js → chapter-entry → companions-setup → hand-entry → registered。
// 在 registered.js 作为入口时该环可求值，但「先 import chapter-entry」的测试/工具会因
// hand-entry 的 contentRegistry 绑定尚未初始化而 TDZ。P8 已把 companions-setup 改为走场景
// 运行时 api.putInHand(seat, code)（src/engine/scenario-runtime.js），环因此断开；这里不再
// 保留 P7 的惰性 `ensureInnsmouthCatalogRegistered()` 注册路径（保留同名空操作仅为兼容旧测试）。
import { manifest as theInnsmouthConspiracy } from './campaigns/theInnsmouthConspiracy/manifest.js'
import * as ticThePitOfDespair from './campaigns/theInnsmouthConspiracy/scenarios/thePitOfDespair/index.js'
import * as ticTheVanishingOfElinaHarper from './campaigns/theInnsmouthConspiracy/scenarios/theVanishingOfElinaHarper/index.js'
import * as ticInTooDeep from './campaigns/theInnsmouthConspiracy/scenarios/inTooDeep/index.js'
import * as ticDevilReef from './campaigns/theInnsmouthConspiracy/scenarios/devilReef/index.js'
import * as ticHorrorInHighGear from './campaigns/theInnsmouthConspiracy/scenarios/horrorInHighGear/index.js'
import * as ticALightInTheFog from './campaigns/theInnsmouthConspiracy/scenarios/aLightInTheFog/index.js'
import * as ticTheLairOfDagon from './campaigns/theInnsmouthConspiracy/scenarios/theLairOfDagon/index.js'
import * as ticIntoTheMaelstrom from './campaigns/theInnsmouthConspiracy/scenarios/intoTheMaelstrom/index.js'
// P0（七循环 M0）：《地球边缘》只把三个 catalog-only 内容包装进生产组合根，作为「目录身份」；
// 战役清单与八章占位模块已存在（content/campaigns/edgeOfTheEarth/），但**不进生产组合根**：
// 战役仍是 catalog-only，目录期不注册就无法被大厅/选人/构筑/音乐/指南流程当成可玩内容。
// 身份与依赖关系由 tests/eote-migration.test.mjs 用本地 createContentRegistry 复算，P7 再整体注册。
import { manifest as eoteCampaignPack } from './packs/eoteCampaign/manifest.js'
import { manifest as eoteCampaignManifest } from './campaigns/edgeOfTheEarth/manifest.js'
import * as eoteIceAndDeathPart1 from './campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/index.js'
import * as eoteIceAndDeathPart2 from './campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/index.js'
import * as eoteIceAndDeathPart3 from './campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/index.js'
import * as eoteFatalMirage from './campaigns/edgeOfTheEarth/scenarios/fatalMirage/index.js'
import * as eoteToTheForbiddenPeaks from './campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/index.js'
import * as eoteCityOfTheElderThings from './campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/index.js'
import * as eoteTheHeartOfMadnessPart1 from './campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/index.js'
import * as eoteTheHeartOfMadnessPart2 from './campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/index.js'
import { manifest as eoteInvestigators } from './packs/eoteInvestigators/manifest.js'
import { manifest as eotePlayer } from './packs/eotePlayer/manifest.js'

let bundle = {
  packs: [...packs, ...expansionBundles.map(entry => entry.manifest), dunwichCampaignPack, dunwichInvestigators,
    carcosaCampaignPack, carcosaInvestigators, tfaCampaignPack, tfaInvestigators, tfaPlayer,
    tcuCampaignPack, tcuInvestigators, tcuPlayer, tdeCampaignPack, tdeInvestigators, tdePlayer,
    ticCampaignPack, ticInvestigators, ticPlayer, eoteCampaignPack, eoteInvestigators, eotePlayer],
  campaigns: [nightOfTheZealot, theDunwichLegacy, thePathToCarcosa, theForgottenAge, theCircleUndone,
    theDreamEaters, theInnsmouthConspiracy, eoteCampaignManifest],
  scenarios: [gathering, masks, devourer, extracurricularActivity, theHouseAlwaysWins, theMiskatonicMuseum,
    theEssexCountyExpress, bloodOnTheAltar, undimensionedAndUnseen, whereDoomAwaits, lostInTimeAndSpace,
    curtainCall, theLastKing, echoesOfThePast, theUnspeakableOath, aPhantomOfTruth, thePallidMask,
    blackStarsRise, dimCarcosa,
    theUntamedWilds, theDoomOfEztli, threadsOfFate, theBoundaryBeyond, heartOfTheEldersPart1,
    heartOfTheEldersPart2, theCityOfArchives, theDepthsOfYoth, shatteredAeons, turnBackTime,
    tcuDisappearanceAtTheTwilightEstate, tcuTheWitchingHour, tcuAtDeathsDoorstep, tcuTheSecretName,
    tcuTheWagesOfSin, tcuForTheGreaterGood, tcuUnionAndDisillusion, tcuInTheClutchesOfChaos,
    tcuBeforeTheBlackThrone,
    tdeBeyondTheGatesOfSleep, tdeWakingNightmare, tdeTheSearchForKadath, tdeAThousandShapesOfHorror,
    tdeDarkSideOfTheMoon, tdePointOfNoReturn, tdeWhereTheGodsDwell, tdeWeaverOfTheCosmos,
    ticThePitOfDespair, ticTheVanishingOfElinaHarper, ticInTooDeep, ticDevilReef, ticHorrorInHighGear,
    ticALightInTheFog, ticTheLairOfDagon, ticIntoTheMaelstrom,
    eoteIceAndDeathPart1, eoteIceAndDeathPart2, eoteIceAndDeathPart3, eoteFatalMirage, eoteToTheForbiddenPeaks, eoteCityOfTheElderThings, eoteTheHeartOfMadnessPart1, eoteTheHeartOfMadnessPart2],
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

// P8《印斯茅斯暗潮》：战役与 8 章已在组合根静态注册（见上方 import 区注释），
// 这里只保留 P7 的异步入口作为兼容别名：旧测试（tests/campaign-experience.test.mjs）
// 与外部工具仍可 `await ensureInnsmouthCatalogRegistered()`，返回当前生产战役清单。
// 运行时不需要它，也不得用它做重复注册（registerContentBundle 会因重复 ID 失败）。
export async function ensureInnsmouthCatalogRegistered() {
  return contentRegistry.getCampaign('theInnsmouthConspiracy')
}

// 浏览器验收专用：只有 playwright.tde-ui.config.mjs 的 webServer 会设置该环境变量。
// 默认不注册、不进入玩家可见的战役列表；见 content/browser-demo/dualHub.js 的说明。
if (typeof process !== 'undefined' && process.env?.ARKHAM_BROWSER_DEMO === 'dualHub') {
  const { registerDualHubDemo } = await import('./browser-demo/dualHub.js')
  registerDualHubDemo(registerContentBundle)
}
