// 《铁杉谷盛宴》（The Feast of Hemlock Vale）· 战役流程图组装与 manifest 片段（P7）。
//
// 输入（均已按参考实现锁定，见各文件头）：
//   parts.js（12 步身份、三天三夜时间轴、勘察/夜探规则、nextStep 语义、正文键解析）、
//   prologue.js（战役准备 + 开局初始化）、interludes.js（4 段序曲整备、2 段纯叙事夜、夜探分支、
//   白日整备/线索保留/跳过勘察的调度重抽）、epilogue.js（多结局收口）、records.js（记录键表）。
// 输出：
//   · `FHV_FLOW`：可序列化的 `{ start, nodes }`，直接合入 `manifest.flow`；
//   · `campaignFlowExtras`：供主进程合并进 `manifest.js` 的片段（flow/记录/升级窗/勘察语义/混乱袋迁移）；
//   · `validateFhvFlow(flow, opts)`：构建期自检（`validateCampaignGraph` 的注册期口径）。
//
// 流程形状（参考 TheFeastOfHemlockVale.hs#nextStep / 四段序曲的 EndOfScenario 逐条镜像）：
//
//   prologue（战役准备）→ prologueRules（附加规则）→ welcomeToHemlockVale（第 1 日序曲）
//     → welcomePrep（整备/升级窗）→ surveyChoiceDay1（勘察选择，五区全开）
//        → 勘察关卡 → surveyRouter（按 hemlockDate 路由）
//   surveyRouter（stepReturn，镜像 handleTime）：
//     1:day → preludeTheFirstEvening     1:night → dawnOfTheSecondDay
//     2:day → preludeTheSecondEvening    2:night → dawnOfTheFinalDay
//     3:day / 3:night → preludeTheFinalEvening
//   preludeTheFirstEvening（纯叙事夜：把时钟拨到 1:night）
//     → firstEveningCodex（法典选择）→ firstEveningMeal（用餐选择）→ firstEveningChoice
//        ├ searchForBertie → theTwistedHollow → dawnOfTheSecondDay
//        └ gatherMoreInformation → surveyChoiceNight1 → 勘察关卡 → surveyRouter
//   dawnOfTheSecondDay → dawn2Prep → surveyChoiceDay2 → … → preludeTheSecondEvening（2:night）
//     ├ followDrMarquez → theLongestNight → dawnOfTheFinalDay
//     └ gatherMoreInformation → surveyChoiceNight2 → … → dawnOfTheFinalDay
//   dawnOfTheFinalDay → dawnFinalPrep → surveyChoiceDay3 → … → preludeTheFinalEvening（3:night）
//     → finalEveningPrep → fateOfTheVale → epilogue → end
//
// 升级窗：引擎只在 `interlude` 节点开窗（`src/engine/campaign-flow.js#progressCampaign`），因此四个
// `*Prep` 节点是唯一的购牌窗口；从序曲直接进入的勘察/夜章/终章都是 `noUpgrade`（参考
// `campaignStepEdit_ <Step> noUpgrade`）。
import { validateCampaignGraph } from '../../../src/campaign/campaign-flow.js'
import {
  FHV_RECORD_DEFAULTS, FHV_RECORD_LABELS, FHV_RECORD_SCHEMA, FHV_RECORD_TYPES, recordDefaults,
} from './records.js'
import {
  DATE_RECORD, DAY_RECORD, FHV_CAMPAIGN_ID, FHV_END_STEP, FHV_ENDGAME_SCENARIO_ID, FHV_EPILOGUE_STEP,
  FHV_EVENING_STEPS, FHV_HANDLE_TIME, FHV_NIGHT_BRANCHES, FHV_NIGHT_OPTIONS, FHV_NO_UPGRADE_STEPS,
  FHV_PRELUDE_SCENARIO_IDS, FHV_PROLOGUE_RULES_STEP, FHV_PROLOGUE_STEP, FHV_SCENARIO_IDS, FHV_SCENARIO_UNITS,
  FHV_SLOTS, FHV_SLOT_DATE, FHV_STEP_OVERRIDES, FHV_STEP_SLOT, FHV_STEP_ORDER, FHV_SURVEY_SCENARIO_IDS,
  FHV_SURVEY_SLOTS, FHV_SURVEY_TOKEN_ADDS, FHV_UNLOCK_STEPS, TIME_RECORD, areaOfScenario, areaRecordKeys,
  campaignStoryHeading, campaignStoryLabel, campaignStoryText, fhvNextStep, fhvSlot, fhvSurveyCandidates,
  scenarioUnitOf, surveyLabelKey,
} from './parts.js'
import { PROLOGUE_HANDLER_ID, PROLOGUE_NODES } from './prologue.js'
import { INTERLUDE_HANDLER_ID, interludeNodes } from './interludes.js'
import { EPILOGUE_NODES } from './epilogue.js'

