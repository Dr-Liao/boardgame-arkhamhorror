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

let bundle = {
  packs: [...packs, ...expansionBundles.map(entry => entry.manifest), dunwichCampaignPack, dunwichInvestigators,
    carcosaCampaignPack, carcosaInvestigators],
  campaigns: [nightOfTheZealot, theDunwichLegacy, thePathToCarcosa],
  scenarios: [gathering, masks, devourer, extracurricularActivity, theHouseAlwaysWins, theMiskatonicMuseum,
    theEssexCountyExpress, bloodOnTheAltar, undimensionedAndUnseen, whereDoomAwaits, lostInTimeAndSpace,
    curtainCall, theLastKing, echoesOfThePast, theUnspeakableOath, aPhantomOfTruth, thePallidMask,
    blackStarsRise, dimCarcosa],
}
export let contentRegistry = createContentRegistry(bundle)

// For trusted content modules only. HTTP input never reaches this function.
export function registerContentBundle(additions) {
  const next = Object.fromEntries(['packs', 'campaigns', 'scenarios'].map(key => [key, [...bundle[key], ...(additions[key] || [])]]))
  const validated = createContentRegistry(next)
  bundle = next
  contentRegistry = validated
}
