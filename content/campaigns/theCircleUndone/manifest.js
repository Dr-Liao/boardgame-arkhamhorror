// 万象无终（The Circle Undone）· 战役清单（M0 骨架：catalog-only，不可启动）。
//
// 状态必须保持 `catalog-only`，直到 M5 的确认门禁（剧本/关键词/规则书三组 verified）通过：
//   · 9 章占位（content/campaigns/theCircleUndone/chapters.js）；
//   · 三包 tcuCampaign / tcuInvestigators / tcuPlayer 全部 catalog-only；
//   · `assertLaunchableCampaign` 在本阶段必须失败——这是 P1 的门禁证明之一。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { CHAOS_BAGS, CONTENT_VERSION, MIN_RULES_VERSION, chapters, recordDefaults, recordTypes } from './shared.js'

// P5 交互层要用的中文名：档案页与牌桌战役面板直接显示，不再把内部键名暴露给玩家。
// 记录键目前只登记 4 个（其余 60 个随 P9 补齐）；10 个遗留记忆的中文名与 P2.10 的稳定 id 一一对应。
const RECORD_LABELS = Object.freeze({
  mementosDiscovered: '已发现的遗留记忆',
  youAreBeingHunted: '你被看守人追捕',
  wasTakenByTheWatcher: '被看守人带走',
  missingPersons: '失踪人口',
})

const MEMENTO_LABELS = Object.freeze({
  mesmerizingFlute: '魅惑长笛',
  strangeIncantation: '奇怪的咒文',
  ritualComponents: '仪式材料',
  scrapOfTornShadow: '撕碎的影子',
  gilmensJournal: '吉尔曼的日记',
  keziahsFormulae: '凯齐亚的公式',
  wornCrucifix: '磨损的十字架',
  wispOfSpectralMist: '一缕幽灵薄雾',
  cornHuskDoll: '玉米壳人偶',
  bloodyTreeCarvings: '带血的树雕',
})

export const TCU_MEMENTO_LABELS = MEMENTO_LABELS

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'theCircleUndone',
  name: '万象无终',
  nameEn: 'The Circle Undone',
  contentVersion: CONTENT_VERSION,
  minRulesVersion: MIN_RULES_VERSION,
  status: 'catalog-only',
  requiredPackIds: ['core', 'tcuCampaign', 'tcuInvestigators', 'tcuPlayer'],
  scenarioIds: chapters.map(chapter => chapter.id),
  // 线性解锁只作为占位：所有章节仍是 catalog-only，无法从大厅启动。
  unlock: Object.fromEntries(chapters.map((chapter, index) =>
    [chapter.id, index ? [chapters[index - 1].id] : []])),
  chaosBags: CHAOS_BAGS,
  recordSchema: recordTypes,
  recordDefaults,
  recordLabels: RECORD_LABELS,
  mementoLabels: MEMENTO_LABELS,
  // 结局与幕间在 P8/P9 补；先登记两个占位结局 id 满足清单校验。
  // 幕间处理器 id：P8 写 TM 幕间时换成真实实现；占位期只满足清单校验。
  interludeHandlerId: 'tcuInterlude',
  resolutionIds: ['defeat', 'victory'],
  endings: [],
  flow: undefined,
}
