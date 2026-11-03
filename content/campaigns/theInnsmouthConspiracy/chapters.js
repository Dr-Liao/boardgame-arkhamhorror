import { CAMPAIGN_ID, chapters } from './shared.js'
export function catalogChapter(id) {
  const chapter = chapters.find(ch => ch.id === id)
  if (!chapter) throw new RangeError(`未知章节 ${id}`)
  return Object.freeze({
    manifest: Object.freeze({ schemaVersion: 1, id, campaignId: CAMPAIGN_ID, name: chapter.name,
      contentVersion: '0.1.0', minRulesVersion: 'n6.0', status: 'catalog-only', catalogReferenceOnly: true,
      referenceCode: chapter.code, requiredPackIds: ['core', 'ticCampaign'], requiredEncounterGroupIds: [id],
      requiredInvestigatorIds: [], requiredMechanicIds: [], locations: [], acts: [], agendas: [], resolutionIds: [], recordReads: [], recordWrites: [],
      zones: { encounterDeck: [], setAside: [], removed: [], victory: [] }, behaviorIds: [id] }),
    scenario: Object.freeze({ id, name: chapter.name, nameEn: chapter.nameEn, originalCode: chapter.code, migrationStatus: 'catalog-only' }),
    behavior: Object.freeze({ id }),
  })
}
export const catalogChapters = Object.freeze(chapters.map(ch => catalogChapter(ch.id)))
