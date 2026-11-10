// 八循环《绯红密钥》P2 原语：定制升级卡（Customizable）。
//
// 覆盖 P1 原语目录：
//   · new.customizableCard    —— 定制选项定义（勾选格数 = 该项经验；每格 1 XP；等级 = ceil(格数/2)）
//   · new.customizationUpgrade—— 构筑期/关间升级的勾选校验与经验结算
//   · extend.costDiscount     —— 已勾选条目对打出费用的修正（经 modifiers.js 的外部修正源读点）
//
// 数据口径（P1 已逐卡记录 customizationText）：
//   · 选项由内容层注册：`registerCustomizationOptions({ [code]: [{ name, checks, text }] })`；
//     引擎不解析卡文、不认卡号列表，只保存「该卡有哪些勾选格」的契约。
//   · 勾选状态存 `campaign.tsk.customizations = { version: 1, bySeat: { [seat]: { [code]: number[] } } }`
//     （值 = 已勾选选项下标数组；同一选项的多次勾选用重复下标表达）。
//   · 等级 = ceil(勾选总格数 / 2)；每个勾选格消耗 1 点经验（exceptional 卡按规则双倍经验由调用方传入 costPerCheck）。
//   · 运行时效果通过 `registerCustomizationEffects({ [code]: { playCost?(checkedCounts) } })` 注册；
//     modifiers.js#playCostDelta 读取本模块的 `customizationPlayCostDelta`（外部修正源）。
//
// 读点从不初始化容器；只有 campaign.tsk.customizations 存在时才校验。
import { assertTskFields, assertTskObject, tskCampaignState } from './tsk-state.js'

export const CUSTOMIZATION_STATE_VERSION = 1

const optionRegistry = new Map()
const effectRegistry = new Map()

/** 注册一张卡的定制选项（内容层 P6 使用；重复注册同卡号拒绝）。 */
export function registerCustomizationOptions(table) {
  assertTskObject(table, '定制选项表')
  for (const [code, options] of Object.entries(table)) {
    if (optionRegistry.has(code)) throw new Error(`卡 ${code} 的定制选项已注册`)
    if (!Array.isArray(options) || !options.length) throw new TypeError(`卡 ${code} 的定制选项必须是非空数组`)
    optionRegistry.set(code, options.map(option => {
      assertTskObject(option, '定制选项')
      assertTskFields(option, ['name', 'checks', 'text'], '定制选项')
      if (typeof option.name !== 'string' || !option.name) throw new TypeError('定制选项名无效')
      if (!Number.isSafeInteger(option.checks) || option.checks < 1) throw new TypeError('定制选项勾选格数必须是正整数')
      return Object.freeze({ name: option.name, checks: option.checks, text: option.text ?? null })
    }))
  }
  return optionRegistry.size
}

/** 已注册的定制选项（只读副本）；未注册返回 null。 */
export function customizationOptions(code) {
  const options = optionRegistry.get(code)
  return options ? options.map(option => ({ ...option })) : null
}

/** 某卡的勾选格总数（所有选项 checks 之和）。 */
export function customizationCheckboxCount(code) {
  const options = optionRegistry.get(code)
  if (!options) return 0
  return options.reduce((total, option) => total + option.checks, 0)
}

/** 注册运行时效果（费用修正等；内容层 P6 使用）。 */
export function registerCustomizationEffects(table) {
  assertTskObject(table, '定制效果表')
  for (const [code, effects] of Object.entries(table)) {
    assertTskObject(effects, '定制效果')
    for (const key of Object.keys(effects)) {
      if (!['playCost'].includes(key)) throw new TypeError(`未知定制效果字段 ${key}`)
      if (typeof effects[key] !== 'function') throw new TypeError('定制效果必须是函数')
    }
    effectRegistry.set(code, { ...effects })
  }
  return effectRegistry.size
}

function customizationState(state, create = false) {
  const campaign = tskCampaignState(state, create)
  if (!campaign) return null
  if (create) return campaign.customizations ||= { version: CUSTOMIZATION_STATE_VERSION, bySeat: {} }
  return campaign.customizations || null
}

/**
 * 校验一份勾选是否合法：选项必须属于该卡；每一项的下标必须被勾选「恰好 checks 次」才能生效？
 * 规则口径：勾选是逐格累计的，任何前缀都合法，但总格数不得超过该选项的 checks 与总格数。
 * 因此本函数校验「每个下滑标重复次数 <= 对应选项 checks 数」且总格数 <= 总格数上限。
 */
export function customizationCheckedError(code, checked) {
  if (!Array.isArray(checked) || checked.some(index => !Number.isSafeInteger(index) || index < 0)) throw new TypeError('定制勾选必须是正整数下标数组')
  const options = optionRegistry.get(code)
  if (!options) throw new RangeError(`卡 ${code} 没有注册定制选项`)
  const counts = new Map()
  for (const index of checked) {
    if (index >= options.length) throw new RangeError(`定制勾选下标 ${index} 越界`)
    counts.set(index, (counts.get(index) || 0) + 1)
  }
  for (const [index, count] of counts) {
    if (count > options[index].checks) throw new RangeError(`定制选项「${options[index].name}」最多勾选 ${options[index].checks} 格`)
  }
  return null
}

