// 《铁杉谷盛宴》（The Feast of Hemlock Vale）· 战役推进骨架（P7）：12 个场景步、三天三夜时间轴、
// 五个勘察场景与「按未勘察区域选择」规则、夜 1/夜 2 分支、`nextStep` 语义与正文键解析。
//
// 事实源（锁定，只读）：
//   · 参考实现 `Arkham/Campaign/Campaigns/TheFeastOfHemlockVale.hs#nextStep`（`handleTime` 的
//     (day, time) 分支 + 各 ScenarioStep 分支逐条镜像）；
//   · `Campaigns/TheFeastOfHemlockVale/CampaignSteps.hs`（12 个 ScenarioStep 卡号）；
//   · `Campaigns/TheFeastOfHemlockVale/Helpers.hs`（`initMeta`/`setupHemlockDay`/`getAreasSurveyed`/
//     `afterPrelude`/`getCrossedOutResidents`/`makePreparationsForNextSurvey`）；
//   · 英文指南 `frontend/src/locales/en/theFeastOfHemlockVale/base.json`（`prelude1`–`prelude4` 四段序曲、
//     `prelude.theFirstEvening`/`prelude.theSecondEvening` 两段纯叙事夜、`key.[areasSurveyed]` 七区、
//     `headings.preludeTheFinalEvening`）；
//   · `audit/fhv-scope.json#campaignFlow`（surveyScenarios / surveyTimes / nightOptions / narrativeOnlySteps）。
//
// 本文件**不写卡、不改引擎**：只有常量、纯函数与只读正文解析，供 flow.js / prologue.js /
// interludes.js / epilogue.js 与测试共用。节点正文只存 `textKey`，正文由 `campaignStoryText` /
// `campaignStoryHeading` / `campaignStoryLabel` 从 story-text 读取（不写死中文）。
import { chapters } from './shared.js'
import { chapterStory, chapterText, flattenStory } from './story-access.js'
import { FHV_AREAS, FHV_AREA_BY_SCENARIO, areaRecordKeys, surveyedAreas } from './records.js'

export { FHV_AREAS, areaRecordKeys, surveyedAreas }

export const FHV_CAMPAIGN_ID = 'theFeastOfHemlockVale'

// 四段叙事序曲共用 base.json 的 726 条叶子（`prologue`/`prelude1`–`prelude4`/`epilogue`/`key`/`specialRules`），
// 因此战役级正文一律从这四章中的任意一章读（口径见 records.js#LABEL_CHAPTER）。
export const FHV_STORY_CHAPTER = 'welcomeToHemlockVale'

// ---------------------------------------------------------------------------
// 1. 场景步（12 个 ScenarioStep，顺序 = CampaignSteps.hs = shared.js#chapters）
// ---------------------------------------------------------------------------
export const FHV_PROLOGUE_STEP = 'prologue'
export const FHV_PROLOGUE_RULES_STEP = 'prologueRules'
export const FHV_EPILOGUE_STEP = 'epilogue'
export const FHV_END_STEP = 'end'

// 四段「可游玩序曲」（各有地点/幕/议程，是真正的 scenario；CampaignSteps.hs 的 ScenarioStep）。
export const FHV_PRELUDE_SCENARIO_IDS = Object.freeze([
  'welcomeToHemlockVale', 'dawnOfTheSecondDay', 'dawnOfTheFinalDay', 'preludeTheFinalEvening',
])
// 两段「纯叙事夜」（参考实现的 `CampaignSpecificStep "preludeTheFirstEvening"/"preludeTheSecondEvening"`，
// 即 audit#campaignFlow.narrativeOnlySteps：没有地点/幕，只有法典选择 + 下一场勘察选择）。
export const FHV_EVENING_STEPS = Object.freeze(['preludeTheFirstEvening', 'preludeTheSecondEvening'])
// 五个勘察关卡（audit#campaignFlow.surveyScenarios，顺序同 base.json `key.[areasSurveyed]`）。
export const FHV_SURVEY_SCENARIO_IDS = Object.freeze([
  'writtenInRock', 'hemlockHouse', 'theSilentHeath', 'theLostSister', 'theThingInTheDepths',
])
// 两个固定夜章 + 夜 3 终章。
export const FHV_NIGHT_SCENARIO_IDS = Object.freeze(['theTwistedHollow', 'theLongestNight'])
export const FHV_ENDGAME_SCENARIO_ID = 'fateOfTheVale'

