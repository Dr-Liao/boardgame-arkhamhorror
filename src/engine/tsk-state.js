// 八循环《绯红密钥》（The Scarlet Keys）P2 通用原语的可选状态容器。
//
// 设计口径与 TIC/TDE/EotE 相同：**不提升顶层存档 schema 版本**，把本循环的新状态放进既有的
// 可选 JSON 扩展里，并带 `version`：
//   · 战役级（跨关持久）：`state.campaign.tsk = { version: 1, keys?, map?, statusReports?,
//     coterie?, erased?, dossiers?, sideStories?, customizations?, invalidCards? }`
//   · 场景级（单关/单章节）：`state.scenarioFlags.mechanics.tsk = { version: 1, concealed?,
//     hollows?, otherworld?, crossSeat?, doomDiscount?, patrol? }`
//
// 读点从不初始化容器（create=false 返回 null），旧存档/旧战役不会因为加载本模块多出字段；
// 只有真正使用原语的 TSK 内容才会创建。容器级形状由本文件校验，子记录形状由各原语模块的
// `validateTskXxx` 负责，`save-migration.js#migrateState` 统一调用 `validateTskState`。
//
// 以后若要改变扩展形状（字段改名/语义变化），必须显式提升 `version` 并登记迁移，
// 不能在旧数据上静默补解释。
import { mechanicState } from './mechanic-state.js'

export const TSK_STATE_VERSION = 1
export const TSK_CAMPAIGN_KEYS = Object.freeze([
  'keys', 'map', 'statusReports', 'coterie', 'erased', 'dossiers', 'sideStories', 'customizations', 'invalidCards',
])
export const TSK_SCENARIO_KEYS = Object.freeze([
  'concealed', 'hollows', 'otherworld', 'crossSeat', 'doomDiscount', 'patrol', 'evidence',
])

export function assertTskObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} 必须是对象`)
  return value
}

export function assertTskFields(value, allowed, label) {
  assertTskObject(value, label)
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new TypeError(`${label} 未知字段 ${key}`)
  return value
}

/** 战役级容器；`create=true` 时才初始化，返回 `{ version, ... }`。 */
export function tskCampaignState(state, create = false) {
  const existing = state?.campaign?.tsk ?? null
  if (!create) return existing
  if (!state.campaign || typeof state.campaign !== 'object') throw new TypeError('战役状态缺失，无法创建 TSK 扩展')
  return state.campaign.tsk ||= { version: TSK_STATE_VERSION }
}

/** 场景级容器；跟随 `scenarioFlags.mechanics` 可选扩展，不 initialize。 */
export function tskScenarioState(state, create = false) {
  const existing = mechanicState(state)?.tsk ?? null
  if (!create) return existing
  return mechanicState(state, true).tsk ||= { version: TSK_STATE_VERSION }
}

/** 容器级校验（存在才校验；旧存档缺少整个扩展时零成本放行）。 */
export function validateTskContainers(state) {
  const campaign = tskCampaignState(state)
  if (campaign) {
    assertTskFields(campaign, ['version', ...TSK_CAMPAIGN_KEYS], '战役 TSK 扩展')
    if (campaign.version !== TSK_STATE_VERSION) throw new TypeError(`不支持的 TSK 战役扩展版本 ${campaign.version}`)
  }
  const scenario = tskScenarioState(state)
  if (scenario) {
    assertTskFields(scenario, ['version', ...TSK_SCENARIO_KEYS], '场景 TSK 扩展')
    if (scenario.version !== TSK_STATE_VERSION) throw new TypeError(`不支持的 TSK 场景扩展版本 ${scenario.version}`)
  }
}

/** 期望存在时的通用非负整数数组读取（供各原语 validator 复用）。 */
export function assertCodeList(value, label) {
  if (!Array.isArray(value) || value.some(code => typeof code !== 'string' || !code)) throw new TypeError(`${label} 必须是卡号数组`)
  return value
}

export function assertSeat(state, seat, label = '座位') {
  if (!Number.isSafeInteger(seat) || !state?.investigators?.[seat]) throw new RangeError(`${label} 无效`)
  return state.investigators[seat]
}
