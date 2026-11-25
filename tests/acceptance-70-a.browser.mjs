import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { viewEvents, viewState } from '../src/integration/observation.js'
import { legalMoves, move } from './core-fixture.mjs'
import { openAbandonedWarehouse } from './acceptance-70-a-fixture.mjs'

const output = fileURLToPath(new URL('../artifacts/acceptance/70-a/', import.meta.url))
mkdirSync(output, { recursive: true })

async function openTable(page, engine) {
  let session
  await page.route('**/mods/arkhamhorror/img/thumbs/**', route => route.fulfill({ status: 404 }))
  await page.addLocatorHandler(page.getByRole('button', { name: '跳过演出' }), button => button.click())
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({
      modId: 'arkhamhorror',
      settings: { legacyAutoStart: true, campaignId: engine.scenario.id, playerCount: 1, seed: 'acceptance-70-a' },
    }) })
    const body = await response.json()
    session = body.session
    session.state = viewState(engine, 0)
    await route.fulfill({ response, json: body })
  })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  await page.route('**/api/move', async route => {
    const events = viewEvents(move(engine, route.request().postDataJSON().move), 0)
    const firstSeq = Math.max(-1, ...(session.events || []).map(event => event.seq ?? -1)) + 1
    session.events = [...(session.events || []), ...events.map((event, index) => ({ ...event, seq: firstSeq + index }))]
    session.state = viewState(engine, 0)
    await route.fulfill({ json: { ok: true, session } })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toBeVisible()
}

for (const width of [1440, 390]) {
  test(`70032 可从废弃仓库发起调查并取得线索 (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const engine = openAbandonedWarehouse()
    engine.legalMoves = legalMoves(engine, 0)
    await openTable(page, engine)
    await expect(page.locator('[data-interaction="location:abandonedWarehouse"]').first()).toBeVisible()
    const investigate = page.getByRole('button', { name: /调查.*废弃仓库|^调查$/ }).first()
    await expect(investigate).toBeEnabled()
    await investigate.click()
    await page.getByRole('button', { name: '开始检定', exact: true }).click()
    await expect.poll(() => engine.locations.find(location => location.id === 'abandonedWarehouse').clues).toBe(1)
    await expect(page.locator('.ah-table')).toHaveAttribute('data-revision', String(engine.revision))
    await page.screenshot({ path: `${output}/70032-${width}.png`, animations: 'disabled' })
  })
}
