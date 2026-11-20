// 《沉没之城》（The Drowned City）· 战役推进骨架（P7）：场景单元、西/东远征路线、
// Sepulchre 门槛判定、`nextStep` 语义、流程条件构造器与正文绑定。
//
// 事实源（锁定，只读）：
//   · 参考实现 `Campaigns/TheDrownedCity.hs`（`nextStep` / `CampaignStep` 分支 /
//     InterludeStep 1–4 / Sepulchre of the Sleeper 的 DoStep 2–3 / EpilogueStep）；
//   · `Campaigns/TheDrownedCity/CampaignSteps.hs`（10 个 ScenarioStep 卡号，已在 shared.js）；
//   · `Scenario/Scenarios/TheDrownedCity/*.hs` 的 `ScenarioResolution` 分支
//     （各章结局的 `endOfScenarioThen` 去向；见 flow.js 头部的逐条对照）；
//   · 英文指南 `frontend/src/locales/en/theDrownedCity/{base,interludes}.json`（正文键）。
//
// 本文件**不写卡、不改引擎**：只有常量、纯函数、条件构造器与只读正文绑定。
import { tdcStoryHeading, tdcStoryLabel, tdcStoryText } from './shared.js'
import {
  TDC_ARTIFACT_RECORD_KEYS, TDC_GLYPH_GATE, TDC_RLYEH_ARTIFACT_RECORD_KEYS, TDC_RLYEH_MAP_IDS,
  TDC_SET_RECORD_KEYS, translatedGlyphCount,
} from './records.js'
import { chapters, chapterOf, SCENARIO_IDS } from './shared.js'

// ---------------------------------------------------------------------------
// 1. 战役步骤与节点 id
// ---------------------------------------------------------------------------
export const TDC_PROLOGUE_STEP = 'prologue'
export const TDC_END_STEP = 'end'
// 主线叙事步骤（非 ScenarioStep 的 Interlude / Finale / Epilogue）。
export const TDC_INTERLUDE_STEPS = Object.freeze([
  'interludeOne', 'expeditionToRlyeh', 'theAwakening', 'returnToArkham',
])
export const TDC_FINALE_STEP = 'finale'
export const TDC_EPILOGUE_STEP = 'epilogue'

// 流程里「每关之后」的整备停点（唯一开购牌窗的地方；引擎只在 interlude 节点开窗）。
export const TDC_EXPEDITION_PREP_STEP = 'expeditionPrep'

// 六条 R'lyeh 远征路线关卡（不含 oneLastJob / sepulchre / doom）。
export const TDC_EXPEDITION_SCENARIO_IDS = Object.freeze([
  'theWesternWall', 'theDrownedQuarter', 'theApiary',
  'theGrandVault', 'courtOfTheAncients', 'obsidianCanyons',
])
// 西线与东线是同一环的两个方向（参考 `TheExpeditionHeadedWest/East` 记录 + 各章
// `endOfScenarioThen` 的 if headedWest 分支）。
export const TDC_WEST_ROUTE = Object.freeze([...TDC_EXPEDITION_SCENARIO_IDS])
export const TDC_EAST_ROUTE = Object.freeze([...TDC_EXPEDITION_SCENARIO_IDS].reverse())
export const TDC_ROUTES = Object.freeze({ west: TDC_WEST_ROUTE, east: TDC_EAST_ROUTE })

/** 路线 → 该方向的下一关（不在路线里返回 null）。 */
export function tdcRouteAfter (routeId, scenarioId) {
  const route = TDC_ROUTES[routeId]
  if (!route) return null
  const index = route.indexOf(scenarioId)
  return index >= 0 ? route[index + 1] || null : null
}

/** 路线 → 本章在路线中的序号（1-based；不在路线里返回 0）。 */
export function tdcRouteIndex (routeId, scenarioId) {
  const route = TDC_ROUTES[routeId]
  return route ? route.indexOf(scenarioId) + 1 : 0
}

