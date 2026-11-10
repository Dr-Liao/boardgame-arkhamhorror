// 八循环《绯红密钥》（TSK）P4 新增交互浏览器验收 spec。
//
// 证据形态与 TIC/EotE P4 相同：**真实大厅 HTTP + 真实引擎**，state 由
// tests/tsk-interaction-fixture.mjs 的测试夹具在服务端 createState 时注入（不新增夹具端点、
// 不注册生产内容）。
//
// 覆盖 2 个视口（桌面 1440×900 / 移动 390×844）× 6 项交互：
//   隐匿迷你卡揭露与空状态（含未揭露身份隐私）/ 绯红密钥变换 / 空洞回收 /
//   世界地图启程与快捷旅票 / 定制升级勾选 / 跨座位即时行动授权与执行。
// 每项都断言：pageerror 为空、服务端合法动作驱动（点击即提交 move）、无横向滚动、截图。
// 选择面板统一使用 `.ah-mechanic-choice[data-mechanic-choice="<op>"]` 约定；
// 摘要使用 `[data-tsk-*]` 数据属性。
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('../../../artifacts/migration/tsk/p4/screenshots/', import.meta.url))
mkdirSync(output, { recursive: true })

// 与 tests/tsk-interaction-fixture.mjs 的常量保持一致（spec 是独立进程，不 import 引擎夹具）。
const HOST = 'tsk-fixture-host'
const HARNESS = `[data-interaction="asset:${HOST}"]`
const CONCEALED_TOTAL = 3
const HOLLOW_TOTAL = 2

async function start(page) {
  const errors = []
  await page.addLocatorHandler(page.getByRole('button', { name: '跳过演出' }), async locator => { await locator.click() })
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/start', async route => {
    const original = route.request().postDataJSON()
    const response = await route.fetch({ postData: JSON.stringify({ ...original,
      settings: { ...original.settings, legacyAutoStart: true, tskInteractionFixture: true } }) })
    await route.fulfill({ response })
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption('1')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator(HARNESS)).toBeVisible()
  return { errors }
}

async function openActionPopover(page, label) {
  const popover = page.locator('.ah-card-action-popover')
  const match = popover.getByRole('button', { name: new RegExp(label) })
  if (await match.count()) {
    await expect(match).toBeVisible()
    return match
  }
  if (await popover.count()) await page.keyboard.press('Escape')
  const harness = page.locator(HARNESS)
  await harness.dispatchEvent('click')
  if (!(await match.count())) {
    await page.waitForTimeout(120)
    await harness.dispatchEvent('click')
  }
  await expect(match).toBeVisible()
  return match
}

async function invoke(page, label) {
  const button = await openActionPopover(page, label)
  await button.click()
}

const choice = page => page.locator('.ah-mechanic-choice')
const mechanicChoice = (page, operation) => page.locator(`.ah-mechanic-choice[data-mechanic-choice="${operation}"]`)

async function pick(page, index = 0) {
  const button = choice(page).locator(`[data-option-id="pick:${index}"]`)
  await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'true')
}

async function pickOption(page, optionId) {
  await choice(page).locator(`[data-option-id="${optionId}"]`).click()
}

async function confirm(page) {
  const id = await choice(page).getAttribute('data-choice-id')
  await choice(page).locator('[data-option-id="confirm"]').click()
  await expect(page.locator(`.ah-mechanic-choice[data-choice-id="${id}"]`)).toHaveCount(0)
  await expect(page.locator('.ah-mechanic-choice[aria-busy="true"]')).toHaveCount(0)
}

async function openSummary(page) {
  const summary = page.locator('.ah-mechanic-summary')
  await expect(summary).toBeVisible()
  const open = await summary.evaluate(element => element instanceof HTMLDetailsElement && element.open)
  if (!open) await summary.locator('summary').click()
  await expect(summary.locator('summary')).toBeVisible()
  return summary
}

async function screenshot(page, name) {
  const path = `${output}${name}.png`
  await page.screenshot({ path, animations: 'disabled' })
  test.info().annotations.push({ type: 'screenshot', description: path })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  if (await choice(page).count()) {
    for (const button of await choice(page).locator('button').all()) await expect(button).toBeInViewport({ ratio: 1 })
  }
}

async function expectNoChoice(page) {
  // 空候选 = 服务端直接返回 false / 不产生 pending choice；等待一小段时间确认没有面板出现。
  await page.waitForTimeout(350)
  await expect(choice(page)).toHaveCount(0)
}