export const FHV_SCENARIO_IDS = Object.freeze(chapters.map(chapter => chapter.id))

/** 场景步的战役角色：`prelude` / `survey` / `night` / `endgame`。 */
export function scenarioKind (scenarioId) {
  if (FHV_PRELUDE_SCENARIO_IDS.includes(scenarioId)) return 'prelude'
  if (FHV_SURVEY_SCENARIO_IDS.includes(scenarioId)) return 'survey'
  if (FHV_NIGHT_SCENARIO_IDS.includes(scenarioId)) return 'night'
  if (scenarioId === FHV_ENDGAME_SCENARIO_ID) return 'endgame'
  return null
}

// 英文名（身份展示用；剧情正文一律走 story-text，不在这里抄）。
const NAME_EN = Object.freeze({
  welcomeToHemlockVale: 'Prelude: Welcome to Hemlock Vale',
  writtenInRock: 'Written in Rock',
  hemlockHouse: 'Hemlock House',
  theSilentHeath: 'The Silent Heath',
  theLostSister: 'The Lost Sister',
  theThingInTheDepths: 'The Thing in the Depths',
  theTwistedHollow: 'The Twisted Hollow',
  dawnOfTheSecondDay: 'Prelude: Dawn of the Second Day',
  theLongestNight: 'The Longest Night',
  dawnOfTheFinalDay: 'Prelude: Dawn of the Final Day',
  preludeTheFinalEvening: 'Prelude: The Final Evening',
  fateOfTheVale: 'Fate of the Vale',
})

// 时间槽（三天三夜：day/night × 3）+ 每个场景步「在哪一刻进入」。
export const FHV_SLOTS = Object.freeze(['day1', 'night1', 'day2', 'night2', 'day3', 'night3'])
export const FHV_SLOT_DATE = Object.freeze({
  day1: Object.freeze({ day: 1, period: 'day' }),
  night1: Object.freeze({ day: 1, period: 'night' }),
  day2: Object.freeze({ day: 2, period: 'day' }),
  night2: Object.freeze({ day: 2, period: 'night' }),
  day3: Object.freeze({ day: 3, period: 'day' }),
  night3: Object.freeze({ day: 3, period: 'night' }),
})
export const FHV_STEP_SLOT = Object.freeze({
  welcomeToHemlockVale: 'day1',
  writtenInRock: 'day1', // 勘察关卡的时段由它被选中时的槽位决定（见 fhvSlotOfScenario）
  hemlockHouse: 'day1',
  theSilentHeath: 'day1',
  theLostSister: 'day1',
  theThingInTheDepths: 'day1',
  preludeTheFirstEvening: 'night1',
  theTwistedHollow: 'night1',
  dawnOfTheSecondDay: 'day2',
  preludeTheSecondEvening: 'night2',
  theLongestNight: 'night2',
  dawnOfTheFinalDay: 'day3',
  preludeTheFinalEvening: 'night3',
  fateOfTheVale: 'night3',
})

export const DATE_RECORD = 'hemlockDate'
export const DAY_RECORD = 'day'
export const TIME_RECORD = 'time'

/** `{day, period}` → `records.hemlockDate` 的存档字符串（`scenario-calendar.js#setScenarioDate` 同形）。 */
export const fhvDateString = date => `${Number(date?.day) || 1}:${date?.period === 'night' ? 'night' : 'day'}`