// ---------------------------------------------------------------------------
// 2. 场景单元（身份表；章节正文在各自 definition.js）
// ---------------------------------------------------------------------------
export const TDC_SCENARIO_UNITS = Object.freeze(SCENARIO_IDS.map(id => {
  const chapter = chapterOf(id)
  return Object.freeze({
    id,
    cardCode: chapter?.stepCode || null,
    code: chapter?.referenceCodes?.[0] || chapter?.stepCode || null,
    referenceCodes: Object.freeze([...(chapter?.referenceCodes || [])]),
    name: chapter?.name || id,
    nameEn: chapter?.nameEn || id,
    encounterCode: chapter?.group || null,
    source: chapter?.source || null,
    // 战役角色：oneLastJob = 开场；expedition = 西部/东部远征六章；sepulchre = 墓穴；
    // doom1/doom2 = 终章上下；其余见 shared.js#chapters。
    kind: id === 'oneLastJob' ? 'opening'
      : TDC_EXPEDITION_SCENARIO_IDS.includes(id) ? 'expedition'
        : id === 'sepulchreOfTheSleeper' ? 'sepulchre'
          : id === 'theDoomOfArkhamPartI' ? 'doom1'
            : id === 'theDoomOfArkhamPartII' ? 'doom2' : 'scenario',
  })
}))

/** 场景单元（未知 id 返回 null）。 */
export function scenarioUnitOf (id) {
  return TDC_SCENARIO_UNITS.find(unit => unit.id === id) || null
}

export function scenarioKind (id) {
  return scenarioUnitOf(id)?.kind || null
}

// ---------------------------------------------------------------------------
// 3. 流程条件构造器（纯数据；`campaign-flow.js#CONDITION_FIELDS` 允许的形状）
// ---------------------------------------------------------------------------
/** `{ record: key, equals: true }`（布尔记录已勾选）。 */
export const hasRecord = key => ({ record: key, equals: true })
/** `{ record: key, includes: value }`（集合记录）。 */
export const includesRecord = (key, value) => ({ record: key, includes: value })
/** `{ not: { record: key, equals: true } }`。 */
export const lacksRecord = key => ({ not: hasRecord(key) })
/** `{ all: [...] }` / `{ any: [...] }`。 */
export const allOf = (...conditions) => ({ all: conditions })
export const anyOf = (...conditions) => ({ any: conditions })
export const notOf = condition => ({ not: condition })

/** 已获得任意一件 R'lyeh 文物（参考 `anyM getHasRecord rlyehArtifacts`）。 */
export const anyRlyehArtifact = () => anyOf(...TDC_RLYEH_ARTIFACT_RECORD_KEYS.map(hasRecord))
/** 5 件 R'lyeh 文物全部获得（`length rlyehArtifacts`）。 */
export const allRlyehArtifacts = () => allOf(...TDC_RLYEH_ARTIFACT_RECORD_KEYS.map(hasRecord))
/** 任意一件文物（含 Horror in Clay；Artifacts Earned 分节）。 */
export const anyArtifact = () => anyOf(...TDC_ARTIFACT_RECORD_KEYS.map(hasRecord))

/** 已翻译字形数 ≥ n（`recordCount` 读 string[] 集合）。 */
export const atLeastGlyphs = amount => ({ recordCount: { key: 'discoveredGlyphs', atLeast: amount } })
/** 已划除的 R'lyeh 地图条目（reference `RlyehMap` 记录集合）。 */
export const rlyehMapCrossed = id => includesRecord('rlyehMap', id)

/** 某关某结局（`campaign.scenarioResults` 最后一条同关结果）。 */
export const resolvedAs = (scenarioId, value) => ({ resolution: { scenarioId, value } })
/** 某关是否已完成（`campaign.scenarioResults` 内有记录）。 */
export const completedScenario = scenarioId => ({ completed: scenarioId })
/** 某战役记录为 true。 */
export const recordIsTrue = key => hasRecord(key)

// 路线记录（Interlude II 的选择）。
// `theExpeditionHeadedWest` / `theExpeditionHeadedEast`（§4）。
export const headedWest = () => hasRecord('theExpeditionHeadedWest')
export const headedEast = () => hasRecord('theExpeditionHeadedEast')

// ---------------------------------------------------------------------------
// 4. Sepulchre of the Sleeper 门槛（参考 TheDrownedCity.hs#CampaignStep Sepulchre 分支）
// ---------------------------------------------------------------------------
/**
 * 第一道门：`artifacts >= 1 && glyphs >= 10` → 进入 Sepulchre 第二步（DoStep 2）；
 * 否则跳过整个剧本，直接去 Interlude III（The Awakening）。
 */
