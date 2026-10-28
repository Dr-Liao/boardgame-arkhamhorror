// 地点型 Bonded（P3 批次 3 原语 `location.placeBondedLocation`）。
//
// 食梦者的「梦境之门」06015a/b：A 面与 B 面互为 Bonded，放下一面就要把另一面一起放进场，
// 且两面共享一个「门」的身份（移除时成对移除）。与玩家卡 Bonded 的区别：这里生成的是**地点**。
//
// 口径：食梦者迁移路线 §5.2 `location.placeBondedLocation`；账本 batch P3-3。
// 纯数据：地点实体由调用方注入（`spawnLocation`），本模块只负责配对、链接、成对移除。

/** 从卡/地点定义解析 Bonded 卡号：字段 `bonded` 或卡文 `Bonded (06126)`。 */
export function bondedCodesOf(card) {
  if (!card) return []
  if (Array.isArray(card.bonded)) return card.bonded.filter(Boolean)
  if (typeof card.bonded === 'string') return [card.bonded]
  const text = String(card.text || '')
  const codes = []
  for (const match of text.matchAll(/Bonded\s*\(([^)]+)\)/gi)) {
    for (const code of match[1].split(/[,，\s]+/)) {
      if (/^\d{5}[a-z]?$/i.test(code)) codes.push(code.toLowerCase())
    }
  }
  return [...new Set(codes)]
}

/**
 * 把地点与它的 Bonded 伙伴一起放进场：
 *   spawnLocation(def) 返回已加入 `state.locations` 的地点对象（由调用方提供查表与构造）。
 * 返回 `{ placed, partner, host }`；缺定义或伙伴已在场时按 `onExisting` 处理。
 */
export function placeBondedLocation(state, hostDef, { spawnLocation, onExisting = 'link' } = {}) {
  if (!hostDef || !hostDef.code) throw new Error('placeBondedLocation 需要带 code 的地点定义')
  if (typeof spawnLocation !== 'function') throw new Error('placeBondedLocation 需要 spawnLocation 注入')
  const codes = bondedCodesOf(hostDef)
  if (!codes.length) throw new Error(`地点没有 Bonded 卡号：${hostDef.code}`)
  const partnerCode = codes[0]
  state.locations ||= []
  const findExisting = code => state.locations.find(location =>
    String(location.originalCode || location.code) === String(code))
  const host = findExisting(hostDef.code) || spawnLocation(hostDef)
  let partner = findExisting(partnerCode)
  if (partner) {
    if (onExisting === 'throw') throw new Error(`Bonded 伙伴已在场：${partnerCode}`)
  } else {
    partner = spawnLocation({ ...hostDef, code: partnerCode, originalCode: partnerCode, bonded: [hostDef.code] })
  }
  host.bondedPartnerId = partner.id
  partner.bondedPartnerId = host.id
  host.bondedCode = partnerCode
  partner.bondedCode = hostDef.code
  return { placed: host, partner, host }
}

/** 某地点的 Bonded 伙伴（不在场返回 null）。 */
export function bondedPartnerOf(state, locationId) {
  const location = (state?.locations || []).find(item => String(item.id) === String(locationId))
  if (!location?.bondedPartnerId) return null
  return (state.locations || []).find(item => String(item.id) === String(location.bondedPartnerId)) || null
}

/** 成对移除：返回被移除的 id 列表（顺序：本体、伙伴）。 */
export function removeBondedLocation(state, locationId) {
  const location = (state?.locations || []).find(item => String(item.id) === String(locationId))
  if (!location) return []
  const partner = bondedPartnerOf(state, locationId)
  const removed = []
  for (const target of [location, partner].filter(Boolean)) {
    const index = state.locations.indexOf(target)
    if (index >= 0) {
      state.locations.splice(index, 1)
      removed.push(target.id)
    }
  }
  return removed
}

/** 注册期校验：所有声明 Bonded 的地点都必须能在剧本地点表里找到伙伴。 */
export function normalizeBondedLocations(locations) {
  const byCode = new Set((locations || []).map(location => String(location.originalCode || location.code)))
  const missing = []
  let total = 0
  for (const location of locations || []) {
    for (const code of bondedCodesOf(location)) {
      total += 1
      if (!byCode.has(String(code))) missing.push(`${location.code}→${code}`)
    }
  }
  return { total, missing }
}
