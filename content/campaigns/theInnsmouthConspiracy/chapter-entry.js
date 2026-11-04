// 《印斯茅斯暗潮》章节装配：把 chapter-data.json 的纯数据章节升级为内容注册表
// 可启动的生产关卡（P8），同时保留 developmentChapter 供历史测试/工具兼容。
//
// 生产注册要点（见 content/schema.js 的 assertScenarioManifest / assertUiLayout）：
//   · status 'playable' + 真实 layout（每个声明地点都有有限坐标；edges 只镜像已声明 connections）；
//   · requiredPackIds 含 notz：harper 的遭遇牌库用 01135/01136（夜之狂热包），
//     只写 core+ticCampaign 会被注册期「依赖的原卡未在所需卡包中」拒绝；
//   · requiredEncounterGroupIds 只取 ticCampaign 包实际声明的遭遇组（gatherSets 里
//     跨循环复用的 rats/agents_of_cthulhu/chilling_cold 等由 core/notz 包按卡号覆盖，
//     不能写进这里——它们不在所需卡包的 encounterGroupIds 声明里）；
//   · recordReads/recordWrites 由本章 chapter-data 记录字段 + 战役模块实际引用推导，
//     并且必须全部是 records.js#RECORD_TYPES 的键；
//   · behavior 与 developmentChapter 完全一致（deferStartingLocationReveal + 三段 setup 钩子），
//     58 个 tic 测试文件依赖这套钩子形状，不得改动。
import { registerCampaignEffectHandler } from '../../../src/campaign/content-effects.js'
import { handlerId, runInterludeEffect } from './interludes.js'
import { buildChapterDefinition, chapterData } from './chapter-definition.js'
import { prepareCompanions } from './companions-setup.js'
import { entryRules } from './entry-rules.js'
import { earlySetupLocations, earlyAfterDeckSetup } from './chapter-setup.js'
import { middleStartLocation, middleSetupLocations, middleAfterDeckSetup } from './middle-setup.js'
import { lateSetupLocations, lateAfterDeckSetup, lateAfterChaosBagSetup } from './late-setup.js'
import { layoutFor, scenarioManifest } from '../../scenario-manifest.js'
import { chapters, CAMPAIGN_ID, ENCOUNTER_GROUPS } from './shared.js'
import { RECORD_TYPES } from './records.js'
// 每章真实桌面坐标模块（数据层；见 scenarios/<id>/layout.js 与 ../layout.js）。
import { coordinates as thePitOfDespairCoordinates } from './scenarios/thePitOfDespair/layout.js'
import { coordinates as theVanishingOfElinaHarperCoordinates } from './scenarios/theVanishingOfElinaHarper/layout.js'
import { coordinates as inTooDeepCoordinates } from './scenarios/inTooDeep/layout.js'
import { coordinates as devilReefCoordinates } from './scenarios/devilReef/layout.js'
import { coordinates as horrorInHighGearCoordinates } from './scenarios/horrorInHighGear/layout.js'
import { coordinates as aLightInTheFogCoordinates } from './scenarios/aLightInTheFog/layout.js'
import { coordinates as theLairOfDagonCoordinates } from './scenarios/theLairOfDagon/layout.js'
import { coordinates as intoTheMaelstromCoordinates } from './scenarios/intoTheMaelstrom/layout.js'

// chapterId → 桌面坐标（每章 layout.js 导出的数据）。
const CHAPTER_COORDINATES = Object.freeze({
  thePitOfDespair: thePitOfDespairCoordinates,
  theVanishingOfElinaHarper: theVanishingOfElinaHarperCoordinates,
  inTooDeep: inTooDeepCoordinates,
  devilReef: devilReefCoordinates,
  horrorInHighGear: horrorInHighGearCoordinates,
  aLightInTheFog: aLightInTheFogCoordinates,
  theLairOfDagon: theLairOfDagonCoordinates,
  intoTheMaelstrom: intoTheMaelstromCoordinates,
})

// ticCampaign 包声明的遭遇组（shared.js#ENCOUNTER_GROUPS 的 camelCase 形式）。
// 各章 gatherSets 里跨循环复用的核心组不在 ticCampaign 声明内，按卡号由 core/notz 包覆盖。
const TIC_ENCOUNTER_GROUP_IDS = Object.freeze(new Set(
  ENCOUNTER_GROUPS.map(group => group.replace(/_([a-z])/g, (_, lower) => lower.toUpperCase()))))
const camelCase = group => group.replace(/_([a-z])/g, (_, lower) => lower.toUpperCase())

