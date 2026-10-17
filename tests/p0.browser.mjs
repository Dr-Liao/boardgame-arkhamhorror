import { test, expect } from '@playwright/test'

test('P0 新游戏设置不宣称 strict 规则已完成', async ({ page, request }) => {
  const catalog = await (await request.get('/api/catalog')).json()
  const arkham = catalog.games.find(game => game.id === 'arkhamhorror')
  expect(arkham).toBeTruthy()
  expect(arkham.settingsSpec.some(setting => setting.key === 'rulesMode')).toBe(false)

  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.locator('.bg-modal')
  await expect(setup).toBeVisible()
  await expect(setup.getByText('规则模式', { exact: true })).toHaveCount(0)
  await expect(setup.getByText('严格模式', { exact: false })).toHaveCount(0)
})
