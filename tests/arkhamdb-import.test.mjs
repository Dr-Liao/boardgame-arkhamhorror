import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseArkhamDbInput, loadArkhamDbDeck, planArkhamDbImport } from '../web/arkhamdb-import.js'
import { describeArkhamDbDeck, fetchArkhamDbDeck, resolveArkhamDbDeck, clearArkhamDbCache, canonicalCode } from '../src/integration/arkhamdb.js'
import { handleApi } from '../src/integration/web-api.js'
import { buildDeck, buildDeckFromList, deckBuilderData } from '../src/deck/deckbuilding.js'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { PLAYER_CARD_CODES } from '../src/deck/availability.js'

const data = deckBuilderData()
const roland = INVESTIGATORS['01001']
const legal = buildDeck(roland, { seed: 'arkhamdb' }).playerCards
const slotsOf = codes => codes.reduce((out, code) => ({ ...out, [code]: (out[code] || 0) + 1 }), {})
// Use a Revised Core reprint code where one exists, as ArkhamDB decks often do.
const reprint = code => (ALL_CARDS[code]?.duplicatedBy || []).find(alias => ALL_CARDS[alias]?.duplicateOfCode === code)
function arkhamDbJson(extra = {}) {
  const slots = {}
  for (const [code, count] of Object.entries(slotsOf(legal))) { const key = reprint(code) || code; slots[key] = (slots[key] || 0) + count }
  return { id: 4242, name: '罗兰测试', investigator_code: reprint('01001') || '01001', slots: { ...slots, '01006': 1, '01007': 1, '01000': 1, ...extra }, sideSlots: [], taboo_id: null }
}
const plan = (deck, currentCode = '01001') => planArkhamDbImport(deck, { investigators: data.investigators, cardPool: data.cardPool, currentCode })

test('解析 ArkhamDB 链接、编号与 JSON', () => {
  assert.deepEqual(parseArkhamDbInput('https://arkhamdb.com/decklist/view/12345/roland-1.0'), { kind: 'decklist', id: '12345' })
  assert.deepEqual(parseArkhamDbInput('arkhamdb.com/deck/view/678'), { kind: 'deck', id: '678' })
  assert.deepEqual(parseArkhamDbInput('https://zh.arkhamdb.com/deck/edit/9'), { kind: 'deck', id: '9' })
  assert.deepEqual(parseArkhamDbInput('https://arkhamdb.com/api/public/decklist/55.json'), { kind: 'decklist', id: '55' })
  assert.deepEqual(parseArkhamDbInput(' 777 '), { kind: 'auto', id: '777' })
  assert.ok(parseArkhamDbInput('{"investigator_code":"01001","slots":{}}').json)
  for (const bad of ['', 'https://example.com/decklist/view/1', 'https://arkhamdb.com/card/01030', '{oops', '{"name":"x"}']) assert.ok(parseArkhamDbInput(bad).error, bad)
})

test('重印卡号回到原版，签名卡与基础弱点自动处理，可构筑牌组可直接保存', () => {
  if (reprint('01030')) assert.equal(canonicalCode(reprint('01030')), '01030')
  const deck = describeArkhamDbDeck(arkhamDbJson(), { kind: 'decklist', id: '4242' })
  assert.equal(deck.investigatorCode, '01001')
  assert.equal(deck.url, 'https://arkhamdb.com/decklist/view/4242')
  const result = plan(deck)
  assert.equal(result.ready, true)
  assert.equal(result.mismatch, false)
  assert.deepEqual(result.errors, [])
  assert.deepEqual([...result.codes].sort(), [...legal].sort())
  assert.deepEqual(result.auto.map(item => item.code).sort(), ['01000', '01006', '01007'])
  assert.deepEqual(buildDeckFromList(roland, result.codes).errors, [])
})

test('牌组含未实现卡牌时整副拒绝导入', () => {
  const missing = Object.values(ALL_CARDS).find(card => ['asset', 'event', 'skill'].includes(card.type) && !card.subtype && !card.signatureFor
    && !PLAYER_CARD_CODES.includes(card.code) && !card.duplicateOfCode)
  const result = plan(describeArkhamDbDeck(arkhamDbJson({ [missing.code]: 1, '99999': 2 })))
  assert.equal(result.ready, false)
  assert.deepEqual(result.blocked.map(item => item.reason).sort(), ['图鉴中不存在该卡', '尚未实现'].sort())
  const other = plan(describeArkhamDbDeck(arkhamDbJson({ '01008': 1 })))
  assert.equal(other.ready, false)
  assert.match(other.blocked[0].reason, /其他调查员/)
})

test('调查员不同或未实现时给出明确提示', () => {
  const deck = describeArkhamDbDeck(arkhamDbJson())
  assert.equal(plan(deck, '01002').mismatch, true)
  const unknown = plan(describeArkhamDbDeck({ investigator_code: '12345', slots: { '01030': 2 } }))
  assert.equal(unknown.ready, false)
  assert.match(unknown.blocked[0].reason, /调查员尚未实现/)
  assert.throws(() => describeArkhamDbDeck({ investigator_code: '01001', slots: { '01030': -1 } }), RangeError)
  assert.throws(() => describeArkhamDbDeck({ investigator_code: '01001', slots: {} }), RangeError)
})

test('服务端代理依次尝试已发布牌组与公开分享牌组，并缓存结果', async () => {
  clearArkhamDbCache()
  const urls = []
  const fetchImpl = async url => {
    urls.push(url)
    if (url.includes('/decklist/')) return new Response('not found', { status: 404 })
    return new Response(JSON.stringify(arkhamDbJson()), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const result = await fetchArkhamDbDeck('auto', '4242', { fetchImpl })
  assert.equal(result.body.deck.kind, 'deck')
  assert.deepEqual(urls, ['https://arkhamdb.com/api/public/decklist/4242', 'https://arkhamdb.com/api/public/deck/4242'])
  await fetchArkhamDbDeck('deck', '4242', { fetchImpl })
  assert.equal(urls.length, 2)
  assert.equal((await fetchArkhamDbDeck('auto', '1', { fetchImpl: async () => new Response('{}', { status: 200 }) })).status, 404)
  assert.equal((await fetchArkhamDbDeck('auto', '2', { fetchImpl: async () => { throw new TypeError('fetch failed') } })).status, 502)
  assert.equal((await fetchArkhamDbDeck('decklist', 'abc', { fetchImpl })).status, 400)
  assert.equal((await fetchArkhamDbDeck('other', '1', { fetchImpl })).status, 400)
})

test('粘贴的 JSON 经 resolve 接口离线规范化', async () => {
  let requested
  const fetchImpl = async url => {
    requested = new URL(url, 'http://hall.local')
    assert.equal(requested.pathname, '/api/mods/arkhamhorror/arkhamdb/resolve')
    const result = await handleApi({ path: 'arkhamdb/resolve', searchParams: requested.searchParams })
    return new Response(JSON.stringify({ ok: true, ...result.body }), { status: 200 })
  }
  const deck = await loadArkhamDbDeck(parseArkhamDbInput(JSON.stringify(arkhamDbJson())), { fetchImpl })
  assert.equal(deck.name, '罗兰测试')
  assert.equal(plan(deck).ready, true)
  assert.throws(() => resolveArkhamDbDeck(new URLSearchParams('investigator=01001&slots=01030:x')), RangeError)
})
