import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from '../../../lib/server.js'
import { loadMods } from '../../../lib/mods.js'
import { createGameState, applyMove, legalMoves } from '../src/engine/engine.js'

const output = fileURLToPath(new URL('../artifacts/draft-mode/', import.meta.url))
fs.mkdirSync(output, { recursive: true })
let server, base, previousHome
test.use({ actionTimeout: 15_000 })

// Test-only interlude fixture: a legal 30-card deck, 2 XP and Versatile offered.
// All subsequent purchases, refill picks and readiness checks use real moves.
test.beforeAll(async () => {
  previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'arkham-draft-refill-'))
  const arkham = (await loadMods()).find(mod => mod.id === 'arkhamhorror')
  server = createServer({ mods: [{ ...arkham, createState(settings, players) {
    const s = createGameState({ ...settings, campaignHub: true, deckMode: 'draft', campaignId: 'nightOfTheZealot', seed: 'refill-browser' }, players)
    applyMove(s, 0, { action: 'hubGoSetup' })
    applyMove(s, 0, { action: 'hubSelectInvestigator', code: '01001' })
    const record = s.campaign.investigators[0]
    record.deck.push(...Array(30).fill('01016'))
    record.startingDeckReady = true
    record.xp = record.earnedXp = s.campaign.xp = 2
    record.draftMode = { phase: 'upgrade', round: 1, locked: false, options: ['01088', '06167', '01029'] }
    s.campaign.scenarioResults = [{ scenarioId: 'theGathering', investigators: [], recordsBefore: {}, recordsAfter: {} }]
    s.uiState = s.phase = s.campaign.phase = 'interlude'
    s.campaign.upgradesAllowed = true
    s.hubReady = false; s.hubSeatDone = {}
    s.legalMoves = legalMoves(s, 0)
    return s
  } }] })
  await server.ready
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})
test.afterAll(async () => {
  server?.closeAllConnections()
  if (server) await new Promise(resolve => server.close(resolve))
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
})

for (const width of [1440, 390]) test(`扩容后零经验补牌与出发限制 ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(base)
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.locator('.ah-hub-setup').getByText(/玩家人数|席位数量/).locator('..').locator('select').selectOption('1')
  await page.getByRole('button', { name: '开始新游戏', exact: true }).click()
  const pane = page.locator('.ah-draft-pane')
  await expect(pane).toHaveAttribute('data-draft-phase', 'upgrade')
  const permanent = pane.locator('[data-draft-code="06167"]')
  await expect(permanent.locator('select option')).toHaveCount(1)
  await permanent.locator('.bg-btn').click()
  await expect(pane).toHaveAttribute('data-draft-phase', 'refill')
  await expect(pane).toContainText('30 / 35 张，还需 5 张')
  await expect(pane.getByRole('button', { name: /完成升级|确认准备|锁定整组|刷新全部/ })).toHaveCount(0)
  await page.screenshot({ path: output + `refill-${width}.png`, animations: 'disabled' })
  for (let picked = 1; picked <= 5; picked++) {
    await pane.locator('.ah-draft-option .bg-btn').first().click()
    if (picked < 5) await expect(pane).toContainText(`${30 + picked} / 35 张，还需 ${5 - picked} 张`)
  }
  await expect(pane).toHaveAttribute('data-draft-phase', 'upgrade')
  await expect(pane).toContainText('可用经验 0 XP')
  await expect(pane.locator('.ah-draft-options .ah-draft-option')).toHaveCount(0)
  await expect(pane.getByRole('button', { name: /完成升级/ })).toBeVisible()
  await expect(pane.locator('.ah-draft-deck')).toHaveAttribute('data-deck-count', '39')
  expect(await pane.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  expect(errors).toEqual([])
})
