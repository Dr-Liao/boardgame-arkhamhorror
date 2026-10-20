import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { chapters } from './shared.js'

// M0 的占位工厂。M3 之后十个章节都有真实的 definition/layout/behavior，
// 这个工厂只保留给「尚未迁移的章节索引」作稳定提升点；当前没有章节再使用它。
export function buildCatalogChapter(id) {
  const chapter = chapters.find(candidate => candidate.id === id)
  if (!chapter) throw new RangeError(`未知失落的时代章节：${id}`)
  const manifest = {
    schemaVersion: CONTENT_SCHEMA_VERSION,
    id: chapter.id,
    campaignId: 'theForgottenAge',
    name: chapter.name,
    contentVersion: '0.1.0',
    minRulesVersion: 'n4.2',
    status: 'catalog-only',
    catalogReferenceOnly: true,
    referenceCode: chapter.code,
    requiredPackIds: ['core', 'tfaCampaign'],
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