export function tdcSepulchreGateOne ({ artifacts = 0, glyphs = 0 } = {}) {
  return artifacts >= 1 && glyphs >= TDC_GLYPH_GATE.basic
}

/**
 * 第二道门：`artifacts >= 5 && glyphs >= 26 && 内殿解封` → 进入第三步（DoStep 3，玩家二选一）；
 * 否则给战役混乱袋永久加 1 个 0 标记，然后去 Interlude III。
 */
export function tdcSepulchreGateTwo ({ artifacts = 0, glyphs = 0, innerSanctumUnsealed = false } = {}) {
  return artifacts >= TDC_RLYEH_ARTIFACT_RECORD_KEYS.length
    && glyphs >= TDC_GLYPH_GATE.full
    && innerSanctumUnsealed === true
}

/** 从战役记录读出门槛输入（只读；供大厅/测试/处理器共用）。 */
export function sepulchreReadiness (records = {}) {
  return {
    artifacts: TDC_RLYEH_ARTIFACT_RECORD_KEYS.filter(key => records?.[key] === true).length,
    glyphs: translatedGlyphCount(records),
    innerSanctumUnsealed: records?.theInnerSanctumWasUnsealed === true,
    gateOne: tdcSepulchreGateOne({
      artifacts: TDC_RLYEH_ARTIFACT_RECORD_KEYS.filter(key => records?.[key] === true).length,
      glyphs: translatedGlyphCount(records),
    }),
    gateTwo: tdcSepulchreGateTwo({
      artifacts: TDC_RLYEH_ARTIFACT_RECORD_KEYS.filter(key => records?.[key] === true).length,
      glyphs: translatedGlyphCount(records),
      innerSanctumUnsealed: records?.theInnerSanctumWasUnsealed === true,
    }),
  }
}

// Interlude III 的混乱袋符号替换（参考 theAwakening 的 removeAllChaosTokens + addChaosToken 次数）。
// 有文物：移除所有 cultist/tablet/elderthing 后各加 2；无文物：移除后加 1 cultist / 1 tablet / 2 elderthing。
export const TDC_AWAKENING_TOKENS = Object.freeze({
  withArtifact: Object.freeze(['cultist', 'cultist', 'tablet', 'tablet', 'elderthing', 'elderthing']),
  withoutArtifact: Object.freeze(['cultist', 'tablet', 'elderthing', 'elderthing']),
})

// ---------------------------------------------------------------------------
// 5. EpilogueStep 的分支（参考 epilogue 的 Campaign Log 检查顺序）
// ---------------------------------------------------------------------------
// 顺序即优先级（第一条命中即读）：1 阿卡姆被毁；2 被驱离或（被放逐且阿卡姆被摧毁）；
// 3 被放逐；4 阻止苏醒。都不命中则不读尾声正文、直接结束。
export const TDC_EPILOGUE_BRANCHES = Object.freeze([
  Object.freeze({ id: 'epilogue1', when: hasRecord('cthulhuAnnihilatedTheCityOfArkham'), titleKey: 'epilogue.epilogue1.title', textKey: 'epilogue.epilogue1.body', outcome: 'defeat' }),
  Object.freeze({ id: 'epilogue2', when: anyOf(hasRecord('cthulhuWasDrivenAway'), allOf(hasRecord('cthulhuWasBanished'), hasRecord('arkhamWasDestroyed'))), titleKey: 'epilogue.epilogue2.title', textKey: 'epilogue.epilogue2.body', outcome: 'victory' }),
  Object.freeze({ id: 'epilogue3', when: hasRecord('cthulhuWasBanished'), titleKey: 'epilogue.epilogue3.title', textKey: 'epilogue.epilogue3.body', outcome: 'victory' }),
  Object.freeze({ id: 'epilogue4', when: hasRecord('theInvestigatorsHaltedCthulhusAwakening'), titleKey: 'epilogue.epilogue4.title', textKey: 'epilogue.epilogue4.body', outcome: 'victory' }),
])

