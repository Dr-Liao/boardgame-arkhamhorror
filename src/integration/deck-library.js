// 本地卡组库：玩家个人收藏的牌组，与对局存档分离，存于
// <DSH_HOME 或 ~/.dsh>/boardgame-hall/arkhamhorror/decks.json。
//
// 只保存普通卡清单（与 ArkhamDB 的 investigator_code / slots 字段一致），不校验可构筑性，
// 未完成的草稿也能收藏；载入时按 ArkhamDB 导入同样的流程预检，最终仍由 hubSetDeck 校验。

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { ALL_CARDS } from '../cards/cards-data.js'
import { describeArkhamDbDeck, slotEntries } from './arkhamdb.js'

const SCHEMA = 1
const MAX_DECKS = 500
const MAX_NAME = 60
const ID = /^[0-9a-f-]{36}$/

export function deckLibraryFile() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(home, 'boardgame-hall', 'arkhamhorror', 'decks.json')
}

function readLibrary() {
  const file = deckLibraryFile()
  let text
  try { text = fs.readFileSync(file, 'utf8') } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  try {
    const data = JSON.parse(text)
    if (data?.schema === SCHEMA && Array.isArray(data.decks)) return data.decks
  } catch { /* isolated below */ }
  // A damaged library is kept aside rather than silently overwritten.
  fs.renameSync(file, `${file}.bad-${Date.now()}`)
  return []
}

function writeLibrary(decks) {
  const file = deckLibraryFile()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = file + '.' + process.pid + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify({ schema: SCHEMA, decks }, null, 1), 'utf8')
  fs.renameSync(tmp, file)
}

function normalizeInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RangeError('卡组数据无效')
  const investigator = String(body.investigator_code ?? '')
  if (ALL_CARDS[investigator]?.type !== 'investigator') throw new RangeError('未知调查员：' + investigator.slice(0, 20))
  const slots = {}
  for (const [code, count] of slotEntries(body.slots, '卡牌清单')) {
    if (!ALL_CARDS[code]) throw new RangeError('图鉴中不存在该卡：' + code)
    slots[code] = count
  }
  const name = String(body.name ?? '').trim().slice(0, MAX_NAME) || '未命名牌组'
  return { name, investigator_code: investigator, slots }
}

function view(deck) {
  let description = null
  try { description = describeArkhamDbDeck(deck) } catch { /* empty decks have nothing to load */ }
  return { ...deck, description }
}

const byRecent = (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))

/** @returns {{ body?: object, status?: number, error?: string } | null} */
export function handleDeckLibrary({ method, path: route, body }) {
  if (route === 'decks') {
    if (method === 'GET' || method === 'HEAD') return { body: { decks: readLibrary().sort(byRecent).map(view) } }
    if (method !== 'POST') return { status: 405, error: '不支持的请求方式' }
    const decks = readLibrary()
    if (decks.length >= MAX_DECKS) return { status: 409, error: `卡组库最多保存 ${MAX_DECKS} 副牌组，请先删除不需要的牌组` }
    const now = new Date().toISOString()
    const deck = { id: randomUUID(), ...normalizeInput(body), createdAt: now, updatedAt: now }
    decks.push(deck)
    writeLibrary(decks)
    return { body: { deck: view(deck) } }
  }
  if (!route.startsWith('decks/')) return null
  const id = route.slice('decks/'.length)
  if (!ID.test(id)) return { status: 400, error: '无效的卡组编号' }
  const decks = readLibrary()
  const index = decks.findIndex(deck => deck.id === id)
  if (index < 0) return { status: 404, error: '卡组不存在或已被删除' }
  if (method === 'PUT') {
    decks[index] = { ...decks[index], ...normalizeInput(body), updatedAt: new Date().toISOString() }
    writeLibrary(decks)
    return { body: { deck: view(decks[index]) } }
  }
  if (method === 'DELETE') {
    decks.splice(index, 1)
    writeLibrary(decks)
    return { body: { deleted: id } }
  }
  return { status: 405, error: '不支持的请求方式' }
}
