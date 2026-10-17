// ArkhamDB 牌组导入：解析用户输入 → 经本 Mod 只读接口拉取/规范化 → 生成构筑草稿。
// 只有牌组内所有普通卡都已实现且可用于当前调查员 0 XP 开局时才允许载入；
// 签名卡、专属弱点与基础弱点由服务端在保存时自动加入，导入时跳过。
import { registerDeckRules, validateDeckRules } from './deck-rules.js'

const API_ROOT = '/api/mods/arkhamhorror/arkhamdb/'
const PLAYER_TYPES = new Set(['asset', 'event', 'skill'])

/** @returns {{ kind: 'decklist'|'deck'|'auto', id: string } | { json: object } | { error: string }} */
export function parseArkhamDbInput(text) {
  const value = String(text ?? '').trim()
  if (!value) return { error: '请粘贴 ArkhamDB 牌组链接、编号或导出的 JSON。' }
  if (value.startsWith('{')) {
    try {
      const json = JSON.parse(value)
      if (!json || typeof json !== 'object' || !json.investigator_code || !json.slots) return { error: 'JSON 中缺少 investigator_code 或 slots 字段。' }
      return { json }
    } catch { return { error: 'JSON 格式无效，请复制完整的牌组数据。' } }
  }
  if (/^\d{1,10}$/.test(value)) return { kind: 'auto', id: value }
  let url
  try { url = new URL(/^[a-z]+:\/\//i.test(value) ? value : 'https://' + value) } catch { return { error: '无法识别的链接。' } }
  if (!/^(?:[a-z-]+\.)?arkhamdb\.com$/i.test(url.hostname)) return { error: '仅支持 arkhamdb.com 的牌组链接。' }
  const match = url.pathname.match(/\/(?:api\/public\/)?(decklist|deck)\/(?:(?:view|edit|export\/[a-z]+)\/)?(\d{1,10})(?:[/.]|$)/i)
  if (!match) return { error: '链接中没有找到牌组编号，例如 https://arkhamdb.com/decklist/view/12345。' }
  return { kind: match[1].toLowerCase(), id: match[2] }
}

const slotQuery = slots => Object.entries(slots && typeof slots === 'object' && !Array.isArray(slots) ? slots : {})
  .filter(([, count]) => Number(count) > 0).map(([code, count]) => `${code}:${Number(count)}`).join(',')

async function request(path, fetchImpl) {
  let response
  try { response = await fetchImpl(API_ROOT + path, { signal: AbortSignal.timeout(20000) }) } catch (error) {
    throw new Error(error?.name === 'TimeoutError' ? '导入超时，请稍后重试。' : '无法连接大厅服务。')
  }
  let value
  try { value = await response.json() } catch { throw new Error('导入接口响应无效。') }
  if (!response.ok || !value.ok || !value.deck) throw new Error(value.error || '导入失败。')
  return value.deck
}

/** 依解析结果拉取规范化牌组描述（卡号已映射回原版编号）。 */
export function loadArkhamDbDeck(parsed, { fetchImpl = globalThis.fetch.bind(globalThis) } = {}) {
  if (parsed.json) {
    const json = parsed.json
    const params = new URLSearchParams({ investigator: String(json.investigator_code), slots: slotQuery(json.slots) })
    if (json.name) params.set('name', String(json.name).slice(0, 120))
    if (json.id != null) params.set('id', String(json.id))
    const ignore = slotQuery(json.ignoreDeckLimitSlots)
    if (ignore) params.set('ignore', ignore)
    if (json.taboo_id != null) params.set('taboo', String(json.taboo_id))
    return request('resolve?' + params, fetchImpl)
  }
  return request(`${parsed.kind}/${encodeURIComponent(parsed.id)}`, fetchImpl)
}

const typeOrder = { asset: 0, event: 1, skill: 2 }

/**
 * 根据当前构筑数据给出导入方案。
 * @returns {{ investigator, mismatch: boolean, codes: string[], auto: object[], blocked: object[], notes: string[], errors: string[], ready: boolean }}
 */
export function planArkhamDbImport(deck, { investigators = [], cardPool = [], currentCode } = {}) {
  const investigator = investigators.find(item => item.code === deck.investigatorCode) || null
  const notes = [], auto = [], blocked = []
  if (!investigator) {
    return { investigator: null, mismatch: deck.investigatorCode !== currentCode, codes: [], auto, notes, errors: [],
      blocked: [{ code: deck.investigatorCode, name: deck.investigatorName, count: 1, reason: '调查员尚未实现' }], ready: false }
  }
  const pool = new Map(cardPool.map(card => [card.code, card]))
  const allowed = new Set(investigator.allowedCards || [])
  const fixed = new Set([...(investigator.signatureCards || []), ...(investigator.signatureWeaknesses || [])].map(card => card.code))
  const codes = []
  for (const entry of deck.entries || []) {
    const card = pool.get(entry.code)
    const item = { code: entry.code, name: card?.name || entry.name || entry.code, count: entry.count }
    const block = reason => blocked.push({ ...item, reason })
    if (fixed.has(entry.code) || entry.signatureFor?.includes(investigator.code)) auto.push({ ...item, reason: '专属卡牌，保存时自动加入' })
    else if (entry.subtype === 'basicweakness') auto.push({ ...item, reason: '基础弱点由系统随机抽取' })
    else if (!entry.known) block('图鉴中不存在该卡')
    else if (entry.signatureFor) block('其他调查员的专属卡牌')
    else if (entry.subtype || !PLAYER_TYPES.has(entry.type)) block('不是可加入牌库的普通玩家卡')
    else if (!card) block('尚未实现')
    else if (!allowed.has(entry.code)) block((card.xp || 0) > 0 ? `${card.xp} 级卡，开局牌组只能使用 0 级卡` : `不符合${investigator.name}的构筑限制`)
    else for (let i = 0; i < entry.count; i++) codes.push(entry.code)
  }
  if (deck.tabooId) notes.push('本牌组使用了禁限卡表，导入时按原始卡牌规则处理。')
  if (deck.sideCount) notes.push(`已忽略备选区的 ${deck.sideCount} 张卡。`)
  if (Object.keys(deck.ignoreDeckLimit || {}).length) notes.push('ArkhamDB 中「不计入牌库张数」的标记不会保留。')
  codes.sort((a, b) => {
    const x = pool.get(a), y = pool.get(b)
    return (typeOrder[x.type] ?? 9) - (typeOrder[y.type] ?? 9) || (x.cost ?? 99) - (y.cost ?? 99) || String(x.name).localeCompare(String(y.name), 'zh') || a.localeCompare(b)
  })
  const cardMap = Object.fromEntries(cardPool.filter(card => allowed.has(card.code)).map(card => [card.code, card]))
  if (investigator.rules) registerDeckRules(investigator.code, investigator.rules)
  const errors = blocked.length ? [] : validateDeckRules(investigator, codes, cardMap).errors
  return { investigator, mismatch: investigator.code !== currentCode, codes, auto, blocked, notes, errors, ready: !blocked.length }
}
