// 万象无终（The Circle Undone）· 9 章占位（M0）。
//
// 与前三循环的 `buildCatalogChapter` 同一形状：只发 reference-only 条目，
// 每个章节的 `index` 位置是后续 P8 写剧本的稳定提升点；目录收录不代表规则已实现。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { CAMPAIGN_ID, chapters } from './shared.js'

export function buildCatalogChapter(id) {
  const chapter = chapters.find(candidate => candidate.id === id)
  if (!chapter) throw new RangeError(`未知万象无终章节：${id}`)
  const manifest = {
    schemaVersion: CONTENT_SCHEMA_VERSION,
    id: chapter.id,
    campaignId: CAMPAIGN_ID,
    name: chapter.name,
    contentVersion: '0.1.0',
    minRulesVersion: 'n6.0',
    status: 'catalog-only',
    catalogReferenceOnly: true,
    referenceCode: chapter.code,
    requiredPackIds: ['core', 'tcuCampaign'],
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
      nameEn: chapter.nameEn,
      migrationStatus: 'catalog-only',
    }),
    behavior: Object.freeze({ id: chapter.id }),
  })
}

// 9 个占位条目：注册表逐条校验 manifest / 数据 / 行为 id 一致。
export const catalogChapters = Object.freeze(chapters.map(chapter => buildCatalogChapter(chapter.id)))
