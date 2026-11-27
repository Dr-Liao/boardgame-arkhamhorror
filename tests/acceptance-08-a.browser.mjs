import { expect, test } from '@playwright/test'
import { applyMove, legalMoves } from '../src/engine/engine.js'
import { revealTopForSharedPlay } from '../src/engine/shared-play.js'
import { viewState } from '../src/integration/observation.js'
import { fixture } from './core-fixture.mjs'

async function openTable(page, state) {
  let session
  const snapshot = () => {
    state.legalMoves = legalMoves(state, 0)
    session.state = viewState(state, 0, { includeStatic: true })
    return { ok: true, session }
  }
  await page.route('**/mods/arkhamhorror/img/thumbs/**', route => route.fulfill({ status: 404 }))
  await page.addLocatorHandler(page.getByRole('button', { name: '跳过演出' }), button => button.click())
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({
      modId: 'arkhamhorror', settings: { legacyAutoStart: true, playerCount: 1, seed: 'eote-acceptance' },
    }) })
    session = (await response.json()).session
    await route.fulfill({ response, json: snapshot() })
  }, { times: 1 })
  await page.route('**/api/session?*', route => route.fulfill({ json: snapshot() }))
  await page.route('**/api/move', route => {
    applyMove(state, 0, route.request().postDataJSON().move)
    return route.fulfill({ json: snapshot() })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toBeVisible({ timeout: 30_000 })
}

for (const [width, height] of [[1440, 950], [390, 844]]) {
  test(`08055 公共场外区在 ${width}px 提供实际打出`, async ({ page }, info) => {
    const state = fixture('01001')
    const inv = state.investigators[0]
    inv.deck.push('01018')
    inv.resources = 10
    const card = revealTopForSharedPlay(state, 0)
    await page.setViewportSize({ width, height })
    await openTable(page, state)
    await page.getByRole('button', { name: '公共场外卡牌' }).click()
    const option = page.locator(`[data-shared-play] [data-interaction="sharedPlay:${card.id}"]`)
    await expect(option).toBeVisible()
    await page.screenshot({ path: info.outputPath(`08055-${width}.png`), animations: 'disabled' })
    await option.click()
    await expect.poll(() => state.investigators[0].assets.some(asset => asset.code === card.code)).toBe(true)
    expect(state.sharedPlayCards).toHaveLength(0)
  })

  test(`08064 在 ${width}px 搜索卡牌名称并实际取消抽牌`, async ({ page }, info) => {
    const state = fixture('01001')
    state.investigators[0].hand = ['08064']
    state.investigators[0].deck = ['01018']
    await page.setViewportSize({ width, height })
    await openTable(page, state)
    await page.locator('.ah-dock-deck').first().click()
    const offer = page.locator(`.ah-choice [data-option-id]:not([data-option-id="skip"])`).first()
    if (await offer.count()) await offer.click()
    else await page.locator('.ah-hand [data-card-code="08064"]').click()
    const search = page.getByRole('searchbox', { name: '搜索卡牌名称' })
    await expect(search).toBeVisible()
    await search.fill('Beat Cop')
    await page.screenshot({ path: info.outputPath(`08064-${width}.png`), animations: 'disabled' })
    await page.locator('[data-option-id="Beat Cop"]').click()
    await page.locator('[data-option-id="cancel"]').click()
    await expect.poll(() => state.investigators[0].discard.includes('01018')).toBe(true)
    expect(state.investigators[0].hand).toHaveLength(0)
  })
}
