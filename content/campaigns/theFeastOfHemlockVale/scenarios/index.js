// 铁杉谷盛宴（The Feast of Hemlock Vale）十二个场景模块（4 序曲 + 8 章）汇总（P7 注册骨架）。
//
// 与 TSK 同口径：章节 worker 未落盘前，缺模块不阻断本文件加载；需要「十二场景齐备」的
// 注册/验收路径必须调用 `requireAllScenarios()`（缺章即抛，fail closed）。
export const scenarioModuleIds = Object.freeze([
  'welcomeToHemlockVale', 'writtenInRock', 'hemlockHouse', 'theSilentHeath', 'theLostSister',
  'theThingInTheDepths', 'theTwistedHollow', 'dawnOfTheSecondDay', 'theLongestNight',
  'dawnOfTheFinalDay', 'preludeTheFinalEvening', 'fateOfTheVale',
])

const entries = []
const missing = []
const errors = Object.create(null)

for (const id of scenarioModuleIds) {
  try {
    // eslint-disable-next-line no-await-in-loop
    const module = await import(`./${id}/index.js`)
    entries.push(Object.freeze({ id, module, manifest: module.manifest, scenario: module.scenario,
      behavior: module.behavior, layout: module.layout }))
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

export function requireAllScenarios() {
  if (missing.length) throw new Error(`缺少场景模块：${missing.join('、')}`)
  return scenarioModules
}

export const scenarioModuleById = id => scenarioModules.find(entry => entry.id === id) || null
