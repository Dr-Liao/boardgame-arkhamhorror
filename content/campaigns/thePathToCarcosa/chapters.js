import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { chapters } from './shared.js'

// Mirrors the first-cycle chapter factory. C0 emits reference-only entries;
// each scenario index remains the stable promotion point for later rules.
export function buildCatalogChapter(id) {
  const chapter = chapters.find(candidate => candidate.id === id)
  if (!chapter) throw new RangeError(`未知卡尔克萨章节：${id}`)
  const manifest = {
    schemaVersion: CONTENT_SCHEMA_VERSION,
    id: chapter.id,
    campaignId: 'thePathToCarcosa',
    name: chapter.name,
    contentVersion: '0.1.0',
    minRulesVersion: 'n4.2',
    status: 'catalog-only',
    catalogReferenceOnly: true,
    referenceCode: chapter.code,
    requiredPackIds: ['core', 'carcosaCampaign'],
    requiredEncounterGroupIds: [chapter.id],
    requiredInvestigatorIds: [],
    requiredMechanicIds: [],
    locations: [],
    zones: { encounterDeck: [], setAside: [], removed: [], victory: [] },
    acts: [],
    agendas: [],
    resolutionIds: [],
    recordReads: [],
    recordWrites: [],
    behaviorIds: [chapter.id],
  }
  return Object.freeze({
    manifest: Object.freeze(manifest),
    scenario: Object.freeze({
      id: chapter.id,
      originalCode: chapter.code,
      name: chapter.name,
      migrationStatus: 'catalog-only',
    }),
    behavior: Object.freeze({ id: chapter.id }),
  })
}