/** `records.hemlockDate` → `{day, period}`（非法/缺失返回 null）。 */
export function fhvParseDate (records = {}) {
  const raw = records?.[DATE_RECORD]
  if (typeof raw !== 'string') return null
  const [day, period] = raw.split(':')
  const value = Number(day)
  if (!Number.isSafeInteger(value) || value < 1 || value > 3 || !['day', 'night'].includes(period)) return null
  return { day: value, period }
}

export const FHV_SLOT_OF_DATE = Object.freeze({
  '1:day': 'day1', '1:night': 'night1', '2:day': 'day2', '2:night': 'night2', '3:day': 'day3', '3:night': 'night3',
})

/** 记录 → 当前时间槽（`day1`…`night3`；缺失返回 null）。 */
export function fhvSlot (records = {}) {
  const date = fhvParseDate(records)
  return date ? FHV_SLOT_OF_DATE[fhvDateString(date)] || null : null
}

export const slotDate = slot => FHV_SLOT_DATE[slot] || null
export const nextSlot = slot => FHV_SLOTS[FHV_SLOTS.indexOf(slot) + 1] || null

// ---------------------------------------------------------------------------
// 2. 场景单元（身份表；章节正文在各自 definition.js）
// ---------------------------------------------------------------------------
export const FHV_SCENARIO_UNITS = Object.freeze(FHV_SCENARIO_IDS.map(id => {
  const chapter = chapters.find(row => row.id === id)
  return Object.freeze({
    id,
    kind: scenarioKind(id),
    cardCode: chapter?.stepCode || null,
    code: chapter?.referenceCodes?.[0] || chapter?.stepCode || null,
    referenceCodes: Object.freeze([...(chapter?.referenceCodes || [])]),
    name: chapter?.name || id,
    nameEn: NAME_EN[id] || id,
    encounterCode: chapter?.group || null,
    slot: FHV_STEP_SLOT[id] || null,
  })
}))

/** 场景单元（未知 id 返回 null）。 */
export function scenarioUnitOf (id) {
  return FHV_SCENARIO_UNITS.find(unit => unit.id === id) || null
}

// ---------------------------------------------------------------------------
// 3. 勘察区域与「按未勘察区域选择」规则
// ---------------------------------------------------------------------------
// base.json `key.[areasSurveyed]` 的七个区域（= Key.hs `AreasSurveyed`）。前五个是勘察关卡，
// westernWoods / southernFields 是《扭曲空洞》《最长一夜》这两章自带的固定夜探区域。
// 区域记录键的汇总结算在 records.js（`surveyedAreas` / `FHV_AREA_RECORD_KEYS`）。
export const areaOfScenario = scenarioId => FHV_AREA_BY_SCENARIO[scenarioId] || null

/** 区域展示名（`key.[areasSurveyed].<area>.name`；缺译回退英文 id）。 */
export function areaLabel (areaId) {
  const area = FHV_AREAS.find(row => row.id === areaId)
  if (!area) return areaId
  return campaignStoryText(`key.[areasSurveyed].${area.id}.name`) || area.nameEn
}

/** 区域所属勘察关卡（未知返回 null）。 */
export function scenarioOfArea (areaId) {
  return FHV_AREAS.find(area => area.id === areaId)?.scenarioId || null
}

// 各时间槽的勘察选择：`step` = 提供这次选择的序曲/夜晚步骤；`filterSurveyed` = 参考实现里
// 是否用 `unless (k elem areas)` 过滤已勘察区域（欢迎序曲不过滤：五区首次出现，全部可去）。
export const FHV_SURVEY_SLOTS = Object.freeze({
  day1: Object.freeze({ step: 'welcomeToHemlockVale', slot: 'day1', filterSurveyed: false, night: false, promptKey: 'prelude1.label.survey' }),
  night1: Object.freeze({ step: 'preludeTheFirstEvening', slot: 'night1', filterSurveyed: true, night: true, promptKey: 'prelude.theFirstEvening.label.survey' }),
  day2: Object.freeze({ step: 'dawnOfTheSecondDay', slot: 'day2', filterSurveyed: true, night: false, promptKey: 'prelude2.label.survey' }),
  night2: Object.freeze({ step: 'preludeTheSecondEvening', slot: 'night2', filterSurveyed: true, night: true, promptKey: 'prelude.theSecondEvening.label.survey' }),
  day3: Object.freeze({ step: 'dawnOfTheFinalDay', slot: 'day3', filterSurveyed: true, night: false, promptKey: 'prelude3.label.survey' }),
})
export const FHV_SURVEY_SLOT_IDS = Object.freeze(Object.keys(FHV_SURVEY_SLOTS))

