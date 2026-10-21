import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const output = fileURLToPath(new URL('../../../artifacts/p7/', import.meta.url))
mkdirSync(output, { recursive: true })

async function drainPresentation(page) {
  await expect.poll(async () => {
    const skip = page.getByRole('button', { name: '跳过演出' })
    if (await skip.count()) { await skip.first().click(); return false }
    return !(await page.locator('.ah-table').evaluate(el => el.classList.contains('ah-presenting')))
  }, { timeout: 15000 }).toBe(true)
}

async function start(page, legacy = false) {
  await page.route('**/api/start', route => {
    const body = route.request().postDataJSON()
    return route.continue({ postData: JSON.stringify({ ...body, settings: { ...body.settings,
      playerCount: 1, playerInvestigator: '01001', teammates: 0, seed: 'p7-stable', legacyAutoStart: legacy } }) })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const response = page.waitForResponse('**/api/start')
  await page.getByRole('button', { name: '开始新游戏' }).click()
  return (await (await response).json()).session
}

for (const width of [1440, 1920, 390]) {
  test(`P7 stable hub and map baseline ${width}`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1080 })
    await start(page)
    await expect(page.locator('.ah-hub')).toHaveAttribute('data-ui-state', 'campaignHub')
    await page.evaluate(async () => Promise.all([...document.images].map(img => img.decode().catch(() => {}))))
    await expect(page.locator('.ah-hub')).toHaveScreenshot(`hub-${width}.png`, { animations: 'disabled', maxDiffPixelRatio: 0.002 })
    await page.getByRole('button', { name: '退出', exact: true }).click()
    await page.unroute('**/api/start')
    let session = await start(page, true)
    for (let i = 0; session.state.pendingChoice; i++) {
      expect(i).toBeLessThan(10)
      const move = session.state.legalMoves.find(m => m.optionId === 'done') || session.state.legalMoves[0]
      const response = await request.post('/api/move', { data: { sessionId: session.sessionId, revision: session.state.revision, move } })
      expect(response.ok()).toBeTruthy(); session = (await response.json()).session
    }
    await page.getByRole('button', { name: '刷新局势' }).click()
    await drainPresentation(page)
    await page.locator('.ah-map-viewport').press('0')
    await page.locator('.ah-map-node .ah-table-art img').first().evaluate(img => img.decode())
    await page.mouse.move(0, 0)
    // Compare only deterministic map geometry/art. Session IDs, logs and clocks are excluded.
    await expect(page.locator('.ah-table-map')).toHaveScreenshot(`map-${width}.png`, { animations: 'disabled', maxDiffPixelRatio: 0.002 })
    if (width === 1920) {
      await page.evaluate(async () => Promise.all([...document.images].map(img => img.decode().catch(() => {}))))
      await page.screenshot({ path: output + 'arkham-p7-acceptance.png', animations: 'disabled' })
    }
  })
}

test('P7 resource, interaction, map redraw, hand animation and response budgets', async ({ page, request }) => {
  let session = await start(page, true)
  await expect(page.locator('.ah-table')).toBeVisible()
  const interactiveMs = await page.evaluate(() => performance.now())
  for (let i = 0; session.state.pendingChoice; i++) {
    expect(i).toBeLessThan(10)
    const move = session.state.legalMoves.find(m => m.optionId === 'done') || session.state.legalMoves[0]
    const response = await request.post('/api/move', { data: { sessionId: session.sessionId, revision: session.state.revision, move } })
    expect(response.ok()).toBeTruthy(); session = (await response.json()).session
  }
  await page.getByRole('button', { name: '刷新局势' }).click()
  await drainPresentation(page)
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(r => ({ name: r.name, bytes: r.transferSize })))
  const imageRequests = resources.filter(r => r.name.includes('/img/'))
  const mapRedrawMs = await page.locator('.ah-map-viewport').evaluate(async viewport => {
    const before = performance.now(); viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: 30, clientY: 250, bubbles: true, cancelable: true }))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return performance.now() - before
  })
  const card = page.locator('.ah-hand-card').first()
  await expect(card).toBeVisible()
  const frames = page.evaluate(() => new Promise(resolve => {
    const gaps = []; let previous = performance.now()
    function frame(now) { gaps.push(now - previous); previous = now; if (gaps.length < 30) requestAnimationFrame(frame); else resolve(gaps) }
    requestAnimationFrame(frame)
  }))
  await card.hover()
  const gaps = await frames
  const sorted = [...gaps].sort((a, b) => a - b)
  const move = session.state.legalMoves.find(m => m.action === 'resource') || session.state.legalMoves.find(m => m.action === 'endTurn')
  expect(move).toBeTruthy()
  const response = await request.post('/api/move', { data: { sessionId: session.sessionId, revision: session.state.revision, move } })
  expect(response.ok()).toBeTruthy()
  const stepResponseBytes = (await response.body()).length
  const metrics = { interactiveMs, firstScreenRequests: resources.length, firstScreenTransferBytes: resources.reduce((n,r) => n + r.bytes, 0),
    imageRequests: imageRequests.length, mapRedrawMs, handFrameP95Ms: sorted[Math.floor(sorted.length * .95)], stepResponseBytes,
    largestTransfers: resources.filter(r => r.bytes).sort((a, b) => b.bytes - a.bytes).slice(0, 10),
    method: 'Cold browser context; click-to-table readiness includes UI automation; map two RAFs; 30 RAF samples during hand hover. Local Edge smoke budgets, not a lab benchmark.',
    budgets: { interactiveMs: 10000, firstScreenTransferBytes: 15000000, imageRequests: 100, mapRedrawMs: 500, handFrameP95Ms: 100, stepResponseBytes: 500000 } }
  writeFileSync(output + 'performance.json', JSON.stringify(metrics, null, 2) + '\n')
  for (const [key, limit] of Object.entries(metrics.budgets)) expect(metrics[key], key).toBeLessThan(limit)
})

