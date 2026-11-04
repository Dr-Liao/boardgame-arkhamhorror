import { developmentChapter } from '../content/campaigns/theInnsmouthConspiracy/chapter-entry.js'
import { fixture, settle } from './core-fixture.mjs'
import { registerContentBundle, contentRegistry } from '../content/registered.js'
import { manifest as campaign } from '../content/campaigns/theInnsmouthConspiracy/manifest.js'
import { chapters } from '../content/campaigns/theInnsmouthConspiracy/shared.js'
import { buildChapterDefinition } from '../content/campaigns/theInnsmouthConspiracy/chapter-definition.js'
import { earlySetupLocations, earlyAfterDeckSetup } from '../content/campaigns/theInnsmouthConspiracy/chapter-setup.js'
import { scenarioManifest } from '../content/scenario-manifest.js'
import { entryRules } from '../content/campaigns/theInnsmouthConspiracy/entry-rules.js'
import { lateSetupLocations, lateAfterDeckSetup, lateAfterChaosBagSetup } from '../content/campaigns/theInnsmouthConspiracy/late-setup.js'
import { middleStartLocation, middleSetupLocations, middleAfterDeckSetup } from '../content/campaigns/theInnsmouthConspiracy/middle-setup.js'
import { registerCampaignScenarios, startScenario } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'

// Development chapters are registered only in this test process. Production
// registration (content/registered.js, P7) enumerates the same chapters, so the
// engine scenario registry still needs an explicit per-campaign wire-up here.
if (!contentRegistry.getCampaign(campaign.id)) {
  const scenarios = chapters.map(chapter => developmentChapter(chapter.id))
  registerContentBundle({ campaigns: [{ ...campaign, status: 'development' }], scenarios })
}
registerCampaignScenarios(campaign.id)

export function chapterFixture(id, count = 1, { records = {}, memoriesRecovered = [], investigatorRecords = {} } = {}) {
  const state = fixture('01001', count)
  state.campaign.id = campaign.id
  state.campaign.recordSchema = { ...campaign.recordSchema }
  state.campaign.flow = { nodeId: id, history: [{ nodeId: id, visit: 1 }], visits: { [id]: 1 } }
  Object.assign(state.campaign.records, records, { memoriesRecovered: [...memoriesRecovered] })
  for (const [seat, values] of Object.entries(investigatorRecords)) Object.assign(state.campaign.investigators[seat], values)
  const index = chapters.findIndex(ch => ch.id === id)
  if (index < 0) throw new RangeError(`Unknown chapter ${id}`)
  const execute = draft => startScenario(draft, index, [])
  resolveTransaction(state, 0, { action: 'testChapterStart' }, execute)
  for (let guard = 0; state.pendingChoice; guard++) {
    if (guard > 100) throw new Error('TIC chapter setup choice loop')
    const choice = state.pendingChoice
    const option = choice.options.find(o => ['done', 'skip', 'self'].includes(o.id)) || choice.options[0]
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: option.id }, execute)
  }
  for (const inv of state.investigators) { inv.actionsLeft = 20; inv.resources = 30 }
  state.chaosBag = ['0']
  return state
}
