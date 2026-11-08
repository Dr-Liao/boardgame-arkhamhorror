// 《地球边缘》（Edge of the Earth）· 战役推进骨架（P7）：8 个章节单元、16 个战役步骤与 nextStep 映射。
//
// 事实源（锁定）：
//   · `backend/arkham-api/library/Arkham/Campaign/Campaigns/EdgeOfTheEarth.hs#nextStep`（场景 → 检查点/幕间/尾声的推进）
//   · `backend/arkham-api/library/Arkham/Campaigns/EdgeOfTheEarth/CampaignSteps.hs`（8 个 ScenarioStep 与提示卡号）
//   · `artifacts/migration/eote/scope.json#campaignFlow.steps / nextStepEdges / fatalMirageEntryPoints`
//   · `docs/edgeOfTheEarth/README.md` §4「八章路线与逐章清单」
//
// 本文件是**纯数据 + 纯函数**（无引擎依赖、无副作用），供 flow.js 组装 `manifest.flow`，也供测试逐项核对。
//
// 推进骨架：
//   序幕 → 亡命冰原 I → 检查点 I → [亡命冰原 II] → 检查点 II → [亡命冰原 III] → 幕间 I
//        → [致命幻景] → 失落之峰 → 幕间 II → [致命幻景] → 古老者之城 → 幕间 III → [致命幻景]
//        → 疯狂之心 I → 检查点 III → 疯狂之心 II → 尾声
//   《亡命冰原》II/III 与《疯狂之心》I 之后的检查点决定是否进入下一部分或跳段；
//   《致命幻景》在幕间 I/II/III 按条件可选切入，完成后按 `campaignCompletedSteps` 回到主线下一章。

export const EOTE_CAMPAIGN_ID = 'edgeOfTheEarth'

/** 8 个章节单元（按真实游玩顺序；共用提示卡的拆篇以 `cardCode` + `part` 标注）。 */
export const EOTE_SCENARIO_UNITS = Object.freeze([
  Object.freeze({ id: 'iceAndDeathPart1', chapter: 'iceAndDeath', part: 1, cardCode: '08501', name: '亡命冰原 第 I 部分', nameEn: 'Ice and Death, Part I' }),
  Object.freeze({ id: 'iceAndDeathPart2', chapter: 'iceAndDeath', part: 2, cardCode: '08501', name: '亡命冰原 第 II 部分', nameEn: 'Ice and Death, Part II' }),
  Object.freeze({ id: 'iceAndDeathPart3', chapter: 'iceAndDeath', part: 3, cardCode: '08501', name: '亡命冰原 第 III 部分', nameEn: 'Ice and Death, Part III' }),
  Object.freeze({ id: 'fatalMirage', chapter: 'fatalMirage', part: 1, cardCode: '08549', name: '致命幻景', nameEn: 'Fatal Mirage' }),
  Object.freeze({ id: 'toTheForbiddenPeaks', chapter: 'toTheForbiddenPeaks', part: 1, cardCode: '08596', name: '失落之峰', nameEn: 'To the Forbidden Peaks' }),
  Object.freeze({ id: 'cityOfTheElderThings', chapter: 'cityOfTheElderThings', part: 1, cardCode: '08621', name: '古老者之城', nameEn: 'City of the Elder Things' }),
  Object.freeze({ id: 'theHeartOfMadnessPart1', chapter: 'theHeartOfMadness', part: 1, cardCode: '08648', name: '疯狂之心 第 I 部分', nameEn: 'The Heart of Madness, Part I' }),
  Object.freeze({ id: 'theHeartOfMadnessPart2', chapter: 'theHeartOfMadness', part: 2, cardCode: '08648', name: '疯狂之心 第 II 部分', nameEn: 'The Heart of Madness, Part II' }),
])
export const EOTE_SCENARIO_IDS = Object.freeze(EOTE_SCENARIO_UNITS.map(unit => unit.id))

/** 主线章节（不含可选的《致命幻景》），按游玩顺序。 */
export const EOTE_MAINLINE_SCENARIO_IDS = Object.freeze(
  EOTE_SCENARIO_IDS.filter(id => id !== 'fatalMirage'))

/** 共用提示卡的章对：`iceAndDeath` I–III、`theHeartOfMadness` I–II。 */
export const EOTE_CHAPTER_PAIRS = Object.freeze([
  Object.freeze({ chapter: 'iceAndDeath', cardCode: '08501', name: '亡命冰原', nameEn: 'Ice and Death',
    units: Object.freeze(['iceAndDeathPart1', 'iceAndDeathPart2', 'iceAndDeathPart3']) }),
  Object.freeze({ chapter: 'theHeartOfMadness', cardCode: '08648', name: '疯狂之心', nameEn: 'The Heart of Madness',
    units: Object.freeze(['theHeartOfMadnessPart1', 'theHeartOfMadnessPart2']) }),
])

