// 食梦者（The Dream-Eaters）· 双线的薄封装（P8 战役层）。
//
// 只做**纯数据整理**：把 `shared.js` 的 8 章按 A（梦寻 / The Dream-Quest）与
// B（梦网 / The Web of Dreams）切成两条线、4 个章对，供 manifest / 测试 / 大厅与
// 流程层（`src/campaign/part-flow.js`）共用。
//
// 口径：docs/tde-migration-roadmap.md §1.4.1（四模式）、§7.2.2（配对屏障）、§8.3
// （manifest 必须声明 parts 与 modes）。章节的 `part` / `pair` 以 `shared.js` 为唯一事实源，
// 这里不重复声明、不写剧情。
import { chapters, MODES, PAIR_COUNT } from './shared.js'

export const TDE_PART_IDS = Object.freeze(['A', 'B'])

// 模式枚举与章对数以 shared.js 为唯一事实源（§8.3：manifest 声明 modes 四枚举）。
export const TDE_MODES = Object.freeze([...MODES])

export const TDE_PAIR_COUNT = PAIR_COUNT

// `parts` 章节目录：每章只暴露流程需要的 id/pair/名字；
// nameEn 用于流程节点 label 与调试，不参与规则。
const chapterEntry = chapter => Object.freeze({
  scenarioId: chapter.id,
  pair: chapter.pair,
  name: chapter.name,
  nameEn: chapter.nameEn,
  code: chapter.code,
})

export const TDE_PARTS = Object.freeze({
  A: Object.freeze({
    id: 'A',
    name: '梦寻',
    nameEn: 'The Dream-Quest',
    chapters: Object.freeze(chapters.filter(chapter => chapter.part === 'A').map(chapterEntry)),
  }),
  B: Object.freeze({
    id: 'B',
    name: '梦网',
    nameEn: 'The Web of Dreams',
    chapters: Object.freeze(chapters.filter(chapter => chapter.part === 'B').map(chapterEntry)),
  }),
})

export const TDE_SCENARIO_IDS = Object.freeze(chapters.map(chapter => chapter.id))

/** 战役清单里的 `parts`（形状与 `src/campaign/part-flow.js` 的 normalizePartPairs 对齐）。 */
export const TDE_PARTS_MANIFEST = TDE_PARTS

/** 关卡 → 章节定义。 */
export function tdeChapter(scenarioId) {
  return chapters.find(chapter => chapter.id === scenarioId) || null
}

/** 关卡所属线；未知关卡返回 null。 */
export function partOfScenario(scenarioId) {
  return tdeChapter(scenarioId)?.part || null
}

/** 关卡所属章对（1–4）；未知关卡返回 null。 */
export function pairOfScenario(scenarioId) {
  return tdeChapter(scenarioId)?.pair ?? null
}

/** 某条线的 4 章（按章对顺序）；非法线返回空数组。 */
export function chaptersOfPart(part) {
  return TDE_PARTS[part]?.chapters || []
}

/** 4 个章对：`[{ pair, A, B }]`（A/B 各一条章节定义）。 */
export function tdeChapterPairs() {
  return Object.freeze(Array.from({ length: TDE_PAIR_COUNT }, (_, index) => {
    const pair = index + 1
    const a = TDE_PARTS.A.chapters.find(chapter => chapter.pair === pair) || null
    const b = TDE_PARTS.B.chapters.find(chapter => chapter.pair === pair) || null
    return Object.freeze({ pair, A: a, B: b })
  }))
}

/** 顺序无关的双线交错清单（A1, B1, A2, B2, …），供 manifest.scenarioIds 与调试使用。 */
export function interleavedScenarioIds() {
  return tdeChapterPairs().flatMap(entry => [entry.A?.scenarioId, entry.B?.scenarioId]).filter(Boolean)
}