export const FHV_FLOW_HANDLER_ID = INTERLUDE_HANDLER_ID

// ---------------------------------------------------------------------------
// 1. 记录 schema 投影（引擎口径）
// ---------------------------------------------------------------------------
// 记录键的权威表在 records.js（内容层 `FHV_RECORD_SCHEMA` 允许 `record-map`）。引擎只接受四种类型，
// 因此这里用 `FHV_RECORD_TYPES` 投影（`record-map` → `string`，理由见 records.js 的近似说明）。
export const FHV_FLOW_RECORD_SCHEMA = FHV_RECORD_TYPES
export const FHV_FLOW_RECORD_DEFAULTS = FHV_RECORD_DEFAULTS
export const FHV_FLOW_RECORD_LABELS = FHV_RECORD_LABELS

// ---------------------------------------------------------------------------
// 2. 节点组装
// ---------------------------------------------------------------------------
const registered = (handler, event, payload) => ({
  type: 'registered', handler, event, ...(payload ? { payload } : {}),
})
const recordEffect = (key, value) => ({ type: 'record', key, value })
const chaosEffect = token => ({ type: 'chaos', token, amount: 1 })

const clone = value => (typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value)))

const storyText = (keys, chapter) => keys.map(key => campaignStoryText(key, chapter)).filter(Boolean).join('\n\n')

// 2a. 战役准备（序幕）：参考 `CampaignStep PrologueStep` 的 scope 顺序。
export const SPECIAL_RULE_KEYS = Object.freeze(
  Array.from({ length: 8 }, (_, index) => [`specialRules[${index}].title`, `specialRules[${index}].body`]).flat())
export const PROLOGUE_TEXT_KEYS = Object.freeze(['prologue.body', ...SPECIAL_RULE_KEYS, 'newKeywords.body'])
export const PROLOGUE_RULE_KEYS = Object.freeze([
  'additionalRulesAndClarifications.title',
  'additionalRulesAndClarifications.theCodex',
  'additionalRulesAndClarifications.threeDaysThreeNights',
  'additionalRulesAndClarifications.residentsAndRelationshipLevels',
  'additionalRulesAndClarifications.locationAdjacency',
  'prelude1.playingPreludes.title',
  'prelude1.playingPreludes.body',
])

// 2b. 四段序曲的整备节点（唯一的购牌/升级窗口）。
export const PREP_STEPS = Object.freeze([
  Object.freeze({ nodeId: 'welcomePrep', slot: 'day1', step: 'welcomeToHemlockVale',
    textKeys: Object.freeze(['prelude1.playingPreludes.body', 'prelude1.xp.theBrilliance']) }),
  Object.freeze({ nodeId: 'dawn2Prep', slot: 'day2', step: 'dawnOfTheSecondDay',
    textKeys: Object.freeze(['prelude1.playingPreludes.body', 'prelude2.xp.bonus']) }),
  Object.freeze({ nodeId: 'dawnFinalPrep', slot: 'day3', step: 'dawnOfTheFinalDay',
    textKeys: Object.freeze(['prelude1.playingPreludes.body', 'prelude3.xp.survivor']) }),
  Object.freeze({ nodeId: 'finalEveningPrep', slot: 'night3', step: 'preludeTheFinalEvening',
    textKeys: Object.freeze(['prelude1.playingPreludes.body']) }),
])

function prepNodes () {
  const nodes = {}
  for (const spec of PREP_STEPS) {
    const next = spec.nodeId === 'finalEveningPrep'
      ? FHV_ENDGAME_SCENARIO_ID
      : `surveyChoice${{ day1: 'Day1', day2: 'Day2', day3: 'Day3' }[spec.slot]}`
    nodes[spec.nodeId] = {
      type: 'interlude',
      upgrades: true,
      titleKey: 'label.chooseAssetToKeepForNextSurvey',
      textKeys: [...spec.textKeys],
      // 序曲整备：保留 1 张非起始支援、弃到开手牌数、资源回落到起始值（引擎
      // `src/engine/survey-preparation.js#prepareSurvey` 已在关卡结算时完成），这里只做
      // 战役层记账（未花费经验快照 / 传家宝 / 时钟）。见 interludes.js#runInterludeEffect。
      effects: [registered(INTERLUDE_HANDLER_ID, 'prepare', { slot: spec.slot, step: spec.step })],
      next,
    }
  }
  return nodes
}

