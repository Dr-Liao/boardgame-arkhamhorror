import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { fixture, legalMoves, move } from './core-fixture.mjs'
import { viewEvents, viewState } from '../src/integration/observation.js'

const output = fileURLToPath(new URL('../artifacts/acceptance/50-a/', import.meta.url))
mkdirSync(output, { recursive: true })

async function openTable(page, settings, engine) {
  let session
  await page.addLocatorHandler(page.getByRole('button', { name: '跳过演出' }), button => button.click())
  await page.route('**/mods/arkhamhorror/img/thumbs/zh/cards/5*.webp*', route => route.fulfill({ status: 404 }))
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId: 'arkhamhorror', settings: {
      legacyAutoStart: true, playerCount: 1, seed: 'acceptance-50-a', ...settings,
    } }) })
    const body = await response.json()
    session = body.session
    if (engine) session.state = viewState(engine, 0)
    await route.fulfill({ response, json: body })
  })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  if (engine) {
    // 用真实引擎处理 UI 提交的行动，夹具仅负责提供确定的起始手牌。
    await page.route('**/api/move', async route => {
      const events = viewEvents(move(engine, route.request().postDataJSON().move), 0)
      const firstSeq = Math.max(-1, ...(session.events || []).map(event => event.seq ?? -1)) + 1
      session.events = [...(session.events || []), ...events.map((event, index) => ({ ...event, seq: firstSeq + index }))]
      session.state = viewState(engine, 0)
      await route.fulfill({ json: { ok: true, session } })
    })
  }
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toBeVisible()
}

for (const width of [1440, 390]) {
  test(`50006 / 51003 可从手牌区打出并结算 (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const engine = fixture('01002')
    const inv = engine.investigators[0]
    inv.hand = ['50006', '51003']
    engine.locations.find(location => location.id === inv.location).clues = 1
    engine.legalMoves = legalMoves(engine, 0)
    await openTable(page, { playerInvestigator: '01002' }, engine)
    for (const code of ['50006', '51003']) {
      const hand = page.locator('[data-interaction="hand:0:0"]').first()
      await expect(hand).toBeVisible()
      await hand.click()
      const playArea = page.locator('[data-interaction="zone:play"]')
      await expect(playArea).toHaveClass(/ah-drop-valid/)
      await playArea.click()
      await expect.poll(() => engine.investigators[0].discard.includes(code)).toBe(true)
    }
    expect(engine.investigators[0].resources).toBe(35)
    expect(engine.investigators[0].hand).toHaveLength(3)
    await page.screenshot({ path: `${output}/player-${width}.png`, animations: 'disabled' })
  })

  test(`重返聚集于此使用真实章节的关卡设置指南 (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await openTable(page, { campaignId: 'returnToNightOfTheZealot' })
    const response = page.waitForResponse(result => result.ok() && result.url().endsWith('/scenario-guides/returnToTheGathering.json'))
    await page.locator('[data-scenario-setup]').click()
    await response
    const guide = page.getByRole('dialog', { name: '关卡设置', exact: true })
    await expect(guide).toBeVisible()
    await expect(guide.getByText(/远在房屋之上/).first()).toBeVisible()
    expect(await guide.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: `${output}/gathering-guide-${width}.png`, animations: 'disabled' })
  })
}