/**
 * 某个时间槽的可勘察列表（参考 `getAreasSurveyed` 过滤规则）。
 * 返回 `[{ scenarioId, areaId, surveyed, available, textKey }]`，顺序 = FHV_SURVEY_SCENARIO_IDS。
 */
export function fhvSurveyOptions (slot, records = {}) {
  const spec = FHV_SURVEY_SLOTS[slot]
  if (!spec) return []
  const surveyed = new Set(surveyedAreas(records))
  return FHV_SURVEY_SCENARIO_IDS.map(scenarioId => {
    const area = areaOfScenario(scenarioId)
    const done = surveyed.has(area?.id)
    return {
      scenarioId,
      areaId: area?.id || null,
      surveyed: done,
      available: spec.filterSurveyed ? !done : true,
      textKey: surveyLabelKey(scenarioId),
    }
  })
}

/** 某槽位真正可选的勘察关卡（`available` 项）。 */
export function fhvSurveyCandidates (slot, records = {}) {
  return fhvSurveyOptions(slot, records).filter(option => option.available).map(option => option.scenarioId)
}

/** 勘察选项的标签键（`prelude1.label.writtenInRock` / `prelude.theFirstEvening.label.*` …）。 */
export function surveyLabelKey (scenarioId) {
  const group = {
    day1: 'prelude1',
    night1: 'prelude.theFirstEvening',
    day2: 'prelude2',
    night2: 'prelude.theSecondEvening',
    day3: 'prelude3',
  }
  for (const prefix of Object.values(group)) {
    const key = `${prefix}.label.${scenarioId}`
    if (campaignStoryText(key)) return key
  }
  return `prelude1.label.${scenarioId}`
}

// 夜 1 / 夜 2 / 夜 3 的分支（audit#campaignFlow.nightOptions 逐条镜像）：
//   夜 1：`theTwistedHollow` 或「再查一处未勘察区域」（`gatherMoreInformation`）；
//   夜 2：`theLongestNight` 或同一勘察分支；夜 3 固定 `fateOfTheVale`。
export const FHV_NIGHT_OPTIONS = Object.freeze({
  night1: Object.freeze(['theTwistedHollow', 'survey']),
  night2: Object.freeze(['theLongestNight', 'survey']),
  night3: Object.freeze(['fateOfTheVale']),
})
export const FHV_NIGHT_FIXED = Object.freeze({
  night1: 'theTwistedHollow', night2: 'theLongestNight', night3: 'fateOfTheVale',
})
// 夜探分支的两个选项（参考 `resolutionFlavorWithChooseOne` 的 `searchForBertie` / `gatherMoreInformation`）。
export const FHV_NIGHT_BRANCHES = Object.freeze({
  night1: Object.freeze({
    step: 'preludeTheFirstEvening',
    fixed: Object.freeze({ id: 'searchForBertie', scenarioId: 'theTwistedHollow', labelKey: 'prelude.theFirstEvening.label.searchForBertie' }),
    survey: Object.freeze({ id: 'gatherMoreInformation', labelKey: 'prelude.theFirstEvening.label.gatherMoreInformation' }),
  }),
  night2: Object.freeze({
    step: 'preludeTheSecondEvening',
    fixed: Object.freeze({ id: 'followDrMarquez', scenarioId: 'theLongestNight', labelKey: 'prelude.theSecondEvening.label.followDrMarquez' }),
    survey: Object.freeze({ id: 'gatherMoreInformation', labelKey: 'prelude.theSecondEvening.label.gatherMoreInformation' }),
  }),
})

