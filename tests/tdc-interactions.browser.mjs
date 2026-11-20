import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const output = new URL('../../../artifacts/migration/tdc/p4/screenshots/', import.meta.url)
const fixtureAsset = '[data-interaction="asset:tdc-fixture-console"]'
const panel = page => page.locator('.ah-mechanic-choice')
const summary = page => page.locator('[data-tdc-summary]')
const option = (page, id) => panel(page).locator(`[data-option-id="${id}"]`)

async function openTable(page, width, height, scriptCard = 'act') {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width, height })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addLocatorHandler(page.getByRole('button', { name: '跳过演出' }), locator => locator.click())
  await page.route('**/api/start', async route => {
    const body = route.request().postDataJSON()
    const response = await route.fetch({ postData: {
      ...body, settings: { ...body.settings, legacyAutoStart: true, tdcInteractionFixture: scriptCard },
    } })
    await route.fulfill({ response })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption('1')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator(fixtureAsset)).toBeVisible({ timeout: 30_000 })
  return errors
}

async function openSummary(page) {
  const details = page.locator('.ah-mechanic-summary').filter({ has: summary(page) })
  if (!(await details.evaluate(node => node.open))) await details.locator('summary').click()
  await expect(summary(page)).toBeVisible()
}

async function invoke(page, label) {
  const target = page.locator('.ah-card-action-popover').getByRole('button', { name: new RegExp(label) })
  if (!(await target.isVisible())) {
    await page.locator(fixtureAsset).click()
  }
  await expect(target).toBeVisible()
  const response = page.waitForResponse(response => response.url().endsWith('/api/move') && response.request().method() === 'POST')
  await target.click()
  expect((await response).ok()).toBe(true)
}

async function pick(page, index = 0) {
  await option(page, `pick:${index}`).click()
  await expect(option(page, `pick:${index}`)).toHaveAttribute('aria-pressed', 'true')
  const before = await panel(page).getAttribute('data-choice-id')
  await option(page, 'confirm').click()
  await expect(page.locator(`.ah-mechanic-choice[data-choice-id="${before}"]`)).toHaveCount(0)
}

async function snapshot(page, name) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  const path = fileURLToPath(new URL(`${name}.png`, output))
  await page.screenshot({ path, animations: 'disabled' })
  test.info().annotations.push({ type: 'screenshot', description: path })
}

async function finishTest(page) {
  await page.getByRole('button', { name: '开始检定', exact: true }).click()
  const next = page.getByRole('button', { name: '继续', exact: true })
  await next.click()
  await expect(next).toHaveCount(0)
}

