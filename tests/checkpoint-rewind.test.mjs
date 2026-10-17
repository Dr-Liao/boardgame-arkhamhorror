import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { createServer } from '../../../lib/server.js'
import { snapshotPath } from '../../../lib/sessions.js'
import arkham from '../index.js'
import { PLAYER_CARD_CODES } from '../src/deck/availability.js'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { INVESTIGATORS } from '../src/cards/cards-data.js'
import { migrateSessionCheckpoints } from '../src/integration/hall-integration.js'

async function listen() {
  const server = createServer({ mods: [arkham] })
  await server.ready
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const request = async (url, body) => {
    const response = await fetch(base + url, body === undefined ? {} : {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { status: response.status, ...await response.json() }
  }
  return {
    server,
    request,
    close: () => new Promise(resolve => {
      server.closeAllConnections()
      server.close(resolve)
    }),
  }
}

test('关卡入口检查点可由队长创建精确分支，且原时间线保持不变', { timeout: 30000 }, async () => {
  const previous = process.env.DSH_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arkham-checkpoint-'))
  process.env.DSH_HOME = home
  let app
  try {
    app = await listen()
    const started = await app.request('/api/start', {
      modId: 'arkhamhorror',
      settings: { playerCount: 1, campaignId: 'nightOfTheZealot', seed: 'checkpoint-rewind' },
    })
    assert.equal(started.status, 200, started.error)
    let session = started.session
    const submit = async move => {
      const response = await app.request('/api/move', {
        sessionId: session.sessionId,
        revision: session.state.revision,
        move: { ...move, revision: session.state.revision },
      })
      assert.equal(response.status, 200, response.error)
      session = response.session
      return response
    }
    const deck = buildDeck(INVESTIGATORS['01001'], { seat: 0, seed: 1 }).deck
      .filter(code => PLAYER_CARD_CODES.includes(code))
    for (const move of [
      { action: 'hubSetDifficulty', difficulty: 'easy' },
      { action: 'hubSelectScenario', scenarioId: 'theGathering' },
      { action: 'hubGoSetup' },
      { action: 'hubSelectInvestigator', code: '01001' },
      { action: 'hubSetDeck', codes: deck },
      { action: 'hubDoneSeat' },
      { action: 'hubBeginScenario' },
    ]) await submit(move)

    assert.equal(session.state.uiState, 'inScenario')
    assert.equal(session.scenarioCheckpoints.length, 1)
    assert.equal(session.scenarioCheckpoints[0].canFork, true)
    assert.equal(Object.hasOwn(session.scenarioCheckpoints[0], 'snapshot'), false, '客户端不能获得隐藏牌序和 RNG 快照')
    const sourceId = session.sessionId
    const sourceRecordAtStart = JSON.parse(fs.readFileSync(snapshotPath(sourceId), 'utf8'))
    const checkpoint = sourceRecordAtStart.session.scenarioCheckpoints[0]
    assert.equal(checkpoint.snapshot.state.pendingChoice.kind, 'mulligan')
    assert.deepEqual(checkpoint.snapshot.state.investigators[0].hand, sourceRecordAtStart.session.state.investigators[0].hand)
    assert.deepEqual(checkpoint.snapshot.state.encounterDeck, sourceRecordAtStart.session.state.encounterDeck)

    for (let guard = 0; session.state.uiState !== 'scenarioResult'; guard++) {
      assert.ok(guard < 150, '测试关卡应能通过合法动作结算')
      const move = session.state.pendingChoice
        ? session.state.legalMoves.find(candidate => ['done', 'skip', 'self'].includes(candidate.optionId)) || session.state.legalMoves[0]
        : session.state.legalMoves.find(candidate => candidate.action === 'endTurn')
      assert.ok(move, '每一步都应存在合法动作')
      await submit(move)
    }
    assert.equal(session.state.campaign.scenarioResults[0].visitId, checkpoint.visitId)
    const sourceRevision = session.state.revision
    const sourceBytes = fs.readFileSync(snapshotPath(sourceId), 'utf8')

    const unconfirmed = await app.request('/api/session/fork-checkpoint', {
      sessionId: sourceId,
      checkpointId: checkpoint.checkpointId,
      seat: 0,
      revision: sourceRevision,
    })
    assert.equal(unconfirmed.code, 'CONFIRM_REQUIRED')

    const stale = await app.request('/api/session/fork-checkpoint', {
      sessionId: sourceId,
      checkpointId: checkpoint.checkpointId,
      seat: 0,
      revision: sourceRevision - 1,
      confirm: true,
    })
    assert.equal(stale.code, 'STALE_REVISION')

    const wrongSeat = await app.request('/api/session/fork-checkpoint', {
      sessionId: sourceId,
      checkpointId: checkpoint.checkpointId,
      seat: 1,
      revision: sourceRevision,
      confirm: true,
    })
    assert.equal(wrongSeat.status, 403)

    const forked = await app.request('/api/session/fork-checkpoint', {
      sessionId: sourceId,
      checkpointId: checkpoint.checkpointId,
      seat: 0,
      revision: sourceRevision,
      confirm: true,
    })
    assert.equal(forked.status, 200, forked.error)
    assert.notEqual(forked.session.sessionId, sourceId)
    assert.equal(forked.session.state.uiState, 'inScenario')
    assert.equal(forked.session.state.pendingChoice.kind, 'mulligan')
    assert.equal(forked.session.scenarioCheckpoints.length, 1)
    assert.equal(fs.readFileSync(snapshotPath(sourceId), 'utf8'), sourceBytes, '创建分支不得改写原存档')

    const branchRecord = JSON.parse(fs.readFileSync(snapshotPath(forked.session.sessionId), 'utf8')).session
    const expectedState = structuredClone(checkpoint.snapshot.state)
    expectedState.revision = sourceRevision + 1
    assert.deepEqual(branchRecord.state, expectedState)
    assert.deepEqual(branchRecord.events, checkpoint.snapshot.events)
    assert.deepEqual(branchRecord.notes, checkpoint.snapshot.notes)
    assert.deepEqual(branchRecord.agentPlans, checkpoint.snapshot.agentPlans)
    assert.equal(branchRecord.forkedFrom.sessionId, sourceId)
    assert.equal(branchRecord.forkedFrom.checkpointId, checkpoint.checkpointId)

    const incompatible = structuredClone(branchRecord)
    incompatible.scenarioCheckpoints[0].snapshot.state.schemaVersion = 999
    const migrated = migrateSessionCheckpoints(incompatible)
    assert.equal(migrated.checkpoints[0].unavailableReason.includes('更新版本'), true)
    assert.equal(migrated.changes.length, 1)
    assert.equal(incompatible.scenarioCheckpoints[0].unavailableReason, undefined, '迁移检查不能修改输入')

    // A broken historical checkpoint is isolated during load; the current
    // branch remains playable and the unavailable entry is only disabled.
    branchRecord.scenarioCheckpoints[0].snapshot.state.schemaVersion = 999
    const branchPath = snapshotPath(forked.session.sessionId)
    const storedBranch = JSON.parse(fs.readFileSync(branchPath, 'utf8'))
    storedBranch.session = branchRecord
    fs.writeFileSync(branchPath, JSON.stringify(storedBranch))
    await app.close()
    app = await listen()
    const loaded = await app.request('/api/session/load', { sessionId: forked.session.sessionId })
    assert.equal(loaded.status, 200, loaded.error)
    assert.equal(loaded.session.state.uiState, 'inScenario')
    assert.equal(loaded.session.scenarioCheckpoints[0].available, false)
    assert.equal(loaded.session.scenarioCheckpoints[0].canFork, false)
  } finally {
    if (app) await app.close()
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    assert.ok(path.resolve(home).startsWith(path.resolve(os.tmpdir()) + path.sep))
    fs.rmSync(home, { recursive: true, force: true })
  }
})
