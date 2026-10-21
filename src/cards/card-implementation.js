// 诡镇奇谈：卡牌版 · 卡牌实现的唯一读点（Phase 6 · 6e-1）
//
// 症状：`EFFECTS`（旧 DSL）既当行为来源，又兼着「这张卡实现了没有」的标记——
// `src/ai/ai-context.js` 把**整个 EFFECTS 条目**塞进 AI 上下文，`deckbuilding.js`
// 与 `card-catalog.js` 也直接读它。于是删一条纯登记条目会同时改变三处观测面，
// Phase 6 的 ③（EFFECTS → 0）就卡在「删不干净」上。
//
// 本模块把「实现」收敛成一个稳定形状，给所有读点用同一份答案：
//
//   implementationChannel(code) → 'descriptor' | 'legacy' | 'hybrid' | 'data' | 'none'
//   implementation(code)        → { code, channel, implemented }
//   implementationSummary(code) → 与通道无关的摘要（**不含原始条目对象**，纯 JSON）
//   legacyEntry(code)           → 迁移期唯一允许直接读 EFFECTS 原始条目的入口
//
// 三条约定：
//   1. 摘要按「能力 / 修正 / 规则字段」重建，两种通道产出同一形状——迁移一张卡时
//      摘要变化只发生在必要项上（能力种类、效果类型），不再照抄原始对象；
//   2. `data` 通道 = 行为由卡面数据与引擎通用规则实现（印刷承伤、光环、护身符…），
//      条目本身没有读点。这些卡号写在 `DATA_IMPLEMENTED_CODES`，删 EFFECTS 后仍算「已实现」；
//   3. 除本文件外，`src/` 里不再有 `EFFECTS[` 的直接读取（`play-condition.js` 等迁移期读点
//      逐步改为读 `legacyEntry()`，最终随 EFFECTS 清零一起删掉）。

import { EFFECTS } from './card-effects.js'
import { CARD_ABILITY_ENTRIES } from './card-abilities.js'

// 描述子条目的静态索引：**不依赖注册表**（注册发生在 engine.js 的模块初始化里）。
// 摘要只读这份静态数据，保证「账本先于引擎可用」，也避免读点在加载顺序上打架。
const ENTRY_BY_CODE = new Map(CARD_ABILITY_ENTRIES.map(entry => [entry.code, entry]))

// 数据即实现：卡面数据（生命/神智/特质/使用次数）+ 引擎通用规则已经覆盖行为，
// 旧 DSL 条目只是登记。删除条目后这些卡仍然「有实现」。
export const DATA_IMPLEMENTED_CODES = new Set([
  '01014', // 温蒂的护身符：打出的事件进牌库顶 —— 条目级 playedEventsToDeckTop
  '01072', // 皮大衣：无规则文本，印刷生命 2 作为承伤容量
  '01094', // 防弹衣：同上
  '01095', // 远古印记护身符：同上
  '01117', // 丽塔·钱德勒：光环 —— 条目级 auraWhileInPlay
])

// 旧 DSL 条目里「行为」载体的键；其余键都是条目级规则字段（fast / exileAfterPlay / …）。
const LEGACY_BEHAVIOR_KEYS = new Set([
  'event', 'skill', 'weakness', 'abilities', 'reactions', 'freeTriggers',
  'reaction', 'passive', 'engine', 'note', 'simplified', 'text',
])

// 只登记、不承载行为的键：`engine` 标记在 Phase 5/6 已经数据化，`note`/`simplified` 是说明。
const LEGACY_REGISTRATION_KEYS = new Set(['engine', 'note', 'simplified', 'text'])

const DYNAMIC = '<dynamic>'

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

// 效果类型清单（递归展开 sequence / chooseOne），用作摘要里的行为描述。
// 只保留类型名与结构，不含数值细节——数值以卡面文案（printedText）为准。
function effectTypes(effect) {
  if (!isPlainObject(effect)) return []
  const out = []
  if (typeof effect.type === 'string') out.push(effect.type)
  for (const key of ['effects', 'options']) {
    if (!Array.isArray(effect[key])) continue
    for (const item of effect[key]) out.push(...effectTypes(item && item.effect ? item.effect : item))
  }
  return out
}

