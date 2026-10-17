import { test, expect } from '@playwright/test'

async function openTable(page) {
  await page.route('**/api/start', async route => {
    const body = route.request().postDataJSON()
    await route.continue({ postData: JSON.stringify({ ...body,
      settings: { ...body.settings, playerCount: 1, legacyAutoStart: true, seed: 'card-zones' } }) })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const started = page.waitForResponse('**/api/start')
  await page.getByRole('button', { name: '开始新游戏' }).click()
  const session = (await (await started).json()).session
  await expect(page.locator('.ah-table')).toBeVisible()
  const skip = page.getByRole('button', { name: '跳过演出' })
  if (await skip.isVisible()) await skip.click()
  return session
}

test('顶部入口可浏览胜利区与放在一边的卡牌，并进入卡牌详情', async ({ page }) => {
  const session = await openTable(page)
  await expect(page.getByRole('button', { name: /查看胜利区，共 0 张/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /查看放在一边的卡牌，共 6 张/ })).toBeVisible()

  await page.getByRole('button', { name: /查看放在一边的卡牌/ }).click()
  const aside = page.getByRole('dialog', { name: '放在一边的卡牌' })
  await expect(aside).toBeVisible()
  await expect(aside.locator('[data-zone-card]')).toHaveCount(6)
  await aside.locator('[data-zone-card]').first().click()
  await expect(page.getByRole('dialog', { name: '卡牌详情' })).toBeVisible()
  await page.getByRole('button', { name: '关闭卡牌详情' }).click()
  await page.getByRole('button', { name: '关闭放在一边的卡牌' }).click()

  session.state.victoryDisplay = [{ id: 'victory-priest', code: 'ghoulPriest', originalCode: '01116', victory: 2 }]
  session.state.revision++
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  await page.getByRole('button', { name: '刷新局势' }).click()
  await page.getByRole('button', { name: /查看胜利区，共 1 张/ }).click()
  const victory = page.getByRole('dialog', { name: '胜利区' })
  await expect(victory).toContainText('共 2 胜利点')
  await expect(victory.locator('[data-zone-card="ghoulPriest"]')).toBeVisible()
})

test('卡牌区域在窄屏保持可操作', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openTable(page)
  const launcher = page.getByRole('button', { name: /查看放在一边的卡牌/ })
  await launcher.evaluate(button => button.click())
  const modal = page.getByRole('dialog', { name: '放在一边的卡牌' })
  const box = await modal.boundingBox()
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(390)
  expect(box.y + box.height).toBeLessThanOrEqual(844)
  await expect(modal.locator('[data-zone-card]').first()).toBeVisible()
})
