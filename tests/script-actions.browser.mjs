import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const output = fileURLToPath(new URL('../../../artifacts/arkham-polish/', import.meta.url))

test('场景/密谋可执行操作排在剧本书与提示卡之后，并提交服务端公开的动作', async ({ page }) => {
  let session, submitted = null
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId: 'arkhamhorror', settings: {
      legacyAutoStart: true, playerCount: 1, playerInvestigator: '01001', seed: 'script-actions',
    } }) })
    const payload = await response.json(); session = payload.session
    Object.assign(session.state, { pendingChoice: null, currentSeat: 0, phase: 'investigation', legalMoves: [
      { action: 'drawCultist', scriptCard: 'act', label: '🕵️ 抽取异教徒牌堆（花 2 线索）' },
      { action: 'resign', scriptCard: 'agenda', label: '🏳️ 撤退' },
      { action: 'advanceAct', scriptCard: 'act', label: '共同支付线索推进场景' },
      { action: 'endTurn', label: '⏭️ 结束回合' },
    ], scriptActions: [
      { action: 'scenarioAction', rule: 'searchJazz', scriptCard: 'act', label: '花费 1 线索，搜索遭遇牌库中的爵士', reason: '需要花费 1 个线索' },
    ] })
    await route.fulfill({ response, json: payload })
  })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  await page.route('**/api/move', async route => {
    submitted = route.request().postDataJSON().move
    await route.fulfill({ json: { ok: true, session } })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-story-book')).toBeVisible()
  const skip = page.getByRole('button', { name: '跳过演出' })
  if (await skip.count()) await skip.click()
  const panel = page.getByRole('group', { name: '剧本可执行操作' })
  await expect(panel.locator('.ah-script-action')).toHaveCount(3)
  const jazz = panel.locator('.ah-script-action').nth(0)
  await expect(jazz).toHaveAttribute('aria-label', '场景：花费 1 线索，搜索遭遇牌库中的爵士')
  await expect(jazz).toBeDisabled(); await expect(jazz).toContainText('需要花费 1 个线索')
  await expect(panel.locator('.ah-script-action').nth(1)).toHaveAttribute('aria-label', '场景：抽取异教徒牌堆（花 2 线索）')
  await expect(panel.locator('.ah-script-action').nth(1)).toBeEnabled()
  await expect(panel.locator('.ah-script-action').nth(2)).toHaveAttribute('aria-label', '密谋：撤退')
  await expect(page.locator('.ah-script-card[data-interaction="agenda:current"]')).toHaveClass(/ah-card-ready/)
  await expect(page.getByRole('button', { name: '更多行动' })).toHaveCount(0)
  mkdirSync(output, { recursive: true })
  for (const size of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 1100, height: 800 }, { width: 960, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size)
    await page.screenshot({ path: output + `script-actions-${size.width}.png`, animations: 'disabled' })
    const [book, reference, actions] = await Promise.all(['.ah-story-book', '.ah-reference-card', '.ah-script-actions'].map(s => page.locator(s).boundingBox()))
    expect(book.x + book.width).toBeLessThanOrEqual(reference.x + 1)
    expect(reference.x + reference.width).toBeLessThanOrEqual(actions.x + 1)
    await expect(panel.locator('.ah-script-action').first()).toBeInViewport({ ratio: 1 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const deck = await page.locator('.ah-command-deck').boundingBox()
    if (deck.y < actions.y + actions.height - 1) expect(deck.x).toBeGreaterThanOrEqual(actions.x + actions.width - 1)
  }
  await page.setViewportSize({ width: 1400, height: 950 })
  await panel.getByRole('button', { name: '场景：抽取异教徒牌堆（花 2 线索）' }).click()
  await expect.poll(() => submitted?.action).toBe('drawCultist')
  expect(errors).toEqual([])
})

test('附属到当前密谋/场景的卡显示在剧本书上，点击查看卡面并可跳转规则', async ({ page }) => {
  let session
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId: 'arkhamhorror', settings: {
      legacyAutoStart: true, playerCount: 1, playerInvestigator: '01001', seed: 'script-attachments',
    } }) })
    const payload = await response.json(); session = payload.session
    Object.assign(session.state, { pendingChoice: null, currentSeat: 0, phase: 'investigation',
      scriptAttachments: { act: [], agenda: ['02085'] } })
    await route.fulfill({ response, json: payload })
  })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-story-book')).toBeVisible()
  const skip = page.getByRole('button', { name: '跳过演出' })
  if (await skip.count()) await skip.click()
  const agenda = page.locator('.ah-script-card[data-interaction="agenda:current"]')
  await expect(agenda).toHaveClass(/has-attachments/)
  const attached = page.getByRole('group', { name: '当前密谋的附属卡' }).locator('.ah-script-attachment')
  await expect(attached).toHaveCount(1)
  await expect(attached).toHaveAttribute('data-attachment-code', '02085')
  await expect(agenda.locator('[data-card-marker="attached"]')).toHaveAttribute('aria-label','附属卡 1')
  await expect(page.locator('.ah-script-card[data-interaction="act:current"] .ah-script-attachment')).toHaveCount(0)
  await agenda.click()
  let detail = page.getByRole('dialog', { name: '卡牌详情' })
  await expect(detail.locator('.ah-detail-attachment-card')).toHaveAttribute('data-attachment-code','02085')
  await page.getByRole('button',{name:'关闭卡牌详情'}).click()
  await attached.click()
  detail = page.getByRole('dialog', { name: '卡牌详情' })
  await expect(detail).toContainText('亚弗戈蒙之光')
  await expect(detail.locator('.ah-runtime-host')).toContainText('当前密谋')
  await detail.locator('.ah-card-rule-links [data-rule-id="script"]').click()
  await expect(page.getByRole('dialog', { name: '游戏规则书' }).locator('[data-rule-topic]')).toHaveAttribute('data-rule-topic', 'script')
})

