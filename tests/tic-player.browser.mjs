import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const output = fileURLToPath(new URL('../../../artifacts/migration/tic/p6/screenshots/', import.meta.url))
mkdirSync(output, { recursive: true })
async function start(page, kind) {
  const errors = []; let latest
  page.on('pageerror', e => errors.push(e.message))
  await page.addLocatorHandler(page.getByRole('button', { name: '跳过演出' }), l => l.click())
  await page.emulateMedia({ reducedMotion: 'reduce' })
  page.on('response', async r => {
    if (!/\/api\/(start|move|session)(\?|$)/.test(r.url()) || !r.ok()) return
    try { const body = await r.json(); if (body.session) latest = body.session } catch {}
  })
  await page.route('**/api/start', async route => {
    const body = route.request().postDataJSON()
    const response = await route.fetch({ postData: JSON.stringify({ ...body, settings: {
      ...body.settings, playerCount: 1, teammates: 0, legacyAutoStart: true, ticPlayerFixture: kind,
    } }) })
    await route.fulfill({ response })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('dialog', { name: '调查准备设置' }).getByRole('combobox', { name: '席位数量' }).selectOption('1')
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => latest?.state.investigators[0].assets[0]?.code).toBe(kind === 'grimoire' ? '07191' : '07303')
  return { latest: () => latest, errors }
}
async function shot(page, name) {
  const path = `${output}${name}.png`
  await page.screenshot({ path, animations: 'disabled' })
  test.info().annotations.push({ type: 'screenshot', description: path })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
for (const [size, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  test(`P6 ${size} 秘典支付秘密后快速打出洞察事件`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page, 'grimoire')
    await page.locator('[data-interaction="hand:0:0"]').first().click()
    await page.locator('[data-interaction="zone:play"]').click()
    await expect.poll(() => run.latest()?.state.investigators[0].discard.includes('02105')).toBe(true)
    const inv = run.latest().state.investigators[0]
    expect(inv.assets.find(a => a.code === '07191').uses).toBe(0)
    expect(inv.resources).toBe(0); expect(inv.damage).toBe(0); expect(inv.actionsLeft).toBe(0)
    await shot(page, `${size}-grimoire`); expect(run.errors).toEqual([])
  })
  test(`P6 ${size} 先祖知识下方技能选择与抽取`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page, 'ancestral')
    await expect(page.locator('.ah-beneath-row[data-origin-host]')).toBeVisible()
    await page.locator('[data-interaction="asset:c1"]').first().click()
    await page.locator('.ah-card-action-popover').getByRole('button', { name: /抽取 1 张附属技能/ }).click()
    await expect(page.locator('.ah-choice')).toContainText('选择抽取的附属技能')
    await shot(page, `${size}-ancestral-choice`)
    await page.locator('.ah-choice [data-option-id="0"]').click()
    await expect.poll(() => run.latest()?.state.investigators[0].hand.length).toBe(1)
    expect(run.latest().state.investigators[0].assets[0].exhausted).toBe(true)
    await expect(page.locator('.ah-beneath-row[data-origin-host] .ah-minicard')).toHaveCount(1)
    await shot(page, `${size}-ancestral-drawn`); expect(run.errors).toEqual([])
  })
}