/** 勾选总格数。 */
export function customizationCheckedCount(checked) {
  return Array.isArray(checked) ? checked.length : 0
}

/** 等级 = ceil(勾选总格数 / 2)（Customizable 规则；未勾选为 0 级）。 */
export function customizationLevel(checked) {
  return Math.ceil(customizationCheckedCount(checked) / 2)
}

/** 升级经验消耗 = 勾选总格数 × 每格经验（exceptional 卡由调用方传 2）。 */
export function customizationXpCost(checked, { costPerCheck = 1 } = {}) {
  if (!Number.isSafeInteger(costPerCheck) || costPerCheck < 1) throw new TypeError('每格经验必须是正整数')
  return customizationCheckedCount(checked) * costPerCheck
}

/**
 * 升级一次定制卡：校验勾选、扣经验、写入战役容器。
 *   · availableXp 不足时拒绝且不写入；
 *   · unchecked 只能增加不能减少（关间升级累积；降级不是合法升级），除非 options.reset=true（新战役/重开）。
 * 返回 { code, checked, level, xpCost, availableXp }。
 */
export function upgradeCustomization(state, { seat, code, checked, availableXp, costPerCheck = 1, reset = false } = {}) {
  if (!Number.isSafeInteger(seat) || !state.investigators?.[seat]) throw new TypeError('定制卡座位无效')
  customizationCheckedError(code, checked)
  const container = customizationState(state, true)
  container.bySeat[seat] ||= {}
  const previous = container.bySeat[seat][code] || []
  // 升级只能增加勾选：旧勾选（多重集）必须仍是新勾选的子集；新增格数按每格经验结算。
  const remaining = [...checked]
  for (const index of previous) {
    const at = remaining.indexOf(index)
    if (at < 0) throw new Error(`升级不能撤销已勾选的选项 ${index}${reset ? '（reset 请传 reset=true）' : ''}`)
    remaining.splice(at, 1)
  }
  const addedChecks = reset ? checked.length : remaining.length
  const xpCost = customizationXpCost(new Array(addedChecks).fill(0), { costPerCheck })
  if (!Number.isSafeInteger(availableXp) || availableXp < 0) throw new TypeError('可用经验无效')
  if (xpCost > availableXp) throw new Error(`经验不足：需要 ${xpCost}，只有 ${availableXp}`)
  container.bySeat[seat][code] = [...checked]
  return { code, checked: [...checked], level: customizationLevel(checked), xpCost, availableXp: availableXp - xpCost }
}

/** 某座位某卡的已勾选下标（只读副本）。 */
export function customizationChecked(state, seat, code) {
  return [...(customizationState(state)?.bySeat?.[seat]?.[code] || [])]
}

/** 某座位全部定制卡的勾选表（只读副本）。 */
export function customizationsOfSeat(state, seat) {
  const table = customizationState(state)?.bySeat?.[seat] || {}
  return Object.fromEntries(Object.entries(table).map(([code, checked]) => [code, [...checked]]))
}

/**
 * extend.costDiscount 读点：已勾选条目对打出费用的修正。
 * 内容层注册的 `playCost(checkedCounts)` 返回数值修正（负数=减费）；未注册返回 0。
 */
export function customizationPlayCostDelta(seat, code, checked = null) {
  const effects = effectRegistry.get(code)
  if (!effects?.playCost) return 0
  const checkedCounts = checked || []
  const delta = effects.playCost(checkedCounts)
  return Number.isFinite(delta) ? delta : 0
}

/** 读档校验：定制容器形状（存在才校验；座位/下标必须有效）。 */
export function validateTskCustomizations(state, value = customizationState(state)) {
  if (value == null) return true
  assertTskFields(value, ['version', 'bySeat'], '定制卡状态')
  if (value.version !== CUSTOMIZATION_STATE_VERSION) throw new TypeError(`不支持的定制卡版本 ${value.version}`)
  assertTskObject(value.bySeat, '定制卡座位表')
  for (const [seatKey, table] of Object.entries(value.bySeat)) {
    const seat = Number(seatKey)
    if (!Number.isSafeInteger(seat) || String(seat) !== seatKey || !state.investigators?.[seat]) throw new TypeError('定制卡座位无效')
    assertTskObject(table, '定制卡表')
    for (const [code, checked] of Object.entries(table)) {
      if (typeof code !== 'string' || !code) throw new TypeError('定制卡卡号无效')
      if (optionRegistry.has(code)) customizationCheckedError(code, checked)
      else if (!Array.isArray(checked) || checked.some(index => !Number.isSafeInteger(index) || index < 0)) throw new TypeError('定制卡勾选无效')
    }
  }
  return true
}

/** 测试与审计读点：已注册的选项表大小/效果表大小。 */
export function customizationRegistrySize() {
  return { options: optionRegistry.size, effects: effectRegistry.size }
}