// 2c. 勘察选择（`choice`）：五个勘察关卡 + 「跳过本次勘察」的调度重抽。
// 「按未勘察区域选择」规则：未勘察的区域才出现在选项里（欢迎序曲例外：五区全开）。
const RESCHEDULE_TARGET = Object.freeze({
  day1: Object.freeze({ next: 'preludeTheFirstEvening', slot: 'night1' }),
  night1: Object.freeze({ next: 'dawnOfTheSecondDay', slot: 'day2' }),
  day2: Object.freeze({ next: 'preludeTheSecondEvening', slot: 'night2' }),
  night2: Object.freeze({ next: 'dawnOfTheFinalDay', slot: 'day3' }),
  day3: Object.freeze({ next: 'preludeTheFinalEvening', slot: 'night3' }),
})

/** 「该区域尚未勘察」的条件（`hasRecord` 读布尔键；集合用 `record/includes`）。 */
function unsurveyedCondition (areaId) {
  const clauses = areaRecordKeys(areaId).map(key => ({ not: { hasRecord: { key } } }))
  clauses.push({ not: { record: 'areasSurveyed', includes: areaId } })
  return { all: clauses }
}

function surveyChoiceNode (slot) {
  const spec = FHV_SURVEY_SLOTS[slot]
  const options = FHV_SURVEY_SCENARIO_IDS.map(scenarioId => {
    const area = areaOfScenario(scenarioId)
    return {
      id: scenarioId,
      labelKey: surveyLabelKey(scenarioId),
      ...(spec.filterSurveyed ? { when: unsurveyedCondition(area.id) } : {}),
      effects: [
        registered(INTERLUDE_HANDLER_ID, 'surveyChosen', { scenarioId, slot, areaId: area.id }),
      ],
      next: scenarioId,
    }
  })
  // 参考实现里没有「跳过勘察」；本循环每个时间槽只够打一关，战役层提供显式的调度重抽：
  // 跳过本次勘察 → 时钟推进到下一段（见 `RESCHEDULE_TARGET`），并在记录里留下选择。
  // 这是内容层近似（`simplified`），登记在 flow.js 头部与 P7 报告的 notes 里。
  const reschedule = RESCHEDULE_TARGET[slot]
  options.push({
    id: 'reschedule',
    label: '跳过本次勘察',
    effects: [
      recordEffect(DATE_RECORD, `${FHV_SLOT_DATE[reschedule.slot].day}:${FHV_SLOT_DATE[reschedule.slot].period}`),
      recordEffect(DAY_RECORD, FHV_SLOT_DATE[reschedule.slot].day),
      recordEffect(TIME_RECORD, FHV_SLOT_DATE[reschedule.slot].period),
      registered(INTERLUDE_HANDLER_ID, 'reschedule', { slot, nextSlot: reschedule.slot }),
    ],
    next: reschedule.next,
  })
  return {
    type: 'choice',
    titleKey: spec.promptKey,
    textKeys: [spec.promptKey],
    options,
  }
}

function surveyChoiceNodes () {
  return Object.fromEntries(Object.keys(FHV_SURVEY_SLOTS).map(slot => [
    `surveyChoice${slot[0].toUpperCase()}${slot.slice(1)}`, surveyChoiceNode(slot),
  ]))
}

// 2d. 勘察关卡（scenario）：打完回到 `surveyRouter`，由 `hemlockDate` 决定下一段。
function surveyScenarioNodes () {
  const nodes = {}
  for (const scenarioId of FHV_SURVEY_SCENARIO_IDS) {
    const unit = scenarioUnitOf(scenarioId)
    nodes[scenarioId] = {
      type: 'scenario',
      scenarioId,
      title: unit.name,
      nameEn: unit.nameEn,
      cardCode: unit.cardCode,
      kind: 'survey',
      areaId: areaOfScenario(scenarioId)?.id || null,
      // 从序曲直接进入 → 不开升级窗（参考 `campaignStepEdit_ … noUpgrade`）。
      noUpgrade: true,
      next: 'surveyRouter',
    }
  }
  return nodes
}

// 2e. 夜章（`theTwistedHollow` / `theLongestNight`）：固定出口由参考 nextStep 给出。
// 《最长一夜》结算后先过 `fatigue`（参考 `Helpers.hs#replaceFatigueChaosTokens` 的演出位置），
// 再到《最终日黎明》。
function nightScenarioNodes () {
  const nodes = {}
  for (const [scenarioId, next] of [['theTwistedHollow', 'dawnOfTheSecondDay'], ['theLongestNight', 'fatigue']]) {
    const unit = scenarioUnitOf(scenarioId)
    nodes[scenarioId] = {
      type: 'scenario',
      scenarioId,
      title: unit.name,
      nameEn: unit.nameEn,
      cardCode: unit.cardCode,
      kind: 'night',
      areaId: areaOfScenario(scenarioId)?.id || null,
      noUpgrade: true,
      next,
    }
  }
  return nodes
}

