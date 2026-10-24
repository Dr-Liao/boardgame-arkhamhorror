// ArkhamDB 牌组导入：解析用户输入 → 经本 Mod 只读接口拉取/规范化 → 生成构筑草稿。
// 只有牌组内所有普通卡都已实现且可用于当前调查员 0 XP 开局时才允许载入；
// 签名卡、专属弱点与基础弱点由服务端在保存时自动加入，导入时跳过。
import { registerDeckRules, validateDeckRules } from './deck-rules.js'
import { t, getLocale } from './i18n.js'

const API_ROOT = '/api/mods/arkhamhorror/arkhamdb/'
const PLAYER_TYPES = new Set(['asset', 'event', 'skill'])

/** @returns {{ kind: 'decklist'|'deck'|'auto', id: string } | { json: object } | { error: string }} */
export function parseArkhamDbInput(text) {
  const value = String(text ?? '').trim()
  if (!value) return { error: t('misc.import.empty') }
  if (value.startsWith('{')) {
    try {
      const json = JSON.parse(value)
      if (!json || typeof json !== 'object' || !json.investigator_code || !json.slots) return { error: t('misc.import.missingFields') }
      return { json }
    } catch { return { error: t('misc.import.badJson') } }
  }
  if (/^\d{1,10}$/.test(value)) return { kind: 'auto', id: value }
  let url
  try { url = new URL(/^[a-z]+:\/\//i.test(value) ? value : 'https://' + value) } catch { return { error: t('misc.import.badUrl') } }
  if (!/^(?:[a-z-]+\.)?arkhamdb\.com$/i.test(url.hostname)) return { error: t('misc.import.host') }
  const match = url.pathname.match(/\/(?:api\/public\/)?(decklist|deck)\/(?:(?:view|edit|export\/[a-z]+)\/)?(\d{1,10})(?:[/.]|$)/i)
  if (!match) return { error: t('misc.import.noDeckId') }
  return { kind: match[1].toLowerCase(), id: match[2] }
}

const slotQuery = slots => Object.entries(slots && typeof slots === 'object' && !Array.isArray(slots) ? slots : {})
  .filter(([, count]) => Number(count) > 0).map(([code, count]) => `${code}:${Number(count)}`).join(',')

async function request(path, fetchImpl) {
  let response
  try { response = await fetchImpl(API_ROOT + path, { signal: AbortSignal.timeout(20000) }) } catch (error) {
    throw new Error(error?.name === 'TimeoutError' ? t('misc.import.timeout') : t('misc.import.network'))
  }
  let value
  try { value = await response.json() } catch { throw new Error(t('misc.import.badResponse')) }
  if (!response.ok || !value.ok || !value.deck) throw new Error(value.error || t('misc.import.failed'))
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
      blocked: [{ code: deck.investigatorCode, name: deck.investigatorName, count: 1, reason: t('misc.import.investigatorMissing') }], ready: false }
  }
  const pool = new Map(cardPool.map(card => [card.code, card]))
  const allowed = new Set(investigator.allowedCards || [])
  const fixed = new Set([...(investigator.signatureCards || []), ...(investigator.signatureWeaknesses || [])].map(card => card.code))
  const codes = []
  for (const entry of deck.entries || []) {
    const card = pool.get(entry.code)
    const item = { code: entry.code, name: card?.name || entry.name || entry.code, count: entry.count }
    const block = reason => blocked.push({ ...item, reason })
    if (fixed.has(entry.code) || entry.signatureFor?.includes(investigator.code)) auto.push({ ...item, reason: t('misc.import.autoSignature') })
    else if (entry.subtype === 'basicweakness') auto.push({ ...item, reason: t('misc.import.autoWeakness') })
    else if (!entry.known) block(t('misc.import.notInCatalog'))
    else if (entry.signatureFor) block(t('misc.import.otherSignature'))
    else if (entry.subtype || !PLAYER_TYPES.has(entry.type)) block(t('misc.import.notPlayerCard'))
    else if (!card) block(t('misc.import.notImplemented'))
    else if (!allowed.has(entry.code)) block((card.xp || 0) > 0 ? t('misc.import.xpTooHigh', { xp: card.xp }) : t('misc.import.restriction', { name: investigator.name }))
    else for (let i = 0; i < entry.count; i++) codes.push(entry.code)
  }
  if (deck.tabooId) notes.push(t('misc.import.taboo'))
  if (deck.sideCount) notes.push(t('misc.import.side', { count: deck.sideCount }))
  if (Object.keys(deck.ignoreDeckLimit || {}).length) notes.push(t('misc.import.ignoreLimit'))
  codes.sort((a, b) => {
    const x = pool.get(a), y = pool.get(b)
    return (typeOrder[x.type] ?? 9) - (typeOrder[y.type] ?? 9) || (x.cost ?? 99) - (y.cost ?? 99) || String(x.name).localeCompare(String(y.name), getLocale()) || a.localeCompare(b)
  })
  const cardMap = Object.fromEntries(cardPool.filter(card => allowed.has(card.code)).map(card => [card.code, card]))
  if (investigator.rules) registerDeckRules(investigator.code, investigator.rules)
  const errors = blocked.length ? [] : validateDeckRules(investigator, codes, cardMap).errors
  return { investigator, mismatch: investigator.code !== currentCode, codes, auto, blocked, notes, errors, ready: !blocked.length }
}
