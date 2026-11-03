import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const output = fileURLToPath(new URL('../../../artifacts/migration/tic/p4/screenshots/', import.meta.url))
mkdirSync(output, { recursive: true })

async function start(page) {
  const errors = []
  await page.addLocatorHandler(page.getByRole('button', { name: '跳过演出' }), async locator => { await locator.click() })
  page.on('pageerror', error => errors.push(error.message))
  let latest = null
  page.on('response', async response => {
    if (!/\/api\/(start|move|session)(\?|$)/.test(response.url()) || !response.ok()) return
    try { const body = await response.json(); if (body.session) latest = body.session } catch {}
  })
  await page.route('**/api/start', async route => {
    const original = route.request().postDataJSON()
    const response = await route.fetch({ postData: JSON.stringify({ ...original,
      settings: { ...original.settings, legacyAutoStart: true, ticInteractionFixture: true } }) })
    await route.fulfill({ response })
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption('1')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-interaction="asset:tic-fixture-host"]')).toBeVisible()
  return { errors, latest: () => latest }
}
async function invoke(page, label) {
  const asset = page.locator('[data-interaction="asset:tic-fixture-host"]')
  await asset.click()
  await page.locator('.ah-card-action-popover').getByRole('button', { name: new RegExp(label) }).click()
}
const choice = page => page.locator('.ah-mechanic-choice')
async function pick(page, index = 0) {
  const button = choice(page).locator(`[data-option-id="pick:${index}"]`)
  await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'true')
}
async function confirm(page) {
  const id = await choice(page).getAttribute('data-choice-id')
  await choice(page).locator('[data-option-id="confirm"]').click()
  // A click only starts the HTTP move. Wait for its rendered result before opening another asset.
  await expect(page.locator(`.ah-mechanic-choice[data-choice-id="${id}"]`)).toHaveCount(0)
  await expect(page.locator('.ah-mechanic-choice[aria-busy="true"]')).toHaveCount(0)
}
async function pickOne(page, index = 0) { await pick(page, index); await confirm(page) }
async function screenshot(page, name) {
  const path = `${output}${name}.png`
  await page.screenshot({ path, animations: 'disabled' })
  test.info().annotations.push({ type: 'screenshot', description: path })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  for (const button of await choice(page).locator('button').all()) await expect(button).toBeInViewport({ ratio: 1 })
}