test('卡尔克萨（谢幕）桌面显示剧本提示卡，困难/专家面翻到背面', async ({ page }) => {
  // 回归：UI_CARDS.scenarioCards 漏登记卡尔克萨时，桌面「剧本提示」参考卡整块消失。
  let session
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId: 'arkhamhorror', settings: {
      legacyAutoStart: true, campaignId: 'thePathToCarcosa', playerCount: 1, playerInvestigator: '01001', seed: 'carcosa-refcard',
    } }) })
    const payload = await response.json(); session = payload.session
    await route.fulfill({ response, json: payload })
  })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-story-book')).toBeVisible()
  const skip = page.getByRole('button', { name: '跳过演出' })
  if (await skip.count()) await skip.click()

  const reference = page.locator('.ah-reference-card')
  await expect(reference).toBeVisible()
  await expect(reference).toHaveAttribute('data-reference-code', '03043')
  await expect(reference).toHaveAttribute('data-reference-face', 'front')
  await expect(reference).toContainText('剧本提示')
  // 剧本区顺序：剧本书 → 提示卡。
  const [book, box] = await Promise.all(['.ah-story-book', '.ah-reference-card'].map(selector => page.locator(selector).boundingBox()))
  expect(book.x + book.width).toBeLessThanOrEqual(box.x + 1)

  // 点开提示卡可查看卡面（混乱标记修正等），关闭后继续。
  await reference.click()
  const detail = page.getByRole('dialog', { name: '卡牌详情' })
  await expect(detail).toBeVisible()
  await expect(detail).toContainText('03043')
  await expect(detail).toContainText('谢幕')
  await page.getByRole('button', { name: '关闭卡牌详情' }).click()
  await expect(detail).toHaveCount(0)

  // 困难难度用同一张提示卡的背面（困难/专家面）。
  session.state.difficulty = 'hard'
  await page.getByRole('button', { name: '刷新局势' }).click()
  await expect(reference).toHaveAttribute('data-reference-face', 'back')

  mkdirSync(output, { recursive: true })
  await page.setViewportSize({ width: 1400, height: 950 })
  await page.screenshot({ path: output + 'carcosa-reference-card.png', animations: 'disabled' })
})

test('同一条密谋能力按牌堆分别提交', async ({ page }) => {
  let session, submitted = null
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId: 'arkhamhorror', settings: {
      legacyAutoStart: true, playerCount: 1, playerInvestigator: '01001', seed: 'script-agenda-deck',
    } }) })
    const payload = await response.json(); session = payload.session
    const deckMove = deckId => ({
      action: 'scenarioAction', rule: 'hastenAgenda', deckId, scriptCard: 'agenda', actions: 0,
      label: `在“${deckId}”密谋上放置1毁灭`,
    })
    Object.assign(session.state, { pendingChoice: null, currentSeat: 0, phase: 'investigation',
      legalMoves: [deckMove('a'), deckMove('c')],
      scriptActions: [deckMove('a'), deckMove('c')] })
    await route.fulfill({ response, json: payload })
  })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  await page.route('**/api/move', async route => {
    submitted = route.request().postDataJSON().move
    await route.fulfill({ json: { ok: true, session } })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-story-book')).toBeVisible()
  const skip = page.getByRole('button', { name: '跳过演出' })
  if (await skip.count()) await skip.click()
  const panel = page.getByRole('group', { name: '剧本可执行操作' })
  await expect(panel.locator('.ah-script-action')).toHaveCount(2)
  await panel.locator('.ah-script-action[data-agenda-deck="c"]').click()
  await expect.poll(() => submitted?.deckId).toBe('c')
  await expect.poll(() => submitted?.rule).toBe('hastenAgenda')
})