// 2f. 纯叙事夜（`preludeTheFirstEvening` / `preludeTheSecondEvening`）：参考实现的
// `CampaignSpecificStep`，入场即把时钟拨到夜间（`meta.time = Night`），随后两次选择：
// 法典（每位调查员一次）与「夜探 / 再查一处」。
const EVENING_SPECS = Object.freeze({
  preludeTheFirstEvening: Object.freeze({
    slot: 'night1',
    codexNode: 'firstEveningCodex',
    choiceNode: 'firstEveningChoice',
    mealNode: 'firstEveningMeal',
    scope: 'prelude.theFirstEvening',
    codexTitleKey: 'prelude.theFirstEvening.codexChoice',
    codexOptions: Object.freeze([
      Object.freeze({ id: 'theta', labelKey: 'prelude.theFirstEvening.label.theta' }),
      Object.freeze({ id: 'delta', labelKey: 'prelude.theFirstEvening.label.delta' }),
      Object.freeze({ id: 'sigma', labelKey: 'prelude.theFirstEvening.label.sigma' }),
      Object.freeze({ id: 'omega', labelKey: 'prelude.theFirstEvening.label.omega' }),
      Object.freeze({ id: 'gamma', labelKey: 'prelude.theFirstEvening.label.gamma' }),
      Object.freeze({ id: 'pi', labelKey: 'prelude.theFirstEvening.label.pi' }),
    ]),
  }),
  preludeTheSecondEvening: Object.freeze({
    slot: 'night2',
    codexNode: 'secondEveningCodex',
    choiceNode: 'secondEveningChoice',
    mealNode: null,
    scope: 'prelude.theSecondEvening',
    codexTitleKey: 'prelude.theSecondEvening.codexChoice',
    codexOptions: Object.freeze([
      Object.freeze({ id: 'motherRachel', labelKey: 'prelude.theSecondEvening.label.motherRachel' }),
      Object.freeze({ id: 'leah', labelKey: 'prelude.theSecondEvening.label.leah' }),
      Object.freeze({ id: 'simeon', labelKey: 'prelude.theSecondEvening.label.simeon' }),
      Object.freeze({ id: 'william', labelKey: 'prelude.theSecondEvening.label.william' }),
      Object.freeze({ id: 'river', labelKey: 'prelude.theSecondEvening.label.river' }),
      Object.freeze({ id: 'gideon', labelKey: 'prelude.theSecondEvening.label.gideon' }),
      Object.freeze({ id: 'judith', labelKey: 'prelude.theSecondEvening.label.judith' }),
      Object.freeze({ id: 'theo', labelKey: 'prelude.theSecondEvening.label.theo' }),
      Object.freeze({ id: 'alone', labelKey: 'prelude.theSecondEvening.label.alone' }),
      Object.freeze({ id: 'omega', labelKey: 'prelude.theSecondEvening.label.omega' }),
      Object.freeze({ id: 'theta', labelKey: 'prelude.theSecondEvening.label.theta' }),
    ]),
  }),
})

