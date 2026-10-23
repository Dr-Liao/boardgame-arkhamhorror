// Shared by initial construction and upgrades. Content supplies declarative
// rules; clients may supply only card codes, never rules or costs.
// 第 127 轮：敦威治调查员集合与黛西的「命运」限制改由 web/ui-cards.js 声明。
import { UI_CARDS } from './ui-cards.js'

const extensions = new Map()
export function registerDeckRules(investigatorCode, rules) {
  if (!Number.isSafeInteger(rules.size) || rules.size < 1 || !Array.isArray(rules.options)) throw new Error('无效构筑规则')
  for (const option of rules.options) {
    if (option.limit != null && (!Number.isSafeInteger(option.limit) || option.limit < 0)) throw new Error('无效构筑限额')
    if (option.level && (!Number.isSafeInteger(option.level.min ?? 0) || !Number.isSafeInteger(option.level.max ?? 5) || (option.level.min ?? 0) < 0 || (option.level.max ?? 5) < (option.level.min ?? 0))) throw new Error('无效卡牌等级区间')
  }
  extensions.set(investigatorCode, structuredClone(rules))
}
export function deckRules(investigator) {
  const { dunwichInvestigators, noFortuneInvestigator } = UI_CARDS.deckRules
  const dunwich = dunwichInvestigators.includes(investigator.code)
  const options = dunwich ? [
    { factions: [investigator.klass, 'neutral'], level: { min: 0, max: 5 } },
    { level: { min: 0, max: 0 }, limit: 5,
      ...(investigator.code === noFortuneInvestigator ? { not: { traits: ['Fortune'] } } : {}) },
  ] : investigator.deckOptions || []
  return structuredClone({
    size: investigator.deckRequirements?.size,
    options,
    signatureCards: investigator.deckRequirements?.signatureCards || [],
    random: investigator.deckRequirements?.random || [],
    ...(extensions.get(investigator.code) || {}),
  })
}
const lower = value => String(value).toLowerCase().replace(/\.$/, '')
// 第 5 步 M1 调查员批次（P6）：构筑标签的三种印刷写法。
//   uc = 带「使用（充能）」、hh = 能治愈恐惧、st = [[法术]]；
// 卡表用 tag + text（正则）描述「带有『治愈……恐惧』字样的卡牌」这类构筑选项。
const KNOWN_DECK_TAGS = Object.freeze(['uc', 'hh', 'st'])
const CARD_TEXTS = card => [card.text, card.textZh].filter(Boolean).map(text => String(text))
const healsHorror = card => CARD_TEXTS(card).some(text => /heals? .*horror|治愈[^。\n]*恐惧|治癒[^。\n]*恐懼/i.test(text))
const isSpellCard = card => (card.traits || []).some(trait => lower(trait) === 'spell')
  || CARD_TEXTS(card).some(text => /\[\[spell\]\]/i.test(text))
