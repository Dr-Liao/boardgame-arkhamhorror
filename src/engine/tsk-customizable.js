// 八循环《绯红密钥》P2 原语：定制升级卡（Customizable）。
//
// 覆盖 P1 原语目录：
//   · new.customizableCard    —— 定制选项定义（勾选格数 = 该项经验；每格 1 XP；等级 = ceil(格数/2)）
//   · new.customizationUpgrade—— 构筑期/关间升级的勾选校验与经验结算
//   · extend.costDiscount     —— 已勾选条目对打出费用的修正（经 modifiers.js 的外部修正源读点）
//
// 数据口径（P1 已逐卡记录 customizationText）：
//   · 选项由内容层注册：`registerCustomizationOptions({ [code]: [{ name, checks, text, implemented? }] })`；
//     引擎不解析卡文、不认卡号列表，只保存「该卡有哪些勾选格」的契约。
//     2026-11-16 P2-3：`implemented: false` 表示该勾选格的行为尚未接读点（近似条目）——面板仍展示
//     卡面文本，但**不生成可购买候选**、dispatch 拒绝勾选，避免玩家花 XP 买到无效果选项。
//   · 勾选状态存 `campaign.tsk.customizations = { version: 1, bySeat: { [seat]: { [code]: number[] } } }`
//     （值 = 已勾选选项下标数组；同一选项的多次勾选用重复下标表达）。
//   · 等级 = ceil(勾选总格数 / 2)；每个勾选格消耗 1 点经验（exceptional 卡按规则双倍经验由调用方传入 costPerCheck）。
//   · 运行时效果通过 `registerCustomizationEffects({ [code]: { playCost?(checkedCounts) } })` 注册；
//     modifiers.js#playCostDelta 读取本模块的 `customizationPlayCostDelta`（外部修正源）。
//
// 读点从不初始化容器；只有 campaign.tsk.customizations 存在时才校验。
import { assertTskFields, assertTskObject, tskCampaignState } from './tsk-state.js'
import { ALL_CARDS } from '../cards/cards-data.js'

export const CUSTOMIZATION_STATE_VERSION = 1

const optionRegistry = new Map()
const effectRegistry = new Map()
const choiceRegistry = new Map()
const choiceCatalogs = new Map()
const isTomeOrSpellAsset = card => card?.type === 'asset'
  && card.traits?.some(trait => trait === 'Tome' || trait === 'Spell')

export function registerCustomizationChoices(code, spec) {
  if (!['assetTitle', 'encounterTrait', 'playerTrait', 'skill', 'slot'].includes(spec.kind) || !Number.isSafeInteger(spec.base) || spec.base < 0) {
    throw new TypeError(`卡 ${code} 的定制选择声明无效`)
  }
  for (const [index, count] of Object.entries(spec.options || {})) {
    if (!optionRegistry.get(code)?.[index] || !Number.isSafeInteger(count) || count < 1) {
      throw new TypeError(`卡 ${code} 的第 ${index} 项定制选择声明无效`)
    }
  }
  choiceRegistry.set(code, { kind: spec.kind, base: spec.base, options: { ...spec.options } })
}