for (const [viewport, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  test(`P4 ${viewport} task privacy, cancel and retry`, async ({ page }) => {
    const errors = await openTable(page, width, height)
    await openSummary(page)
    await expect(summary(page).locator('[data-tdc-task]')).toContainText('2 项任务')
    await invoke(page, '领取任务')
    await expect(panel(page).locator('[data-option-id^="pick:"]')).toHaveCount(2)
    await expect(panel(page)).not.toContainText('私人任务·守岸')
    await option(page, 'pick:0').focus()
    await page.keyboard.press('Escape')
    await expect(panel(page)).toHaveCount(0)
    await expect(page.locator(fixtureAsset)).toBeFocused()
    await invoke(page, '领取任务')
    const rejectOne = async route => route.fulfill({ status: 500, json: { error: '模拟提交失败' } })
    await page.route('**/api/move', rejectOne, { times: 1 })
    await option(page, 'pick:0').click()
    await expect(page.getByText('模拟提交失败', { exact: false }).first()).toBeVisible()
    await expect(option(page, 'pick:0')).toBeEnabled()
    await expect(option(page, 'pick:0')).toHaveAttribute('aria-pressed', 'false')
    await pick(page)
    await openSummary(page)
    await expect(summary(page).locator('[data-tdc-task]')).toContainText('绘制海岸地图 · 0 点进度')
    await invoke(page, '领取任务')
    await expect(panel(page)).toHaveCount(0)
    await summary(page).locator('[data-tdc-task]').scrollIntoViewIfNeeded()
    await snapshot(page, `${viewport}-task`)
    expect(errors).toEqual([])
  })

  test(`P4 ${viewport} routes, glyphs and map`, async ({ page }) => {
    const errors = await openTable(page, width, height)
    await invoke(page, '选定远征路线')
    await expect(panel(page).locator('[data-option-id^="pick:"]')).toHaveCount(2)
    await pick(page, viewport === 'mobile' ? 1 : 0)
    await invoke(page, '划除远征区域')
    await expect(panel(page).locator('[data-option-id^="pick:"]')).toHaveCount(1)
    await pick(page)
    await invoke(page, '划除远征区域')
    await expect(panel(page)).toHaveCount(0)
    await invoke(page, '解读发现的字形')
    await pick(page)
    await invoke(page, '重排前方地点')
    await expect(panel(page).locator('[data-option-id^="pick:"]')).toHaveCount(1)
    await expect(panel(page)).not.toContainText('被占据的格子')
    await pick(page)
    await openSummary(page)
    await expect(summary(page).locator('[data-tdc-route][data-selected=true]')).toHaveAttribute('data-tdc-route', viewport === 'mobile' ? 'west' : 'east')
    await expect(summary(page).locator('[data-tdc-region][data-crossed=true] del')).toHaveCount(1)
    await expect(summary(page).locator('[data-tdc-glyph]')).toHaveCount(26)
    await expect(summary(page).locator('[data-tdc-glyph=A]')).toContainText('潮水')
    await expect(summary(page)).not.toContainText(/暗置译文|未触发译文|暗置地点的正面正文/)
    await expect(summary(page).locator('[data-tdc-cell=tdcSlope]')).toHaveAttribute('data-y', '2')
    await summary(page).locator('[data-tdc-glyph=A]').scrollIntoViewIfNeeded()
    await snapshot(page, `${viewport}-map`)
    expect(errors).toEqual([])
  })

  test(`P4 ${viewport} artifact tie and multipart targets`, async ({ page }) => {
    const errors = await openTable(page, width, height)
    await invoke(page, '分配已获得的文物')
    await pick(page)
    await expect(panel(page).locator('[data-option-id^="pick:"]')).toHaveCount(4)
    await pick(page, 1)
    await invoke(page, '结算文物持有人败退')
    await expect(panel(page).locator('[data-option-id^="pick:"]')).toHaveCount(2)
    await expect(panel(page)).not.toContainText('远处调查员')
    await expect(option(page, 'cancel')).toHaveCount(0)
    await pick(page, 1)
    await openSummary(page)
    await expect(summary(page).locator('[data-tdc-artifact]')).toHaveAttribute('data-holder', '2')
    const board = summary(page).locator('[data-tdc-board]')
    await expect(board.locator('[data-tdc-part]')).toHaveCount(2)
    const left = board.locator('[data-tdc-part]').filter({ hasText: '左部位' })
    const fightCommand = page.waitForRequest(request => request.url().endsWith('/api/move') && request.postDataJSON()?.move?.action === 'fight')
    const expectedFight = await left.getAttribute('data-tdc-part')
    await left.locator('[data-tdc-target=fight]').click()
    expect((await fightCommand).postDataJSON().move.enemyId).toBe(expectedFight)
    await finishTest(page)
    await openSummary(page)
    const right = board.locator('[data-tdc-part]').filter({ hasText: '右部位' })
    const evade = right.locator('[data-tdc-target=evade]')
    const command = page.waitForRequest(request => request.url().endsWith('/api/move') && request.postDataJSON()?.move?.action === 'evade')
    const expected = await right.getAttribute('data-tdc-part')
    await evade.click()
    expect((await command).postDataJSON().move.enemyId).toBe(expected)
    await finishTest(page)
    await openSummary(page)
    await expect(evade).toBeDisabled()
    await expect(right.locator('[data-target-reason=evade]')).toContainText('未与你交战')
    await board.scrollIntoViewIfNeeded()
    await snapshot(page, `${viewport}-board`)
    expect(errors).toEqual([])
  })

  test(`P4 ${viewport} script ownership and guide recovery`, async ({ page }) => {
    const variant = viewport === 'mobile' ? 'agenda' : 'act'
    let attempts = 0
    const content = {
      specialRules: [{ title: '专用互动规则', text: '重排后按当前地图计算连接。' }],
      intro: [], setup: [{ text: '将调查员放在出发地点。' }],
      story: [{ text: '仅在主动展开时显示的阅读材料。' }],
      resolutions: [{ text: '仅在主动展开时显示的结算说明。' }],
    }
    const english = { ...content, specialRules: [{ title: 'Special map rule', text: 'Read connections from the current arrangement.' }] }
    await page.route('**/scenario-guides/theGathering.json', route => ++attempts === 1
      ? route.fulfill({ status: 503 })
      : route.fulfill({ json: { id: 'theGathering', locales: { zh: content, en: english } } }))
    const errors = await openTable(page, width, height, variant)
    const source = page.locator(`[data-interaction="${variant}:current"]`).first()
    await expect(source).toHaveClass(/ah-card-ready/)
    const script = page.locator(`.ah-table-script [data-script-card="${variant}"]`).filter({ hasText: '探索' })
    await expect(script).toBeEnabled()
    const setup = page.locator('[data-scenario-setup]')
    await expect(page.locator('.ah-scenario-reference').locator('[data-scenario-setup]')).toHaveCount(1)
    await expect(page.locator('.ah-scenario-reference .ah-reference-card + [data-scenario-setup]')).toHaveCount(1)
    await setup.click()
    const guide = page.getByRole('dialog', { name: '关卡设置', exact: true })
    await expect(guide.getByRole('status')).toContainText('加载失败')
    await guide.getByRole('button', { name: '重新加载指南' }).click()
    await expect(guide.locator('.ah-setup-section').first()).toContainText('专用互动规则')
    await expect(guide.locator('details')).toHaveCount(2)
    await expect(guide.locator('details[open]')).toHaveCount(0)
    await expect(guide).not.toContainText('异席已触发的私人分支')
    await snapshot(page, `${viewport}-guide`)
    await page.keyboard.press('Escape')
    await expect(setup).toBeFocused()
    await page.evaluate(async () => (await import('/mods/arkhamhorror/catalog.js')).setHostLocale('en'))
    await setup.click()
    await expect(guide).toContainText('Special map rule')
    await page.keyboard.press('Escape')
    await expect(setup).toBeFocused()
    const dispatch = page.waitForRequest(request => request.url().endsWith('/api/move') && request.postDataJSON()?.move?.action === 'explore')
    await script.click()
    expect((await dispatch).postDataJSON().move.scriptCard).toBe(variant)
    expect(attempts).toBe(2)
    expect(errors).toEqual([])
  })
}
