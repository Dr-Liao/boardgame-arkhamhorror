// 《沉没之城》（The Drowned City）· 章节目录辅助（P7）。
//
// 与 FHV 同名文件同一职责：`shared.js#chapters` 是只读身份表；`scenarios/index.js` 汇总
// 各章真实模块；本文件提供「仅目录」的章节骨架（图鉴/审计/未落盘章节的占位读取），
// 以及章节 → 遭遇组/卡包依赖的推导。**不用于生产组合根**（生产注册看 scenarios/index.js）。
import { CAMPAIGN_ID, catalogMetadata, chapterOf, chapters, encounterGroupId } from './shared.js'

/** 章节身份（未知 id 抛 RangeError，fail closed）。 */
export function chapterIdentity (id) {
  const chapter = chapterOf(id)
  if (!chapter) throw new RangeError(`未知沉没之城章节：${id}`)
  return chapter
}

/** 章节专属遭遇组 id（camelCase；章节没有 group 时为 null）。 */
export function chapterEncounterGroupId (id) {
  const chapter = chapterOf(id)
  return chapter?.group ? encounterGroupId(chapter.group) : null
}

/**
 * 仅图鉴的章节骨架（FHV `buildCatalogChapter` 同结构）。
 * 真实章节由各 scenario worker 的 `scenarios/<id>/index.js` 提供（见 scenarios/index.js）。
 */
export function buildCatalogChapter (id) {
  const chapter = chapterIdentity(id)
  const { name, nameEn, stepCode, referenceCodes } = chapter
  return {
    manifest: {
      ...catalogMetadata,
      id,
      name,
      campaignId: CAMPAIGN_ID,
      catalogReferenceOnly: true,
      referenceCode: referenceCodes[0],
      referenceCodes,
      requiredPackIds: ['tdcCampaign'],
      requiredEncounterGroupIds: [chapterEncounterGroupId(id)].filter(Boolean),
      requiredInvestigatorIds: [],
      requiredMechanicIds: [],
      behaviorIds: [id],
      locations: [],
      acts: [],
      agendas: [],
      resolutionIds: [],
      recordReads: [],
      recordWrites: [],
      zones: { encounterDeck: [], setAside: [], removed: [], victory: [] },
    },
    scenario: {
      id,
      name,
      nameEn,
      stepCode,
      originalCode: referenceCodes[0],
      migrationStatus: catalogMetadata.status,
    },
    behavior: { id },
  }
}

/** 章节 id 清单（只读；顺序 = CampaignSteps.hs）。 */
export const chapterIds = Object.freeze(chapters.map(chapter => chapter.id))
