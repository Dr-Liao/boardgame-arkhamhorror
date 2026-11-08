// 《地球边缘》（Edge of the Earth）· 战役流程图组装与 manifest 片段（P7）。
//
// 输入（均已按参考实现锁定，见各文件头）：
//   parts.js（8 章/16 步骤/nextStep）、prologue.js（序幕）、checkpoints.js（检查点 I–III）、
//   interludes.js（幕间 I–III + 可再入《致命幻景》）、epilogue.js（尾声）、records.js（记录键/常量/正文读取）。
// 输出：
//   · `EOTE_FLOW`：可序列化的 `{ start, nodes }`，直接合入 `manifest.flow`；
//   · `campaignFlowExtras`：供 Lead 合并进 `content/campaigns/edgeOfTheEarth/manifest.js` 的片段
//     （不含 flow 之外的 manifest 字段，不覆盖既有 catalog 身份）；
//   · `upgradeWindowForNode(node)`：与引擎 `progressCampaign` 完全相同的升级窗判据（检查点否 / 幕间是）。
//
// 流程形状：prologue →（8 章主线穿插 3 检查点 + 3 幕间）→ epilogue → end；
// 《致命幻景》由三个幕间的门选项进入，完成后经 `fatalMirageReturn`（stepReturn）按
// `campaignCompletedSteps` 回到主线下一章（失落之峰 / 古老者之城 / 疯狂之心 I）。
//
// 正文绑定：每个流程节点保留 `textKey`，构建时用 story-access 读取当前生成物正文填入 `text`；
// 生成物缺键时保留内容层兜底文字（测试同时断言「节点文本来自 story-access」）。
import { validateCampaignGraph } from '../../../src/campaign/campaign-flow.js'
import { storyBody, storyHeading } from './records.js'
import {
  EOTE_CAMPAIGN_ID, EOTE_CHAPTER_PAIRS, EOTE_CHECKPOINT_IDS, EOTE_FATAL_MIRAGE_DEFAULT_RETURN,
  EOTE_FATAL_MIRAGE_ENTRY_POINTS, EOTE_FATAL_MIRAGE_RETURN_ORDER, EOTE_INTERLUDE_IDS,
  EOTE_MAINLINE_SCENARIO_IDS, EOTE_NEXT_STEP, EOTE_SCENARIO_IDS, EOTE_SCENARIO_UNITS,
  EOTE_SKIPPABLE_SCENARIOS, EOTE_STEP_ORDER, eoteNextStep, isMainlineStep, scenarioUnitOf,
} from './parts.js'
import { PROLOGUE_NODES } from './prologue.js'
import { CHECKPOINT_NODES } from './checkpoints.js'
import { INTERLUDE_NODES } from './interludes.js'
import { EPILOGUE_NODES } from './epilogue.js'
import { recordDefaults, recordLabels, recordSchema } from './records.js'

export {
  EOTE_CAMPAIGN_ID, EOTE_CHAPTER_PAIRS, EOTE_CHECKPOINT_IDS, EOTE_FATAL_MIRAGE_ENTRY_POINTS,
  EOTE_INTERLUDE_IDS, EOTE_MAINLINE_SCENARIO_IDS, EOTE_NEXT_STEP, EOTE_SCENARIO_IDS,
  EOTE_SCENARIO_UNITS, EOTE_SKIPPABLE_SCENARIOS, EOTE_STEP_ORDER, eoteNextStep, isMainlineStep,
  scenarioUnitOf,
}

const clone = value => (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)))

/** 章节节点的默认出口（检查点/幕间/尾声由下一步接管；具体分支在对应子图里）。 */
const SCENARIO_NEXT = Object.freeze({
  iceAndDeathPart1: 'checkpoint1',
  iceAndDeathPart2: 'checkpoint2',
  iceAndDeathPart3: 'interlude1',
  fatalMirage: 'fatalMirageReturn',
  toTheForbiddenPeaks: 'interlude2',
  cityOfTheElderThings: 'interlude3',
  theHeartOfMadnessPart1: 'checkpoint3',
  theHeartOfMadnessPart2: 'epilogue',
})