// 每章实际要求已登记的机制（content/mechanics.js#supportedMechanics 的子集）。
// 依据：chapter-data 的 water/keys 数据 + 本章卡条目的真实读点（诅咒/祝福/载具/道路）。
const CHAPTER_MECHANICS = Object.freeze({
  thePitOfDespair: ['ticFlood', 'ticKeys'],
  theVanishingOfElinaHarper: [],
  inTooDeep: ['ticFlood', 'ticKeys', 'ticCurse'],
  devilReef: ['ticFlood', 'ticKeys', 'ticVehicles'],
  horrorInHighGear: ['ticVehicles', 'ticRoad'],
  aLightInTheFog: ['ticFlood', 'ticKeys'],
  theLairOfDagon: ['ticFlood', 'ticKeys', 'ticBless', 'ticCurse'],
  intoTheMaelstrom: ['ticFlood', 'ticKeys'],
})

// 战役模块（interludes/resolutions/setup/卡条目）对本章记录的读/写，章节数据里
// 没有直接出现的部分在这里按实际读点补齐。所有键都必须存在于 records.js#RECORD_TYPES。
const CHAPTER_RECORD_USAGE = Object.freeze({
  thePitOfDespair: { reads: [], writes: ['memoriesRecovered'] },
  theVanishingOfElinaHarper: {
    reads: ['possibleSuspects', 'possibleHideouts', 'harperSuspect', 'harperHideout', 'memoriesRecovered'],
    writes: ['possibleSuspects', 'possibleHideouts', 'harperSuspect', 'harperHideout', 'memoriesRecovered'],
  },
  inTooDeep: { reads: ['harperHideout', 'outForBlood', 'memoriesRecovered'], writes: ['memoriesRecovered'] },
  devilReef: { reads: ['TheMissionWasSuccessful', 'memoriesRecovered'], writes: ['memoriesRecovered'] },
  horrorInHighGear: { reads: ['TheTerrorOfDevilReefIsDead', 'memoriesRecovered'], writes: ['memoriesRecovered'] },
  aLightInTheFog: {
    reads: ['memoriesRecovered', 'TheInvestigatorsReachedFalconPointBeforeSunrise',
      'TheInvestigatorsReachedFalconPointAfterSunrise', 'TheTideHasGrownStronger'],
    writes: ['memoriesRecovered'],
  },
  theLairOfDagon: { reads: ['TheMissionWasSuccessful', 'memoriesRecovered'], writes: ['memoriesRecovered'] },
  intoTheMaelstrom: {
    reads: ['memoriesRecovered', 'TheTerrorOfDevilReefIsDead', 'TheGatekeeperHasBeenDefeated',
      'TheOrdersRitualWasDisrupted', 'DagonHasAwakened'],
    writes: ['memoriesRecovered'],
  },
})

const RECORD_KEYS = new Set(Object.keys(RECORD_TYPES))
const WRITE_PATHS = new Set(['records', 'record', 'recordsFromAct', 'recordsFromSetup', 'startingRecords'])
// content/schema.js#refs 要求场景依赖 id 以 ASCII 小写字母开头（/^[a-z][A-Za-z0-9-]*$/）。
// TIC 的战役记录沿用参考实现的 PascalCase 键（TheMissionFailed 等），不能在 manifest 的
// recordReads/recordWrites 中声明；这里只登记满足 ref id 约束的记录键，其余键仍由
// 战役 recordSchema（允许大写开头）与运行时读写点覆盖。
const DECLARABLE_RECORD = /^[a-z][A-Za-z0-9-]*$/

// 递归扫描本章 chapter-data：记录名出现在 records/record/recordsFromAct 子树下记为写入，
// 其他位置（如 reachable 条件）记为读取。保证数据新增记录时清单自动跟随。
function scanChapterRecords(value, path, reads, writes) {
  if (typeof value === 'string') {
    if (!RECORD_KEYS.has(value)) return
    ;(path.some(segment => WRITE_PATHS.has(segment)) ? writes : reads).add(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) scanChapterRecords(item, path, reads, writes)
    return
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (RECORD_KEYS.has(key)) writes.add(key)
      scanChapterRecords(item, [...path, key], reads, writes)
    }
  }
}

export function chapterRecordUsage(chapterId) {
  const spec = chapterData[chapterId]
  if (!spec) throw new RangeError(`Unknown Innsmouth chapter: ${chapterId}`)
  const reads = new Set(CHAPTER_RECORD_USAGE[chapterId]?.reads || [])
  const writes = new Set(CHAPTER_RECORD_USAGE[chapterId]?.writes || [])
  scanChapterRecords(spec, [chapterId], reads, writes)
  const unknown = [...reads, ...writes].filter(key => !RECORD_KEYS.has(key))
  if (unknown.length) throw new TypeError(`${chapterId}: 未知战役记录 ${unknown.join('、')}`)
  const declarable = key => DECLARABLE_RECORD.test(key)
  return { reads: [...reads].filter(declarable).sort(), writes: [...writes].filter(declarable).sort() }
}

