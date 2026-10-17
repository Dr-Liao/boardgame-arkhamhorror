// ArkhamDB 牌组导入（只读）：服务端代为拉取公开牌组，避免浏览器跨域，
// 并把卡号规范化为本 Mod 的图鉴编号（重印卡 → 原版卡号）。
//
// 只返回卡牌身份与数量，不决定可构筑性：前端据 deckBuilder 白名单预检，
// 最终仍由 hubSetDeck → buildDeckFromList 在服务端完整校验。

import { ALL_CARDS } from '../cards/cards-data.js'

const ORIGIN = 'https://arkhamdb.com'
const KINDS = Object.freeze(['decklist', 'deck'])
const CODE = /^[0-9A-Za-z]{4,12}$/
const ID = /^\d{1,10}$/
const MAX_ENTRIES = 200
const MAX_BODY = 2_000_000
const CACHE_TTL = 5 * 60 * 1000
const CACHE_MAX = 64
const cache = new Map()

// 沿 duplicateOfCode 回到原版卡号（如 Revised Core 01530 → 01030）。
export function canonicalCode(code) {
  let current = code
  const seen = new Set()
  while (ALL_CARDS[current]?.duplicateOfCode && !seen.has(current)) {
    seen.add(current)
    const next = ALL_CARDS[current].duplicateOfCode
    if (!ALL_CARDS[next]) break
    current = next
  }
  return current
}

function cardInfo(code) {
  const card = ALL_CARDS[code]
  if (!card) return { known: false, name: code, nameEn: code, type: null, subtype: null, xp: 0, signatureFor: null }
  return {
    known: true, name: card.nameZh || card.name || code, nameEn: card.name || code,
    type: card.type || null, subtype: card.subtype || null, xp: card.xp ?? 0,
    signatureFor: Array.isArray(card.signatureFor) && card.signatureFor.length ? [...card.signatureFor] : null,
  }
}

export function slotEntries(slots, label) {
  if (slots == null || (Array.isArray(slots) && !slots.length)) return []
  if (typeof slots !== 'object' || Array.isArray(slots)) throw new RangeError(label + '格式无效')
  const pairs = Object.entries(slots)
  if (pairs.length > MAX_ENTRIES) throw new RangeError(label + '条目过多')
  return pairs.map(([code, value]) => {
    if (!CODE.test(code)) throw new RangeError('无效卡牌编号：' + String(code).slice(0, 20))
    const count = Number(value)
    if (!Number.isSafeInteger(count) || count < 0 || count > 99) throw new RangeError('无效卡牌数量：' + code)
    return [code, count]
  }).filter(([, count]) => count > 0)
}

/** 把 ArkhamDB 牌组 JSON（API 返回或用户粘贴）规范化为导入描述。 */
export function describeArkhamDbDeck(raw, source = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new RangeError('ArkhamDB 牌组数据无效')
  const originalInvestigator = String(raw.investigator_code ?? '')
  if (!CODE.test(originalInvestigator)) throw new RangeError('牌组缺少调查员编号')
  const entries = new Map()
  for (const [code, count] of slotEntries(raw.slots, '卡牌清单')) {
    const target = canonicalCode(code)
    const entry = entries.get(target) || { code: target, originalCodes: [], count: 0, ...cardInfo(target) }
    entry.count += count
    if (!entry.originalCodes.includes(code)) entry.originalCodes.push(code)
    entries.set(target, entry)
  }
  if (!entries.size) throw new RangeError('牌组中没有任何卡牌')
  const ignoreDeckLimit = {}
  for (const [code, count] of slotEntries(raw.ignoreDeckLimitSlots, '不计张数清单')) {
    const target = canonicalCode(code)
    ignoreDeckLimit[target] = (ignoreDeckLimit[target] || 0) + count
  }
  const sideCount = slotEntries(raw.sideSlots, '备选清单').reduce((sum, [, count]) => sum + count, 0)
  const investigatorCode = canonicalCode(originalInvestigator)
  const investigator = cardInfo(investigatorCode)
  const id = raw.id != null && ID.test(String(raw.id)) ? String(raw.id) : source.id || null
  const kind = source.kind || null
  return {
    id, kind,
    url: id && kind ? `${ORIGIN}/${kind}/view/${id}` : null,
    name: String(raw.name ?? '').slice(0, 120) || '未命名牌组',
    investigatorCode, originalInvestigatorCode: originalInvestigator,
    investigatorName: investigator.known ? investigator.name : String(raw.investigator_name ?? investigatorCode).slice(0, 60),
    investigatorKnown: investigator.known && investigator.type === 'investigator',
    xp: Number.isSafeInteger(Number(raw.xp)) ? Number(raw.xp) : 0,
    tabooId: raw.taboo_id ?? null,
    sideCount,
    entries: [...entries.values()],
    ignoreDeckLimit,
  }
}