// 夜探分支的混乱袋变更（参考 PreludeTheFinalEvening/`addChaosToken` 与两段序曲的 survey 分支）。
export const FHV_SURVEY_TOKEN_ADDS = Object.freeze({
  night1: Object.freeze(['tablet', 'elderthing']),
  night2: Object.freeze(['skull', 'cultist', 'elderthing']),
})

// ---------------------------------------------------------------------------
// 4. nextStep 语义（参考 `nextStep` 逐字镜像）
// ---------------------------------------------------------------------------
// 参考实现的 `handleTime`（顺序即 `if/else` 链）：
//   (Day1, Day)   → preludeTheFirstEvening（allowOptions）
//   (Day1, Night) → PreludeDawnOfTheSecondDay
//   (Day2, Day)   → preludeTheSecondEvening（allowOptions）
//   (Day2, Night) → PreludeDawnOfTheFinalDay
//   (Day3, _)     → PreludeTheFinalEvening（allowOptions）
// 其中前三个是「纯叙事夜」（CampaignSpecificStep），后两个是下一段序曲场景。
export const FHV_HANDLE_TIME = Object.freeze({
  day1: 'preludeTheFirstEvening',
  night1: 'dawnOfTheSecondDay',
  day2: 'preludeTheSecondEvening',
  night2: 'dawnOfTheFinalDay',
  day3: 'preludeTheFinalEvening',
  night3: 'preludeTheFinalEvening',
})

/** `handleTime` 的纯函数镜像：给定时间槽/日与时段返回下一段。 */
export function fhvHandleTime (context = {}) {
  const slot = context.slot || (context.records ? fhvSlot(context.records) : null)
  if (slot && FHV_HANDLE_TIME[slot]) return [FHV_HANDLE_TIME[slot]]
  const day = Number(context.day ?? context.records?.day) || 1
  const period = String(context.period ?? context.time ?? context.records?.time ?? 'day').toLowerCase() === 'night'
    ? 'night' : 'day'
  if (day >= 3) return [FHV_HANDLE_TIME.day3]
  return [FHV_HANDLE_TIME[`day${day}${period === 'night' ? 'night' : 'day'}`] || FHV_HANDLE_TIME.day1]
}

// 静态分支（参考 `case (campaignStep …).normalize` 的各 case）。值 = 候选步骤；`'time'` 表示
// 走 `handleTime`；`'survey'` 表示「由序曲自身的勘察选择决定」（`afterPrelude`/`campaignStepEdit_`）。
export const FHV_NEXT_STEP = Object.freeze({
  [FHV_PROLOGUE_STEP]: Object.freeze(['welcomeToHemlockVale']),
  welcomeToHemlockVale: Object.freeze(['time']),
  [FHV_EVENING_STEPS[0]]: Object.freeze(['time']),
  [FHV_EVENING_STEPS[1]]: Object.freeze(['time']),
  theTwistedHollow: Object.freeze(['dawnOfTheSecondDay']),
  theLongestNight: Object.freeze(['dawnOfTheFinalDay']),
  dawnOfTheSecondDay: Object.freeze(['time']),
  dawnOfTheFinalDay: Object.freeze(['time']),
  preludeTheFinalEvening: Object.freeze(['fateOfTheVale']),
  ...Object.fromEntries(FHV_SURVEY_SCENARIO_IDS.map(id => [id, Object.freeze(['time'])])),
  [FHV_ENDGAME_SCENARIO_ID]: Object.freeze([FHV_EPILOGUE_STEP]),
  [FHV_EPILOGUE_STEP]: Object.freeze([]),
})