function eveningNodes () {
  const nodes = {}
  for (const stepId of FHV_EVENING_STEPS) {
    const spec = EVENING_SPECS[stepId]
    const date = FHV_SLOT_DATE[spec.slot]
    // 法典：参考实现按调查员逐个询问（`investigatorStoryWithChooseOneM'`），战役图只能问领队；
    // 这里给一张「可读条目」清单（每个选项 +1 关系 / +1 经验），并在处理器里记账。
    const codexOptions = spec.codexOptions.map(option => ({
      id: option.id,
      labelKey: option.labelKey,
      effects: [registered(INTERLUDE_HANDLER_ID, 'codex', {
        step: stepId, entry: option.id, slot: spec.slot,
      })],
      next: spec.mealNode || spec.choiceNode,
    }))
    nodes[spec.codexNode] = {
      type: 'choice',
      titleKey: spec.codexTitleKey,
      textKeys: [spec.codexTitleKey],
      options: [...codexOptions, {
        // 参考实现的 `unscoped skip_`：不做任何法典选择直接继续（UI 标签，非剧情正文）。
        id: 'skipCodex', label: '跳过', next: spec.mealNode || spec.choiceNode,
      }],
    }
    nodes[stepId] = {
      type: 'story',
      titleKey: `headings.${stepId}`,
      textKey: `${spec.scope}.title`,
      textKeys: [`${spec.scope}.body`],
      effects: [registered(INTERLUDE_HANDLER_ID, 'evening', { step: stepId, slot: spec.slot })],
      next: spec.codexNode,
    }
    if (spec.mealNode) {
      nodes[spec.mealNode] = {
        type: 'choice',
        titleKey: `${spec.scope}.mealChoice`,
        textKeys: [`${spec.scope}.mealChoice`],
        options: [
          { id: 'keepEating', labelKey: 'prelude.theFirstEvening.label.keepEating',
            effects: [recordEffect('finishedTheirMeal', true)], next: spec.choiceNode },
          { id: 'dontEatAnymore', labelKey: 'prelude.theFirstEvening.label.dontEatAnymore', next: spec.choiceNode },
        ],
      }
    }
    const branch = FHV_NIGHT_BRANCHES[spec.slot]
    const surveySlot = spec.slot
    // 第二夜的六段结局文本按阅读顺序排（resolution1…5 是当晚的插曲，resolution6 是选择本身）。
    const choiceTextKeys = spec.slot === 'night2'
      ? [1, 2, 3, 4, 5].map(index => `${spec.scope}.resolution${index}.body`).concat(`${spec.scope}.resolution6.body`)
      : [`${spec.scope}.resolution1.body`]
    nodes[spec.choiceNode] = {
      type: 'choice',
      titleKey: `${spec.scope}.resolution1.title`,
      textKeys: choiceTextKeys,
      options: [
        {
          id: branch.fixed.id,
          labelKey: branch.fixed.labelKey,
          effects: [registered(INTERLUDE_HANDLER_ID, 'nightBranch', {
            slot: surveySlot, branch: branch.fixed.id, scenarioId: branch.fixed.scenarioId,
          })],
          next: branch.fixed.scenarioId,
        },
        {
          id: branch.survey.id,
          labelKey: branch.survey.labelKey,
          // 参考实现的选择分支会给战役混乱袋加标记（夜 1：tablet+elderThing；夜 2：skull+cultist+elderThing）。
          effects: [
            ...FHV_SURVEY_TOKEN_ADDS[surveySlot].map(chaosEffect),
            registered(INTERLUDE_HANDLER_ID, 'nightBranch', { slot: surveySlot, branch: branch.survey.id }),
          ],
          next: `surveyChoice${surveySlot[0].toUpperCase()}${surveySlot.slice(1)}`,
        },
      ],
    }
  }
  return nodes
}

// 2f-2. 最终夜之后的失败分支（参考源：`PreludeTheFinalEvening.hs#ScenarioResolution Resolution 3`：
// 「重播最终夜」或「输掉战役」；章节行为把结果写进 `preludeTheFinalEveningNextStep`（'lost' / 'replay' /
// 下一章 id）与 `preludeTheFinalEveningLost`）。
export const FINAL_EVENING_OUTCOME_ID = 'finalEveningOutcome'
export const FINAL_EVENING_OUTCOME_RULES = Object.freeze([
  Object.freeze({
    id: 'campaignLost',
    when: Object.freeze({ record: 'preludeTheFinalEveningNextStep', equals: 'lost' }),
    next: FHV_EPILOGUE_STEP,
  }),
  Object.freeze({
    id: 'campaignLostFlag',
    when: Object.freeze({ record: 'preludeTheFinalEveningLost', equals: true }),
    next: FHV_EPILOGUE_STEP,
  }),
])

function finalEveningOutcomeNode () {
  return {
    type: 'stepReturn',
    titleKey: 'prelude4.resolutions.resolution3.title',
    textKeys: ['prelude4.resolutions.resolution3.body'],
    rules: FINAL_EVENING_OUTCOME_RULES.map(rule => ({
      ...rule,
      effects: [registered(INTERLUDE_HANDLER_ID, 'advanceTime', { slot: 'night3', next: rule.next })],
    })),
    // 正常路线：最终夜整备 → 终章。重播（`replay`）由章节的 restartScenario 原语处理，不在这里打环。
    next: 'finalEveningPrep',
  }
}

// 2g. 路由（`stepReturn`）：镜像 `nextStep` 的 `handleTime`，读 hemlockDate（`day:period`）。
export const SURVEY_ROUTER_ID = 'surveyRouter'
export const SURVEY_ROUTER_RULES = Object.freeze(FHV_SLOTS.map(slot => Object.freeze({
  id: slot,
  when: Object.freeze({ record: DATE_RECORD, equals: `${FHV_SLOT_DATE[slot].day}:${FHV_SLOT_DATE[slot].period}` }),
  next: FHV_HANDLE_TIME[slot],
})))

function surveyRouterNode () {
  return {
    type: 'stepReturn',
    titleKey: 'label.survey',
    textKeys: ['prelude1.playingPreludes.body'],
    rules: SURVEY_ROUTER_RULES.map(rule => ({
      ...rule,
      effects: [registered(INTERLUDE_HANDLER_ID, 'advanceTime', { slot: rule.id, next: rule.next })],
    })),
    // 缺日期记录（旧存档 / 手工夹具）时按「第 1 日结束」推进：宁可前进一步也不要在图里打环。
    next: 'preludeTheFirstEvening',
  }
}

