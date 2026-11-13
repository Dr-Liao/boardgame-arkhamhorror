// 《绯红密钥》章节目录（P7）：真实章模块 + P0 目录占位（兼容保留）。
//
// 两条路径并存，各有明确用途：
//   1. **P7 真实章**（`chapterEntries` / `chapters` / `scenariosById`）：由
//      `content/campaigns/theScarletKeys/scenarios/<id>/index.js`（各章 worker 交付）汇总，
//      带真实 layout / behavior / 关卡 manifest；注册路径用 `requireChapters()`（十章缺一即抛）。
//   2. **P0 目录占位**（`catalogChapter` / `catalogChapters`）：与 TIC/EotE 的 P0 同一口径
//      （`catalogReferenceOnly` + `status: 'catalog-only'`），供 `tests/tsk-migration.test.mjs`
//      在战役尚未注册进生产组合根时复算十章身份；P7 收口后不再用于注册。
import { CAMPAIGN_ID, chapters as catalogChapterList } from './shared.js'
import {
  missingScenarioIds, requireAllScenarios, scenarioEntries, scenarioManifests, scenariosById,
} from './scenarios/index.js'

// ---------------------------------------------------------------------------
// 一、P0 目录占位（保持不变；仅身份，不声明布置/幕/议程/结局）
// ---------------------------------------------------------------------------
export function catalogChapter (id) {
  const chapter = catalogChapterList.find(entry => entry.id === id)
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

export const catalogChapters = Object.freeze(catalogChapterList.map(chapter => catalogChapter(chapter.id)))

// ---------------------------------------------------------------------------
// 二、P7 真实章
// ---------------------------------------------------------------------------
/** 章节身份（shared.js 的 P0 事实：卡号/世界地图节点/档案号）。 */
function identityOf (id) {
  const chapter = catalogChapterList.find(entry => entry.id === id)
  if (!chapter) throw new RangeError(`未知章节 ${id}`)
  return chapter
}

/**
 * 真实章条目（按 CampaignSteps.hs 顺序，只含已落盘章）：
 * `{ id, cardCode, name, nameEn, mapLocationId, archiveLabel, module, manifest, scenario, behavior, layout }`。
 */
export const chapterEntries = Object.freeze(scenarioEntries.map(entry => {
  const identity = identityOf(entry.id)
  return Object.freeze({
    id: entry.id,
    scenarioId: entry.id,
    cardCode: identity.referenceCode,
    referenceCode: identity.referenceCode,
    name: identity.name,
    nameEn: identity.nameEn,
    mapLocationId: identity.mapLocationId,
    archiveLabel: identity.archiveLabel,
    module: entry.module,
    manifest: entry.manifest,
    scenario: entry.scenario,
    behavior: entry.behavior,
    layout: entry.layout,
  })
}))

/** P7 章列表（别名：`chapters` 指真实章；P0 占位仍在 `catalogChapters`）。 */
export const chapters = chapterEntries
/** 章 id → 模块命名空间。 */
export const chapterModulesById = scenariosById
/** 章 id → 关卡 manifest。 */
export const chapterManifestsById = scenarioManifests
/** 尚未落盘的章 id。 */
export const missingChapterIds = missingScenarioIds

/** 单章（未知/未落盘返回 null）。 */
export function chapterEntryOf (id) {
  return chapterEntries.find(entry => entry.id === id) || null
}

/** 注册/验收路径：十章齐备才返回（缺章抛错，fail closed）。 */
export function requireChapters () {
  requireAllScenarios()
  return chapterEntries
}
