// 历史目录占位工厂（P0/P7 之前用于「尚未迁移章节」的目录级注册与校验工具）。
//
// P8 之后《印斯茅斯暗潮》八章已经是生产 playable 章节，生产组合根只走
// `chapter-entry.js#productionChapter`；本文件不再被任何生产/测试路径调用，
// 仅作为「未来章节尚未迁移时」的占位样例保留（与 theCircleUndone / theDreamEaters
// 的同名 catalogChapters 保持同一形状）。不要用它注册 TIC 章节。
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
