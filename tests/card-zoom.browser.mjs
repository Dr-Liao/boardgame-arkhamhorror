import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('../../../artifacts/arkham-polish/', import.meta.url))

test('卡组构筑：导入与卡组库位于顶部，按住 Alt 悬停卡牌显示放大图与说明', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/index.html'); await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption('1')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  const hub = page.locator('.ah-hub')
  await hub.getByRole('button', { name: '选择调查员', exact: true }).click()
  await hub.getByRole('button', { name: /选择调查员：罗兰/ }).click()
  await hub.getByRole('button', { name: '卡组构筑', exact: true }).click()
  await hub.locator('[data-hub-action="edit-deck"]').click()
  const modal = page.getByRole('dialog', { name: '卡组构筑' })
  const head = modal.locator('.ah-db-modal-head')
  await expect(head.getByRole('button', { name: '导入 ArkhamDB' })).toBeVisible()
  await expect(head.getByRole('button', { name: '卡组库', exact: true })).toBeVisible()
  await expect(modal.locator('.ah-office-deck-tray [data-deck-tool]')).toHaveCount(0)

  const card = modal.locator('.ah-hub-card-pool .ah-db-card').first()
  const zoom = page.locator('.ah-card-zoom')
  await card.hover()
  await expect(zoom).toHaveCount(0)
  await page.keyboard.down('Alt')
  await expect(zoom).toBeVisible()
  await expect(zoom.locator('.ah-card-zoom-art .ah-table-art')).toBeVisible()
  await expect(zoom.locator('.ah-card-zoom-rules')).not.toBeEmpty()
  await expect(zoom.locator('.ah-card-zoom-text')).not.toContainText('null')
  await expect(zoom.locator('h3')).toHaveText(await card.getAttribute('data-zoom-name'))
  const box = await zoom.boundingBox()
  expect(box.width).toBeGreaterThan(500)
  await page.screenshot({ path: output + 'deck-card-zoom.png', animations: 'disabled' })

  const next = modal.locator('.ah-hub-card-pool .ah-db-card').nth(1)
  await next.hover()
  await expect(zoom).toHaveAttribute('data-zoom-for', await next.getAttribute('data-zoom-code'))
  await page.keyboard.up('Alt')
  await expect(zoom).toHaveCount(0)
  expect(errors).toEqual([])
})

test('局内手牌、调查员、地点、场景与密谋均可按住 Alt 放大', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/start', async route => {
    const body = route.request().postDataJSON()
    await route.continue({ postData: JSON.stringify({ ...body,
      settings: { ...body.settings, playerCount: 1, legacyAutoStart: true, seed: 'card-zoom' } }) })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toBeVisible()
  const skip = page.getByRole('button', { name: '跳过演出' })
  if (await skip.isVisible()) await skip.click()

  const zoom = page.locator('.ah-card-zoom')
  const table = page.locator('.ah-table')
  const hand = table.locator('.ah-hand .ah-hand-card').last()
  const targets = {
    hand: [hand, hand.locator('.ah-table-art')],
    investigator: table.locator('.ah-dock-portrait .ah-table-art').first(),
    location: table.locator('.ah-map-node > .ah-table-art, .ah-loc > .ah-table-art').first(),
    script: table.locator('.ah-script-card .ah-table-art').first(),
  }
  for (const [label, entry] of Object.entries(targets)) {
    const [hover, art] = Array.isArray(entry) ? entry : [entry, entry]
    await hover.scrollIntoViewIfNeeded()
    await hover.hover({ position: { x: 20, y: 20 } })
    await page.keyboard.down('Alt')
    await expect(zoom, label).toBeVisible()
    await expect(zoom, label).toHaveAttribute('data-zoom-for', await art.getAttribute('data-art-code'))
    await expect(zoom, label).toHaveAttribute('data-zoom-face', await art.getAttribute('data-art-face'))
    await expect(zoom.locator('.ah-card-zoom-loading'), label).toHaveCount(0)
    await expect(zoom.locator('.ah-card-zoom-text'), label).not.toContainText('null')
    await expect(page.locator('.ah-card-inspection:visible'), label).toHaveCount(0)
    if (label === 'hand') await page.screenshot({ path: output + 'table-card-zoom.png', animations: 'disabled' })
    await page.keyboard.up('Alt')
    await expect(zoom, label).toHaveCount(0)
  }
  expect(errors).toEqual([])
})
