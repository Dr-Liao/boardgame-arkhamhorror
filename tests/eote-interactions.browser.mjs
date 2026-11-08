// 七循环《地球边缘》（EotE）P4 新增交互浏览器验收 spec。
//
// 证据形态与 TIC P4 相同：**真实大厅 HTTP + 真实引擎**，state 由 tests/eote-interaction-fixture.mjs
// 的测试夹具在服务端 createState 时注入（不新增夹具端点、不注册生产内容）。
//
// 覆盖 2 个视口（桌面 1440×900 / 移动 390×844）× 8 项交互：
//   寒霜连续揭示与池余量 / 伙伴选派 / 封印放置 / 忒咳哩-哩洗入 / 牌库顶揭示 /
//   跨座位代打 / 物资指派 / 演武选择。
// 每项都断言：pageerror 为空、服务端合法动作驱动（点击即提交 move）、无横向滚动、截图。
// 选择面板统一使用 P4-B 的 `.ah-mechanic-choice[data-mechanic-choice="<op>"]` 约定；
// 摘要使用 `[data-eote-frost|partners|seals|tekeli|deck-top|cross-seat|disciplines|supplies]`。
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('../../../artifacts/migration/eote/p4/screenshots/', import.meta.url))
mkdirSync(output, { recursive: true })

// 与 tests/eote-interaction-fixture.mjs 的常量保持一致（spec 是独立进程，不 import 引擎夹具）。
const HOST = 'eote-fixture-host'
const HARNESS = `[data-interaction="asset:${HOST}"]`
const PARTNER_COUNT = 9
const SUPPLY_COUNT = 7
const TEKELI_INITIAL = 16
const DISCIPLINE_COUNT = 4
const CROSS_SEAT_CODE = '01020'
const DECK_TOP_CODE = '01031'
const CHOICE_OPERATIONS = Object.freeze({
  partner: 'eotePartner', seal: 'eoteSeal', tekeli: 'eoteTekeli',
  crossSeat: 'eoteCrossSeat', supply: 'eoteSupply',
})

// 大厅启动：镜像 TIC P4 的 start()，只是开局设置换成 eoteInteractionFixture。
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
      settings: { ...original.settings, legacyAutoStart: true, eoteInteractionFixture: true } }) })
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
  return { errors, latest: () => latest }
}

// 打开展示 HARNESS 卡的动作条。牌桌时间线等浮层可能盖住卡面命中点，因此这里用元素上的
// click 事件打开动作条（同一份 onclick 处理），随后所有动作/选择按钮仍走真实鼠标点击。
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
  // 一次点击只提交 HTTP move；等本次选择结算完成再继续。
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

