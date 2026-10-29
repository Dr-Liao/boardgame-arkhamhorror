// Shared by initial construction and upgrades. Content supplies declarative
// rules; clients may supply only card codes, never rules or costs.
// 第 127 轮：敦威治调查员集合与黛西的「命运」限制改由 web/ui-cards.js 声明。
//
// 性能（2026-10-24 P1 热点修复）：构筑规则校验在 legalMoves / 升级界面里是热路径——
// 旧实现对每次 deckRules() 都 structuredClone，而 validateDeckRules 会在「每张牌 × 每个替换候选」
// 的循环里反复调用它；profile 显示一次升级枚举能把它调用上百万次（structuredClone 占 60%+ CPU）。
// 现在：
//   - deckRules 按调查员对象身份缓存（registerDeckRules 时 epoch 失效），返回冻结对象共享读取；
//   - 规则上的正则/未知键检查、卡面上的 text 特征与 printed uses、调查员特质小写表都用 WeakMap 缓存；
//   - validateDeckRules 一次取出排除式规则，避免每张牌重新构建。
// 语义不变：缓存键含调查员对象身份与 epoch，卡牌仍按传入 cards 映射逐次读取。
import { UI_CARDS } from './ui-cards.js'
import { t } from './i18n.js'

const extensions = new Map()
let rulesEpoch = 0
const rulesCache = new WeakMap() // investigator object -> { epoch, rules }
export function registerDeckRules(investigatorCode, rules) {
  if (!Number.isSafeInteger(rules.size) || rules.size < 1 || !Array.isArray(rules.options)) throw new Error(t('misc.deckRules.invalid'))
  for (const option of rules.options) {
    if (option.limit != null && (!Number.isSafeInteger(option.limit) || option.limit < 0)) throw new Error(t('misc.deckRules.limit'))
    if (option.level && (!Number.isSafeInteger(option.level.min ?? 0) || !Number.isSafeInteger(option.level.max ?? 5) || (option.level.min ?? 0) < 0 || (option.level.max ?? 5) < (option.level.min ?? 0))) throw new Error(t('misc.deckRules.levelRange'))
  }
  extensions.set(investigatorCode, structuredClone(rules))
  rulesEpoch++ // 新规则注册后让所有缓存失效（WeakMap 条目靠 epoch 比对淘汰）
}
function freezeDeep(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const key of Object.keys(value)) freezeDeep(value[key])
  }
  return value
}
export function deckRules(investigator) {
  const cached = rulesCache.get(investigator)
  if (cached && cached.epoch === rulesEpoch) return cached.rules
  const { dunwichInvestigators, noFortuneInvestigator } = UI_CARDS.deckRules
  const dunwich = dunwichInvestigators.includes(investigator.code)
  const options = dunwich ? [
    { factions: [investigator.klass, 'neutral'], level: { min: 0, max: 5 } },
    { level: { min: 0, max: 0 }, limit: 5,
      ...(investigator.code === noFortuneInvestigator ? { not: { traits: ['Fortune'] } } : {}) },
  ] : structuredClone(investigator.deckOptions || [])
  const rules = freezeDeep({
    size: investigator.deckRequirements?.size,
    options,
    signatureCards: structuredClone(investigator.deckRequirements?.signatureCards || []),
    random: structuredClone(investigator.deckRequirements?.random || []),
    ...(extensions.get(investigator.code) || {}),
  })
  rulesCache.set(investigator, { epoch: rulesEpoch, rules })
  return rules
}
const lower = value => String(value).toLowerCase().replace(/\.$/, '')
// 第 5 步 M1 调查员批次（P6）：构筑标签的三种印刷写法。
//   uc = 带「使用（充能）」、hh = 能治愈恐惧、st = [[法术]]；
// 卡表用 tag + text（正则）描述「带有『治愈……恐惧』字样的卡牌」这类构筑选项。
const KNOWN_DECK_TAGS = Object.freeze(['uc', 'hh', 'st'])
const HEALS_HORROR = /heals? .*horror|治愈[^。\n]*恐惧|治癒[^。\n]*恐懼/i
const SPELL_TEXT = /\[\[spell\]\]/i
const PRINTED_USES = /Uses\s*\([^)]*?\b([A-Za-z]+)\s*\)/gi