// 参考实现里由**步骤自身**（而不是 nextStep）指定下一步的位置：
//   · 四段序曲的 EndOfScenario 直接 `afterPrelude`/`campaignStepEdit_` 进勘察关卡；
//   · 两段纯叙事夜的 resolution 用 `setNextCampaignStep TheTwistedHollow`/`TheLongestNight` 或勘察；
//   · 最终夜 R4 `endOfScenarioThen Steps.FateOfTheVale`、R3 可重播或输掉战役。
export const FHV_STEP_OVERRIDES = Object.freeze({
  welcomeToHemlockVale: Object.freeze({ kind: 'survey', slot: 'day1' }),
  preludeTheFirstEvening: Object.freeze({ kind: 'nightBranch', slot: 'night1' }),
  dawnOfTheSecondDay: Object.freeze({ kind: 'survey', slot: 'day2' }),
  preludeTheSecondEvening: Object.freeze({ kind: 'nightBranch', slot: 'night2' }),
  dawnOfTheFinalDay: Object.freeze({ kind: 'survey', slot: 'day3' }),
  preludeTheFinalEvening: Object.freeze({ kind: 'endgame', next: 'fateOfTheVale' }),
})

/**
 * 参考 `nextStep` 的纯函数镜像：给定刚完成的步骤返回下一批候选步骤（空数组 = 战役结束）。
 * `context.slot` / `context.records` 提供当前时间；命不中时间轴时按第 1 日处理（与 `initMeta` 一致）。
 * 序曲/夜晚的「勘察选择」不在本函数返回（它们由节点分支给出，见 `FHV_STEP_OVERRIDES`）。
 */
export function fhvNextStep (stepId, context = {}) {
  const next = FHV_NEXT_STEP[stepId]
  if (!next) return []
  if (next.length === 1 && next[0] === 'time') return fhvHandleTime(context)
  return [...next]
}

/** 步骤是否属于主线 CampaignStep（序幕/四段序曲/两段夜/勘察关/夜章/终章/尾声）。 */
export function isMainlineStep (stepId) {
  return FHV_SCENARIO_IDS.includes(stepId)
    || FHV_EVENING_STEPS.includes(stepId)
    || [FHV_PROLOGUE_STEP, FHV_EPILOGUE_STEP].includes(stepId)
}

/** 该步骤是否开升级窗（参考 `noUpgrade`：从序曲直接进勘察关卡时不提供购牌）。 */
export const FHV_NO_UPGRADE_STEPS = Object.freeze([
  ...FHV_SURVEY_SCENARIO_IDS, ...FHV_NIGHT_SCENARIO_IDS, FHV_ENDGAME_SCENARIO_ID,
])

// 主线步骤顺序（叙事顺序；序幕/尾声与两段纯叙事夜都在里面）。
// `manifest.scenarioIds` 的顺序仍是 CampaignSteps.hs 的顺序（12 个 ScenarioStep），两者用途不同。
export const FHV_STEP_ORDER = Object.freeze([
  FHV_PROLOGUE_STEP,
  'welcomeToHemlockVale',
  FHV_EVENING_STEPS[0],
  ...FHV_SURVEY_SCENARIO_IDS,
  'theTwistedHollow',
  'dawnOfTheSecondDay',
  FHV_EVENING_STEPS[1],
  'theLongestNight',
  'dawnOfTheFinalDay',
  'preludeTheFinalEvening',
  FHV_ENDGAME_SCENARIO_ID,
  FHV_EPILOGUE_STEP,
])

