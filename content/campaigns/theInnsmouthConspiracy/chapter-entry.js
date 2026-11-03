import { registerCampaignEffectHandler } from '../../../src/campaign/content-effects.js'
import { handlerId, runInterludeEffect } from './interludes.js'
import { buildChapterDefinition } from './chapter-definition.js'
import { prepareCompanions } from './companions-setup.js'
import { entryRules } from './entry-rules.js'
import { earlySetupLocations, earlyAfterDeckSetup } from './chapter-setup.js'
import { middleStartLocation, middleSetupLocations, middleAfterDeckSetup } from './middle-setup.js'
import { lateSetupLocations, lateAfterDeckSetup, lateAfterChaosBagSetup } from './late-setup.js'
import { scenarioManifest } from '../../scenario-manifest.js'
import { chapters, CAMPAIGN_ID } from './shared.js'

// Development registration exposes real authored definitions to tooling and
// tests; production stays closed until chapter behavior acceptance completes.
export function developmentChapter(id) {
  registerCampaignEffectHandler(handlerId,runInterludeEffect)
  const { scenario, identities } = buildChapterDefinition(id)
  const index = chapters.findIndex(ch => ch.id === id)
  const behavior = { ...entryRules, id, deferStartingLocationReveal: true,
    ...(['devilReef','theLairOfDagon'].includes(id) ? { setupBeforeOpeningHands:true, preScenarioSetup:prepareCompanions } : {}),
    ...(index < 3 ? { setupLocations: earlySetupLocations, afterDeckSetup: earlyAfterDeckSetup }
      : index < 5 ? { startLocation: middleStartLocation, setupLocations: middleSetupLocations, afterDeckSetup: middleAfterDeckSetup }
        : { setupLocations: lateSetupLocations, afterDeckSetup: lateAfterDeckSetup, afterChaosBagSetup: lateAfterChaosBagSetup }) }
  const manifest = scenarioManifest(scenario, identities, { campaignId: CAMPAIGN_ID, status: 'development',
    requiredPackIds: ['core', 'notz', 'ticCampaign'], behaviorIds: [id],
    layout: { locations: { [scenario.startLocation]: { x: 0, y: 0 } }, edges: [] } })
  manifest.referenceCode = scenario.referenceCode
  return { scenario, identities, manifest, behavior }
}