/** 章节节点：标题/提示卡号仅供展示与审计，`scenarioId` 才是引擎读点。 */
function scenarioNodes () {
  const nodes = {}
  for (const unit of EOTE_SCENARIO_UNITS) {
    nodes[unit.id] = {
      type: 'scenario',
      scenarioId: unit.id,
      title: unit.name,
      nameEn: unit.nameEn,
      cardCode: unit.cardCode,
      chapter: unit.chapter,
      part: unit.part,
      ...(unit.id === 'fatalMirage'
        ? { effects: [{ type: 'increment', key: 'eoteFatalMirageEntries', amount: 1 }] }
        : {}),
      next: SCENARIO_NEXT[unit.id],
    }
  }
  return nodes
}

/** 《致命幻景》回场：参考 nextStep 的有序 if/else 链（stepReturn 语义）。 */
const FATAL_MIRAGE_RETURN_NODE = Object.freeze({
  type: 'stepReturn',
  title: '致命幻景：返回主线',
  rules: EOTE_FATAL_MIRAGE_RETURN_ORDER.map(rule => Object.freeze({
    id: `after_${rule.completed}`,
    when: Object.freeze({ completedStep: rule.completed }),
    next: rule.next,
  })),
  next: EOTE_FATAL_MIRAGE_DEFAULT_RETURN,
})

/** 组装未本地化的原始节点表。 */
export function rawEoteFlowNodes () {
  return {
    ...scenarioNodes(),
    fatalMirageReturn: clone(FATAL_MIRAGE_RETURN_NODE),
    ...clone(PROLOGUE_NODES),
    ...clone(CHECKPOINT_NODES),
    ...clone(INTERLUDE_NODES),
    ...clone(EPILOGUE_NODES),
  }
}

/** 正文绑定：节点 `textKey` → story-access 当前正文；选项 `labelKey` 同理。 */
function localizeNodes (nodes) {
  for (const node of Object.values(nodes)) {
    if (!node || typeof node !== 'object') continue
    if (node.textKey) {
      const body = storyBody(node.textKey)
      const heading = storyHeading(node.textKey)
      // 生成物有正文才覆盖内容层兜底，避免生成物未就绪时节点空白。
      if (body) node.text = body
      if (heading) node.title = heading
    }
    for (const option of node.options || []) {
      if (!option?.labelKey) continue
      const label = storyBody(option.labelKey)
      if (label) option.label = label
    }
  }
  return nodes
}

/** P7 交付的完整 flow：`{ start: 'prologue', nodes }`，可序列化纯数据。 */
export const EOTE_FLOW = Object.freeze({ start: 'prologue', nodes: localizeNodes(rawEoteFlowNodes()) })

/** 供 Lead 合并的 manifest 片段（只含流程/记录字段；不覆盖 catalog 身份、scenarioIds、chaosBags）。 */
export const campaignFlowExtras = Object.freeze({
  // 引擎读点：`campaignGraph(manifest)` 直接返回 manifest.flow。
  flow: EOTE_FLOW,
  // 记录键/类型/默认值/标签（Key.hs 56 项 + 流程层 8 项）。
  recordSchema,
  recordDefaults,
  recordLabels: recordLabels(),
  // 引擎读点：`interludeFlow: 'continuous'` → 幕间准备结束后一次读完幕间子图（含再入幻景的门）。
  interludeFlow: 'continuous',
  // 升级权限（引擎用 node.type 判定；这里显式登记，供 P8 大厅/审计读取）。
  upgradeWindows: Object.freeze({ interlude: true, checkpoint: false, scenario: false }),
  // 章节顺序与可跳段（P8 大厅/验收用）。
  scenarioOrder: EOTE_SCENARIO_IDS,
  mainlineScenarioOrder: EOTE_MAINLINE_SCENARIO_IDS,
  skippableScenarioIds: EOTE_SKIPPABLE_SCENARIOS,
  fatalMirageEntryPoints: EOTE_FATAL_MIRAGE_ENTRY_POINTS,
  stepOrder: EOTE_STEP_ORDER,
})

/** 与 `src/engine/campaign-flow.js#progressCampaign` 相同的升级窗判据。 */
export function upgradeWindowForNode (node) {
  return node?.type === 'interlude' && node.upgrades !== false
}

/** 构建期自检：flow 必须能通过战役图注册期校验（失败即抛，内容注册时 fail closed）。 */
export function validateEoteFlow (flow = EOTE_FLOW) {
  return validateCampaignGraph({ id: EOTE_CAMPAIGN_ID, scenarioIds: EOTE_SCENARIO_IDS, recordSchema, flow })
}

validateEoteFlow()
