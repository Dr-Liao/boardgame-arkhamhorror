// 调查员「复刻 / 平行版」识别（选人页用）。
//
// 同一角色在卡牌数据里可能有多张卡：
//   · 复刻：同名、规则/数值/签名完全一致，只有卡号（与画）不同，例如 01001 / 98004；
//   · 平行版：同名但能力/签名不同，例如核心 01001 与 By the Book 的平行罗兰 90024。
// 选人页只隐藏会同时出现的复刻，避免一列里出现两个一模一样的角色；平行版保留，
// 由调用方在合并后的「其他调查员」里加标注区分。判断逻辑放在这里便于 Node 侧单测。
const normalize = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, '').toLowerCase()

/** 角色身份键：优先用英文名（跨语言稳定），缺失时退回中文名/卡号。 */
export function investigatorIdentityKey(investigator) {
  return normalize(investigator?.nameEn || investigator?.name || investigator?.code)
}

const signatureNames = cards => (cards || []).map(card => card.nameEn || card.name || card.code).sort().join(',')

/** 一局里可感知的「规则指纹」：能力文本、生命/神志、职业、牌库张数与签名/专属弱点。 */
export function investigatorPlaySignature(investigator) {
  const inv = investigator || {}
  return [
    normalize(inv.abilityText),
    inv.health ?? '', inv.sanity ?? '', inv.klass ?? '', inv.deckSize ?? '',
    signatureNames(inv.signatureCards), signatureNames(inv.signatureWeaknesses),
  ].join('|')
}

/**
 * 返回需要隐藏的复刻调查员代码：同一角色 + 同一规则指纹的多张卡只留一张。
 * 优先保留主循环（非「其他调查员」小包）里的版本；候选列表本身已按战役可用性过滤，
 * 因此小战役只允许某个复刻卡时它不会因为这里被藏掉。
 */
export function reprintDuplicateCodes(investigators = [], minorPacks = null) {
  const groups = new Map()
  for (const investigator of investigators) {
    if (!investigator?.code) continue
    const key = investigatorIdentityKey(investigator) + '::' + investigatorPlaySignature(investigator)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(investigator)
  }
  const hidden = new Set()
  for (const same of groups.values()) {
    if (same.length < 2) continue
    const rank = investigator => (minorPacks?.has?.(investigator.pack || 'core') ? 1 : 0)
    const [keep] = same.slice().sort((a, b) => rank(a) - rank(b))
    for (const investigator of same) if (investigator !== keep) hidden.add(investigator.code)
  }
  return hidden
}

/** 同一角色还剩多张可选项（即互为平行版）的调查员代码集合。 */
export function parallelVariantCodes(investigators = []) {
  const counts = new Map()
  for (const investigator of investigators) {
    const key = investigatorIdentityKey(investigator)
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return new Set(investigators
    .filter(investigator => counts.get(investigatorIdentityKey(investigator)) > 1)
    .map(investigator => investigator.code))
}