// 2h. 其余场景节点（四段序曲 + 终章）。
function namedScenarioNode (scenarioId, next, extra = {}) {
  const unit = scenarioUnitOf(scenarioId)
  return {
    type: 'scenario',
    scenarioId,
    title: unit.name,
    nameEn: unit.nameEn,
    cardCode: unit.cardCode,
    kind: unit.kind,
    next,
    ...extra,
  }
}

function preludeScenarioNodes () {
  return {
    welcomeToHemlockVale: namedScenarioNode('welcomeToHemlockVale', 'welcomePrep', { noUpgrade: true }),
    dawnOfTheSecondDay: namedScenarioNode('dawnOfTheSecondDay', 'dawn2Prep', { noUpgrade: true }),
    dawnOfTheFinalDay: namedScenarioNode('dawnOfTheFinalDay', 'dawnFinalPrep', { noUpgrade: true }),
    preludeTheFinalEvening: namedScenarioNode('preludeTheFinalEvening', FINAL_EVENING_OUTCOME_ID, { noUpgrade: true }),
    [FHV_ENDGAME_SCENARIO_ID]: namedScenarioNode(FHV_ENDGAME_SCENARIO_ID, FHV_EPILOGUE_STEP, { noUpgrade: true }),
  }
}

/** 未经本地化的原始节点表。 */
export function rawFhvFlowNodes () {
  return {
    ...clone(PROLOGUE_NODES),
    ...preludeScenarioNodes(),
    ...surveyScenarioNodes(),
    ...nightScenarioNodes(),
    ...surveyChoiceNodes(),
    [SURVEY_ROUTER_ID]: surveyRouterNode(),
    [FINAL_EVENING_OUTCOME_ID]: finalEveningOutcomeNode(),
    ...eveningNodes(),
    ...prepNodes(),
    ...clone(interludeNodes()),
    ...clone(EPILOGUE_NODES),
  }
}

/** 正文绑定：节点 `textKey`/`textKeys` → story-text 展示文本；`titleKey` → 小标题；选项 `labelKey` → 标签。 */
function localizeFhvNodes (nodes) {
  for (const node of Object.values(nodes)) {
    if (!node || typeof node !== 'object') continue
    const textKeys = [node.textKey, ...(node.textKeys || [])].filter(Boolean)
    if (textKeys.length) {
      const text = storyText(textKeys)
      if (text) node.text = text
    }
    if (node.titleKey) {
      const title = campaignStoryLabel(node.titleKey) || campaignStoryHeading(node.titleKey)
      if (title) node.title = title
    }
    for (const option of node.options || []) {
      if (!option?.labelKey) continue
      const label = campaignStoryLabel(option.labelKey)
      if (label) option.label = label
      else if (!option.label) option.label = option.id
    }
  }
  return nodes
}

/** P7 交付的完整 flow：`{ start: 'prologue', nodes }`，可序列化纯数据。 */
export const FHV_FLOW = Object.freeze({ start: FHV_PROLOGUE_STEP, nodes: localizeFhvNodes(rawFhvFlowNodes()) })

/** 流程图节点清单（构建顺序；供账本/测试断言节点集合稳定）。 */
export const FHV_FLOW_NODE_ORDER = Object.freeze(Object.keys(FHV_FLOW.nodes))

// ---------------------------------------------------------------------------
// 3. manifest 片段
// ---------------------------------------------------------------------------
// 升级窗（参考 `noUpgrade`/`allowOptions` 的语义差）：
//   · 四个序曲整备节点（interlude + upgrades:true）是唯一开窗处；
//   · 从序曲直接进入的勘察/夜章/终章标 `noUpgrade: true`（不进购牌窗）；
//   · 引擎判据只有 `node.type === 'interlude' && node.upgrades !== false`，故这张表同时给出
//     `upgradeWindows`（类型布尔）与 `noUpgradeWindows`（逐步骤清单）供大厅/审计读取。
export const FHV_UPGRADE_WINDOWS = Object.freeze({
  nodes: Object.freeze(PREP_STEPS.map(spec => Object.freeze({ nodeId: spec.nodeId, slot: spec.slot, step: spec.step }))),
  interlude: true,
  checkpoint: false,
  scenario: false,
  map: false,
})
export const FHV_NO_UPGRADE_WINDOWS = Object.freeze(FHV_NO_UPGRADE_STEPS.map(stepId => Object.freeze({
  stepId, reason: '进入时不开购牌窗（参考 campaignStepEdit_ <Step> noUpgrade）',
})))