// 卡面派生信息缓存：构筑校验只读卡牌的 text/traits/uses，按卡牌对象身份缓存。
const cardInfoCache = new WeakMap()
function cardInfo(card) {
  const cached = cardInfoCache.get(card)
  if (cached) return cached
  const texts = [card.text, card.textZh].filter(Boolean).map(text => String(text))
  const traits = (card.traits || []).map(lower)
  const printedUses = [
    card.usesType,
    ...(Array.isArray(card.uses) ? card.uses : []),
    ...texts.flatMap(text => [...text.matchAll(PRINTED_USES)].map(match => match[1])),
  ].filter(Boolean).map(lower)
  const info = {
    texts,
    traits,
    printedUses,
    factions: card.factions || [card.klass, card.klass2, card.klass3].filter(Boolean),
    healsHorror: texts.some(text => HEALS_HORROR.test(text)),
    isSpell: traits.includes('spell') || texts.some(text => SPELL_TEXT.test(text)),
  }
  cardInfoCache.set(card, info)
  return info
}

const investigatorInfoCache = new WeakMap()
function investigatorTraits(investigator) {
  const cached = investigatorInfoCache.get(investigator)
  if (cached) return cached
  const traits = (investigator.traits || []).map(lower)
  investigatorInfoCache.set(investigator, traits)
  return traits
}

const KNOWN_RULE_KEYS = new Set(['factions', 'faction', 'level', 'types', 'traits', 'trait', 'uses', 'tag',
  'atleast', 'error', 'limit', 'not', 'codes', 'investigatorTraits', 'text',
  // P6（食梦者）：第五循环的卡表用 `faction_select` 表示「副职业可选范围」、用 `type`
  // （单数）表示「只有事件/技能」。两者都翻成同一条允许项（factions + types），
  // 让 `limit` 的副职业配额（10 张）继续由 validateDeckRules 的容量分配统一执行；
  // `name` 是展示用标签，不参与匹配。`deck_size_select` / `option_select` 仍按未知键处理。
  'faction_select', 'type', 'name'])
// 规则对象（来自冻结的构筑规则，或临时的优惠 match 对象）上的正则/未知键检查缓存。
const ruleInfoCache = new WeakMap()
function ruleInfo(rule) {
  const cached = ruleInfoCache.get(rule)
  if (cached) return cached
  const info = { known: Object.keys(rule).every(key => KNOWN_RULE_KEYS.has(key)), patterns: null }
  if (rule.text?.length) {
    const sources = Array.isArray(rule.text) ? rule.text : [rule.text]
    info.patterns = sources
      .map(source => { try { return new RegExp(source, 'i') } catch { return null } })
      .filter(Boolean)
  }
  ruleInfoCache.set(rule, info)
  return info
}

