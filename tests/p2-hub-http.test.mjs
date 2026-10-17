import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createServer } from '../../../lib/server.js'
import arkham from '../index.js'
import { snapshotPath } from '../../../lib/sessions.js'
import { PLAYER_CARD_CODES } from '../src/deck/availability.js'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { INVESTIGATORS } from '../src/cards/cards-data.js'

function assertPersisted(session) {
  const saved = JSON.parse(fs.readFileSync(snapshotPath(session.sessionId), 'utf8')).session.state
  assert.equal(saved.revision, session.state.revision, '每次局外提交与关卡结算均写入最新版本')
  assert.equal(saved.uiState, session.state.uiState)
  assert.deepEqual(saved.campaign.scenarioResults, session.state.campaign.scenarioResults)
}

async function listen() {
  const server = createServer({ mods: [arkham] })
  await server.ready
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const request = async (url, body) => {
    const response = await fetch(base + url, body === undefined ? {} : {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    return { status: response.status, ...await response.json() }
  }
  return { server, request, close: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve) }) }
}

test('P2 新战役局外流程、原子存档、显式读取、删除与另存为', { timeout: 30000 }, async () => {
  const previous = process.env.DSH_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arkham-p2-'))
  process.env.DSH_HOME = home
  let app
  try {
    app = await listen()
    const catalog = await app.request('/api/catalog')
    const entry = catalog.games.find(game => game.id === 'arkhamhorror')
    const settingKeys = entry.settingsSpec.map(item => item.key)
    for (const key of ['playerCount', 'campaignId', 'aiStoryAwareness', 'opponents']) assert.ok(settingKeys.includes(key), key)
    assert.equal(new Set(settingKeys).size, settingKeys.length)
    const started = await app.request('/api/start', { modId: 'arkhamhorror', settings: { playerCount: 2, campaignId: 'nightOfTheZealot', opponents: ['ai-hu'] } })
    assert.equal(started.status, 200, started.error)
    let session = started.session
    assert.equal(session.state.uiState, 'campaignHub')
    assert.equal(session.state.scenario, null)
    assert.equal(session.players.length, 2)
    assert.equal(session.players[1].aiId, 'ai-hu')
    assert.deepEqual(session.state.campaign.investigators, {})
    const id = session.sessionId
    const submit = async move => {
      const response = await app.request('/api/move', { sessionId: id, revision: session.state.revision,
        move: { ...move, revision: session.state.revision } })
      assert.equal(response.status, 200, response.error)
      session = response.session
      assertPersisted(session)
      return response
    }
    assert.equal((await app.request('/api/sessions')).sessions.find(item => item.sessionId === id).uiState, 'campaignHub')

    const failureFile = path.join(home, 'not-a-directory')
    fs.writeFileSync(failureFile, 'x')
    process.env.DSH_HOME = failureFile
    const failedSave = await app.request('/api/move', { sessionId: id, revision: 0,
      move: { action: 'hubSetDifficulty', difficulty: 'easy', revision: 0 } })
    assert.equal(failedSave.status, 507, failedSave.error)
    assert.equal(failedSave.code, 'SAVE_FAILED')
    assert.equal(failedSave.session.state.revision, 1)
    assert.equal(failedSave.session.state.difficulty, 'easy')
    process.env.DSH_HOME = home
    assert.equal(JSON.parse(fs.readFileSync(snapshotPath(id), 'utf8')).session.state.revision, 0, '失败不会破坏上一份有效存档')
    const retried = await app.request('/api/session/save', { sessionId: id })
    assert.equal(retried.status, 200, retried.error)
    session = retried.session
    assert.equal((await app.request('/api/sessions')).sessions.find(item => item.sessionId === id).revision, 1)
    const duplicate = await app.request('/api/move', { sessionId: id, revision: 0,
      move: { action: 'hubSetDifficulty', difficulty: 'easy', revision: 0 } })
    assert.equal(duplicate.status, 409)
    assert.equal(duplicate.session.state.revision, 1)

    await submit({ action: 'hubGoSetup' })
    // AI 席位会同时完成自己的准备，可能已经选走某个调查员；
    // 这里从合法动作里挑一个仍可选的，而不是写死 01001（写死会让用例依赖 AI 选了谁）。
    const pickInvestigator = session.state.legalMoves.find(move => move.action === 'hubSelectInvestigator')
    assert.ok(pickInvestigator, '局外准备阶段应至少留一个可选调查员')
    await submit({ action: 'hubSelectInvestigator', code: pickInvestigator.code })
    await submit({ action: 'hubAutoDeck' })
    await submit({ action: 'hubDoneSeat' })
    assert.equal(session.state.uiState, 'scenarioSetup')
    assert.equal(session.state.hubReady, true)
    assert.equal(Object.keys(session.state.campaign.investigators).length, 2)
    assert.equal(session.state.campaign.investigators[1].deck, undefined, 'AI 私有牌组不出现在人类投影中')
    assert.equal((await app.request('/api/sessions')).sessions.find(item => item.sessionId === id).revision, session.state.revision)
    await submit({ action: 'hubBeginScenario' })
    assert.equal(session.state.uiState, 'inScenario')
    assert.equal(session.state.pendingChoice.kind, 'mulligan')

    const savedRevision = session.state.revision
    await app.close(); app = null
    app = await listen()
    assert.equal((await app.request('/api/session?sessionId=' + encodeURIComponent(id))).status, 404,
      'P2 存档不自动激活')
    const loaded = await app.request('/api/session/load', { sessionId: id })
    assert.equal(loaded.status, 200, loaded.error)
    assert.equal(loaded.session.state.revision, savedRevision)
    assert.equal(loaded.session.state.uiState, 'inScenario')
    assert.equal(loaded.session.state.pendingChoice.kind, 'mulligan')
    assert.equal((await app.request('/api/session/delete', { sessionId: id })).code, 'CONFIRM_REQUIRED')
    const deleted = await app.request('/api/session/delete', { sessionId: id, confirm: true })
    assert.equal(deleted.removed, true)
    const stillActive = await app.request('/api/session?sessionId=' + encodeURIComponent(id))
    assert.equal(stillActive.status, 200)
    assert.equal(stillActive.session.saveDetached, true)
    const asNew = await app.request('/api/session/save-as', { sessionId: id })
    assert.equal(asNew.status, 200, asNew.error)
    assert.notEqual(asNew.session.sessionId, id)
    assert.equal(asNew.session.state.revision, savedRevision)

    const file = snapshotPath(asNew.session.sessionId)
    const record = JSON.parse(fs.readFileSync(file, 'utf8'))
    record.session.state.schemaVersion = 4
    fs.writeFileSync(file, JSON.stringify(record))
    const incompatible = (await app.request('/api/sessions')).sessions.find(item => item.sessionId === asNew.session.sessionId)
    assert.equal(incompatible.compatible, false)
    assert.equal((await app.request('/api/session/load', { sessionId: asNew.session.sessionId })).code, 'SAVE_INCOMPATIBLE')
    assert.equal(fs.existsSync(file), true, '不兼容存档保留供管理，不强制读取')

    const outdatedId = asNew.session.sessionId
    const writeOutdated = () => {
      const current = JSON.parse(fs.readFileSync(file, 'utf8'))
      current.session.state.schemaVersion = 6
      current.session.state.resourceVersion = 'f'.repeat(64)
      fs.writeFileSync(file, JSON.stringify(current))
    }
    const backups = () => fs.readdirSync(path.dirname(file)).filter(name => name.startsWith(outdatedId + '.json.') && name.endsWith('.bak'))
    writeOutdated()
    await app.close(); app = await listen()
    const outdated = (await app.request('/api/sessions')).sessions.find(item => item.sessionId === outdatedId)
    assert.equal(outdated.compatible, true, outdated.compatibilityError)
    assert.equal(outdated.needsMigration, true)
    assert.ok(outdated.migrationChanges.includes('卡牌资源升级到当前版本'))
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).session.state.resourceVersion, 'f'.repeat(64), '列表只预览迁移，不改写存档')
    const repaired = await app.request('/api/session/repair', { sessionId: outdatedId })
    assert.equal(repaired.status, 200, repaired.error)
    assert.equal(repaired.repaired, true)
    assert.ok(repaired.backup && backups().includes(repaired.backup), '修复前备份原档')
    assert.equal(JSON.parse(fs.readFileSync(path.join(path.dirname(file), repaired.backup), 'utf8')).session.state.resourceVersion, 'f'.repeat(64))
    const fixed = JSON.parse(fs.readFileSync(file, 'utf8')).session.state
    assert.equal(arkham.saveCompatibilityError(fixed), null)
    assert.equal(fixed.revision, savedRevision, '修复不推进对局')
    assert.equal((await app.request('/api/sessions')).sessions.find(item => item.sessionId === outdatedId).needsMigration, false)
    assert.equal((await app.request('/api/session/repair', { sessionId: outdatedId })).repaired, false)

    writeOutdated()
    await app.close(); app = await listen()
    const migrated = await app.request('/api/session/load', { sessionId: outdatedId })
    assert.equal(migrated.status, 200, migrated.error)
    assert.ok(migrated.migrationChanges.includes('卡牌资源升级到当前版本'))
    assert.equal(migrated.session.state.revision, savedRevision)
    assert.equal(migrated.session.state.pendingChoice.kind, 'mulligan')
    assert.equal(arkham.saveCompatibilityError(JSON.parse(fs.readFileSync(file, 'utf8')).session.state), null, '读取时迁移结果写回存档')
    assert.equal(backups().length, 2)
    const move = migrated.session.state.legalMoves[0]
    const continued = await app.request('/api/move', { sessionId: outdatedId, revision: savedRevision, move: { ...move, revision: savedRevision } })
    assert.equal(continued.status, 200, continued.error)
  } finally {
    if (app) await app.close()
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    assert.ok(path.resolve(home).startsWith(path.resolve(os.tmpdir()) + path.sep))
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('P2 关卡结算停在局外页，升级完成后主动进入下一关', { timeout: 30000 }, async () => {
  const previous = process.env.DSH_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arkham-p2-flow-'))
  process.env.DSH_HOME = home
  let app
  try {
    app = await listen()
    const started = await app.request('/api/start', { modId: 'arkhamhorror', settings: { playerCount: 1, campaignId: 'nightOfTheZealot', seed: 'p2-flow' } })
    assert.equal(started.status, 200, started.error)
    let session = started.session
    const submit = async move => {
      const response = await app.request('/api/move', { sessionId: session.sessionId, revision: session.state.revision,
        move: { ...move, revision: session.state.revision } })
      assert.equal(response.status, 200, response.error)
      session = response.session
      if (session.state.uiState !== 'inScenario' || move.action === 'hubBeginScenario') assertPersisted(session)
    }
    for (const move of [
      { action: 'hubSetDifficulty', difficulty: 'easy' },
      { action: 'hubSelectScenario', scenarioId: 'theGathering' },
      { action: 'hubGoSetup' }, { action: 'hubSelectInvestigator', code: '01001' },
      { action: 'hubSetDeck', codes: buildDeck(INVESTIGATORS['01001'], { seat: 0, seed: 1 }).deck.filter(code => PLAYER_CARD_CODES.includes(code)) },
      { action: 'hubDoneSeat' }, { action: 'hubBeginScenario' },
    ]) await submit(move)
    for (let i = 0; session.state.uiState !== 'scenarioResult'; i++) {
      assert.ok(i < 150, '关卡应能通过合法动作结束')
      const moves = session.state.legalMoves
      const move = session.state.pendingChoice
        ? moves.find(candidate => ['done', 'skip', 'self'].includes(candidate.optionId)) || moves[0]
        : moves.find(candidate => candidate.action === 'endTurn')
      assert.ok(move, '每一步都有合法动作')
      await submit(move)
    }
    assert.equal(session.state.campaign.scenarioResults.length, 1)
    assert.equal(session.state.scenario.id, 'theGathering')
    assert.equal(session.state.legalMoves.some(move => move.action === 'hubContinue'), true)
    await submit({ action: 'hubContinue' })
    assert.equal(session.state.uiState, 'interlude')
    const purchase = session.state.legalMoves.find(move => move.action === 'hubPurchase')
    assert.ok(purchase, '测试种子必须覆盖升级暂存、撤销与确认，禁止静默跳过')
    if (purchase) {
      await submit(purchase)
      assert.equal(session.state.campaign.investigators[0].purchases.length, 0)
      assert.equal(session.state.campaign.investigators[0].upgradeDraft.changes.length, 1)
      const draftRevision = session.state.revision
      const draftXp = session.state.campaign.investigators[0].xp
      const savedId = session.sessionId
      await app.close(); app = await listen()
      const restored = await app.request('/api/session/load', { sessionId: savedId })
      assert.equal(restored.status, 200, restored.error)
      session = restored.session
      assert.equal(session.state.revision, draftRevision)
      assert.equal(session.state.campaign.investigators[0].upgradeDraft.changes.length, 1)
      await submit({ action: 'hubCancelUpgrades' })
      assert.equal(session.state.campaign.investigators[0].xp, draftXp)
      assert.equal(session.state.campaign.investigators[0].purchases.length, 0)
      await submit(purchase)
      await submit({ action: 'hubConfirmUpgrades' })
      assert.equal(session.state.campaign.investigators[0].purchases.length, 1)
    }
    await submit({ action: 'hubAutoUpgrade' })
    await submit({ action: 'hubDoneSeat' })
    assert.equal(session.state.uiState, 'scenarioSetup')
    assert.equal(session.state.hubReady, true)
    assert.equal(session.state.scenario.id, 'theGathering', '不会自动开启下一关')
    await submit({ action: 'hubBeginScenario' })
    assert.equal(session.state.scenario.id, 'theMidnightMasks')
    assert.equal(session.state.uiState, 'inScenario')
    assert.equal(session.state.pendingChoice.kind, 'mulligan')
    const saved = (await app.request('/api/sessions')).sessions.find(item => item.sessionId === session.sessionId)
    assert.equal(saved.revision, session.state.revision)
    assert.equal(saved.scenarioId, 'theMidnightMasks')
  } finally {
    if (app) await app.close()
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    assert.ok(path.resolve(home).startsWith(path.resolve(os.tmpdir()) + path.sep))
    fs.rmSync(home, { recursive: true, force: true })
  }
})
