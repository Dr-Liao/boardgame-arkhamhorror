// 九循环《铁杉谷盛宴》（FHV）P4 新增交互浏览器验收 spec。
//
// 证据形态与 TIC/EotE/TSK P4 相同：**真实大厅 HTTP + 真实引擎**，state 由
// tests/fhv-interaction-fixture.mjs 的测试夹具在服务端 createState 时注入（不新增夹具端点、
// 不注册生产内容）。
//
// 覆盖 2 个视口（桌面 1440×900 / 移动 390×844）× 7 组交互：
//   法典触读与条件段落 / 三天三夜·居民演进面板 / 序曲整备与下一次勘察 / 网格空位与滑动 /
//   矿车与道岔 / 敌人-地点双重交互与猎杀袋 / 坚毅形态与线索搬移。
// 每组都断言：pageerror 为空、服务端合法动作驱动（点击即提交 choose move）、
// 合法 + 取消 + 空状态、无横向滚动、截图与焦点恢复。
// 选择面板统一使用 `.ah-mechanic-choice[data-mechanic-choice="<op>"]` 约定；
// 摘要使用 `[data-fhv-*]` 数据属性。
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('../../../artifacts/migration/fhv/p4/screenshots/', import.meta.url))
mkdirSync(output, { recursive: true })

// 与 tests/fhv-interaction-fixture.mjs 的常量保持一致（spec 是独立进程，不 import 引擎夹具）。
const HOST = 'fhv-fixture-host'
const HARNESS = `[data-interaction="asset:${HOST}"]`
const HERE = 'study'

