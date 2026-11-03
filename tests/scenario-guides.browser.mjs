import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('../../../artifacts/scenario-guides/', import.meta.url))
mkdirSync(output, { recursive: true })

async function openTable(page, id = 'theGathering') {
  await page.addLocatorHandler(page.getByRole('button', { name: '跳过演出' }), locator => locator.click())
  let session
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId: 'arkhamhorror',
      settings: { playerCount: 1, legacyAutoStart: true, seed: 'adventure-guide' } }) })
    const body = await response.json()
    session = body.session
    session.state.scenario.id = id
    if (id === 'dimCarcosa') session.state.scenario.name = '卡尔克萨之路 · 卡城幽影'
    await route.fulfill({ response, json: body })
  })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toBeVisible()
}

test('完整指南按需加载，入口位于剧本右侧提示卡下方；桌面与手机可阅读', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const requests = []
  page.on('request', request => { if (request.url().includes('/scenario-guides/')) requests.push(request.url()) })
  await openTable(page, 'dimCarcosa')
  expect(requests).toHaveLength(0)
  const button = page.locator('[data-scenario-setup]')
  await expect(button).toHaveCount(1)
  await expect(page.locator('.bg-game-head [data-scenario-setup]')).toHaveCount(0)
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    const [book, card, entry] = await Promise.all(['.ah-story-book', '.ah-reference-card', '[data-scenario-setup]']
      .map(selector => page.locator(selector).boundingBox()))
    expect(entry.x).toBeGreaterThanOrEqual(book.x + book.width)
    expect(entry.y).toBeGreaterThanOrEqual(card.y + card.height - 1)
    expect(entry.x + entry.width).toBeLessThanOrEqual(viewport.width)
    expect(entry.y + entry.height).toBeLessThanOrEqual(viewport.height)
    await page.screenshot({ path: `${output}/table-${viewport.width}.png`, animations: 'disabled' })
    await button.click()
    const panel = page.getByRole('dialog', { name: '关卡设置', exact: true })
    await expect(panel.getByText('卡尔克萨领域的神智值', { exact: true })).toBeVisible()
    await expect(panel.getByText(/本关中，调查员不会因身上的恐惧数量/)).toBeVisible()
    await expect(panel.getByText(/规则中的“剩余神智值”视为 0/)).toBeVisible()
    await expect(panel.locator('details')).not.toHaveCount(0)
    await expect(panel.locator('details[open]')).toHaveCount(0)
    await page.screenshot({ path: `${output}/guide-${viewport.width}.png`, animations: 'disabled' })
    const resolutions = panel.locator('details').filter({ hasText: '结局与结算' })
    await resolutions.locator('summary').click()
    await expect(resolutions).toHaveAttribute('open', '')
    await expect(resolutions.getByText('结局5', { exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(button).toBeFocused()
  }
  await page.evaluate(async () => {
    const catalog = await import('/mods/arkhamhorror/catalog.js')
    catalog.setHostLocale('en')
  })
  await button.click()
  await expect(page.getByRole('dialog', { name: '关卡设置', exact: true })
    .getByText('Sanity in the Realm of Carcosa', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  expect(requests).toHaveLength(1)
  expect(errors).toEqual([])
})

test('指南加载失败可重试，键盘可进入折叠的结局说明', async ({ page }) => {
  let attempts = 0
  await page.route('**/scenario-guides/theGathering.json', async route => {
    if (++attempts === 1) await route.fulfill({ status: 503, body: 'Unavailable' })
    else await route.continue()
  })
  await openTable(page)
  await page.locator('[data-scenario-setup]').click()
  const panel = page.getByRole('dialog', { name: '关卡设置', exact: true })
  await expect(panel.getByRole('status')).toContainText('加载失败')
  await panel.getByRole('button', { name: '重新加载指南' }).click()
  await expect(panel.getByRole('status')).toHaveCount(0)
  await expect(panel.locator('.ah-guide-spoilers')).not.toHaveCount(0)
  await panel.getByRole('button', { name: '关闭关卡设置' }).focus()
  await page.keyboard.press('Tab')
  await expect(panel.locator('summary').first()).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(panel.locator('details[open]')).toHaveCount(1)
  expect(attempts).toBe(2)
})
