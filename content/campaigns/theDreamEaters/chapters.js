// 食梦者（The Dream Eaters）· 8 章目录（P8：从 M0 占位升级为可加载章节）。
//
// M0 的占位工厂 `buildCatalogChapter` 保留给工具使用（「尚未迁移章节」的注册期形状校验）；
// P8 起 8 章都是真实模块：`scenarios/<id>/index.js` 导出 { scenario, identities, layout, behavior, manifest }。
// 本文件只做稳定清单与占位工厂，不复制章节数据。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { CAMPAIGN_ID, chapters, PAIR_COUNT, MODES, PARTS } from './shared.js'

export { CAMPAIGN_ID, chapters, PAIR_COUNT, MODES, PARTS }

export const CHAPTER_IDS = Object.freeze(chapters.map(chapter => chapter.id))

export const chapterById = id => chapters.find(chapter => chapter.id === id) || null

// 章节目录占位（仅供尚未迁移的章节或校验工具使用；P8 的 8 章不再走这里）。
export function buildCatalogChapter(id, { status = 'catalog-only' } = {}) {
  const chapter = chapterById(id)
  if (!chapter) throw new RangeError(`未知食梦者章节：${id}`)
  const manifest = {
    schemaVersion: CONTENT_SCHEMA_VERSION,
    id: chapter.id,
    campaignId: CAMPAIGN_ID,
    name: chapter.name,
    contentVersion: '0.1.0',
    minRulesVersion: 'n6.0',
    status,
    catalogReferenceOnly: true,
    referenceCode: chapter.code,
    requiredPackIds: ['core', 'tdeCampaign'],
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
      migrationStatus: status,
    }),
    behavior: Object.freeze({ id: chapter.id }),
  })
}

export const catalogChapters = Object.freeze(chapters.map(chapter => buildCatalogChapter(chapter.id)))