// 「额外限制：无等级 1-5 的[[武器]]卡牌」这类 `not: true` 规则是**排除项**，不是允许项：
// 其余字段命中即整张牌不能进牌组（与 `not: {…}` 的否定式允许项互不冲突）。
export function optionExcluded(investigator, card) {
  for (const rule of deckRules(investigator).options) {
    if (rule.not !== true) continue
    const { not, ...rest } = rule
    if (matchesCardRule(card, rest, investigator)) return true
  }
  return false
}
export function matchesCardRule(card, rule, investigator) {
  if (investigator.code === UI_CARDS.deckRules.noFortuneInvestigator
    && (card.traits || []).some(trait => lower(trait) === 'fortune')) return false
  const known = new Set(['factions', 'faction', 'level', 'types', 'traits', 'trait', 'uses', 'tag',
    'atleast', 'error', 'limit', 'not', 'codes', 'investigatorTraits', 'text'])
  if (Object.keys(rule).some(key => !known.has(key))) return false
  if (rule.not && typeof rule.not === 'object' && matchesCardRule(card, rule.not, investigator)) return false
  if (rule.text?.length) {
    const patterns = (Array.isArray(rule.text) ? rule.text : [rule.text])
      .map(source => { try { return new RegExp(source, 'i') } catch { return null } })
      .filter(Boolean)
    if (!patterns.some(pattern => CARD_TEXTS(card).some(text => pattern.test(text)))) return false
  }
  const factions = card.factions || [card.klass, card.klass2, card.klass3].filter(Boolean)
  const allowed = rule.factions || rule.faction
  if (allowed?.length && !allowed.some(faction => factions.includes(faction))) return false
  if (rule.types?.length && !rule.types.includes(card.type)) return false
  if (rule.codes?.length && !rule.codes.includes(card.code)) return false
  const requiredTraits = rule.traits || rule.trait
  if (requiredTraits?.length && !requiredTraits.some(trait => (card.traits || []).map(lower).includes(lower(trait)))) return false
  const printedUses = [
    card.usesType,
    ...(Array.isArray(card.uses) ? card.uses : []),
    ...[card.text, card.textZh].filter(Boolean).flatMap(text =>
      [...String(text).matchAll(/Uses\s*\([^)]*?\b([A-Za-z]+)\s*\)/gi)].map(match => match[1])),
  ].filter(Boolean).map(lower)
  if (rule.uses?.length && !rule.uses.map(lower).some(use => printedUses.includes(use))) return false
  if (rule.tag?.length) {
    const tags = rule.tag.map(lower)
    if (tags.some(tag => !KNOWN_DECK_TAGS.includes(tag))) return false
    if (tags.includes('uc') && !printedUses.some(use => ['charge', 'charges'].includes(use))) return false
    if (tags.includes('hh') && !healsHorror(card)) return false
    if (tags.includes('st') && !isSpellCard(card)) return false
  }
  if (rule.investigatorTraits?.length && !rule.investigatorTraits.some(trait => (investigator.traits || []).map(lower).includes(lower(trait)))) return false
  const xp = card.xp || 0
  if (rule.level && (xp < (rule.level.min || 0) || xp > (rule.level.max ?? 5))) return false
  if (card.requiredInvestigatorTraits?.length && !card.requiredInvestigatorTraits.some(trait => (investigator.traits || []).map(lower).includes(lower(trait)))) return false
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
  for (const code of codes) if (!cards[code]) errors.push(`未知卡牌：${code}`)
  // 排除式构筑限制（`not: true`）：命中的卡不能进牌组，且不受其它允许项豁免。
  for (const card of ordinary) {
    if (optionExcluded(investigator, card)) errors.push(`${card.name || card.code} 属于构筑限制排除的卡牌`)
  }
  const counted = ordinary.filter(card => !card.permanent && !card.ignoreDeckLimit)
  if ((!partial && counted.length !== rules.size) || counted.length > rules.size) errors.push(`牌库需 ${rules.size} 张玩家卡，当前 ${counted.length} 张`)
  const names = new Map()
  for (const card of ordinary) {
    const group = names.get(card.name || card.code) || []
    group.push(card); names.set(card.name || card.code, group)
  }
  for (const [name, group] of names) if (group.length > Math.min(...group.map(deckCardLimit))) errors.push(`${name} 超过张数上限`)
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
  for (let i = 0; i < limited.length; i++) if (!assign(i, new Set())) errors.push(`${limited[i].name || limited[i].code} 不符合构筑限制或限额`)
  for (const rule of partial ? [] : rules.options.filter(option => option.atleast)) {
    const requiredFactions = rule.atleast.factions
    const minimum = rule.atleast.min
    if (!Number.isSafeInteger(requiredFactions) || requiredFactions < 1 || !Number.isSafeInteger(minimum) || minimum < 1) {
      errors.push('无效的阵营数量构筑要求')
      continue
    }
    const allowedFactions = rule.factions || rule.faction || []
    const counts = new Map(allowedFactions.map(faction => [faction, 0]))
    for (const card of ordinary) {
      const factions = card.factions || [card.klass, card.klass2, card.klass3].filter(Boolean)
      for (const faction of new Set(factions)) if (counts.has(faction)) counts.set(faction, counts.get(faction) + 1)
    }
    if ([...counts.values()].filter(count => count >= minimum).length < requiredFactions) {
      errors.push(rule.error || `牌组必须至少包含 ${requiredFactions} 个不同阵营各 ${minimum} 张牌`)
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
export const CARD_POOL_SCOPE_LABELS = Object.freeze({ all: '全部', progressive: '渐进式' })
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
    explanation: `卡牌经验 ${printed} − 同名升级抵扣 ${credit}，最低 1 XP${discount ? `，优惠 ${discount}` : ''}` }
}
