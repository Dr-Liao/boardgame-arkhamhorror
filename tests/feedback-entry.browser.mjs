import { test, expect } from '@playwright/test'

// 反馈入口由大厅注入（createUI 的 openFeedback）。这两个用例同时守住：
//   1. 局外（战役页）和局内（牌桌）标题栏最右侧都有入口；
//   2. 点开的是大厅的反馈弹窗，不是 Mod 自己复制的一份。

async function enterHub(page) {
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.locator('.ah-hub-setup')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-hub')).toBeVisible()
  return page.locator('.ah-hub')
}

async function enterTable(page) {
  await page.route('**/api/start', async route => {
    const body = route.request().postDataJSON()
    await route.continue({ postData: JSON.stringify({ ...body,
      settings: { ...body.settings, playerCount: 1, legacyAutoStart: true, seed: 'feedback-entry' } }) })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toBeVisible()
  return page.locator('.ah-table')
}

async function openFeedbackFrom(page, scope) {
  const entry = scope.locator('.bg-game-actions').getByRole('button', { name: /反馈/ })
  await expect(entry).toBeVisible()
  await entry.click()
  const dialog = page.locator('.bg-feedback-modal')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('iframe')).toHaveAttribute('src', /feishu\.cn\/share\/base\/form\//)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
}

test('局外：战役页标题栏最右侧的反馈入口打开大厅弹窗', async ({ page }) => {
  const hub = await enterHub(page)
  const entry = hub.locator('.bg-game-actions').getByRole('button', { name: /反馈/ })
  const exit = hub.getByRole('button', { name: '退出', exact: true })
  const [entryBox, exitBox] = await Promise.all([entry.boundingBox(), exit.boundingBox()])
  expect(entryBox.x).toBeGreaterThan(exitBox.x)
  await openFeedbackFrom(page, hub)
  await expect(hub).toBeVisible()
})

test('局内：牌桌标题栏最右侧的反馈入口打开大厅弹窗', async ({ page }) => {
  const table = await enterTable(page)
  const entry = table.locator('.bg-game-actions').getByRole('button', { name: /反馈/ })
  const menu = table.locator('.ah-session-menu summary')
  const [entryBox, menuBox] = await Promise.all([entry.boundingBox(), menu.boundingBox()])
  expect(entryBox.x).toBeGreaterThan(menuBox.x)
  await openFeedbackFrom(page, table)
  await expect(table).toBeVisible()
})
