// 诡镇在大厅联机层上的集成回归：多人私有信息、同时准备、批量确认、AI 队友与四人长跑。
// 大厅自身的联机机制由 tests/hall/online.test.mjs 用测试专用 Mod 覆盖；这里只验证诡镇的规则与投影。
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
async function waitFor(fn, timeout = 6000) {
  const end = Date.now() + timeout
  while (Date.now() < end) { const value = await fn(); if (value) return value; await new Promise(r => setTimeout(r, 30)) }
  throw new Error('等待状态同步超时')
}
async function fixture(t, count = 2) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arkham-online-'))
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = home
  const mods = (await loadMods({ userDir: null })).filter(mod => mod.id === 'arkhamhorror')
  const relay = createRelay({ secret: 'integration-test-secret' }), relayUrl = await listen(relay)
  const halls = []
  for (let i = 0; i < count; i++) {
    const server = createServer({ mods, persist: false }); await server.ready
    const origin = await listen(server)
    const call = async (route, body) => {
      const res = await fetch(origin + '/api/online/' + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'x-boardgame-online': '1', 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) })
      return res.json()
    }
    const command = (action, body = {}) => call('command', { action, body: { operationId: randomUUID(), ...body } })
    halls.push({ server, origin, call, command })
  }
  t.after(async () => {
    await Promise.all(halls.map(h => stop(h.server))); await stop(relay)
    if (previous === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previous
    fs.rmSync(home, { recursive: true, force: true })
  })
  return { halls, relay, relayUrl, mods }
}

test('Arkham supports three human seats, private hands and private chat projection', async t => {
  const { halls: [host, guest, third], relayUrl } = await fixture(t, 3)
  const created = await host.call('create', { relayUrl, modId: 'arkhamhorror', capacity: 3, settings: { difficulty: 'easy' }, fillAi: false })
  for (const hall of [guest, third]) {
    assert.equal((await hall.call('join', { relayUrl, code: created.room.code })).ok, true)
    await hall.call('ready', { ready: true })
  }
  const start = await host.command('start')
  assert.equal(start.ok, true, start.error)
  await waitFor(async () => (await third.call('status')).session)
  const other = (await third.call('status')).session
  assert.equal(other.mySeat, 2)
  assert.deepEqual(other.state.humanSeats, [0, 1, 2])
  assert.deepEqual(other.settings, {})
  for (const inv of other.state.investigators.filter(inv => inv.seat !== 2)) assert.deepEqual(inv.hand, [])
  await guest.command('chat', { text: '仅第二和第三位可见', to: 2 })
  await waitFor(async () => (await third.call('status')).session.events.some(e => e.text === '仅第二和第三位可见'))
  assert.equal((await host.call('status')).session.events.some(e => e.text === '仅第二和第三位可见'), false)
  const session = (await host.call('status')).session
  assert.ok(session.state.legalMoves.length > 0)
  const moved = await host.command('move', { revision: session.state.revision, move: session.state.legalMoves[0] })
  assert.equal(moved.ok, true, moved.error)
})

test('Arkham human seats prepare investigators and decks at the same time', async t => {
  const { halls: [host, guest], relayUrl } = await fixture(t)
  const created = await host.call('create', { relayUrl, modId: 'arkhamhorror', capacity: 2, settings: { seed: 'concurrent-hub' }, fillAi: false })
  assert.equal((await guest.call('join', { relayUrl, code: created.room.code })).ok, true)
  await guest.call('ready', { ready: true })
  assert.equal((await host.command('start')).ok, true)
  const opened = await host.command('move', { revision: (await host.call('status')).session.state.revision,
    move: { action: 'hubGoSetup' } })
  assert.equal(opened.ok, true, opened.error)
  const seen = await waitFor(async () => {
    const view = (await guest.call('status')).session
    return view?.state.revision === opened.session.state.revision && view
  })
  assert.deepEqual(seen.actingSeats, [0, 1])
  const guestPicks = seen.state.legalMoves.filter(move => move.action === 'hubSelectInvestigator')
  assert.ok(guestPicks.length > 1, 'guest can choose while the host is still preparing')
  const stale = seen.state.revision
  const hostPick = guestPicks[0], guestPick = guestPicks[1]
  assert.equal((await host.command('move', { revision: stale, move: hostPick })).ok, true)
  const reserved = await guest.command('move', { revision: stale, move: hostPick })
  assert.equal(reserved.ok, false, 'a teammate’s pick is reserved')
  const picked = await guest.command('move', { revision: stale, move: guestPick })
  assert.equal(picked.ok, true, picked.error)
  assert.equal(picked.session.state.investigators[1].code, guestPick.code)
  for (const [hall, action] of [[guest, 'hubAutoDeck'], [host, 'hubAutoDeck'], [guest, 'hubDoneSeat']]) {
    const result = await hall.command('move', { revision: stale, move: { action } })
    assert.equal(result.ok, true, `${action}: ${result.error}`)
  }
  const afterGuest = (await host.call('status')).session
  assert.deepEqual(afterGuest.actingSeats, [0])
  assert.ok(!afterGuest.state.hubReady)
  const done = await host.command('move', { revision: afterGuest.state.revision, move: { action: 'hubDoneSeat' } })
  assert.equal(done.ok, true, done.error)
  assert.equal(done.session.state.hubReady, true)
  assert.deepEqual(done.session.actingSeats, [0])
  const late = await guest.command('move', { revision: stale, move: { action: 'hubSetLeader', leadSeat: 1 } })
  assert.equal(late.ok, false, 'team decisions keep strict revisions and seat ownership')
})