test('P7 visible save failure retries persistence without replaying the move', async ({ page }) => {
  await start(page)
  let moves = 0, retries = 0, revision
  await page.route('**/api/move', async route => {
    moves++
    const response = await route.fetch(); const payload = await response.json()
    revision = payload.session.state.revision
    payload.ok = false; payload.code = 'SAVE_FAILED'; payload.error = 'P7 simulated disk failure'
    payload.session.saveError = payload.error
    await route.fulfill({ status: 507, json: payload })
  })
  await page.route('**/api/session/save', async route => { retries++; await route.continue() })
  await page.getByRole('button', { name: '选择调查员', exact: true }).click()
  await expect(page.getByRole('button', { name: '重试保存' })).toBeVisible()
  const saved = page.waitForResponse('**/api/session/save')
  await page.getByRole('button', { name: '重试保存' }).click()
  expect((await (await saved).json()).session.state.revision).toBe(revision)
  await expect(page.getByRole('button', { name: '重试保存' })).toHaveCount(0)
  expect(moves).toBe(1); expect(retries).toBe(1)
})

test('P7 incompatible saves are visibly blocked; fresh games ignore existing saves', async ({ page }) => {
  const session = await start(page)
  await page.getByRole('button', { name: '退出', exact: true }).click()
  await page.reload()
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.route('**/api/sessions*', async route => {
    const response = await route.fetch(); const payload = await response.json()
    payload.sessions = payload.sessions.map(s => s.sessionId === session.sessionId ? { ...s, compatible: false, compatibilityError: 'P7 version mismatch' } : s)
    await route.fulfill({ response, json: payload })
  })
  await page.getByRole('button', { name: '存档管理' }).click()
  const save = page.locator(`.ah-save-item[data-session-id="${session.sessionId}"]`)
  await expect(save.getByRole('button', { name: '读取此存档' })).toBeDisabled()
  await expect(save).toContainText('P7 version mismatch')
  await page.getByRole('button', { name: '新游戏', exact: true }).click()
  const started = page.waitForResponse('**/api/start')
  await page.getByRole('button', { name: '开始新游戏' }).click()
  const fresh = (await (await started).json()).session
  expect(fresh.sessionId).not.toBe(session.sessionId)
  expect(fresh.state.revision).toBe(0)
  expect(fresh.state.uiState).toBe('campaignHub')
})

for (const name of ['五子棋', '井字棋']) {
  test(`P7 Arkham navigation preserves ${name} setup and table`, async ({ page }) => {
    await start(page)
    await page.getByRole('button', { name: '退出', exact: true }).click()
    await page.unroute('**/api/start')
    await page.locator('.bg-card').filter({ hasText: name }).click()
    await expect(page.locator('.ah-hub-setup')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '存档管理' })).toHaveCount(0)
    await page.getByRole('button', { name: '开始对局' }).click()
    await expect(page.locator('.bg-game-title')).toContainText(name)
    await expect(page.locator('.ah-hub, .ah-table')).toHaveCount(0)
    const box = await page.locator('.bg-game').boundingBox()
    expect(box.width).toBeGreaterThan(400)
    expect(box.height).toBeGreaterThan(200)
  })
}