function scopedValue(value) {
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(scopedValue)
  if (isPlainObject(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, scopedValue(value[key])]))
  return DYNAMIC
}

function costSummary(cost) {
  if (!isPlainObject(cost) || !Object.keys(cost).length) return null
  const out = {}
  for (const key of Object.keys(cost).sort()) {
    if (cost[key] === false || cost[key] == null) continue
    out[key] = scopedValue(cost[key])
  }
  return Object.keys(out).length ? out : null
}

function sortedObject(entries) {
  const out = {}
  for (const key of entries.map(item => item[0]).sort()) {
    out[key] = entries.find(item => item[0] === key)[1]
  }
  return out
}

// 描述子通道的能力摘要：种类 / 窗口 / 费用 / 上限 / 效果类型 / 关键字。
function descriptorAbilities(entry) {
  return (entry.abilities || []).map(descriptor => {
    const rules = []
    for (const key of ['fast', 'noOpportunityAttack', 'becomesAsset', 'exileAfterPlay', 'addToVictory', 'legacyReaction', 'duringOwnSkillTest', 'requiresNoClues']) {
      if (descriptor[key] === true) rules.push(key)
    }
    const trigger = descriptor.trigger == null ? [] : [].concat(descriptor.trigger)
    const cost = costSummary(descriptor.cost)
    for (const key of Object.keys(cost || {})) rules.push('cost:' + key)
    return {
      kind: descriptor.kind || 'action',
      trigger: trigger.length ? trigger : null,
      cost,
      limit: descriptor.limit || null,
      effects: effectTypes(descriptor.effect),
      rules,
      resolve: typeof descriptor.resolve === 'function' ? true : null,
      target: descriptor.target ? (descriptor.target.kind || null) : null,
    }
  })
}

// 旧 DSL 通道的能力摘要：把 event/reaction/abilities/weakness 摊成同一形状。
function legacyAbilities(legacy) {
  const out = []
  const reaction = isPlainObject(legacy.reaction) ? legacy.reaction : null
  const reactionRules = reaction
    ? Object.keys(reaction).sort().filter(key => key !== 'when').map(key => key + ':' + scopedValue(reaction[key]))
    : []
  if (isPlainObject(legacy.event)) {
    out.push({
      kind: 'played',
      trigger: reaction?.when ? [reaction.when] : null,
      cost: costSummary(legacy.cost),
      limit: legacy.limit || null,
      effects: effectTypes(legacy.event),
      rules: reactionRules,
      resolve: null,
      target: null,
    })
  }
  for (const ability of Array.isArray(legacy.abilities) ? legacy.abilities : []) {
    out.push({
      kind: 'action',
      trigger: null,
      cost: costSummary(ability.cost),
      limit: ability.limit || null,
      effects: effectTypes(ability.effect),
      rules: [],
      resolve: null,
      target: ability.target ? String(ability.target.kind || ability.target) : null,
    })
  }
  for (const reactionEntry of Array.isArray(legacy.reactions) ? legacy.reactions : []) {
    out.push({
      kind: 'reaction',
      trigger: reactionEntry.when ? [reactionEntry.when] : null,
      cost: costSummary(reactionEntry.cost),
      limit: reactionEntry.limit || null,
      effects: effectTypes(reactionEntry.effect),
      rules: [],
      resolve: null,
      target: null,
    })
  }
  if (isPlainObject(legacy.weakness)) {
    out.push({
      kind: 'weakness',
      trigger: null,
      cost: null,
      limit: null,
      effects: effectTypes(legacy.weakness),
      rules: [],
      resolve: null,
      target: null,
    })
  }
  return out
}

