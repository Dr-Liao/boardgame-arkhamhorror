// 《沉没之城》（The Drowned City）十个场景模块汇总（P7 注册骨架）。
//
// 与 FHV/TSK 同口径：章节 worker 未落盘前，缺模块不阻断本文件加载（并行批次期间
// 各 worker 先后落盘）；需要「十场景齐备」的注册/验收路径必须调用 `requireAllScenarios()`
// （缺章即抛，fail closed）。
//
// 场景模块契约（CONTRACT §3）：`scenarios/<chapterId>/index.js` 导出
// `{ manifest, scenario, behavior, layout }`（`manifest` 由 `scenarioManifest(...)` 生成）。
export const scenarioModuleIds = Object.freeze([
  'oneLastJob', 'theWesternWall', 'theDrownedQuarter', 'theApiary', 'theGrandVault',
  'courtOfTheAncients', 'obsidianCanyons', 'sepulchreOfTheSleeper',
  'theDoomOfArkhamPartI', 'theDoomOfArkhamPartII',
])

const entries = []
const missing = []
const errors = Object.create(null)

for (const id of scenarioModuleIds) {
  try {
    // eslint-disable-next-line no-await-in-loop
    const module = await import(`./${id}/index.js`)
    entries.push(Object.freeze({
      id,
      module,
      manifest: module.manifest,
      scenario: module.scenario,
      behavior: module.behavior,
      layout: module.layout,
    }))
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') {
      throw new Error(`场景模块 ${id} 加载失败：${error?.message || error}`)
    }
    missing.push(id)
    errors[id] = error?.message || String(error)
  }
}

export const scenarioModules = Object.freeze(entries)
export const missingScenarioIds = Object.freeze(missing)
export const scenarioLoadErrors = Object.freeze(errors)

export function requireAllScenarios () {
  if (missing.length) throw new Error(`缺少场景模块：${missing.join('、')}`)
  return scenarioModules
}

export const scenarioModuleById = id => scenarioModules.find(entry => entry.id === id) || null

/** 已落盘的场景 manifest 清单（注册期 fail closed 由 `requireAllScenarios` 负责）。 */
export const scenarioManifests = Object.freeze(entries.map(entry => entry.manifest))