for (const [viewport, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  test(`P4 ${viewport} 隐匿迷你卡揭露与空状态`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page)
    const summary = await openSummary(page)
    const concealed = summary.locator('[data-tsk-concealed-count]')
    await expect(concealed).toHaveAttribute('data-tsk-concealed-count', String(CONCEALED_TOTAL))
    await expect(concealed).toHaveAttribute('data-tsk-concealed-hidden', String(CONCEALED_TOTAL))
    // 隐私：未揭露的迷你卡不显示真身/诱饵身份。
    expect(await summary.innerText()).not.toContain('CoterieAgent')
    expect(await summary.innerText()).not.toContain('Decoy')
    // 合法揭露：选择位置后确认，迷你卡被取出。
    await invoke(page, '隐匿揭露')
    await expect(mechanicChoice(page, 'tskConcealed')).toHaveCount(1)
    await pick(page, 0)
    await screenshot(page, `${viewport}-concealed-choice`)
    await confirm(page)
    await expect(concealed).toHaveAttribute('data-tsk-concealed-count', String(CONCEALED_TOTAL - 1))
    // 取消路径：再次打开选择，点「取消，保留原状态」，数量不变。
    await invoke(page, '隐匿揭露')
    const id = await choice(page).getAttribute('data-choice-id')
    await pickOption(page, 'cancel')
    await expect(page.locator(`.ah-mechanic-choice[data-choice-id="${id}"]`)).toHaveCount(0)
    await expect(concealed).toHaveAttribute('data-tsk-concealed-count', String(CONCEALED_TOTAL - 1))
    // 空状态：揭露完当前地点最后一张后，再次触发不会产生选择面板。
    await invoke(page, '隐匿揭露')
    await pick(page, 0)
    await confirm(page)
    await expect(concealed).toHaveAttribute('data-tsk-concealed-count', '1')
    await invoke(page, '隐匿揭露')
    await expectNoChoice(page)
    await screenshot(page, `${viewport}-concealed-final`)
    expect(run.errors).toEqual([])
  })

  test(`P4 ${viewport} 绯红密钥变换`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page)
    const summary = await openSummary(page)
    const key = summary.locator('[data-tsk-key="keyCrimson"]')
    await expect(key).toHaveAttribute('data-stable', 'true')
    await expect(key).toHaveAttribute('data-shifted-this-round', 'false')
    await invoke(page, '密钥变换')
    await expect(mechanicChoice(page, 'tskKey')).toHaveCount(1)
    await pick(page, 0)
    await confirm(page)
    await expect(key).toHaveAttribute('data-stable', 'false')
    await expect(key).toHaveAttribute('data-shifted-this-round', 'true')
    await screenshot(page, `${viewport}-keys`)
    // 同一轮再次触发：没有可变换的密钥（空候选，不产生面板）。
    await invoke(page, '密钥变换')
    await expectNoChoice(page)
    expect(run.errors).toEqual([])
  })

  test(`P4 ${viewport} 空洞回收`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page)
    const summary = await openSummary(page)
    const count = summary.locator('[data-tsk-hollow-count]')
    await expect(count).toHaveAttribute('data-tsk-hollow-count', String(HOLLOW_TOTAL))
    await invoke(page, '空洞回收')
    await expect(mechanicChoice(page, 'tskHollow')).toHaveCount(1)
    await pick(page, 0)
    await confirm(page)
    await expect(count).toHaveAttribute('data-tsk-hollow-count', String(HOLLOW_TOTAL - 1))
    await invoke(page, '空洞回收')
    await pick(page, 0)
    await confirm(page)
    // 空洞区清空后整段摘要消失（空状态不渲染）。
    await expect(summary.locator('[data-tsk-hollow-count]')).toHaveCount(0)
    await screenshot(page, `${viewport}-hollow-empty`)
    expect(run.errors).toEqual([])
  })

  test(`P4 ${viewport} 世界地图启程与快捷旅票`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page)
    const summary = await openSummary(page)
    const mapLine = summary.locator('[data-tsk-map-current]')
    await expect(mapLine).toHaveAttribute('data-tsk-map-current', 'hub')
    await expect(mapLine).toHaveAttribute('data-tsk-map-time', '0')
    await invoke(page, '世界地图启程')
    await expect(mechanicChoice(page, 'tskMap')).toHaveCount(1)
    await pick(page, 0)
    await confirm(page)
    await expect(mapLine).toHaveAttribute('data-tsk-map-current', 'green1')
    await expect(mapLine).toHaveAttribute('data-tsk-map-time', '2')
    // 快捷旅票：记 1 时间直达，可从绿地继续启程。
    await invoke(page, '快捷旅票')
    await expect(mechanicChoice(page, 'tskMap')).toHaveCount(1)
    await pick(page, 0)
    await screenshot(page, `${viewport}-map-choice`)
    await confirm(page)
    await expect(mapLine).toHaveAttribute('data-tsk-map-time', '3')
    expect(run.errors).toEqual([])
  })

  test(`P4 ${viewport} 定制升级勾选`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page)
    const summary = await openSummary(page)
    const custom = summary.locator('[data-tsk-customization="testTskCustom"]')
    await expect(custom).toHaveAttribute('data-level', '1')
    await expect(custom).toHaveAttribute('data-checked', '1')
    // 取消路径：不写状态。
    await invoke(page, '定制勾选')
    await expect(mechanicChoice(page, 'tskCustomizable')).toHaveCount(1)
    await pickOption(page, 'cancel')
    await expect(custom).toHaveAttribute('data-level', '1')
    // 合法路径：勾选 2 格（多选需要逐项 pick 后 confirm）。
    await invoke(page, '定制勾选')
    await pick(page, 0)
    await pick(page, 1)
    await screenshot(page, `${viewport}-customizable`)
    await confirm(page)
    await expect(custom).toHaveAttribute('data-checked', '3')
    await expect(custom).toHaveAttribute('data-level', '2')
    expect(run.errors).toEqual([])
  })

  test(`P4 ${viewport} 跨座位即时行动`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page)
    const summary = await openSummary(page)
    await expect(summary.locator('[data-tsk-cross-seat]')).toHaveCount(0)
    await invoke(page, '跨座位授权')
    await expect(mechanicChoice(page, 'tskCrossSeat')).toHaveCount(1)
    await pick(page, 0)
    await confirm(page)
    const grant = summary.locator('[data-tsk-cross-seat="1"]')
    await expect(grant).toHaveAttribute('data-from-seat', '0')
    await screenshot(page, `${viewport}-cross-seat`)
    // 执行并消耗授权：授权行从摘要消失（窗口结算后回到原时序）。
    await invoke(page, '跨座位执行')
    await expect(summary.locator('[data-tsk-cross-seat]')).toHaveCount(0)
    // 同一轮再次授权：候选已用尽（空候选，不产生面板）。
    await invoke(page, '跨座位授权')
    await expectNoChoice(page)
    expect(run.errors).toEqual([])
  })
}