test('Arkham confirms several staged mulligan cards atomically in one online command', async t => {
  const { halls: [host, guest], relayUrl } = await fixture(t)
  const created = await host.call('create', { relayUrl, modId: 'arkhamhorror', capacity: 2,
    settings: { legacyAutoStart: true, seed: 'batch-mulligan' }, fillAi: false })
  assert.equal(created.ok, true, created.error)
  assert.equal((await guest.call('join', { relayUrl, code: created.room.code })).ok, true)
  await guest.call('ready', { ready: true })
  const started = await host.command('start')
  assert.equal(started.ok, true, started.error)
  const before = started.session
  assert.equal(before.state.pendingChoice?.kind, 'mulligan')
  const hand = before.state.investigators[0].hand
  assert.ok(hand.length >= 3)
  const batchChoices = { choiceId: before.state.pendingChoice.id, kind: 'mulligan',
    selected: [{ index: 0, code: hand[0] }, { index: 2, code: hand[2] }], finish: 'done' }
  const bad = await host.command('move', { revision: before.state.revision,
    batchChoices: { ...batchChoices, selected: [{ index: 0, code: hand[0] }, { index: 2, code: 'forged' }] } })
  assert.equal(bad.ok, false)
  assert.equal((await host.call('status')).session.state.revision, before.state.revision, 'failed batch cannot commit a partial mulligan')
  const invalidFinish = await host.command('move', { revision: before.state.revision,
    batchChoices: { ...batchChoices, finish: 'help' } })
  assert.equal(invalidFinish.ok, false)
  assert.equal((await host.call('status')).session.state.revision, before.state.revision, 'a failed final confirmation rolls back earlier valid choices')
  const confirmed = await host.command('move', { revision: before.state.revision, batchChoices })
  assert.equal(confirmed.ok, true, confirmed.error)
  assert.equal(confirmed.session.state.revision, before.state.revision + 3)
  assert.notEqual(confirmed.session.state.pendingChoice?.seat, 0)
  await waitFor(async () => (await guest.call('status')).session?.state.revision === confirmed.session.state.revision)
  assert.deepEqual((await guest.call('status')).session.state.investigators[0].hand, [], 'other players still cannot see the new hand')
})

