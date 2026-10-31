// 食梦者（The Dream-Eaters）· 战役清单（P8 战役层）。
//
// 状态：`development`（8 章剧本仍在 P8 各 worker 手里；战役不开放启动）。
// 本清单只声明**可序列化的纯数据**：两条线 + 4 个章对、四种开局模式、两套基础混乱袋、
// 55 个记录键、三幕间与 16 段尾声的 flow 接线、单线/共享的战役结局匹配表。
//
// flow 结构（路线图 §7.2.2 / §8.3）：
//   · `manifest.flow` = 双线（pick）流程：`partFlow(parts,{mode:'pick'})` 的章对 gate
//     → 用 `attachInterludes` 把 `interlude1/2/3` 换成完整幕间子图
//     → 用 `attachEpilogue` 把最后一对 gate 接到 16 段尾声矩阵 → `end`；
//   · `manifest.flows` 额外登记四种模式各自的 flow（单线 A/B 用 `singlePartFlow`，
//     只保留幕间 I 的对应分支，且**不接**双线矩阵，末章直接 `end`）。
//     ⚠️ 引擎 `src/engine/engine.js` 的 `campaignManifestFor` 目前在选模式后用
//     `partManifest(manifest, mode)` 重新生成 `partFlow`，会丢掉这里的自定义幕间/尾声接线；
//     P9.5 接线时应改为「manifest.flows[mode] 优先，缺省再 partFlow」。本层先把数据备好。
//   · `manifest.epilogueMatrix` 让 P9.5/story-text 能按 1/16 段查表；`endings` 只用于单线
//     （以及共享记录）的战役结局匹配——双线的 16 段不走 `campaignEnding` 的单记录匹配。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { chapters, SHARED_ENCOUNTER_GROUPS } from './shared.js'
import { TDE_MODES, TDE_PARTS, TDE_SCENARIO_IDS, tdeChapterPairs } from './parts.js'
import { RECORD_LABELS, recordDefaults, recordTypes } from './record-labels.js'
import { TDE_CHAOS_BAGS, TDE_DEFAULT_CHAOS_BAGS } from './tde-chaos.js'
import { attachInterludes } from './interludes.js'
import {
  TDE_EPILOGUE_A_AXIS, TDE_EPILOGUE_B_AXIS, TDE_EPILOGUE_MATRIX, TDE_SINGLE_LINE_EPILOGUE,
  attachEpilogue,
} from './dual-story.js'
import { partFlow } from '../../../src/campaign/part-flow.js'

export const TDE_CONTENT_VERSION = '0.1.0'
export const TDE_MIN_RULES_VERSION = 'n6.0'
export const TDE_CAMPAIGN_ID = 'theDreamEaters'

// 12 个战役内跨章共享遭遇组（camelCase id → 目录 encounterCode）。
export const CAMPAIGN_SHARED_ENCOUNTER_GROUPS = Object.freeze(Object.fromEntries(
  SHARED_ENCOUNTER_GROUPS.map(group => [group.id, group.encounterCode])))
export const TDE_SHARED_ENCOUNTER_GROUP_IDS = Object.freeze(Object.keys(CAMPAIGN_SHARED_ENCOUNTER_GROUPS))

// 双线（分选 / 并行）flow：章对 gate → 幕间 I/II/III → 16 段尾声 → end。
const dualBase = partFlow(TDE_PARTS, { mode: 'pick' })
const pickFlow = attachEpilogue(attachInterludes(dualBase, { mode: 'pick' }))

// 单线 A/B：只有 4 章 + 幕间 I 的对应分支；没有双线 gate、没有尾声正文，末章直接 end。
const singleAFlow = attachInterludes(partFlow(TDE_PARTS, { mode: 'singleA' }), { mode: 'singleA' })
const singleBFlow = attachInterludes(partFlow(TDE_PARTS, { mode: 'singleB' }), { mode: 'singleB' })