// 排除式规则（`not: true`）的匹配体：从冻结规则里预先拆出，validateDeckRules 每张牌直接复用。
const exclusionRulesCache = new WeakMap()
function exclusionRulesOf(rules) {
  const cached = exclusionRulesCache.get(rules)
  if (cached) return cached
  const rest = rules.options
    .filter(rule => rule.not === true)
    .map(rule => { const { not, ...body } = rule; return freezeDeep(body) })
  exclusionRulesCache.set(rules, rest)
  return rest
}
// 「额外限制：无等级 1-5 的[[武器]]卡牌」这类 `not: true` 规则是**排除项**，不是允许项：
// 其余字段命中即整张牌不能进牌组（与 `not: {…}` 的否定式允许项互不冲突）。
export function optionExcluded(investigator, card) {
  for (const rest of exclusionRulesOf(deckRules(investigator))) {
    if (matchesCardRule(card, rest, investigator)) return true
  }
  return false
}
export function matchesCardRule(card, rule, investigator) {
  if (investigator.code === UI_CARDS.deckRules.noFortuneInvestigator
    && (card.traits || []).some(trait => lower(trait) === 'fortune')) return false
  const info = ruleInfo(rule)
  if (!info.known) return false
  // 「牌组张数选择」这类选项不是卡牌许可：它在构筑时由 deckRules.size 表达，这里不匹配任何卡。
  if (rule.deck_size_select) return false
  if (rule.not && typeof rule.not === 'object' && matchesCardRule(card, rule.not, investigator)) return false
  const cardValues = cardInfo(card)
  if (info.patterns) {
    if (!info.patterns.some(pattern => cardValues.texts.some(text => pattern.test(text)))) return false
  }
  const allowed = rule.factions || rule.faction || rule.faction_select
  if (allowed?.length && !allowed.some(faction => cardValues.factions.includes(faction))) return false
  const allowedTypes = rule.types || rule.type
  if (allowedTypes?.length && !allowedTypes.includes(card.type)) return false
  if (rule.types?.length && !rule.types.includes(card.type)) return false
  if (rule.codes?.length && !rule.codes.includes(card.code)) return false
  const requiredTraits = rule.traits || rule.trait
  if (requiredTraits?.length && !requiredTraits.some(trait => cardValues.traits.includes(lower(trait)))) return false
  if (rule.uses?.length && !rule.uses.map(lower).some(use => cardValues.printedUses.includes(use))) return false
  if (rule.tag?.length) {
    const tags = rule.tag.map(lower)
    if (tags.some(tag => !KNOWN_DECK_TAGS.includes(tag))) return false
    if (tags.includes('uc') && !cardValues.printedUses.some(use => ['charge', 'charges'].includes(use))) return false
    if (tags.includes('hh') && !cardValues.healsHorror) return false
    if (tags.includes('st') && !cardValues.isSpell) return false
  }
  if (rule.investigatorTraits?.length
    && !rule.investigatorTraits.some(trait => investigatorTraits(investigator).includes(lower(trait)))) return false
  const xp = card.xp || 0
  if (rule.level && (xp < (rule.level.min || 0) || xp > (rule.level.max ?? 5))) return false
  if (card.requiredInvestigatorTraits?.length
    && !card.requiredInvestigatorTraits.some(trait => investigatorTraits(investigator).includes(lower(trait)))) return false
  return true
}
export function deckCardLimit(card) {
  let limit = card.deckLimit ?? (card.myriad ? 3 : 2)
  // 卡面「每位调查员仅限 1 张」是构筑限制，卡表 deckLimit 未必同步。
  if (/Limit 1 per investigator/i.test(card.text || '')) limit = Math.min(limit, 1)
  return Number.isSafeInteger(limit) && limit > 0 ? (card.exceptional ? Math.min(1, limit) : limit) : 0
}
export function validateDeckRules(investigator, codes, cards, { partial = false } = {}) {
  const rules = deckRules(investigator)
  const errors = []
  const ordinary = codes.map(code => cards[code]).filter(card => card && !card.signatureFor && !card.subtype && !card.story)
  for (const code of codes) if (!cards[code]) errors.push(t('misc.deck.unknownCard', { code }))
  // 排除式构筑限制（`not: true`）：命中的卡不能进牌组，且不受其它允许项豁免。
  const exclusionRules = exclusionRulesOf(rules)
  for (const card of ordinary) {
    if (exclusionRules.some(rest => matchesCardRule(card, rest, investigator))) errors.push(t('misc.deck.excluded', { name: card.name || card.code }))
  }
  const counted = ordinary.filter(card => !card.permanent && !card.ignoreDeckLimit)
  if ((!partial && counted.length !== rules.size) || counted.length > rules.size) errors.push(t('misc.deck.size', { size: rules.size, count: counted.length }))
  const names = new Map()
  for (const card of ordinary) {
    const group = names.get(card.name || card.code) || []
    group.push(card); names.set(card.name || card.code, group)
  }
  for (const [name, group] of names) if (group.length > Math.min(...group.map(deckCardLimit))) errors.push(t('misc.deck.overLimit', { name }))
  // Capacity matching prevents one card from consuming both a primary option
  // and a limited splash allowance; augmentation makes this order independent.
  const limited = ordinary.filter(card => !rules.options.some(rule => rule.limit == null && matchesCardRule(card, rule, investigator)))
  const slots = rules.options.flatMap((rule, index) => rule.limit == null ? [] : Array.from({ length: Math.min(limited.length, rule.limit) }, () => index))
  const owners = slots.map(() => -1)
  function assign(cardIndex, seen) {
    for (let slot = 0; slot < slots.length; slot++) {
      if (seen.has(slot) || !matchesCardRule(limited[cardIndex], rules.options[slots[slot]], investigator)) continue
      seen.add(slot)
      if (owners[slot] < 0 || assign(owners[slot], seen)) { owners[slot] = cardIndex; return true }
    }
    return false
  }
  for (let i = 0; i < limited.length; i++) if (!assign(i, new Set())) errors.push(t('misc.deck.restriction', { name: limited[i].name || limited[i].code }))
  for (const rule of partial ? [] : rules.options.filter(option => option.atleast)) {
    const requiredFactions = rule.atleast.factions
    const minimum = rule.atleast.min
    if (!Number.isSafeInteger(requiredFactions) || requiredFactions < 1 || !Number.isSafeInteger(minimum) || minimum < 1) {
      errors.push(t('misc.deck.atleastInvalid'))
      continue
    }
    const allowedFactions = rule.factions || rule.faction || []
    const counts = new Map(allowedFactions.map(faction => [faction, 0]))
    for (const card of ordinary) {
      const factions = card.factions || [card.klass, card.klass2, card.klass3].filter(Boolean)
      for (const faction of new Set(factions)) if (counts.has(faction)) counts.set(faction, counts.get(faction) + 1)
    }
    if ([...counts.values()].filter(count => count >= minimum).length < requiredFactions) {
      errors.push(rule.error || t('misc.deck.atleast', { factions: requiredFactions, minimum }))
    }
  }
  return { errors, size: rules.size, count: counted.length, permanent: ordinary.length - counted.length }
}