// 本章要求的遭遇组：gatherSets ∪ 本章自己的遭遇组，取 ticCampaign 包声明过的 camelCase id。
export function chapterEncounterGroups(chapterId) {
  const spec = chapterData[chapterId]
  const chapter = chapters.find(entry => entry.id === chapterId)
  if (!spec || !chapter) throw new RangeError(`Unknown Innsmouth chapter: ${chapterId}`)
  const groups = new Set([...(spec.gatherSets || []), chapter.encounterCode])
  return [...groups].map(camelCase).filter(groupId => TIC_ENCOUNTER_GROUP_IDS.has(groupId)).sort()
}

// 章节行为：开发期与生产期必须完全一致（58 个 tic 测试文件与大厅 setup 共用这些钩子）。
function chapterBehavior(id) {
  const index = chapters.findIndex(chapter => chapter.id === id)
  if (index < 0) throw new RangeError(`Unknown Innsmouth chapter: ${id}`)
  return { ...entryRules, id, deferStartingLocationReveal: true,
    ...(['devilReef', 'theLairOfDagon'].includes(id) ? { setupBeforeOpeningHands: true, preScenarioSetup: prepareCompanions } : {}),
    ...(index < 3 ? { setupLocations: earlySetupLocations, afterDeckSetup: earlyAfterDeckSetup }
      : index < 5 ? { startLocation: middleStartLocation, setupLocations: middleSetupLocations, afterDeckSetup: middleAfterDeckSetup }
        : { setupLocations: lateSetupLocations, afterDeckSetup: lateAfterDeckSetup, afterChaosBagSetup: lateAfterChaosBagSetup }) }
}

function formatLayout(scenario, chapterId) {
  const coordinates = CHAPTER_COORDINATES[chapterId]
  if (!coordinates) throw new RangeError(`Missing layout coordinates: ${chapterId}`)
  return layoutFor(scenario, coordinates)
}

// 生产关卡：真实 layout + playable manifest + 与开发期相同的行为。
// 组合根（content/registered.js）静态 import 本模块。此前 chapter-entry → companions-setup
// → src/engine/hand-entry.js → content/registered.js 的静态环会在「先 import chapter-entry」
// 时触发 TDZ；现在 companions-setup 改走场景运行时 api.putInHand(seat, code)，环已断开
//（scenario-runtime.js 只是 engine → content 的单向依赖），因此这里不再需要惰性注册。
export function productionChapter(id) {
  registerCampaignEffectHandler(handlerId, runInterludeEffect)
  const { scenario, identities } = buildChapterDefinition(id)
  const chapter = chapters.find(entry => entry.id === id)
  if (!chapter) throw new RangeError(`Unknown Innsmouth chapter: ${id}`)
  const behavior = chapterBehavior(id)
  const layout = formatLayout(scenario, id)
  const usage = chapterRecordUsage(id)
  const manifest = scenarioManifest(scenario, identities, {
    campaignId: CAMPAIGN_ID,
    status: 'playable',
    layout,
    // notz：harper 的遭遇牌库引用 01135/01136（夜之狂热包）——注册期按卡包覆盖校验。
    requiredPackIds: ['core', 'notz', 'ticCampaign'],
    requiredEncounterGroupIds: chapterEncounterGroups(id),
    requiredMechanicIds: [...CHAPTER_MECHANICS[id]],
    requiredInvestigatorIds: [],
    recordReads: usage.reads,
    recordWrites: usage.writes,
    behaviorIds: [id],
  })
  manifest.referenceCode = chapter.code
  return { scenario, identities, manifest, behavior, layout }
}

// 兼容路径：历史工具/测试仍可用开发期装配（不进入生产组合根）。
// `registerCampaignEffectHandler` 对同一函数对象幂等，生产/开发混用不会重复注册。
export function developmentChapter(id) {
  registerCampaignEffectHandler(handlerId, runInterludeEffect)
  const { scenario, identities } = buildChapterDefinition(id)
  const behavior = chapterBehavior(id)
  const layout = { locations: { [scenario.startLocation]: { x: 0, y: 0 } }, edges: [] }
  const manifest = scenarioManifest(scenario, identities, { campaignId: CAMPAIGN_ID, status: 'development',
    requiredPackIds: ['core', 'notz', 'ticCampaign'], behaviorIds: [id], layout })
  manifest.referenceCode = scenario.referenceCode
  return { scenario, identities, manifest, behavior, layout }
}
