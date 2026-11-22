// 批次 4 浏览器验收：调查员挑战《红潮涌起》在大厅战役选择器中可选、必选调查员（温蒂）可自动构筑，
// 桌面 1440 与移动 390 下大厅不产生横向溢出。
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'

test('批次 4：挑战战役与平行调查员可在大厅选择并自动构筑（桌面/移动）', async ({ page }) => {
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: /诡镇奇谈|阿卡姆/ }).first().click()
  const setup = page.locator('.ah-hub-setup')
  await expect(setup).toBeVisible()

  // 战役选择器：批次 4 挑战属于支线分类。
  await setup.locator('#ah-campaign-picker-open').click()
  const picker = page.locator('.ah-campaign-picker')
  await expect(picker).toBeVisible()
  await picker.locator('#ah-campaign-tab-sideStories').click()
  const choice = picker.locator('[data-campaign-id="redTideRising"]')
  await expect(choice).toBeVisible()
  await choice.click()
  await picker.locator('[data-focus-key="campaign-confirm"]').click()

  await setup.getByText(/玩家人数|席位数量/).locator('..').locator('select').selectOption('1')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  const hub = page.locator('.ah-hub')
  await expect(hub).toHaveAttribute('data-ui-state', 'campaignHub')

  // 挑战指定调查员：温蒂·亚当斯（90037 平行套件）。
  await hub.getByRole('button', { name: '选择调查员', exact: true }).click()
  const candidate = hub.getByRole('button', { name: /^选择调查员：温蒂/ }).first()
  await expect(candidate).toBeVisible()
  await candidate.click()
  // 接受推荐卡组（不同分支文案可能不同）。
  const recommended = hub.getByRole('button', { name: /使用推荐卡组|推荐卡组/ }).first()
  if (await recommended.count()) await recommended.click()
  await hub.getByRole('button', { name: '卡组构筑', exact: true }).first().click()
  await expect(hub.getByRole('heading', { name: /卡组/ }).first()).toBeVisible()
  expect(await hub.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await hub.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await page.screenshot({
    path: fileURLToPath(new URL('../../../artifacts/migration/starter-batch-4/browser-mobile.png', import.meta.url)),
    fullPage: true,
  })
})
