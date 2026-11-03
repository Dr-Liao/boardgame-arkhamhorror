import { RECORD_TYPES } from './records.js'
import { flow } from './flow.js'
import { CAMPAIGN_ID, CHAOS_BAGS, chapters, ENCOUNTER_GROUPS } from './shared.js'
// Catalog contract only. Production registers the three packs; scenario registration awaits full guides in P7.
export const manifest = Object.freeze({
  schemaVersion: 1, id: CAMPAIGN_ID, name: '印斯茅斯暗潮', nameEn: 'The Innsmouth Conspiracy',
  contentVersion: '0.1.0', minRulesVersion: 'n6.0', status: 'catalog-only',
  requiredPackIds: ['core', 'ticCampaign', 'ticInvestigators', 'ticPlayer'], scenarioIds: chapters.map(ch => ch.id),
  sharedEncounterGroupIds: ENCOUNTER_GROUPS.filter(group => !chapters.some(ch => ch.encounterCode === group)),
  unlock: Object.fromEntries(chapters.map((ch, index) => [ch.id, index ? [chapters[index - 1].id] : []])),
  chaosBags: CHAOS_BAGS, recordSchema: RECORD_TYPES,
  flow,
  interludeHandlerId: 'innsmouthInterludes', resolutionIds: ['victory', 'defeat'],
})
