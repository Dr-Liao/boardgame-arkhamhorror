import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createServer } from '../../../lib/server.js'
import arkham from '../index.js'
import { deckLibraryFile } from '../src/integration/deck-library.js'
import { codesToSlots } from '../web/deck-library.js'
import { planArkhamDbImport } from '../web/arkhamdb-import.js'
import { buildDeck, deckBuilderData } from '../src/deck/deckbuilding.js'
import { INVESTIGATORS } from '../src/cards/cards-data.js'

const roland = INVESTIGATORS['01001']
const legal = buildDeck(roland, { seed: 'library' }).playerCards

async function withHall(run) {
  const previous = process.env.DSH_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arkham-decks-'))
  process.env.DSH_HOME = home
  const server = createServer({ mods: [arkham] })
  try {
    await server.ready
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const base = `http://127.0.0.1:${server.address().port}/api/mods/arkhamhorror/`
    const request = async (method, route, body, headers = {}) => {
      const response = await fetch(base + route, { method, headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body) })
      return { status: response.status, cache: response.headers.get('cache-control'), ...await response.json() }
    }
    await run(request, home)
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    fs.rmSync(home, { recursive: true, force: true })
  }
}

test('本地卡组库：保存、覆盖、列出、删除，与存档目录分离', { timeout: 30000 }, () => withHall(async (request, home) => {
  const empty = await request('GET', 'decks')
  assert.equal(empty.status, 200)
  assert.deepEqual(empty.decks, [])
  assert.equal(empty.cache, 'no-store')

  const draft = legal.slice(0, 10)
  const created = await request('POST', 'decks', { name: '  罗兰草稿  ', investigator_code: '01001', slots: codesToSlots(draft) })
  assert.equal(created.status, 200, created.error)
  assert.equal(created.deck.name, '罗兰草稿')
  assert.equal(created.deck.description.investigatorCode, '01001')
  assert.equal(created.deck.description.entries.reduce((sum, entry) => sum + entry.count, 0), 10)
  assert.ok(deckLibraryFile().startsWith(home))
  assert.ok(fs.existsSync(deckLibraryFile()))
  assert.ok(!fs.existsSync(path.join(home, 'boardgame-hall', 'sessions')), '卡组库不写入存档目录')

  const updated = await request('PUT', 'decks/' + created.deck.id, { name: '罗兰完整', investigator_code: '01001', slots: codesToSlots(legal) })
  assert.equal(updated.status, 200, updated.error)
  assert.equal(updated.deck.createdAt, created.deck.createdAt)
  const second = await request('POST', 'decks', { investigator_code: '01001', slots: { [legal[0]]: 1 } })
  assert.equal(second.deck.name, '未命名牌组')

  const listed = await request('GET', 'decks')
  assert.deepEqual(listed.decks.map(deck => deck.id).sort(), [created.deck.id, second.deck.id].sort())
  const full = listed.decks.find(deck => deck.id === created.deck.id)
  const data = deckBuilderData()
  const plan = planArkhamDbImport(full.description, { investigators: data.investigators, cardPool: data.cardPool, currentCode: '01001' })
  assert.equal(plan.ready, true)
  assert.deepEqual([...plan.codes].sort(), [...legal].sort(), '载入后的草稿与收藏时一致')

  assert.equal((await request('DELETE', 'decks/' + second.deck.id)).status, 200)
  assert.equal((await request('DELETE', 'decks/' + second.deck.id)).status, 404)
  assert.deepEqual((await request('GET', 'decks')).decks.map(deck => deck.id), [created.deck.id])
}))

test('本地卡组库拒绝无效数据、跨站请求与非 JSON 写入', { timeout: 30000 }, () => withHall(async request => {
  for (const body of [
    { investigator_code: '01030', slots: {} },
    { investigator_code: 'nope', slots: {} },
    { investigator_code: '01001', slots: { '99999x': 1 } },
    { investigator_code: '01001', slots: { [legal[0]]: -1 } },
    { investigator_code: '01001', slots: [legal[0]] },
  ]) assert.equal((await request('POST', 'decks', body)).status, 400, JSON.stringify(body))
  assert.equal((await request('PUT', 'decks/not-an-id', { investigator_code: '01001', slots: {} })).status, 400)
  assert.equal((await request('POST', 'decks', { investigator_code: '01001', slots: {} }, { origin: 'https://evil.example' })).status, 405)
  assert.equal((await request('POST', 'decks', undefined, { 'content-type': 'text/plain' })).status, 405)
  assert.equal((await request('GET', 'decks')).decks.length, 0)
}))

test('损坏的卡组库文件被隔离而不是覆盖', { timeout: 30000 }, () => withHall(async () => {
  fs.mkdirSync(path.dirname(deckLibraryFile()), { recursive: true })
  fs.writeFileSync(deckLibraryFile(), '{oops')
  const { handleDeckLibrary } = await import('../src/integration/deck-library.js')
  assert.deepEqual(handleDeckLibrary({ method: 'GET', path: 'decks' }).body.decks, [])
  assert.ok(fs.readdirSync(path.dirname(deckLibraryFile())).some(name => name.startsWith('decks.json.bad-')))
}))