// 混乱袋迁移（参考 TokenHelpers.hs / 各序曲的 `addChaosToken`）。
//   · 流程节点里的 `{type:'chaos', token, amount}` 效果 → `changeChaosBag(..., { permanent: true })`；
//   · 结局后的 `chaosBagTransitions` 由引擎读点 `src/engine/campaign-flow.js#finishScenario` 按
//     `when: '<scenarioId>/<resolutionKey>'` 读取 `adds` 永久入袋（标记名与引擎同源小写：
//     `autofail` / `eldersign`）。
export const FHV_CHAOS_BAG_TRANSITIONS = Object.freeze([
  Object.freeze({ id: 'welcomeResolution', when: 'welcomeToHemlockVale/resolution1', adds: Object.freeze(['autofail']),
    source: 'PreludeWelcomeToHemlockVale.hs#ScenarioResolution Resolution 1' }),
  Object.freeze({ id: 'night1Survey', when: 'preludeTheFirstEvening/gatherMoreInformation',
    adds: Object.freeze([...FHV_SURVEY_TOKEN_ADDS.night1]), source: 'TheFeastOfHemlockVale.hs#DoStep 1 preludeTheFirstEvening' }),
  Object.freeze({ id: 'night2Survey', when: 'preludeTheSecondEvening/gatherMoreInformation',
    adds: Object.freeze([...FHV_SURVEY_TOKEN_ADDS.night2]), source: 'TheFeastOfHemlockVale.hs#DoStep 1 preludeTheSecondEvening' }),
  Object.freeze({ id: 'finalEveningBelieved', when: 'preludeTheFinalEvening/intro3',
    adds: Object.freeze(['cultist']), source: 'PreludeTheFinalEvening.hs#intro3' }),
  Object.freeze({ id: 'finalEveningLied', when: 'preludeTheFinalEvening/intro4',
    adds: Object.freeze(['cultist', 'elderthing']), source: 'PreludeTheFinalEvening.hs#intro4' }),
  Object.freeze({ id: 'finalEveningInterrupted', when: 'preludeTheFinalEvening/intro5',
    adds: Object.freeze(['tablet', 'elderthing']), source: 'PreludeTheFinalEvening.hs#intro5' }),
  Object.freeze({ id: 'fatigueAfterLongestNight', when: 'theLongestNight/after',
    adds: Object.freeze([]), replaces: 2, lowerBy: 1,
    source: 'Helpers.hs#replaceFatigueChaosTokens（抽 2 枚非符号标记，换成低 1 档的标记）' }),
])

export const campaignFlowExtras = Object.freeze({
  // 引擎读点：`campaignGraph(manifest)` 直接返回 manifest.flow。
  flow: FHV_FLOW,
  // 记录 schema（引擎口径的类型映射）、默认值、中文/印刷标签。
  recordSchema: FHV_RECORD_TYPES,
  recordDefaults: FHV_RECORD_DEFAULTS,
  recordLabels: FHV_RECORD_LABELS,
  // 内容层富 schema（含 `record-map`；仅供大厅/审计读取，引擎不读）。
  recordFields: FHV_RECORD_SCHEMA,
  // 引擎读点：`interludeFlow: 'continuous'` → 序曲整备结束后一次读完整个幕间子图。
  interludeFlow: 'continuous',
  upgradeWindows: Object.freeze({ interlude: true, checkpoint: false, scenario: false, map: false }),
  upgradeWindowNodes: FHV_UPGRADE_WINDOWS.nodes,
  noUpgradeWindows: FHV_NO_UPGRADE_WINDOWS,
  // 顺序：12 个 ScenarioStep（CampaignSteps.hs 顺序）、主线步骤顺序与流程图节点顺序。
  scenarioOrder: FHV_SCENARIO_IDS,
  mainlineScenarioOrder: FHV_SCENARIO_IDS,
  skippableScenarioIds: Object.freeze([]),
  preludeScenarioIds: FHV_PRELUDE_SCENARIO_IDS,
  eveningSteps: FHV_EVENING_STEPS,
  scenarioUnits: FHV_SCENARIO_UNITS,
  nodeOrder: FHV_STEP_ORDER,
  flowNodeOrder: FHV_FLOW_NODE_ORDER,
  // 保守前驱（引擎 schema 只做闭包校验；真正可去由路由决定）。
  unlock: FHV_UNLOCK_STEPS,
  // 三天三夜：时间槽、日期记录、`nextStep`/`handleTime` 的纯函数读点。
  slots: FHV_SLOTS,
  slotDates: FHV_SLOT_DATE,
  stepSlots: FHV_STEP_SLOT,
  dateRecord: DATE_RECORD,
  handleTime: FHV_HANDLE_TIME,
  stepOverrides: FHV_STEP_OVERRIDES,
  surveyRouterNodeId: SURVEY_ROUTER_ID,
  surveyRouterRules: SURVEY_ROUTER_RULES,
  finalEveningOutcomeNodeId: FINAL_EVENING_OUTCOME_ID,
  finalEveningOutcomeRules: FINAL_EVENING_OUTCOME_RULES,
  // 勘察语义（五个关卡 + 七区 + 各槽位过滤规则 + 区域记录键）。
  surveyScenarios: FHV_SURVEY_SCENARIO_IDS,
  surveySlots: FHV_SURVEY_SLOTS,
  surveyTokenAdds: FHV_SURVEY_TOKEN_ADDS,
  nightOptions: FHV_NIGHT_OPTIONS,
  nightBranches: FHV_NIGHT_BRANCHES,
  endgameScenarioId: FHV_ENDGAME_SCENARIO_ID,
  epilogueStep: FHV_EPILOGUE_STEP,
  // 混乱袋迁移与不消耗经验窗口。
  chaosBagTransitions: FHV_CHAOS_BAG_TRANSITIONS,
  xpWindows: Object.freeze([
    Object.freeze({ id: 'preludeCodex', when: 'preludeTheFirstEvening/codex', amount: 1, scope: 'eachInvestigator' }),
    Object.freeze({ id: 'preludeSecondCodex', when: 'preludeTheSecondEvening/codex', amount: 1, scope: 'eachInvestigator' }),
    Object.freeze({ id: 'preludeSecondAlone', when: 'preludeTheSecondEvening/alone', amount: 1, scope: 'eachInvestigator' }),
  ]),
  // 步骤清单（含两段纯叙事夜）与保守前驱表。
  stepOrder: FHV_STEP_ORDER,
  unlockSteps: FHV_UNLOCK_STEPS,
})