test('Arkham skill card selection uses the same atomic confirmation and validates the current choice', async t => {
  const { halls, relayUrl } = await fixture(t)
  const created = await halls[0].call('create', { relayUrl, modId: 'arkhamhorror', capacity: 2,
    settings: { legacyAutoStart: true, seed: 'batch-skill-test' }, fillAi: false })
  assert.equal(created.ok, true, created.error)
  assert.equal((await halls[1].call('join', { relayUrl, code: created.room.code })).ok, true)
  await halls[1].call('ready', { ready: true })
  assert.equal((await halls[0].command('start')).ok, true)
  let confirmed = false
  for (let step = 0; step < 80 && !confirmed; step++) {
    const session = (await halls[0].call('status')).session
    const seat = session.decisionSeat
    const view = (await halls[seat].call('status')).session
    const st = view.state, moves = st.legalMoves
    const candidate = st.pendingChoice?.kind === 'commit' && moves.find(move => /^\d+$/.test(move.optionId))
    if (candidate) {
      const index = Number(candidate.optionId), code = st.investigators[seat].hand[index]
      const wrong = await halls[seat].command('move', { revision: st.revision, batchChoices: {
        choiceId: 'stale-choice', kind: 'commit', selected: [{ index, code }], finish: 'done' } })
      assert.equal(wrong.ok, false)
      assert.equal((await halls[0].call('status')).session.state.revision, st.revision)
      const result = await halls[seat].command('move', { revision: st.revision, batchChoices: {
        choiceId: st.pendingChoice.id, kind: 'commit', selected: [{ index, code }], finish: 'done' } })
      assert.equal(result.ok, true, result.error)
      assert.equal(result.session.state.revision, st.revision + 2)
      confirmed = true
      break
    }
    const move = st.pendingChoice
      ? moves.find(item => ['done', 'skip', 'pass', 'keep', '0'].includes(item.optionId)) || moves[0]
      : moves.find(item => item.action === 'investigate') || moves.find(item => item.action === 'endTurn') || moves[0]
    assert.ok(move, `no legal move at ${step}`)
    const result = await halls[seat].command('move', { revision: st.revision, move })
    assert.equal(result.ok, true, result.error)
  }
  assert.equal(confirmed, true, 'expected a skill test with a legal card to commit')
})