// 技能检定等通用面板（`.ah-choice`）的「开始检定 / 让过」步骤：不投入卡牌，直接推进。
// 机制选择（`.ah-mechanic-choice`）不在此处消费；`until` 满足时提前返回。
async function resolveBasicChoices(page, { until = null } = {}) {
  for (let guard = 0; guard < 40; guard++) {
    if (until && await until()) return
    const panel = page.locator('.ah-choice')
    if (!(await panel.count())) { await page.waitForTimeout(150); continue }
    const finish = panel.locator('[data-option-id="done"], [data-option-id="skip"]').first()
    if (!(await finish.count())) { await page.waitForTimeout(150); continue }
    const id = await panel.getAttribute('data-choice-id')
    await finish.click()
    await expect(page.locator(`.ah-choice[data-choice-id="${id}"]`)).toHaveCount(0)
  }
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

for (const [viewport, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  test(`P4 ${viewport} 寒霜连续揭示与池余量`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page)
    const summary = await openSummary(page)
    const frost = page.locator('[data-eote-frost]')
    // 夹具袋内有 2 枚寒霜（上限 8），摘要按「袋内 + 揭示区 + 封印区」计算余量。
    await expect(frost).toHaveAttribute('data-eote-frost', '6')
    await expect(frost).toHaveAttribute('data-eote-frost-limit', '8')
    // 关掉 reducedMotion，让「检定结果」横幅（含自动失败文案与两枚寒霜）保持可断言时长。
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await invoke(page, '寒霜连续揭示')
    // 检定开始前的「投入卡牌」窗口：不投入，点「开始检定」继续。
    await resolveBasicChoices(page, { until: async () => (await page.locator('.ah-fx-banner').count()) > 0 })
    const banner = page.locator('.ah-fx-banner.is-failure')
    await expect(banner).toBeVisible({ timeout: 15_000 })
    // 先截图再断言：结果横幅是瞬时 UI；`animations:'disabled'` 会快进动画并提前移除它。
    await page.waitForTimeout(260)
    const frostPath = `${output}${viewport}-frost.png`
    await page.screenshot({ path: frostPath, animations: 'allow' })
    test.info().annotations.push({ type: 'screenshot', description: frostPath })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(banner).toContainText('自动失败')
    await expect(banner.locator('.ah-fx-chaos[data-chaos-token="frost"]')).toHaveCount(2)
    // 检定结束后寒霜回到袋内，池余量仍是 6/8（有限实物池而不是消耗品）。
    await expect(frost).toHaveAttribute('data-eote-frost', '6')
    expect(run.errors).toEqual([])
  })

  test(`P4 ${viewport} 伙伴选派`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page)
    await invoke(page, '伙伴选派')
    await expect(choice(page)).toHaveAttribute('data-mechanic-choice', CHOICE_OPERATIONS.partner)
    await expect(choice(page).locator('[data-option-id^="pick:"]')).toHaveCount(PARTNER_COUNT)
    // 取消：Esc 关闭选择且不写状态（伙伴名册保持 9 位安全状态）。
    await pick(page, 0)
    await page.keyboard.press('Escape')
    await expect(choice(page)).toHaveCount(0)
    await expect(page.locator(HARNESS)).toBeFocused()
    // 重新选派 2 位并确认。
    await invoke(page, '伙伴选派')
    await pick(page, 0); await pick(page, 1)
    await screenshot(page, `${viewport}-partners`)
    await confirm(page)
    await expect(choice(page)).toHaveCount(0)
    const summary = await openSummary(page)
    await expect(summary.locator('[data-eote-partner]')).toHaveCount(PARTNER_COUNT)
    await expect(summary.locator('[data-eote-partner="08714"]')).toBeVisible()
    expect(run.errors).toEqual([])
  })

  test(`P4 ${viewport} 封印放置`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page)
    const summary = await openSummary(page)
    await expect(summary.locator('[data-eote-seal="A"]')).toHaveAttribute('data-seal-active', 'true')
    // 取消路径：Esc 关闭选择，封印 A 仍在控制者手中（不写状态）。
    await invoke(page, '封印放置')
    await expect(choice(page)).toHaveAttribute('data-mechanic-choice', CHOICE_OPERATIONS.seal)
    await page.keyboard.press('Escape')
    await expect(choice(page)).toHaveCount(0)
    await expect(summary.locator('[data-eote-seal="A"]')).not.toContainText('已放置')
    // 失败重试：第一次选择 move 返回 503，面板显示错误后可重试。
    let failed = false
    await page.route('**/api/move', async route => {
      const body = route.request().postDataJSON()
      if (!failed && body.move?.action === 'choose') {
        failed = true
        await new Promise(resolve => setTimeout(resolve, 300))
        return route.fulfill({ status: 503, json: { ok: false, error: 'P4 暂时不可用，请重试' } })
      }
      await route.continue()
    })
    await invoke(page, '封印放置')
    // 第一次选择移动故意失败：这里不能走 pick()（它断言 aria-pressed=true），直接点选项。
    await choice(page).locator('[data-option-id="pick:0"]').click()
    await expect(page.getByText('P4 暂时不可用，请重试', { exact: true })).toBeVisible()
    await expect(choice(page)).toHaveAttribute('aria-busy', 'false')
    // 重试：第一阶段选封印 → 确认 → 第二阶段选放置地点 → 确认。
    await pick(page, 0)
    await expect(choice(page)).toHaveAttribute('data-mechanic-choice', CHOICE_OPERATIONS.seal)
    await screenshot(page, `${viewport}-seals`)
    await confirm(page)
    await expect(choice(page)).toHaveAttribute('data-mechanic-choice', CHOICE_OPERATIONS.seal)
    await pick(page, 0)
    await confirm(page)
    await expect(choice(page)).toHaveCount(0)
    const reopened = await openSummary(page)
    await expect(reopened.locator('[data-eote-seal="A"]')).toContainText('已放置')
    expect(run.errors).toEqual([])
  })

  test(`P4 ${viewport} 忒咳哩-哩洗入`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page)
    let summary = await openSummary(page)
    await expect(summary.locator('[data-eote-tekeli]')).toHaveAttribute('data-eote-tekeli', String(TEKELI_INITIAL))
    await invoke(page, '忒咳哩-哩洗入')
    await expect(choice(page)).toHaveAttribute('data-mechanic-choice', CHOICE_OPERATIONS.tekeli)
    // 第二阶段：选择结算后的去向（bottom = 放回忒咳哩-哩牌库底）。
    await pick(page, 0)
    await screenshot(page, `${viewport}-tekeli`)
    await confirm(page)
    await expect(choice(page)).toHaveCount(0)
    summary = await openSummary(page)
    await expect(summary.locator('[data-eote-tekeli]')).toHaveAttribute('data-eote-tekeli', String(TEKELI_INITIAL - 1))
    // 洗入不看内容：页面不得出现忒咳哩-哩卡名（英文名），只允许「张数」摘要。
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toContain('Tekeli-li')
    expect(run.errors).toEqual([])
  })

  test(`P4 ${viewport} 牌库顶揭示`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page)
    const summary = await openSummary(page)
    const deckTop = summary.locator('[data-eote-deck-top]')
    await expect(deckTop).toHaveCount(1)
    await expect(deckTop).toHaveAttribute('data-eote-deck-top', '0')
    await expect(deckTop).toHaveAttribute('data-deck-top-code', DECK_TOP_CODE)
    await expect(deckTop).not.toBeEmpty()
    // 牌库顶是本人私有通道：合法 move 里必须有 fromDeckTop 的打出候选。
    await expect.poll(() => run.latest()?.state.legalMoves
      ?.some(move => move.fromDeckTop === true && move.cardId === DECK_TOP_CODE)).toBe(true)
    await screenshot(page, `${viewport}-deck-top`)
    expect(run.errors).toEqual([])
  })

  test(`P4 ${viewport} 跨座位代打`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page)
    const summary = await openSummary(page)
    await expect(summary.locator('[data-eote-cross-seat]')).toHaveAttribute('data-from-seat', '1')
    await invoke(page, '跨座位选择')
    await expect(choice(page)).toHaveAttribute('data-mechanic-choice', CHOICE_OPERATIONS.crossSeat)
    // 候选卡来自队友真实手牌（可查看详情按钮按卡号定位），选择不泄露未授权手牌。
    await expect(choice(page).locator(`[data-mechanic-detail="${CROSS_SEAT_CODE}"]`)).toHaveCount(1)
    // 取消路径：Esc 关闭且焦点回到来源支援。
    await pick(page, 0)
    await page.keyboard.press('Escape')
    await expect(choice(page)).toHaveCount(0)
    await expect(page.locator(HARNESS)).toBeFocused()
    await invoke(page, '跨座位选择')
    await pick(page, 0)
    await screenshot(page, `${viewport}-cross-seat`)
    await confirm(page)
    await expect(choice(page)).toHaveCount(0)
    expect(run.errors).toEqual([])
  })

  test(`P4 ${viewport} 物资指派`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page)
    const summary = await openSummary(page)
    await expect(summary.locator('[data-eote-supplies="0"]')).toHaveAttribute('data-supply-count', String(SUPPLY_COUNT))
    await invoke(page, '物资指派')
    await expect(choice(page)).toHaveAttribute('data-mechanic-choice', CHOICE_OPERATIONS.supply)
    // 两阶段：先选物资，再选同地点接收者。
    await pick(page, 0)
    await screenshot(page, `${viewport}-supply`)
    await confirm(page)
    await expect(choice(page)).toHaveAttribute('data-mechanic-choice', CHOICE_OPERATIONS.supply)
    await pick(page, 0)
    await confirm(page)
    await expect(choice(page)).toHaveCount(0)
    const reopened = await openSummary(page)
    await expect(reopened.locator('[data-eote-supplies="0"]')).toHaveAttribute('data-supply-count', String(SUPPLY_COUNT - 1))
    await expect(reopened.locator('[data-eote-supplies="1"]')).toHaveAttribute('data-supply-count', '1')
    expect(run.errors).toEqual([])
  })

  test(`P4 ${viewport} 演武选择`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page)
    // 演武选择是引擎侧确定性选择（注入 random），不是选择面板；浏览器验证摘要面与翻面读点。
    await invoke(page, '演武选择')
    await expect.poll(() => run.latest()?.state.campaign?.eote?.disciplines?.selected?.length).toBe(2)
    const summary = await openSummary(page)
    await expect(summary.locator('[data-eote-discipline]')).toHaveCount(DISCIPLINE_COUNT)
    await expect(summary.locator('[data-eote-discipline="08011a"]')).toHaveAttribute('data-discipline-face', 'unbroken')
    await invoke(page, '演武翻面')
    await expect.poll(() => run.latest()?.state.campaign?.eote?.disciplines?.faces?.['08011a']).toBe('broken')
    await screenshot(page, `${viewport}-discipline`)
    expect(run.errors).toEqual([])
  })
}