// 保守前驱（`manifest.unlock`；真正可去由 `surveyRouter`/`nextStep` 决定）。
// 约束（`content/schema.js#assertCampaignManifest`）：前置必须出现在 scenarioIds 更早的位置。
export const FHV_UNLOCK_STEPS = Object.freeze({
  welcomeToHemlockVale: Object.freeze([]),
  // 五个勘察关卡：任何时候都可以从序曲的勘察选择进入（只要求已完成欢迎序曲）。
  ...Object.fromEntries(FHV_SURVEY_SCENARIO_IDS.map(id => [id, Object.freeze(['welcomeToHemlockVale'])])),
  theTwistedHollow: Object.freeze(['welcomeToHemlockVale']),
  dawnOfTheSecondDay: Object.freeze(['welcomeToHemlockVale']),
  theLongestNight: Object.freeze(['dawnOfTheSecondDay']),
  dawnOfTheFinalDay: Object.freeze(['dawnOfTheSecondDay']),
  preludeTheFinalEvening: Object.freeze(['dawnOfTheFinalDay']),
  fateOfTheVale: Object.freeze(['preludeTheFinalEvening']),
})

// ---------------------------------------------------------------------------
// 5. 正文键解析（textKey → 展示文本）
// ---------------------------------------------------------------------------
// 口径：流程节点只存 `textKey`/`textKeys`/`labelKey`；正文一律来自 story-text 的
// `FHV_STORY_TEXT.chapters[<章>].sectionsEn|sections`（story-access.js 的 leaf 视图，键为
// 「相对指南文件根的路径」，例如 `prelude1.intro.intro1`、`prelude.theFirstEvening.body`）。
// 缺键/缺译：返回空串（流程层保留空正文，不写死中文；生成本地翻译后自动出现）。
function plainText (value) {
  return String(value ?? '')
    .replace(/<section\b[^>]*class=['"]encounter-sets['"][^>]*>[\s\S]*?<\/section>/gi, '')
    .replace(/<(?:br|hr)\s*\/?\s*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/(?:p|div|li|ul|ol|h[1-6])>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 战役正文：`prelude1.intro.intro1` / `prelude.theFirstEvening.body` / `key.motherRachelShowedTheWay`。 */
export function campaignStoryText (key, chapterId = FHV_STORY_CHAPTER) {
  const text = chapterText(chapterId, key, 'zh') || chapterText(chapterId, key, 'en')
  return plainText(text)
}

/** 战役小标题（`prelude1.intro.title`；缺键回退空串，调用方给兜底标题）。 */
export function campaignStoryHeading (key, chapterId = FHV_STORY_CHAPTER) {
  return campaignStoryText(key, chapterId) || campaignStoryText(`${key}.title`, chapterId)
}

/** 选项标签（与正文同源；缺键回退空串，flow 用步骤 id 兜底）。 */
export function campaignStoryLabel (key, chapterId = FHV_STORY_CHAPTER) {
  return campaignStoryText(key, chapterId)
}

/** 按前缀取整段正文（`prelude4.intro` 的全部段落，按生成顺序拼接）。 */
export function campaignStorySection (prefix, chapterId = FHV_STORY_CHAPTER) {
  const keys = chapterLeafKeys(chapterId).filter(key => key === prefix || key.startsWith(`${prefix}.`))
  return keys.map(key => campaignStoryText(key, chapterId)).filter(Boolean).join('\n\n')
}

/** 某章的正文键清单（story-text 生成物；缺章返回空数组）。 */
export function chapterLeafKeys (chapterId = FHV_STORY_CHAPTER) {
  return Object.keys(chapterStory(chapterId).sectionsEn || {})
}

/** 记录复选框标签（`key.<recordKey>`；见 records.js#FHV_RECORD_LABELS）。 */
export function campaignRecordLabel (recordKey) {
  return campaignStoryText(`key.${recordKey}`)
}

/** 序曲/夜晚步骤的展示标题（`headings.preludeTheFirstEvening` 等）。 */
export function eveningHeading (stepId) {
  return campaignStoryHeading(`headings.${stepId}`)
    || campaignStoryHeading({ preludeTheFirstEvening: 'prelude.theFirstEvening', preludeTheSecondEvening: 'prelude.theSecondEvening' }[stepId] || '')
}

/** 纯展示辅助：把任意 story 子树摊平成字符串（流程层只在标题兜底时用）。 */
export const flattenStoryText = value => plainText(flattenStory(value))
