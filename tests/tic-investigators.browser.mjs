import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const output = fileURLToPath(new URL('../../../artifacts/migration/tic/p5/screenshots/', import.meta.url))
mkdirSync(output, { recursive: true })
async function start(page, code, fixture = false) {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addLocatorHandler(page.getByRole('button', { name: '跳过演出' }), locator => locator.click())
  await page.emulateMedia({ reducedMotion: 'reduce' })
  let latest
  page.on('response', async response => {
    if (!/\/api\/(start|move|session)(\?|$)/.test(response.url()) || !response.ok()) return
    try { const body = await response.json(); if (body.session) latest = body.session } catch {}
  })
  await page.route('**/api/start', async route => {
    const original = route.request().postDataJSON()
    const response = await route.fetch({ postData: JSON.stringify({ ...original, settings: { ...original.settings,
      playerInvestigator: code, playerCount: 1, teammates: 0, legacyAutoStart: true, seed: `tic-p5-${code}`,
      ...(fixture ? { ticDexterFixture: true } : {}) } }) })
    await route.fulfill({ response })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('dialog', { name: '调查准备设置' }).getByRole('combobox', { name: '席位数量' }).selectOption('1')
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => latest?.state.investigators[0].code).toBe(code)
  return { errors, latest: () => latest }
}
async function screenshot(page, name) {
  const path = `${output}${name}.png`
  await page.screenshot({ path, animations: 'disabled' })
  test.info().annotations.push({ type: 'screenshot', description: path })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
for (const [viewport, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  for (const code of ['07001', '07002', '07003', '07004', '07005']) test(`P5 ${viewport} ${code} 真实选人构筑与开局`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page, code)
    const keep = page.locator('.ah-choice[data-choice-kind="mulligan"] [data-option-id="done"]')
    await expect(keep).toBeVisible(); await keep.click()
    await expect(page.locator('.ah-choice[data-choice-kind="mulligan"]')).toHaveCount(0)
    if (code === '07002') {
      const answer = page.locator('.ah-choice [data-option-id="0"]').first()
      await expect(answer).toBeVisible(); await answer.click()
      await expect(page.locator('.ah-choice[data-choice-kind="effect"]')).toHaveCount(0)
      await expect(page.locator('.ah-beneath-row')).toBeVisible()
      await expect(page.locator('.ah-mechanic-summary')).toHaveCount(0)
    }
    await expect.poll(() => run.latest()?.state.pendingChoice?.kind || null).toBe(null)
    if (code === '07001') expect(run.latest().state.chaosBag.filter(t => t === 'bless').length).toBe(2)
    await screenshot(page, `${viewport}-${code}-start`)
    expect(run.errors).toEqual([])
  })
  test(`P5 ${viewport} 戴克斯特调查员卡主动能力真实提交`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page, '07004', true)
    await page.locator('[data-interaction="investigator:0"]').first().click()
    const ability = page.locator('.ah-card-action-popover').getByRole('button', { name: /弃掉支援，以折扣/ })
    await expect(ability).toBeVisible(); await ability.click()
    // 选择面板由待决选择事务异步渲染：先等 pendingChoice 落地再点资产，
    // 否则点击会落在「无 move 的资产按钮」上被忽略（race：40 过/2 失败 → 全量重试可过）。
    await expect.poll(() => run.latest()?.state.pendingChoice?.prompt || '').toContain('选择弃掉的支援')
    // Mounted asset choices use the existing card itself; the duplicate prompt button is hidden.
    await page.locator('[data-interaction="asset:c1"]').click()
    await page.locator('.ah-choice [data-option-id="0"]').click()
    await expect.poll(() => run.latest()?.state.investigators[0].assets.some(a => a.code === '01031')).toBe(true)
    expect(run.latest().state.investigators[0].discard).toContain('01030')
    await screenshot(page, `${viewport}-dexter-replacement`)
    expect(run.errors).toEqual([])
  })
}
