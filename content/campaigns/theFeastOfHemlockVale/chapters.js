import { CAMPAIGN_ID, catalogMetadata, chapters, encounterGroupId } from './shared.js'

export function buildCatalogChapter(id) {
  const chapter = chapters.find(entry => entry.id === id)
  if (!chapter) throw new RangeError(`未知铁杉谷章节：${id}`)
  const { name, stepCode, referenceCodes } = chapter
  return {
    manifest: {
      ...catalogMetadata, id, name, campaignId: CAMPAIGN_ID, catalogReferenceOnly: true,
      referenceCode: referenceCodes[0], referenceCodes, requiredPackIds: ['fhvCampaign'],
      requiredEncounterGroupIds: [encounterGroupId(chapter.group || 'the_vale')],
      requiredInvestigatorIds: [], requiredMechanicIds: [], behaviorIds: [id],
      locations: [], acts: [], agendas: [], resolutionIds: [], recordReads: [], recordWrites: [],
      zones: { encounterDeck: [], setAside: [], removed: [], victory: [] },
    },
    scenario: { id, name, stepCode, originalCode: referenceCodes[0], migrationStatus: catalogMetadata.status },
    behavior: { id },
  }
}
