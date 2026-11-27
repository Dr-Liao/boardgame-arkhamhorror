import { test, expect } from '@playwright/test'
import { viewState } from '../src/integration/observation.js'
import { reactionFixture, reactionOptions } from './acceptance-04-a-shard2-reactions.mjs'

async function openReaction(page, fixture) {
  let session
  await page.route('**/mods/arkhamhorror/img/thumbs/**', route => route.fulfill({ status: 404 }))
  await page.addLocatorHandler(page.getByRole('button', { name: '跳过演出' }), button => button.click())
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId: 'arkhamhorror', settings: {
      legacyAutoStart: true, playerCount: 1, seed: 'acceptance-04-a-2-reactions',
    } }) })
    const payload = await response.json()
    session = payload.session
    session.state = viewState(fixture.state, 0, { includeStatic: true })
    await route.fulfill({ response, json: payload })
  }, { times: 1 })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  await page.route('**/api/move', async route => {
    fixture.answer(route.request().postDataJSON().move)
    session.state = viewState(fixture.state, 0, { includeStatic: true })
    await route.fulfill({ json: { ok: true, session } })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toBeVisible({ timeout: 30_000 })
}

for (const [width, height] of [[1440, 950], [390, 844]]) {
  for (const [code, accept] of Object.entries(reactionOptions)) {
    test(`${code} 在 ${width}px 牌桌可发动或跳过反应`, async ({ page }, testInfo) => {
      const fixture = reactionFixture(code)
      fixture.trigger()
      const pending = fixture.state.pendingChoice
      expect(pending.source).toBe(code)
      await page.setViewportSize({ width, height })
      await openReaction(page, fixture)
      const panel = page.locator('.ah-choice')
      await expect(panel).toHaveAttribute('data-choice-id', pending.id)
      const use = panel.locator(`[data-option-id="${accept}"]`)
      const skip = panel.locator('[data-option-id="skip"]')
      await expect(use).toBeVisible()
      await expect(use).toBeEnabled()
      await expect(skip).toBeVisible()
      await expect(skip).toBeEnabled()
      await panel.scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`${code}-reaction-${width}.png`), animations: 'disabled' })
      const option = width === 1440 ? use : skip
      const response = page.waitForResponse('**/api/move')
      await option.click()
      expect((await response).ok()).toBe(true)
      await expect(panel).toHaveCount(0)
      expect(fixture.state.pendingChoice).toBeNull()
      if (code === '04256') {
        expect(fixture.state.investigators.map(inv => inv.hand.length)).toEqual(width === 1440 ? [1, 1, 0] : [0, 0, 0])
      } else {
        expect(fixture.state.investigators[0].clues).toBe(width === 1440 ? 1 : 0)
      }
    })
  }
}
