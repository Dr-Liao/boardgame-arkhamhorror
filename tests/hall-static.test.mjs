// P1.4 Arkham × 大厅联机集成：真实 hub 开局（state.cards ≈833KB）下，
//   - 旧客户端（不声明）仍拿完整视图；
//   - 新客户端首份带 static 信封，命中版本后省略两表且响应字节下降 >50%；
//   - 房主与 guest 大厅 hydrate 后都与全量视图逐字节一致；
//   - guest 大厅缓存静态表：浏览器刷新（新客户端无缓存）由本地大厅补发，不向房主要全量。
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRelay } from '../../../relay/server.js'
import { createServer } from '../../../lib/server.js'
import { loadMods } from '../../../lib/mods.js'

const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)))
const stop = server => new Promise(resolve => { server.stopRelay?.(); server.online?.close(); server.closeAllConnections(); server.close(resolve) })
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
async function waitFor(fn, timeout = 10000) {
  const end = Date.now() + timeout
  while (Date.now() < end) { const value = await fn(); if (value) return value; await sleep(25) }
  throw new Error('等待状态同步超时')
}

async function fixture(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arkham-static-'))
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = home
  const mods = (await loadMods({ userDir: null })).filter(mod => mod.id === 'arkhamhorror')
  const relay = createRelay({ secret: 'arkham-static-secret' })
  const relayUrl = await listen(relay)
  const halls = []
  for (let i = 0; i < 2; i++) {
    const server = createServer({ mods, persist: false }); await server.ready
    const origin = await listen(server)
    const call = async (route, body) => {
      const res = await fetch(origin + '/api/online/' + route, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'x-boardgame-online': '1', 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      })
      const text = await res.text()
      return { json: JSON.parse(text), bytes: Buffer.byteLength(text) }
    }
    const command = (action, body = {}) => call('command', { action, body: { operationId: randomUUID(), ...body } })
    halls.push({ server, origin, call, command })
  }
  t.after(async () => {
    await Promise.all(halls.map(hall => stop(hall.server))); await stop(relay)
    if (previous === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previous
    fs.rmSync(home, { recursive: true, force: true })
  })
  return { halls, relayUrl }
}

function functionalView(view) {
  const copy = structuredClone(view)
  delete copy.staticVersion
  if (copy.state) { delete copy.state.privateCards; delete copy.state.cardsPatch }
  return copy
}
function hydrate(view, staticInfo) {
  const privateCards = view.state?.privateCards
  const cards = privateCards && Object.keys(privateCards).length
    ? { ...staticInfo.cards, ...privateCards }
    : staticInfo.cards
  return { ...view, state: { ...view.state, cards, investigatorDefs: staticInfo.investigatorDefs } }
}

test('Arkham hub 开局：静态表首份带信封、命中省略、hydrate 逐字节一致，字节 >50% 下降', { timeout: 120000 }, async t => {
  const { halls, relayUrl } = await fixture(t)
  const [host, guest] = halls
  const created = await host.call('create', { relayUrl, modId: 'arkhamhorror', capacity: 2, fillAi: false, settings: { seed: 'arkham-static' } })
  assert.equal(created.json.ok, true, created.json.error)
  assert.equal((await guest.call('join', { relayUrl, code: created.json.room.code })).json.ok, true)
  await guest.call('ready', { ready: true })
  const started = await host.command('start')
  assert.equal(started.json.ok, true, started.json.error)
  const revision = started.json.session.state.revision
  await waitFor(async () => (await guest.call('status')).json.session?.state?.revision === revision)

  // 旧客户端：完整视图（cards 833KB 量级），行为不变。
  const legacy = await host.call('status')
  assert.ok(legacy.json.session.state.cards, '旧客户端必须拿 cards')
  assert.ok(Buffer.byteLength(JSON.stringify(legacy.json.session.state.cards)) > 700 * 1024, 'hub 开局 cards 应约 833KB')
  assert.equal(legacy.json.session.staticVersion, undefined)

  // 新客户端首份：精简视图 + static 信封。
  const fresh = await host.call('status?clientStatic=')
  assert.equal(fresh.json.session.state.cards, undefined)
  assert.equal(typeof fresh.json.session.staticVersion, 'string')
  assert.equal(fresh.json.static?.version, fresh.json.session.staticVersion)
  const version = fresh.json.session.staticVersion
  assert.deepEqual(functionalView(hydrate(fresh.json.session, fresh.json.static)), functionalView(legacy.json.session))

  // 命中版本：不再带 static，字节相对全量下降 >50%。
  const hit = await host.call('status?clientStatic=' + encodeURIComponent(version))
  assert.equal(hit.json.static, undefined)
  assert.ok(hit.bytes * 2 < legacy.bytes, `命中后应小于全量一半（${hit.bytes} vs ${legacy.bytes}）`)
  assert.deepEqual(functionalView(hydrate(hit.json.session, fresh.json.static)), functionalView(legacy.json.session))

  // 房主命令响应：声明版本时省略静态表，hydrate 后与当前全量一致；旧客户端仍是全量。
  const fullCommand = await host.command('save')
  assert.ok(fullCommand.json.session.state.cards, '未声明的房主命令响应仍为全量')
  const slimCommand = await host.command('save', { client: { staticVersion: version } })
  assert.equal(slimCommand.json.session.state.cards, undefined)
  assert.deepEqual(functionalView(hydrate(slimCommand.json.session, fresh.json.static)), functionalView(fullCommand.json.session))

  // guest 大厅：同样是精简视图 + 本地缓存补发；刷新（无缓存声明）也能直接拿到静态表。
  const guestLegacy = await guest.call('status')
  assert.ok(guestLegacy.json.session.state.cards, '旧客户端在 guest 大厅仍拿完整视图')
  const guestFresh = await guest.call('status?clientStatic=')
  assert.equal(guestFresh.json.static?.version, version, 'guest 大厅缓存的是房主下发的同一版本')
  const guestHit = await guest.call('status?clientStatic=' + encodeURIComponent(version))
  assert.equal(guestHit.json.static, undefined)
  assert.ok(guestHit.bytes * 2 < guestLegacy.bytes)
  assert.deepEqual(functionalView(hydrate(guestHit.json.session, guestFresh.json.static)), functionalView(guestLegacy.json.session))
  assert.deepEqual(functionalView(hydrate(guestFresh.json.session, guestFresh.json.static)), functionalView(guestLegacy.json.session))

  // 刷新不触发房主重发。
  const snapshotsBefore = host.server.online.metrics.snapshots
  await guest.call('status?clientStatic=')
  await sleep(80)
  assert.equal(host.server.online.metrics.snapshots, snapshotsBefore, 'guest 浏览器刷新不向房主要全量')
})
