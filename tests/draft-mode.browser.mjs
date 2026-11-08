import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('../artifacts/draft-mode/', import.meta.url))
mkdirSync(output, { recursive: true })
test.use({ actionTimeout: 15_000 })

for (const width of [1440, 390]) test(`三选一高级设置、初始选牌与关后升级 ${width}`, async ({ page, request }) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width, height: 1000 })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.locator('.ah-hub-setup')
  await setup.getByText(/玩家人数|席位数量/).locator('..').locator('select').selectOption('1')
  await setup.locator('.ah-ai-dialogue-settings').filter({ hasText: '游戏高级设置' }).getByRole('button').click()
  const settings = page.getByRole('dialog', { name: '游戏高级设置' })
  await expect(settings.getByRole('option', { name: '普通模式', exact: true })).toHaveAttribute('value', 'standard')
  await expect(settings.getByRole('option', { name: '选牌模式', exact: true })).toHaveAttribute('value', 'draft')
  await settings.getByRole('combobox', { name: '游戏模式' }).selectOption('standard')
  await expect(settings.locator('.ah-game-mode-description')).toHaveText('自由构筑初始牌组，并按常规规则使用经验升级。')
  await settings.getByRole('combobox', { name: '游戏模式' }).selectOption('draft')
  await expect(settings.locator('.ah-game-mode-description')).toContainText('通过卡牌三选一')
  expect(await settings.getByRole('combobox', { name: '游戏模式' }).evaluate(el => getComputedStyle(el).minHeight)).toBe('44px')
  expect(await settings.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  const settingsBounds = await settings.boundingBox()
  expect(settingsBounds.x).toBeGreaterThanOrEqual(0)
  expect(settingsBounds.x + settingsBounds.width).toBeLessThanOrEqual(width)
  await page.screenshot({ path: output + `mode-settings-${width}.png`, animations: 'disabled' })
  await settings.getByRole('button', { name: '关闭游戏高级设置', exact: true }).click()
  const started = page.waitForResponse('**/api/start')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  let session = (await (await started).json()).session
  expect(session.state.deckMode).toBe('draft')
  const hub = page.locator('.ah-hub')
  await hub.getByRole('button', { name: '选择调查员', exact: true }).click()
  await hub.getByRole('button', { name: /选择调查员：罗兰/ }).click()
  await hub.getByRole('button', { name: '卡组构筑', exact: true }).click()
  const pane = hub.locator('.ah-draft-pane')
  await expect(pane.locator('.ah-draft-option')).toHaveCount(3)
  await pane.getByRole('button', { name: /刷新（剩余 3 次免费）/ }).click()
  await expect(pane).toContainText('剩余免费刷新 2 次')
  await page.screenshot({ path: output + `initial-${width}.png`, animations: 'disabled' })
  expect(await pane.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)

  const gallery = pane.locator('.ah-draft-deck')
  for (let picked = 0; picked < 5; picked++) {
    const before = Number(await gallery.getAttribute('data-deck-count'))
    await pane.locator('.ah-draft-option .bg-btn').first().click()
    await expect(gallery).toHaveAttribute('data-deck-count', String(before + 1))
  }
  await expect(pane.locator('[data-card-type="asset"]')).toContainText('支援')
  await expect(pane.locator('[data-card-type="skill"]')).toContainText('技能')
  await expect(pane.locator('[data-card-type="event"]')).toContainText('事件')
  await expect(pane.locator('[data-card-type="weakness"]')).toContainText('弱点')
  const total = Number(await gallery.getAttribute('data-deck-count'))
  expect(await pane.locator('[data-type-count]').evaluateAll(items => items.reduce((sum, el) => sum + Number(el.dataset.typeCount), 0))).toBe(total)
  await expect(gallery.locator('.ah-draft-deck-card .ah-table-art').first()).toBeVisible()
  await gallery.locator('.ah-draft-deck-card').first().click()
  await expect(page.getByRole('dialog', { name: '卡牌详情' })).toBeVisible()
  await page.getByRole('button', { name: '关闭卡牌详情' }).click()
  await pane.locator('.ah-draft-distributions').scrollIntoViewIfNeeded()
  await page.screenshot({ path: output + `deck-gallery-${width}.png`, animations: 'disabled' })
  expect(await pane.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)

  async function latest() {
    const body = await (await request.get('/api/session?sessionId=' + session.sessionId)).json()
    expect(body.ok, body.error).toBe(true)
    session = body.session
  }
  async function move(move) {
    await latest()
    const body = await (await request.post('/api/move', { data: { sessionId: session.sessionId, revision: session.state.revision, seat: 0, move } })).json()
    expect(body.ok, body.error).toBe(true)
    session = body.session
  }
  await latest()
  for (let guard = 0; guard < 80 && session.state.legalMoves.some(m => m.action === 'hubDraftPick'); guard++) {
    await move(session.state.legalMoves.find(m => m.action === 'hubDraftPick'))
  }
  await move({ action: 'hubDoneSeat' })
  await move({ action: 'hubBeginScenario' })
  for (let guard = 0; guard < 12 && session.state.pendingChoice; guard++) {
    const choice = session.state.pendingChoice
    await move({ action: 'choose', choiceId: choice.id, optionId: choice.options.find(o => o.id === 'done')?.id || choice.options[0].id })
  }
  await latest()
  const debug = await (await request.post('/api/debug', { data: { sessionId: session.sessionId, revision: session.state.revision, seat: 0, command: { text: '结束这关 R1' } } })).json()
  expect(debug.ok, debug.error).toBe(true)
  session = debug.session
  for (let guard = 0; guard < 12 && session.state.pendingChoice; guard++) {
    const choice = session.state.pendingChoice
    await move({ action: 'choose', choiceId: choice.id, optionId: choice.options.find(o => o.id === 'skip')?.id || choice.options[0].id })
  }
  await move({ action: 'hubContinue' })
  expect(session.state.campaign.investigators[0].draftMode.phase).toBe('upgrade')
  await hub.getByRole('button', { name: '刷新', exact: true }).click()
  // API-driven advancement queues the normal introduction/result presentations
  // on the client. Finish them before interacting with the updated hub.
  await expect.poll(async () => {
    const skip = page.getByRole('button', { name: '跳过演出', exact: true })
    if (await skip.count()) await skip.first().click()
    return hub.locator('.bg-game-status').textContent().catch(() => null)
  }, { timeout: 30_000 }).toBe('关间休整')
  await hub.getByRole('button', { name: '升级', exact: true }).click()
  await expect(pane).toHaveAttribute('data-draft-phase', 'upgrade')
  await expect(pane.locator('.ah-draft-option')).toHaveCount(3)
  await pane.getByRole('button', { name: '锁定整组（放弃下关免费刷新）', exact: true }).click()
  await expect(pane).toContainText('整组已锁定')
  await page.screenshot({ path: output + `upgrade-${width}.png`, animations: 'disabled' })
  expect(await pane.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  expect(errors).toEqual([])
})