/** 16 个战役步骤（序幕 + 8 章 + 3 检查点 + 3 幕间 + 尾声），按出现顺序。 */
export const EOTE_STEP_ORDER = Object.freeze([
  'prologue',
  'iceAndDeathPart1', 'checkpoint1',
  'iceAndDeathPart2', 'checkpoint2',
  'iceAndDeathPart3', 'interlude1',
  'toTheForbiddenPeaks', 'interlude2',
  'cityOfTheElderThings', 'interlude3',
  'theHeartOfMadnessPart1', 'checkpoint3', 'theHeartOfMadnessPart2',
  'epilogue',
])
export const EOTE_CHECKPOINT_IDS = Object.freeze(['checkpoint1', 'checkpoint2', 'checkpoint3'])
export const EOTE_INTERLUDE_IDS = Object.freeze(['interlude1', 'interlude2', 'interlude3'])

/** 《致命幻景》的三个可选切入幕间（参考 nextStep / scope.campaignFlow.fatalMirageEntryPoints）。 */
export const EOTE_FATAL_MIRAGE_ENTRY_POINTS = Object.freeze(['interlude1', 'interlude2', 'interlude3'])
/** 《致命幻景》完成后的主线返回章（按已完成章节倒序判断）。 */
export const EOTE_FATAL_MIRAGE_RETURN_ORDER = Object.freeze([
  Object.freeze({ completed: 'cityOfTheElderThings', next: 'theHeartOfMadnessPart1' }),
  Object.freeze({ completed: 'toTheForbiddenPeaks', next: 'cityOfTheElderThings' }),
])
export const EOTE_FATAL_MIRAGE_DEFAULT_RETURN = 'toTheForbiddenPeaks'

/** 静态 nextStep 映射（`fatalMirage` 为动态，见 `eoteNextStep`；数组顺序即参考实现的候选顺序）。 */
export const EOTE_NEXT_STEP = Object.freeze({
  prologue: Object.freeze(['iceAndDeathPart1']),
  iceAndDeathPart1: Object.freeze(['checkpoint1']),
  iceAndDeathPart2: Object.freeze(['checkpoint2']),
  iceAndDeathPart3: Object.freeze(['interlude1']),
  toTheForbiddenPeaks: Object.freeze(['interlude2']),
  cityOfTheElderThings: Object.freeze(['interlude3']),
  theHeartOfMadnessPart1: Object.freeze(['checkpoint3']),
  theHeartOfMadnessPart2: Object.freeze(['epilogue']),
  epilogue: Object.freeze([]),
  // 检查点/幕间是分支步骤：数组给出参考实现里可能的两条出口（顺序为「进入下一部分 / 跳段」）。
  checkpoint1: Object.freeze(['iceAndDeathPart2', 'checkpoint2']),
  checkpoint2: Object.freeze(['iceAndDeathPart3', 'interlude1']),
  checkpoint3: Object.freeze(['theHeartOfMadnessPart2']),
  interlude1: Object.freeze(['fatalMirage', 'toTheForbiddenPeaks']),
  interlude2: Object.freeze(['fatalMirage', 'cityOfTheElderThings']),
  interlude3: Object.freeze(['fatalMirage', 'theHeartOfMadnessPart1']),
})

/** 已完成步骤集合归一化：接受数组 / Set / `campaign.scenarioResults`。 */
function completedSet (completed) {
  if (completed instanceof Set) return completed
  if (Array.isArray(completed)) {
    return new Set(completed.map(entry => (typeof entry === 'string' ? entry : entry?.scenarioId)).filter(Boolean))
  }
  return new Set()
}

/**
 * 参考实现 `nextStep a` 的纯函数镜像：给定当前步骤返回下一批候选（空数组表示结束）。
 * `fatalMirage` 按已完成章节返回唯一目标；其它步骤返回参考实现的候选出口顺序。
 */
export function eoteNextStep (stepId, completed = []) {
  if (stepId === 'fatalMirage') {
    const done = completedSet(completed)
    for (const rule of EOTE_FATAL_MIRAGE_RETURN_ORDER) {
      if (done.has(rule.completed)) return [rule.next]
    }
    return [EOTE_FATAL_MIRAGE_DEFAULT_RETURN]
  }
  return EOTE_NEXT_STEP[stepId] ? [...EOTE_NEXT_STEP[stepId]] : []
}

/** 步骤是否属于主线（8 章 + 序幕/检查点/幕间/尾声；不含可选的《致命幻景》）。 */
export function isMainlineStep (stepId) {
  return EOTE_STEP_ORDER.includes(stepId)
}

/** 章节单元（未知 id 返回 null）。 */
export function scenarioUnitOf (id) {
  return EOTE_SCENARIO_UNITS.find(unit => unit.id === id) || null
}

/** 8 章里哪些是可跳过的部分：亡命冰原 II / III（检查点 I/II 的分支决定）。 */
export const EOTE_SKIPPABLE_SCENARIOS = Object.freeze(['iceAndDeathPart2', 'iceAndDeathPart3'])