async function start(page) {
  const errors = []
  await page.addLocatorHandler(page.getByRole('button', { name: '跳过演出' }), async locator => { await locator.click() })
  page.on('pageerror', error => errors.push(error.message))
  page.route('**/api/start', async route => {
    const original = route.request().postDataJSON()
    const response = await route.fetch({ postData: JSON.stringify({ ...original,
      settings: { ...original.settings, legacyAutoStart: true, fhvInteractionFixture: true } }) })
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

async function confirm(page) {
  const id = await choice(page).getAttribute('data-choice-id')
  await choice(page).locator('[data-option-id="confirm"]').click()
  await expect(page.locator(`.ah-mechanic-choice[data-choice-id="${id}"]`)).toHaveCount(0)
  await expect(page.locator('.ah-mechanic-choice[aria-busy="true"]')).toHaveCount(0)
}

async function cancel(page) {
  const id = await choice(page).getAttribute('data-choice-id')
  await choice(page).locator('[data-option-id="cancel"]').click()
  await expect(page.locator(`.ah-mechanic-choice[data-choice-id="${id}"]`)).toHaveCount(0)
}

async function pickAndConfirm(page, index = 0) {
  await pick(page, index)
  await confirm(page)
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
}

async function expectNoChoice(page) {
  // 空候选 = 服务端直接返回 false / 不产生 pending choice；等待一小段时间确认没有面板出现。
  await page.waitForTimeout(350)
  await expect(choice(page)).toHaveCount(0)
}

// 取消后焦点必须回到来源（动作条或摘要）而不是掉到 body。
async function expectFocusNotLost(page) {
  expect(await page.evaluate(() => document.activeElement !== document.body
    && document.activeElement != null)).toBe(true)
}

for (const [viewport, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  test(`P4 ${viewport} 法典触读与条件段落`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page)
    const summary = await openSummary(page)
    const codex = summary.locator('[data-fhv-codex-entry="motherRachel"]')
    await expect(codex).toHaveAttribute('data-available', 'true')
    await expect(codex).toHaveAttribute('data-used', 'false')
    // 隐私：未触发的法典分支条件/正文不进入摘要（只有条目名与状态）。
    expect(await summary.innerText()).not.toContain('mr-mid')
    // 取消：可读条目不变、不写入。
    await invoke(page, '法典触读')
    await expect(mechanicChoice(page, 'fhvCodex')).toHaveCount(1)
    await cancel(page)
    await expect(codex).toHaveAttribute('data-used', 'false')
    await expectFocusNotLost(page)
    // 合法：选择并确认后条目置为已读、不可再次触发（同一条目限一次）。
    await invoke(page, '法典触读')
    const labels = await mechanicChoice(page, 'fhvCodex').innerText()
    expect(labels).not.toContain('mr-mid')
    await pickAndConfirm(page)
    await expect(codex).toHaveAttribute('data-used', 'true')
    await expect(codex).toHaveAttribute('data-available', 'false')
    // 逆序再点一次：仍有另一条可读条目；取消后选择面板消失（键盘可达）。
    await invoke(page, '法典触读')
    await expect(mechanicChoice(page, 'fhvCodex')).toHaveCount(1)
    await cancel(page)
    await expectNoChoice(page)
    await screenshot(page, `${viewport}-codex`)
    expect(run.errors).toEqual([])
  })

  test(`P4 ${viewport} 三天三夜与居民演进面板`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page)
    const summary = await openSummary(page)
    // 时间标记：当前第 2 日白天；所在 [[Dark]] 地点按本地规则判为夜晚。
    const date = summary.locator('[data-fhv-day]')
    await expect(date).toHaveAttribute('data-fhv-day', '2')
    await expect(date).toHaveAttribute('data-fhv-period', 'day')
    await expect(date).toHaveAttribute('data-fhv-local-period', 'night')
    // 居民关系等级与笔记：等级 2/4、1 条笔记；划除居民的笔记不再投影。
    const resident = summary.locator('[data-fhv-resident="motherRachel"]')
    await expect(resident).toHaveAttribute('data-level', '2')
    await expect(resident).toHaveAttribute('data-notes-count', '1')
    await expect(resident).toHaveAttribute('data-crossed-out', 'false')
    const crossed = summary.locator('[data-fhv-resident="riverHawthorne"]')
    await expect(crossed).toHaveAttribute('data-crossed-out', 'true')
    await expect(crossed).toHaveAttribute('data-notes-count', '0')
    // 法典演进：两条条目都在面板里，未读前均标可读。
    await expect(summary.locator('[data-fhv-codex-entry]')).toHaveCount(2)
    await screenshot(page, `${viewport}-evolution`)
    expect(run.errors).toEqual([])
  })

  test(`P4 ${viewport} 序曲整备与下一次勘察`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page)
    const summary = await openSummary(page)
    await expect(summary.locator('[data-fhv-survey]')).toHaveCount(0)
    // 取消：整备不落账。
    await invoke(page, '序曲整备')
    await expect(mechanicChoice(page, 'fhvSurvey')).toHaveCount(1)
    await cancel(page)
    await expect(summary.locator('[data-fhv-survey]')).toHaveCount(0)
    await expectFocusNotLost(page)
    // 合法：先选保留支援（1 张非起始支援），再弃手牌到开手上限。
    await invoke(page, '序曲整备')
    await expect(mechanicChoice(page, 'fhvSurvey')).toHaveCount(1)
    await pickAndConfirm(page)
    await expect(mechanicChoice(page, 'fhvSurvey')).toHaveCount(1)
    await pickAndConfirm(page)
    const parcel = (await openSummary(page)).locator('[data-fhv-survey]')
    await expect(parcel).toBeVisible()
    const seat = summary.locator('[data-fhv-survey-seat="0"]')
    await expect(seat).toHaveAttribute('data-hand-count', '5')
    await expect(seat).toHaveAttribute('data-resources', '5')
    // 选择下一场勘察关卡：合法选择写入，再次触发不再产生面板（空状态）。
    await invoke(page, '选择下一次勘察')
    await expect(mechanicChoice(page, 'fhvSurvey')).toHaveCount(1)
    await pickAndConfirm(page)
    await expect(summary.locator('[data-fhv-survey-chosen]')).not.toHaveAttribute('data-fhv-survey-chosen', '')
    await invoke(page, '选择下一次勘察')
    await expectNoChoice(page)
    await screenshot(page, `${viewport}-survey`)
    expect(run.errors).toEqual([])
  })

  test(`P4 ${viewport} 网格空位放置与地点滑动`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page)
    const summary = await openSummary(page)
    const gridCount = summary.locator('[data-fhv-grid-count]')
    await expect(gridCount).toHaveAttribute('data-fhv-grid-count', '4')
    const empty = summary.locator('[data-fhv-empty-cells]')
    await expect(empty).toHaveAttribute('data-fhv-empty-cells', '0,1')
    // 取消：不写入新地点。
    await invoke(page, '网格放置')
    await expect(mechanicChoice(page, 'fhvGrid')).toHaveCount(1)
    await cancel(page)
    await expect(gridCount).toHaveAttribute('data-fhv-grid-count', '4')
    await expectFocusNotLost(page)
    // 合法：放入唯一正交空位 (0,1)。
    await invoke(page, '网格放置')
    await expect(mechanicChoice(page, 'fhvGrid')).toHaveCount(1)
    await pickAndConfirm(page)
    await expect(gridCount).toHaveAttribute('data-fhv-grid-count', '5')
    await expect(summary.locator('[data-fhv-grid-cell="newSite"]')).toHaveAttribute('data-x', '0')
    await expect(summary.locator('[data-fhv-grid-cell="newSite"]')).toHaveAttribute('data-y', '1')
    // 空状态：四个相邻格已满，再放置不产生选择面板。
    await invoke(page, '网格无空位放置')
    await expectNoChoice(page)
    // 滑动/交换方案：原子提交后交换坐标。
    await invoke(page, '地点滑动')
    await expect(mechanicChoice(page, 'fhvGrid')).toHaveCount(1)
    await pickAndConfirm(page)
    await expect(summary.locator('[data-fhv-grid-cell="l2"]')).toHaveAttribute('data-x', '-1')
    await screenshot(page, `${viewport}-grid`)
    expect(run.errors).toEqual([])
  })

  test(`P4 ${viewport} 矿车前进与道岔转向`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page)
    const summary = await openSummary(page)
    const rail = summary.locator('[data-fhv-rail]')
    await expect(rail).toHaveAttribute('data-fhv-rail-location', 'study')
    await expect(rail).toHaveAttribute('data-fhv-rail-facing', 'north')
    // 取消：前进方向选择取消后矿车不动。
    await invoke(page, '矿车前进')
    await expect(mechanicChoice(page, 'fhvRail')).toHaveCount(1)
    await cancel(page)
    await expect(rail).toHaveAttribute('data-fhv-rail-location', 'study')
    await expectFocusNotLost(page)
    // 合法：选择出口方向（东）后整组随车前进到北角矿井。
    await invoke(page, '矿车前进')
    await expect(mechanicChoice(page, 'fhvRail')).toHaveCount(1)
    await pickAndConfirm(page)
    await expect(rail).toHaveAttribute('data-fhv-rail-location', 'l1')
    // 道岔转向：在矿井朝东时转南（垂直轨道出口）。
    await invoke(page, '道岔转向')
    await expect(mechanicChoice(page, 'fhvRail')).toHaveCount(1)
    await pickAndConfirm(page)
    await expect(rail).toHaveAttribute('data-fhv-rail-facing', 'south')
    await screenshot(page, `${viewport}-rail`)
    expect(run.errors).toEqual([])
  })

  test(`P4 ${viewport} 敌人-地点双重交互与猎杀袋`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page)
    const summary = await openSummary(page)
    // 双类型实体：同时投影地点与敌人两套读数。
    const entity = summary.locator(`[data-fhv-enemy-location="${HERE}"]`)
    await expect(entity).toHaveAttribute('data-shroud', '3')
    await expect(entity).toHaveAttribute('data-fight', '2')
    await expect(entity).toHaveAttribute('data-evade', '1')
    await expect(entity).toHaveAttribute('data-health', '4')
    // 猎杀袋：只投影剩余张数，袋内标记面不进入页面。
    const bag = summary.locator('[data-fhv-token-bag="predation"]')
    await expect(bag).toHaveAttribute('data-count', '2')
    expect(await page.locator('body').innerText()).not.toContain('elder_thing')
    // 真实 legalMoves：敌人-地点在同一实体上同时给出地点面（调查/移动）与敌人面（攻击/躲避）动作。
    // 收起摘要层后打开地点详情（双类型实体走同一详情），避免浮层拦截指针事件。
    await summary.evaluate(element => { if (element instanceof HTMLDetailsElement) element.open = false })
    await page.locator(`.ah-map-node[data-location-id="${HERE}"] [data-map-info="clues"]`).dispatchEvent('click')
    const locationDetail = page.locator('.ah-location-detail')
    await expect(locationDetail).toBeVisible()
    // 敌人面读数与地点面读数并列投影（服务端观察投影，不经客户端规则计算）。
    await expect(locationDetail.locator('[data-location-stat="fight"]')).toHaveCount(1)
    await expect(locationDetail.locator('[data-location-stat="evade"]')).toHaveCount(1)
    await expect(locationDetail.locator('[data-location-stat="fight"]')).toContainText('2')
    const locationActions = locationDetail.locator('.ah-location-detail-actions .ah-action')
    await expect(locationActions.filter({ hasText: /调查/ })).toHaveCount(1)
    // 移动面：相邻地点节点是服务端 legalMoves 给出的可移动目标（data-adjacent/data-move-target）。
    await locationDetail.locator('.ah-carddetail-close').click()
    await expect(locationDetail).toHaveCount(0)
    await expect(page.locator('.ah-map-node[data-location-id="l1"][data-adjacent="true"]')).toHaveCount(1)
    await page.locator(`.ah-map-node[data-location-id="${HERE}"] [data-map-info="clues"]`).dispatchEvent('click')
    await expect(locationDetail).toBeVisible()
    await expect(locationDetail.locator('.ah-location-detail-actions [data-enemy-face-action="true"]')).toHaveCount(2)
    await expect(locationDetail.locator('.ah-location-detail-actions [data-enemy-face-action="true"]').filter({ hasText: /攻击/ })).toHaveCount(1)
    await expect(locationDetail.locator('.ah-location-detail-actions [data-enemy-face-action="true"]').filter({ hasText: /躲避/ })).toHaveCount(1)
    await locationDetail.locator('.ah-carddetail-close').click()
    await expect(locationDetail).toHaveCount(0)
    // 抽取：不创建技能检定，剩余张数下降、袋内标记仍不公开。
    await invoke(page, '猎杀袋抽取')
    await expect(bag).toHaveAttribute('data-count', '1')
    expect(await page.locator('body').innerText()).not.toContain('elder_thing')
    // 转移：抽取后选择去向（混乱袋）并确认，袋清空后再次抽取不产生面板。
    await invoke(page, '猎杀袋转移')
    await expect(mechanicChoice(page, 'fhvPredation')).toHaveCount(1)
    await pickAndConfirm(page)
    await expect(bag).toHaveAttribute('data-count', '0')
    await invoke(page, '猎杀袋抽取')
    await expectNoChoice(page)
    await screenshot(page, `${viewport}-enemy-location`)
    expect(run.errors).toEqual([])
  })

  test(`P4 ${viewport} 坚毅形态与线索搬移`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page)
    const summary = await openSummary(page)
    const clueTarget = summary.locator('[data-fhv-clue-asset="fhv-science"]')
    await expect(clueTarget).toHaveAttribute('data-fhv-asset-clues', '0')
    await expect(summary.locator('[data-fhv-form]')).toHaveCount(0)
    // 取消：形态不切换、伤恐不清理。
    await invoke(page, '坚毅形态')
    await expect(mechanicChoice(page, 'fhvForm')).toHaveCount(1)
    await cancel(page)
    await expect(summary.locator('[data-fhv-form]')).toHaveCount(0)
    await expectFocusNotLost(page)
    // 合法：选择绑定坚毅面（10016a）后原位切换，摘要记录当前形态。
    await invoke(page, '坚毅形态')
    await expect(mechanicChoice(page, 'fhvForm')).toHaveCount(1)
    const formOptions = mechanicChoice(page, 'fhvForm').locator('[data-option-id^="pick:"]')
    await expect(formOptions).toHaveCount(2)
    expect((await formOptions.first().innerText()).trim().length).toBeGreaterThan(0)
    await pickAndConfirm(page)
    await expect(summary.locator('[data-fhv-form="0"]')).toHaveAttribute('data-fhv-form-code', '10016a')
    // 线索搬移：选择符合 Science/Tool 且无线索的支援，线索从调查员移到支援。
    await invoke(page, '线索搬移')
    await expect(mechanicChoice(page, 'fhvClue')).toHaveCount(1)
    const clueLabels = await mechanicChoice(page, 'fhvClue').innerText()
    expect(clueLabels).toContain('实验装置')
    await pickAndConfirm(page)
    await expect(clueTarget).toHaveAttribute('data-fhv-asset-clues', '1')
    await screenshot(page, `${viewport}-investigator-state`)
    expect(run.errors).toEqual([])
  })
}
