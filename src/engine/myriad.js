// 多重（Myriad）构筑限制（P3 批次 3 原语 `deck.myriadLimit`）。
//
// 规则：带 Myriad 的卡「同名最多 3 张」；这是**构筑期**限制，不是场上/牌堆规则。
// 食梦者有 14 张 Myriad 玩家卡（P2 机制扫描）。
//
// 口径：食梦者迁移路线 §5 关键词表；账本 batch P3-3。
// 纯数据：不 import engine；按「标题」归一化（不同卡号、同名的多张卡共享 3 张额度）。

export const MYRIAD_LIMIT = 3

/** 卡/条目是否带 Myriad（字段或卡文关键字）。 */
export function isMyriad(card) {
  if (!card || typeof card !== 'object') return false
  if (card.myriad === true) return true
  if (Array.isArray(card.keywords) && card.keywords.includes('Myriad')) return true
  return /(^|\n)\s*Myriad\b/i.test(String(card.text || ''))
}

/** 统计牌组里某标题的份数（`titleOf` 默认取 code→卡定义；未提供时按 code 计）。 */
export function countTitleCopies(deck, titleOf) {
  const counts = new Map()
  for (const code of deck || []) {
    const title = typeof titleOf === 'function' ? titleOf(code) : code
    counts.set(title, (counts.get(title) || 0) + 1)
  }
  return counts
}

/**
 * 校验 Myriad 上限：只对带 Myriad 的卡生效。
 * `cardDefs(code)` 返回 `{ title/name, myriad, keywords, text }`；找不到定义时跳过（由别的账本管存在性）。
 * 返回 `{ ok, violations: [{ title, count, codes }] }`。
 */
export function validateMyriadLimit(deck, cardDefs) {
  if (typeof cardDefs !== 'function') throw new Error('validateMyriadLimit 需要 cardDefs 查表')
  const codesByTitle = new Map()
  for (const code of deck || []) {
    const def = cardDefs(code)
    if (!def || !isMyriad(def)) continue
    const title = def.title || def.name || code
    if (!codesByTitle.has(title)) codesByTitle.set(title, [])
    codesByTitle.get(title).push(code)
  }
  const violations = []
  for (const [title, codes] of codesByTitle) {
    if (codes.length > MYRIAD_LIMIT) violations.push({ title, count: codes.length, codes: [...codes] })
  }
  return { ok: violations.length === 0, violations }
}

/**
 * 往牌组加一张卡：若会超 Myriad 上限则拒绝（返回 `{ ok:false, reason }`），否则返回新牌组。
 * 只对 Myriad 卡做拦截；非 Myriad 卡不在这里管（普通同名上限属别的校验）。
 */
export function addCardRespectingMyriad(deck, code, cardDefs) {
  if (typeof cardDefs !== 'function') throw new Error('addCardRespectingMyriad 需要 cardDefs 查表')
  const def = cardDefs(code)
  if (!def || !isMyriad(def)) return { ok: true, deck: [...(deck || []), code] }
  const title = def.title || def.name || code
  const sameTitle = (deck || []).filter(candidate => {
    const other = cardDefs(candidate)
    return other && isMyriad(other) && (other.title || other.name || candidate) === title
  })
  if (sameTitle.length >= MYRIAD_LIMIT) {
    return { ok: false, reason: `「${title}」是 Myriad，同名最多 ${MYRIAD_LIMIT} 张（已有 ${sameTitle.length} 张）`, deck }
  }
  return { ok: true, deck: [...(deck || []), code] }
}

/** 汇总：Myriad 卡按标题的份数（构筑 UI 显示「2/3」用）。 */
export function myriadUsage(deck, cardDefs) {
  const usage = []
  const seen = new Set()
  for (const code of deck || []) {
    const def = cardDefs(code)
    if (!def || !isMyriad(def)) continue
    const title = def.title || def.name || code
    if (seen.has(title)) continue
    seen.add(title)
    const count = (deck || []).filter(candidate => {
      const other = cardDefs(candidate)
      return other && isMyriad(other) && (other.title || other.name || candidate) === title
    }).length
    usage.push({ title, count, limit: MYRIAD_LIMIT })
  }
  return usage
}
