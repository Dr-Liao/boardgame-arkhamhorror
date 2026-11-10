// 《绯红密钥》目录关卡占位（P0/M0）：只登记提示卡与地图节点身份，不声明布置、幕／议程或结局。
//
// 与 EotE/TIC P0 的 catalogChapter 同一口径：`catalogReferenceOnly` 让注册表能把占位关卡装进
// 组合根、参与依赖与身份校验，但 `assertLaunchableCampaign` 会因为 status 仍是 catalog-only 而拒绝启动。
// P7 逐章交付真实 layout/behavior 时改为 `content/campaigns/theScarletKeys/scenarios/<id>/`。
import { CAMPAIGN_ID, chapters } from './shared.js'

export function catalogChapter(id) {
  const chapter = chapters.find(entry => entry.id === id)
  if (!chapter) throw new RangeError(`未知章节 ${id}`)
  return Object.freeze({
    manifest: Object.freeze({
      schemaVersion: 1, id, campaignId: CAMPAIGN_ID, name: chapter.name,
      contentVersion: '0.1.0', minRulesVersion: 'n6.0', status: 'catalog-only',
      catalogReferenceOnly: true, referenceCode: chapter.referenceCode,
      requiredPackIds: ['core', 'tskCampaign'], requiredEncounterGroupIds: [],
      requiredInvestigatorIds: [], requiredMechanicIds: [],
      locations: [], acts: [], agendas: [], resolutionIds: [], recordReads: [], recordWrites: [],
      zones: { encounterDeck: [], setAside: [], removed: [], victory: [] }, behaviorIds: [id],
    }),
    scenario: Object.freeze({
      id, name: chapter.name, nameEn: chapter.nameEn, originalCode: chapter.referenceCode,
      migrationStatus: 'catalog-only',
    }),
    behavior: Object.freeze({ id }),
  })
}

export const catalogChapters = Object.freeze(chapters.map(chapter => catalogChapter(chapter.id)))
