// 批次 3 浏览器验收：2026 核心盒与五个新入门包在大厅可选、可自动构筑，
// 桌面 1440 与移动 390 下局外页面不产生横向溢出。
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'

const NEW_INVESTIGATORS = [
  /选择调查员：丹妮拉/,
  /选择调查员：托米/,
  /选择调查员：卡洛琳/,
  /选择调查员：安德烈/,
  /选择调查员：玛丽/,
  /选择调查员：米格尔/,
]

test('批次 3：2026 核心盒与新入门包可在大厅选择并自动构筑（桌面/移动）', async ({ page }) => {
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.locator('.ah-hub-setup')
  await expect(setup).toBeVisible()
  await setup.getByText(/玩家人数|席位数量/).locator('..').locator('select').selectOption('1')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  const hub = page.locator('.ah-hub')
  await expect(hub).toHaveAttribute('data-ui-state', 'campaignHub')

  await hub.getByRole('button', { name: '选择调查员', exact: true }).click()
  for (const name of NEW_INVESTIGATORS) {
    await expect(hub.getByRole('button', { name }).first()).toBeVisible()
  }
  await hub.getByRole('button', { name: NEW_INVESTIGATORS[0] }).first().click()
  await hub.getByRole('button', { name: /使用推荐卡组/ }).first().click()
  // 自动构筑完成后大厅显示牌组/调查员状态，且能进入卡组构筑页。
  await hub.getByRole('button', { name: '卡组构筑', exact: true }).click()
  await expect(hub.getByRole('heading', { name: /卡组/ }).first()).toBeVisible()
  expect(await hub.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await hub.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  await page.screenshot({
    path: fileURLToPath(new URL('../../../artifacts/migration/starter-batch-3/browser-mobile.png', import.meta.url)),
    fullPage: true,
  })
})
