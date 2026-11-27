import { expect, test } from '@playwright/test'
import { applyMove, legalMoves } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { viewState } from '../src/integration/observation.js'
import { asset, fixture, settle } from './core-fixture.mjs'
import { chapterFixture } from './tic-chapter-fixture.mjs'

async function openTable(page, state) {
  let session
  function refresh() {
    state.legalMoves = legalMoves(state, 0)
    session.state = viewState(state, 0, { includeStatic: true })
  }
  await page.route('**/mods/arkhamhorror/img/thumbs/**', route => route.fulfill({ status: 404 }))
  await page.addLocatorHandler(page.getByRole('button', { name: '跳过演出' }), button => button.click())
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({
      modId: 'arkhamhorror', settings: { legacyAutoStart: true, playerCount: 1, seed: 'tic-acceptance' },
    }) })
    const payload = await response.json()
    session = payload.session
    refresh()
    await route.fulfill({ response, json: payload })
  }, { times: 1 })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  await page.route('**/api/move', async route => {
    applyMove(state, 0, route.request().postDataJSON().move)
    settle(state)
    refresh()
    await route.fulfill({ json: { ok: true, session } })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toBeVisible({ timeout: 30_000 })
}

for (const [width, height] of [[1440, 950], [390, 844]]) {
  test(`07267、07273 在 ${width}px 显示面朝下张数和腐化标记`, async ({ page }, info) => {
    const state = fixture()
    asset(state, '07267', { capturedCards: [{ code: '07039', seat: 0 }, { code: '07040', seat: 0 }] })
    asset(state, '07273', { uses: 2, usesType: 'corruption' })
    await page.setViewportSize({ width, height })
    await openTable(page, state)
    const captured = page.locator('[data-card-marker="captured"]')
    await expect(captured).toBeVisible()
    await expect(captured).toHaveAttribute('aria-label', /下方面朝下的牌 2/)
    const corruption = page.locator('[data-card-marker="uses"][aria-label="腐化 2"]')
    await expect(corruption).toBeVisible()
    await page.screenshot({ path: info.outputPath(`07267-07273-${width}.png`), animations: 'disabled' })
  })

  test(`07315 在 ${width}px 等待玩家点击推进，且不消耗行动`, async ({ page }, info) => {
    const state = chapterFixture('intoTheMaelstrom')
    const gate = state.locations.find(card => (card.originalCode || card.code) === '07320')
    const inv = state.investigators[0]
    inv.location = gate.id
    const mechanics = createMechanicsApi(state)
    for (const color of ['blue', 'red', 'yellow', 'green']) {
      const key = state.scenarioFlags.mechanics.keys[color]
      expect(mechanics.keys.transfer(color, key.holder, 'investigator:0', { reveal: true })).toBe(true)
    }
    const actions = inv.actionsLeft
    await page.setViewportSize({ width, height })
    await openTable(page, state)
    const advance = page.locator('.ah-act-advance')
    await expect(advance).toBeEnabled()
    expect(state.actIndex).toBe(0)
    await page.screenshot({ path: info.outputPath(`07315-${width}.png`), animations: 'disabled' })
    const response = page.waitForResponse('**/api/move')
    await advance.click()
    expect((await response).ok()).toBe(true)
    expect(state.actIndex).toBe(1)
    expect(state.investigators[0].actionsLeft).toBe(actions)
  })
}
