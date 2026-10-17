import { test, expect } from '@playwright/test'
import { createGameState, applyMove, legalMoves } from '../src/engine/engine.js'
import { viewState, viewEvents } from '../src/integration/observation.js'

test('完整桌面出牌演出结束后装备可见且能够继续行动', async ({ page }) => {
  // Use the real host DOM helper and rule engine: an isolated presentation
  // fixture missed style: null throwing when the first equipped card rendered.
  // Move responses are resolved locally so this regression does not depend on AI/network latency.
  const errors = []
  page.on('pageerror', error => errors.push(error.stack))
  const players = [{ seat: 0, role: 'human', name: 'player' }]
  const state = createGameState({ legacyAutoStart: true, playerInvestigator: '02001', seed: 'play-freeze' }, players)
  state.pendingChoice = null; state.continuation = null; state.round = 2
  state.investigators[0].hand = ['01020', '01086', '01087', '01020', '01089']
  state.investigators[0].assets = []; state.investigators[0].resources = 5
  const events = []
  const session = () => ({ sessionId: 'play-freeze', modId: 'arkhamhorror', modName: '诡镇奇谈', players,
    render: { kind: 'cards' }, state: { ...viewState(state, 0), legalMoves: legalMoves(state) }, events: viewEvents(events, 0) })
  await page.route('**/api/start', route => route.fulfill({ json: { ok: true, session: session() } }))
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, busy: false, session: session() } }))
  await page.route('**/api/move', route => {
    const result = applyMove(state, 0, route.request().postDataJSON().move)
    for (const event of result) events.push({ ...event, seq: events.length })
    return route.fulfill({ json: { ok: true, session: session() } })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-player-board')).toBeVisible()
  await page.locator('[data-interaction="hand:0:0"]').click()
  await page.locator('.ah-equip-slot[data-slot="hand"]').first().click()
  await expect(page.locator('.ah-card-transit[data-fx-kind="play"]')).toBeVisible()
  await expect(page.locator('.ah-table')).not.toHaveClass(/ah-presenting/, { timeout: 10000 })
  await expect(page.locator('.ah-equip-slot [data-card-code="01020"]')).toBeVisible()
  await expect(page.locator('.ah-roster-status')).toHaveText('行动中')
  expect(errors).toEqual([])
  await page.locator('.ah-table-actions button').filter({ hasText: /^资源$/ }).click()
  await expect(page.locator('.ah-action-count')).toHaveText('1')
  await expect(page.locator('.ah-pool-resource > strong')).toHaveText('3')
  await expect(page.locator('.ah-table')).not.toHaveClass(/ah-presenting/)
  expect(errors).toEqual([])
})