for (const [viewport, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  test(`P4 ${viewport} 封印多选、取消、提交中与失败重试`, async ({ page }) => {
    await page.setViewportSize({ width, height }); const run = await start(page)
    await invoke(page, '封印标记')
    await expect(choice(page)).toHaveAttribute('data-mechanic-choice', 'seal')
    await expect(choice(page).locator('[data-option-id="confirm"]')).toHaveCount(0)
    await pick(page); await page.keyboard.press('Escape')
    await expect(choice(page)).toHaveCount(0)
    await expect(page.locator('[data-interaction="asset:tic-fixture-host"]')).toBeFocused()
    await invoke(page, '封印标记')
    let failed = false
    await page.route('**/api/move', async route => {
      const body = route.request().postDataJSON()
      if (!failed && body.move?.action === 'choose') {
        failed = true
        await new Promise(resolve => setTimeout(resolve, 500))
        return route.fulfill({ status: 503, json: { ok: false, error: 'P4 暂时不可用，请重试' } })
      }
      await route.continue()
    })
    await choice(page).locator('[data-option-id="pick:0"]').click()
    await expect(choice(page)).toHaveAttribute('aria-busy', 'true')
    await expect(choice(page).locator('button').first()).toBeDisabled()
    await expect(page.getByText('P4 暂时不可用，请重试', { exact: true })).toBeVisible()
    await expect(choice(page)).toHaveAttribute('aria-busy', 'false')
    await pick(page, 0); await pick(page, 1)
    await screenshot(page, `${viewport}-seal-selection`)
    await confirm(page); await expect(choice(page)).toHaveCount(0)
    await expect.poll(() => run.latest()?.state.chaos?.sealed.length).toBe(2)
    await invoke(page, '释放标记'); await pickOne(page)
    await expect.poll(() => run.latest()?.state.chaos?.sealed.length).toBe(1)
    expect(run.errors).toEqual([])
  })

  test(`P4 ${viewport} 隐藏钥匙、转交、花费与公开状态`, async ({ page }) => {
    await page.setViewportSize({ width, height }); const run = await start(page)
    await expect(page.locator('[data-flood-level="2"]')).toHaveCount(1)
    await expect(page.locator('[data-air-required="true"]')).toBeVisible()
    await invoke(page, '取得钥匙')
    await expect(choice(page)).toContainText('未揭示钥匙')
    await expect(choice(page)).not.toContainText('蓝色钥匙')
    await pickOne(page)
    await invoke(page, '转交钥匙'); await pickOne(page)
    await expect(choice(page)).toContainText('同地点的接收者')
    await page.keyboard.press('Escape'); await expect(choice(page)).toHaveCount(0)
    await invoke(page, '转交钥匙'); await pickOne(page); await pickOne(page)
    await invoke(page, '花费钥匙'); await pickOne(page)
    await page.locator('.ah-mechanic-summary summary').click()
    await expect(page.locator('[data-key-color="red"]')).toHaveAttribute('data-key-holder', 'investigator:1')
    await expect(page.locator('[data-key-color="blue"]')).toHaveAttribute('data-key-holder', 'reference')
    await expect(page.locator('.ah-mechanic-summary')).not.toContainText('绿色钥匙')
    await screenshot(page, `${viewport}-keys-water`)
    expect(run.errors).toEqual([])
  })

  test(`P4 ${viewport} 载具座位、驾驶目的地、限制与空状态`, async ({ page }) => {
    await page.setViewportSize({ width, height }); const run = await start(page)
    await invoke(page, '进入载具'); await pickOne(page)
    await expect(page.locator('[data-air-required="false"]')).toBeVisible()
    await invoke(page, '驾驶载具'); await pickOne(page)
    await expect(choice(page)).toContainText('相邻目的地')
    await pickOne(page)
    await page.locator('.ah-mechanic-summary summary').click()
    await expect(page.locator('[data-vehicle-id="tic-fixture-boat"]')).toContainText('驾驶者')
    await expect(page.locator('[data-vehicle-enter-reason]')).toContainText('本轮')
    await screenshot(page, `${viewport}-vehicle`)
    await invoke(page, '离开载具'); await expect(choice(page)).toHaveCount(0)
    await expect.poll(() => run.latest()?.state.mechanics.vehicles[0].passengers).toEqual([0])
    expect(run.errors).toEqual([])
  })

  test(`P4 ${viewport} 原区投入、连续揭示、收回及中英键盘操作`, async ({ page }) => {
    await page.setViewportSize({ width, height }); const run = await start(page)
    await invoke(page, '特殊投入与收回')
    await expect(choice(page)).toHaveAttribute('data-mechanic-choice', 'commitOrigin')
    const detail = choice(page).locator('[data-mechanic-detail="01089"]')
    await detail.click(); await expect(page.getByRole('dialog', { name: '卡牌详情' })).toBeVisible()
    await page.keyboard.press('Escape'); await expect(detail).toBeFocused()
    await pickOne(page)
    await expect(page.locator('.ah-mechanic-choice[data-mechanic-choice="commitOrigin"]')).toHaveCount(0)
    for (let guard = 0; guard < 20; guard++) {
      await expect(page.locator('.ah-choice')).toBeVisible()
      if (await choice(page).count() && await choice(page).getAttribute('data-mechanic-choice') === 'returnCommitment') break
      const done = page.locator('.ah-choice [data-option-id="done"], .ah-choice [data-option-id="skip"]').first()
      const id = await page.locator('.ah-choice').getAttribute('data-choice-id')
      await expect(done).toBeVisible(); await done.click()
      await expect(page.locator(`.ah-choice[data-choice-id="${id}"]`)).toHaveCount(0)
    }
    await expect(choice(page)).toHaveAttribute('data-mechanic-choice', 'returnCommitment')
    await expect(choice(page).locator('[data-token-index]')).not.toHaveCount(0)
    await page.evaluate(async () => { (await import('/mods/arkhamhorror/i18n.js')).setLocale('en') })
    // Trigger a normal local rerender by focusing the source, then selecting with the keyboard.
    const option = choice(page).locator('[data-option-id="pick:0"]')
    await option.focus(); await page.keyboard.press('Enter')
    await expect(choice(page).getByRole('button', { name: 'Confirm selection', exact: true })).toBeVisible()
    await screenshot(page, `${viewport}-tokens-return-en`)
    await confirm(page)
    await expect.poll(() => run.latest()?.state.investigators[0].hand.includes('01089')).toBe(true)
    expect(run.errors).toEqual([])
  })
}
