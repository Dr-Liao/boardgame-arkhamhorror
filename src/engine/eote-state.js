// 七循环《地球边缘》通用原语的可选状态容器（P2）。
//
// 设计口径与 TIC/TDE 相同：**不提升顶层存档 schema 版本**，把本循环的新状态放进既有的
// 可选 JSON 扩展里，并带 `version`：
//   · 战役级（跨关持久）：`state.campaign.eote = { version: 1, partners?, seals?, memorials?,
//     supplies?, camp?, mirage?, disciplines? }`
//   · 场景级（单关/单章节）：`state.scenarioFlags.mechanics.eote = { version: 1, shelter?, tekeli?,
//     climb?, city?, facilities?, towerSeals?, deckTop?, crossSeat?, roundDistance? }`
//
// 读点从不初始化容器（`create=false` 返回 null），旧存档/旧战役不会因为加载本模块多出字段；
// 只有真正使用原语的 EotE 内容才会创建。容器级形状由本文件校验，子记录的形状由各原语模块的
// `validateEoteXxx` 负责，`save-migration.js#migrateState` 统一调用。
//
// 以后若要改变扩展形状（字段改名/语义变化），必须显式提升 `version` 并登记迁移，
// 不能在旧数据上静默补解释。
import { mechanicState } from './mechanic-state.js'

export const EOTE_STATE_VERSION = 1
export const EOTE_CAMPAIGN_KEYS = Object.freeze([
  'partners', 'seals', 'memorials', 'supplies', 'camp', 'mirage', 'disciplines',
])
export const EOTE_SCENARIO_KEYS = Object.freeze([
  'shelter', 'tekeli', 'climb', 'city', 'facilities', 'towerSeals', 'deckTop', 'crossSeat', 'roundDistance',
])

export function assertEoteObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} 必须是对象`)
  return value
}

export function assertEoteFields(value, allowed, label) {
  assertEoteObject(value, label)
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new TypeError(`${label} 未知字段 ${key}`)
  return value
}

/** 战役级容器；`create=true` 时才初始化，返回 `{ version, ... }`。 */
export function eoteCampaignState(state, create = false) {
  const existing = state?.campaign?.eote ?? null
  if (!create) return existing
  if (!state.campaign || typeof state.campaign !== 'object') throw new TypeError('战役状态缺失，无法创建 EotE 扩展')
  return state.campaign.eote ||= { version: EOTE_STATE_VERSION }
}

/** 场景级容器；跟随 `scenarioFlags.mechanics` 可选扩展，不 initialize。 */
export function eoteScenarioState(state, create = false) {
  const existing = mechanicState(state)?.eote ?? null
  if (!create) return existing
  return mechanicState(state, true).eote ||= { version: EOTE_STATE_VERSION }
}

export function validateEoteContainers(state) {
  const campaign = eoteCampaignState(state)
  if (campaign) {
    assertEoteFields(campaign, ['version', ...EOTE_CAMPAIGN_KEYS], '战役 EotE 扩展')
    if (campaign.version !== EOTE_STATE_VERSION) throw new TypeError(`不支持的 EotE 战役扩展版本 ${campaign.version}`)
  }
  const scenario = eoteScenarioState(state)
  if (scenario) {
    assertEoteFields(scenario, ['version', ...EOTE_SCENARIO_KEYS], '场景 EotE 扩展')
    if (scenario.version !== EOTE_STATE_VERSION) throw new TypeError(`不支持的 EotE 场景扩展版本 ${scenario.version}`)
  }
}
