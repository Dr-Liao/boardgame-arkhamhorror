// 《绯红密钥》十章模块汇总（P7 注册骨架）。
//
// 用途：把 `content/campaigns/theScarletKeys/scenarios/<id>/index.js`（由各章 worker 交付）
// 按章 id 顺序汇总成注册表可直接消费的形状，供 `manifest.js` / `chapters.js` / P8 组合根使用。
//
// 迁移期口径（P7 收口前）：章节 worker 仍在并行落盘，未落盘的章**不阻断**本模块加载——
// 每章用动态 `import()` 单独尝试，缺模块记进 `missingScenarioIds` 并保留错误原文；
// 需要「十章齐备」的注册/验收路径必须调用 `requireAllScenarios()`（缺章即抛，fail closed），
// 不允许用不完整的章列表注册战役。
const CHAPTER_IDS = Object.freeze([
  'riddlesAndRain', 'deadHeat', 'sanguineShadows', 'dealingsInTheDark', 'dancingMad',
  'onThinIce', 'dogsOfWar', 'shadesOfSuffering', 'withoutATrace', 'congressOfTheKeys',
])

/** 章 id（= 目录章节 id = 关卡 id；顺序同 CampaignSteps.hs 的 ScenarioStep 顺序）。 */
export const scenarioModuleIds = CHAPTER_IDS

const entries = []
const missing = []
const errors = Object.create(null)

for (const id of CHAPTER_IDS) {
  try {
    // 动态导入：缺模块时只记错误，不中断整份汇总（模块不存在 vs 模块内部报错要区分）。
    // eslint-disable-next-line no-await-in-loop
    const module = await import(`./${id}/index.js`)
    entries.push(Object.freeze({ id, module, manifest: module.manifest, scenario: module.scenario,
      behavior: module.behavior, layout: module.layout }))
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') {
      throw new Error(`章节模块 ${id} 加载失败：${error?.message || error}`)
    }
    missing.push(id)
    errors[id] = String(error?.message || error)
  }
}

/** 已落盘的章节条目（`{ id, module, manifest, scenario, behavior, layout }`），按章 id 顺序。 */
export const scenarioEntries = Object.freeze(entries)
/** 章节 id → 模块命名空间（注册表直接消费；未落盘的章不在表里）。 */
export const scenariosById = Object.freeze(Object.fromEntries(entries.map(entry => [entry.id, entry.module])))
/** 章节 id → 关卡 manifest（P8 注册/账本读取）。 */
export const scenarioManifests = Object.freeze(Object.fromEntries(entries.map(entry => [entry.id, entry.manifest])))
/** 尚未落盘的章 id（注册路径必须为 0）。 */
export const missingScenarioIds = Object.freeze([...missing])
/** 缺章错误原文（账本/报告用）。 */
export const scenarioModuleErrors = Object.freeze({ ...errors })

/** 十章齐备校验（缺章即抛；注册/验收路径的唯一入口）。 */
export function requireAllScenarios () {
  if (missing.length) {
    throw new Error(`《绯红密钥》十章尚未齐备：缺少 ${missing.join('、')}（已落盘 ${entries.length}/${CHAPTER_IDS.length}）`)
  }
  return scenarioEntries
}