test('Arkham host process restart restores the pending choice and private hands; guest can leave and return', async t => {
  const { halls: [initial, guest], relayUrl, mods } = await fixture(t)
  await stop(initial.server)
  const hostServer = createServer({ mods, persist: true }); await hostServer.ready
  const hostUrl = await listen(hostServer)
  const call = async (origin, route, body) => (await fetch(origin + '/api/online/' + route, {
    method: body ? 'POST' : 'GET', headers: { 'x-boardgame-online': '1', 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  })).json()
  const created = await call(hostUrl, 'create', { relayUrl, modId: 'arkhamhorror', capacity: 2, fillAi: false,
    settings: { legacyAutoStart: true, seed: 'online-persistent-choice' } })
  await guest.call('join', { relayUrl, code: created.room.code }); await guest.call('ready', { ready: true })
  const cmd = (origin, action, body = {}) => call(origin, 'command', { action, body: { operationId: randomUUID(), ...body } })
  const started = await cmd(hostUrl, 'start')
  assert.equal(started.ok, true)
  assert.equal((await cmd(hostUrl, 'move', { revision: 0, move: started.session.state.legalMoves.find(m => m.optionId === 'done') })).ok, true)
  await waitFor(async () => (await guest.call('status')).session?.state.revision === 1)
  const before = (await guest.call('status')).session
  await stop(hostServer)
  const replacement = createServer({ mods, persist: true }); await replacement.ready
  const replacementUrl = await listen(replacement)
  t.after(() => stop(replacement))
  await waitFor(async () => (await call(replacementUrl, 'status')).connected)
  assert.equal((await call(replacementUrl, 'status')).session.state.revision, 1)
  await guest.call('leave', {})
  assert.equal((await guest.call('join', { relayUrl, code: created.room.code })).ok, true)
  await waitFor(async () => (await guest.call('status')).session?.state.revision === 1)
  const returned = (await guest.call('status')).session
  assert.equal(returned.state.pendingChoice.id, before.state.pendingChoice.id)
  assert.deepEqual(returned.state.investigators[1].hand, before.state.investigators[1].hand)
  assert.deepEqual(returned.state.investigators[0].hand, [])
  const moved = await guest.command('move', { revision: 1, move: returned.state.legalMoves.find(m => m.optionId === 'done') })
  assert.equal(moved.ok, true, moved.error)
})

test('Arkham human guests and an AI teammate complete preparation and opening choices together', async t => {
  const { halls: [host, guest], relayUrl } = await fixture(t)
  const created = await host.call('create', { relayUrl, modId: 'arkhamhorror', capacity: 3, fillAi: true, settings: { seed: 'mixed-arkham-online' } })
  await guest.call('join', { relayUrl, code: created.room.code }); await guest.call('ready', { ready: true })
  assert.equal((await host.command('start')).ok, true)
  for (let step = 0; step < 24; step++) {
    const s = (await host.call('status')).session
    if (s.state.uiState === 'inScenario' && s.state.pendingChoice?.kind !== 'mulligan') break
    const seat = s.decisionSeat
    assert.ok(seat === 0 || seat === 1, 'the AI runner returns control to a human')
    const hall = seat ? guest : host
    await waitFor(async () => (await hall.call('status')).session?.state.revision === s.state.revision)
    const current = (await hall.call('status')).session
    const moves = current.state.legalMoves
    const move = current.state.pendingChoice ? moves.find(m => ['done', 'skip'].includes(m.optionId)) || moves[0]
      : ['hubGoSetup', 'hubAutoDeck', 'hubDoneSeat', 'hubSelectInvestigator', 'hubBeginScenario', 'hubSetLeader'].map(action => moves.find(m => m.action === action)).find(Boolean)
    assert.ok(move)
    const result = await hall.command('move', { revision: current.state.revision, move })
    assert.equal(result.ok, true, result.error)
  }
  const final = (await host.call('status')).session
  assert.deepEqual(final.players.map(p => p.role), ['human', 'human', 'ai'])
  assert.equal(final.state.uiState, 'inScenario')
  assert.notEqual(final.state.pendingChoice?.kind, 'mulligan')
  assert.deepEqual(final.state.investigators[2].hand, [])
  assert.ok(final.state.campaign.investigators[2].deckSize > 0)
})

test('Arkham four humans: preparation, choices, private tests, round transitions and reconnect', { timeout: 240000 }, async t => {
  const { halls, relay, relayUrl } = await fixture(t, 4)
  const created = await halls[0].call('create', { relayUrl, modId: 'arkhamhorror', capacity: 4, fillAi: false, settings: { seed: 'online-arkham-audit' } })
  assert.equal(created.ok, true, created.error)
  for (const hall of halls.slice(1)) {
    assert.equal((await hall.call('join', { relayUrl, code: created.room.code })).ok, true)
    await hall.call('ready', { ready: true })
  }
  assert.equal((await halls[0].command('start')).ok, true)
  const kinds = new Set(), actors = new Set(), actions = new Set()
  let help = false, privateTest = false, reconnected = false, peak = 0
  async function views() {
    // 一次并行取 4 席视图；只有 revision 不一致时才进入轮询（旧实现固定先取 host 再轮询再重取，
    // 每步最多 9 次 status 请求，而每次 status 都是 ~1.5MB 的全量视图）。
    let sessions = await Promise.all(halls.map(async h => (await h.call('status')).session))
    if (sessions.some(session => !session || session.state.revision !== sessions[0].state.revision)) {
      const revision = sessions[0].state.revision
      await waitFor(async () => (await Promise.all(halls.map(h => h.call('status')))).every(v => v.session?.state.revision === revision))
      sessions = await Promise.all(halls.map(async h => (await h.call('status')).session))
    }
    const revision = sessions[0].state.revision
    for (const [seat, session] of sessions.entries()) {
      assert.equal(session.mySeat, seat)
      assert.equal(session.state.revision, revision)
      peak = Math.max(peak, Buffer.byteLength(JSON.stringify(session)))
      for (const inv of session.state.investigators) if (inv.seat !== seat) {
        assert.deepEqual(inv.hand, [])
        assert.deepEqual(inv.deck, [])
        assert.equal(session.state.campaign.investigators[inv.seat]?.deck, undefined)
      }
      for (const event of session.events) {
        assert.ok(event.privateSeat == null || event.privateSeat === seat)
        for (const inv of (event.tableState || event.presentation?.tableState)?.investigators || []) {
          if (inv.seat !== seat) assert.deepEqual(inv.hand, [])
        }
      }
      if (!session.actingSeats.includes(seat)) assert.deepEqual(session.state.legalMoves, [])
    }
    return sessions
  }
  async function act(seat, move, sessions) {
    const revision = sessions[seat].state.revision
    // During simultaneous preparation an acting teammate would apply the move to their own seat.
    const idle = [1, 2, 3].map(offset => (seat + offset) % 4).find(other => !sessions[seat].actingSeats.includes(other))
    if (idle !== undefined) {
      const wrong = await halls[idle].command('move', { revision, move })
      assert.equal(wrong.ok, false, 'another player cannot answer this decision')
    }
    const result = await halls[seat].command('move', { revision, move })
    assert.equal(result.ok, true, `${seat}: ${JSON.stringify(move)}: ${result.error}`)
    assert.equal(result.session.state.revision, revision + 1)
    actions.add(move.action); actors.add(seat)
    // Relay abuse limit is 600 messages / 10s per socket (~60/s); this test sends well below that
    // even at 150ms per step (~30/s worst case), and `views()` itself waits for revision convergence.
    await new Promise(r => setTimeout(r, 150))
  }
  for (let step = 0; step < 240; step++) {
    const sessions = await views(), seat = sessions[0].decisionSeat
    const session = sessions[seat ?? 0], st = session.state, moves = st.legalMoves
    if (step % 20 === 0) console.log(`Arkham audit step=${step} round=${st.round} phase=${st.phase} choice=${st.pendingChoice?.kind} bytes=${peak}`)
    if (st.uiState === 'scenarioResult' || st.status !== 'playing') break
    assert.ok(moves.length, `no moves: ${st.uiState}/${st.phase}/${seat}`)
    let move
    if (st.pendingChoice) {
      kinds.add(st.pendingChoice.kind)
      if (st.skillTest && !st.skillTest.helpRequested) {
        privateTest = true
        for (const other of sessions.filter(s => s.mySeat !== st.skillTest.seat)) assert.equal(other.state.skillTest, null)
      }
      move = (!help && moves.find(m => m.optionId === 'help')) || moves.find(m => ['done', 'skip', 'pass', 'keep'].includes(m.optionId)) || moves[0]
      if (move.optionId === 'help') help = true
      if (!reconnected && seat > 0 && st.pendingChoice.kind === 'commit') {
        const port = relay.address().port
        await stop(relay)
        await waitFor(async () => (await Promise.all(halls.map(h => h.call('status')))).every(v => !v.connected))
        const replacement = createRelay({ secret: 'integration-test-secret' })
        await new Promise(r => replacement.listen(port, '127.0.0.1', r))
        t.after(() => stop(replacement))
        try {
          await waitFor(async () => (await Promise.all(halls.map(h => h.call('status')))).every(v => v.connected && v.room.members.every(m => m.online)), 15000)
        } catch (error) {
          console.log('Reconnect states', JSON.stringify(await Promise.all(halls.map(async h => { const v = await h.call('status'); return { connected: v.connected, error: v.error, members: v.room?.members, revision: v.session?.state.revision } }))))
          throw error
        }
        const resumed = await views()
        assert.equal(resumed[seat].state.pendingChoice.id, st.pendingChoice.id)
        assert.deepEqual(resumed[seat].state.legalMoves, moves)
        reconnected = true
      }
    } else if (st.uiState !== 'inScenario') {
      move = ['hubGoSetup', 'hubAutoDeck', 'hubDoneSeat', 'hubSelectInvestigator', 'hubBeginScenario', 'hubSetLeader']
        .map(a => moves.find(m => m.action === a)).find(Boolean)
    } else {
      move = (!help || !privateTest ? moves.find(m => m.action === 'investigate') : null)
        || moves.find(m => m.action === 'endTurn') || moves[0]
    }
    assert.ok(move)
    await act(seat, move, sessions)
  }
  assert.equal(actors.size, 4)
  assert.ok(help, 'another human was asked to help with a test')
  assert.ok(privateTest, 'private skill test was inspected')
  assert.ok(reconnected, 'relay restarted during a guest decision')
  assert.ok(kinds.has('commit'))
  let final = await views()
  assert.ok(final[0].state.round >= 4 || final[0].state.uiState === 'scenarioResult')
  assert.ok(peak < 2 * 1024 * 1024, 'historical animations must not keep growing the wire snapshot')
  if (final[0].state.uiState === 'scenarioResult') {
    for (let step = 0; step < 40 && final[0].state.uiState !== 'inScenario' && final[0].state.status === 'playing'; step++) {
      const seat = final[0].decisionSeat, st = final[seat].state, moves = st.legalMoves
      const move = st.pendingChoice ? moves.find(m => ['done', 'skip'].includes(m.optionId)) || moves[0]
        : ['hubContinue', 'hubAutoDeck', 'hubDoneSeat', 'hubSelectInvestigator', 'hubBeginScenario', 'hubSetLeader']
          .map(a => moves.find(m => m.action === a)).find(Boolean)
      assert.ok(move, 'campaign continuation must offer an actionable choice')
      await act(seat, move, final)
      final = await views()
    }
    assert.ok(actions.has('hubContinue'))
    assert.ok(final[0].state.uiState === 'inScenario' || final[0].state.status !== 'playing', 'interlude finishes for every human seat')
    assert.ok(final[0].state.campaign.scenarioResults.length > 0)
  }
  t.diagnostic(`choice kinds=${[...kinds]}; actions=${[...actions]}; peak snapshot=${peak} bytes; revision=${final[0].state.revision}`)
})
