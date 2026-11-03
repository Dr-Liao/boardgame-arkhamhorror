import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('../../../artifacts/tfa-migration/', import.meta.url))
mkdirSync(output, { recursive: true })

async function sessionFor(page, sessionId) {
  return page.evaluate(async id =>
    (await (await fetch(`/api/session?sessionId=${encodeURIComponent(id)}`)).json()).session, sessionId)
}

async function submit(page, sessionId, session, move) {
  const result = await page.evaluate(async ({ id, revision, action }) => {
    const response = await fetch('/api/move', { method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: id, revision, move: { ...action, revision } }) })
    return response.json()
  }, { id: sessionId, revision: session.state.revision, action: move })
  expect(result.ok, JSON.stringify(result.error || '')).toBe(true)
  return result.session
}

async function settleChoices(page, sessionId, session, limit = 30) {
  for (let guard = 0; session.state.pendingChoice && guard < limit; guard++) {
    const choice = session.state.pendingChoice
    const move = session.state.legalMoves.find(item => item.action === 'choose' && item.optionId === 'done')
      || session.state.legalMoves.find(item => item.action === 'choose' && item.optionId === 'skip')
      || session.state.legalMoves.find(item => item.action === 'choose')
    expect(move, `no option for ${choice.kind}`).toBeTruthy()
    session = await submit(page, sessionId, session, move)
  }
  expect(session.state.pendingChoice).toBeFalsy()
  return session
}

async function dismissPresentation(page) {
  let quiet = 0
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await page.locator('.ah-cinematic').count() === 0) {
      if (++quiet >= 3) return
      await page.waitForTimeout(150)
      continue
    }
    quiet = 0
    const skip = page.getByRole('button', { name: '跳过演出' })
    const next = page.getByRole('button', { name: '继续', exact: true })
    if (await skip.count()) await skip.first().click({ timeout: 2000 }).catch(() => {})
    else if (await next.count()) await next.first().click({ timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(100)
  }
  throw new Error('presentation did not settle')
}

for (const [viewport, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`真实大厅经首章结算进入第二章 (${viewport})`, async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width, height })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/index.html')
    await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
    const setup = page.getByRole('dialog', { name: '调查准备设置' })
    await setup.getByRole('combobox', { name: '战役' }).selectOption('theForgottenAge')
    await setup.getByRole('combobox', { name: '席位数量' }).selectOption('1')
    const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/start')
      && response.request().method() === 'POST')
    await setup.getByRole('button', { name: '开始新游戏' }).click()
    const started = await (await responsePromise).json()
    expect(started.ok).toBe(true)
    expect(started.session.state.campaign.id).toBe('theForgottenAge')
    const sessionId = started.session.sessionId
    const hub = page.locator('.ah-hub')
    await expect(hub).toBeVisible()
    await expect(hub.getByText('提前体验', { exact: false })).toHaveCount(0)
    await hub.getByRole('button', { name: '选择调查员', exact: true }).click()
    await hub.getByRole('button', { name: /选择调查员：里奥/ }).click()
    await hub.getByRole('button', { name: /自动构筑/ }).click()
    await hub.getByRole('button', { name: '确认准备', exact: true }).first().click()
    await hub.getByRole('navigation', { name: '战役局外页面' })
      .getByRole('button', { name: '开始关卡', exact: true }).click()
    await hub.getByRole('button', { name: '开始当前关卡' }).click()
    const leader = hub.locator('.ah-hub-pane[aria-label="战役选择"]')
    await expect(leader).toBeVisible()
    await leader.getByRole('button', { name: '里奥·安德森' }).click()
    const market = hub.locator('.ah-supply-market')
    await expect(market).toBeVisible()
    await expect(market.locator('.ah-supply-market-purse b')).toHaveText('10')
    await market.locator('[data-supply="provisions"]').click()
    await expect(market.locator('.ah-supply-market-purse b')).toHaveText('9')
    await market.locator('[data-supply-done]').click()
    await expect(page.locator('.ah-table')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.bg-game-title').first()).toContainText('荒莽密林')
    expect(errors).toEqual([])
    expect(await page.evaluate(() => document.body.scrollWidth <= document.body.clientWidth + 1)).toBe(true)
    const shot = `${output}release-first-chapter-${viewport}.png`
    await page.screenshot({ path: shot, fullPage: true, animations: 'disabled' })
    test.info().annotations.push({ type: 'screenshot', description: shot })

    // Continue with the same server session: mulligan, resign at camp, resolve
    // the chapter, and enter the first interlude toward the next chapter.
    let session = await settleChoices(page, sessionId, await sessionFor(page, sessionId))
    expect(session.state.scenario.id).toBe('theUntamedWilds')
    const resign = session.state.legalMoves.find(move =>
      move.action === 'scenarioAction' && move.rule === 'resignCamp')
    expect(resign, 'camp resignation must be a legal printed action').toBeTruthy()
    session = await settleChoices(page, sessionId, await submit(page, sessionId, session, resign))
    expect(session.state.uiState).toBe('scenarioResult')
    const next = session.state.legalMoves.find(move => move.action === 'hubContinue')
    expect(next).toBeTruthy()
    session = await submit(page, sessionId, session, next)
    expect(session.state.campaign.flow.nodeId).toBe('interludeOne')
    session = await settleChoices(page, sessionId, session)
    expect(session.state.uiState).toBe('interlude')
    const readyNext = session.state.legalMoves.find(move => move.action === 'hubDoneSeat')
    expect(readyNext).toBeTruthy()
    session = await submit(page, sessionId, session, readyNext)
    expect(session.state.uiState).toBe('scenarioSetup')
    expect(session.state.campaign.flow.nodeId).toBe('theDoomOfEztli')
    for (let attempt = 0; attempt < 6; attempt++) {
      await dismissPresentation(page)
      if (await hub.count()) break
      await page.getByRole('button', { name: '刷新局势' }).click()
      await page.waitForTimeout(200)
    }
    await expect(hub).toBeVisible({ timeout: 30_000 })
    await dismissPresentation(page)
    await hub.getByRole('navigation', { name: '战役局外页面' })
      .getByRole('button', { name: '开始关卡', exact: true }).click()
    await expect(page.locator('.ah-office-departure h2')).toContainText('埃兹特里的覆灭')
    const nextShot = `${output}release-second-chapter-${viewport}.png`
    await page.screenshot({ path: nextShot, fullPage: true, animations: 'disabled' })
    test.info().annotations.push({ type: 'screenshot', description: nextShot })
  })
}
