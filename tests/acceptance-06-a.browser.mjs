import { expect, test } from '@playwright/test'
import { applyHarm, legalMoves, startScenario } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { viewState } from '../src/integration/observation.js'
import { fixture, settle } from './core-fixture.mjs'

async function openTable(page, state, answer) {
  let session
  const refresh = () => {
    state.legalMoves = legalMoves(state, 0)
    session.state = viewState(state, 0, { includeStatic: true })
  }
  await page.route('**/mods/arkhamhorror/img/thumbs/**', route => route.fulfill({ status: 404 }))
  await page.addLocatorHandler(page.getByRole('button', { name: '跳过演出' }), button => button.click())
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({
      modId: 'arkhamhorror', settings: { legacyAutoStart: true, playerCount: 1, seed: 'tde-card-acceptance' },
    }) })
    const payload = await response.json()
    session = payload.session
    refresh()
    await route.fulfill({ response, json: payload })
  }, { times: 1 })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  if (answer) await page.route('**/api/move', async route => {
    answer(route.request().postDataJSON().move)
    refresh()
    await route.fulfill({ json: { ok: true, session } })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toBeVisible({ timeout: 30_000 })
}

for (const [width, height] of [[1440, 950], [390, 844]]) {
  test(`06099 在 ${width}px 选择额外恐惧时不增加伤害`, async ({ page }, info) => {
    const state = fixture()
    state.investigators[0].threat.push({ id: 'glimpse', code: '06099' })
    const execute = draft => applyHarm(draft, draft.investigators[0], 1, 1, [], true)
    resolveTransaction(state, 0, { action: 'mixed-harm' }, execute)
    expect(state.pendingChoice?.options.map(option => option.id)).toEqual(['damage', 'horror'])
    await page.setViewportSize({ width, height })
    await openTable(page, state, move => resolveTransaction(state, 0, move, execute))
    const panel = page.locator('.ah-choice')
    await expect(panel.locator('[data-option-id="damage"]')).toBeVisible()
    const horror = panel.locator('[data-option-id="horror"]')
    await expect(horror).toBeEnabled()
    await page.screenshot({ path: info.outputPath(`06099-${width}.png`), animations: 'disabled' })
    const response = page.waitForResponse('**/api/move')
    await horror.click()
    expect((await response).ok()).toBe(true)
    expect(state.investigators[0].damage).toBe(1)
    expect(state.investigators[0].horror).toBe(2)
  })

  test(`06233 在 ${width}px 可从密谋牌库旁查看带毁灭的卡达斯`, async ({ page }, info) => {
    const state = fixture()
    startScenario(state, 0, [], 'darkSideOfTheMoon')
    settle(state)
    expect(state.agendaAside.find(card => card.originalCode === '06233')?.doom).toBe(1)
    await page.setViewportSize({ width, height })
    await openTable(page, state)
    const stack = page.locator('[data-agenda-aside="1"]')
    await expect(stack).toContainText('卡达斯')
    await stack.click()
    const zone = page.getByRole('dialog', { name: '密谋牌库旁' })
    await expect(zone.locator('.ah-card-zone-card')).toHaveCount(1)
    await zone.locator('.ah-card-zone-card').click()
    await expect(page.getByRole('dialog', { name: '卡牌详情' })).toContainText('卡达斯')
    await page.screenshot({ path: info.outputPath(`06233-${width}.png`), animations: 'disabled' })
  })
}
