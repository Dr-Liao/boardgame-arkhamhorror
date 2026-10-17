import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { createServer } from '../../../lib/server.js'
import { createAgent } from '../../../lib/agent/orchestrator.js'
import { buildUserPrompt } from '../../../lib/agent/prompt.js'
import { getDecisionSeat } from '../../../lib/mods.js'
import ox from '../../ox/index.js'
import gobang from '../../gobang/index.js'
import arkham from '../index.js'

const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const close = server => new Promise(resolve => {
  server.closeAllConnections()
  server.close(resolve)
})
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

test('N3 大厅通用决策协议：真实 HTTP、模型与旧 Mod 回归', { timeout: 30000 }, async t => {
  const envKeys = ['DSH_HOME', 'AI_API_KEY', 'AI_BASE_URL', 'AI_MAX_RETRIES', 'AI_TIMEOUT_MS']
  const previousEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]))
  const read = fs.readFileSync
  t.mock.method(fs, 'readFileSync', (file, ...args) => String(file).endsWith('ais.json')
    ? JSON.stringify([{ id: 'protocol-test-ai', name: '测试 AI' }])
    : String(file).endsWith('boardgame.config.json') ? '{}' : read(file, ...args))
  // 数据目录（AI 角色、配置、决策日志）指向临时目录，避免测试往项目根目录写文件。
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arkham-protocol-'))
  process.env.DSH_HOME = home
  process.env.AI_API_KEY = 'local-protocol-test'
  process.env.AI_MAX_RETRIES = '1'
  process.env.AI_TIMEOUT_MS = '5000'

  let hall
  let model
  let modelCalls = 0
  let modelBehavior = async () => ({ move: { kind: 'invalid' }, speech: '' })
  const releases = []
  t.after(async () => {
    releases.forEach(release => release())
    await Promise.all([hall, model].filter(Boolean).map(close))
    for (const key of envKeys) {
      if (previousEnv[key] === undefined) delete process.env[key]
      else process.env[key] = previousEnv[key]
    }
    fs.rmSync(home, { recursive: true, force: true })
  })

  model = http.createServer((req, res) => {
    req.resume()
    req.on('end', async () => {
      modelCalls++
      try {
        const reply = await modelBehavior()
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }))
      } catch {
        res.writeHead(500)
        res.end('local model failure')
      }
    })
  })
  await listen(model)
  process.env.AI_BASE_URL = 'http://127.0.0.1:' + model.address().port

  const observers = []
  const decision = {
    id: 'protocol-decision', name: '通用决策测试', players: [1, 2], seats: 2,
    moveFormat: '{"kind":"ok"}', moveToText: move => move.kind,
    createState: () => ({ status: 'playing', currentSeat: 1, answer: 0, moveCount: 0, trace: [] }),
    decisionSeat: state => state.answer,
    describeState: (state, seat) => { observers.push(seat); return 'observer=' + seat },
    legalMoves: (state, seat) => {
      assert.equal(seat, state.answer)
      state.trace.push('query-only')
      return [{ kind: 'invalid' }, { kind: 'ok' }]
    },
    validateMove: (state, seat, move) => {
      if (move?.kind === 'validateThrow') {
        state.trace.push('invalid-validation')
        throw new Error('validation failed')
      }
      return seat !== state.answer || !['ok', 'applyThrow'].includes(move?.kind) ? 'invalid move' : null
    },
    applyMove: (state, seat, move) => {
      state.trace.push(seat)
      if (move.kind === 'applyThrow') throw new Error('transaction failed')
      state.moveCount++
      state.answer = state.moveCount === 1 ? 1 : 0
      state.currentSeat = 1 - state.answer
      return [{ type: 'move', seat, move }]
    },
  }
  const privateEvents = [
    { type: 'move', seat: 0, move: { label: 'HUMAN_PRIVATE' } },
    { type: 'move', seat: 1, move: { label: 'AI_PRIVATE' } },
  ]
  const projected = {
    id: 'protocol-projection', name: '观察者测试', players: [1, 1], seats: 1,
    moveFormat: '{"ok":true}', moveToText: move => move.label || 'ok',
    createState: () => ({ status: 'playing', currentSeat: 0, moveCount: 0, secret: { value: 7 }, internal: { step: 2 } }),
    describeState: () => 'PUBLIC_STATE',
    viewState: (state, seat) => {
      assert.equal(seat, 0)
      state.secret.value = 99
      delete state.secret
      delete state.internal
      delete state.revision
      return state
    },
    viewEvents: (events, seat) => {
      assert.equal(typeof seat, 'number')
      const visible = events.filter(event => event.seat === seat)
      for (const event of events) if (event.seat !== seat) event.move.label = 'MUTATED'
      return visible
    },
    validateMove: (state, seat, move) => {
      assert.equal(state.secret.value, 7)
      assert.equal(state.internal.step, 2)
      return move?.ok ? null : 'invalid move'
    },
    applyMove: state => { state.moveCount++; return structuredClone(privateEvents) },
  }
  hall = createServer({ mods: [decision, projected, ox, gobang] })
  await listen(hall)
  const base = 'http://127.0.0.1:' + hall.address().port
  const request = async (route, body) => {
    const response = await fetch(base + route, body === undefined ? {} : {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    return { status: response.status, ...await response.json() }
  }
  const start = async (mod = decision, settings = { opponents: ['protocol-test-ai'] }) => {
    const result = await request('/api/start', { modId: mod.id, settings })
    assert.equal(result.status, 200)
    assert.equal(result.ok, true)
    return result.session
  }
  const refresh = sessionId => request('/api/session?sessionId=' + encodeURIComponent(sessionId))
  const holdModel = () => {
    const entered = deferred()
    const gate = deferred()
    releases.push(gate.resolve)
    modelBehavior = async () => {
      entered.resolve()
      await gate.promise
      return { move: { kind: 'ok' }, speech: '' }
    }
    return { entered: entered.promise, release: gate.resolve }
  }

  await t.test('应答座位优先于 currentSeat，初始人类待决不调用 AI', async () => {
    const before = modelCalls
    const session = await start()
    assert.equal(session.state.currentSeat, 1)
    assert.equal(session.decisionSeat, 0)
    assert.equal(session.state.revision, 0)
    assert.equal(modelCalls, before)
    assert.equal(getDecisionSeat({}, session.state), 1)
    assert.equal(getDecisionSeat({ decisionSeat: () => null }, session.state), null)
  })

  await t.test('非法版本、越权、校验及执行异常均拒绝且完整快照不变', async () => {
    const session = await start()
    for (const revision of [-1, 0.5, '0', null, Number.MAX_SAFE_INTEGER + 1]) {
      const result = await request('/api/move', { sessionId: session.sessionId, revision, move: { kind: 'ok' } })
      assert.equal(result.status, 400)
      assert.equal(result.code, 'INVALID_REVISION')
      assert.deepEqual(result.session, session)
    }
    const mismatch = await request('/api/move', {
      sessionId: session.sessionId, revision: 0, expectedRevision: 1, move: { kind: 'ok' },
    })
    assert.equal(mismatch.status, 400)
    assert.deepEqual(mismatch.session, session)
    const unauthorized = await request('/api/move', { sessionId: session.sessionId, seat: 1, move: { kind: 'ok' } })
    assert.equal(unauthorized.status, 403)
    assert.equal(unauthorized.code, 'WRONG_SEAT')
    for (const kind of ['invalid', 'validateThrow', 'applyThrow']) {
      const result = await request('/api/move', { sessionId: session.sessionId, expectedRevision: 0, move: { kind } })
      assert.equal(result.status, 400)
      assert.deepEqual(result.session, session)
      assert.deepEqual((await refresh(session.sessionId)).session, session)
    }
  })

  await t.test('模型非法输出走确定合法兜底，重复版本拒绝，人类待决立即暂停', async () => {
    modelBehavior = async () => ({ move: { kind: 'invalid' }, speech: '' })
    observers.length = 0
    const session = await start()
    let result = await request('/api/move', { sessionId: session.sessionId, expectedRevision: 0, move: { kind: 'ok' } })
    assert.equal(result.status, 200)
    assert.deepEqual(result.session.state.trace, [0, 1])
    assert.equal(result.session.state.revision, 2)
    assert.equal(result.session.state.currentSeat, 1)
    assert.equal(result.session.decisionSeat, 0)
    assert.deepEqual(observers, [1])
    const accepted = result.session
    result = await request('/api/move', { sessionId: session.sessionId, revision: 0, move: { kind: 'ok' } })
    assert.equal(result.status, 409)
    assert.equal(result.code, 'STALE_REVISION')
    assert.deepEqual(result.session, accepted)
    result = await request('/api/move', { sessionId: session.sessionId, revision: 2, expectedRevision: 2, move: { kind: 'ok' } })
    assert.equal(result.status, 200)
    assert.equal(result.session.state.revision, 3)
    result = await request('/api/reset', { sessionId: session.sessionId })
    assert.equal(result.session.state.revision, 4)
    assert.equal((await request('/api/move', { sessionId: session.sessionId, revision: 0, move: { kind: 'ok' } })).status, 409)
  })

  for (const mod of [ox, gobang]) {
    await t.test('旧棋盘 Mod 无需版本参数仍正常运行：' + mod.id, async () => {
      modelBehavior = async () => ({ move: { kind: 'invalid' }, speech: '' })
      const session = await start(mod)
      const result = await request('/api/move', { sessionId: session.sessionId, move: { x: 1, y: 1 } })
      assert.equal(result.status, 200)
      assert.equal(result.session.state.moveCount, 2)
      assert.equal(result.session.state.revision, 2)
      assert.equal(result.session.decisionSeat, 0)
      const invalid = await request('/api/move', { sessionId: session.sessionId, revision: 2, move: { x: 1, y: 1 } })
      assert.equal(invalid.status, 400)
      assert.deepEqual(invalid.session, result.session)
    })
  }

  await t.test('模型等待期间 move/reset/leave 有并发锁，GET 可安全刷新 busy 快照', async () => {
    const session = await start()
    const blocked = holdModel()
    const pending = request('/api/move', { sessionId: session.sessionId, revision: 0, move: { kind: 'ok' } })
    await blocked.entered
    try {
      for (const route of ['/api/move', '/api/reset', '/api/leave']) {
        const result = await request(route, { sessionId: session.sessionId, revision: 0, move: { kind: 'ok' } })
        assert.equal(result.status, 409)
        assert.equal(result.code, 'SESSION_BUSY')
        assert.equal(result.session.state.revision, 1)
      }
      const during = await refresh(session.sessionId)
      assert.equal(during.busy, true)
      assert.equal(during.session.state.revision, 1)
    } finally {
      blocked.release()
    }
    const result = await pending
    assert.equal(result.status, 200)
    assert.deepEqual(result.session.state.trace, [0, 1])
    const after = await refresh(session.sessionId)
    assert.equal(after.busy, false)
    assert.equal(after.session.state.revision, 2)
  })

  for (const change of ['revision', 'seat', 'identity', 'role', 'status']) {
    await t.test('异步模型结果过时后不重试、不提交：' + change, async () => {
      const agent = createAgent({ modById: () => decision, getAi: () => ({ name: 'AI' }) })
      const session = {
        modId: decision.id, events: [],
        players: [{ seat: 0, role: 'human' }, { seat: 1, role: 'ai', name: 'AI' }],
        state: { ...decision.createState(), answer: 1, currentSeat: 0, revision: 0 },
      }
      const blocked = holdModel()
      const before = modelCalls
      const pending = agent.agentPlay(session, 1)
      await blocked.entered
      if (change === 'revision') session.state.revision++
      if (change === 'seat') session.state.answer = 0
      if (change === 'identity') session.state = structuredClone(session.state)
      if (change === 'role') session.players[1].role = 'human'
      if (change === 'status') session.state.status = 'over'
      blocked.release()
      const result = await pending
      assert.equal(result.move, null)
      assert.equal(result.stale, true)
      assert.equal(modelCalls, before + 1)
      assert.deepEqual(session.state.trace, [])
    })
  }

  await t.test('无模型兜底依次校验候选，异常及查询副作用不改权威状态', async () => {
    const state = { status: 'playing', currentSeat: 0, answer: 1, revision: 5, value: 0 }
    const mod = {
      decisionSeat: current => current.answer,
      legalMoves: (current, seat) => {
        assert.equal(seat, 1)
        current.value = 99
        return [null, { kind: 'throw' }, { kind: 'bad' }, { kind: 'ok' }]
      },
      validateMove: (current, seat, move) => {
        current.value = 100
        if (move.kind === 'throw') throw new Error('invalid candidate')
        return move.kind === 'ok' ? null : 'invalid'
      },
    }
    const agent = createAgent({ modById: () => mod, getAi: () => ({}) })
    agent.config.apiKey = ''
    const session = { modId: 'fallback-test', players: [{ role: 'human' }, { role: 'ai' }], state }
    const before = structuredClone(state)
    for (let i = 0; i < 3; i++) assert.deepEqual((await agent.agentPlay(session, 1)).move, { kind: 'ok' })
    assert.deepEqual(state, before)
    assert.equal((await agent.agentPlay(session, 0)).stale, true)
  })

  await t.test('状态与事件投影覆盖成功、错误、GET及重开，投影不污染权威副本', async () => {
    const session = await start(projected, {})
    const assertVisible = current => {
      assert.equal('secret' in current.state, false)
      assert.equal('internal' in current.state, false)
      assert.equal(current.events.every(event => event.seat === 0), true)
      assert.equal(JSON.stringify(current).includes('AI_PRIVATE'), false)
    }
    assertVisible(session)
    assert.equal(session.state.revision, 0)
    const good = await request('/api/move', { sessionId: session.sessionId, revision: 0, move: { ok: true } })
    assert.equal(good.status, 200)
    assert.equal(good.session.state.revision, 1)
    assert.equal(good.session.events[0].move.label, 'HUMAN_PRIVATE')
    assertVisible(good.session)
    for (const body of [{ revision: 0, move: { ok: true } }, { revision: 1, move: { ok: false } }]) {
      const bad = await request('/api/move', { sessionId: session.sessionId, ...body })
      assert.equal(bad.ok, false)
      assertVisible(bad.session)
      assert.deepEqual(bad.session, good.session)
    }
    assert.deepEqual((await refresh(session.sessionId)).session, good.session)
    const reset = await request('/api/reset', { sessionId: session.sessionId })
    assert.equal(reset.session.state.revision, 2)
    assertVisible(reset.session)
  })

  await t.test('模型近期历史按其观察者座位调用二参数事件投影', () => {
    const session = {
      state: projected.createState(),
      players: [{ seat: 0, name: 'Human', role: 'human' }, { seat: 1, name: 'AI', role: 'ai' }],
      events: structuredClone(privateEvents),
    }
    const before = structuredClone(session)
    const prompt = buildUserPrompt(projected, session, 1)
    assert.equal(prompt.includes('AI_PRIVATE'), true)
    assert.equal(prompt.includes('HUMAN_PRIVATE'), false)
    assert.deepEqual(session, before)
  })

  await t.test('会话刷新拒绝缺失、重复及不存在的编号；离开后不可读取', async () => {
    assert.equal((await request('/api/session')).status, 400)
    assert.equal((await request('/api/session?sessionId=x&sessionId=y')).status, 400)
    assert.equal((await request('/api/session?sessionId=missing')).status, 404)
    const session = await start()
    assert.equal((await request('/api/leave', { sessionId: session.sessionId })).ok, true)
    assert.equal((await refresh(session.sessionId)).status, 404)
    assert.equal((await request('/api/move', { sessionId: session.sessionId, move: { kind: 'ok' } })).status, 404)
  })

  for (const count of [1, 4]) {
    await t.test(`真实 Arkham ${count} 座位：开手选择、无模型 AI、事务与观察者隐私`, async child => {
      const previousKey = process.env.AI_API_KEY
      process.env.AI_API_KEY = ''
      let actualHall
      child.after(async () => {
        if (actualHall) await close(actualHall)
        if (previousKey === undefined) delete process.env.AI_API_KEY
        else process.env.AI_API_KEY = previousKey
      })
      let authority
      const createState = arkham.createState
      child.mock.method(arkham, 'createState', (...args) => {
        authority = createState.apply(arkham, args)
        return authority
      })
      actualHall = createServer({ mods: [arkham] })
      await listen(actualHall)
      const actualBase = 'http://127.0.0.1:' + actualHall.address().port
      const actualRequest = async (route, body) => {
        const response = await fetch(actualBase + route, body === undefined ? {} : {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
        })
        return { status: response.status, ...await response.json() }
      }
      const assertPrivate = session => {
        const state = session.state
        for (const key of ['rng', 'rngState', 'seed', 'continuation', '_resolution', 'resolutionQueue']) {
          assert.equal(Object.hasOwn(state, key), false, key + ' 不得进入观察者响应')
        }
        for (const inv of state.investigators) {
          assert.deepEqual(inv.deck, [])
          assert.ok(inv.deckSize > 0)
          if (inv.seat !== 0) assert.deepEqual(inv.hand, [])
        }
        assert.deepEqual(state.encounterDeck, [])
        assert.deepEqual(state.cultistDeck, [])
        for (const event of session.events) {
          if (event.seat !== 0 && event.move?.action === 'choose') assert.equal(Object.hasOwn(event.move, 'optionId'), false)
        }
      }
      const beforeCalls = modelCalls
      const started = await actualRequest('/api/start', {
        modId: arkham.id,
        settings: {
          legacyAutoStart: true,
          teammates: count - 1,
          opponents: Array(count - 1).fill('protocol-test-ai'),
          playerInvestigator: '01001', difficulty: 'standard', seed: 'protocol-arkham-' + count,
        },
      })
      assert.equal(started.status, 200)
      assert.equal(started.ok, true)
      const session = started.session
      assert.equal(session.players.length, count)
      assert.equal(session.state.investigators.length, count)
      assert.equal(session.decisionSeat, 0)
      assert.equal(session.state.pendingChoice.kind, 'mulligan')
      assert.equal(session.state.pendingChoice.seat, 0)
      assert.equal(session.state.revision, 0)
      assert.ok(authority.continuation)
      assert.equal(typeof authority.rngState, 'number')
      assert.ok(authority.investigators[0].deck.length > 0)
      assertPrivate(session)
      const authoritativeBefore = structuredClone(authority)
      const invalid = await actualRequest('/api/move', {
        sessionId: session.sessionId, expectedRevision: 0,
        move: { action: 'choose', choiceId: session.state.pendingChoice.id, optionId: 'not-an-option' },
      })
      assert.equal(invalid.status, 400)
      assert.equal(invalid.ok, false)
      assert.deepEqual(authority, authoritativeBefore)
      assert.deepEqual(invalid.session, session)
      assertPrivate(invalid.session)
      const currentUrl = '/api/session?sessionId=' + encodeURIComponent(session.sessionId)
      assert.deepEqual((await actualRequest(currentUrl)).session, session)
      const done = session.state.legalMoves.find(move => move.action === 'choose' && move.optionId === 'done')
      assert.ok(done)
      const accepted = await actualRequest('/api/move', {
        sessionId: session.sessionId, expectedRevision: session.state.revision, move: done,
      })
      assert.equal(accepted.status, 200)
      assert.equal(accepted.ok, true)
      // AI 队友在开手换牌窗口里逐步作答：人类的 1 次回答 + 每个 AI 队友的若干次 choose。
      // 这里断言「AI 确实参与了换牌」而不是固定条数——条数取决于换牌选择本身。
      assert.ok(accepted.session.state.revision >= count,
        '每个 AI 队友都应参与换牌（revision=' + accepted.session.state.revision + ', count=' + count + '）')
      if (count > 1) assert.equal(accepted.session.state.pendingChoice?.kind, 'turnOrder')
      else assert.equal(accepted.session.state.pendingChoice, null)
      assert.equal(accepted.session.decisionSeat, 0)
      assert.equal(accepted.session.state.currentSeat, 0)
      assert.equal(accepted.session.state.status, 'playing')
      assert.equal(modelCalls, beforeCalls)
      for (const inv of accepted.session.state.investigators) {
        assert.equal(inv.handSize, inv.code === '03003' ? 8 : 5)
        assert.equal(inv.actionsLeft, 3)
      }
      assertPrivate(accepted.session)
      const refreshed = await actualRequest(currentUrl)
      assert.equal(refreshed.busy, false)
      assert.deepEqual(refreshed.session, accepted.session)
      const duplicate = await actualRequest('/api/move', {
        sessionId: session.sessionId, revision: 0, move: done,
      })
      assert.equal(duplicate.status, 409)
      assert.equal(duplicate.code, 'STALE_REVISION')
      assert.deepEqual(duplicate.session, accepted.session)
      assertPrivate(duplicate.session)

      // 同一种子 + 同一操作序列 → 完全一致的结果：AI 兜底选择由 Mod 提供的
      // decisionSeed（对局种子）决定，因此「种子的可复现性」覆盖 AI 决策，而不只是规则。
      const replayStart = await actualRequest('/api/start', {
        modId: arkham.id,
        settings: {
          legacyAutoStart: true,
          teammates: count - 1,
          opponents: Array(count - 1).fill('protocol-test-ai'),
          playerInvestigator: '01001', difficulty: 'standard', seed: 'protocol-arkham-' + count,
        },
      })
      assert.equal(replayStart.status, 200)
      const replayDone = replayStart.session.state.legalMoves.find(move => move.action === 'choose' && move.optionId === 'done')
      const replay = await actualRequest('/api/move', {
        sessionId: replayStart.session.sessionId,
        expectedRevision: replayStart.session.state.revision,
        move: replayDone,
      })
      assert.equal(replay.status, 200)
      assert.equal(replay.session.state.revision, accepted.session.state.revision, '同一种子必须产生相同的 AI 决策序列')
      assert.deepEqual(replay.session.state.log, accepted.session.state.log, '同一种子必须产生相同的局势日志')
    })
  }
})