function remember(key, value) {
  cache.delete(key)
  cache.set(key, { at: Date.now(), value })
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
}

async function fetchJson(fetchImpl, url, timeoutMs) {
  let response
  try {
    response = await fetchImpl(url, {
      headers: { accept: 'application/json', 'user-agent': 'boardgame-hall-arkham/1.0' },
      redirect: 'follow', signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError'
    return { failure: timeout ? '连接 ArkhamDB 超时，请稍后重试' : '无法连接 ArkhamDB：' + (error?.cause?.code || error?.message || '网络错误') }
  }
  if (response.status === 404 || response.status === 403 || response.status === 401) return { missing: true }
  if (!response.ok) return { failure: `ArkhamDB 暂时不可用（HTTP ${response.status}）` }
  const text = await response.text()
  if (text.length > MAX_BODY) return { failure: 'ArkhamDB 返回的数据过大' }
  try {
    const json = JSON.parse(text)
    // ArkhamDB 对不存在或未公开的牌组可能返回 200 + 错误对象。
    if (!json || typeof json !== 'object' || Array.isArray(json) || json.error || !json.investigator_code) return { missing: true }
    return { json }
  } catch { return { missing: true } }
}

/**
 * 拉取 ArkhamDB 公开牌组。kind: 'decklist'（已发布）| 'deck'（公开分享的私人牌组）| 'auto'。
 * @returns {Promise<{ body?: object, status?: number, error?: string }>}
 */
export async function fetchArkhamDbDeck(kind, id, { fetchImpl = globalThis.fetch, timeoutMs = 12000 } = {}) {
  if (!ID.test(String(id))) return { status: 400, error: '无效的 ArkhamDB 牌组编号' }
  const kinds = kind === 'auto' ? KINDS : KINDS.includes(kind) ? [kind] : null
  if (!kinds) return { status: 400, error: '无效的 ArkhamDB 牌组类型' }
  if (typeof fetchImpl !== 'function') return { status: 502, error: '当前运行环境不支持联网导入' }
  let failure = null
  for (const candidate of kinds) {
    const key = candidate + ':' + id
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < CACHE_TTL) return { body: { deck: hit.value } }
    const result = await fetchJson(fetchImpl, `${ORIGIN}/api/public/${candidate}/${id}`, timeoutMs)
    if (result.json) {
      let deck
      try { deck = describeArkhamDbDeck(result.json, { kind: candidate, id: String(id) }) } catch (error) {
        return { status: 502, error: 'ArkhamDB 牌组数据无法识别：' + error.message }
      }
      remember(key, deck)
      return { body: { deck } }
    }
    if (result.failure) failure = result.failure
  }
  if (failure) return { status: 502, error: failure }
  return { status: 404, error: '在 ArkhamDB 找不到该牌组。私人牌组需在 ArkhamDB 账户设置中开启「公开分享牌组」。' }
}

function parseSlotQuery(value, label) {
  if (!value) return {}
  if (value.length > 4000) throw new RangeError(label + '过长')
  const slots = {}
  for (const part of value.split(',')) {
    const [code, count] = part.split(':')
    if (!code) continue
    slots[code] = (slots[code] || 0) + Number(count ?? 1)
  }
  return slots
}

/** 解析粘贴的牌组（前端已压缩为查询参数），无需联网。 */
export function resolveArkhamDbDeck(searchParams) {
  const single = key => {
    const values = searchParams.getAll(key)
    if (values.length > 1) throw new RangeError('重复的导入参数：' + key)
    return values[0] ?? ''
  }
  const raw = {
    investigator_code: single('investigator'),
    name: single('name').slice(0, 120),
    slots: parseSlotQuery(single('slots'), '卡牌清单'),
    ignoreDeckLimitSlots: parseSlotQuery(single('ignore'), '不计张数清单'),
    taboo_id: single('taboo') || null,
  }
  const id = single('id')
  return { body: { deck: describeArkhamDbDeck(raw, ID.test(id) ? { id } : {}) } }
}

export function clearArkhamDbCache() { cache.clear() }
