import { CAMPAIGN_ID, CAMPAIGN_NAME, CHAOS_BAGS, catalogMetadata, chapters, encounterGroupId, encounterGroups } from './shared.js'

export const manifest = Object.freeze({
  ...catalogMetadata,
  id: CAMPAIGN_ID,
  name: CAMPAIGN_NAME,
  nameEn: 'The Feast of Hemlock Vale',
  requiredPackIds: ['core', 'notz', 'fhvCampaign', 'fhvInvestigators', 'fhvPlayer'],
  scenarioIds: chapters.map(chapter => chapter.id),
  encounterGroupIds: Object.keys(encounterGroups).map(encounterGroupId).sort(),
  unlock: Object.fromEntries(chapters.map(chapter => [chapter.id, []])),
  chaosBags: CHAOS_BAGS,
  recordSchema: {},
  interludeHandlerId: 'fhvInterludes',
  resolutionIds: ['victory', 'defeat'],
})
