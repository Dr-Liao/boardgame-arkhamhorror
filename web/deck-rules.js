// Shared by initial construction and upgrades. Content supplies declarative
// rules; clients may supply only card codes, never rules or costs.
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
  const dunwich = ['02001', '02002', '02003', '02004', '02005'].includes(investigator.code)
  const options = dunwich ? [
    { factions: [investigator.klass, 'neutral'], level: { min: 0, max: 5 } },
    { level: { min: 0, max: 0 }, limit: 5,
      ...(investigator.code === '02002' ? { not: { traits: ['Fortune'] } } : {}) },
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
export function matchesCardRule(card, rule, investigator) {
  if (investigator.code === '02002' && (card.traits || []).some(trait => lower(trait) === 'fortune')) return false
  const known = new Set(['factions', 'faction', 'level', 'types', 'traits', 'trait', 'uses', 'tag',
    'atleast', 'error', 'limit', 'not', 'codes', 'investigatorTraits'])
  if (Object.keys(rule).some(key => !known.has(key))) return false
  if (rule.not && matchesCardRule(card, rule.not, investigator)) return false
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
    if (tags.some(tag => tag !== 'uc')) return false
    if (tags.includes('uc') && !printedUses.some(use => ['charge', 'charges'].includes(use))) return false
  }
  if (rule.investigatorTraits?.length && !rule.investigatorTraits.some(trait => (investigator.traits || []).map(lower).includes(lower(trait)))) return false
  const xp = card.xp || 0
  if (rule.level && (xp < (rule.level.min || 0) || xp > (rule.level.max ?? 5))) return false
  if (card.requiredInvestigatorTraits?.length && !card.requiredInvestigatorTraits.some(trait => (investigator.traits || []).map(lower).includes(lower(trait)))) return false
  return true
}
export function deckCardLimit(card) {
  const limit = card.deckLimit ?? (card.myriad ? 3 : 2)
  return Number.isSafeInteger(limit) && limit > 0 ? (card.exceptional ? Math.min(1, limit) : limit) : 0
}
export function validateDeckRules(investigator, codes, cards, { partial = false } = {}) {
  const rules = deckRules(investigator)
  const errors = []
  const ordinary = codes.map(code => cards[code]).filter(card => card && !card.signatureFor && !card.subtype && !card.story)
  for (const code of codes) if (!cards[code]) errors.push(`未知卡牌：${code}`)
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

export function upgradeQuote(added, removed, { discounts = [] } = {}) {
  const printed = (added.xp || 0) * (added.exceptional ? 2 : 1)
  const credit = removed && added.name === removed.name && (added.xp || 0) > (removed.xp || 0)
    ? (removed.xp || 0) * (removed.exceptional ? 2 : 1) : 0
  const base = Math.max(1, printed - credit)
  const discount = discounts.filter(rule => matchesCardRule(added, rule.match || {}, {})).reduce((sum, rule) => sum + rule.amount, 0)
  return { cost: Math.max(0, base - discount), printed, credit, discount,
    explanation: `卡牌经验 ${printed} − 同名升级抵扣 ${credit}，最低 1 XP${discount ? `，优惠 ${discount}` : ''}` }
}