export const TDE_FLOWS = Object.freeze({
  singleA: singleAFlow,
  singleB: singleBFlow,
  pick: pickFlow,
  parallel: pickFlow,
})

// 线性解锁表：章对的第二对起要求上一对两章都完成（与配对屏障一致；仅供参考/UI 展示，
// 真正的配对屏障在 flow 的 partGate 上）。
const chapterPairs = tdeChapterPairs()
const pairOf = chapterId => chapters.find(chapter => chapter.id === chapterId)?.pair || null
const unlock = Object.fromEntries(chapters.map(chapter => {
  const pair = pairOf(chapter.id)
  const previous = chapterPairs.find(entry => entry.pair === pair - 1)
  return [chapter.id, previous ? [previous.A.scenarioId, previous.B.scenarioId] : []]
}))

// 单线/共享记录的战役结局匹配：A 线 4 个最终态 + B 线 4 个最终态。
// 顺序先 A 后 B；双线模式由 epilogueMatrix 选 1/16，不走这张表。
const endingLabel = record => `结局：${RECORD_LABELS[record] || record}`
export const TDE_ENDINGS = Object.freeze([
  ...TDE_EPILOGUE_A_AXIS.map(entry => Object.freeze({
    id: entry.id, label: endingLabel(entry.record), record: entry.record, part: 'A',
  })),
  ...TDE_EPILOGUE_B_AXIS.map(entry => Object.freeze({
    id: entry.id, label: endingLabel(entry.record), record: entry.record, part: 'B',
  })),
])

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: TDE_CAMPAIGN_ID,
  name: '食梦者',
  nameEn: 'The Dream Eaters',
  contentVersion: TDE_CONTENT_VERSION,
  minRulesVersion: TDE_MIN_RULES_VERSION,
  status: 'development',
  requiredPackIds: ['core', 'tdeCampaign', 'tdeInvestigators', 'tdePlayer'],
  scenarioIds: [...TDE_SCENARIO_IDS],
  unlock,
  // 双线：A 梦寻（The Dream-Quest）/ B 梦网（The Web of Dreams），各 4 章、4 个章对。
  parts: TDE_PARTS,
  modes: [...TDE_MODES],
  // 内容 schema 只接受「难度 → token 数组」的扁平表：用 A 袋作未选线前的默认表；
  // 真正的两袋在 `partChaosBags`，序章/章节 setup 按 part 安装（`baseBagFor(part, difficulty)`）。
  chaosBags: TDE_DEFAULT_CHAOS_BAGS,
  partChaosBags: TDE_CHAOS_BAGS,
  // P8：12 个「战役内跨章共享遭遇组」的声明。归属算法（tools/encounter-entry-placement.mjs）
  // 用它在「本战役只有 1 章使用该组」时仍把条目归到 `theDreamEaters/_shared/<组>/`，
  // 与路线图 §1.2「20 组 = 8 章节组 + 12 共享组」的口径一致。
  sharedEncounterGroupIds: Object.keys(CAMPAIGN_SHARED_ENCOUNTER_GROUPS),
  recordSchema: recordTypes,
  recordDefaults,
  recordLabels: RECORD_LABELS,
  interludeHandlerId: 'tdeInterlude',
  resolutionIds: ['victory', 'defeat'],
  endings: TDE_ENDINGS,
  // 双线尾声：16 段矩阵 + 特殊子步骤数据（正文键 `theDreamEaters.flavorText.epilogue<n>`，
  // 中文由 P8-T 生成器补齐；本层不写中文摘要）。
  epilogueMatrix: TDE_EPILOGUE_MATRIX,
  singleLineEpilogue: TDE_SINGLE_LINE_EPILOGUE,
  // 四种模式的完整 flow（数据备好；引擎接线见文件头 ⚠️）。
  flows: TDE_FLOWS,
  // 默认 flow：双线（pick/parallel）。`modes` 未选定前 hub 不会启动战役。
  flow: pickFlow,
}

export default manifest