// ---------------------------------------------------------------------------
// 卡牌范围（开局「游戏高级设置」的 cardPoolScope）
// ---------------------------------------------------------------------------
// 全部（all）：不限制卡牌来源。
// 渐进式（progressive）：只允许当前循环及更早循环的卡牌，超过当前循环的卡牌
// 不能选人、不能构筑、也不能在关间升级。循环按卡号前两位识别（01 核心包、
// 02 敦威治遗产、03 卡尔克萨之路、04 失落的时代……），与官方产品循环一致。
// 浏览器与服务器共用这份纯规则：新战役必须登记循环，否则渐进式视为不限制。
export const CARD_POOL_SCOPES = Object.freeze(['all', 'progressive'])
// 2026-10-26 临时取消卡牌范围限制：所有战役都按「全部」处理，渐进式不再按循环过滤卡牌，
// 界面也不显示「卡牌范围」选项。当前发布版手动牌组的许可校验还有误伤（见
// src/deck/deckbuilding.js 的开放池许可），先把卡牌来源限制整体放开；待那份修复
// 合入后，把本常量改回 true 即恢复限制——过滤逻辑、高级设置入口与
// tests/game-settings.test.mjs / tests/hall-setup.browser.mjs 的对应断言都会一起回来。
export const CARD_POOL_RESTRICTION_ENABLED = false
// getter：取到时按当前语言求值（不能在这里直接 t()，那会在导入时固定成 zh-CN）。
export const CARD_POOL_SCOPE_LABELS = Object.freeze({
  get all() { return t('misc.cardPool.all') },
  get progressive() { return t('misc.cardPool.progressive') },
})
export const CAMPAIGN_CYCLES = Object.freeze({
  nightOfTheZealot: 1,
  theDunwichLegacy: 2,
  thePathToCarcosa: 3,
  theForgottenAge: 4,
  // 第 5 步（P6）：调查员已可选。战役本身仍是 catalog-only，登记循环只影响渐进式卡池的判定。
  theCircleUndone: 5,
})
export function normalizeCardPoolScope(scope) {
  return CARD_POOL_SCOPES.includes(scope) ? scope : 'all'
}
export function campaignCycle(campaignId) {
  return CAMPAIGN_CYCLES[campaignId] ?? null
}
export function cardCycle(code) {
  const match = /^(\d{2})\d{3}[a-z]?$/.exec(String(code ?? ''))
  const cycle = match ? Number(match[1]) : 0
  return cycle >= 1 && cycle <= 9 ? cycle : null
}
export function cardAllowedByScope(code, scope, currentCycle) {
  if (!CARD_POOL_RESTRICTION_ENABLED) return true
  if (normalizeCardPoolScope(scope) !== 'progressive' || !currentCycle) return true
  const cycle = cardCycle(code)
  return cycle == null || cycle <= currentCycle
}

export function upgradeQuote(added, removed, { discounts = [] } = {}) {
  const printed = (added.xp || 0) * (added.exceptional ? 2 : 1)
  const credit = removed && added.name === removed.name && (added.xp || 0) > (removed.xp || 0)
    ? (removed.xp || 0) * (removed.exceptional ? 2 : 1) : 0
  const base = Math.max(1, printed - credit)
  const discount = discounts.filter(rule => matchesCardRule(added, rule.match || {}, {})).reduce((sum, rule) => sum + rule.amount, 0)
  return { cost: Math.max(0, base - discount), printed, credit, discount,
    explanation: t('misc.upgrade.quote', { printed, credit }) + (discount ? t('misc.upgrade.discount', { discount }) : '') }
}