/** 纯函数：按记录选尾声分支 id（None = 读不到尾声，直接结束）。 */
export function tdcEpilogueBranch (records = {}) {
  return TDC_EPILOGUE_BRANCHES.find(branch => {
    const value = branch.when
    if (value.all) return value.all.every(item => tdcRecordCondition(item, records))
    if (value.any) return value.any.some(item => tdcRecordCondition(item, records))
    if (value.not) return !tdcRecordCondition(value.not, records)
    return tdcRecordCondition(value, records)
  })?.id || null
}

// 只读条件求值（仅支持 record+equals；尾部供 tdcEpilogueBranch 用，不参与引擎读点）。
function tdcRecordCondition (condition, records) {
  if (!condition || typeof condition !== 'object') return false
  if (condition.all) return condition.all.every(item => tdcRecordCondition(item, records))
  if (condition.any) return condition.any.some(item => tdcRecordCondition(item, records))
  if (condition.not) return !tdcRecordCondition(condition.not, records)
  if (condition.record) return records?.[condition.record] === condition.equals
  return false
}

// ---------------------------------------------------------------------------
// 6. 整备停点与升级窗（引擎只在 interlude 节点开购牌窗）
// ---------------------------------------------------------------------------
export const TDC_UPGRADE_INTERLUDES = Object.freeze([
  'interludeOne', 'anOfferAccepted', 'theAwakening', 'theAwakeningConclusion', 'returnToArkham',
])
export const TDC_NO_UPGRADE_INTERLUDES = Object.freeze([
  'prologue', 'anOfferRefused', 'sepulchreGate', 'sepulchreGateStep2', 'sepulchreAddZero',
  'theAwakeningArtifact', 'theAwakeningNoArtifact', 'finale', 'epilogue',
  'epilogue1', 'epilogue2', 'epilogue3', 'epilogue4',
])

// ---------------------------------------------------------------------------
// 7. 正文键解析 / 节点正文绑定
// ---------------------------------------------------------------------------
// 流程节点只存键；正文来自 story-text 的 campaign 作用域（base.json + interludes.json）或
// 章节作用域（`<chapterId>::<path>`）。缺键/未预载返回空串（不回退英文正文，避免以英文冒充中文）。
export const storyKey = key => (typeof key === 'string' ? key : '')
export const chapterStoryKey = (chapterId, path) => `${chapterId}::${path}`

/** 战役级正文（base.json / interludes.json 的叶子）。 */
export function campaignText (key) {
  return tdcStoryText(key)
}

/** 章节级正文（`<chapterId>::<path>`；章节 locale JSON 的根）。 */
export function chapterText (chapterId, path) {
  return tdcStoryText(chapterStoryKey(chapterId, path))
}

export function campaignHeading (key) {
  return tdcStoryHeading(key)
}

export function campaignLabel (key) {
  return tdcStoryLabel(key)
}

/**
 * 把正文键解析到流程节点（幂等；预载完成后由 `flow.js#refreshTdcFlowText` 调用）。
 * - `node.textKey` / `node.textKeys` → `node.text`；
 * - `node.titleKey` → `node.title`；
 * - 选项 `labelKey` → `option.label`（缺键时保留内容层中文兜底）。
 */
export function localizeTdcNodes (nodes = {}) {
  for (const node of Object.values(nodes)) {
    if (!node || typeof node !== 'object') continue
    const textKeys = [node.textKey, ...(Array.isArray(node.textKeys) ? node.textKeys : [])].filter(Boolean)
    if (textKeys.length) {
      const text = textKeys.map(key => campaignText(key)).filter(Boolean).join('\n\n')
      if (text) node.text = text
    }
    if (node.titleKey) {
      const title = campaignHeading(node.titleKey)
      if (title) node.title = title
    }
    for (const option of node.options || []) {
      if (!option?.labelKey) continue
      const label = campaignLabel(option.labelKey)
      if (label) option.label = label
    }
  }
  return nodes
}

// 供大厅/审计的只读身份表。
export const TDC_CHAPTER_IDS = Object.freeze(chapters.map(chapter => chapter.id))

export { TDC_RLYEH_MAP_IDS, TDC_ARTIFACT_RECORD_KEYS, TDC_RLYEH_ARTIFACT_RECORD_KEYS, TDC_SET_RECORD_KEYS }