function choiceCatalog(kind) {
  if (choiceCatalogs.has(kind)) return choiceCatalogs.get(kind)
  const choices = new Map()
  if (kind === 'slot') {
    choices.set('arcane', { value: 'arcane', name: 'Arcane', nameZh: '法术槽' })
    choices.set('ally', { value: 'ally', name: 'Ally', nameZh: '盟友槽' })
  }
  if (kind === 'skill') {
    for (const [key, nameZh] of Object.entries({ willpower: '意志', intellect: '智力', combat: '战斗', agility: '敏捷' })) {
      choices.set(key, { value: key, name: key, nameZh })
    }
  }
  for (const card of Object.values(ALL_CARDS)) {
    if (kind === 'assetTitle' && isTomeOrSpellAsset(card)) {
      if (!choices.has(card.name)) choices.set(card.name, { value: card.name, name: card.name, nameZh: card.nameZh })
    }
    if ((kind === 'encounterTrait' && card.encounterCode)
      || (kind === 'playerTrait' && !card.encounterCode && ['asset', 'event', 'skill', 'investigator'].includes(card.type))) {
      for (const trait of card.traits || []) {
        const value = trait.toLowerCase()
        if (!choices.has(value)) choices.set(value, { value, name: trait })
      }
    }
  }
  const catalog = [...choices.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'))
  choiceCatalogs.set(kind, catalog)
  return catalog
}

const choiceKey = optionIndex => optionIndex == null ? 'base' : String(optionIndex)
const recordedChoices = (state, seat, code) => customizationState(state)?.choicesBySeat?.[seat]?.[code] || {}

export function customizationChoiceCount(code, optionIndex) {
  const spec = choiceRegistry.get(code)
  if (!spec) return 0
  if (optionIndex == null) return spec.base
  return Object.hasOwn(spec.options, optionIndex) ? spec.options[optionIndex] : 0
}

export function customizationChoiceValues(state, seat, code) {
  const { base = [], ...options } = recordedChoices(state, seat, code)
  return [...base, ...Object.entries(options).flatMap(([key, values]) =>
    customizationOptionFullyChecked(state, seat, code, Number(key)) ? values : [])]
}

export function customizationChoiceSetup(state, seat, code, deck) {
  const spec = choiceRegistry.get(code)
  if (!spec) return null
  const allChoices = choiceCatalog(spec.kind)
  let catalog = allChoices
  if (spec.kind === 'assetTitle') {
    const titles = new Set(deck.map(code => ALL_CARDS[code]).filter(isTomeOrSpellAsset).map(card => card.name))
    catalog = allChoices.filter(choice => titles.has(choice.value))
  }
  const values = customizationChoiceValues(state, seat, code)
  return { kind: spec.kind, base: spec.base, options: spec.options,
    recorded: recordedChoices(state, seat, code), values, catalog,
    selected: values.map(value => allChoices.find(choice => choice.value === value)).filter(Boolean) }
}

export function validateCustomizationChoices(state, seat, code, optionIndex, values) {
  const spec = choiceRegistry.get(code)
  const count = customizationChoiceCount(code, optionIndex)
  if (!count) {
    if (values != null) throw new Error('该定制步骤无需选择')
    return
  }
  if (!Array.isArray(values) || values.length !== count || new Set(values).size !== count) {
    throw new Error(`请选择 ${count} 个不同的${spec.kind === 'assetTitle' ? '支援名称' : '特性'}`)
  }
  const key = choiceKey(optionIndex)
  const recorded = recordedChoices(state, seat, code)
  if (recorded[key]) throw new Error('该定制选择已经记录')
  const existing = new Set(Object.values(recorded).flat())
  const allowed = new Set(choiceCatalog(spec.kind).map(item => item.value))
  if (values.some(value => existing.has(value) || !allowed.has(value))) throw new Error('定制选择无效或重复')
}

export function recordCustomizationChoices(state, seat, code, optionIndex, values) {
  const container = customizationState(state, true)
  const table = (container.choicesBySeat ||= {})[seat] ||= {}
  const groups = table[code] ||= {}
  groups[choiceKey(optionIndex)] = [...values]
}

/** 注册一张卡的定制选项（内容层 P6 使用；重复注册同卡号拒绝）。 */
export function registerCustomizationOptions(table) {
  assertTskObject(table, '定制选项表')
  for (const [code, options] of Object.entries(table)) {
    if (optionRegistry.has(code)) throw new Error(`卡 ${code} 的定制选项已注册`)
    if (!Array.isArray(options) || !options.length) throw new TypeError(`卡 ${code} 的定制选项必须是非空数组`)
    optionRegistry.set(code, options.map(option => {
      assertTskObject(option, '定制选项')
      assertTskFields(option, ['name', 'checks', 'text', 'implemented'], '定制选项')
      if (typeof option.name !== 'string' || !option.name) throw new TypeError('定制选项名无效')
      if (!Number.isSafeInteger(option.checks) || option.checks < 1) throw new TypeError('定制选项勾选格数必须是正整数')
      if (option.implemented != null && typeof option.implemented !== 'boolean') throw new TypeError('定制选项 implemented 必须是布尔值')
      return Object.freeze({
        name: option.name, checks: option.checks, text: option.text ?? null,
        implemented: option.implemented !== false,
      })
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
      if (!['playCost', 'fast', 'playUnderAnyAtLocation', 'slots', 'deckLimit'].includes(key)) throw new TypeError(`未知定制效果字段 ${key}`)
      if (typeof effects[key] !== 'function') throw new TypeError('定制效果必须是函数')
    }
    effectRegistry.set(code, { ...effects })
  }
  return effectRegistry.size
}

export function customizationEffect(state, seat, code, key) {
  return effectRegistry.get(code)?.[key]?.(customizationChecked(state, seat, code), state, seat) ?? null
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

/**
 * 2026-11-16 P2-3：某一张定制卡的某个选项「已勾选格数」的权威读点。
 * 契约：勾选是逐格累计的，前缀合法但**只有勾满该选项的 checks 格，该选项的效果才生效**。
 * 卡条目不得自己 `includes(index)` 判定（会把「勾 1 格」误当成「整项已解锁」）。
 * 不存在容器 / 未勾选 / 未注册时返回 0（纯读，不初始化容器）。
 */
export function customizationOptionCheckedCount(state, seat, code, optionIndex) {
  if (!Number.isSafeInteger(seat) || !Number.isSafeInteger(optionIndex) || optionIndex < 0) return 0
  const container = customizationState(state)
  const checked = container?.bySeat?.[seat]?.[code]
  if (!Array.isArray(checked)) return 0
  return checked.filter(index => index === optionIndex).length
}

/** 2026-11-16 P2-3：该选项是否已勾满（勾满才生效；未注册的卡一律 false）。 */
export function customizationOptionFullyChecked(state, seat, code, optionIndex) {
  const options = optionRegistry.get(code)
  if (!options || !Number.isSafeInteger(optionIndex) || optionIndex >= options.length) return false
  return customizationOptionCheckedCount(state, seat, code, optionIndex) >= options[optionIndex].checks
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
  assertTskFields(value, ['version', 'bySeat', 'choicesBySeat'], '定制卡状态')
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
  if (value.choicesBySeat != null) {
    assertTskObject(value.choicesBySeat, '定制选择座位表')
    for (const [seatKey, table] of Object.entries(value.choicesBySeat)) {
      if (String(Number(seatKey)) !== seatKey || !state.investigators?.[Number(seatKey)]) throw new TypeError('定制选择座位无效')
      assertTskObject(table, '定制选择卡表')
      for (const [code, groups] of Object.entries(table)) {
        assertTskObject(groups, '定制选择组')
        const spec = choiceRegistry.get(code)
        const allowed = spec && new Set(choiceCatalog(spec.kind).map(item => item.value))
        const seen = new Set()
        for (const [key, values] of Object.entries(groups)) {
          const count = customizationChoiceCount(code, key === 'base' ? null : key)
          if (!count || !Array.isArray(values) || values.length !== count) {
            throw new TypeError('定制选择存档数据无效')
          }
          for (const item of values) {
            if (!allowed.has(item) || seen.has(item)) throw new TypeError('定制选择存档数据无效')
            seen.add(item)
          }
        }
      }
    }
  }
  return true
}

/** 测试与审计读点：已注册的选项表大小/效果表大小。 */
export function customizationRegistrySize() {
  return { options: optionRegistry.size, effects: effectRegistry.size }
}
