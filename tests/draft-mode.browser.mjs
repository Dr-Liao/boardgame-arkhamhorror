import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('../artifacts/draft-mode/', import.meta.url))
mkdirSync(output, { recursive: true })
test.use({ actionTimeout: 15_000 })

for (const width of [1440, 390]) test(`战役选择、初始选牌与关后升级 ${width}`, async ({ page, request }) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width, height: width === 390 ? 844 : 950 })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.locator('.ah-hub-setup')
  await setup.getByText(/玩家人数|席位数量/).locator('..').locator('select').selectOption('1')
  const launcher = setup.getByRole('button', { name: '选择战役', exact: true })
  const picker = page.getByRole('dialog', { name: '选择战役', exact: true })
  const standard = picker.getByRole('radio', { name: '普通模式', exact: true })
  const draft = picker.getByRole('radio', { name: '三选一模式', exact: true })
  const rollback = picker.getByRole('checkbox', { name: '允许回档', exact: true })
  const season = picker.getByRole('tab', { name: '第一季' })
  await launcher.click()
  await expect(season).toBeFocused()
  await expect(standard).toBeChecked()
  await expect(picker.locator('#ah-campaign-picker-mode-note')).toContainText('自由构筑')
  await expect(picker.getByRole('tabpanel').locator('[data-campaign-id="theDrownedCity"]')).toHaveCount(1)
  await expect(picker.getByRole('button', { name: /吞噬万物|深渊守卫/ })).toHaveCount(0)
  await season.press('ArrowRight')
  await expect(picker.getByRole('tab', { name: '重返系列' })).toBeFocused()
  await picker.getByRole('button', { name: /重返夜之狂热/ }).click()
  await picker.getByRole('tab', { name: '支线' }).click()
  await expect(picker.getByRole('status')).toHaveText('重返夜之狂热')
  await expect(picker.getByRole('button', { name: /狼人诅咒/ })).toBeVisible()
  await expect(picker.getByRole('button', { name: /读书至死/ })).toBeVisible()
  for (const name of [/吞噬万物/, /深渊守卫/]) {
    const cover = picker.getByRole('button', { name }).locator('img')
    await cover.scrollIntoViewIfNeeded()
    await expect.poll(() => cover.evaluate(img => img.naturalWidth)).toBeGreaterThan(0)
  }
  await draft.check()
  await rollback.uncheck()
  await page.keyboard.press('Escape')
  await expect(launcher).toBeFocused()
  await expect(launcher).toContainText('夜之狂热')
  await expect(launcher).toContainText('普通模式')

  await launcher.click()
  await expect(season).toHaveAttribute('aria-selected', 'true')
  await expect(rollback).toBeChecked()
  await expect(picker.getByRole('button', { name: /^夜之狂热/, pressed: true })).toBeVisible()
  await draft.check()
  await rollback.uncheck()
  await expect(picker.locator('#ah-campaign-picker-mode-note')).toContainText('通过卡牌三选一')
  expect(await picker.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  const bounds = await picker.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
  await page.screenshot({ path: output + `campaign-picker-${width}.png`, animations: 'disabled' })
  await picker.getByRole('button', { name: '确认选择' }).click()
  await expect(launcher).toContainText('三选一模式')
  const started = page.waitForResponse('**/api/start')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  let session = (await (await started).json()).session
  expect(session.state.deckMode).toBe('draft')
  expect(session.settings.allowRollback).toBe('off')
  const hub = page.locator('.ah-hub')
  await hub.getByRole('button', { name: '选择调查员', exact: true }).click()
  await hub.locator('[data-code="01001"]').getByRole('button', { name: /选择调查员：罗兰/ }).click()
  await hub.getByRole('button', { name: '卡组构筑', exact: true }).click()
  const pane = hub.locator('.ah-draft-pane')
  await expect(pane.locator('.ah-draft-option')).toHaveCount(3)
  await pane.getByRole('button', { name: /刷新（剩余 5 次免费）/ }).click()
  await expect(pane).toContainText('剩余免费刷新 4 次')
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
  await move({ action: 'hubConfirmDeck' })
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