// ---------------------------------------------------------------------------
// 4. 构建期自检
// ---------------------------------------------------------------------------
/** 与 `src/engine/campaign-flow.js#progressCampaign` 相同的升级窗判据。 */
export function upgradeWindowForNode (node) {
  return node?.type === 'interlude' && node.upgrades !== false
}

/**
 * 构建期自检：flow 必须通过战役图注册期校验（失败即抛，内容注册时 fail closed）。
 * `scenarioIds` 可覆盖（单章夹具用）；`recordSchema` 可覆盖（只声明流程层键时用）。
 */
export function validateFhvFlow (flow = FHV_FLOW, { scenarioIds = FHV_SCENARIO_IDS, recordSchema = FHV_RECORD_TYPES } = {}) {
  return validateCampaignGraph({ id: FHV_CAMPAIGN_ID, scenarioIds, recordSchema, flow })
}

validateFhvFlow()

// 反查表：节点 id → 所属步骤（账本/测试用；不参与引擎读点）。
export const FHV_STEP_OF_NODE = Object.freeze({
  ...Object.fromEntries(FHV_SCENARIO_IDS.map(id => [id, id])),
  [FHV_PROLOGUE_STEP]: FHV_PROLOGUE_STEP,
  [FHV_PROLOGUE_RULES_STEP]: FHV_PROLOGUE_STEP,
  [FHV_EPILOGUE_STEP]: FHV_EPILOGUE_STEP,
  [FHV_END_STEP]: FHV_END_STEP,
  ...Object.fromEntries(PREP_STEPS.map(spec => [spec.nodeId, spec.step])),
  ...Object.fromEntries(FHV_EVENING_STEPS.map(step => [step, step])),
  firstEveningCodex: FHV_EVENING_STEPS[0],
  firstEveningMeal: FHV_EVENING_STEPS[0],
  firstEveningChoice: FHV_EVENING_STEPS[0],
  secondEveningCodex: FHV_EVENING_STEPS[1],
  secondEveningChoice: FHV_EVENING_STEPS[1],
  [SURVEY_ROUTER_ID]: 'router',
  [FINAL_EVENING_OUTCOME_ID]: 'preludeTheFinalEvening',
  fatigue: 'theLongestNight',
  ...Object.fromEntries(Object.keys(FHV_SURVEY_SLOTS).map(slot => [
    `surveyChoice${slot[0].toUpperCase()}${slot.slice(1)}`, FHV_SURVEY_SLOTS[slot].step,
  ])),
})

// 流程层只读辅助：给定记录 → 下一个应进入的流程图节点（大厅/测试用；不写状态）。
export function fhvNextNodeFor (stepId, records = {}) {
  const slot = fhvSlot(records)
  const next = fhvNextStep(stepId, { slot })
  return next.length ? next[0] : null
}

export { fhvSurveyCandidates, recordDefaults }
