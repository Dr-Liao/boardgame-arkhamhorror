import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from '../../../lib/server.js'
import arkham from '../index.js'

// 全流程使用真实 HTTP 和正式 Mod；只提交返回的合法命令，不注入规则状态。
test('N4 真实HTTP合法败退进入关间：购买、重复提交、只读恢复与下关牌组继承', { timeout: 30000 }, async t => {
  const server = createServer({ mods: [arkham], persist: false })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve) }))
  const base = `http://127.0.0.1:${server.address().port}`
  const request = async (path, data) => {
    const response = await fetch(base + path, data ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) } : {})
    return { status: response.status, ...await response.json() }
  }
  const started = await request('/api/start', { modId: 'arkhamhorror', settings: { legacyAutoStart: true, playerInvestigator: '01001', teammates: 0, opponents: [], seed: 'n4-legal-campaign', difficulty: 'standard' } })
  assert.equal(started.ok, true)
  let session = started.session
  const submit = async command => {
    const result = await request('/api/move', { sessionId: session.sessionId, revision: session.state.revision, move: { ...command, revision: session.state.revision } })
    assert.equal(result.ok, true, result.error)
    session = result.session
    return result
  }
  const choose = async optionId => submit({ action: 'choose', choiceId: session.state.pendingChoice.id, optionId })
  for (let i = 0; session.state.pendingChoice?.kind !== 'interlude'; i++) {
    assert.ok(i < 150)
    const moves = session.state.legalMoves
    const command = session.state.pendingChoice
      ? moves.find(move => ['done', 'skip', 'self'].includes(move.optionId)) || moves[0]
      : moves.find(move => move.action === 'endTurn')
    assert.ok(command)
    await submit(command)
  }
  const cp = session.state.campaign
  assert.equal(cp.scenarioResults.length, 1)
  assert.equal(cp.investigators[0].xp, 2)
  const originalDeck = cp.investigators[0].deck
  await choose('upgrade')
  assert.equal(session.state.pendingChoice.kind, 'upgradeCard')
  const added = session.state.pendingChoice.options.find(option => option.id !== 'cancel').id
  await choose(added)
  const removed = session.state.pendingChoice.options.find(option => option.id !== 'cancel').id
  const purchase = { sessionId: session.sessionId, revision: session.state.revision,
    move: { action: 'choose', choiceId: session.state.pendingChoice.id, optionId: removed, revision: session.state.revision } }
  const accepted = await request('/api/move', purchase)
  assert.equal(accepted.ok, true, accepted.error)
  session = accepted.session
  const purchasedState = structuredClone(session.state)
  const repeated = await request('/api/move', purchase)
  assert.equal(repeated.status, 409)
  assert.equal(repeated.code, 'STALE_REVISION')
  assert.deepEqual(repeated.session.state, purchasedState)
  const refreshed = await request('/api/session?sessionId=' + session.sessionId)
  assert.deepEqual(refreshed.session.state, purchasedState)
  assert.equal(session.state.campaign.investigators[0].xp, 1)
  assert.equal(session.state.campaign.investigators[0].purchases.length, 1)
  await choose('done')
  assert.equal(session.state.scenario.id, 'theMidnightMasks')
  assert.equal(session.state.pendingChoice.kind, 'mulligan')
  await choose('done')
  const expected = [...originalDeck]
  expected.splice(expected.indexOf(removed), 1, added)
  assert.deepEqual(session.state.campaign.investigators[0].deck, expected.sort())
  assert.equal(session.state.investigators[0].resources, 5)
  assert.equal(session.state.investigators[0].handSize, 5)
  assert.equal(session.state.investigators[0].deck.length, 0)
  assert.equal(session.state.continuation, undefined)
  assert.equal(session.state.rngState, undefined)
})