function descriptorRules(entry) {
  const rows = []
  for (const [key, value] of Object.entries(entry)) {
    if (['code', 'name', 'kind', 'scope', 'text', 'abilities', 'modifiers', 'elderSign',
      'source', 'playCondition', 'simplified', 'note', 'uses', 'usesType', 'passive',
      'reactions', 'freeTriggers', 'engine', 'registered', 'discardWhenEmpty'].includes(key)) continue
    if (value === null || value === false || value === undefined) continue
    if (Array.isArray(value) && !value.length) continue
    if (isPlainObject(value) && !Object.keys(value).length) continue
    rows.push([key, scopedValue(value)])
  }
  return rows
}
function legacyRules(legacy) {
  const rows = []
  for (const [key, value] of Object.entries(legacy)) {
    if (LEGACY_BEHAVIOR_KEYS.has(key)) continue
    if (value === false || value == null) continue
    if (Array.isArray(value) && !value.length) continue
    if (isPlainObject(value) && !Object.keys(value).length) continue
    rows.push([key, scopedValue(value)])
  }
  return rows
}

// 「纯登记条目」= 只有 engine / note / simplified 这类标记，没有行为载体也没有规则字段。
// 这类条目（printedSoak / wendyAmulet / litaAura）是 ③ 的删除对象：删掉它不改变实现判定。
export function isRegistrationOnly(legacy) {
  if (!legacy) return false
  return Object.keys(legacy).every(key => LEGACY_REGISTRATION_KEYS.has(key))
}

// 与通道无关的「实现」判定。
export function implementationChannel(code) {
  const legacy = Object.hasOwn(EFFECTS, code) ? EFFECTS[code] : null
  const behavior = legacy && !isRegistrationOnly(legacy) ? legacy : null
  const entry = ENTRY_BY_CODE.get(code) || null
  if (entry && behavior) return 'hybrid'
  if (entry) return 'descriptor'
  if (behavior) return 'legacy'
  // 纯登记条目（含空对象占位）与「数据即实现」的卡：行为在卡面数据与引擎通用规则里。
  if (legacy) return 'data'
  return DATA_IMPLEMENTED_CODES.has(code) ? 'data' : 'none'
}

export function implementation(code) {
  const channel = implementationChannel(code)
  return { code, channel, implemented: channel !== 'none' }
}

// 迁移期唯一允许读旧 DSL 原始条目的入口（未来 EFFECTS 清零时只删这一个函数）。
export function legacyEntry(code) {
  return Object.hasOwn(EFFECTS, code) ? EFFECTS[code] : null
}

// 旧 DSL 条目上「某张卡打出/揭示时的那份数据体」，供迁移期的效果解释器使用。
export function legacyEffectFor(code, slot = 'event') {
  const legacy = legacyEntry(code)
  return legacy && isPlainObject(legacy[slot]) ? legacy[slot] : null
}

/**
 * 稳定摘要：AI 上下文与图鉴共用。形状与卡牌走哪条通道无关，纯 JSON、键序固定。
 * @param {string} code 卡号
 * @returns {object|null} 没有实现时返回 null
 */
export function implementationSummary(code) {
  const channel = implementationChannel(code)
  if (channel === 'none') return null
  const entry = ENTRY_BY_CODE.get(code) || null
  const raw = legacyEntry(code)
  const legacy = raw && !isRegistrationOnly(raw) ? raw : null
  const abilities = entry
    ? descriptorAbilities(entry)
    : legacyAbilities(legacy || {})
  const rules = sortedObject([
    ...legacyRules(legacy || {}),
    ...(entry ? descriptorRules(entry) : []),
  ])
  const playCondition = (entry?.playCondition || []).map(item => item.message).filter(Boolean)
  const uses = (entry && Number.isFinite(entry.uses) ? { count: entry.uses, type: entry.usesType || null } : null)
    || (legacy && Number.isFinite(legacy.uses) ? { count: legacy.uses, type: legacy.usesType || null } : null)
  return {
    channel,
    abilities,
    modifiers: (entry?.modifiers || []).map(modifier => ({
      target: typeof modifier.target === 'string' ? modifier.target : DYNAMIC,
      amount: typeof modifier.amount === 'number' ? modifier.amount : DYNAMIC,
    })),
    playCondition: playCondition.length ? playCondition : null,
    elderSign: Boolean(entry?.elderSign || legacy?.elderSign),
    uses,
    rules: Object.keys(rules).length ? rules : null,
    simplified: Boolean(entry?.simplified || raw?.simplified),
    note: entry?.note || raw?.note || null,
  }
}
