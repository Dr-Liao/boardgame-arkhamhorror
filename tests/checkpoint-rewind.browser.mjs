import { test, expect } from '@playwright/test'

import { PLAYER_CARD_CODES } from '../src/deck/availability.js'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { INVESTIGATORS } from '../src/cards/cards-data.js'

test('队长可在调查纪事二次确认后从历史关卡创建分支', async ({ page, request }) => {
  const call = async (url, body) => {
    const response = body === undefined
      ? await request.get('/api' + url)
      : await request.post('/api' + url, { data: body })
    return { status: response.status(), ...await response.json() }
  }
  const started = await call('/start', {
    modId: 'arkhamhorror',
    settings: { playerCount: 1, campaignId: 'nightOfTheZealot', seed: 'checkpoint-browser' },
  })
  expect(started.ok, started.error).toBe(true)
  let session = started.session
  const submit = async move => {
    const response = await call('/move', {
      sessionId: session.sessionId,
      revision: session.state.revision,
      move: { ...move, revision: session.state.revision },
    })
    expect(response.ok, response.error).toBe(true)
    session = response.session
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
  for (let guard = 0; session.state.uiState !== 'scenarioResult'; guard++) {
    expect(guard).toBeLessThan(150)
    const move = session.state.pendingChoice
      ? session.state.legalMoves.find(candidate => ['done', 'skip', 'self'].includes(candidate.optionId)) || session.state.legalMoves[0]
      : session.state.legalMoves.find(candidate => candidate.action === 'endTurn')
    expect(move).toBeTruthy()
    await submit(move)
  }

  const sourceId = session.sessionId
  let branchId
  try {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
    const setup = page.getByRole('dialog', { name: '调查准备设置' })
    await setup.getByRole('button', { name: '存档管理', exact: true }).click()
    const saved = setup.locator(`[data-session-id="${sourceId}"]`)
    await expect(saved).toBeVisible()
    await saved.getByRole('button', { name: '读取此存档', exact: true }).click()

    const restart = page.getByRole('button', { name: '从此关重新开始', exact: true })
    await expect(restart).toBeVisible()
    await restart.click()
    const dialog = page.getByRole('dialog', { name: '确认重新开始关卡' })
    await expect(dialog).toContainText('当前存档及其后续进度会完整保留')
    await dialog.getByRole('button', { name: '取消', exact: true }).click()
    await expect(dialog).toHaveCount(0)

    await restart.click()
    const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/session/fork-checkpoint'))
    await page.getByRole('button', { name: '确认并创建分支', exact: true }).click()
    const response = await responsePromise
    const result = await response.json()
    expect(result.ok, result.error).toBe(true)
    branchId = result.session.sessionId
    expect(branchId).not.toBe(sourceId)
    await expect.poll(() => page.evaluate(() => localStorage.getItem('boardgame-hall.sessionId'))).toBe(branchId)
    await expect(page.locator('.ah-table')).toBeVisible()
    expect(errors).toEqual([])
  } finally {
    await call('/session/delete', { sessionId: sourceId, confirm: true })
    if (branchId) await call('/session/delete', { sessionId: branchId, confirm: true })
  }
})
