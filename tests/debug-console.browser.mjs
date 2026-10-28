// 调试控制台浏览器验收（契约 artifacts/debug-console/CONTRACT.md §7 + §10.3 v1.1）。
//
// 覆盖四条最小闭环：
//   1. 单机牌桌标题栏出现入口 → 打开面板 → 执行「获得 3 资源」→ 日志出现成功消息，且服务器状态资源 +3；
//   2. 390×844 视口下面板可见、不溢出视口，Esc 能关闭；
//   3. 失败指令（不存在的敌人）显示错误日志而不是崩溃/卡死；
//   4. 「帮助」按钮展示 v1.1 指令清单（含抽/传送到等关键字），且帮助是只读指令、不改 revision。
//
// 依赖大厅 POST /api/debug 与 Mod 的 debugCommand 钩子（同为调试控制台集成分片）。
import { test, expect } from '@playwright/test'

async function openTable(page) {
  await page.route('**/api/start', async route => {
    const body = route.request().postDataJSON()
    await route.continue({ postData: JSON.stringify({ ...body,
      settings: { ...body.settings, campaignId: 'nightOfTheZealot', playerCount: 1, playerInvestigator: '01001',
        teammates: 0, opponents: [], legacyAutoStart: true, seed: 'debug-console' } }) })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const started = page.waitForResponse('**/api/start')
  await page.getByRole('button', { name: '开始新游戏' }).click()
  const payload = await (await started).json()
  expect(payload.ok, 'start failed: ' + payload.error).toBe(true)
  await expect(page.locator('.ah-table')).toBeVisible()
  return payload.session
}

async function isPresenting(page) {
  return page.locator('.ah-table').evaluate(el => el.classList.contains('ah-presenting')).catch(() => false)
}

// 开局有一段故事演出；演出期间标题栏按钮会被遮住，先把「跳过演出」点完。
async function skipPresentations(page) {
  for (let guard = 0; guard < 80; guard++) {
    const skip = page.getByRole('button', { name: '跳过演出' })
    if (await skip.count()) {
      await skip.first().click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(120)
      continue
    }
    if (await isPresenting(page)) { await page.waitForTimeout(150); continue }
    return
  }
}

// 调试指令要求没有待决选择：把开局换牌等窗口按 done / skip / self 依次答完，直到牌桌可控。
async function settleOpening(page) {
  const panel = page.getByRole('region', { name: '待决选择' })
  for (let guard = 0; guard < 80; guard++) {
    await skipPresentations(page)
    if (!(await panel.count())) {
      // 跳过最后一段演出后可能紧接着弹下一个选择，多确认一轮再放行。
      await page.waitForTimeout(200)
      await skipPresentations(page)
      if (!(await panel.count())) return
    }
    const finish = panel.locator('[data-option-id="done"], [data-option-id="skip"], [data-option-id="self"]').first()
    const target = (await finish.count()) ? finish : panel.locator('.ah-choice-option').first()
    await target.click({ timeout: 10000 })
    await page.waitForTimeout(200)
  }
  throw new Error('opening did not settle into a playable table')
}

async function startAndOpenConsole(page) {
  const session = await openTable(page)
  await settleOpening(page)
  const launcher = page.locator('.bg-game-actions').getByRole('button', { name: '调试控制台' })
  await expect(launcher).toBeVisible({ timeout: 15000 })
  await launcher.click()
  const dialog = page.getByRole('dialog', { name: '调试控制台' })
  await expect(dialog).toBeVisible({ timeout: 15000 })
  return { session, launcher, dialog }
}

async function readSession(request, sessionId) {
  const response = await request.get('/api/session?sessionId=' + encodeURIComponent(sessionId))
  expect(response.ok()).toBe(true)
  const payload = await response.json()
  expect(payload.ok, 'session read failed: ' + payload.error).toBe(true)
  return payload.session
}

test('单机牌桌可用调试控制台：执行「获得 3 资源」写成功日志并更新对局资源', async ({ page, request }) => {
  const { session, dialog } = await startAndOpenConsole(page)
  await expect(dialog).toContainText('单机模式')
  const input = dialog.getByRole('textbox', { name: '调试指令' })
  await expect(input).toBeFocused({ timeout: 10000 })
  const before = await readSession(request, session.sessionId)
  await expect.poll(() => before.state.pendingChoice).toBeFalsy()

  await input.fill('获得 3 资源')
  await dialog.getByRole('button', { name: '执行' }).click()

  const success = dialog.locator('.ah-debug-log-entry[data-tone="success"]').last()
  await expect(success).toBeVisible({ timeout: 15000 })
  await expect(success.locator('.ah-debug-log-text')).toContainText(/\S/)

  // 服务端权威状态：目标座位（默认本机座位）资源 +3；页面自身不手工刷新也能拿到新 session。
  await expect.poll(async () => (await readSession(request, session.sessionId)).state.investigators[0].resources, { timeout: 15000 })
    .toBe(before.state.investigators[0].resources + 3)
  // 面板保持可用：提交期间禁用、提交结束恢复。
  await expect(dialog).toBeVisible()
  await expect(input).toBeEnabled()
  await expect(dialog.getByRole('button', { name: '执行' })).toBeEnabled()
})

test('390×844 视口：调试面板可见、不溢出视口，Esc 关闭', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const { dialog } = await startAndOpenConsole(page)
  const box = await dialog.boundingBox()
  expect(box, 'debug dialog has no bounding box').toBeTruthy()
  expect(box.x).toBeGreaterThanOrEqual(-1)
  expect(box.y).toBeGreaterThanOrEqual(-1)
  expect(box.x + box.width).toBeLessThanOrEqual(391)
  expect(box.y + box.height).toBeLessThanOrEqual(845)
  // 浮层自身 fixed，不把页面撑出横向/纵向滚动。
  const viewport = await page.evaluate(() => ({
    scrollWidth: document.scrollingElement.scrollWidth,
    scrollHeight: document.scrollingElement.scrollHeight,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.innerWidth)
  expect(viewport.scrollHeight).toBeLessThanOrEqual(viewport.innerHeight + 1)
  // 输入、执行按钮在窄屏仍可操作。
  const input = dialog.getByRole('textbox', { name: '调试指令' })
  await expect(input).toBeVisible()
  await expect(dialog.getByRole('button', { name: '执行' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: '关闭调试控制台' })).toBeVisible()
  await input.fill('获得 1 资源')
  await expect(input).toHaveValue('获得 1 资源')
  await input.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.ah-table')).toBeVisible()
})

test('失败指令在日志显示错误，控制台不崩溃且可继续使用', async ({ page }) => {
  const { dialog } = await startAndOpenConsole(page)
  const input = dialog.getByRole('textbox', { name: '调试指令' })
  await input.fill('生成 不存在的敌人xyz')
  await dialog.getByRole('button', { name: '执行' }).click()

  const error = dialog.locator('.ah-debug-log-entry[data-tone="error"]').last()
  await expect(error).toBeVisible({ timeout: 15000 })
  await expect(error.locator('.ah-debug-log-text')).toContainText(/\S/)
  await expect(dialog).toBeVisible()
  await expect(page.locator('.ah-table')).toBeVisible()
  // 失败后提交状态复位，可以继续输入下一条指令。
  await expect(input).toBeEnabled()
  await expect(dialog.getByRole('button', { name: '执行' })).toBeEnabled()
  await input.fill('获得 1 资源')
  await expect(input).toHaveValue('获得 1 资源')
})

test('「帮助」按钮展示指令清单且不改变对局 revision', async ({ page, request }) => {
  const { session, dialog } = await startAndOpenConsole(page)
  const before = await readSession(request, session.sessionId)
  const helpButton = dialog.getByRole('button', { name: '帮助' })
  await expect(helpButton).toBeVisible()
  await helpButton.click()

  // 服务端 HELP_TEXT（v1.1 全指令）进入帮助块；打开面板的静默自动请求可能先到，点击后仍会补日志。
  const serverHelp = dialog.locator('.ah-debug-help-server')
  await expect(serverHelp).toBeVisible({ timeout: 15000 })
  await expect(serverHelp).toContainText('抽')
  await expect(serverHelp).toContainText('传送到')
  const successLog = dialog.locator('.ah-debug-log-entry[data-tone="success"]').last()
  await expect(successLog.locator('.ah-debug-log-text')).toContainText('抽', { timeout: 15000 })

  // 帮助是只读指令（move:null）：不提交、不推进 revision。
  await expect.poll(async () => (await readSession(request, session.sessionId)).state.revision, { timeout: 10000 })
    .toBe(before.state.revision)
  await expect(dialog).toBeVisible()
  await expect(page.locator('.ah-table')).toBeVisible()
})
